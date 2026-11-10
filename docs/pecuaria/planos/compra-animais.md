# Plano de implementação — compra de animais

Status: proposta. Nada implementado. As decisões marcadas como **a confirmar** têm recomendação, mas precisam de aceite antes da tarefa T0 terminar. Ao concluir a entrega, incorporar as regras vigentes ao [contrato financeiro](../../financeiro-rebuild-contrato.md) e ao [contrato da Pecuária](../README.md) e retirar este plano.

## Problema

Não existe operação financeira para comprar animais.

- `TipoOperacaoFinanceira` (`server/prisma/schema.prisma`) não tem tipo para animais.
- `Animal.origem = COMPRADO` existe, e o cadastro manual (`client/src/pecuaria/rebanho/telas/NovoAnimal.tsx`) já fixa esse valor. Mas o animal não aponta para operação nenhuma e não guarda valor de aquisição.
- Hoje a compra é lançada como serviço ou consumo direto, e os animais são cadastrados em outro fluxo, sem vínculo entre os dois. O custo de aquisição por animal não existe para custos ou relatórios.

## Resultado pretendido

1. Novo tipo de operação **Compra de animais** (`COMPRA_ANIMAIS`), com os mesmos efeitos financeiros de uma compra: à vista, a prazo ou parcial, compromissos, desconto comercial, categoria, centro de custo, classificação, período fechado e estorno.
2. **Um item por animal**, registrado na própria operação, do mesmo jeito que os itens de produto.
3. Ao confirmar, a operação cadastra os animais no Rebanho **na mesma transação**: origem `COMPRADO`, data de entrada, sítio/lote, finalidade, composição e pesagem de `ENTRADA`.
4. Rastreabilidade nos dois sentidos: a operação lista os animais, e a ficha mostra "Adquirido na operação #N".

## Fora do escopo

- Venda de animais vinculada a operação. `BaixaAnimal` do tipo `VENDA` continua sem vínculo; fica como proposta seguinte, com o mesmo padrão.
- GTA como documento sanitário estruturado. Pode ser anexado como documento financeiro.
- Importação de planilha. A primeira versão aceita colar uma lista de brincos.
- Depreciação ou valor contábil do rebanho.

## Desenho

### Precedente reutilizado

`criarOperacaoTx` (`server/src/services/financeiro/operacoes.ts`) já recebe um efeito de domínio opcional para o leite (`EfeitoLeite`, modos `FECHAMENTO_PERIODO` e `RETIRADA_EXISTENTE`). A compra de animais segue o mesmo caminho: um efeito `CompraAnimais` executado dentro da transação da operação. Não se cria um segundo executor financeiro.

### Dados

| Elemento | Decisão |
|---|---|
| `TipoOperacaoFinanceira` | Novo valor `COMPRA_ANIMAIS`, por migration (`ALTER TYPE … ADD VALUE`). |
| `ItemOperacao` | Um por animal: `quantidade = 1`, `unidade = "cab"`, `estocavel = false`, `produtoId = null`. Frete, comissão e GTA são itens sem animal na mesma operação. |
| `pecuaria.AquisicaoAnimal` (nova) | `id`, `itemOperacaoId` (único), `animalId` (único), `operacaoId`, `pesoEntradaKg?`, `precoKg?`, `valorAquisicao` (snapshot Decimal), `rateioAcessorios?` (Decimal), autoria e datas. Fica no schema `pecuaria` para o financeiro não depender da Pecuária, como `FechamentoOperacaoLeite`. |
| `Animal` | Sem coluna nova. A origem vem de `AquisicaoAnimal`. `origem = COMPRADO` continua obrigatória para esses animais. |
| Estoque | Nenhum `MovimentoEstoque`. Animal não é produto: o rebanho tem o próprio histórico. |

Restrições no SQL: unicidade de `itemOperacaoId` e `animalId`; FK com `ON DELETE RESTRICT`; CHECK de `valorAquisicao >= 0`.

### Regras

1. **Rascunho não produz efeito.** Os dados dos animais ficam no JSON do `RascunhoOperacao`. Nenhum animal existe antes da confirmação.
2. **Atomicidade.** Confirmar cria operação, itens, transações/compromissos, animais, localização, finalidade, composição, pesagem de entrada e `AquisicaoAnimal` numa só transação. Uma falha em qualquer animal (por exemplo, brinco duplicado) desfaz tudo.
3. **Idempotência.** A `chave` da operação cobre o reenvio: repetir a confirmação não cadastra animais de novo.
4. **Parceiro.** Exige papel `FORNECEDOR`, como as outras compras (`services/financeiro/papeis.ts`).
5. **Data.** A data de entrada padrão é a data da operação. Pode ser outra, mas nunca anterior ao nascimento nem futura.
6. **Escopo.** Os animais entram no sítio da operação. Exige permissão de escrita no Financeiro **e** no Rebanho desse sítio, conferida no servidor.
7. **Valores.** `apresentarOperacao()` continua mascarando valores sem `verValores`. A ficha do animal mostra o valor de aquisição somente com a mesma permissão.

### Decisões a confirmar

| # | Pergunta | Recomendação |
|---|---|---|
| D1 | Como dividir um preço de lote entre os animais? | Três modos: valor por animal (digitado), divisão igual, proporcional ao peso. Padrão: proporcional ao peso quando todos têm peso; senão, divisão igual. Os centavos que sobram vão para o último item, como no desconto comercial. |
| D2 | Estorno da compra quando os animais já têm fatos posteriores | Bloquear se algum animal tiver pesagem (além da de entrada), aplicação, movimentação, reprodução, leite ou baixa. Sem fatos posteriores: o estorno registra baixa `CADASTRO_INDEVIDO` em cada animal, sem apagar o cadastro, e preserva a auditoria. |
| D3 | Frete e comissão entram no custo do animal? | Sim, como `rateioAcessorios` separado do preço, na mesma regra de D1. O valor do item continua sendo só o preço do animal. |
| D4 | Classificação (investimento × custeio) | Por item: matriz/reprodução = investimento; recria/engorda = custeio. O formulário sugere a partir da finalidade; o usuário pode trocar. |
| D5 | Correção (`corrigeOperacaoId`) | Permitida para valores, parcelas e dados financeiros. Mudar a lista de animais exige estorno e nova compra, para não reescrever a identidade de animais existentes. |
| D6 | Preço por kg ou por arroba | Guardar `precoKg` opcional. A arroba é só conversão na tela (15 kg), sem nova unidade no banco. |

## Plano de execução e modelos

### Critério de escolha

O objetivo é **custo por tarefa concluída sem retrabalho**, não o menor preço por token. Uma tarefa barata que exige duas correções custa mais que uma tarefa feita certo na primeira vez.

- **Opus 5.5** só onde há invariantes de dinheiro, atomicidade, estorno ou autorização e um erro passa despercebido pelos testes: T0, T4, T5 e T12.
- **Sonnet 5.5** para implementação delimitada com critério de aceite claro: migration, refatoração, cálculo, DTOs, interface, busca e testes.
- **Haiku 5.5** para documentação a partir de decisões já fechadas, sem julgamento de regra.
- **Fable 5.1** fica fora do caminho padrão: custa 2,5× o Opus 5.5 e nenhuma tarefa aqui exige raciocínio além do que o Opus entrega com esforço `high`.
- Esforço: o Opus 5.5 usa `medium` por padrão; definir `high` explicitamente nas tarefas críticas. Não subir para `xhigh`/`max` sem uma falha concreta que justifique.

### Preços de referência

Preços da API Anthropic por milhão de tokens (entrada / saída), tabela de 06/10/2026: **Haiku 5.5** US$ 0,10 / 0,50 (prompts de até 100 mil tokens); **Sonnet 5.5** US$ 2 / 10; **Opus 5.5** US$ 4 / 20; **Fable 5.1** US$ 10 / 50. Leituras de cache custam cerca de 10% da entrada. Revalidar antes de executar. Em plano de assinatura do Claude Code, estes números servem para comparar tarefas, não como cobrança.

Cálculo conservador, sem cache: `custo = entrada/1M × preço de entrada + saída/1M × preço de saída`. `k` = mil tokens, somando todas as chamadas da tarefa (releituras, resultados de ferramentas e contexto reenviado).

### Tarefas

| ID | Entrega e aceite | Depende de | Modelo / esforço | Entrada k | Saída k | US$ estimado |
|---|---|---|---|---|---|---|
| T0 | Fechar D1–D6 com o usuário e escrever as regras no contrato financeiro e no da Pecuária | — | Opus 5.5 / high | 40–70 | 8–15 | 0,32–0,58 |
| T1 | Migration: enum `COMPRA_ANIMAIS`, tabela `pecuaria.aquisicao_animal` com unicidades, FKs e CHECK; `schema.prisma` atualizado | T0 | Sonnet 5.5 / medium | 30–50 | 4–8 | 0,10–0,18 |
| T2 | Extrair `cadastrarTx(tx, …)` de `rebanho/animais.ts` sem mudar comportamento; `cadastrar()` passa a chamá-la; testes do Rebanho continuam passando | — | Sonnet 5.5 / medium | 40–70 | 5–10 | 0,13–0,24 |
| T3 | `compra-animais.calc.ts` puro: rateio (D1/D3) em centavos e validação de linhas, com testes unitários de sobra de centavos, pesos ausentes e valor zero | T0 | Sonnet 5.5 / medium | 15–25 | 4–8 | 0,07–0,13 |
| T4 | Zod (`operacaoSchema` + bloco `animais`), papel do parceiro, efeito `CompraAnimais` em `criarOperacaoTx`, rascunho, idempotência e permissões Financeiro + Rebanho | T1, T2, T3 | Opus 5.5 / high | 80–140 | 12–25 | 0,56–1,06 |
| T5 | Estorno e correção (D2/D5): bloqueio por fatos posteriores, baixa `CADASTRO_INDEVIDO`, período fechado | T4 | Opus 5.5 / high | 50–90 | 8–15 | 0,36–0,66 |
| T6 | Leitura: `obterOperacao` com animais, ficha do animal com "Adquirido na operação #N", máscara `verValores` | T4 | Sonnet 5.5 / medium | 40–60 | 6–10 | 0,14–0,22 |
| T7 | Mockup do formulário (grade de animais, cabeçalho de destino, atalho "adicionar N", colar brincos, rateio) revisado com `impeccable` e `frontend-design`; **aprovação do usuário** | T0 | Sonnet 5.5 / high | 40–70 | 10–20 | 0,18–0,34 |
| T8 | Interface em `FormOperacao.tsx` conforme o mockup aprovado, com validação de brinco em tempo real e estados de erro/carregamento | T4, T7 | Sonnet 5.5 / high | 90–150 | 15–30 | 0,33–0,60 |
| T9 | Integrações: busca global, filtro "Impacto gerado" ("Cadastrou animais"), builder de relatórios, custo de aquisição nos custos da Pecuária | T6 | Sonnet 5.5 / medium | 50–80 | 6–12 | 0,16–0,28 |
| T10 | Testes de integração e regressão (fluxo de testes abaixo) | T5, T8, T9 | Sonnet 5.5 / medium | 50–90 | 8–15 | 0,18–0,33 |
| T11 | Documentação: contratos, manual (`docs/guia`), lacunas; retirar este plano | T10 | Haiku 5.5 / medium | 30–50 | 6–10 | 0,01 |
| T12 | Revisão independente do diff completo e das capturas, focada em atomicidade, estorno, autorização e máscara de valores | T11 | Opus 5.5 / high | 60–100 | 6–12 | 0,36–0,64 |
| T13 | Conferência no navegador (desktop e 390 px) com o banco local `fazendinha_seedatev3` | T8 | Sonnet 5.5 / medium | 40–70 | 3–6 | 0,11–0,20 |

Paralelismo possível: T2, T3 e T7 não dependem entre si e podem rodar juntos depois de T0.

### Custo previsto

| Cenário | Entrada | Saída | US$ sem cache |
|---|---|---|---|
| Matriz acima | 655–1.115 mil | 101–196 mil | **3,01–5,47** |
| Tudo em Opus 5.5, mesmos tokens | 655–1.115 mil | 101–196 mil | 4,64–8,38 |

A matriz economiza cerca de 35% em relação a fazer tudo no Opus, mantendo o Opus nas quatro tarefas em que um erro custa mais que o token.

### Controle

- Ao chegar a 75% da faixa superior de uma tarefa, registrar o consumo e o que falta.
- Duas falhas seguidas pelo mesmo motivo: parar, reduzir o contexto e reestimar. Não promover para um modelo mais caro automaticamente; mudança fora da matriz exige justificativa.
- Registrar o consumo real por tarefa quando a ferramenta mostrar; senão, marcar "não aferido". Estimativa não é consumo medido.

## Fluxo de testes

### Automatizado

| Camada | O que cobre | Comando |
|---|---|---|
| Cálculo puro | Rateio igual, por peso e digitado; sobra de centavos; acessórios; pesos ausentes; valor zero | `pnpm --filter rionovo-server test -- compra-animais.calc` |
| Schemas | Tipo exige itens com animal; brincos repetidos na mesma operação; parceiro fornecedor; datas | `pnpm --filter rionovo-server test -- financeiro/schemas` |
| Rebanho | `cadastrarTx` mantém o comportamento de `cadastrar` | `pnpm --filter rionovo-server test -- rebanho` |
| Integração (escrita real) | Confirmação atômica; brinco duplicado desfaz tudo; reenvio da mesma chave não duplica; à vista, a prazo e parcial; nenhum `MovimentoEstoque`; estorno com e sem fatos posteriores; período fechado; sítio fora do escopo recusado; máscara sem `verValores` | `FINANCE_DB_INTEGRATION=1 PECUARIA_DB_INTEGRATION=1 pnpm --filter rionovo-server test -- compra-animais.integration` |
| Interface | Grade de animais, rateio exibido, validação de brinco, rascunho preservado ao recarregar | `pnpm --filter rionovo-client test -- FormOperacao` |
| Builds | Tipos do servidor e cliente | `pnpm -r run build` |

Os testes de integração usam somente `fazendinha_seedatev3`, criam e removem as próprias fixtures, e não rodam reset nem limpeza global.

### Homologação manual

1. Compra à vista de 3 novilhas com peso, rateio proporcional, frete de R$ 300. Conferir: saldo da conta, 3 animais no sítio/lote, pesagem de entrada, custo de aquisição de cada um somando preço + frete.
2. Compra parcial (entrada + 2 parcelas) de 10 garrotes por valor de lote, divisão igual. Conferir compromisso pelo restante e os centavos na soma dos itens.
3. Rascunho com 5 animais, fechar e reabrir. Nenhum animal pode aparecer no Rebanho antes de confirmar.
4. Brinco que já existe no rebanho: a confirmação é recusada, sem operação nem animais criados.
5. Estorno sem fatos posteriores: animais ficam baixados como cadastro indevido, e a conta recebe o lançamento inverso.
6. Estorno depois de uma pesagem de rotina: recusado, com mensagem indicando o animal.
7. Perfil sem `verValores`: operação e ficha sem valores, e a compra continua visível.
8. Busca global por brinco e por número da operação abre a ficha e a operação exatas.
9. Largura de 390 px: grade de animais em cartões, sem rolagem horizontal da página.

## Critérios de conclusão

- Todos os testes acima passam; homologação manual registrada separadamente da evidência automatizada.
- Contratos atualizados na mesma alteração; busca global e builder de relatórios atualizados ou com a exclusão documentada.
- Revisão T12 sem achados materiais em aberto.
- Sem deploy ou alteração de ambiente como efeito colateral.
