# Busca de entidades reais no ⌘K (deep-link ao cockpit) — design

**Data:** 2026-06-30 · **Status:** aprovado (deep-link ao cockpit). Evolui o command palette (PR #73).

## Objetivo
No command palette (⌘K), além das páginas/ações estáticas, buscar **entidades reais do banco**
(talhão, animal, lote, categoria, fornecedor) por nome/código e, ao selecionar, **abrir direto
o cockpit/ficha** daquela entidade (deep-link).

## Backend
`server/src/services/busca.ts` + `server/src/routes/busca.ts` (montar em `index.ts`):
- `GET /api/busca?q=<query>` (q ignora <2 chars → `[]`). Consulta em paralelo, `contains` insensitive,
  ~6 por tipo: `Talhao` (codigo/nome), `Animal` (numero/nome), `LoteCorte` (codigo/nome),
  `Categoria` (nome), `ClienteFornecedor` (nome).
- Retorna `ResultadoBusca[]`: `{ tipo:"talhao"|"animal"|"lote"|"categoria"|"fornecedor", entidadeId:string,
  label:string, sublabel:string, tab:Tab, grupo:string }`. `tab` = a aba do módulo (ex.: talhao→"pla-talhao",
  animal→"reb-animal", lote→"cor-lote"; categoria→"plano"; fornecedor→"cadastros"). `entidadeId` = o `id`
  (String) que o cockpit do módulo usa.
- Pura `mapear*` + teste do shape/cap. Sem novo schema (reusa modelos existentes).

## Client
1. `client/src/lib/searchIndex.ts` — adicionar `type ResultadoBusca` (espelha o backend). Manter `buscar()` (nav estática).
2. `client/src/components/CommandPalette.tsx` — quando query ≥2 chars, **debounce ~200ms** e `fetch("/api/busca?q=")`;
   **mescla** os resultados de entidade (agrupados por `grupo`: Talhões/Animais/Lotes/Categorias/Fornecedores)
   com os resultados de navegação estática (nav primeiro, entidades depois). Spinner discreto durante o fetch.
   Navegação por teclado atravessa o conjunto combinado. Estado de "buscando…" e "sem resultado".
3. **Deep-link (fiação):**
   - `App.tsx` — `const [deepLink, setDeepLink] = useState<{tab:Tab; id:string}|null>(null)`. O `onNav` do palette
     vira `onNav(tab, entidadeId?)`: `setTab(tab)`; se `entidadeId`, `setDeepLink({tab, id:entidadeId})`.
     Passa `abrirId={deepLink && mesmoModulo(deepLink.tab, tab) ? deepLink.id : undefined}` ao `*Content`;
     limpa o deepLink quando consumido.
   - `RebanhoContent`/`PlantioContent`/`PlantelContent` — nova prop `abrirId?: string`; `useEffect([abrirId])`
     abre o cockpit daquele id (reusa o padrão `proximo*Ref`/`setAnimalId`/`setTalhaoId`/`setLoteId` já existente).
   - `CommandPalette` prop `onNav` vira `(tab, entidadeId?) => void`.

## Permissão
A busca de entidade só aparece pros módulos que o usuário pode ver (mesmo `podeVer` do palette). Abas de
módulo (reb-/pla-/cor-) já são sempre visíveis.

## Não-objetivos
- Prefixos de escopo ("talhão:"). Histórico de buscas. Busca em lançamentos individuais (só categorias/fornecedores por ora).

## Testes
- `busca.test.ts` (backend) — a montagem/cap/mapeamento (pure).
- `searchIndex`/palette — o merge nav+entidades e o deep-link (smoke).

## Verificação
- tsc + vitest + build; browser — ⌘K, digitar "CATARINA"→animal→Enter abre o cockpit da CATARINA; "CAF-01"→talhão;
  debounce ok, sem erro de console, permissão respeitada, sem regressão no palette de navegação.
