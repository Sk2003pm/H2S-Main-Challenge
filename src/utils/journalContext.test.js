import { describe, it, expect } from 'vitest';
import { buildJournalContext, formatJournalDate, MAX_JOURNAL_REFERENCES, JOURNAL_EXCERPT_LENGTH } from './journalContext';

const makeLog = (id, day, extra = {}) => ({
  id,
  date: `2026-09-${String(day).padStart(2, '0')}T10:00:00.000Z`,
  text: `Entry ${id} text`,
  stress_input: 60,
  analysis: { mood_score: 40, triggers: ['Mock Test Performance'], analysis_summary: `Summary ${id}` },
  ...extra
});

describe('formatJournalDate', () => {
  it('formats ISO dates as day month year', () => {
    expect(formatJournalDate('2026-09-28T10:00:00.000Z')).toMatch(/^28 Sep\w* 2026$/);
  });

  it('handles missing or invalid dates', () => {
    expect(formatJournalDate(undefined)).toBe('Undated entry');
    expect(formatJournalDate('not a date')).toBe('Undated entry');
  });
});

describe('buildJournalContext', () => {
  it('returns an empty list for missing logs', () => {
    expect(buildJournalContext(undefined)).toEqual([]);
    expect(buildJournalContext([])).toEqual([]);
  });

  it('maps logs to references with mood, triggers and summary', () => {
    const [ref] = buildJournalContext([makeLog(1, 28)]);
    expect(ref).toMatchObject({
      text: 'Entry 1 text',
      mood_score: 40,
      triggers: ['Mock Test Performance'],
      summary: 'Summary 1',
      focused: false
    });
    expect(ref.date).toMatch(/^28 Sep\w* 2026$/);
  });

  it('keeps only the newest entries', () => {
    const logs = Array.from({ length: 10 }, (_, i) => makeLog(i + 1, 20 - i));
    const refs = buildJournalContext(logs);
    expect(refs).toHaveLength(MAX_JOURNAL_REFERENCES);
    expect(refs[0].text).toBe('Entry 1 text');
  });

  it('puts the focused entry first and flags it, even if it is older', () => {
    const logs = Array.from({ length: 10 }, (_, i) => makeLog(i + 1, 20 - i));
    const refs = buildJournalContext(logs, 9);
    expect(refs[0]).toMatchObject({ text: 'Entry 9 text', focused: true });
    expect(refs.filter(r => r.focused)).toHaveLength(1);
    expect(refs).toHaveLength(MAX_JOURNAL_REFERENCES + 1);
  });

  it('trims long text and tolerates logs without analysis', () => {
    const long = makeLog(1, 28, { text: `  ${'word '.repeat(400)}  `, analysis: undefined });
    const [ref] = buildJournalContext([long]);
    expect(ref.text.length).toBe(JOURNAL_EXCERPT_LENGTH);
    expect(ref).toMatchObject({ mood_score: null, triggers: [], summary: null });
  });
});
