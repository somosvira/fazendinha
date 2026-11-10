# Plano de implementação — compra de animais

Status: decisões de produto fechadas. Backend implementado na branch `claude/compra-animais-plano`: migration `20261109180000_compra_animais`, serviço `services/financeiro/compra-animais.ts`, rotas, ficha, filtros e rótulos. Interface da compra (T8) implementada, com o cadastro compartilhado em modal. Pendentes: tela de devolução, conferência no navegador com banco migrado e retirada deste plano após a entrega. As regras vigentes já estão incorporadas aos [contrato financeiro](../../financeiro-rebuild-contrato.md) e ao [contrato da Pecuária](../README.md). Este plano será retirado quando a interface for entregue.

## Problema

Não existe operação financeira para comprar animais.

- `TipoOperacaoFinanceira` (`server/prisma/schema.prisma`) não tem tipo para animais.
- `Animal.origem = COMPRADO` existe, e o cadastro manual (`client/src/pecuaria/rebanho/telas/NovoAnimal.tsx`) já fixa esse valor. Mas o animal não aponta para operação nenhuma e não guarda valor de aquisição.
- Hoje a compra é lançada como serviço ou consumo direto, e os animais são cadastrados em outro fluxo, sem vínculo entre os dois.

## Resultado pretendido

1. Novo tipo de operação **Compra de animais** (`COMPRA_ANIMAIS`), com os mesmos efeitos financeiros de uma compra: à vista, a prazo ou parcial, compromissos, desconto comercial, categoria, centro de custo, classificação, período fechado e estorno.
2. **Um item por animal**, registrado na própria operação, do mesmo jeito que os itens de produto.
3. Ao confirmar, a operação cadastra os animais no Rebanho **na mesma transação**.
4. **Devolução parcial:** devolver algumas cabeças ao vendedor sem desfazer a compra inteira.
5. Rastreabilidade nos dois sentidos: a operação lista os animais, e a ficha mostra a compra (e a devolução, se houver).

## Fora do escopo

- Venda de animais vinculada a operação. `BaixaAnimal` do tipo `VENDA` continua sem vínculo; fica como proposta seguinte, com o mesmo padrão.
- Abatimento da devolução no compromisso a pagar em aberto. Hoje uma `DEVOLUCAO` gera valor a receber ou recebimento, não abate o título; isso continua sendo a lacuna "Liquidação com abatimento" de [lacunas](../../lacunas.md).
- GTA como documento sanitário estruturado. Pode ser anexado como documento financeiro.
- Importação de planilha. A primeira versão aceita colar uma lista de brincos.

## Decisões fechadas

| # | Tema | Decisão |
|---|---|---|
| D1 | Preço do lote | O usuário pode informar o preço por animal ou o **valor total do lote**. No lote, o sistema calcula o preço médio (total ÷ cabeças) e grava esse valor em cada item. Os centavos que sobram da divisão vão para o último item, para a soma fechar exatamente o total. |
| D2 | Estorno | Nunca é bloqueado por fatos posteriores. Devolve o valor pelo lançamento inverso, dá baixa nos animais com o tipo novo **`COMPRA_ESTORNADA`** e mantém todos os registros (pesagens, aplicações, partos etc.). Pode ser **total** (estorno da operação) ou **parcial** (devolução de algumas cabeças). |
| D3 | Frete e comissão | São itens comuns da operação, sem animal. **Não** entram no custo do animal. |
| D4 | Classificação | A classificação de custeio/investimento vem do grupo da categoria (a classificação própria foi removida em staging). O usuário escolhe a categoria, inclusive por item. |
| D5 | Entidade do animal | O animal é uma entidade própria. Dados do animal (brinco, raça, nascimento, peso de entrada etc.) ficam só no Rebanho e só são editados na ficha. A operação guarda apenas os dados da compra e a referência ao animal. |
| D6 | Unidade de preço | Definida pelo usuário: **cabeça, kg ou arroba**. |

## Desenho

### Precedente reutilizado

`criarOperacaoTx` (`server/src/services/financeiro/operacoes.ts`) já recebe um efeito de domínio opcional para o leite (`EfeitoLeite`). A compra e a devolução de animais seguem o mesmo caminho: um efeito executado dentro da transação da operação. Não se cria um segundo executor financeiro.

### Dados

| Elemento | Decisão |
|---|---|
| `TipoOperacaoFinanceira` | Novo valor `COMPRA_ANIMAIS`. A devolução parcial reutiliza `DEVOLUCAO`. |
| `ItemOperacao.animalId` | FK opcional para `pecuaria.Animal`, igual a `produtoId`. É a **única** ligação entre animal e operação (D5). |
| `TipoBaixa` | Novo valor `COMPRA_ESTORNADA`, sem motivo de baixa (como `EXTRAVIO`). |
| Tabela nova | Nenhuma. Os dados da compra cabem nos campos que o item já tem. |
| Estoque | Nenhum `MovimentoEstoque`. Animal não é produto. |

Os dados ficam separados por dono:

| Dado | Onde fica | Onde se edita |
|---|---|---|
| Brinco, sexo, raça, nascimento, filiação, finalidade | `Animal` e tabelas do Rebanho | Ficha do animal |
| Peso de entrada (balança da fazenda) | `Pesagem` do tipo `ENTRADA` | Ficha do animal |
| Preço, unidade, quantidade paga, classificação | `ItemOperacao` | Correção da operação |

O **peso pago** (balança do vendedor, no item) e o **peso de entrada** (balança da fazenda, na pesagem) são fatos diferentes. Corrigir a pesagem na ficha não muda o valor pago.

### Unidade de preço (D6) nos campos do item

| Preço combinado | `quantidade` | `unidade` | `valorUnitario` | `valorTotal` |
|---|---|---|---|---|
| Por cabeça | 1 | `cab` | preço/cabeça | preço |
| Por kg | peso pago | `kg` | preço/kg | peso × preço/kg |
| Por arroba | peso pago ÷ 15 | `@` | preço/@ | arrobas × preço/@ |
| Valor do lote (D1) | 1 | `cab` | total ÷ cabeças | preço médio (último item absorve centavos) |

A arroba usa 15 kg. A unidade é escolhida no cabeçalho e vale para todos os animais da operação.

### Garantias no banco

- Um animal só pode estar em **uma** compra ativa e em **uma** devolução ativa. Correção de operação cancela a original e cria outra com `corrigeOperacaoId`, então a original fica com um item apontando para o mesmo animal. Um índice único simples em `animalId` quebraria a correção, e um índice parcial não enxerga `status`/`tipo`, que ficam em `Operacao`. A garantia vai num **trigger** na migration, conferido também no serviço sob trava.
- `animalId` só é aceito em itens de `COMPRA_ANIMAIS` e `DEVOLUCAO`, com `estocavel = false` e `produtoId = null` (CHECK + trigger).

### Regras

1. **Rascunho não produz efeito.** Os dados dos animais ficam no JSON do `RascunhoOperacao`. Nenhum animal existe antes da confirmação.
2. **Atomicidade.** Confirmar cria operação, itens, transações/compromissos, animais, localização, finalidade, composição e pesagem de entrada numa só transação. Uma falha em qualquer animal (por exemplo, brinco duplicado) desfaz tudo.
3. **Idempotência.** A `chave` da operação cobre o reenvio: repetir a confirmação não cadastra animais de novo.
4. **Parceiro.** Exige papel `FORNECEDOR`, como as outras compras (`services/financeiro/papeis.ts`).
5. **Data.** A data de entrada padrão é a data da operação. Pode ser outra, mas nunca anterior ao nascimento nem futura.
6. **Escopo.** Os animais entram no sítio da operação. Exige permissão de escrita no Financeiro **e** no Rebanho desse sítio, conferida no servidor.
7. **Valores.** `apresentarOperacao()` continua mascarando valores sem `verValores`. A ficha do animal mostra o valor da compra só com a mesma permissão.
8. **Correção (D5).** A correção da operação altera somente dados da compra: preço, unidade, quantidade, parcelas, classificação. Não altera a lista de animais nem os dados deles. A operação corrigida aponta para os mesmos animais.

### Estorno total

- `estornarOperacao` na compra: lançamento inverso das transações e cancelamento dos compromissos, como nas outras compras.
- Cada animal **ainda ativo** recebe baixa `COMPRA_ESTORNADA` na data do estorno. Animal que já saiu do rebanho (morte, venda) não recebe segunda baixa; só o financeiro é estornado.
- Recusado enquanto houver devolução parcial ativa da mesma compra: estornar a devolução primeiro, para o valor não ser devolvido duas vezes.

### Devolução parcial

- Nova ação na ficha da compra: **Devolver cabeças**. Abre uma operação `DEVOLUCAO` com o mesmo fornecedor, já preenchida com os animais escolhidos.
- Cada item da devolução aponta para o animal (`animalId`) e traz como valor padrão o valor do item da compra. O usuário pode alterar o valor devolvido.
- O efeito financeiro é o de uma `DEVOLUCAO` hoje: valor a receber ou recebimento numa conta.
- Cada animal devolvido recebe baixa `COMPRA_ESTORNADA` na data da devolução. Só aceita animais ativos daquela compra que ainda não foram devolvidos.
- **Estornar a devolução** reverte o financeiro e estorna a baixa (`estornarBaixa`), reativando o animal com os registros intactos.

## Plano de execução e modelos

### Critério de escolha

O objetivo é **custo por tarefa concluída sem retrabalho**, não o menor preço por token.

- **Opus 5.5 / medium** só onde há invariantes de dinheiro, atomicidade, estorno ou autorização que os testes não pegam sozinhos: T4, T5 e T12. O padrão do Opus 5.5 já é `medium`; com as decisões fechadas e o precedente do leite, ele basta.
- **Sonnet 5.5** para implementação delimitada com critério de aceite claro, incluindo T0, que virou transcrição das decisões para os contratos.
- **Haiku 5.5** para documentação final, sem julgamento de regra.
- **Fable 5.1** fica fora: custa 2,5× o Opus 5.5 e nenhuma tarefa aqui precisa dele.
- **Quando subir para `high`:** só em T4 ou T5, e só se a primeira tentativa falhar num teste de integração por erro de lógica. Refazer com `high` no mesmo modelo; não trocar de modelo.

### Preços de referência

Preços da API Anthropic por milhão de tokens (entrada / saída), tabela de 06/10/2026: **Haiku 5.5** US$ 0,10 / 0,50 (prompts de até 100 mil tokens); **Sonnet 5.5** US$ 2 / 10; **Opus 5.5** US$ 4 / 20; **Fable 5.1** US$ 10 / 50. Leituras de cache custam cerca de 10% da entrada. Revalidar antes de executar. Em plano de assinatura do Claude Code, estes números servem para comparar tarefas, não como cobrança.

Cálculo conservador, sem cache: `custo = entrada/1M × preço de entrada + saída/1M × preço de saída`. `k` = mil tokens, somando todas as chamadas da tarefa. As faixas do Opus em `medium` supõem cerca de 30% menos saída e 15% menos entrada que em `high`; é estimativa, não medição.

### Tarefas

| ID | Entrega e aceite | Depende de | Modelo / esforço | Entrada k | Saída k | US$ estimado |
|---|---|---|---|---|---|---|
| T0 | Passar D1–D6 e as regras para o contrato financeiro e o da Pecuária | — | Sonnet 5.5 / medium | 40–70 | 8–15 | 0,16–0,29 |
| T1 | Migration: `COMPRA_ANIMAIS`, `COMPRA_ESTORNADA`, `ItemOperacao.animalId` com FK, CHECK e trigger de unicidade; `schema.prisma` atualizado | T0 | Sonnet 5.5 / medium | 35–55 | 5–9 | 0,12–0,20 |
| T2 | Extrair `cadastrarTx(tx, …)` de `rebanho/animais.ts` sem mudar comportamento; `cadastrar()` passa a chamá-la; testes do Rebanho continuam passando | — | Sonnet 5.5 / medium | 40–70 | 5–10 | 0,13–0,24 |
| T3 | `compra-animais.calc.ts` puro: conversão cabeça/kg/arroba e preço médio do lote em centavos, com testes de sobra de centavos e valor zero | T0 | Sonnet 5.5 / medium | 12–20 | 3–6 | 0,05–0,10 |
| T4 | Zod (`operacaoSchema` com animais e unidade de preço), papel do parceiro, efeito `CompraAnimais` em `criarOperacaoTx`, rascunho, idempotência, permissões Financeiro + Rebanho, correção sem mexer nos animais | T1, T2, T3 | Opus 5.5 / medium | 68–119 | 8–18 | 0,44–0,83 |
| T5 | Estorno total com baixa `COMPRA_ESTORNADA`; devolução parcial via `DEVOLUCAO` com animais; estorno da devolução reativando animais; bloqueio do estorno total com devolução ativa; período fechado | T4 | Opus 5.5 / medium | 60–100 | 9–16 | 0,42–0,72 |
| T6 | Leitura: `obterOperacao` com animais, ficha do animal com compra e devolução, máscara `verValores` | T4 | Sonnet 5.5 / medium | 40–60 | 6–10 | 0,14–0,22 |
| T7 | Mockup da compra (unidade de preço, valor por animal ou lote, grade de animais, "adicionar N", colar brincos) e da devolução (seleção de cabeças), revisado com `impeccable` e `frontend-design`; **aprovação do usuário** | T0 | Sonnet 5.5 / high | 45–80 | 12–22 | 0,21–0,38 |
| T8 | Interface em `FormOperacao.tsx` e na ficha da operação conforme o mockup aprovado, com validação de brinco em tempo real e estados de erro/carregamento | T4, T5, T7 | Sonnet 5.5 / high | 100–170 | 18–34 | 0,38–0,68 |
| T9 | Integrações: busca global, filtro "Impacto gerado" ("Cadastrou animais"), builder de relatórios, valor de compra nos custos da Pecuária, rótulo de `COMPRA_ESTORNADA` nas baixas | T6 | Sonnet 5.5 / medium | 50–80 | 6–12 | 0,16–0,28 |
| T10 | Testes de integração e regressão (fluxo de testes abaixo) | T5, T8, T9 | Sonnet 5.5 / medium | 60–100 | 10–18 | 0,22–0,38 |
| T11 | Documentação: contratos, manual (`docs/guia`), lacunas; retirar este plano | T10 | Haiku 5.5 / medium | 30–50 | 6–10 | 0,01 |
| T12 | Revisão independente do diff completo e das capturas, focada em atomicidade, estorno total/parcial, unicidade do animal, autorização e máscara de valores | T11 | Opus 5.5 / medium | 51–85 | 4–8 | 0,28–0,51 |
| T13 | Conferência no navegador (desktop e 390 px) com o banco local `fazendinha_seedatev3` | T8 | Sonnet 5.5 / medium | 40–70 | 3–6 | 0,11–0,20 |

Paralelismo possível: T2, T3 e T7 não dependem entre si e podem rodar juntos depois de T0.

### Custo previsto

| Cenário | Entrada | Saída | US$ sem cache |
|---|---|---|---|
| Matriz acima | 671–1.129 mil | 104–194 mil | **2,83–5,04** |
| Tudo em Opus 5.5, mesmos tokens | 671–1.129 mil | 104–194 mil | 4,76–8,40 |

### Controle

- Ao chegar a 75% da faixa superior de uma tarefa, registrar o consumo e o que falta.
- Duas falhas seguidas pelo mesmo motivo: parar, reduzir o contexto e reestimar. Fora a regra de subir para `high` em T4/T5, mudança de modelo ou esforço exige justificativa.
- Registrar o consumo real por tarefa quando a ferramenta mostrar; senão, marcar "não aferido". Estimativa não é consumo medido.

## Fluxo de testes

### Automatizado

| Camada | O que cobre | Comando |
|---|---|---|
| Cálculo puro | Cabeça, kg e arroba; preço médio do lote; sobra de centavos no último item; valor zero | `pnpm --filter rionovo-server test -- compra-animais.calc` |
| Schemas | Itens com animal só em `COMPRA_ANIMAIS`/`DEVOLUCAO`; brincos repetidos na mesma operação; parceiro fornecedor; datas | `pnpm --filter rionovo-server test -- financeiro/schemas` |
| Rebanho | `cadastrarTx` mantém o comportamento de `cadastrar`; rótulo e regras de `COMPRA_ESTORNADA` | `pnpm --filter rionovo-server test -- rebanho` |
| Integração (escrita real) | Confirmação atômica; brinco duplicado desfaz tudo; reenvio da mesma chave não duplica; à vista, a prazo e parcial; nenhum `MovimentoEstoque`; correção mantém os animais; estorno total com fatos posteriores; animal já baixado não recebe segunda baixa; devolução parcial e seu estorno; estorno total recusado com devolução ativa; animal em duas compras ativas recusado pelo trigger; período fechado; sítio fora do escopo; máscara sem `verValores` | `FINANCE_DB_INTEGRATION=1 PECUARIA_DB_INTEGRATION=1 pnpm --filter rionovo-server test -- compra-animais.integration` |
| Interface | Unidade de preço, valor do lote, grade de animais, validação de brinco, seleção da devolução, rascunho preservado ao recarregar | `pnpm --filter rionovo-client test -- FormOperacao` |
| Builds | Tipos do servidor e cliente | `pnpm -r run build` |

Os testes de integração usam somente `fazendinha_seedatev3`, criam e removem as próprias fixtures, e não rodam reset nem limpeza global.

### Homologação manual

1. **Por kg:** compra à vista de 3 novilhas a R$ 12/kg com peso pago, e frete de R$ 300 como item separado. Conferir: saldo da conta, 3 animais no sítio/lote, valor de cada item = peso × 12, frete fora do valor dos animais.
2. **Por lote:** compra parcial (entrada + 2 parcelas) de 7 garrotes por R$ 10.000. Conferir R$ 1.428,57 nos seis primeiros itens, R$ 1.428,58 no último e o compromisso pelo restante.
3. **Por arroba:** 2 bois a R$ 300/@ com 450 kg pagos. Conferir 30 @ e R$ 9.000 por item.
4. **Rascunho:** 5 animais, fechar e reabrir. Nenhum animal aparece no Rebanho antes de confirmar.
5. **Brinco existente:** a confirmação é recusada, sem operação nem animais criados.
6. **Correção:** mudar o preço de uma compra confirmada. Os animais continuam os mesmos, com os mesmos registros.
7. **Devolução parcial:** devolver 2 das 7 cabeças. Conferir valor a receber, baixa `COMPRA_ESTORNADA` só nas 2 e as outras 5 ativas.
8. **Estorno total com devolução ativa:** recusado, pedindo para estornar a devolução antes.
9. **Estorno total depois de pesagens e aplicações:** aceito; conta com lançamento inverso, animais baixados e todos os registros visíveis na ficha.
10. **Perfil sem `verValores`:** operação e ficha sem valores, com a compra visível.
11. **Busca global** por brinco e por número da operação abre a ficha e a operação exatas.
12. **Celular (390 px):** grade de animais em cartões, sem rolagem horizontal da página.

## Critérios de conclusão

- Todos os testes acima passam; homologação manual registrada separadamente da evidência automatizada.
- Contratos atualizados na mesma alteração; busca global e builder de relatórios atualizados ou com a exclusão documentada.
- Revisão T12 sem achados materiais em aberto.
- Sem deploy ou alteração de ambiente como efeito colateral.

## Rodada de interface — cadastro reutilizado (aprovada em 10/11/2026)

Revisão do mockup pelo usuário: a grade com campos por animal foi descartada. A tela usa **as mesmas bases que já existem**:

- **Operação:** o `FormOperacao.tsx` de sempre (identificação, fornecedor, centro, categoria, desconto/logística, condição financeira, parcelas, documentos, rascunho e prévia dos efeitos). A compra de animais segue o mesmo fluxo das demais compras; a diferença é só a seção de animais vinculados.
- **Animal:** o mesmo cadastro de `NovoAnimal.tsx` (identificação, datas e filiação, genitores, localização e finalidade, composição racial, peso de entrada, observação), extraído para um componente compartilhado e aberto em **modal centralizado**. Na compra, origem e sítio vêm da operação, e a data de entrada vem preenchida com a data da operação. Assim não há divergência entre o cadastro avulso e o cadastro pela operação.
- **Resumo:** cada animal confirmado no modal vira uma linha resumida na operação (brinco, sexo, raça, finalidade, peso de entrada), com os campos financeiros do item (peso pago quando por kg ou arroba, preço, valor) e as ações editar (reabre o modal com os dados) e remover.
- **Unidade de preço:** por cabeça, kg, arroba ou valor do lote, como no backend.
- Itens sem animal (frete, comissão, GTA) usam a lista de itens já existente.

### Tarefas e modelos

| ID | Entrega e aceite | Modelo / esforço | Entrada k | Saída k | US$ estimado |
|---|---|---|---|---|---|
| T8a | Extrair o cadastro de `NovoAnimal.tsx` para componente compartilhado (estado, validação, campos), sem mudar a tela atual; testes existentes passam | Sonnet 5.5 / high | 60–100 | 10–18 | 0,22–0,38 |
| T8b | `FormOperacao.tsx`: tipo "Compra de animais", modal com o cadastro compartilhado, resumo dos animais, unidade de preço e lote, payload e rascunho; erros da API por animal | Sonnet 5.5 / high (mesmo agente de T8a, para aproveitar o contexto) | 90–150 | 15–27 | 0,33–0,57 |
| T13 | Conferência no navegador (desktop e 390 px) | Sonnet 5.5 / medium (mesmo agente) | 40–80 | 3–6 | 0,11–0,22 |
| T12b | Revisão independente do diff da interface | Opus 5.5 / medium | 50–90 | 4–8 | 0,28–0,52 |
| T11b | Atualizar contrato, manual e lacunas | Haiku 5.5 / medium | 20–40 | 4–8 | 0,01 |

Total estimado sem cache: **US$ 0,95–1,70**. T8a, T8b e T13 ficam num só agente Sonnet porque dependem um do outro e dividem os mesmos arquivos; separar custaria a releitura do `FormOperacao.tsx` (cerca de 1.000 linhas) duas vezes. O Opus fica só na revisão.

Limite local: o banco `fazendinha_seedatev3` não tem a migration da compra (há migrations de outras branches pendentes), então a conferência no navegador cobre a tela, o rascunho e o payload; a confirmação real é coberta pelos testes de integração na CI.
