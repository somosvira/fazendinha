# IA — Camada de consulta semântica por domínio

> Design de referência (item 2: "IA cruzar dados de forma livre"). Aterrado no schema
> real (`server/prisma/schema.prisma`) e no padrão de tools existente
> (`server/src/services/bot/tools.ts`). **Este doc é o alvo; o motor pode estar sendo
> implementado em paralelo — ver §10 (coordenação).**

## 1. Objetivo e princípios

A IA precisa cruzar dados livremente (qualquer agrupamento / filtro / comparação / join
dentro de um assunto) com **100% de correção**, e **nunca inventar nem calcular na cabeça**.

Duas abordagens que NÃO servem sozinhas:
- **`consulta_sql` (genérico total)** — a IA escreve SQL na mão: erra join, inventa coluna,
  esquece o regime de caixa. É a "limitação da genericidade".
- **16 tools curadas (fixo)** — corretas, mas cada uma cobre uma pergunta só; não dá pra
  cruzar arbitrariamente.

**Solução:** uma camada semântica **instrumentada por domínio** (financeiro, rebanho,
plantio, corte, …). A IA preenche um **query-spec estruturado**; um **motor determinístico**
valida cada campo contra o **catálogo do domínio** e monta a query no banco.

**Regras de ouro:**
1. A IA só escolhe medidas/dimensões/filtros de uma lista declarada — **nunca escreve SQL**.
2. Toda agregação roda **no Postgres** (Decimal) — a IA **nunca soma/média na cabeça**.
3. Se o pedido **não for expressável** pelo catálogo, o motor **recusa** e a IA responde
   "não consigo fazer esse cruzamento com os dados disponíveis" — **nunca aproxima**.

É "genérico o suficiente" (cruzamento livre) mas "repetido por domínio" (joins e colunas
pré-validados = sem os furos da genericidade).

## 2. O query-spec (o que a IA preenche)

```ts
interface QuerySpec {
  medidas: Medida[];                 // o que agregar (>=1). Ex.: soma de valor
  dimensoes?: string[];              // group-by (nomes lógicos do catálogo)
  filtros?: Filtro[];                // where
  periodo?: { campo: string; de?: string; ate?: string };  // atalho de data (YYYY-MM-DD)
  ordenar?: { por: string; dir: "asc" | "desc" };
  limite?: number;                   // default 50, teto 500
}
interface Medida { agg: "sum"|"avg"|"count"|"countDistinct"|"min"|"max"; campo?: string; rotulo?: string; }
interface Filtro { campo: string; op: "="|"!="|">"|">="|"<"|"<="|"contains"|"in"|"between"; valor: unknown; }
```

Todo `campo` / `dimensao` / `medida.campo` **DEVE** existir no catálogo do domínio; senão
o motor retorna `{ erro }` (e a IA recusa, conforme regra 3).

## 3. O catálogo por domínio (a instrumentação "pronta, independente dos parâmetros")

Cada domínio declara, uma vez, sua tabela-fato, medidas, dimensões (coluna direta OU join
pré-definido) e o regime padrão:

```ts
interface Dominio {
  nome: string;                      // "financeiro"
  fato: string;                      // modelo Prisma base, ex.: "lancamento"
  regimePadrao?: Record<string, unknown>;  // where sempre-aplicado (ex.: caixa)
  medidas: Record<string, { coluna: string; aggs: Medida["agg"][] }>;
  dimensoes: Record<string, DimSpec>;      // nome lógico -> como resolver
  filtros: Record<string, { coluna: string; via?: Join }>;  // colunas filtráveis
}
type DimSpec =
  | { coluna: string }                               // coluna direta (inclui enums)
  | { via: Join; coluna: string }                    // via join declarado
  | { bucket: "mes" | "ano" | "dia"; coluna: string }; // bucket de data
```

**Fonte de verdade:** o catálogo deve espelhar os serviços de agregação já existentes
(`src/services/dashboard.ts`, `src/services/rebanho/dashboard.agg.ts`, `corte/custo.ts`,
`plantio/custo-operacional.ts`, `ponto/folha.service.ts`) para bater **bit-a-bit** com as telas.

## 4. Catálogos concretos (extraídos do schema real)

### financeiro — fato `Lancamento` (`schema.prisma:189-231`)
- **regimePadrao:** `{ situacao: LIQUIDADO, estornado: false }`, data de corte = `dataLiquidacao`
  (regime de caixa). *(Projeção/"a vencer" = variante com `situacao: ABERTO` por `dataVencimento`.)*
- **medidas:** `valor` (sum/avg/min/max), `count`.
- **dimensões:** `categoria` (join Categoria.nome), `grupo` (Categoria.grupoCategoria.nome),
  `centroCusto` (CentroCusto.nome), `conta` (ContaBancaria.nome), `fornecedor`
  (ClienteFornecedor.nome), `natureza` (enum), `classificacao` (Categoria.classificacao =
  CUSTEIO/INVESTIMENTO), `propriedade`, `mes`/`ano` (bucket de qualquer das 3 datas).
- **exclusão padrão:** `centroCusto != "(Sem centro de custo)"` quando não filtrado (igual à tela).

### rebanho — fatos `ControleLeiteiro` e `ProducaoLote`
- `ControleLeiteiro` (`:280-294`): medida `pesoTotal` (kg/dia por animal); dims `animal`,
  `raca`/`grupo`/`categoria`/`status` (via Animal), `mes`/`dia` (`data`).
- `ProducaoLote` (`:297-309`): medida `litros`; dims `grupo`, `mes`.
- `ResumoAnimal` (`:479-496`) como fato de indicadores: medidas `producaoMediaDia`, `ccs`,
  `del`, `iepProjetado`; dims via Animal (raca/grupo/statusReprodutivo).
- Custo: `MovimentoEstoque` (`:603-634`) medidas `quantidade`/`valorTotal`; dims produto/tipo/grupo.

### plantio (café) — fato `PassadaColheita` (`:1051-1073`)
- medidas `sacasBeneficiadas`, `litrosCereja`, `rendimentoLPorSc`; dims `talhao`, `lavoura`,
  `variedade`, `safra`, `metodo`, `mes`.
- `SafraTalhao` (`:922-938`): medidas `sacasTotal`/`sacasPorHa`; `TarefaAgricola` (`:1113`):
  custo `custoPrev/custoReal`; `ResumoTalhao` indicadores (produtividade, ferrugem, solo).

### corte — fatos `PesagemLote` e `OperacaoComercial`
- `PesagemLote` (`:1372-1387`): medidas `pesoMedio`, `pesoTotal`, `gmdDesdeUltima`; dims
  `lote`, `piquete`/`categoria`/`fase` (via LoteCorte), `mes`.
- `OperacaoComercial` (`:1430-1449`): medidas `arrobas`, `receitaTotal`, `precoArroba`.

### cultivo/milho, equipe/ponto, caixinha
- `LancamentoCusto` (`:1695`) `valor`; `ProducaoCultivo` (`:1720`) `quantidade`; `Silo` saldo.
- `Funcionario.salarioMensal` + `RegistroPonto` (folha/horas).
- `MovimentoCaixinha.valor`.

### Ponte cross-domain (importante)
Quase todo custo operacional carrega `lancamentoId?` de volta pro `Lancamento`
(`MovimentoEstoque:621`, `OperacaoAgricola:964`, `ManejoSanitario:1404`,
`OperacaoComercial:1444`, `LancamentoCusto:1711`). O financeiro é a espinha compartilhada —
cruzamentos "custo do rebanho no financeiro" saem por essa FK, mas **cada tool fica no seu
domínio**; cross-domain fica pro `consulta_sql` (último recurso).

## 5. O motor (spec → Prisma), determinístico

1. **Valida** o spec contra o catálogo (medida/dimensão/filtro existem; agg permitido). Falhou → `{ erro }`.
2. **Monta o `where`** com um builder genérico — **generalizar o `aplicarDimensoes`/`whereLancamento`
   já existente** (`tools.ts:58-133`), aplicando `regimePadrao` + filtros do spec (contains
   insensitive, in, between, comparadores).
3. **Agrega no banco** com `prisma[fato].groupBy({ by: [dims], _sum/_avg/_count/_min/_max, where,
   orderBy, take })` — exatamente como `gastosPorCategoria` (`tools.ts:315`) já faz.
4. **Resolve joins/labels** por lookup dos ids (findMany dos nomes), como o mapa de categoria
   naquele mesmo tool.
5. **Decimais:** mantém `Decimal` no groupBy; `jsonSafe`/`num` (`serialize.ts`) só na saída.
6. **Buckets de mês/ano:** `groupBy` do Prisma não faz `date_trunc`. Para dimensão de data o
   motor usa um `$queryRaw` **montado por ele mesmo** (parametrizado, sem input livre da IA) —
   determinístico e seguro (não é a classe de risco do `consulta_sql`).
7. Retorna `{ linhas, totalGeral?, specAplicado }` — inclui o spec aplicado pra IA citar o recorte.

## 6. Exposição pro bot

- **Um tool por domínio:** `consultar_financeiro`, `consultar_rebanho`, `consultar_plantio`,
  `consultar_corte` (+ cultivo/equipe/caixinha depois). Mesma forma `fn(name, desc, parameters)`
  (`tools.ts:208`); registrar no array `TOOLS` (`:853`).
- O `parameters` (JSON Schema) de cada tool **injeta a lista de medidas/dimensões/filtros
  válidos daquele domínio** — a IA vê exatamente o que pode pedir (menos alucinação).
- **System prompt:** "Para agrupar/cruzar/comparar dados de um assunto, use
  `consultar_<domínio>` — nunca calcule você mesmo; se não der pra expressar, diga que não faz."
- `consulta_sql` **permanece** só como último recurso (cross-domain exótico).

## 7. Garantias de correção (o "100% correto, sem inventar")

| Risco | Como a camada elimina |
|---|---|
| Coluna/tabela inventada | Só nomes do catálogo; fora dele → recusa |
| Join errado | Joins pré-declarados no domínio |
| Erro de float em dinheiro | Agregação em `Decimal` no Postgres; `jsonSafe` só na borda |
| Divergir da tela | Catálogo espelha os serviços de agregação existentes + regime de caixa |
| SQL malicioso/livre | Não há free-text SQL (some a classe de risco do `consulta_sql`) |
| Alucinar quando não sabe | Motor devolve `{erro}`; regra de prompt manda recusar |

## 8. Rollout

1. **Piloto: financeiro** (mais dado real + tools existentes pra validar). Teste de equivalência:
   `consultar_financeiro` deve **reproduzir** `gastos_por_categoria`, `serie_mensal` e
   `resumo_financeiro` (mesmos números) — se bater, o motor está correto.
2. **rebanho** (631 animais reais agora no staging), depois **corte** e **plantio**.
3. Cada domínio entra como um catálogo novo + 1 tool; o motor é o mesmo.

## 9. Reuso (não reinventar)

- Generalizar `aplicarDimensoes`/`whereLancamento`/`whereAberto` + `PROPS_FILTRO` (`tools.ts:58-206`).
- `jsonSafe` (`serialize.ts`), `num`/`round2`/`estatisticas` (`tools.ts:21-42`).
- Espelhar `dashboard.ts` e os `*/dashboard.agg.ts` / `custo*.ts` por domínio como fonte de verdade.

## 10. Coordenação / estrutura de arquivos sugerida

Para não colidir com o motor sendo editado em paralelo, sugiro arquivos **novos**:

```
server/src/services/bot/consulta/
  spec.ts        # tipos QuerySpec/Medida/Filtro + validação pura (testável, sem I/O)
  motor.ts       # spec + catálogo -> Prisma groupBy / $queryRaw de bucket
  catalogo.ts    # tipos Dominio/DimSpec + registry
  dominios/
    financeiro.ts
    rebanho.ts
    plantio.ts
    corte.ts
  tools.ts       # gera os specs consultar_<dominio> a partir dos catálogos
```

**Único ponto de colisão inevitável:** registrar os novos tools no array `TOOLS` de
`server/src/services/bot/tools.ts` e a instrução no system prompt (`agent.ts`) — alinhar com
quem estiver editando o motor antes de mexer nesses dois arquivos.
