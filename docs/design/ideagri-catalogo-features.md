# Catálogo de features do Ideagri — roadmap de paridade

> **Ver também:** [`ideagri-gaps.md`](./ideagri-gaps.md) — a fila enxuta de lacunas (só o que falta), em checkbox, derivada deste catálogo.

**Objetivo.** Este documento cataloga **todo o sistema Ideagri** (o ERP de rebanho leiteiro Delphi/Firebird que serve de referência para o nosso módulo Rebanho e adjacentes) tela a tela, e marca o status de cada feature no **nosso** sistema. A intenção é replicar o Ideagri por completo — porém mais bonito e organizado — já que o produto será revendido a várias fazendas.

**Princípio norteador (decisão do usuário, 2026-07-14):** *não* é porque algo está vazio na fazenda 777 (Rio Novo) que a feature será descartada. Baseamo-nos em **todo o sistema Ideagri** para desenhar o nosso. "Vazio na 777" é apenas um dado de **priorização** (dá para testar com dado real agora?), nunca um critério de exclusão. As únicas features não replicadas são o **encanamento interno do próprio Ideagri** (backup, exportadores proprietários, consulta SQL etc.).

**Fontes.** Extraído da própria base do Ideagri (fazenda 777 "Sítio São Francisco"), tabelas `TELA` (≈149 telas) e `FUNCAO` (≈152 funções) — o mapa oficial de features — cruzado com a contagem de linhas de todas as 414 tabelas de usuário (survey de 2026-07-14). Como ler o Firebird: ver a memória `ideagri-data-access` e `scripts/extract-rebanho.sh`. Contagens de referência salvas no scratchpad da sessão (`ideagri_table_counts.txt`, `ideagri_telas_funcoes.txt`).

## Legenda de status

| Símbolo | Significado |
|---|---|
| ✅ | **Feito** — já existe no nosso sistema, ligado a dado real. |
| 🟡 | **Parcial** — existe mas incompleto (falta histórico, cálculo, tela dedicada ou dado importado). |
| ⬜ | **A fazer** — ainda não temos; candidato a replicar. |
| ⛔ | **N/A** — encanamento interno do Ideagri; não se replica como feature de fazenda. |

Coluna **Dado 777** indica se há dado real nesta fazenda para testar (número de linhas na tabela-fato principal), ou `vazio` quando a feature existe no Ideagri mas não é usada aqui (ainda assim replicável).

---

## 1. Rebanho — cadastro e movimentação

| Ideagri | Status | Dado 777 | Nota |
|---|---|---|---|
| Animal | ✅ | 631 | Cadastro, cockpit, baixa (≠ delete). |
| Resumo animal | ✅ | 631 | `ResumoAnimal` (espelha `ANIMALINFO_*`). |
| Setor | ✅ | 5 | Local físico; filtro na aba Animal. |
| Grupo / Tipo de grupo | ✅ | 20 | Lote de manejo (`Grupo`). |
| Movimentação entre grupos / setores / locais | 🟡 | 1504 / 289 | Temos setor/grupo por animal; falta o **fato de movimentação** (histórico de trocas — `MOVGRUPOANIMAL` 1504, `MOVSETORANIMAL` 289) no cockpit. |
| Rebanho quantitativo | 🟡 | — | Temos KPIs de efetivo no Dashboard; falta o relatório "quantitativo" clássico (por categoria/idade ao longo do tempo). |
| Alteração coletiva | ⬜ | — | Editar N animais de uma vez (bulk). Útil para operação. |
| Seleção de animais / Filtro de animais | 🟡 | 52 | Temos filtros simples; Ideagri tem um construtor de filtros salvos (`FILTRO` 52). |
| Motivo de baixa | ✅ | 78 | Já importado (`MOTIVOBAIXA`). |
| Categoria / Faixa de categoria | ✅ | — | Vaca/Novilha/Bezerra derivadas. |
| Desmama / Desaleitamento | 🟡 | — | Temos work-list "a desmamar" (parâmetro DESMAME_MODO); falta **evento/status DESMAME** no schema (hoje é proxy por categoria). |
| Identificação eletrônica / SISBOV / brinco+bastão | 🟡 | — | Busca por brinco entregue (PR #87); falta leitura por bastão RFID e SISBOV. |
| Pelagem | ✅ | — | Importado (usamos RAÇA para composição). |

## 2. Reprodução

| Ideagri | Status | Dado 777 | Nota |
|---|---|---|---|
| Inseminação / cobrição | ✅ | ~1006 | Evento INSEMINACAO; taxa de concepção (PR #94). |
| Diagnóstico reprodutivo | ✅ | ~1775 | Evento DIAGNOSTICO (P/N + parto previsto). |
| Parto | ✅ | ~338 | Evento PARTO (tipo/crias/sexo). |
| Transferência de embrião (TE) | 🟡 | — | Enum TRANSFERENCIA_EMBRIAO + doadora + `ehReceptora` (PR #94); falta fluxo/tela completa e coleta. |
| **Exame ginecológico** | ⬜ | **248** | **Fatia 2 planejada.** `EXAMEANIMAL` — exames reprodutivos por animal (útero/ovário/resultado). Enum reprodutivo precisa de `EXAME_GINECOLOGICO`; `RESULTADOEXAMEGINECOLOGICO` (44) é o dicionário de resultados. |
| Diagnóstico / Tipo resultado ex. ginecológico | ⬜ | 44 | Dicionário de resultados de exame (lookup). |
| **Programação IATF/TETF** | 🟡 | **67 + 418** | Catálogo de protocolos IATF configurável entregue (#163: D0/D7/D9/D11); falta a **programação por lote/data** (aplicar o protocolo a um lote com calendário). `PROGRAMACAOIATF` 67. |
| Protocolo hormonal | ✅ | 31 | **Entregue (#163).** Catálogo de protocolos IATF configurável com etapas D0/D7/D9/D11 e princípios ativos. |
| Estação de monta | ⬜ | vazio | Janela reprodutiva sazonal (mais usada em corte). |
| Coleta FIV / TE | ⬜ | vazio | Aspiração/coleta de óvulos; sem tabela dedicada nesta base. |
| Pool de doadoras | ⬜ | vazio | `GRUPOPOOLDOADORA` — agrupamento de doadoras FIV. |
| Recomendação de acasalamento / Medida de acasalamento / Medidas combinadas | ⬜ | vazio | Motor de cruzamento dirigido (evita consanguinidade, busca ganho genético). |
| Auxílio ao parto | ⬜ | 4 (dic.) | `AUXILIOPARTO` é dicionário (distocia); dado de parto assistido é esparso. |

## 3. Produção de leite

| Ideagri | Status | Dado 777 | Nota |
|---|---|---|---|
| Controle leiteiro | ✅ | 1621 | `ControleLeiteiro`; produção média/305/tendência. |
| Produção total de leite | ✅ | — | Modo TANQUE/TOTAL_DIARIO configurável (revenda). |
| **Produção informada na lactação** | ✅ | — | Produção por lactação no histórico (#147); curva de lactação por ciclo (#154, #158). |
| **Secagem** | ✅ | 10 | Enum SECAGEM + retorno à fila na secagem (#150); work-list "a secar" (#156). Motivo de secagem no histórico de lactações. |
| **Indução de lactação** | ⬜ | — | `LACTACAO.INDUZIDA` — flag de lactação induzida. |
| **Histórico de lactações** | ✅ | **335** | **Entregue (#146–147).** `LACTACAO`: ordem, DEL, motivo de secagem, produção por lactação. Seção Lactações no cockpit + pico/persistência (#158). |
| Análise de leite | 🟡 | 467 | `ANALISELEITE` importada como evento EXAME (CCS/gordura/proteína); falta **tela dedicada** de qualidade + tendência de CCS (parcial: tendência de CCS já no resumo). |
| Análise de tanque | ⬜ | vazio | Qualidade do leite do tanque (bulk). |
| Tanque | ⬜ | vazio | Cadastro/gestão de tanques de resfriamento. |
| CMT (mastite subclínica) | ✅ | — | **Entregue (#168).** CMT por quarto (AE/AD/PE/PD): entrada rápida das 4 tetas + mapa de úbere + detecção de quarto crônico → sugestão de secar/tratar. |
| Correção 305 / idade adulta / produção total | ✅ | 351/183/70 | **Entregue (#151–152).** `CORRECAO305` — usa a correção oficial (não mais estimativa linear) e agrega no resumo de lactações. |

## 4. Sanidade

| Ideagri | Status | Dado 777 | Nota |
|---|---|---|---|
| Aplicação (produto) | ✅ | 3257 | Evento APLICACAO/VACINA; custo de sanidade (rateio + exato). |
| Doença / Tipo de doença | ✅ | 339 / 38 | Evento OCORRENCIA (`DOENCAANIMAL`). |
| Mastite / Tratamento Mastite / CMT | ✅ | 24 | **Entregue (#168).** `ExameQuarto` por teta (AE/AD/PE/PD): CMT subclínico + episódio clínico + quarto perdido; cronicidade por quarto → sugestão de secar/tratar. Evento MASTITE legado permanece read-only. |
| Exame / Tipo de exame | 🟡 | 248 | `EXAMEANIMAL` — análise de leite + exame por quarto entram; ginecológico ainda pendente (Fatia 2). |
| Protocolo sanitário / Aplicação protocolo sanitário | ⬜ | 9 cat. / 0 | Catálogo de 9 protocolos existe; **aplicações por animal = 0** (sem dado real). Replicar como cadastro + calendário. |
| Agenda de eventos / Agenda de sanidade | 🟡 | vazio | Vacinação agendada com lembrete por data (#160). Falta o calendário unificado de todos os manejos futuros (exames, protocolos) → work-lists. |
| Escore de teto | 🟡 | vazio | Estado por quarto (sadio/ativo/crônico/perdido) já modela saúde de úbere (#168); falta o escore de teto formal (hiperqueratose). |
| Correlação de microrganismos | ✅ | 48 | `MICROORGANISMO` importado (via mastite). |
| Tratamento base | ⬜ | 13 | `TRATAMENTOBASE` — protocolos de tratamento padrão. |

## 5. Nutrição

| Ideagri | Status | Dado 777 | Nota |
|---|---|---|---|
| Dieta | ✅ | 0 (Ideagri) | Temos `Dieta` + `DietaItem` + consumo→estoque (PR #97). Ideagri está vazio aqui — **nosso é mais completo**. |
| Alocação para dietas / Alocação de lote | 🟡 | 0 | Temos dieta por lote; Ideagri tem critérios de alocação automática (`ALOCACAOCRITERIO`). |
| Alimentação do lote | 🟡 | 0 | Consumo por lote entregue via ConsumoPeriodo. |
| Nutriente | ✅ | 32 | Macros nutricionais na `Dieta`. |
| Ajuste de U.A. referência | ⬜ | — | Unidade animal de referência (conversão de lotação). |

## 6. Genética e melhoramento

| Ideagri | Status | Dado 777 | Nota |
|---|---|---|---|
| Composição racial | ✅ | 132 | Importado (`ANIMALINFO_CADASTRO.RACA`). |
| Grau de cruzamento | ⬜ | 32 | `GRAUCRUZAMENTO` — grau sangue Holandês/Gir etc. Complementa composição racial. |
| Associação de raça / Raça / Raça ABCZ | 🟡 | 111 / 65 | Cadastro de raças existe; falta o cruzamento ABCZ. |
| Biblioteca de reprodutores | ⬜ | 65 | `ANIMALINFO_REPRODUTOR` — catálogo de touros com índices. Base para recomendação de acasalamento. |
| Catálogo de índices genéticos | ⬜ | 271 | `GENCATALOGOINDICADOR` 271, `GENCATALOGOMARCADOR` 20, `GENCATALOGOCASEINA` 15 — PTAs/índices genômicos e caseína. |
| Central de sêmen / Tipo de sêmen / Associação de sêmen | ⬜ | 25 | `CENTRALSEMEN` 25 — estoque/origem de sêmen. Base para reprodução. |
| Consulta de animais — ABCZ / Comunicação ABCZ | ⬜ | — | Integração com associação de raça (registro genealógico). |
| Genealogia | ✅ | — | Mãe/pai no cockpit (PR #48). |

## 7. Financeiro (Ideagri) — **fonte é o nosso app, não o Ideagri**

O financeiro do Ideagri (`MOVIMENTO` 380, `NOTA` 205, `CONTAGERENCIAL` 202) **não** será importado — a nossa fonte financeira é o Excel real do BPO (6.704 lançamentos no Neon), muito mais completa. Estas telas ficam como referência de **UX/organização**, não de dado.

| Ideagri | Status | Nota |
|---|---|---|
| Conta gerencial / Grupos de conta gerencial | ✅ | Nosso plano de contas (`Categoria`/`GrupoCategoria`) é o equivalente, do Excel real. |
| Receitas / Despesas / Receitas-Despesas simplificadas | ✅ | Aba Gastos + Lançar. |
| Conta corrente / Posição financeira geral | 🟡 | Temos DRE/timeline; "posição financeira" consolidada é candidata. |
| Centro de custos / Centro de negócio | ✅ | `CentroCusto` (Leite/Café/Investimento). |
| Planejamento orçamentário | ⬜ | vazio no Ideagri. Orçamento previsto×realizado — candidato (temos previsto×realizado no Plantio). |
| Liberação de despesas previstas | ⬜ | Aprovação de despesa. Ligado a contas a vencer (PR #84). |
| Avaliação financeira de rebanho | ⬜ | Valor do rebanho como ativo (arroba × cabeças). Já fazemos "valor biológico" no corte. |
| Distribuição de valor investido | ⬜ | Rateio de investimento entre atividades. |
| Cotação de compra / Controle de pedidos / Ordem de entrada-saída / Efetivar pedido | ⬜ | Módulo de compras (cotação→pedido→nota). Grande, sem dado real. |
| Patrimônio / Manutenção de patrimônio / Amortização | ⬜ | vazio. Ativos imobilizados + depreciação. |
| Transferência bancária / Banco | ✅/⬜ | `ContaBancaria` existe; transferência entre contas é candidata. |
| Caixinha (petty cash) | ✅ | Nosso, não do Ideagri (PR #81). |

## 8. Produto, estoque e insumos

| Ideagri | Status | Dado 777 | Nota |
|---|---|---|---|
| Produto e serviço | ✅ | 10372 | `Produto` unificado (MEDICAMENTO/RACAO/INSUMO…). |
| Princípio ativo | ⬜ | 665 / 12445 | `PRINCIPIOATIVO` 665, `PRODUTOPRINCIPIOATIVO` 12445 — composição de medicamentos (carência, antibiótico). Relevante para carência de leite. |
| Lote de produto | 🟡 | — | Temos `loteProduto` em eventos; falta gestão de lotes/validade. |
| Local de armazenamento / Movimentação entre locais | 🟡 | — | Estoque tem setor (PR #90); falta múltiplos locais físicos. |
| Fechamento gestão e estoque | 🟡 | — | Temos `FechamentoMensal` no financeiro; estoque não tem fechamento. |
| Composição de produto | ⬜ | — | Receita/composição (ração formulada). |

## 9. Cadastros e pessoas

| Ideagri | Status | Nota |
|---|---|---|
| Pessoa / Clientes, fabricantes e fornecedores | ✅ | `ClienteFornecedor` (estendido). |
| Categoria de fornecedores e clientes | 🟡 | Candidato (segmentação). |
| Cargo | ✅ | No módulo Equipe/Ponto. |
| Nível / acesso · Permissão | 🟡 | Auth com contas reais + permissão financeira (PR #142); RBAC completo por tela é candidato. |
| Fazenda / Propriedade | ✅ | Multi-propriedade (Fatias 0–4, PRs #98–103). |
| Unidade de medida / Medida / Esquema de medidas / Tipo de medida | 🟡 | Usamos unidades pontuais; Ideagri tem cadastro formal. |
| Doença / Microrganismo / Nutriente / Princípio ativo (dicionários) | ✅/⬜ | Alguns importados; ver seções acima. |

## 10. Análise, painéis e IA

| Ideagri | Status | Nota |
|---|---|---|
| Painel gestor | ✅ | Nosso Dashboard (rebanho + financeiro) supera. |
| Análise / Análise menu | ✅ | Temos abas de análise por módulo. |
| Rúmi (IA) / Prompts | ✅ | Nossa IA (`@anthropic-ai/sdk`, modo demo sem chave) por módulo. |
| Relatórios / Relatório customizável / Campos/Colunas de relatório | ⬜ | `RELATORIO` 165, `CAMPORELATORIO` 572 — **construtor de relatórios** (o usuário monta colunas/filtros). Grande, mas diferencial de produto. |
| Dashboards config-driven | ⬜ | `DASHBOARDITEM`/`DASHBOARDTOTAL` — dashboards montáveis por SQL. Nossos são fixos (mais bonitos). |
| Clima | ⬜ | vazio. Estação meteorológica/registro de chuva. |

## 11. ⛔ N/A — encanamento interno do Ideagri (não replicar)

Registradas por completude; **não** entram no backlog. São infra do software Delphi/Firebird, não features de fazenda:

- Fazer backup · Restaurar backup · Fechamento gestão e estoque (rotina interna)
- Consulta SQL · Gerenciar/Carregar formulário · Configuração acesso rápido
- Enviar dados · Receber dados · Receber coletas · Receber dados do IATF · Exibição push
- Exportação Livro Caixa Digital (LCDPR) · Exportação Delpro · Exportação SCR · Importação Alpro · Importação BouMatic · Importação de XML · Importação geral de dados · Importação de pesagem · Importação de análise de leite · Importar modelo de manejo
- Transformar notas em conferidas · Associar eventos cartão eletrônico
- Integrações de parlor/colar (COWMANAGER/COWMED/DATAMARS/LELY/SENSEHUB/NEDAP/BOUMATIC/ALPRO) — `SENSEHUBANIMAL` 681, `AGENDAMENTOSBOUMATIC` 11 (a fazenda tem colar SenseHub, mas a integração é do Ideagri; para nós seria uma feature nova de *ingestão*, não de replicação de tela)

> Nota: alguns itens acima podem virar features **nossas** no futuro em outra roupagem (ex.: importar planilha de pesagem; exportar LCDPR para o contador). Mas não como réplica da tela do Ideagri — entrariam por pedido específico.

---

## 12. Fila de execução priorizada

Critério: **(A)** valor operacional/de produto, **(B)** existência de dado real na 777 para validar já, **(C)** tamanho/risco da fatia. Cada fatia = um PR verificável, seguindo o pipeline do módulo (extração reproduzível → import → model → service com cálculo puro TDD → cockpit + seção → browser-verified).

> **Atualização 2026-07-19:** ✅ entregues desde a última revisão — **#1 Histórico de lactações** (#146–147), **#5 Correção 305** (#151–152), e a parte de **CMT/mastite por quarto** do #9 (#168). Carência de leite (parte do #10) também já ativa na produção (#153). A fila abaixo mantém só o que resta.

| # | Fatia | Domínio | Dado real | Por quê |
|---|---|---|---|---|
| ~~1~~ | ~~Histórico de lactações~~ | Produção | 335 | ✅ **Entregue** (#146–147). |
| **2** | **Exames ginecológicos** | Reprodução | **248** | Eventos clínicos reprodutivos no cockpit + work-list "precisa de exame". Enum `EXAME_GINECOLOGICO`. **Próximo candidato.** |
| 3 | Programação IATF/TETF por lote/data | Reprodução | 67 + 418 | Catálogo de protocolo já feito (#163); falta programar o protocolo a um lote → calendário reprodutivo. |
| 4 | Movimentação (grupos/setores) como fato histórico | Rebanho | 1504 + 289 | Histórico de trocas de lote/setor no cockpit; base para "onde a vaca esteve". |
| ~~5~~ | ~~Correção 305 / produção corrigida~~ | Produção | 351 | ✅ **Entregue** (#151–152). |
| 6 | Agenda de eventos / manejos futuros | Sanidade/Repro | vazio | Vacinação agendada já feita (#160); falta o calendário unificado de todos os manejos → work-lists proativas. |
| 7 | Biblioteca de reprodutores + central de sêmen + índices genéticos | Genética | 65 + 25 + 271 | Base para recomendação de acasalamento; catálogo de touros/PTAs. |
| 8 | Recomendação/medida de acasalamento | Genética | vazio | Motor de cruzamento dirigido. Depende de #7. |
| 9 | Análise de leite (tela dedicada) + tanque | Produção/Qualidade | 467 | Qualidade do leite: tela dedicada de tendência CCS + tanque. (CMT/mastite por quarto já entregue em #168.) |
| 10 | Princípio ativo (composição de medicamento) | Estoque/Sanidade | 665 | `PRINCIPIOATIVO` — composição/antibiótico. (Carência de leite já ativa via #153; falta a base de princípio ativo.) |
| 11 | Construtor de relatórios / dashboards montáveis | Análise | — | Diferencial de produto para revenda; grande. Baixa urgência. |
| 12+ | Compras (cotação→pedido→nota), patrimônio/depreciação, orçamento previsto×realizado | Financeiro | vazio | Módulos financeiros do Ideagri; sem dado real, entram quando houver demanda. |

**Fora de escopo permanente:** seção 11 (N/A). **Financeiro:** fonte continua sendo o Excel real, não o Ideagri.
