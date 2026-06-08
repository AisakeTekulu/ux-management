import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { InMemoryStore, createIdFactory } from "@/test";

/**
 * Sanity tests confirming the testing infrastructure is wired correctly:
 * Vitest runs, the `@/*` alias resolves, fast-check is available, and the
 * in-memory repository fake foundation behaves. These are not domain tests.
 */
describe("testing infrastructure", () => {
  it("runs Vitest", () => {
    expect(1 + 1).toBe(2);
  });

  it("runs fast-check property checks", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a;
      }),
      { numRuns: 100 },
    );
  });

  describe("InMemoryStore", () => {
    interface Widget {
      id: string;
      label: string;
    }

    it("inserts and retrieves records by id", () => {
      const store = new InMemoryStore<Widget>();
      store.insert({ id: "w1", label: "alpha" });

      expect(store.size).toBe(1);
      expect(store.get("w1")).toEqual({ id: "w1", label: "alpha" });
      expect(store.has("w1")).toBe(true);
    });

    it("isolates stored records from caller mutation", () => {
      const store = new InMemoryStore<Widget>();
      const input: Widget = { id: "w1", label: "alpha" };
      store.insert(input);

      input.label = "mutated";

      expect(store.get("w1")?.label).toBe("alpha");
    });

    it("updates only the patched fields", () => {
      const store = new InMemoryStore<Widget>();
      store.insert({ id: "w1", label: "alpha" });

      const updated = store.update("w1", { label: "beta" });

      expect(updated).toEqual({ id: "w1", label: "beta" });
    });

    it("deletes records and reports prior existence", () => {
      const store = new InMemoryStore<Widget>([{ id: "w1", label: "alpha" }]);

      expect(store.delete("w1")).toBe(true);
      expect(store.delete("w1")).toBe(false);
      expect(store.size).toBe(0);
    });
  });

  it("generates deterministic, distinct ids", () => {
    const nextId = createIdFactory("widget");
    const ids = [nextId(), nextId(), nextId()];

    expect(ids).toEqual(["widget_1", "widget_2", "widget_3"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
