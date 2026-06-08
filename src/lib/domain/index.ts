/**
 * Barrel for the pure domain layer.
 *
 * Re-exports the shared domain entity types and the `Result`/error types so
 * other layers can import from `@/lib/domain` without reaching into individual
 * modules.
 */

export * from './types';
export * from './result';
