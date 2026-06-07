// ── Business-logic helpers shared across route modules ────────────────────────

/** 10 pt base + Math.round(baseValue * 4) scaled on top, minimum 10 */
function chorePointsPerDay(baseValue) {
  return Math.max(10, 10 + Math.round(baseValue * 4));
}

/** Dollar credit per optional-chore completion: baseValue / 5 */
function optionalDollarPerCompletion(baseValue) {
  return Math.round((baseValue / 5) * 100) / 100;
}

/** ISO date string of the Monday that starts the current (or given) week */
function getWeekOf(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// Ledger entry reasons that come from chore toggle events.
// These are excluded from the point-balance sum because
// completedDays / dailyChoreSelections are the authoritative source.
const CHORE_ENTRY_PREFIXES = [
  'Completed:',
  'Unchecked:',
  '7-day streak bonus:',
  'Streak bonus reversed:',
  'Optional:',
  'Undo optional:',
];

function isChoreEntry(reason) {
  return CHORE_ENTRY_PREFIXES.some(p => reason.startsWith(p));
}

module.exports = {
  chorePointsPerDay,
  optionalDollarPerCompletion,
  getWeekOf,
  CHORE_ENTRY_PREFIXES,
  isChoreEntry,
};
