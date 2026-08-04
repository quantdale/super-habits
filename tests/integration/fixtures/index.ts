/**
 * Fixture barrel (task 2.11).
 *
 * Importing this module registers the `lib/time` clock mock (via `seeders.ts`)
 * and exposes the SMALL / TYPICAL / HEAVY seeders plus the controllable
 * `clock`. See `seeders.ts` for the full contract — in particular: tests must
 * import this module before running a seeder, and each `seedX()` is
 * self-contained (own module reset, fresh database, shared clock).
 */
export { clock } from './clock';
export { seedHeavy, seedSmall, seedTypical } from './seeders';
