# Reprodução Bloco F — Relatórios, reconciliação e aceite — Design

**Data:** 2026-07-28
**Branch base:** `main` (Blocos A `#209`, B `#215`, C `#216` mergeados; D `#217` e E `#218` abertos)
**Contrato de aceite:** [`docs/design/reproducao-paridade-ideagri.md`](../../design/reproducao-paridade-ideagri.md)
**Spec-mãe:** [`docs/superpowers/specs/2026-07-26-reproducao-paridade-ideagri-design.md`](2026-07-26-reproducao-paridade-ideagri-design.md) (Bloco F, §4)
**Status:** aprovado (usuário: "assim que acabar esse ja faz o proximo bloco ate fechar tudo de reproducao… vai no que voce recomendaria").

---

## 1. Objetivo

Fechar as linhas *Relatórios reprodutivos/IATF* e *Receber coletas/mobile* do contrato e selar o gate de aceite. Entrega:

1. **Relatório reprodutivo agregado** — taxa de concepção por método (IA/MN/TE) e eficiência reprodutiva por período (coberturas, prenhezes, partos, taxa) num único DTO, com numeradores/denominadores explícitos.
2. **Reconciliação por contagens** — cálculo puro que confere contagens por tipo de evento e por animal contra um baseline informado, sinalizando divergências não explicadas (fail-closed).
3. **Aceite** — atualização da matriz do contrato e dos catálogos de features/gaps; *Receber coletas / Receber dados IATF* registrados como **N/A arquitetural** (equivalente web = import idempotente + lançamento/execução, já entregues).

## 2. Decisões

1. **Escopo consciente da base.** Sobre `main`, o corte estável de concepção é por **método** (`calcularTaxaConcepcao`, IA/MN/TE) e os indicadores de `indicadores-embrapa`. Os cortes por estímulo/CIDR/ordem de IA dependem de `AplicacaoProtocoloIATF` (Blocos A/D) e ficam **fora deste bloco** — entram quando aqueles PRs estiverem em `main`, sem reescrever este relatório. Não inventar dependências ausentes da base.
2. **Cálculo puro primeiro.** O relatório e a reconciliação são funções puras testáveis (`*.calc.ts`); o service só lê o `EventoReprodutivo` no escopo e delega. Reusa `calcularTaxaConcepcao` sem duplicar a atribuição diagnóstico→cobertura.
3. **Período por janela ISO.** O relatório aceita `de`/`ate` (YYYY-MM-DD) opcionais; sem janela, agrega tudo. Filtra por `data` do evento.
4. **Reconciliação sem fonte inventada.** O baseline é informado por parâmetro (o operador cola as contagens do IDEAGRI); o cálculo compara e lista divergências. Não embute números do 777.
5. **N/A arquitetural assinado.** "Receber coletas"/"Receber dados IATF" não são replicados (arquitetura desktop→cloud); o equivalente web já existe. Registrado no contrato e nos gaps.

## 3. Arquitetura e convenções

Mesmo pipeline: **rota fina (`routes/rebanho/`) → service (`services/rebanho/`) → cálculo puro (`*.calc.ts`)**. Invariantes: escopo de propriedade via `resolverEscopoLeitura(c)`; Decimal→Number na borda; datas `@db.Date`; PT-BR; server importa `.ts` como `.js`.

## 4. Cálculo puro (TDD)

- `relatorio-reproducao.calc.ts`:
  - `agregarRelatorioReproducao(eventos, { de?, ate? }) → RelatorioReproducao` onde `RelatorioReproducao = { periodo: { de: string|null, ate: string|null }, coberturas: number, prenhes: number, partos: number, taxaConcepcao: number|null, porMetodo: TaxaConcepcaoMetodo[] }`. Filtra por janela, conta partos (`tipo === "PARTO"`), reusa `calcularTaxaConcepcao` para `porMetodo`, e consolida `coberturas/prenhes/taxa` somando os métodos. `taxa` nunca NaN (null quando sem coberturas).
- `reconciliacao-reproducao.calc.ts`:
  - `reconciliarContagens(observado: Record<string, number>, baseline: Record<string, number>) → { chave: string, observado: number, baseline: number, divergencia: number }[]` — uma linha por chave presente em qualquer lado; `divergencia = observado - baseline`; ordena por |divergência| desc. `haDivergencia(linhas) → boolean`.

## 5. Service e rota

- `relatorio-reproducao.ts` — `obterRelatorioReproducao(propriedadeId, { de?, ate? })`: lê `EventoReprodutivo` no escopo (`tipo in [INSEMINACAO, COBERTURA, TRANSFERENCIA_EMBRIAO, DIAGNOSTICO, PARTO]`), mapeia para o input puro e chama `agregarRelatorioReproducao`. `contarEventosPorTipo(propriedadeId)` para a reconciliação.
- Rota fina em `routes/rebanho/relatorio-reproducao.ts`: `GET /api/rebanho/reproducao/relatorio?de=&ate=`. Montada em `index.ts`.

## 6. UI (padrão `rb-*`)

- No `ReproducaoTab` (ou seção própria): card "Relatório reprodutivo" com seletor de período (inputs date) — tabela por método e os totais. Sem dependências novas; formatação via `fmt*` de `charts.tsx`. Fetcher `obterRelatorioReproducao(de?, ate?)` em `api.ts` com `comPropriedade`.

## 7. Aceite (docs)

- `docs/design/reproducao-paridade-ideagri.md`: matriz — *Relatórios reprodutivos/IATF* → `🟡` (por método entregue; cortes IATF avançados dependem de A/D em main) com nota; *Receber coletas/mobile* → `N/A` arquitetural assinado.
- `docs/design/ideagri-catalogo-features.md` e `ideagri-gaps.md`: refletir relatório reprodutivo entregue e o N/A.
- `docs/reproducao-teste-na-maquina-ideagri.md`: seção de reconciliação — como colar o baseline do IDEAGRI e rodar `reconciliarContagens`.

## 8. Testes e gate

- **Puro:** `relatorio-reproducao.calc` (janela, partos, consolidação, null sem coberturas), `reconciliacao-reproducao.calc` (divergência, ordenação, chaves ausentes de um lado).
- **Service (Vitest + mock Prisma):** escopo de propriedade na leitura; mapeamento evento→input; `contarEventosPorTipo`.
- **Client:** fetcher path/método; render smoke da seção.
- **Gate:** server+client vitest verdes · `node --test build-rebanho-json.test.mjs` (sem regressão) · `pnpm build` · docs atualizados.

## 9. Fora de escopo

Cortes de concepção por estímulo/CIDR/ordem de IA (dependem de `AplicacaoProtocoloIATF` dos Blocos A/D em main); browser E2E ponta-a-ponta (fica como aceite manual do operador); import real do `DADOS777.FDB` (pendência de máquina). O relatório é aditivo e não reescreve `calcularTaxaConcepcao`.
