// Token radar model v4. Two fitted models, every term kept only if it lowers held-out miss in
// BOTH leave-one-out and walk-forward tests on this snapshot (2026-11-14, 758 protocols).
//
// VALUE (97 peers: traded tokens with mcap >= $1M, tvl > 0, Bridge/CEX categories excluded —
// microcaps and exchange/bridge caps are not launch comps; response ln(mcap/TVL);
// miss = exp(mean |log error|); walk-forward prices each newer peer from all older peers):
//   flat multiple (median ratio) .... LOO x4.657  WF x5.818
//   + size curve ln(TVL) ............ LOO x3.560  WF x4.510  KEPT
//   + category ridge (lambda 10) .... LOO x3.543  WF x4.609  tested, not kept (WF worsens)
//   + 7-day growth .................. LOO x3.660  WF x4.550  tested, not kept
//   + age ........................... LOO x3.446  WF x4.730  tested, not kept (WF worsens)
//   + chain count ................... LOO x3.606  WF x4.628  tested, not kept
// Kept: ln(launch/TVL) = -0.5760 (se .176) - 0.6316 (se .090) * (ln TVL - 17).
// Range honesty (LOO): within x3 52.6%, inside P25-P75 46.4% (stated 50%), inside P10-P90 79.4%
// (stated 80%). Walk-forward: within x3 46.9%, P25-P75 40.8%, P10-P90 71.4%.
//
// ODDS (logistic on all 758; Brier, 10-fold + walk-forward):
//   base rate ............ 0.2484 / 0.2814
//   + years listed ....... 0.2311 / 0.2325  KEPT
//   + category share ..... 0.2113 / 0.2160  KEPT (shrunk k=10)
//   + size curve ......... 0.2100 / 0.2138  KEPT
//   + 7-day growth ....... 0.2079 / 0.2128  KEPT (helps odds, failed value)
//   + chain count ........ 0.2065 / 0.2125  KEPT
// Odds are the peers' record, not a forecast: token share by age band is 0-1y 32%, 1-2y 39%,
// 2-3y 55%, 3y+ 79% of dated protocols recording a token.
//
// IMPLIED = launch value x token odds. FARM VERDICT is scenario math (printed on the page):
// expected drop = implied x (plan / (TVL + plan)) x 5 early-activity factor; net subtracts
// gas/fees and a 5%/yr capital charge; $/hour divides by active hours. FARM >= $10/h net,
// MARGINAL > $0, SKIP otherwise, at the default $25,000 plan.

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
  value_const: number;
  value_slope: number;
  value_const_se: number;
  value_slope_se: number;
  resid_q10: number;
  resid_q25: number;
  resid_q75: number;
  resid_q90: number;
  loo_miss: number;
  wf_miss: number;
  flat_loo_miss: number;
  flat_wf_miss: number;
  odds_const: number;
  odds_years: number;
  odds_catshare: number;
  odds_size: number;
  odds_chg: number;
  odds_chains: number;
  odds_brier: number;
  odds_brier_base: number;
  peers: number;
  plan_default_usd: number;
}

export const MODEL: ModelConstants = {
  value_const: -0.576,
  value_slope: -0.6316,
  value_const_se: 0.176,
  value_slope_se: 0.09,
  resid_q10: -1.904,
  resid_q25: -1.033,
  resid_q75: 0.987,
  resid_q90: 1.9,
  loo_miss: 3.56,
  wf_miss: 4.51,
  flat_loo_miss: 4.657,
  flat_wf_miss: 5.818,
  odds_const: -3.688,
  odds_years: 0.3854,
  odds_catshare: 5.0448,
  odds_size: 0.0958,
  odds_chg: -1.5021,
  odds_chains: 0.0897,
  odds_brier: 0.2065,
  odds_brier_base: 0.2484,
  peers: 97,
  plan_default_usd: 25000,
};

/** Category offsets: tested on the 97-peer set, not kept (walk-forward worsens), so all zero. */
export const CATEGORY_OFFSETS: Record<string, number> = {};

/** Shrunk category token shares (k=10 toward the global 0.5488), fitted on all 758. */
export const CATEGORY_SHARES: Record<string, number> = {
  'AI Agents': 0.624, 'Algo-Stables': 0.624, 'Anchor BTC': 0.535, 'Basis Trading': 0.596, 'Bridge': 0.5,
  'CDP': 0.516, 'CDP Manager': 0.541, 'CEX': 0.295, 'Canonical Bridge': 0.535, 'CeDeFi': 0.499, 'Chain': 0.472,
  'Collateral Management': 0.59, 'Collateral Markets': 0.499, 'Cross Chain Bridge': 0.676, 'Crypto Card Issuer': 0.541,
  'DOR': 0.59, 'Decentralized AI': 0.59, 'Decentralized BTC': 0.499, 'Derivatives': 0.514, 'Dexs': 0.72,
  'Dual-Token Stablecoin': 0.535, 'Farm': 0.499, 'Governance Incentives': 0.541, 'Indexes': 0.656, 'Insurance': 0.541,
  'Interest Rate Derivatives': 0.499, 'Launchpad': 0.678, 'Lending': 0.759, 'Leveraged Farming': 0.593,
  'Liquid Restaking': 0.605, 'Liquid Staking': 0.517, 'Liquidity Manager': 0.583, 'NFT Marketplace': 0.59,
  'OTC Marketplace': 0.499, 'Onchain Capital Allocator': 0.371, 'Options': 0.653, 'Options Vault': 0.499,
  'Payments': 0.576, 'Prediction Market': 0.499, 'Privacy': 0.606, 'RWA': 0.523, 'Reserve Currency': 0.59,
  'Restaked BTC': 0.499, 'Restaking': 0.593, 'Risk Curators': 0.214, 'Stablecoin Issuer': 0.59,
  'Stablecoin Wrapper': 0.457, 'Staking Pool': 0.499, 'Synthetics': 0.653, 'Token Locker': 0.699,
  'Uncollateralized Lending': 0.499, 'Yield': 0.581, 'Yield Aggregator': 0.591,
};

export const MODEL_VERSION = 'radar-4-fitted';
export const EARLY_ROWS = 400;
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
  rank_lo: number;
  rank_hi: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  launch_value_usd: number;
  odds: number;
  implied_value_usd: number;
  p25_usd: number;
  p75_usd: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  net_per_hour: number;
  expected_drop_usd: number;
  gas_fees_usd: number;
  capital_charge_usd: number;
  net_usd: number;
  plan_usd: number;
  hold_days: number;
  active_hours: number;
  on_watchlist: boolean;
  farm_steps: string[];
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
  accounting: Record<string, number>;
  total_tvl_usd: number;
  total_implied_usd: number;
  farm_count: number;
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
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** If-it-launches value from the fitted size curve + category ridge. */
export function launchValue(p: SnapshotProtocol, model: ModelConstants): number {
  const lt = Math.log(Math.max(1, p.tvl_usd));
  const off = CATEGORY_OFFSETS[p.category ?? '(none)'] ?? 0;
  return Math.max(1, Math.round(p.tvl_usd * Math.exp(model.value_const + model.value_slope * (lt - 17) + off)));
}

/** Token odds from the fitted logistic (years, category share, size, growth, chains). */
export function tokenOdds(p: SnapshotProtocol, asOf: string, model: ModelConstants): number {
  const age = ageDays(asOf, p.listed_at);
  const years = age === null ? 1 : age / 365.25;
  const share = CATEGORY_SHARES[p.category ?? '(none)'] ?? 0.5488;
  const chg = Math.min(120, Math.max(-60, p.change_7d ?? 0)) / 100;
  const z = model.odds_const + model.odds_years * years + model.odds_catshare * share +
    model.odds_size * (Math.log(Math.max(1, p.tvl_usd)) - 17) + model.odds_chg * chg +
    model.odds_chains * Math.min(p.chains.length, 8);
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
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

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 35;
  if (age < 180) return 49;
  if (age < 365) return 42;
  return 35;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

function actionFor(p: SnapshotProtocol, plan: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const amt = `$${plan.toLocaleString('en-US')}`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply ${amt} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide ${amt} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge ${amt} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake ${amt} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit ${amt} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund ${amt} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit ${amt} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit ${amt} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint ${amt} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy ${amt} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit ${amt} of USDC into ${name} on ${chain} and keep the position open.`;
}

export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const plan = MODEL.plan_default_usd;
  const hold = holdDaysFor(age);
  return [
    { text: `Use a fresh wallet holding only the $${plan.toLocaleString('en-US')} plan funds; keep the seed phrase offline.`, cost: 'under $3 of gas', time: '5 minutes' },
    { text: actionFor(p, plan, chain), cost: 'about $8 of gas and fees', time: '15 minutes to set up' },
    { text: `Add a second qualifying action in week one, such as a borrow, swap, vote or second deposit.`, cost: 'about $4 of gas', time: '10 minutes' },
    { text: `Make one qualifying action each week so activity spans more than one snapshot.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    { text: `Hold the position for at least ${hold} days; do not chase points with extra capital beyond the plan.`, cost: 'capital stays in the position', time: `${hold} days` },
    { text: `Check the protocol's own points or rewards page weekly; claim only from links it publishes, never pay to claim.`, cost: 'no fee to check', time: '10 minutes a week' },
    { text: `Log the wallet, dates, costs and transactions; unwind after the claim window or if TVL falls by half.`, cost: 'about $5 of exit gas', time: '10 minutes' },
  ];
}

export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** Scenario budget at the default plan: expected drop, costs, net and net per active hour. */
export function farmBudget(p: SnapshotProtocol, implied: number, age: number | null) {
  const plan = MODEL.plan_default_usd;
  const hold = holdDaysFor(age);
  const weeks = Math.ceil(hold / 7);
  const activeHours = 0.25 + weeks * (10 / 60) + 10 / 60;
  const expectedDrop = implied * (plan / (p.tvl_usd + plan)) * 5;
  const gasFees = 3 + 8 + 4 + weeks * 2 + 5;
  const capitalCharge = plan * 0.05 * (hold / 365);
  const net = expectedDrop - gasFees - capitalCharge;
  const perHour = net / activeHours;
  const verdict: 'FARM' | 'MARGINAL' | 'SKIP' = perHour >= 10 ? 'FARM' : perHour > 0 ? 'MARGINAL' : 'SKIP';
  return { verdict, perHour: Math.round(perHour * 100) / 100, expectedDrop: Math.round(expectedDrop), gasFees, capitalCharge: Math.round(capitalCharge), net: Math.round(net), plan, hold, activeHours: Math.round(activeHours * 100) / 100 };
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
    const launch = launchValue(p, model);
    const odds = tokenOdds(p, snapshot.as_of, model);
    const implied = Math.max(1, Math.round(launch * odds));
    return { p, launch, odds, implied, age: ageDays(snapshot.as_of, p.listed_at) };
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
      base_multiple: round4(s.launch / Math.max(1, s.p.tvl_usd)),
      growth_pct: Math.min(120, Math.max(-60, s.p.change_7d ?? 0)),
      growth_multiplier: round4(s.odds),
      maturity_multiplier: 1,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, chains: p.chains, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd, change_7d: p.change_7d }));
}

const OUT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

export function accounting(snapshot: Snapshot, board: BoardRow[]): Record<string, number> {
  const watch = new Set(snapshot.watchlist);
  const onBoard = new Set(board.map((r) => r.slug));
  const groups: Record<string, number> = {
    'ranked watchlist': 0, 'ranked early below floor': 0, 'token trades, priced comp': 0,
    'token recorded, no usable cap': 0, 'out: bridge/exchange/staking product': 0, 'out: versioned pool': 0, 'out: other pre-token': 0,
  };
  for (const p of snapshot.protocols) {
    if (watch.has(p.slug)) groups['ranked watchlist']! += 1;
    else if (onBoard.has(p.slug)) groups['ranked early below floor']! += 1;
    else if (hasToken(p) && (p.mcap_usd ?? 0) > 0) groups['token trades, priced comp']! += 1;
    else if (hasToken(p)) groups['token recorded, no usable cap']! += 1;
    else if (p.category !== null && OUT_CATEGORIES.has(p.category)) groups['out: bridge/exchange/staking product']! += 1;
    else if (VERSIONED.test(p.name)) groups['out: versioned pool']! += 1;
    else groups['out: other pre-token']! += 1;
  }
  return groups;
}

export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const watch = new Set(snapshot.watchlist);
  const index = bySlug(snapshot.protocols);
  const byP25 = [...board].sort((a, b) => (b.implied_value_usd * Math.exp(model.resid_q25)) - (a.implied_value_usd * Math.exp(model.resid_q25)));
  const rankAt = (list: BoardRow[], slug: string) => list.findIndex((r) => r.slug === slug) + 1;
  const rows: RadarRow[] = board.map((row) => {
    const p = index.get(row.slug)!;
    const launch = launchValue(p, model);
    const odds = tokenOdds(p, snapshot.as_of, model);
    const budget = farmBudget(p, row.implied_value_usd, row.age_days);
    return {
      rank: row.rank,
      rank_lo: Math.min(row.rank, rankAt(byP25, row.slug)),
      rank_hi: Math.max(row.rank, rankAt(byP25, row.slug)),
      slug: row.slug,
      name: row.name,
      category: row.category,
      chains: row.chains,
      tvl_usd: row.tvl_usd,
      change_7d: row.change_7d,
      listed_at: row.listed_at,
      age_days: row.age_days,
      launch_value_usd: launch,
      odds: round4(odds),
      implied_value_usd: row.implied_value_usd,
      p25_usd: Math.max(1, Math.round(launch * Math.exp(model.resid_q25))),
      p75_usd: Math.max(1, Math.round(launch * Math.exp(model.resid_q75))),
      verdict: budget.verdict,
      net_per_hour: budget.perHour,
      expected_drop_usd: budget.expectedDrop,
      gas_fees_usd: budget.gasFees,
      capital_charge_usd: budget.capitalCharge,
      net_usd: budget.net,
      plan_usd: budget.plan,
      hold_days: budget.hold,
      active_hours: budget.activeHours,
      on_watchlist: watch.has(row.slug),
      farm_steps: row.farm_steps,
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
    accounting: accounting(snapshot, board),
    total_tvl_usd: board.reduce((s, r) => s + r.tvl_usd, 0),
    total_implied_usd: board.reduce((s, r) => s + r.implied_value_usd, 0),
    farm_count: rows.filter((r) => r.verdict === 'FARM').length,
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
