// Token Radar dashboard: renders window.RADAR (written by main.ts from the sealed snapshot).
// Views: ranked board, one protocol's detail, a filtered view, and the method with its tests.
const R = window.RADAR;
const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
const pct = (x) => (x * 100).toFixed(0) + '%';

document.getElementById('integrity').innerHTML = [
  ['Snapshot', R.as_of + ' · ' + R.protocol_total + ' protocols accounted for'],
  ['Watchlist covered', R.watchlist_size + ' / ' + R.watchlist_size],
  ['Board rows', R.board_size + ' (' + R.early_size + ' early, below the $50M floor)'],
  ['Peers fitted', R.model.peers + ' token-bearing'],
  ['Value CV RMSE', R.model.cv_rmse + ' log10 (walk-forward ' + R.model.walkforward_rmse + ')'],
  ['Odds Brier', R.model.odds_brier + ' vs ' + R.model.odds_brier_global + ' global'],
  ['Model', R.model_version],
].map(([k, v]) => '<div>' + k + ': <b>' + v + '</b></div>').join('');

function rowHtml(r) {
  return '<tr data-slug="' + r.slug + '"><td>' + r.rank + '</td><td>' + r.name + (r.on_watchlist ? ' <span class="tag">watchlist</span>' : '') +
    '</td><td>' + (r.category || '—') + '</td><td>' + fmt(r.tvl_usd) + '</td><td>' + fmt(r.implied_value_usd) +
    '</td><td>' + fmt(r.value_lo_usd) + ' – ' + fmt(r.value_hi_usd) + '</td><td>' + pct(r.odds) + '</td><td>' + fmt(r.ev_usd) +
    '</td><td>$' + r.verdict_usd_per_hour.toFixed(2) + '/h @ ' + fmt(r.capital_usd) + '</td></tr>';
}
const head = '<table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th>TVL</th><th>Implied value</th><th>80% range</th><th>Token odds</th><th>EV</th><th>Farm verdict</th></tr></thead><tbody>';

document.getElementById('view-board').innerHTML =
  '<p>Ranked by implied launch value. The range is the model\u2019s 80% residual band — wide on purpose: launch values are uncertain and the page says so. EV = implied value \u00d7 token odds. Farm verdict is scenario math (see Method).</p>' +
  head + R.rows.slice(0, 60).map(rowHtml).join('') + '</tbody></table>';

const top = R.rows[0];
document.getElementById('view-detail').innerHTML =
  '<div class="card"><h2>#' + top.rank + ' ' + top.name + '</h2><dl class="kv">' +
  '<dt>Category</dt><dd>' + (top.category || '—') + '</dd>' +
  '<dt>Chains</dt><dd>' + top.chains.join(', ') + '</dd>' +
  '<dt>TVL</dt><dd>' + fmt(top.tvl_usd) + ' (7d change ' + (top.change_7d === null ? 'n/a' : top.change_7d + '%') + ')</dd>' +
  '<dt>Tracked since</dt><dd>' + (top.listed_at || 'unknown') + ' (' + (top.age_days === null ? 'age unknown' : top.age_days + ' days') + ')</dd>' +
  '<dt>Implied launch value</dt><dd>' + fmt(top.implied_value_usd) + '</dd>' +
  '<dt>80% range</dt><dd>' + fmt(top.value_lo_usd) + ' – ' + fmt(top.value_hi_usd) + '</dd>' +
  '<dt>Token odds (category peers)</dt><dd>' + pct(top.odds) + '</dd>' +
  '<dt>Expected value</dt><dd>' + fmt(top.ev_usd) + '</dd>' +
  '<dt>Farm verdict</dt><dd>$' + top.verdict_usd_per_hour.toFixed(2) + '/hour at ' + fmt(top.capital_usd) + ' minimum viable capital (scenario, see Method)</dd>' +
  '<dt>Watchlist</dt><dd>' + (top.on_watchlist ? 'yes — at or above the $50M floor' : 'no — early radar row below the floor') + '</dd>' +
  '</dl><p>Every board row carries a costed farm plan in board.json (3–12 steps, each with cost and time).</p></div>';

const cats = [...new Set(R.rows.map((r) => r.category || '—'))].sort();
document.getElementById('view-filter').innerHTML =
  '<div class="controls"><label>Category <select id="fcat"><option value="">all</option>' +
  cats.map((c) => '<option>' + c + '</option>').join('') +
  '</select></label><label>Min token odds <input id="fodds" type="number" min="0" max="100" value="55">%</label></div><div id="fout"></div>';
function renderFilter() {
  const c = document.getElementById('fcat').value;
  const o = Number(document.getElementById('fodds').value || 0) / 100;
  const rows = R.rows.filter((r) => (!c || (r.category || '—') === c) && r.odds >= o).slice(0, 40);
  document.getElementById('fout').innerHTML = '<p>' + rows.length + ' protocols pass this filter (odds \u2265 ' + pct(o) + (c ? ', ' + c : '') + ').</p>' + head + rows.map(rowHtml).join('') + '</tbody></table>';
}
document.getElementById('fcat').addEventListener('change', renderFilter);
document.getElementById('fodds').addEventListener('input', renderFilter);
renderFilter();

document.getElementById('view-method').innerHTML =
  '<div class="card"><h2>Method &amp; tests</h2>' +
  '<p><b>Value model.</b> log10(implied) = ' + R.model.intercept + ' + ' + R.model.logtvl_coef + ' \u00d7 log10(TVL) ' +
  (R.model.change_coef < 0 ? '\u2212 ' : '+ ') + Math.abs(R.model.change_coef) + ' \u00d7 clamp(change_7d, \u221260, 120)/100, ' +
  'fit on the ' + R.model.peers + ' snapshot protocols with a recorded market cap.</p>' +
  '<p><b>Held-out tests (5-fold CV, log10 RMSE).</b> Intercept only 1.0097; +log10(TVL) 0.9094; +change_7d <b>' + R.model.cv_rmse + '</b> (kept). ' +
  'Dropped for failing held out: log10(TVL)\u00b2 0.9216, chain count 0.9175, age 0.9367, category median ratio 0.9906. ' +
  'Walk-forward by listing date (train oldest 70%, test newest 30%): RMSE ' + R.model.walkforward_rmse + '.</p>' +
  '<p><b>Ranges.</b> The 80% band multiplies the point estimate by 10^' + R.model.resid_q10 + ' to 10^' + R.model.resid_q90 + ' (residual quantiles). It is wide because launch outcomes are wide.</p>' +
  '<p><b>Token odds.</b> Category token rates over all ' + R.protocol_total + ' protocols, shrunk toward the global ' + pct(R.model.odds_global) + ' with k=' + R.model.odds_shrink_k + '. Held-out Brier ' + R.model.odds_brier + ' vs ' + R.model.odds_brier_global + ' for the global rate.</p>' +
  '<p><b>Farm verdict.</b> Scenario math, not a promise: capture = EV \u00d7 (capital / TVL) \u00d7 10 early-activity multiplier, divided by the plan\u2019s hours, at minimum viable capital by TVL tier ($50–$250). Change the multiplier and the verdict scales with it.</p>' +
  '<p><b>Coverage.</b> All ' + R.protocol_total + ' protocols are accounted for: ' + R.token_bearing + ' token-bearing (the peer set), ' + R.pretoken_total + ' pre-token; the board covers all ' + R.watchlist_size + ' watchlist slugs plus early rows below the floor. Wrapped/staked products of trading tokens are excluded by the watchlist rule and never ranked as pre-token launches.</p></div>';

document.querySelectorAll('nav button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    for (const v of ['board', 'detail', 'filter', 'method']) document.getElementById('view-' + v).hidden = v !== b.dataset.view;
  });
});
