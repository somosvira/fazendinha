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
