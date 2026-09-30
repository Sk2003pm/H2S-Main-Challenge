// Journal entries shared with Aura as chat context, so her replies can reference what the student wrote.

// Newest entries sent with each chat message (plus a focused entry, if the student picked one)
export const MAX_JOURNAL_REFERENCES = 6;
// Characters of each entry's text sent to the backend
export const JOURNAL_EXCERPT_LENGTH = 600;

/**
 * Formats a journal date the same way in the panel and in the prompt (e.g. "28 Sep 2026").
 * @param {string} isoDate - ISO timestamp stored on the journal log.
 * @returns {string}
 */
export function formatJournalDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Undated entry';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Builds the `journal_context` sent to /api/chat-companion from the stored journal logs (newest first).
 * The focused entry (the one the student chose to discuss) comes first and is flagged.
 * @param {Array<object>} logs - Journal logs from storage.getJournalLogs().
 * @param {number|string|null} [focusedId=null] - Id of the entry being discussed.
 * @returns {Array<{date: string, text: string, mood_score: (number|null), triggers: string[], summary: (string|null), focused: boolean}>}
 */
export function buildJournalContext(logs, focusedId = null) {
  if (!Array.isArray(logs)) return [];
  const isFocused = (log) => focusedId !== null && focusedId !== undefined && log.id === focusedId;
  const toReference = (log) => ({
    date: formatJournalDate(log.date),
    text: String(log.text || '').replace(/\s+/g, ' ').trim().slice(0, JOURNAL_EXCERPT_LENGTH),
    mood_score: Number.isFinite(log.analysis?.mood_score) ? log.analysis.mood_score : null,
    triggers: Array.isArray(log.analysis?.triggers) ? log.analysis.triggers.slice(0, 5).map(String) : [],
    summary: typeof log.analysis?.analysis_summary === 'string' ? log.analysis.analysis_summary.slice(0, 300) : null,
    focused: isFocused(log)
  });
  const focused = logs.filter(isFocused).slice(0, 1);
  const recent = logs.filter(log => !isFocused(log)).slice(0, MAX_JOURNAL_REFERENCES);
  return [...focused, ...recent].map(toReference);
}
