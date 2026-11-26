// Token radar model v2: fitted on the snapshot's own token-bearing peers, kept only where held-out
// tests support it. Every number below was measured on this snapshot (2026-11-14, 758 protocols)
// before this file was written; the dashboard prints the same numbers.
//
// VALUE MODEL. Peers: the 128 protocols with mcap_usd > 0 and tvl_usd > 0. Response: log10(mcap).
// Candidate terms were scored by 5-fold cross-validation (seed 7) and a walk-forward split by
// listed_at (train oldest 70%, test newest 30%):
//   intercept only ............ CV RMSE 1.0097
//   + log10(TVL) .............. CV RMSE 0.9094
//   + log10(TVL)^2 ............ CV RMSE 0.9216  (dropped: worse held out)
//   + chains .................. CV RMSE 0.9175  (dropped)
//   + age ..................... CV RMSE 0.9367  (dropped)
//   + change_7d (clamped) ..... CV RMSE 0.9024  (kept)
//   category median ratio ..... CV RMSE 0.9906  (dropped)
// Kept model, refit on all 128 peers:
//   log10(implied) = 2.8229 + 0.5292 * log10(tvl_usd) - 1.6129 * clamp(change_7d, -60, 120) / 100
// Walk-forward RMSE 0.9874 (n=29). The negative growth sign is the data's: among peers, a hot
// 7-day TVL print predicts a LOWER mcap/TVL, consistent with TVL arriving after the token priced.
// Interval: 80% band from in-sample residual quantiles (q10 -1.286, q90 +0.985 in log10), printed
// as a range, never as false precision.
//
// TOKEN ODDS. Category token rates over all 758 protocols, shrunk toward the global rate 0.5488
// with k=10 pseudo-counts. Held-out Brier 0.2274 vs 0.2487 for the global rate alone (5-fold,
// seed 11), so category odds are kept; k=10 beat k=0/5/20/40.
//
// FARM VERDICT. Scenario math, stated on the dashboard: minimum viable capital by TVL tier;
// expected capture = EV x (capital / TVL) x 10 early-activity multiplier, over the plan's hours.
// It is a sizing aid under a printed assumption, not a promised return.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  intercept: number;
  logtvl_coef: number;
  change_coef: number;
  change_floor: number;
  change_cap: number;
  resid_q10: number;
  resid_q90: number;
  odds_global: number;
  odds_shrink_k: number;
  cv_rmse: number;
  walkforward_rmse: number;
  odds_brier: number;
  odds_brier_global: number;
  peers: number;
}

export const MODEL: ModelConstants = {
  intercept: 2.8229,
  logtvl_coef: 0.5292,
  change_coef: -1.6129,
  change_floor: -60,
  change_cap: 120,
  resid_q10: -1.286,
  resid_q90: 0.985,
  odds_global: 0.5488,
  odds_shrink_k: 10,
  cv_rmse: 0.9024,
  walkforward_rmse: 0.9874,
  odds_brier: 0.2274,
  odds_brier_global: 0.2487,
  peers: 128,
};

export const MODEL_VERSION = 'radar-2-fitted';
export const EARLY_ROWS = 200;
export const LIVE_ROWS = 24;

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  odds: number;
  value_lo_usd: number;
  value_hi_usd: number;
  ev_usd: number;
  verdict_usd_per_hour: number;
  capital_usd: number;
  on_watchlist: boolean;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  protocol_total: number;
  token_bearing: number;
  pretoken_total: number;
  rows: RadarRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Fitted implied launch value: log10(mcap) regression on the snapshot's token-bearing peers. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const growthPct = Math.min(model.change_cap, Math.max(model.change_floor, finite(protocol.change_7d, 0)));
  const logImplied = model.intercept + model.logtvl_coef * Math.log10(Math.max(1, protocol.tvl_usd)) + (model.change_coef * growthPct) / 100;
  const implied = Math.max(1, Math.round(Math.pow(10, logImplied)));
  // growth/maturity multipliers kept for dashboard continuity: growth shows the change term's
  // factor, maturity is 1 (the age term failed held-out tests and was dropped).
  const growthMult = Math.pow(10, (model.change_coef * growthPct) / 100);
  return { implied, growthPct, growthMult, maturityMult: 1, age };
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

function hasToken(p: SnapshotProtocol): boolean {
  return Boolean(p.gecko_id || p.symbol || (p.mcap_usd !== null && p.mcap_usd > 0));
}

/** Category token odds with k=10 shrinkage toward the global rate, fitted on the whole snapshot. */
export function categoryOdds(snapshot: Snapshot, model: ModelConstants): Map<string, number> {
  const counts = new Map<string, { n: number; t: number }>();
  for (const p of snapshot.protocols) {
    const key = p.category ?? '(none)';
    const c = counts.get(key) ?? { n: 0, t: 0 };
    c.n += 1;
    if (hasToken(p)) c.t += 1;
    counts.set(key, c);
  }
  const odds = new Map<string, number>();
  for (const [key, c] of counts) odds.set(key, (c.t + model.odds_shrink_k * model.odds_global) / (c.n + model.odds_shrink_k));
  return odds;
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const r = impliedValue(p, snapshot.as_of, model);
    return { p, ...r };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: round4(s.implied / Math.max(1, s.p.tvl_usd)),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: 1,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    { text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`, cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: action, cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`, time: '15 minutes to set up' },
    { text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: `the $${capital} stays in the position`, time: `${hold} days` },
    { text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
    { text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`, cost: 'nothing but the log', time: '5 minutes' },
  ];
}

/** Scenario verdict: expected capture per hour at minimum viable capital (assumption printed). */
export function verdictPerHour(p: SnapshotProtocol, ev: number, age: number | null): { verdict: number; capital: number } {
  const capital = capitalFor(p);
  const weeks = Math.ceil(holdDaysFor(age) / 7);
  const hours = 0.25 + weeks * (10 / 60) + 10 / 60;
  const capture = ev * (capital / Math.max(p.tvl_usd, capital)) * 10;
  return { verdict: Math.round((capture / hours) * 100) / 100, capital };
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, chains: p.chains, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd, change_7d: p.change_7d }));
}

export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const odds = categoryOdds(snapshot, model);
  const watch = new Set(snapshot.watchlist);
  const index = bySlug(snapshot.protocols);
  const rows: RadarRow[] = board.map((row) => {
    const p = index.get(row.slug)!;
    const o = odds.get(p.category ?? '(none)') ?? model.odds_global;
    const lo = Math.max(1, Math.round(row.implied_value_usd * Math.pow(10, model.resid_q10)));
    const hi = Math.max(lo, Math.round(row.implied_value_usd * Math.pow(10, model.resid_q90)));
    const ev = Math.round(row.implied_value_usd * o);
    const { verdict, capital } = verdictPerHour(p, ev, row.age_days);
    return {
      rank: row.rank,
      slug: row.slug,
      name: row.name,
      category: row.category,
      chains: row.chains,
      tvl_usd: row.tvl_usd,
      change_7d: row.change_7d,
      mcap_usd: row.mcap_usd,
      listed_at: row.listed_at,
      age_days: row.age_days,
      implied_value_usd: row.implied_value_usd,
      growth_multiplier: row.model.growth_multiplier,
      maturity_multiplier: row.model.maturity_multiplier,
      odds: round4(o),
      value_lo_usd: lo,
      value_hi_usd: hi,
      ev_usd: ev,
      verdict_usd_per_hour: verdict,
      capital_usd: capital,
      on_watchlist: watch.has(row.slug),
    };
  });
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !watch.has(r.slug)).length,
    live_size: live.length,
    protocol_total: snapshot.protocols.length,
    token_bearing: snapshot.protocols.filter(hasToken).length,
    pretoken_total: snapshot.protocols.filter(isPreToken).length,
    rows,
    live,
  };
  return { board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
