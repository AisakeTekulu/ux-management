/**
 * Generic in-memory foundation for repository fakes used by domain and
 * application tests.
 *
 * The concrete, typed repository interfaces (clients, projects, phases, etc.)
 * are defined in a later task. This module provides only a lightweight, generic
 * building block — an id-keyed collection with the common operations every fake
 * repository needs — so those repositories can be assembled quickly and run
 * fully in-memory (no Supabase) for fast 100+ iteration property tests.
 */

/** Any record that carries a string `id` primary key. */
export interface Identified {
  id: string;
}

/**
 * Deterministic, monotonic id generator for tests.
 *
 * Deterministic ids keep property-test failures reproducible. Pass a custom
 * `prefix` to disambiguate entities (e.g. "client", "project").
 */
export function createIdFactory(prefix = "id"): () => string {
  let counter = 0;
  return () => `${prefix}_${++counter}`;
}

/**
 * A minimal id-keyed in-memory collection backing a repository fake.
 *
 * Records are cloned on the way in and out so callers cannot mutate stored
 * state by reference — mirroring the isolation a real persistence layer
 * provides and keeping the domain layer's "no mutation on rejection" guarantees
 * honest under test.
 */
export class InMemoryStore<T extends Identified> {
  private readonly records = new Map<string, T>();

  constructor(seed: readonly T[] = []) {
    for (const record of seed) {
      this.records.set(record.id, clone(record));
    }
  }

  /** Number of stored records. */
  get size(): number {
    return this.records.size;
  }

  /** Insert a record, throwing if the id already exists. */
  insert(record: T): T {
    if (this.records.has(record.id)) {
      throw new Error(`InMemoryStore: duplicate id "${record.id}"`);
    }
    this.records.set(record.id, clone(record));
    return clone(record);
  }

  /** Insert or replace a record by id. */
  upsert(record: T): T {
    this.records.set(record.id, clone(record));
    return clone(record);
  }

  /** Return a record by id, or undefined when absent. */
  get(id: string): T | undefined {
    const found = this.records.get(id);
    return found ? clone(found) : undefined;
  }

  /** Whether a record with the given id exists. */
  has(id: string): boolean {
    return this.records.has(id);
  }

  /** Return all records (insertion order), each cloned. */
  list(): T[] {
    return [...this.records.values()].map(clone);
  }

  /** Return all records matching a predicate, each cloned. */
  filter(predicate: (record: T) => boolean): T[] {
    return this.list().filter(predicate);
  }

  /**
   * Apply a partial patch to an existing record, returning the updated copy or
   * undefined when the id is absent. Only the patched fields change.
   */
  update(id: string, patch: Partial<T>): T | undefined {
    const existing = this.records.get(id);
    if (!existing) {
      return undefined;
    }
    const updated = { ...clone(existing), ...clone(patch), id } as T;
    this.records.set(id, updated);
    return clone(updated);
  }

  /** Remove a record by id, returning whether it existed. */
  delete(id: string): boolean {
    return this.records.delete(id);
  }

  /** Remove every record matching a predicate, returning the count removed. */
  deleteWhere(predicate: (record: T) => boolean): number {
    let removed = 0;
    for (const record of [...this.records.values()]) {
      if (predicate(record)) {
        this.records.delete(record.id);
        removed += 1;
      }
    }
    return removed;
  }

  /** Drop all records. */
  clear(): void {
    this.records.clear();
  }
}

/**
 * Structured-clone a value so stored records are isolated from caller
 * references. Falls back to a JSON round-trip on runtimes without
 * `structuredClone`.
 */
function clone<V>(value: V): V {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as V;
}
