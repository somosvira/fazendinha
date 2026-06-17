# Fatia 12 — Importar o rebanho real do Ideagri — Design

**Data:** 2026-06-17
**Status:** aprovado no brainstorming (usuário: "podemos substituir os animais da demonstração, sem problemas").
**Origem:** o custo/litro precisa de produção em **escala real**. O Excel financeiro não tem litros/rebanho; a produção real está no **Ideagri** (`DADOS777.FDB`: 892 animais, 163 vacas com controle, 1.621 controles de leite). **Depende de:** schema rebanho existente.

---

## 1. Objetivo

Substituir o **seed de demonstração (8 vacas)** pelo **rebanho real do Ideagri**: animais reais + resumo (produção/reprodução, dos read-models) + histórico de controles de leite. O módulo passa a refletir a fazenda real e destrava a Fatia 13 (custo/litro real).

## 2. Pipeline (igual ao financeiro: extração → JSON → importador)
Como o **controller** tem acesso ao Firebird do Ideagri (Windows isql via WSL) e o subagente **não**, o controller **produz e commita** `server/prisma/rebanho_real.json`; o subagente escreve o **importador Prisma** que consome o JSON. Espelha `scripts/extract_rio_novo.py` → `server/prisma/rio_novo.json` → `import.ts`.

## 3. Mapeamento Ideagri → nosso schema (verificado)

**ANIMAL → `Animal`** (pula `CDANIMAL=999999`/"DESCONHECIDO"):
- `NUMERO` → `numero`; `NOME` → `nome` (null se vazio); `SEXO` (F/M) → `sexo`; `DTNASCIMENTO`→`dataNascimento`; `DTENTFAZENDA`→`dataEntrada` (fallback nascimento/hoje); `BRINCOELETRONICO`→`brincoEletronico`; `SISBOV`→`sisbov`; `NUMPARTOENTRADA`→`numPartosEntrada` (0 se null); `STATUS` (1=ATIVO; senão BAIXADO) + `DTBAIXA`→`status`/`dataBaixa`; `CDSETOR`→`setor` (nome via tabela `SETOR`); raça via `CDPELAGEM`/`TIPORACA` → `raca` (nome; default "Girolando" se ausente).
- **`CDCATEGORIA` → `CategoriaAnimal`:** 7 Vaca→VACA · 6 Novilha→NOVILHA · 2 Reprodutor/3 Boi carreiro/4 Rufião→TOURO · 1/5 Em crescimento→ (sexo F→BEZERRA, M→BEZERRO). (Tabela `CATEGORIA` confirmada.)

**ANIMALINFO_PRODUCAO → `ResumoAnimal` (produção):**
- `ORDEMLACTACAO`→`ordemLactacao`; `MEDIAPRODLACATUAL` (ou `PRODUCAOMEDIA7D`)→`producaoMediaDia`; `PRODUCAO305ULTLAC`→`producao305` (int); `ULTCCSLACATUAL`→`ccs`; `DTPREVISTASECAGEM`→`previsaoSecagem`.
- **DEL + em-lactação:** `DTINICIOULTLAC` = início da lactação atual. Se há lactação **aberta** (existe `DTINICIOULTLAC` e não há `DTULTSECAGEM > DTINICIOULTLAC`): cria `Lactacao` aberta (dtInicio = DTINICIOULTLAC, dtFim null) e `del = dias(DTINICIOULTLAC → hoje)`. Senão `del = null` (seca/novilha). "Vacas em lactação" = `del != null`.

**ANIMALINFO_REPRODUCAO → `ResumoAnimal` (reprodução):**
- `DTULTDG`→`ultimoDgData`; `RESULTADOULTDG` (P/N) → `ultimoDgResultado` ("positivo"/"negativo"); `IEPPROJETADO`→`iepProjetado` (se plausível); `DTPREVPARTO` → gestação (`diasGestacao` = dias(concepção→hoje) se prenhe); `statusReprodutivo` derivado: `RESULTADOULTDG=P` → PRENHE; senão se DEL < 60 → PEV; senão VAZIA (INSEMINADA se houver tentativa recente sem DG). (Heurística simples; refino deferido.)

**LEITE → `ControleLeiteiro`:** `CDANIMAL`(→numero) `DTLEITE`→`data`, `PESO1/2/3`→peso1/2/3, `PESOTOTAL`→`pesoTotal`. (1.621 linhas.)

**Lotes:** `Grupo` por `CDSETOR`/lote (nome). Se o Ideagri não der lote claro, agrupar por categoria/produção (ex.: "Alta/Média Produção", "Secas", "Novilhas") — manter os grupos que o Estoque/Nutrição já usam por nome quando possível.

## 4. Forma do JSON (`server/prisma/rebanho_real.json`)
```json
{
  "geradoEm": "2026-06-17",
  "animais": [
    { "numero": "1234", "nome": "Jurema", "sexo": "F", "categoria": "VACA",
      "dataNascimento": "2020-03-11", "dataEntrada": "2020-03-11", "brincoEletronico": null,
      "sisbov": null, "numPartosEntrada": 2, "status": "ATIVO", "dataBaixa": null,
      "setor": "Galpão 2", "raca": "Girolando", "grupo": "Alta Produção",
      "resumo": { "statusReprodutivo": "PRENHE", "del": 145, "ordemLactacao": 3,
                  "producaoMediaDia": 28.0, "producao305": 8900, "ccs": 512,
                  "ultimoDgData": "2026-05-27", "ultimoDgResultado": "positivo",
                  "iepProjetado": 396, "diasGestacao": 49, "previsaoSecagem": "2026-12-23",
                  "lactacaoAberta": { "dtInicio": "2026-01-22" } } },
  ],
  "controles": [ { "numero": "1234", "data": "2026-05-11", "peso1": 10, "peso2": 9, "peso3": 9, "pesoTotal": 28 } ]
}
```

## 5. Importador (`server/prisma/import-rebanho.ts`)
Idempotente, transacional-por-blocos:
1. **Limpa o rebanho atual:** `controleLeiteiro/eventoReprodutivo/eventoSanitario/lactacao/resumoAnimal/producaoLote.deleteMany({})` e `animal.deleteMany({})` (cascatas cuidam dos filhos). **Não toca** em `Produto`/`MovimentoEstoque`/`Lancamento`/`Dieta` (mas `MovimentoEstoque.grupoId`/`ProducaoLote.grupoId` referenciam `Grupo` — recriar grupos por nome e re-vincular, ou limpar producaoLote). Detalhe no plano.
2. **Upsert `Raca`/`Grupo`** por nome (a partir do JSON).
3. **Insere `Animal`** + `ResumoAnimal` + `Lactacao` aberta (quando houver) + `ControleLeiteiro`. Mapeia `maeId`/`paiId` numa 2ª passada (por número) — opcional, deferir se complexo.
4. Script `seed:rebanho:real` (e/ou substitui o `seed-rebanho.ts` demo). O seed de **produtos/estoque** (Fatia 8/9) roda **depois**, re-vinculando grupos por nome.

## 6. Testes / verificação
- O importador é Prisma puro (pouca lógica). Teste: rodar o import, conferir contagens (ex.: `animal.count()` ≈ N real; vacas em lactação > 0; controles > 1000) e que um animal real conhecido (ex.: CATARINA) tem produção. Idempotente (rodar 2×).
- Navegador: aba Animal mostra o rebanho real (centenas), Produção mostra ranking real, Dashboard reflete os números reais.

## 7. Decisões deferidas
- Timeline de eventos reprodutivos/sanitários por animal (hoje só o resumo agregado dos read-models) · genealogia mãe/pai completa · refino do statusReprodutivo · **Fatia 13: custo/litro real** (com a produção real, custeio leite ÷ litros) · multi-tenant.
