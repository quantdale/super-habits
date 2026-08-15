import { describe, expect, it } from 'vitest';
import { canonicalizeRow, checksumRows, sha256Hex, utf8Bytes } from '@/lib/checksum';

describe('lib/checksum sha256', () => {
  it('matches the NIST vector for the empty string', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('matches the NIST vector for "abc"', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches the NIST vector for the 56-character "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"', () => {
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('hashes multi-byte UTF-8 deterministically', () => {
    expect(sha256Hex('héllo wörld — 水')).toBe(sha256Hex('héllo wörld — 水'));
    expect(utf8Bytes('水')).toEqual([0xe6, 0xb0, 0xb4]);
  });

  it('is sensitive to any byte change', () => {
    expect(sha256Hex('{"a":1}')).not.toBe(sha256Hex('{"a":2}'));
    expect(sha256Hex('{"a":1}')).not.toBe(sha256Hex('{"a": 1}'));
  });
});

describe('lib/checksum canonicalization', () => {
  const columns = ['id', 'name', 'deleted_at', 'count'];

  it('uses the declared column order and normalizes undefined to null', () => {
    const line = canonicalizeRow({ id: 'a', count: 2, name: 'x', deleted_at: null }, columns);
    expect(line).toBe('{"id":"a","name":"x","deleted_at":null,"count":2}');
    expect(canonicalizeRow({ id: 'a', name: 'x' }, columns)).toBe(
      '{"id":"a","name":"x","deleted_at":null,"count":null}',
    );
  });

  it('ignores extra keys not in the column list', () => {
    const line = canonicalizeRow({ id: 'a', name: 'x', user_id: 'u' }, columns);
    expect(line).not.toContain('user_id');
    expect(line).toBe('{"id":"a","name":"x","deleted_at":null,"count":null}');
  });

  it('hashes identically regardless of row insertion order', () => {
    const rowsA = [
      { id: 'b', name: 'second', deleted_at: null, count: 1 },
      { id: 'a', name: 'first', deleted_at: '2026-01-01T00:00:00.000Z', count: 0 },
    ];
    const rowsB = [rowsA[1], rowsA[0]];
    const a = checksumRows(rowsA, columns);
    const b = checksumRows(rowsB, columns);
    expect(a).toEqual(b);
    expect(a.count).toBe(2);
  });

  it('produces stable checksums across repeated runs', () => {
    const rows = [
      { id: 't1', name: 'todo', deleted_at: null, count: 0 },
      { id: 't2', name: 'done', deleted_at: '2026-08-01T00:00:00.000Z', count: 3 },
    ];
    const first = checksumRows(rows, columns);
    const second = checksumRows(rows, columns);
    expect(first.checksum).toBe(second.checksum);
    expect(first.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when a value changes or a row is removed', () => {
    const rows = [{ id: 't1', name: 'todo', deleted_at: null, count: 0 }];
    const base = checksumRows(rows, columns).checksum;
    expect(checksumRows([{ ...rows[0], count: 1 }], columns).checksum).not.toBe(base);
    expect(checksumRows([], columns).checksum).not.toBe(base);
    expect(checksumRows([], columns).count).toBe(0);
  });
});
