# shadcn/ui — Fase 0 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduzir Tailwind v4 + shadcn (Radix) no `client/` preservando 100% a identidade editorial, e provar a esteira ponta a ponta migrando `Login.tsx` + `ConfirmDialog.tsx`, sem regredir nenhuma tela legada.

**Architecture:** Tailwind v4 entra no Vite **sem preflight** (protege as 12 folhas CSS legadas durante a migração multi-mês) — só as camadas `theme` + `utilities`, mais um shim mínimo de `border`/`box-sizing`. Um `theme.css` mapeia a paleta papel/tinta + brass/coffee/sage e as fontes Newsreader/DM Sans nos tokens shadcn. As primitivas (`button`, `input`, `label`, `dialog`) são autoradas com a estrutura canônica shadcn adaptada para **React 18 (forwardRef)**, tematizadas via tokens. O piloto reescreve duas telas folha e apaga só o CSS que elas monopolizam.

**Tech Stack:** Vite 6 · React 18 · TypeScript · Tailwind v4 (`@tailwindcss/vite`) · Radix UI · CVA · clsx + tailwind-merge · lucide-react · vitest (+ jsdom/@testing-library/react para componentes portalizados).

## Global Constraints

- **Base de primitivas:** Radix canônico (não portar os componentes Base UI do `pointless`).
- **React 18:** primitivas que recebem `ref` (`Button`, `Input`, `Label`) **usam `React.forwardRef`** — o shadcn novo (ref-as-prop) assume React 19 e quebraria aqui.
- **Preservar identidade:** cantos retos (`--radius: 0rem`), serif Newsreader nos displays, tabular-nums; nenhuma tela legada pode mudar de aparência.
- **Preflight OFF nesta fase:** importar só `tailwindcss/theme.css` + `tailwindcss/utilities.css` (nunca `@import "tailwindcss"` puro) até a Fase 7.
- **`theme.css` é importado ANTES do CSS legado** em `main.tsx`.
- **Imports client** não levam extensão (Vite/bundler resolution); alias `@/` → `client/src`.
- **Escopo de deleção de CSS:** apagar só blocos comprovadamente monopolizados pela tela migrada (`login-*` e `confirm-*`). **NÃO** apagar `.btn-primary`/`.btn-ghost` (usados por Lancar, RupturaCaixa, DateRangePicker, PlanoContas, Dashboard, Relatorio, Acessos).
- **Comandos por workspace:** `pnpm --filter rionovo-client run build` / `run test`.
- **PT-BR** em código/copy/comentários (consistente com a base).

**Nota de escopo (refino do spec por YAGNI):** o spec listava `textarea`, `select`, `dropdown-menu` e `sonner` como primitivas "iniciais". Elas **não têm consumidor no piloto** e entram nas fases que primeiro as usam (Shell → `dropdown-menu`; Gastos/forms → `select`/`textarea`; toasts → `sonner`). `Toast.tsx` é **mantido como está** nesta fase (o spec permite "mantido"). Phase 0 entrega só `button`, `input`, `label`, `dialog`.

---

### Task 1: Wire Tailwind v4 + alias `@/` + tokens de tema (sem mudança visual)

Fundação de build. Ao final, o app compila e renderiza **idêntico** — theme.css só disponibiliza utilidades, sem preflight.

**Files:**
- Modify: `client/package.json` (deps — via pnpm)
- Modify: `client/vite.config.ts`
- Modify: `client/tsconfig.json`
- Create: `client/src/styles/theme.css`
- Create: `client/components.json`
- Modify: `client/src/main.tsx:5` (import de `theme.css` como primeiro)

**Interfaces:**
- Produces: alias `@/*` → `client/src/*`; tokens CSS shadcn (`--background`, `--primary`, …) + utilidades Tailwind (`bg-card`, `text-ink-3`, `ring-atencao`, `font-serif`, …); `components.json` para `npx shadcn add` futuro.

- [ ] **Step 1: Instalar dependências no workspace do client**

Run:
```bash
pnpm --filter rionovo-client add class-variance-authority clsx tailwind-merge tw-animate-css lucide-react @radix-ui/react-slot @radix-ui/react-label @radix-ui/react-dialog
pnpm --filter rionovo-client add -D tailwindcss @tailwindcss/vite @types/node
```
Expected: instala sem erro; `client/package.json` ganha as deps.

- [ ] **Step 2: Adicionar o plugin do Tailwind e o alias no Vite**

Substituir o conteúdo de `client/vite.config.ts` por:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 41875,
    proxy: {
      "/api": "http://localhost:41873",
    },
  },
});
```

- [ ] **Step 3: Adicionar `baseUrl` + `paths` no tsconfig do client**

Em `client/tsconfig.json`, dentro de `compilerOptions`, adicionar (após `"esModuleInterop": true`):
```jsonc
    "esModuleInterop": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 4: Criar `client/src/styles/theme.css`**

```css
/* Rio Novo — camada Tailwind v4 + tokens shadcn (identidade editorial).
 * Importado ANTES do CSS legado em main.tsx: durante a migração o CSS antigo
 * ainda sobrepõe. O Preflight do Tailwind é OMITIDO de propósito (protege as 12
 * folhas legadas); um shim mínimo no fim dá só o que as utilidades shadcn usam. */

@layer theme, base, components, utilities;

@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
@import "tw-animate-css";

:root {
  --radius: 0rem;

  /* superfícies */
  --background: #F2EDE2;
  --foreground: #14191A;
  --card: #FAF6EC;
  --card-foreground: #14191A;
  --popover: #FAF6EC;
  --popover-foreground: #14191A;

  /* ação primária = CTA escuro do masthead */
  --primary: #0E1311;
  --primary-foreground: #E8DCC4;

  --secondary: #F6F1E4;
  --secondary-foreground: #14191A;
  --muted: #F6F1E4;
  --muted-foreground: #3A4341;
  --accent: #F6F1E4;
  --accent-foreground: #14191A;

  --destructive: #C62828;
  --destructive-foreground: #F2EDE2;

  --border: #D6CDB8;
  --input: #D6CDB8;
  --ring: #14191A;

  /* gráficos: brass / coffee / sage */
  --chart-1: #B89A5C;
  --chart-2: #5C3A1E;
  --chart-3: #6B7A5C;
  --chart-4: #8A5A30;
  --chart-5: #93A07F;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  /* extras editoriais — reaproveitam as variáveis definidas em base.css */
  --color-ink-2: var(--ink-2);
  --color-ink-3: var(--ink-3);
  --color-leite: var(--leite);
  --color-cafe: var(--cafe);
  --color-outros: var(--outros);
  --color-lucro: var(--lucro);
  --color-prejuizo: var(--prejuizo);
  --color-atencao: var(--atencao);
  --color-info: var(--info);
  --color-rural: var(--rural);
  --color-mast: var(--mast-bg);
  --color-mast-ink: var(--mast-ink);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --font-sans: "DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-serif: "Newsreader", "Source Serif 4", Georgia, serif;
}

/* Shim mínimo (substitui o Preflight omitido): só o que as utilidades e
 * componentes shadcn assumem. Inócuo ao CSS legado, que sempre usa shorthands
 * completos de border; largura 0 continua invisível como hoje. */
@layer base {
  *, ::after, ::before, ::backdrop, ::file-selector-button {
    box-sizing: border-box;
    border: 0 solid var(--border);
  }
}
```

- [ ] **Step 5: Criar `client/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/theme.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 6: Importar `theme.css` como primeiro import em `main.tsx`**

Em `client/src/main.tsx`, adicionar a linha **antes** de `import "./styles/base.css";`:
```ts
import "./styles/theme.css";
import "./styles/base.css";
```

- [ ] **Step 7: Build + testes existentes verdes**

Run:
```bash
pnpm --filter rionovo-client run build && pnpm --filter rionovo-client run test
```
Expected: `vite build` conclui sem erro; `vitest` mantém os testes atuais PASS. (Sanidade manual: `pnpm dev:client`, abrir o Dashboard/Gastos e confirmar que nada mudou de aparência — o preflight está desligado.)

- [ ] **Step 8: Commit**

```bash
git add client/package.json client/vite.config.ts client/tsconfig.json client/src/styles/theme.css client/components.json client/src/main.tsx pnpm-lock.yaml
git commit -m "feat(client): Tailwind v4 + tokens shadcn (fase 0, sem preflight)"
```

---

### Task 2: `cn` + primitivas Button / Input / Label (tematizadas, React 18)

**Files:**
- Create: `client/src/lib/utils.ts`
- Create: `client/src/components/ui/button.tsx`
- Create: `client/src/components/ui/input.tsx`
- Create: `client/src/components/ui/label.tsx`
- Modify: `client/vitest.config.ts` (alias `@/`)
- Test: `client/src/components/ui/button.test.ts`

**Interfaces:**
- Consumes: alias `@/`, tokens de tema (Task 1).
- Produces:
  - `cn(...inputs: ClassValue[]): string`
  - `Button` (`React.forwardRef<HTMLButtonElement, ButtonProps>`), `buttonVariants` — variants `default|outline|secondary|ghost|destructive|link`, sizes `default|sm|lg|icon`, prop `asChild`.
  - `Input` (`React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>`)
  - `Label` (`React.forwardRef` sobre `@radix-ui/react-label`)

- [ ] **Step 1: Adicionar o alias `@/` no vitest.config**

Substituir `client/vitest.config.ts` por:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Criar `client/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Escrever o teste que falha (Button)**

Create `client/src/components/ui/button.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { Button } from "./button";

describe("Button", () => {
  it("renderiza a variante default com o token primário", () => {
    const html = renderToString(h(Button, null, "Salvar"));
    expect(html).toContain("Salvar");
    expect(html).toContain("bg-primary");
    expect(html).toContain('data-slot="button"');
  });

  it("aplica a variante outline", () => {
    const html = renderToString(h(Button, { variant: "outline" }, "Cancelar"));
    expect(html).toContain("border-input");
  });
});
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `pnpm --filter rionovo-client run test -- button`
Expected: FAIL — `Cannot find module './button'`.

- [ ] **Step 5: Criar `client/src/components/ui/button.tsx`**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        secondary: "border border-foreground bg-card text-foreground hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `pnpm --filter rionovo-client run test -- button`
Expected: PASS (2 testes).

- [ ] **Step 7: Criar `client/src/components/ui/input.tsx`**

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "flex h-9 w-full min-w-0 border border-input bg-transparent px-3 py-1 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
```

- [ ] **Step 8: Criar `client/src/components/ui/label.tsx`**

```tsx
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    data-slot="label"
    className={cn(
      "flex select-none items-center gap-2 text-sm font-medium leading-none",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
```

- [ ] **Step 9: Build + testes verdes**

Run: `pnpm --filter rionovo-client run build && pnpm --filter rionovo-client run test`
Expected: build OK; todos os testes PASS.

- [ ] **Step 10: Commit**

```bash
git add client/vitest.config.ts client/src/lib/utils.ts client/src/components/ui/button.tsx client/src/components/ui/input.tsx client/src/components/ui/label.tsx client/src/components/ui/button.test.ts
git commit -m "feat(ui): primitivas Button/Input/Label + cn (shadcn, React 18)"
```

---

### Task 3: Primitiva Dialog + infra de teste jsdom/RTL

Dialog é portalizado (Radix) → não renderiza em SSR. Aqui entra o ambiente de DOM que o resto da migração vai usar.

**Files:**
- Create: `client/src/components/ui/dialog.tsx`
- Test: `client/src/components/ui/dialog.test.ts`
- Modify: `client/package.json` (dev deps de teste)

**Interfaces:**
- Consumes: `cn` (Task 2), `@radix-ui/react-dialog`, `lucide-react`.
- Produces: `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent` (prop `showCloseButton?: boolean`, default `true`), `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`.

- [ ] **Step 1: Instalar jsdom + Testing Library**

Run:
```bash
pnpm --filter rionovo-client add -D jsdom @testing-library/react
```
Expected: instala sem erro.

- [ ] **Step 2: Escrever o teste que falha (Dialog)**

Create `client/src/components/ui/dialog.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

afterEach(cleanup);

describe("Dialog", () => {
  it("mostra o conteúdo (portalizado) quando open", () => {
    render(
      h(Dialog, { open: true }, h(DialogContent, null, h(DialogTitle, null, "Título teste"))),
    );
    expect(screen.getByText("Título teste")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("não mostra o conteúdo quando fechado", () => {
    render(
      h(Dialog, { open: false }, h(DialogContent, null, h(DialogTitle, null, "Oculto"))),
    );
    expect(screen.queryByText("Oculto")).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `pnpm --filter rionovo-client run test -- dialog`
Expected: FAIL — `Cannot find module './dialog'`.

- [ ] **Step 4: Criar `client/src/components/ui/dialog.tsx`**

```tsx
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="dialog-overlay"
    className={cn(
      "fixed inset-0 z-50 bg-[rgba(20,25,26,0.45)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean;
  }
>(({ className, children, showCloseButton = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-slot="dialog-content"
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-full max-w-[460px] -translate-x-1/2 -translate-y-1/2 gap-0 border border-border bg-card shadow-[0_24px_56px_rgba(20,25,26,0.28)] duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close
          data-slot="dialog-close"
          className="absolute right-4 top-4 cursor-pointer opacity-70 outline-none transition-opacity hover:opacity-100 disabled:pointer-events-none [&_svg]:size-4"
        >
          <X />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    data-slot="dialog-title"
    className={cn("font-serif text-xl tracking-[-0.005em] text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    data-slot="dialog-description"
    className={cn("text-[15px] leading-relaxed text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `pnpm --filter rionovo-client run test -- dialog`
Expected: PASS (2 testes).

- [ ] **Step 6: Build + suíte completa verdes**

Run: `pnpm --filter rionovo-client run build && pnpm --filter rionovo-client run test`
Expected: build OK; todos PASS.

- [ ] **Step 7: Commit**

```bash
git add client/package.json pnpm-lock.yaml client/src/components/ui/dialog.tsx client/src/components/ui/dialog.test.ts
git commit -m "feat(ui): primitiva Dialog + infra de teste jsdom/RTL"
```

---

### Task 4: Migrar `Login.tsx` para as primitivas

Tela folha (só `Login.tsx` usa as classes `login-*`). Reescreve o markup, mantém a lógica de auth intacta, apaga o CSS `login-*`.

**Files:**
- Modify: `client/src/components/Login.tsx`
- Modify: `client/src/styles/base.css` (deletar bloco `Login`)
- Test: `client/src/components/Login.test.ts`

**Interfaces:**
- Consumes: `Button`, `Input`, `Label` (Task 2); tokens `bg-background`/`bg-card`/`border-border`/`text-ink-3`/`text-destructive`/`ring-atencao`/`text-foreground`/`text-background`.
- Produces: `Login` (assinatura inalterada — export nomeado, sem props).

- [ ] **Step 1: Escrever o teste que falha (Login)**

Create `client/src/components/Login.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { Login } from "./Login";

describe("Login", () => {
  it("renderiza marca, título, label e botão", () => {
    const html = renderToString(h(Login));
    expect(html).toContain("Fazenda Rio Novo");
    expect(html).toContain("Entrar");
    expect(html).toContain("Senha");
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('data-slot="input"');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter rionovo-client run test -- Login`
Expected: FAIL — o HTML atual usa `class="login-btn"`, não `data-slot="button"`.

- [ ] **Step 3: Reescrever `client/src/components/Login.tsx`**

```tsx
/* Tela de login mínima do piloto (fase de teste com o dono).
 *
 * Entrada única: senha compartilhada (matches `env.SHARED_ACCESS_TOKEN` do server).
 * Não é sistema de usuários — quando escalar, trocar por Firebase/Auth0/Supabase
 * (o único ponto do cliente a mudar é `lib/auth.ts`).
 *
 * Design: layout centrado, cream premium (cantos arredondados são exceção
 * proposital ao visual reto do app), botão gray-out enquanto valida. */

import { FormEvent, useState } from "react";
import { setToken } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Login() {
  const [senha, setSenha] = useState("");
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!senha || validando) return;
    setValidando(true);
    setErro(null);
    try {
      // Ping numa rota qualquer com o token — se voltar 200/204, o token vale.
      // /api/propriedades é leve, existe desde a Fatia 0 e passa pelo middleware.
      const res = await fetch("/api/propriedades", {
        headers: { authorization: `Bearer ${senha}` },
      });
      if (res.status === 401) {
        setErro("Senha inválida.");
        setValidando(false);
        return;
      }
      if (!res.ok) {
        setErro(`Erro ao validar (${res.status}). Tenta de novo.`);
        setValidando(false);
        return;
      }
      setToken(senha);
      // Reload traz a app renderizando com o token gravado — evita gerenciar
      // um bus global de "acabei de logar" atravessando módulos.
      window.location.reload();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha de rede.");
      setValidando(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <form
        onSubmit={submeter}
        className="flex w-full max-w-[380px] flex-col gap-2.5 rounded-[14px] border border-border bg-card px-[26px] py-7 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
      >
        <div className="font-serif text-[15px] tracking-[0.02em] text-ink-3">Fazenda Rio Novo</div>
        <div className="mb-1 font-serif text-[26px] leading-[1.1] text-foreground">Entrar</div>
        <div className="mb-3 text-[13px] text-ink-3">
          Fase de teste — acesso por senha compartilhada.
        </div>
        <Label
          htmlFor="login-senha"
          className="mt-1 text-xs font-normal uppercase tracking-[0.05em] text-ink-3"
        >
          Senha
        </Label>
        <Input
          id="login-senha"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={senha}
          disabled={validando}
          onChange={(e) => setSenha(e.target.value)}
          className="rounded-[8px] bg-background text-[15px] focus-visible:ring-atencao focus-visible:ring-offset-0"
        />
        {erro && <div className="text-[13px] text-destructive">{erro}</div>}
        <Button
          type="submit"
          disabled={!senha || validando}
          className="mt-2 rounded-[8px] bg-foreground text-background hover:bg-foreground/90"
        >
          {validando ? "Validando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter rionovo-client run test -- Login`
Expected: PASS.

- [ ] **Step 5: Deletar o bloco `Login` do `base.css`**

Em `client/src/styles/base.css`, apagar todo o bloco do comentário até o fechamento — do anchor de início:
```css
/* Login (piloto) — tela mínima antes do App carregar. */
.login-screen {
```
até o anchor de fim (inclusive):
```css
.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```
(São as classes `.login-screen`, `.login-card`, `.login-brand`, `.login-title`, `.login-caption`, `.login-label`, `.login-input`, `.login-input:focus`, `.login-erro`, `.login-btn`, `.login-btn:disabled` — verificado: nenhuma outra tela as usa.)

- [ ] **Step 6: Build + suíte completa verdes**

Run: `pnpm --filter rionovo-client run build && pnpm --filter rionovo-client run test`
Expected: build OK; todos PASS. (Sanidade manual opcional: `pnpm dev:client`, deslogar/abrir a tela de login e conferir paridade.)

- [ ] **Step 7: Commit**

```bash
git add client/src/components/Login.tsx client/src/components/Login.test.ts client/src/styles/base.css
git commit -m "feat(login): migra Login para primitivas shadcn; remove CSS login-*"
```

---

### Task 5: Migrar `ConfirmDialog.tsx` para shadcn Dialog + Button

API pública **inalterada** (`Acessos.tsx` continua funcionando sem mudança). Radix passa a tratar Escape/clique-fora/foco-trap; Enter confirma via botão de confirmação autofocado.

**Files:**
- Modify: `client/src/components/ConfirmDialog.tsx`
- Modify: `client/src/styles/base.css` (deletar bloco `CONFIRM DIALOG` + tirar `.confirm-overlay` do seletor de print)
- Test: `client/src/components/ConfirmDialog.test.ts`

**Interfaces:**
- Consumes: `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle` (Task 3); `Button` (Task 2).
- Produces: `ConfirmDialog` + `ConfirmTone` — assinatura idêntica à atual (`open`, `title`, `message`, `confirmLabel?`, `cancelLabel?`, `tone?`, `onConfirm`, `onCancel`).

- [ ] **Step 1: Escrever o teste que falha (ConfirmDialog)**

Create `client/src/components/ConfirmDialog.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("mostra título/mensagem e dispara onConfirm/onCancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      h(ConfirmDialog, {
        open: true,
        title: "Excluir?",
        message: "Ação irreversível.",
        onConfirm,
        onCancel,
      }),
    );
    expect(screen.getByText("Excluir?")).toBeTruthy();
    expect(screen.getByText("Ação irreversível.")).toBeTruthy();
    fireEvent.click(screen.getByText("Confirmar"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("não renderiza quando open=false", () => {
    render(
      h(ConfirmDialog, {
        open: false,
        title: "Oi",
        message: "x",
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    expect(screen.queryByText("Oi")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter rionovo-client run test -- ConfirmDialog`
Expected: FAIL — hoje o componente não portaliza (usa `.confirm-overlay`); a estrutura nova do Radix esperada pelo teste ainda não existe.

- [ ] **Step 3: Reescrever `client/src/components/ConfirmDialog.tsx`**

```tsx
/* Rio Novo — diálogo de confirmação para ações destrutivas/irreversíveis.
 * shadcn Dialog (Radix) trata Escape / clique-fora / foco-trap; Enter confirma
 * via botão de confirmação autofocado. API pública inalterada. */

import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmTone = "neutral" | "danger";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "neutral",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          confirmRef.current?.focus();
        }}
        className="gap-0"
      >
        <DialogHeader className="border-b border-[color:var(--rule-soft)] px-[22px] pb-3 pt-[18px]">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="px-[22px] py-4 text-[15px] leading-relaxed text-muted-foreground">
          {message}
        </div>
        <DialogFooter className="border-t border-[color:var(--rule-soft)] px-[22px] pb-[18px] pt-3.5">
          <Button
            variant="outline"
            className="h-auto px-3 py-1.5 text-xs tracking-[0.04em]"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === "danger" ? "outline" : "default"}
            className={
              tone === "danger"
                ? "h-auto px-3 py-1.5 text-xs tracking-[0.04em] hover:border-destructive hover:text-destructive"
                : "h-auto px-[22px] py-3 text-[13px] uppercase tracking-[0.08em]"
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter rionovo-client run test -- ConfirmDialog`
Expected: PASS (2 testes).

- [ ] **Step 5: Deletar o bloco `CONFIRM DIALOG` do `base.css`**

Em `client/src/styles/base.css`, apagar do anchor de início:
```css
/* ============================================================
   CONFIRM DIALOG — diálogo modal simples (acessível)
   ============================================================ */
.confirm-overlay {
```
até o anchor de fim (inclusive):
```css
.confirm-foot {
  padding: 14px 22px 18px;
  display: flex; justify-content: flex-end; gap: 10px;
  border-top: 1px solid var(--rule-soft);
}
```
(Inclui `@keyframes confirm-fade`, usado só pelo overlay.)

- [ ] **Step 6: Tirar `.confirm-overlay` do seletor de `@media print`**

Em `client/src/styles/base.css`, na regra de print, substituir a linha:
```css
  .gastos-toolbar .search-box, .viewas-banner, .modal-overlay, .confirm-overlay {
```
por:
```css
  .gastos-toolbar .search-box, .viewas-banner, .modal-overlay {
```

- [ ] **Step 7: Build + suíte completa verdes**

Run: `pnpm --filter rionovo-client run build && pnpm --filter rionovo-client run test`
Expected: build OK; todos PASS. (Sanidade manual opcional: abrir Acessos e disparar uma confirmação destrutiva.)

- [ ] **Step 8: Commit**

```bash
git add client/src/components/ConfirmDialog.tsx client/src/components/ConfirmDialog.test.ts client/src/styles/base.css
git commit -m "feat(confirm): migra ConfirmDialog para shadcn Dialog; remove CSS confirm-*"
```

---

### Task 6: Playbook de migração (guia das fases 1–7)

Documento curto que padroniza "como migrar uma tela" para as próximas fases.

**Files:**
- Create: `docs/superpowers/specs/2026-07-08-shadcn-migration-playbook.md`

- [ ] **Step 1: Criar o playbook**

````markdown
# shadcn — Playbook de migração (fases 1–7)

Padrão repetível derivado da Fase 0. Cada fase aposenta um conjunto de CSS.

## Pré-condições (prontas na Fase 0)
- Tailwind v4 (sem preflight) + tokens em `client/src/styles/theme.css`.
- Alias `@/` (vite + tsconfig + vitest). `cn` em `@/lib/utils`.
- Primitivas em `client/src/components/ui/` (button, input, label, dialog).

## Passo a passo por tela/componente
1. **Inventariar** as classes CSS que a tela monopoliza (`grep -rn "classe" client/src`). Só é seguro apagar CSS usado *exclusivamente* pela tela migrada.
2. **Primitiva faltando?** adicionar via `npx shadcn@latest add <nome>` (lê `components.json`) e conferir o tema (cantos retos, tokens, `forwardRef` p/ React 18). Ajustar classes aos tokens editoriais.
3. **Teste primeiro** (TDD): componente portalizado → `// @vitest-environment jsdom` + `@testing-library/react`; sem portal → `renderToString` (node), no padrão `createElement as h` (arquivos `*.test.ts`).
4. **Reescrever** o markup em Tailwind + primitivas, preservando aparência (comparar antes/depois) e a **API pública** do componente (consumidores não mudam).
5. **Apagar** só o CSS monopolizado; nunca classes compartilhadas (ex.: `.btn-primary`/`.btn-ghost` seguem até suas fases).
6. **Gate (DoD):** `pnpm --filter rionovo-client run build` verde · `run test` verde · nenhuma classe legada órfã referenciada pela tela migrada · paridade visual · bloco de CSS aposentado deletado.

## Convenções de tema
- Cantos retos por padrão (`--radius: 0`); arredondado é exceção explícita via `rounded-[Npx]`.
- CTA escuro = `Button` default (token `--primary` = masthead). Outline = `variant="outline"`.
- Cores editoriais extras: `text-ink-2/ink-3`, `bg-leite/cafe/outros`, `text-lucro/prejuizo/atencao/info`, `bg-mast text-mast-ink`.
- Preflight continua **desligado** até a Fase 7 (quando o último CSS legado sair).
````

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-07-08-shadcn-migration-playbook.md
git commit -m "docs: playbook de migração shadcn (fases 1-7)"
```

---

## Self-Review

**Spec coverage** (contra `2026-07-08-shadcn-migration-design.md`):
- §4.1 Toolchain (Tailwind v4, alias, cn, components.json) → Tasks 1–2. ✔
- §4.2 Theme fiel → Task 1 Step 4. ✔
- §4.3 Coexistência/preflight → resolvido de forma determinística (preflight OFF + shim) em Task 1; Global Constraints. ✔ (mais forte que o "decidir no piloto" do spec — sem risco às telas legadas.)
- §4.4 Primitivas + piloto (Login/ConfirmDialog) → Tasks 2–5; Toast **mantido** (permitido pelo spec); textarea/select/dropdown/sonner **adiados** por YAGNI (documentado na nota de escopo). ✔
- §4.4 Playbook → Task 6. ✔
- §4.5 DoD por fase → gates de build+test em cada task; playbook. ✔

**Placeholder scan:** sem TBD/TODO; todo código está completo; deleções de CSS têm anchors exatos. ✔

**Type consistency:** `cn` (Task 2) consumido por todas as primitivas; `Button`/`Input`/`Label` (Task 2) consumidos por Login (Task 4) e ConfirmDialog (Task 5); `Dialog*` (Task 3) consumidos por ConfirmDialog (Task 5); assinatura de `ConfirmDialog` idêntica à atual → `Acessos.tsx` intacto. Nomes de export conferem entre tasks. ✔
