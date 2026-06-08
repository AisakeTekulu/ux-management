/**
 * Shared Vitest setup for the Client Sign-Off Dashboard test suite.
 *
 * This file is referenced by `vitest.config.ts` (`setupFiles`) and runs once
 * before each test file. It is intentionally light: domain property/unit tests
 * run fully in-memory with no Supabase dependency, so there are no network or
 * database lifecycle hooks here.
 *
 * Concrete repository interfaces are introduced in a later task; the helpers in
 * `./fakes` provide a generic, reusable foundation that those repositories can
 * build on. Add cross-cutting setup (e.g. deterministic clocks, global cleanup)
 * here as the domain layer grows.
 */
export {};
