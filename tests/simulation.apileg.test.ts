/**
 * Unit tests for the apiLeg guard (`add-user-simulation-platform` task 3.2):
 * a raw `SELECT`/`INSERT` string input is an error; only registered
 * data-layer function names are accepted. Pure — no browser.
 */

import { describe, expect, it } from 'vitest';
import { API_LEG_FUNCTIONS, assertApiLegSafe, isRawSqlString } from '../simulation/runner/apiLeg';

describe('isRawSqlString', () => {
  it('flags SELECT/INSERT/UPDATE/DELETE prefixes', () => {
    expect(isRawSqlString('SELECT * FROM todos')).toBe(true);
    expect(isRawSqlString('INSERT INTO todos (id) VALUES (1)')).toBe(true);
    expect(isRawSqlString('UPDATE todos SET completed = 1')).toBe(true);
    expect(isRawSqlString('DELETE FROM todos')).toBe(true);
  });

  it('flags semicolons as a SQL smell', () => {
    expect(isRawSqlString('1; DROP TABLE todos')).toBe(true);
  });

  it('does not flag plain values', () => {
    expect(isRawSqlString('Pay rent')).toBe(false);
    expect(isRawSqlString('breakfast')).toBe(false);
    expect(isRawSqlString('')).toBe(false);
  });
});

describe('assertApiLegSafe', () => {
  it('accepts a registered function name with plain args', () => {
    expect(() =>
      assertApiLegSafe({ functionName: 'createHabit', args: { name: 'Drink water' } }),
    ).not.toThrow();
  });

  it('rejects a raw SQL string as functionName', () => {
    expect(() => assertApiLegSafe({ functionName: 'INSERT INTO todos (id) VALUES (1)' })).toThrow(
      /rejects raw SQL/,
    );
  });

  it('rejects a raw SQL string inside args', () => {
    expect(() =>
      assertApiLegSafe({
        functionName: 'createTodo',
        args: { title: 'SELECT 1; DROP TABLE todos' },
      }),
    ).toThrow(/args\.title rejects raw SQL/);
  });

  it('rejects unknown function names', () => {
    expect(() => assertApiLegSafe({ functionName: 'nope' })).toThrow(
      /not a registered data-layer function/,
    );
  });

  it('rejects empty function names', () => {
    expect(() => assertApiLegSafe({ functionName: '' })).toThrow(/non-empty functionName/);
  });

  it('registers the expected data-layer functions', () => {
    expect(Object.keys(API_LEG_FUNCTIONS)).toEqual(
      expect.arrayContaining([
        'createTodo',
        'createHabit',
        'tickHabit',
        'logCalories',
        'createWorkoutRoutine',
      ]),
    );
  });
});
