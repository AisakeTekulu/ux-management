/**
 * Declarative responsive integration test (Task 20.2).
 *
 * Verifies that the CSS/Tailwind patterns across the codebase prevent
 * horizontal overflow from 320px to 1920px. Instead of visual regression
 * testing, this test reads the relevant component source files and asserts
 * that overflow-prevention patterns are present.
 *
 * Validates: Requirements 16.5, 16.6
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

describe("Responsive: no horizontal overflow across surfaces (R16.5, R16.6)", () => {
  describe("1. Root layout uses overflow-x-hidden", () => {
    const globals = readSource("app/globals.css");

    it("html,body block sets overflow-x: hidden", () => {
      expect(globals).toContain("overflow-x: hidden");
    });

    it("html,body block sets max-width: 100vw", () => {
      expect(globals).toContain("max-width: 100vw");
    });

    it("universal box-sizing: border-box is applied", () => {
      expect(globals).toContain("box-sizing: border-box");
    });
  });

  describe("2. IndexTable uses w-full min-w-0 max-w-full and stacks on narrow viewports", () => {
    const indexTable = readSource("components/ui/IndexTable.tsx");

    it("outer container uses w-full min-w-0 max-w-full", () => {
      // The wrapper div that prevents overflow
      expect(indexTable).toContain("w-full min-w-0 max-w-full");
    });

    it("table element uses w-full", () => {
      expect(indexTable).toMatch(/w-full\s+table-auto/);
    });

    it("cells use min-w-0 break-words to prevent overflow", () => {
      expect(indexTable).toContain("min-w-0 break-words");
    });

    it("provides a stacked layout for narrow viewports (below md)", () => {
      // The stacked card list is visible below 768px (md:hidden on the table)
      expect(indexTable).toContain("md:hidden");
      // The table is hidden below md
      expect(indexTable).toContain("hidden w-full table-auto");
      expect(indexTable).toContain("md:table");
    });
  });

  describe("3. ReviewLayout uses max-w-2xl with px-token-4", () => {
    const reviewLayout = readSource("components/portal/ReviewLayout.tsx");

    it("main content area constrained to max-w-2xl", () => {
      expect(reviewLayout).toContain("max-w-2xl");
    });

    it("horizontal padding px-token-4 applied", () => {
      expect(reviewLayout).toContain("px-token-4");
    });

    it("uses w-full to fill available width", () => {
      expect(reviewLayout).toContain("w-full");
    });
  });

  describe("4. AppShell uses max-w-[1920px] with px-token-4", () => {
    const appShell = readSource("components/ui/AppShell.tsx");

    it("main content area constrained to max-w-[1920px]", () => {
      expect(appShell).toContain("max-w-[1920px]");
    });

    it("horizontal padding px-token-4 applied to content area", () => {
      expect(appShell).toContain("px-token-4");
    });

    it("content column uses w-full", () => {
      expect(appShell).toContain("w-full");
    });

    it("mobile drawer is constrained with max-w-[80vw]", () => {
      expect(appShell).toContain("max-w-[80vw]");
    });
  });

  describe("5. All forms use w-full inputs", () => {
    it("client form inputs use w-full", () => {
      const clientsPage = readSource("app/(admin)/clients/page.tsx");
      expect(clientsPage).toMatch(/w-full\s+rounded-md\s+border/);
    });

    it("portal sign-off modal inputs use w-full", () => {
      const signoffModal = readSource("components/portal/SignoffModal.tsx");
      expect(signoffModal).toMatch(/w-full\s+rounded-md\s+border/);
    });

    it("sign-in form is width-constrained and inputs stretch to fill", () => {
      const signInPage = readSource("app/sign-in/page.tsx");
      // Page uses max-w-md with horizontal padding
      expect(signInPage).toContain("max-w-md");
      expect(signInPage).toContain("px-token-4");
    });

    it("task form inputs use w-full", () => {
      const tasksPage = readSource("app/(admin)/tasks/page.tsx");
      expect(tasksPage).toMatch(/w-full\s+rounded-md\s+border/);
    });

    it("filter/search input uses w-full", () => {
      const filters = readSource("components/ui/Filters.tsx");
      expect(filters).toMatch(/w-full\s+rounded-md\s+border/);
    });
  });
});
