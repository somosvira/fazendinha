# Reprodução — Paridade funcional total com o IDEAGRI — Design

**Data:** 2026-07-26
**Branch:** `feat/reproducao-iatf-execucao` (3 commits à frente da `main`)
**Contrato de aceite:** [`docs/design/reproducao-paridade-ideagri.md`](../../design/reproducao-paridade-ideagri.md)
**Catálogo/gaps:** [`docs/design/ideagri-catalogo-features.md`](../../design/ideagri-catalogo-features.md) · [`docs/design/ideagri-gaps.md`](../../design/ideagri-gaps.md)
**Handoff do checkpoint:** [`docs/HANDOFF-reproducao-2026-07-24.md`](../../HANDOFF-reproducao-2026-07-24.md)
**Status:** aprovado no brainstorming (usuário: "pode fazer tudo até acabar; não precisa perguntar").

---

## 1. Objetivo

Fechar **todas as 14 linhas** da matriz de aceite do contrato de paridade reprodutiva, preservando a interface moderna do produto. Cada linha só vira `✅` (ou `N/A` explicitamente aprovado) quando tem import, schema, API/regra, UI e teste/reconciliação verdes.

**Princípio de equivalência funcional (não de réplica de tela):** o Fazendinha é web/cloud. Fluxos que no IDEAGRI existem só por causa da arquitetura desktop (sincronização por "Receber Coletas"/"Receber Dados IATF") **não são copiados** — o equivalente é o próprio fluxo web, com origem/auditoria e import idempotente do histórico legado. Essas duas telas são encerradas como **N/A arquitetural justificado** no aceite (decisão do usuário, 2026-07-26).

**Fora de escopo (permanece):** financeiro (fonte é o Excel real), seção 11 do catálogo (encanamento interno), e as duas features grandes já marcadas fora de escopo (construtor de relatórios; ABCZ).

## 2. Estado do checkpoint (baseline verificado 2026-07-26)

Verde: 21 testes de extração + 71 de serviço/rota + 11 de worklist client; `pnpm build` exit 0. Fixture `rebanho_real.json` reimportado: 3.234 eventos com `ideagriId` único (832 IA · 61 cobertura · 146 TE · 1.843 DG · 352 partos), tipos separados.

Já entregue: escopo multi-propriedade da reprodução; worklists canônicas; separação IA/cobertura/TE no import com reconciliação 1:1; parto com 7 tipos + 4 auxílios + crias vivas/natimortas (aborto não abre lactação); execução individual das etapas IATF (`ExecucaoEtapaIATF`: feita/pulada/reaberta) + dimensões CIDR/estímulo/perda de implante.

## 3. Arquitetura e convenções transversais

Mesmo pipeline do módulo: **rota fina (`routes/rebanho/`) → service (`services/rebanho/`) → cálculo puro (`*.calc.ts`) + mappers (`*.mappers.ts`) + schemas (`*.schemas.ts`)**, cada cálculo com teste TDD. Regras invariantes:

- **Escopo de propriedade** em toda leitura/escrita via `resolverEscopoLeitura/Escrita(c)`; cadastros operacionais escopados por sítio, **dicionários oficiais reutilizáveis compartilhados** (`propriedadeId null`), seguindo o padrão de `catalogoNoEscopo`.
- **Identidade de origem por entidade** (`ideagri<Entidade>Id Int? @unique`) → **import idempotente** (upsert por origem) + trilha; código de tipo desconhecido **falha** o import (nunca colapsa em outro tipo). Espelha a decisão já tomada em `EventoReprodutivo.ideagriId`.
- **Decimal** via Prisma Decimal → `Number()` só na borda (mappers). Datas `@db.Date` gravadas de `new Date("YYYY-MM-DDT00:00:00Z")`.
- **Sync de schema:** `db push` em dev/prod; migration aditiva por fatia (ADD COLUMN/CREATE TABLE idempotente + backfill), como as migrations 20260724*.
- **Extração reproduzível:** cada bloco que importa dado estende `scripts/ideagri-repro-inventory.sql` (inventário: telas/colunas/contagens/dicionários) e `scripts/rebanho-dump.sql` (dado real) → `scripts/build-rebanho-json.mjs` (com teste `.test.mjs`) → `server/prisma/import-rebanho.ts`. Contagens do baseline validadas na reconciliação.
- **Gate por bloco:** um bloco só começa depois do anterior verde (unit + route/client + build). Blocos = PRs verificáveis.

## 4. Os seis blocos

### Bloco A — IATF/TETF operacional completo
Fecha as linhas *Protocolo/programação IATF/TETF* e *Execução/sincronização IATF*, mais os 6 itens de continuação do handoff.

- **Execução coletiva do lote:** rota que aplica um `status` (CONCLUIDA/PULADA/PENDENTE) a uma etapa (`dia+ordem`) para os animais selecionados de uma programação, com exceções individuais. Cálculo puro decide, por animal, quais `ExecucaoEtapaIATF` casam a etapa; parcial não falha o lote (retorna aplicados/ignorados).
- **Formulário operacional completo:** UI de aplicação/execução expõe `usoCidr`, `estimulo`, `perdaImplante`, `produto`, `dose`, `observacao` (backend já aceita; hoje os botões mandam só status+data).
- **Resumo real do lote:** DTO do lote agrega os status reais das execuções dos animais (concluídas/puladas/pendentes/atrasadas + próxima etapa), substituindo o progresso por data planejada. Cálculo puro sobre as execuções.
- **Evento de IA idempotente:** concluir a etapa de inseminação cria (ou vincula) um `EventoReprodutivo` INSEMINACAO com `origemExecucaoId` único → sem duplicidade em reexecução; reabrir/repor remove/reconcilia o vínculo.
- **TETF:** protocolo/execução ganham `finalidade` (IATF|TETF); TETF encadeia a etapa terminal de transferência de embrião em vez de IA (sem quebrar IATF puro).
- **Import/reconciliação:** `PROTOCOLOIATF` (5) + `PROTOCOLOIATFPRINCIPIOATIVO` (31) → catálogo com princípios/produtos/doses/dias/uso; `PROGRAMACAOIATF` (74) + `PROGRAMACAOIATFASSOCIACAO` (466) → programações + aplicações por animal com dimensões (implante/perda/estímulo/CIDR, datas/horas de implante e retirada, responsável, janela, setor, tipo, sigla). Reconciliação por contagem 5/31/74/466.

Schema: `ProtocoloIATF`/`EtapaProtocoloIATF` ganham `ideagriId`, `finalidade`, e `PrincipioProtocoloIATF` (princípio, produto, dose, dia, uso). `ProgramacaoIATFLote` e `AplicacaoProtocoloIATF` ganham `ideagriId` + campos de dimensão. `EventoReprodutivo` ganha `origemExecucaoId Int? @unique`.

### Bloco B — Ciclo reprodutivo básico completo
Fecha *Aptidão de novilhas* e *DG/exame ginecológico*, e completa o *Parto*.

- **Aptidão:** modelo `AptidaoAnimal` (data, apta/inapta, motivo, origem MANUAL|AUTOMATICA) + regra de aptidão automática de novilhas (idade/peso/parâmetros — `frmAptidaoAutomatica`), com a **mesma lista** de candidatas do IDEAGRI e efeito de estado; lançamento manual equivalente (`frmLancarAptidaoAnimal`). PEV deixa de ser só derivado.
- **DG/exame ginecológico:** dicionário oficial `ResultadoExameGinecologico` importado com os **44 resultados** por útero/ovário (`NOMERESUMIDO`/`NOMECOMPLETO`/`TIPO`/`PADRAO`) — sem reduzir a 9. O evento `EXAME_GINECOLOGICO` passa a referenciar o resultado oficial (mantendo os achados condensados como *view* derivada para as worklists). Import de `EXAMEANIMAL` (248). DG (1.843) completa campos/métodos e valida efeito de estado.
- **Parto → crias:** ao registrar PARTO com crias vivas, criar (ou permitir vincular) o `Animal` cria com genealogia (mãe = paridora; na TE, mãe genética = doadora), categoria de bezerro e transição de lactação; aborto/natimorto não criam animal e alimentam a taxa Embrapa. Reconciliação: 352 partos por tipo.

### Bloco C — Sêmen e genética estruturados
Fecha *Reprodutor/sêmen/genética*.

- **Biblioteca de reprodutores:** importar os 67 `ANIMALINFO_REPRODUTOR` com **todos os indicadores usados**, não só 4 PTAs. Catálogo genético flexível: `IndicadorGenetico` (271) + `ValorIndicadorReprodutor` (N:N reprodutor↔indicador) + `MarcadorGenetico` (20) + `Caseina` (15) + `PedigreeReprodutor`. Os 4 PTAs atuais viram *derivações* de indicadores conhecidos (retrocompat da UI de ranking).
- **Sêmen:** `TipoSemen` (3) + `EstoqueSemen` (dose/lote/localização) + associação sêmen↔reprodutor (`frmAssociacaoSemen`); **baixa atômica de dose** na IA (transação: registrar IA consome dose do estoque).
- Reconciliação: 67/25/3 + 271/20/15 por contagem.

### Bloco D — Acasalamento dirigido
Fecha *Medidas/recomendação de acasalamento*.

- `MedidaAcasalamento` (medidas, tipos, combinações) + fórmulas de mérito e **restrição de consanguinidade por pedigree/endogamia** (hoje só compara texto do pai). `recomendar` puro passa a usar indicadores + pedigree; plano/ranking com restrições equivalentes ao IDEAGRI. Aceite por **casos dourados** do IDEAGRI (entrada → ranking esperado).

### Bloco E — FIV/TE e pool de doadoras
Fecha *Coleta FIV/TE* e *Pool de doadoras*.

- `Coleta` (doadora, reprodutor(es), técnico, fertilização, data), `OocitoColeta` (qualidade/viabilidade), `EmbriaoColeta` (estágio mórula→blastocisto eclodido, viável/inviável) com o dicionário `EmbriaoClassificacao` (6) importado. Vínculo do embrião → evento TE existente (`ideagriEmbriaoId`). `GrupoPoolDoadora` (agrupamento FIV) + aplicação. 777 está vazio em pool → validado por **fixture**. Reconciliação: 7 coletas + estágios.

### Bloco F — Relatórios, reconciliação e aceite
Fecha *Relatórios reprodutivos/IATF* e sela o gate de 100%.

- Relatórios equivalentes (taxa de concepção por estímulo/CIDR/ordem de IA, eficiência reprodutiva) com **mesmos numeradores/denominadores e períodos** — reusa `indicadores-embrapa.agg`.
- **Reconciliação final:** script que confere contagens por tipo e por animal contra o baseline; divergência sem explicação = falha.
- **"Receber coletas"/"Receber dados IATF":** registrados como **N/A arquitetural** no contrato, com o fluxo web (import idempotente + lançamento/execução web) demonstrado como o equivalente.
- Atualização de `ideagri-catalogo-features.md` + `ideagri-gaps.md` + a matriz do contrato para `✅`/`N/A`.
- Gate: unit + integração DB/API + **browser E2E** dos fluxos (IA/cobrição, DG, IATF/TETF, TE/FIV, parto) + build verdes.

## 5. Interfaces entre blocos (contratos)

- A→B: `EventoReprodutivo.origemExecucaoId` (IA vinda de etapa) é consumido pela reconstrução de lactação/DG sem duplicar.
- C→D: `ValorIndicadorReprodutor` + `PedigreeReprodutor` são a entrada do `recomendar` puro.
- C→E: `EstoqueSemen`/reprodutor são referenciados por `Coleta`/`EmbriaoColeta`.
- B→E: evento TE (`ideagriEmbriaoId`) liga o embrião da coleta à receptora.
- Todos→F: contagens de origem alimentam a reconciliação.

## 6. Tratamento de erros

Erros de domínio tipados por service (`code: "NAO_ENCONTRADO" | "CONFLITO" | ...`) → 404/409; Zod → 400; código de origem desconhecido no import → **abort** com mensagem. Operações compostas (IA+baixa de dose; parto+cria+lactação; execução coletiva) em **transação**: conflito estrutural aborta tudo (padrão de `ConflitoLactacaoError`). Escopo de propriedade nega acesso cruzado com `NAO_ENCONTRADO` (não vaza existência).

## 7. Testes

- **Cálculo puro (TDD):** execução coletiva; agregação de status do lote; aptidão automática; recomendação com pedigree/indicadores; classificação de embrião; reconstrução de crias/lactação no parto.
- **Import (`build-rebanho-json.test.mjs`):** parsers dos novos blocos (protocolo/programação/exame/reprodutor/indicadores/coleta) + rejeição de código desconhecido.
- **Rota/serviço (Vitest + mocks Prisma):** escopo de propriedade em cada nova operação por id; idempotência do evento de IA; baixa atômica de dose.
- **Client:** worklists/derive puros; render smoke dos formulários novos.
- **Reconciliação + browser E2E** no Bloco F.

## 8. Decisões

1. **Genética como catálogo flexível** (indicador + valor N:N), não centenas de colunas fixas — cabe os 271 indicadores sem migration por métrica; os 4 PTAs viram derivações nomeadas.
2. **Dicionário ginecológico oficial preservado (44)**; achados condensados (9) permanecem como *view* derivada só para worklists — não substituem o dado importado.
3. **Cria como Animal de verdade** no parto (não só contador) — habilita genealogia/rastreabilidade; opcional vincular animal já existente.
4. **Sincronização mobile = N/A arquitetural**; equivalente web com origem/auditoria.
5. **Ordem A→F**, cada bloco um PR verde; contratos pequenos entre blocos.

## 9. Deferidos

Integrações reais de dispositivo/mobile (colar/bastão/app), ABCZ, construtor de relatórios montáveis — permanecem fora de escopo por decisão de produto anterior.
