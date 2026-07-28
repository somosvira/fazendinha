# Reprodução — contrato de paridade funcional com o IDEAGRI

**Data do baseline:** 2026-07-24  
**Fonte:** IDEAGRI Desktop, fazenda 777 (`DADOS777.FDB`), consultado somente por cópia.  
**Objetivo:** toda função reprodutiva existente no IDEAGRI deve ter equivalente funcional no Fazendinha, preservando a interface moderna do produto.

## Como regenerar a evidência

```bash
bash scripts/extract-ideagri-repro-inventory.sh
```

O comando lê uma cópia do Firebird e produz, no scratch público, um inventário sem dados pessoais: telas/funções, colunas técnicas, dicionários e contagens agregadas. A fonte versionada é:

- `scripts/ideagri-repro-inventory.sql`
- `scripts/extract-ideagri-repro-inventory.sh`

Não editar contagens neste documento como se fossem constantes: o banco continua recebendo lançamentos. Regenerar antes de cada reconciliação.

## Superfície oficial confirmada

As tabelas `TELA`/`FUNCAO` registram as seguintes capacidades reprodutivas:

| Capacidade IDEAGRI | Tela oficial | Estado no Fazendinha em 2026-07-24 | Gate de aceite |
|---|---|---|---|
| Aptidão automática de novilhas | `frmAptidaoAutomatica` | **Ausente** | Mesmas regras e mesma lista de novilhas do IDEAGRI |
| Lançamento de aptidão | `frmLancarAptidaoAnimal` | **Parcial** (`PEV` derivado; sem lançamento equivalente) | Mesmo histórico e efeito de estado |
| Associação de sêmen | `frmAssociacaoSemen` | **Ausente** | Mesmo vínculo sêmen ↔ cadastro unificado |
| Biblioteca de reprodutores | `frmCadastroBaseReprodutor` | **Parcial** | Importar os 67 registros e todos os indicadores usados |
| Coleta FIV/TE | `frmCadastroColetaFIVTE` | **Ausente** | Fluxo e totais por coleta/doadora/reprodutor equivalentes |
| Medida de acasalamento | `frmCadastroMedidaAcasalamento` | **Parcial** | Medidas, tipos, combinações e fórmulas equivalentes |
| Programação IATF/TETF | `frmCadastroProgramacaoIATF` | **Parcial** | Programações/associações e dimensões equivalentes |
| Protocolo hormonal | `frmCadastroProtocoloIATF` | **Parcial** | Produtos, princípios, doses, dias e uso equivalentes |
| Diagnóstico reprodutivo | `frmLancarDiagnosticoGestacao` | **Parcial** | Campos, resultados e efeitos de estado equivalentes |
| Inseminação/cobrição | `frmLancarInseminacaoArtificial` | **Parcial** | IA e cobrição são fatos distintos e reconciliados |
| Parto | `frmLancarPartoAnimal` | **Parcial** | Tipos, auxílio, crias, aborto/natimorto e lactação equivalentes |
| Recomendação de acasalamento | `frmLancarRecomendacaoAcasalamento` | **Parcial** | Mesmo plano/ranking/restrições do IDEAGRI |
| Transferência de embrião | `frmLancarTransferenciaEmbriao` | **Parcial** | Receptora, doadora, embrião, sêmen e coleta reconciliados |
| Receber coletas | `frmReceberColeta` | **Ausente** | Mesmo fluxo de import/sincronização ou N/A assinado |
| Pool de doadoras | `frmCadastroPoolDoadoras` | **Ausente** | Cadastro e aplicação equivalentes |
| Receber dados IATF | `frmReceberDadosIATF` | **Ausente** | Mesmo fluxo de sincronização ou N/A assinado |

Funções customizadas da fazenda 777 também existem para biblioteca de reprodutores, parto, diagnóstico e inseminação; devem ser verificadas no aceite, não descartadas como duplicatas.

## Baseline agregado observado

| Fonte | Contagem em 2026-07-24 |
|---|---:|
| `REPRODUCAO` | 3.234 |
| IA (`CDTIPOREPRODUCAO=1`) | 832 |
| Cobrição (`=2`) | 61 |
| TE (`=3`) | 146 |
| DG (`=4`) | 1.843 |
| Parto (`=7`) | 352 |
| `ANIMALINFO_REPRODUCAO` | 631 |
| `PROGRAMACAOIATF` | 74 |
| `PROGRAMACAOIATFASSOCIACAO` | 466 |
| `PROTOCOLOIATF` | 5 |
| `PROTOCOLOIATFPRINCIPIOATIVO` | 31 |
| `EXAMEANIMAL` | 248 |
| `RESULTADOEXAMEGINECOLOGICO` | 44 |
| `ANIMALINFO_REPRODUTOR` | 67 |
| `CENTRALSEMEN` | 25 |
| `GENCATALOGOINDICADOR/MARCADOR/CASEINA` | 271 / 20 / 15 |
| `COLETA` | 7 |
| `AUXILIOPARTO` | 4 |
| `EMBRIAOCLASSIFICACAO` | 6 |
| `TIPOSEMEN` | 3 |
| `DADOSCOLETA` | 4 |

## Semânticas que o target deve preservar

### Eventos reprodutivos

`REPRODUCAO` distingue explicitamente:

1. Inseminação artificial
2. Cobertura
3. Transferência de embrião
4. Diagnóstico reprodutivo
7. Parto

**Parser corrigido:** `scripts/build-rebanho-json.mjs` preserva 1/2/3 como IA/cobertura/TE e rejeita códigos desconhecidos. No backup de 2026-07-28, o JSON e os eventos de origem no banco reconciliam em 837/61/146; permanece pendente concluir os demais blocos do import e o aceite operacional.

### IATF/TETF

O modelo de origem não é apenas D0/D+n. A associação por animal registra protocolo, implante/perda, estímulo, uso de CIDR, produtos e doses de luteólise, implante, estrogênio, estímulo ovulatório e desenvolvimento folicular. A programação registra datas/horas de implante e retirada, responsáveis, janela de inseminação, setor, tipo e sigla.

### Parto

O IDEAGRI possui sete tipos (`Normal`, `Auxiliado`, `Aborto`, `Natimorto`, `Induzido`, `Prematuro`, `Vivo/Natimorto`) e quatro auxílios (`Bezerro puxado`, `Cesariana`, `Complicado`, `Introdução de mãos`). O formulário atual com três rótulos não é paridade.

### FIV/TE

`COLETA` registra doadora, reprodutor(es), técnico, fertilização, oócitos por qualidade/viabilidade e embriões por estágio (mórula a blastocisto eclodido), viáveis/inviáveis. Há seis classificações oficiais de embrião.

### Genética/acasalamento

A fonte mantém catálogo de 271 indicadores, 20 marcadores, 15 caseínas, provas, valores por indicador e pedigree. O ranking atual por PTA leite/TPI e comparação textual com o pai é apenas uma aproximação.

### Exame ginecológico

O dicionário possui 44 resultados estruturados por útero/ovário. Os nove estados condensados atuais perdem informação e não podem sustentar import 1:1.

## Matriz de implementação e aceite

Cada fatia só muda para `✅` quando possui todos os itens:

| Fatia | Import | Schema | API/regra | UI | Teste/reconciliação | Estado |
|---|---|---|---|---|---|---|
| Escopo multi-propriedade | N/A | herda via animal | queries/mutações isoladas | header já existe | teste 2 propriedades | Em execução |
| Worklists/KPIs/DTO | N/A | sem mudança necessária | chaves/regras únicas | tabela coerente | unit + route/client | Em execução |
| IA × cobrição × TE histórico | JSON real gerado | entregue | entregue | entregue | eventos de origem 837/61/146 sem divergência; aceite visual pendente | 🟡 |
| Aptidão de novilhas | ausente na fonte extraída | entregue | entregue | entregue | lista/histórico IDEAGRI não extraídos | 🟡 |
| DG/exame ginecológico | parcial | entregue | entregue | entregue | 1.843 DG + 44 resultados; faltam 248 exames | 🟡 |
| Parto/auxílio/crias/perdas | parcial | entregue | entregue | entregue | 353 partos; faltam dicionários e conferência de crias/perdas | 🟡 |
| Protocolo/programação IATF/TETF | JSON 5/31/75/469 | entregue | entregue | entregue | banco reconciliado em 5/31/75/469; API verde | ✅ |
| Execução IATF/TETF | carga completa | entregue | entregue | entregue | testes e API verdes; aceite visual pendente | 🟡 |
| Receber dados IATF/mobile | N/A | N/A | N/A | N/A | equivalente web = import idempotente + execução IATF/TETF | N/A |
| Reprodutor/sêmen/genética | catálogos no JSON | entregue | entregue | entregue | banco reconciliado em 67/271/20/15/3; valores/pedigree/estoque vazios na fonte | ✅ |
| Medidas/recomendação de acasalamento | N/A (fonte vazia) | entregue | entregue | entregue | sem casos dourados reais; motor coberto por fixture; aceite visual pendente | 🟡 |
| Coleta FIV/TE e embriões | parcial no JSON | entregue | entregue | entregue | banco reconciliado em 7 coletas + 6 classificações + 7 buckets; estágios vazios na fonte | ✅ |
| Pool de doadoras | N/A (fonte 777 vazia) | entregue | entregue | entregue | fluxo coberto por fixture; aceite visual pendente | 🟡 |
| Receber coletas/mobile | N/A | N/A | N/A | N/A | equivalente web = import idempotente + lançamento/execução | N/A |
| Relatórios reprodutivos/IATF | conforme fonte | reusa EventoReprodutivo | relatório por período + método (IA/MN/TE) + reconciliação de contagens | seção no ReproducaoTab | eventos de origem reconciliados; navegador, escopo e aceite pendentes | 🟡 |

## Gate para declarar “100%”

- Todas as linhas da matriz em `✅` ou `N/A` explicitamente aprovado.
- Contagens por tipo e por animal sem divergência não explicada.
- Mesmos numeradores/denominadores e períodos nos relatórios equivalentes.
- Testes unitários, integração DB/API, browser E2E e build verdes.
- Aceite do operador/veterinário nos fluxos de IA/cobrição, DG, IATF/TETF, TE/FIV e parto.
