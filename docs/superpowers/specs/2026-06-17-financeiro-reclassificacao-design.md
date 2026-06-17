# Fatia 22 — Reclassificação "Animal Aquisição" persistida (financeiro) — Design + Plano

**Data:** 2026-06-17 · **Status:** aprovado (manter default reclassificado + botões reais). **Depende de:** app financeiro (`dashboard.ts`, `Dashboard.tsx`).

## Contexto
Hoje o financeiro já mostra "Animal Aquisição" reclassificado como investimento (a IA), mas isso vem de um `Set` hardcoded (`CATEGORIAS_MISCLASSIFICADAS`) e os botões do card de inconsistência **não fazem nada** (mock). Decisão: **manter o default reclassificado** (preserva o app) e **persistir a decisão** com botões reais. Abordagem A: override em `Categoria`.

## Modelo
- `Categoria.classificacao` enum `ClassificacaoCategoria { CUSTEIO, INVESTIMENTO }` **nullable**. `null` = pendente (default → tratado como hoje, reclassificado).
  - **null** (pendente): Animal Aquisição segue no balde reclassificado (investimento) + card visível.
  - **INVESTIMENTO** (confirmado): igual ao default, card some, ⚠ some.
  - **CUSTEIO** (revertido p/ BPO): Animal Aquisição volta pro custeio do leite (headline/DRE mudam), card some.

## Mudanças
1. **Schema:** `Categoria.classificacao` (db push).
2. **`dashboard.ts`:** `select` ganha `classificacao`. No loop:
   ```ts
   const cls = l.categoria.classificacao;                 // "CUSTEIO" | "INVESTIMENTO" | null
   const isAnimAq = catNome === "Animal Aquisição";
   const animAqRevertido = isAnimAq && cls === "CUSTEIO";  // volta pro custeio
   const misclass = CATEGORIAS_MISCLASSIFICADAS.has(catNome) && !animAqRevertido;
   const flag = misclass && !(isAnimAq && cls != null) ? "investimento-misclassificado" : undefined; // ⚠ só enquanto pendente
   ```
   `misclass` controla os baldes como hoje (revertido cai no `else → custeioLeitePuro`). `flag` no `catMap` usa a var acima. Capturar `animAqCatId`/`animAqCls` no loop.
3. **Inconsistências:** o card "Animal Aquisição" é emitido **só se `animAqCls == null`** (pendente). Ganha `categoriaId: animAqCatId`. Copy atualizado p/ o framing reclassificado: titulo "Animal Aquisição reclassificada para investimento", acao "Confirmar reclassificação", + a opção reverter.
4. **Endpoint:** `PATCH /api/categorias/:id/classificacao` body `{ classificacao: "INVESTIMENTO" | "CUSTEIO" }` (Zod). Novo `server/src/routes/categorias.ts` montado no `index.ts`.
5. **Client (`Dashboard.tsx`):** o card de inconsistência do Animal Aquisição (quando tem `categoriaId`) renderiza 2 botões reais: **"Confirmar reclassificação"** → PATCH INVESTIMENTO; **"Reverter para custeio (BPO)"** → PATCH CUSTEIO. On success → re-fetch do dashboard (card some + números atualizam). Demais inconsistências (RN, etc.) seguem como hoje (mock/deferidas).

## Verificação
- API `/api/dashboard`: com Animal Aquisição null → card presente c/ `categoriaId`, custeio23 exclui Animal Aquisição (reclassificado). PATCH CUSTEIO → custeio23 **inclui** Animal Aquisição (sobe ~R$ 1,3mi 23m), card some, ⚠ some, DRE muda. PATCH INVESTIMENTO → volta ao default, card some.
- Navegador: clicar "Reverter" muda a headline CUSTEIO + o operacional do leite na DRE; clicar "Confirmar" fecha o card mantendo os números. Idempotente.
- Server build/test + client build verdes.

## Deferido
- RN Caminhão / Atividade Plantio / sem-CCusto (outras inconsistências) — seguem mock.
- Histórico/auditoria da decisão; UI de classificação em massa.
