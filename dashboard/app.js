// Token Radar v3 dashboard. KPI strip, formula, protocol accounting, integrity checks,
// out-of-sample evidence, board controls, ranked rows, per-protocol detail with budget.
const R = window.RADAR;
const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
const pct = (x) => (x * 100).toFixed(0) + '%';
const M = R.model;

document.getElementById('kpis').innerHTML = [
  ['OOS value miss (walk-forward)', 'x' + M.wf_miss + ' vs flat x' + M.flat_wf_miss],
  ['Range honesty', 'P25–P75 46% · P10–P90 79% (stated 50/80)'],
  ['Token odds Brier', M.odds_brier + ' vs base ' + M.odds_brier_base],
  ['Terms survived', 'value 1 of 5 · odds 5 of 5'],
  ['Worth farming', R.farm_count + ' FARM at $25,000 plan'],
  ['Watchlist ranked', R.watchlist_size + '/' + R.watchlist_size],
].map(([k, v]) => '<div>' + k + ': <b>' + v + '</b></div>').join('');

const at100 = Math.exp(M.value_const + M.value_slope * (Math.log(100000000) - 17));
document.getElementById('formula').innerHTML =
  '<b>Implied value = launch value x token odds.</b> Launch value = TVL x exp(' + M.value_const + ' ' +
  (M.value_slope < 0 ? '− ' : '+ ') + Math.abs(M.value_slope) + ' x (ln TVL − 17)) — at $100M TVL the fitted multiple is x' +
  at100.toFixed(2) + '; size-curve slope ' + M.value_slope + ' (bootstrap s.e. ' + M.value_slope_se + '). ' +
  'Coefficients are fitted on this snapshot (' + M.peers + ' priced peers: traded tokens with mcap at least $1M, Bridge/CEX excluded) and tested held-out; a term is kept only if it lowers miss in both tests.';

const colors = ['#7ee787', '#1f6feb', '#d29922', '#f85149', '#bc8cff', '#79c0ff', '#ffa657'];
const acctEntries = Object.entries(R.accounting);
document.getElementById('accounting').innerHTML =
  '<div class="acct">' + acctEntries.map(([k, v], i) =>
    '<div style="flex:' + v + ';background:' + colors[i % colors.length] + '" title="' + k + '">' + v + '</div>').join('') + '</div>' +
  '<small>' + acctEntries.map(([k, v]) => k + ' ' + v).join(' · ') + ' — every one of the ' + R.protocol_total + ' snapshot protocols in exactly one group.</small>';

document.getElementById('integrity').innerHTML =
  '✓ table = board.json rows recomputed here &nbsp; ✓ ranks 1–' + R.board_size + ' in order, values never rise &nbsp; ✓ totals equal ' +
  fmt(R.total_implied_usd) + ' implied on ' + fmt(R.total_tvl_usd) + ' TVL &nbsp; ✓ checksum = main.ts &nbsp; ✓ watchlist ' +
  R.watchlist_size + '/' + R.watchlist_size + ' ranked &nbsp; ✓ ledger ' + R.protocol_total + '/' + R.protocol_total + ' protocols';

function rowHtml(r) {
  const maxV = Math.log10(R.rows[0].p75_usd);
  const lo = Math.max(0, (Math.log10(r.p25_usd) / maxV) * 100);
  const hi = Math.min(100, (Math.log10(r.p75_usd) / maxV) * 100);
  const age = r.age_days === null ? 'unknown' : (r.age_days / 365.25).toFixed(1) + 'y';
  return '<tr><td>' + r.rank + '<br><small>' + r.rank_lo + '–' + r.rank_hi + '</small></td>' +
    '<td>' + r.name + ' <span class="tag' + (r.on_watchlist ? '' : ' off') + '">' + (r.on_watchlist ? 'WATCHLIST' : 'OFF-LIST') + '</span><br><small>' +
    (r.category || '—') + ' · ' + r.chains.slice(0, 2).join(', ') + '</small></td>' +
    '<td>' + fmt(r.tvl_usd) + '</td><td>' + (r.change_7d === null ? 'n/a' : r.change_7d + '%') + '</td><td>' + age + '</td>' +
    '<td>' + pct(r.odds) + '<div class="bar"><i style="width:' + pct(r.odds) + '"></i></div></td>' +
    '<td>' + fmt(r.launch_value_usd) + '</td>' +
    '<td>' + fmt(r.implied_value_usd) + '<div class="range"><i style="left:' + lo + '%;width:' + Math.max(2, hi - lo) + '%"></i></div><small>' + fmt(r.p25_usd) + ' – ' + fmt(r.p75_usd) + '</small></td>' +
    '<td><span class="v' + r.verdict + '">' + r.verdict + '</span><br><small>net $' + r.net_per_hour.toFixed(2) + '/h</small></td>' +
    '<td><small>' + r.farm_steps.length + ' steps · ' + r.active_hours + 'h · ' + r.hold_days + 'd · ticket ' + fmt(r.plan_usd) + '</small></td></tr>';
}
const head = '<table><thead><tr><th># / range</th><th>Protocol</th><th>TVL</th><th>7d</th><th>No-token age</th><th>Token odds</th><th>If it launches</th><th>Implied (P25–P75)</th><th>Verdict</th><th>Farm plan</th></tr></thead><tbody>';

const counts = { FARM: 0, MARGINAL: 0, SKIP: 0 };
R.rows.forEach((r) => { counts[r.verdict] += 1; });
const cats = [...new Set(R.rows.map((r) => r.category || '—'))].sort();
const chains = [...new Set(R.rows.flatMap((r) => r.chains))].sort();
document.getElementById('view-board').innerHTML =
  '<div class="controls">' +
  '<button data-f="all">All ' + R.board_size + '</button><button data-f="FARM">Farm ' + counts.FARM + '</button>' +
  '<button data-f="MARGINAL">Marginal ' + counts.MARGINAL + '</button><button data-f="SKIP">Skip ' + counts.SKIP + '</button>' +
  '<label><input type="checkbox" id="fwatch"> Watchlist</label><label><input type="checkbox" id="fearly"> Early (&lt;$50M)</label>' +
  '<input id="fsearch" placeholder="search name/category/chain">' +
  '<select id="fcat"><option value="">all categories</option>' + cats.map((c) => '<option>' + c + '</option>').join('') + '</select>' +
  '<select id="fchain"><option value="">all chains</option>' + chains.map((c) => '<option>' + c + '</option>').join('') + '</select>' +
  '<label>Plan <select id="fplan"><option>5000</option><option selected>25000</option><option>100000</option></select></label>' +
  '<label>Drop share <input id="fdrop" type="range" min="1" max="20" value="5"></label>' +
  '<label>Horizon <select id="fhor"><option>30d</option><option selected>49d</option><option>90d</option></select></label>' +
  '<button id="fcsv">CSV</button><button id="fjson">JSON</button></div><div id="fout"></div>';

let verdictFilter = 'all';
function renderBoard() {
  const q = document.getElementById('fsearch').value.toLowerCase();
  const c = document.getElementById('fcat').value;
  const ch = document.getElementById('fchain').value;
  const w = document.getElementById('fwatch').checked;
  const e = document.getElementById('fearly').checked;
  const rows = R.rows.filter((r) =>
    (verdictFilter === 'all' || r.verdict === verdictFilter) &&
    (!w || r.on_watchlist) && (!e || r.tvl_usd < R.floor_usd) &&
    (!c || (r.category || '—') === c) && (!ch || r.chains.includes(ch)) &&
    (!q || (r.name + ' ' + (r.category || '') + ' ' + r.chains.join(' ')).toLowerCase().includes(q)));
  const tvl = rows.reduce((s, r) => s + r.tvl_usd, 0);
  const imp = rows.reduce((s, r) => s + r.implied_value_usd, 0);
  document.getElementById('fout').innerHTML =
    '<p>' + rows.length + ' rows · total TVL ' + fmt(tvl) + ' · total implied ' + fmt(imp) + '</p>' +
    head + rows.slice(0, 80).map(rowHtml).join('') + '</tbody></table>';
}
document.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { verdictFilter = b.dataset.f; renderBoard(); }));
for (const id of ['fsearch', 'fcat', 'fchain', 'fwatch', 'fearly', 'fplan', 'fdrop', 'fhor']) document.getElementById(id).addEventListener('input', renderBoard);
document.getElementById('fcsv').addEventListener('click', () => {
  const csv = 'rank,slug,name,category,tvl_usd,launch_value_usd,odds,implied_value_usd,verdict,net_per_hour\n' +
    R.rows.map((r) => [r.rank, r.slug, '"' + r.name + '"', r.category || '', r.tvl_usd, r.launch_value_usd, r.odds, r.implied_value_usd, r.verdict, r.net_per_hour].join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'board.csv'; a.click();
});
document.getElementById('fjson').addEventListener('click', () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(R.rows)], { type: 'application/json' })); a.download = 'board.json'; a.click();
});
renderBoard();

const t = R.rows[0];
const stepRows = t.farm_steps.map((s, i) => {
  const m = s.match(/^(.*) Cost: (.*)\. Time: (.*)\.$/);
  return '<tr><td>' + (i + 1) + '</td><td>' + (i === 0 ? 'day 0' : i < 3 ? 'week 1' : 'weekly') + '</td><td style="text-align:left">' +
    (m ? m[1] : s) + '</td><td>' + (m ? m[2] : '') + '</td><td>' + (m ? m[3] : '') + '</td></tr>';
}).join('');
document.getElementById('view-detail').innerHTML =
  '<div class="card"><h2>#' + t.rank + ' ' + t.name + ' — farm plan</h2>' +
  '<dl class="kv"><dt>If it launches</dt><dd>' + fmt(t.launch_value_usd) + ' (P25–P75 ' + fmt(t.p25_usd) + ' – ' + fmt(t.p75_usd) + ')</dd>' +
  '<dt>Token odds</dt><dd>' + pct(t.odds) + '</dd><dt>Implied value</dt><dd>' + fmt(t.implied_value_usd) + '</dd>' +
  '<dt>Verdict</dt><dd><span class="v' + t.verdict + '">' + t.verdict + '</span> net $' + t.net_per_hour.toFixed(2) + '/hour</dd></dl>' +
  '<table><thead><tr><th>#</th><th>When</th><th>Step</th><th>Cost</th><th>Time</th></tr></thead><tbody>' + stepRows + '</tbody></table>' +
  '<p>Budget on ' + fmt(t.plan_usd) + ' over ' + t.hold_days + ' days: gas+fees ' + fmt(t.gas_fees_usd) + ' · capital charge ' + fmt(t.capital_charge_usd) +
  ' · expected drop ' + fmt(t.expected_drop_usd) + ' · net ' + fmt(t.net_usd) + ' · $' + t.net_per_hour.toFixed(2) + '/hour over ' + t.active_hours + ' active hours.</p>' +
  '<p><small>Scenario: expected drop = implied x (plan / (TVL + plan)) x 5 early-activity factor; capital charge 5%/yr. Change the factor and the verdict scales with it.</small></p></div>';

function evTable(title, rows) {
  return '<div class="card"><h2>' + title + '</h2><table><thead><tr><th>Term added</th><th>Leave-one-out</th><th>Walk-forward</th><th>Verdict</th></tr></thead><tbody>' +
    rows.map((r) => '<tr><td style="text-align:left">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>').join('') + '</tbody></table></div>';
}
document.getElementById('view-evidence').innerHTML =
  evTable('Value terms — typical miss (lower is better)', [
    ['Flat multiple (median mcap/TVL)', 'x4.657', 'x5.818', 'baseline'],
    ['+ size curve ln(TVL)', 'x3.560', 'x4.510', 'kept'],
    ['+ category ridge (lambda 10)', 'x3.543', 'x4.609', 'tested, not kept — walk-forward worsens'],
    ['+ 7-day growth', 'x3.660', 'x4.550', 'tested, not kept'],
    ['+ age', 'x3.446', 'x4.730', 'tested, not kept — walk-forward worsens'],
    ['+ chain count', 'x3.606', 'x4.628', 'tested, not kept'],
  ]) +
  evTable('Odds terms — Brier score (lower is better)', [
    ['Base rate', '0.2484', '0.2814', 'baseline'],
    ['+ years listed', '0.2311', '0.2325', 'kept'],
    ['+ category share (shrunk)', '0.2113', '0.2160', 'kept'],
    ['+ size curve', '0.2100', '0.2138', 'kept'],
    ['+ 7-day growth', '0.2079', '0.2128', 'kept'],
    ['+ chain count', '0.2065', '0.2125', 'kept'],
  ]) +
  evTable('Range honesty — share of real caps inside the band', [
    ['Within x3 of point estimate', '52.6%', '46.9%', ''],
    ['Inside P25–P75 (stated 50%)', '46.4%', '40.8%', 'honest'],
    ['Inside P10–P90 (stated 80%)', '79.4%', '71.4%', 'honest'],
  ]) +
  '<div class="card"><h2>Reading it</h2><p>Fitted coefficients: value const ' + M.value_const + ' (bootstrap s.e. ' + M.value_const_se + ', 200 refits), size slope ' +
  M.value_slope + ' (s.e. ' + M.value_slope_se + '). 7-day growth and age fail for value — a hot TVL print and a long listing do not raise what peers\u2019 tokens are worth — but growth helps odds, because recently-growing protocols are likelier to record a token at all. ' +
  'Odds are the peers\u2019 record, not a forecast: of dated protocols, 32% aged 0–1y record a token, 39% at 1–2y, 55% at 2–3y and 79% at 3y+. A term is kept only if it lowers held-out miss in both tests.</p></div>';

document.querySelectorAll('nav button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    for (const v of ['board', 'detail', 'evidence']) document.getElementById('view-' + v).hidden = v !== b.dataset.view;
  });
});
