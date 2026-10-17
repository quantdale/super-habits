import { describe, expect, it } from 'vitest';
import { createSnapshotSequencer } from '@/lib/snapshotSequencer';

describe('createSnapshotSequencer', () => {
  it('applies a lone snapshot', () => {
    const sequencer = createSnapshotSequencer();
    const seq = sequencer.begin();
    expect(sequencer.claim(seq)).toBe(true);
  });

  it('drops an older snapshot that resolves after a newer one', () => {
    const sequencer = createSnapshotSequencer();
    const slow = sequencer.begin();
    const fast = sequencer.begin();
    expect(sequencer.claim(fast)).toBe(true);
    expect(sequencer.claim(slow)).toBe(false);
  });

  it('applies snapshots in issue order when they resolve in order', () => {
    const sequencer = createSnapshotSequencer();
    const first = sequencer.begin();
    const second = sequencer.begin();
    expect(sequencer.claim(first)).toBe(true);
    expect(sequencer.claim(second)).toBe(true);
  });

  it('never re-applies an already applied sequence number', () => {
    const sequencer = createSnapshotSequencer();
    const seq = sequencer.begin();
    expect(sequencer.claim(seq)).toBe(true);
    expect(sequencer.claim(seq)).toBe(false);
  });

  it('drops a stale sequence after an interleaved newer apply', () => {
    const sequencer = createSnapshotSequencer();
    const one = sequencer.begin();
    const two = sequencer.begin();
    const three = sequencer.begin();
    expect(sequencer.claim(two)).toBe(true);
    expect(sequencer.claim(three)).toBe(true);
    expect(sequencer.claim(one)).toBe(false);
  });

  it('rejects non-positive or non-integer sequence numbers', () => {
    const sequencer = createSnapshotSequencer();
    expect(sequencer.claim(0)).toBe(false);
    expect(sequencer.claim(-1)).toBe(false);
    expect(sequencer.claim(1.5)).toBe(false);
    expect(sequencer.claim(Number.NaN)).toBe(false);
  });
});
