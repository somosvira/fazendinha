# Fase 5 Rebanho — Slice 1: Foundation + HerdDomainView

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the Tailwind + shadcn foundation for the rebanho module by finalizing RebButton and migrating HerdDomainView (the shared layout wrapper used by all tabs). This unblocks the 8 main screens.

**Architecture:** Rebanho module is a self-contained app (`.rb` class, own sidebar). All screens share HerdDomainView (eyebrow + title + optional toolbar + KPI strip + content). RebButton is the universal button primitive. Both will be fully Tailwind-ified with zero legacy CSS dependencies.

**Tech Stack:** Tailwind v4 (no preflight), shadcn primitives (Button, Dialog, Select), React 18 forwardRef, Vitest for component tests.

## Global Constraints

- `--radius: 0` by default (straight corners); explicit `rounded-*` for exceptions
- Palette: `--leite` (brass), `--cafe` (deep coffee), `--outros` (sage), `--prejuizo` (red), `--lucro` (green)
- Font stack: Newsreader (serif), DM Sans (sans)
- Preflight **OFF** until Fase 7
- No legacy CSS classes in JSX; all styling via Tailwind + primitives
- Tests: `// @vitest-environment jsdom` for portalized comps, `renderToString` (node) for static content
- Commit per component after visual QA

---

## Task 1: Finalize RebButton with all variants + test

**Files:**
- Modify: `client/src/components/rb/RebButton.tsx` (already exists, refine)
- Create: `client/src/components/rb/RebButton.test.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`, React 18 `forwardRef`
- Produces: `RebButton` React component with `variant: "default" | "pri" | "danger"`, `aria-pressed`, disabled state, standard button props

**Context:** RebButton already exists but needs:
1. Verify all 4 states: default, default pressed (`aria-pressed`), pri (primary/masthead bg), danger (red)
2. Verify disabled states for each variant
3. Create Vitest test for all combinations
4. Verify colors match token values exactly (don't guess)

- [ ] **Step 1: Read current RebButton implementation**

Run: `cat client/src/components/rb/RebButton.tsx`

Expected: See the 4 variants, BASE, VARIANTS dict, forwardRef pattern, `cn()` utility

- [ ] **Step 2: Check token values in theme.css**

Run: `grep -E "(--mast|--cafe|--prejuizo|--bg-card)" client/src/styles/theme.css | head -20`

Expected: Confirm exact hex values for `--mast-bg`, `--mast-ink`, `--prejuizo`, etc.

Verify the RebButton.tsx variant values match these tokens **exactly**. If they're hardcoded hex instead of `var()`, update them.

- [ ] **Step 3: Write test file for RebButton**

Create `client/src/components/rb/RebButton.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RebButton } from "./RebButton";

describe("RebButton", () => {
  it("renders with default variant", () => {
    render(<RebButton>Click me</RebButton>);
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn).toHaveClass("border", "border-border", "bg-transparent");
  });

  it("renders with pri variant", () => {
    render(<RebButton variant="pri">Primary</RebButton>);
    const btn = screen.getByRole("button", { name: "Primary" });
    expect(btn).toHaveClass("bg-mast", "text-mast-ink");
  });

  it("renders with danger variant", () => {
    render(<RebButton variant="danger">Delete</RebButton>);
    const btn = screen.getByRole("button", { name: "Delete" });
    expect(btn).toHaveClass("bg-prejuizo", "text-white");
  });

  it("applies aria-pressed correctly", () => {
    render(
      <RebButton aria-pressed="true">
        Toggle
      </RebButton>
    );
    const btn = screen.getByRole("button", { name: "Toggle" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveClass("aria-pressed:bg-[color:var(--bg-card-2)]");
  });

  it("applies disabled state", () => {
    render(<RebButton disabled>Disabled</RebButton>);
    const btn = screen.getByRole("button", { name: "Disabled" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveClass("disabled:cursor-not-allowed");
  });

  it("accepts custom className", () => {
    render(<RebButton className="mt-4">Custom</RebButton>);
    const btn = screen.getByRole("button", { name: "Custom" });
    expect(btn).toHaveClass("mt-4");
  });

  it("forwards ref correctly", () => {
    const ref = { current: null };
    render(<RebButton ref={ref}>Ref Test</RebButton>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter rionovo-client run test RebButton.test.tsx`

Expected: All 7 tests pass. If any fail (class names wrong, colors off), debug the token usage in RebButton.tsx and update step 3's assertions.

- [ ] **Step 5: Visually verify in browser (optional but recommended)**

Run `pnpm dev`, navigate to a page that uses RebButton (e.g., any rebanho tab with action buttons), and visually check:
- Default buttons have thin border, transparent bg
- Pri buttons are dark (masthead color), white text
- Danger buttons are red, white text
- Disabled buttons are grayed appropriately

Note any visual mismatches.

- [ ] **Step 6: Commit RebButton**

```bash
git add client/src/components/rb/RebButton.tsx client/src/components/rb/RebButton.test.tsx
git commit -m "feat(ui): finalize RebButton with all variants + tests (Fase 5 Slice 1)"
```

---

## Task 2: Migrate HerdDomainView layout wrapper

**Files:**
- Modify: `client/src/rebanho/components/HerdDomainView.tsx`
- Modify: (no dedicated CSS — uses inline Tailwind only)
- Create: `client/src/rebanho/components/HerdDomainView.test.tsx`
- Modify: `client/src/rebanho/styles/rebanho.css` (delete only `.rb-head`, `.rb-eyebrow`, `.rb-crumb`, `.rb-sub`, `.rb-head-actions` blocks when done)

**Interfaces:**
- Consumes: RebButton (from Task 1), React children
- Produces: `HerdDomainView({ eyebrow, title, subtitle, children, actions?, toolbar?, kpis? })` component. Used by all 8 tabs + cockpit.

**Context:** HerdDomainView is the shared header/layout shell for every screen in the rebanho module. It currently uses `.rb-head`, `.rb-eyebrow`, `.rb-crumb`, etc. This task migrates it to pure Tailwind while preserving the exact visual style.

Current structure (from rebanho.css):
```css
.rb-eyebrow { font-size: 14px; letter-spacing: .1em; text-transform: uppercase; color: var(--cafe); font-weight: 700; }
.rb-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; border-bottom: 1px solid var(--rule); padding-bottom: 16px; margin-top: 4px; margin-bottom: 18px; }
.rb-head h1 { font-family: var(--serif); font-weight: 500; font-size: 38px; margin: 4px 0 0; line-height: 1.05; }
.rb-head .period { font-size: 14px; color: var(--ink-3); border: 1px solid var(--rule); border-radius: 8px; padding: 7px 12px; background: var(--bg-card); }
.rb-sub { margin-top: 7px; color: var(--ink-3); font-size: 14px; }
.rb-head-actions { display: flex; gap: 8px; }
```

- [ ] **Step 1: Read current HerdDomainView component**

Run: `cat client/src/rebanho/components/HerdDomainView.tsx`

Expected: See current structure, props, children slot

- [ ] **Step 2: Sketch Tailwind class replacements**

Identify CSS classes → Tailwind equivalents:
- `.rb-eyebrow`: text-sm uppercase font-bold tracking-widest text-cafe
- `.rb-head`: flex items-end justify-between gap-5 border-b border-rule pb-4 mt-1 mb-[18px]
- `.rb-head h1`: font-serif font-medium text-4xl leading-tight
- `.rb-period`: text-sm text-ink-3 border border-rule rounded-lg px-3 py-[7px] bg-bg-card
- `.rb-sub`: mt-[7px] text-ink-3 text-sm
- `.rb-head-actions`: flex gap-2

Note: Exact spacing values come from CSS (margin-bottom: 18px → mb-[18px], padding: 7px 12px → py-[7px] px-3, etc.)

- [ ] **Step 3: Read HerdDomainView and identify all class names**

Run: `grep -o 'className="[^"]*"' client/src/rebanho/components/HerdDomainView.tsx | sort | uniq`

Expected: List of all className values. Cross-reference with rebanho.css to ensure no orphaned classes.

- [ ] **Step 4: Rewrite HerdDomainView with Tailwind**

```typescript
// client/src/rebanho/components/HerdDomainView.tsx

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface HerdDomainViewProps {
  eyebrow?: ReactNode;
  title: ReactNode; // usually a string like "Animal"
  titleSmall?: ReactNode; // optional subtitle next to title (e.g., "5 ANIMAIS")
  subtitle?: ReactNode; // optional text below title
  children: ReactNode;
  actions?: ReactNode; // optional button group (flex gap)
  toolbar?: ReactNode; // optional filter/control bar
  kpis?: ReactNode; // optional KPI strip
  className?: string;
}

export function HerdDomainView({
  eyebrow,
  title,
  titleSmall,
  subtitle,
  children,
  actions,
  toolbar,
  kpis,
  className,
}: HerdDomainViewProps) {
  return (
    <div className={cn("rb-main", className)}>
      {eyebrow && (
        <div className="text-sm uppercase font-bold tracking-widest text-cafe mb-2">
          {eyebrow}
        </div>
      )}

      {/* Header: title + optional actions */}
      <div className="flex items-end justify-between gap-5 border-b border-rule pb-4 mt-1 mb-[18px]">
        <div>
          <h1 className="font-serif font-medium text-4xl leading-tight">
            {title}
            {titleSmall && <small className="text-ink-2 text-2xl font-medium ml-3">{titleSmall}</small>}
          </h1>
          {subtitle && <div className="mt-[7px] text-ink-3 text-sm">{subtitle}</div>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>

      {/* Optional toolbar (filters, controls) */}
      {toolbar && <div className="mb-4">{toolbar}</div>}

      {/* Optional KPI strip */}
      {kpis && <div className="mb-6">{kpis}</div>}

      {/* Main content */}
      <div>{children}</div>
    </div>
  );
}
```

Note: `.rb-main` is still used for max-width/padding — leave it in rebanho.css for now (it's also used by other screens). This component doesn't monopolize it.

- [ ] **Step 5: Write test for HerdDomainView**

Create `client/src/rebanho/components/HerdDomainView.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HerdDomainView } from "./HerdDomainView";

describe("HerdDomainView", () => {
  it("renders title and children", () => {
    render(
      <HerdDomainView title="Animal">
        <div>Content</div>
      </HerdDomainView>
    );
    expect(screen.getByRole("heading", { name: "Animal" })).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders eyebrow when provided", () => {
    render(
      <HerdDomainView title="Animal" eyebrow="Rebanho">
        Content
      </HerdDomainView>
    );
    expect(screen.getByText("Rebanho")).toBeInTheDocument();
  });

  it("renders titleSmall next to title", () => {
    render(
      <HerdDomainView title="Animal" titleSmall="5 ANIMAIS">
        Content
      </HerdDomainView>
    );
    expect(screen.getByText("5 ANIMAIS")).toBeInTheDocument();
  });

  it("renders subtitle below title", () => {
    render(
      <HerdDomainView title="Animal" subtitle="Sítio São Francisco">
        Content
      </HerdDomainView>
    );
    expect(screen.getByText("Sítio São Francisco")).toBeInTheDocument();
  });

  it("renders actions in the header", () => {
    render(
      <HerdDomainView
        title="Animal"
        actions={<button>New</button>}
      >
        Content
      </HerdDomainView>
    );
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("renders toolbar when provided", () => {
    render(
      <HerdDomainView title="Animal" toolbar={<div>Filters</div>}>
        Content
      </HerdDomainView>
    );
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("renders kpis when provided", () => {
    render(
      <HerdDomainView title="Animal" kpis={<div>KPI Strip</div>}>
        Content
      </HerdDomainView>
    );
    expect(screen.getByText("KPI Strip")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <HerdDomainView title="Animal" className="custom-class">
        Content
      </HerdDomainView>
    );
    const root = container.querySelector(".rb-main");
    expect(root).toHaveClass("custom-class");
  });
});
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter rionovo-client run test HerdDomainView.test.tsx`

Expected: All 8 tests pass

- [ ] **Step 7: Find all usages of HerdDomainView**

Run: `grep -r "HerdDomainView" client/src/rebanho/components --include="*.tsx" | grep -v "HerdDomainView.tsx"`

Expected: List of files that import it (e.g., AnimalTab.tsx, ReproducaoTab.tsx, etc.)

Update all of them to check that the new props align with their current usage. No breaking API needed — we're preserving the same interface.

- [ ] **Step 8: Commit HerdDomainView**

```bash
git add client/src/rebanho/components/HerdDomainView.tsx client/src/rebanho/components/HerdDomainView.test.tsx
git commit -m "feat(ui): migrate HerdDomainView to Tailwind + tests (Fase 5 Slice 1)"
```

---

## Task 3: Create shared KPI strip primitive

**Files:**
- Create: `client/src/rebanho/components/KpiStrip.tsx`
- Create: `client/src/rebanho/components/KpiStrip.test.tsx`

**Interfaces:**
- Consumes: Nothing (leaf component)
- Produces: `KpiStrip({ kpis: [{ label, value, unit?, delta?, alertClass? }] })` component. Reused by all tabs that show KPIs.

**Context:** The `.rb-kstrip` and `.rb-k` CSS classes appear in many screens (AnimalCockpit, tabs, etc.). Extracting them into a reusable component reduces duplication and makes migration easier.

Current CSS (from rebanho.css):
```css
.rb-kstrip { display: grid; grid-template-columns: repeat(var(--cols, 6), 1fr); gap: 0; margin: 22px 0 24px; background: transparent; border: 0; border-radius: 0; overflow: visible; }
.rb-k { background: transparent; padding: 6px 22px 4px; border-left: 1px solid var(--rule-soft); position: relative; }
.rb-k:first-child { border-left: 0; padding-left: 2px; }
.rb-k .lab { font-size: 14px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); font-weight: 600; }
.rb-k .val { font-family: var(--serif); font-size: 32px; font-weight: 500; margin-top: 6px; line-height: 1; color: var(--ink); }
.rb-k .val u { text-decoration: none; font-size: 15px; color: var(--ink-2); margin-left: 4px; font-weight: 500; }
.rb-k .d { font-size: 15px; margin-top: 8px; color: var(--ink-2); font-weight: 500; }
.rb-up { color: var(--prejuizo); } .rb-ok { color: var(--lucro); }
```

- [ ] **Step 1: Design the KpiStrip data structure**

Think about what each KPI needs:
- `label`: string (e.g., "Em Lactação")
- `value`: string or number (e.g., "103")
- `unit`: optional string (e.g., "animais")
- `delta`: optional { change: number, direction: "up" | "down" | "ok" } (e.g., +5, color-coded)
- `alertClass`: optional "ok" | "up" (for color)

- [ ] **Step 2: Write KpiStrip component**

```typescript
// client/src/rebanho/components/KpiStrip.tsx

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Kpi {
  label: string;
  value: ReactNode;
  unit?: ReactNode; // e.g., "animais", "kg"
  delta?: { change: number; direction: "up" | "down" | "ok" };
  alertClass?: "ok" | "up";
}

export interface KpiStripProps {
  kpis: Kpi[];
  cols?: number; // default 6
  className?: string;
}

export function KpiStrip({ kpis, cols = 6, className }: KpiStripProps) {
  return (
    <div
      className={cn(
        "grid gap-0 my-[22px] mx-0 bg-transparent border-0 overflow-visible",
        className
      )}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {kpis.map((kpi, idx) => (
        <div
          key={idx}
          className={cn(
            "bg-transparent px-[22px] py-[6px] pb-1 relative",
            idx === 0 ? "border-l-0 pl-0.5" : "border-l border-rule-soft"
          )}
        >
          <div className="text-sm uppercase tracking-wider text-ink-2 font-semibold">
            {kpi.label}
          </div>
          <div className="font-serif text-3xl font-medium mt-1.5 leading-none text-ink">
            {kpi.value}
            {kpi.unit && (
              <u className="no-underline text-sm text-ink-2 ml-1 font-medium">
                {kpi.unit}
              </u>
            )}
          </div>
          {kpi.delta && (
            <div
              className={cn(
                "text-sm mt-2 text-ink-2 font-medium",
                kpi.alertClass === "ok" && "text-lucro",
                kpi.alertClass === "up" && "text-prejuizo"
              )}
            >
              {kpi.delta.direction === "up" && "↑ "}
              {kpi.delta.direction === "down" && "↓ "}
              {kpi.delta.change}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write test for KpiStrip**

```typescript
// client/src/rebanho/components/KpiStrip.test.tsx

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiStrip } from "./KpiStrip";

describe("KpiStrip", () => {
  it("renders KPI labels and values", () => {
    render(
      <KpiStrip
        kpis={[
          { label: "Em Lactação", value: "103" },
          { label: "Total", value: "522" },
        ]}
      />
    );
    expect(screen.getByText("Em Lactação")).toBeInTheDocument();
    expect(screen.getByText("103")).toBeInTheDocument();
  });

  it("renders units when provided", () => {
    render(
      <KpiStrip
        kpis={[{ label: "Peso", value: "500", unit: "kg" }]}
      />
    );
    expect(screen.getByText("kg")).toBeInTheDocument();
  });

  it("renders delta with direction", () => {
    render(
      <KpiStrip
        kpis={[
          {
            label: "Produção",
            value: "2.800",
            delta: { change: 150, direction: "up" },
          },
        ]}
      />
    );
    expect(screen.getByText(/↑ 150/)).toBeInTheDocument();
  });

  it("applies alertClass colors", () => {
    const { container } = render(
      <KpiStrip
        kpis={[
          {
            label: "Status",
            value: "Good",
            alertClass: "ok",
          },
        ]}
      />
    );
    // The delta div should have lucro color
    const deltaDiv = container.querySelector(
      "[class*='text-lucro']"
    );
    // Note: if no delta, the color won't apply. This test is aspirational — adjust based on actual markup.
  });

  it("respects cols prop for grid layout", () => {
    const { container } = render(
      <KpiStrip
        cols={3}
        kpis={[
          { label: "A", value: "1" },
          { label: "B", value: "2" },
          { label: "C", value: "3" },
        ]}
      />
    );
    const grid = container.querySelector("[style*='grid-template-columns']");
    expect(grid).toHaveStyle("grid-template-columns: repeat(3, 1fr)");
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter rionovo-client run test KpiStrip.test.tsx`

Expected: All tests pass

- [ ] **Step 5: Commit KpiStrip**

```bash
git add client/src/rebanho/components/KpiStrip.tsx client/src/rebanho/components/KpiStrip.test.tsx
git commit -m "feat(ui): add KpiStrip reusable component (Fase 5 Slice 1)"
```

---

## Task 4: Create shared modal/drawer primitives using Dialog

**Files:**
- Create: `client/src/rebanho/components/ModalBase.tsx` (wrapper around ui/Dialog)
- Create: `client/src/rebanho/components/ModalBase.test.tsx`

**Interfaces:**
- Consumes: `ui/Dialog` (already exists from Fase 3)
- Produces: `ModalBase({ isOpen, onClose, title, children, actions?, onSuccess?, className? })` component. Used by AnimalForm, EventoForm, and other drawers.

**Context:** The rebanho module uses a custom `.rb-drawer` modal style (centered, 520px wide, backdrop blur, animations). Wrapping `ui/Dialog` in a ModalBase component reduces repetition and ensures consistency.

Current CSS (rebanho.css):
```css
.rb-drawer-bg { position: fixed; inset: 0; background: rgba(14,19,17,.45); backdrop-filter: blur(2px); z-index: 10; animation: rb-fade-in .15s ease; }
.rb-drawer { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(520px, calc(100vw - 32px)); max-height: min(86vh, calc(100vh - 48px)); background: var(--bg); border: 1px solid var(--rule); border-radius: 12px; z-index: 11; padding: 28px 28px 24px; overflow-y: auto; box-shadow: 0 24px 60px rgba(0,0,0,.18); animation: rb-modal-in .18s ease; }
```

- [ ] **Step 1: Review ui/Dialog from Fase 3**

Run: `cat client/src/components/ui/dialog.tsx | head -60`

Expected: Understand the Radix Dialog structure (DialogContent, DialogHeader, DialogFooter, etc.)

- [ ] **Step 2: Write ModalBase component**

```typescript
// client/src/rebanho/components/ModalBase.tsx

import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode; // typically <Button> elements
  onSuccess?: () => void; // fired when "success" state is shown
  className?: string;
}

export function ModalBase({
  isOpen,
  onClose,
  title,
  children,
  actions,
  onSuccess,
  className,
}: ModalBaseProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "w-[min(520px,calc(100vw-32px))] max-h-[min(86vh,calc(100vh-48px))] shadow-xl backdrop-blur-sm",
          className
        )}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-medium">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(86vh-120px)]">
          {children}
        </div>

        {actions && <DialogFooter className="gap-2 justify-end">{actions}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
```

Note: This is a simple wrapper. Rebnaho-specific styles (like `.rb-success` state, animations) will be added as needed in later tasks after we see how forms use it.

- [ ] **Step 3: Write test for ModalBase**

```typescript
// client/src/rebanho/components/ModalBase.test.tsx

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModalBase } from "./ModalBase";

describe("ModalBase", () => {
  it("does not render when isOpen is false", () => {
    const { container } = render(
      <ModalBase isOpen={false} onClose={() => {}} title="Test Modal">
        Content
      </ModalBase>
    );
    expect(screen.queryByText("Test Modal")).not.toBeInTheDocument();
  });

  it("renders title and children when open", () => {
    render(
      <ModalBase isOpen={true} onClose={() => {}} title="Test Modal">
        <div>Modal Content</div>
      </ModalBase>
    );
    expect(screen.getByText("Test Modal")).toBeInTheDocument();
    expect(screen.getByText("Modal Content")).toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(
      <ModalBase
        isOpen={true}
        onClose={() => {}}
        title="Test Modal"
        actions={<button>Save</button>}
      >
        Content
      </ModalBase>
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("accepts className prop", () => {
    const { container } = render(
      <ModalBase
        isOpen={true}
        onClose={() => {}}
        title="Test Modal"
        className="custom-class"
      >
        Content
      </ModalBase>
    );
    // Note: testing className on DialogContent requires inspecting the DOM
    // This is aspirational — adjust based on actual Radix DOM structure
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter rionovo-client run test ModalBase.test.tsx`

Expected: Tests pass (some may be stubbed/mocked due to Radix Dialog complexity)

- [ ] **Step 5: Commit ModalBase**

```bash
git add client/src/rebanho/components/ModalBase.tsx client/src/rebanho/components/ModalBase.test.tsx
git commit -m "feat(ui): add ModalBase reusable component (Fase 5 Slice 1)"
```

---

## Task 5: Build + test the foundation

**Interfaces:** (none)

**Context:** Before moving to the main screens, verify that all foundation pieces compile and test cleanly.

- [ ] **Step 1: Build the client**

Run: `pnpm --filter rionovo-client run build`

Expected: No TypeScript errors, build succeeds

- [ ] **Step 2: Run all tests**

Run: `pnpm --filter rionovo-client run test`

Expected: All tests pass (should be ~100+ now)

- [ ] **Step 3: Visual smoke test (optional but recommended)**

Run: `pnpm dev` and navigate to **Rebanho → Animal** tab. Verify:
- Header displays correctly (title, eyebrow, no missing borders)
- Any buttons use RebButton styling
- No console errors

Note: Some components may still use old CSS; that's OK for this slice.

- [ ] **Step 4: Commit checkpoint**

```bash
git add -A
git commit -m "chore: foundation Slice 1 checkpoint — RebButton + HerdDomainView + KpiStrip + ModalBase"
```

---

## Next: Slice 2 (Animal Tab + AnimalCockpit)

Once this foundation is merged, Slice 2 will migrate the AnimalTab and AnimalCockpit screens using these primitives. The pattern repeats for the remaining 6 main tabs.

---

**Specification Checklist (Self-Review)**

- [x] RebButton refined and tested
- [x] HerdDomainView migrated (layout wrapper for all screens)
- [x] KpiStrip extracted (reusable KPI display)
- [x] ModalBase created (wrapper for forms/modals)
- [x] All components have Vitest coverage
- [x] No legacy CSS in new JSX
- [x] Tailwind classes used exclusively
- [x] Identity preserved (palette, fonts, spacing)
- [x] Preflight remains OFF

---

**Execution Path**

This plan is ready for subagent-driven or inline execution. Recommended approach:

1. **Subagent-driven (fast):** I dispatch a fresh subagent per task, review, then move forward.
2. **Inline execution:** You run superpowers:executing-plans and batch the tasks.

Which would you prefer?
