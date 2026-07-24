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

**Defeito atual bloqueante:** `scripts/build-rebanho-json.mjs` transforma 1/2/3 em `INSEMINACAO`. A reconciliação não pode ser aprovada antes de separar os três fatos e rejeitar códigos desconhecidos.

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
| IA × cobrição × TE histórico | pendente | pendente | pendente | pendente | 832/61/146 reconciliados | ⬜ |
| Aptidão de novilhas | pendente | pendente | pendente | pendente | lista IDEAGRI × app | ⬜ |
| DG/exame ginecológico | pendente | pendente | pendente | pendente | 248 exames + 44 resultados | ⬜ |
| Parto/auxílio/crias/perdas | pendente | pendente | pendente | pendente | 352 partos por tipo | ⬜ |
| Protocolo/programação IATF/TETF | pendente | parcial | parcial | parcial | 74/466 + 5/31 reconciliados | 🟡 |
| Execução/sincronização IATF | pendente | pendente | pendente | pendente | fluxo IDEAGRI lado a lado | ⬜ |
| Reprodutor/sêmen/genética | pendente | parcial | parcial | parcial | 67/25 + catálogos genéticos | 🟡 |
| Medidas/recomendação de acasalamento | pendente | parcial | parcial | parcial | casos dourados do IDEAGRI | 🟡 |
| Coleta FIV/TE e embriões | pendente | pendente | pendente | pendente | 7 coletas + estágios | ⬜ |
| Pool de doadoras | pendente | pendente | pendente | pendente | fluxo com fixture (777 vazio) | ⬜ |
| Receber coletas/mobile | pendente | pendente | pendente | pendente | sincronização ou N/A assinado | ⬜ |
| Relatórios reprodutivos/IATF | pendente | conforme fonte | pendente | pendente | valores lado a lado | ⬜ |

## Gate para declarar “100%”

- Todas as linhas da matriz em `✅` ou `N/A` explicitamente aprovado.
- Contagens por tipo e por animal sem divergência não explicada.
- Mesmos numeradores/denominadores e períodos nos relatórios equivalentes.
- Testes unitários, integração DB/API, browser E2E e build verdes.
- Aceite do operador/veterinário nos fluxos de IA/cobrição, DG, IATF/TETF, TE/FIV e parto.
