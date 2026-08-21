import { describe, expect, it } from 'vitest';
import {
  normalizeStoredHistory,
  pushCommandHistoryEntry,
  type CommandHistoryEntry,
} from '@/features/command/commandHistory';

describe('features/command/commandHistory (pure reducer)', () => {
  it('prepends a new entry', () => {
    const next = pushCommandHistoryEntry([], 'Add a todo to call mom', '2026-04-21T01:00:00Z');
    expect(next).toEqual([{ rawText: 'Add a todo to call mom', at: '2026-04-21T01:00:00Z' }]);
  });

  it('moves a matching entry to the front instead of duplicating it', () => {
    const entries: CommandHistoryEntry[] = [
      { rawText: 'create project Apollo', at: '2026-04-20T01:00:00Z' },
      { rawText: 'add a todo to stretch', at: '2026-04-19T01:00:00Z' },
    ];
    const next = pushCommandHistoryEntry(entries, 'add a todo to stretch', '2026-04-21T02:00:00Z');
    expect(next).toHaveLength(2);
    expect(next[0].rawText).toBe('add a todo to stretch');
    expect(next[0].at).toBe('2026-04-21T02:00:00Z');
  });

  it('normalizes whitespace and is case-insensitive on dedupe', () => {
    const entries: CommandHistoryEntry[] = [{ rawText: 'SET GOAL read to 50%', at: 'a' }];
    const next = pushCommandHistoryEntry(entries, 'set  goal  Read to 50%', 'b');
    expect(next).toHaveLength(1);
    expect(next[0].rawText).toBe('set goal Read to 50%');
  });

  it('caps the list at the requested size', () => {
    let entries: CommandHistoryEntry[] = [];
    for (let i = 0; i < 12; i += 1) {
      entries = pushCommandHistoryEntry(entries, `command ${i}`, `t${i}`, 8);
    }
    expect(entries).toHaveLength(8);
    expect(entries[0].rawText).toBe('command 11');
  });

  it('ignores blank input', () => {
    expect(pushCommandHistoryEntry([], '   ', 't')).toEqual([]);
  });

  it('drops malformed stored payloads', () => {
    expect(normalizeStoredHistory(null)).toEqual([]);
    expect(normalizedOf([{ rawText: 'x' }, { rawText: 5, at: 'a' }, 'nope'])).toEqual([]);
    expect(
      normalizedOf([{ rawText: 'keep me', at: '2026-04-21T00:00:00Z' }, { rawText: 'drop me' }]),
    ).toEqual([{ rawText: 'keep me', at: '2026-04-21T00:00:00Z' }]);
  });
});

function normalizedOf(value: unknown): CommandHistoryEntry[] {
  return normalizeStoredHistory(value);
}
