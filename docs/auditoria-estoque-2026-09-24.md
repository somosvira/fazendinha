# Auditoria do estoque — 24/09/2026

Base: `main` @ `7e62d72` (merge do PR #297, produto universal). Corrigidos: severidade média (5–15) e alta 1, 3 e 4 (ver abaixo). O item 2 aguarda a decisão de produto; os de severidade baixa seguem só registrados.

## Como foi testado

- **Testes automatizados:** server (estoque, financeiro, cálculos de dieta, sanidade e aplicação): 348 passaram, 5 foram pulados (o teste de concorrência precisa de banco real). Client (`src/estoque`): 33/33. Todos usam Prisma mockado.
- **Smoke ponta a ponta** num banco local isolado (`fazendinha_estoque_smoke`, `migrate deploy` + `seed` + `seed:usuarios`), pela API e pela tela `/estoque`. Fixtures: 4 produtos (vermífugo em mL, adubo em kg com 2 centros, milho em kg, produto nunca estocado), lote com 3 vacas e dieta, talhão de 2,5 ha, um 2º sítio e usuários com áreas e flags restritas.

Legenda: **[C]** confirmado no smoke · **[L]** encontrado lendo o código (não reproduzido) · ✅ corrigido

## Correções de severidade alta (itens 1, 3 e 4)

| # | O que mudou |
|---|---|
| 1 | `exigePermissao("lancar")` em toda escrita com efeito: criar operação, confirmar rascunho, anexar documento a operação, liquidar compromisso, transferência e transação avulsa. Salvar/descartar o rascunho continua livre (não tem efeito). A tela de contas esconde "Transferir" sem a permissão. |
| 3 | Reabrir o fechamento de consumo **estorna** cada SAIDA (`estornarMovimentoTx`: inverso + original REVERTIDO + auditoria), desvincula do cabeçalho e só então o remove, liberando a janela para novo fechamento. `MovimentoEstoque.consumoPeriodo` passou de `onDelete: Cascade` para `SetNull` (migration `20260924130000_estoque_consumo_sem_cascata`). Fechar e reabrir gravam autor e `AuditoriaFinanceira` (`FECHADO`/`REABERTO`). O histórico acha o lote pelo `grupoId` depois de reaberto. |
| 4 | Produto inativo com saldo ≠ 0 continua na lista de saldos (etiqueta "Inativo") e no valor em estoque; some quando o saldo zera. Pode ser ajustado (contagem/baixa manual) para zerar. Não entra em lançamento novo: sanidade, aplicação agrícola e composição de dieta recusam (o evento/operação/dieta que já o usava continua editável); compra e venda já exigiam produto ativo. |

O item 2 (saídas sem conferir saldo) ficou para decisão de produto — ver a recomendação abaixo do item.

## Correções de severidade média (itens 5–15)

Todos corrigidos, com testes, e confirmados de novo no smoke. Duas migrations novas: `20260924120000_estoque_origem_venda_vinculos` (enum `VENDA` + colunas `animalId`/`talhaoId` em `MovimentoEstoque`) e `20260924120100_estoque_backfill_venda_vinculos` (backfill idempotente).

| # | O que mudou |
|---|---|
| 5 | Nova origem `VENDA`: a saída da venda grava `VENDA`, aparece no filtro e tem rótulo "Venda". O backfill corrige as vendas antigas. |
| 6 | O cancelamento de operação usa `estornarMovimentoTx`: o inverso tem autor e cada movimento ganha `AuditoriaFinanceira` (`ESTORNO_MOVIMENTO`). |
| 7 | O histórico mostra a quantidade e o valor com sinal (+ entrada / − saída) e o estorno como "Estorno de <origem>". A API expõe `origemEstornada`. |
| 8 | O movimento guarda `animalId`/`talhaoId` (a sanidade e a aplicação gravam; o estorno copia). O vínculo sobrevive à exclusão do evento. O backfill recuperou também os eventos já excluídos, pela observação. |
| 9 | O item da operação de ajuste leva categoria, classificação e centro; a descrição diz "Ajuste (saída)/(entrada)" e o detalhe mostra a quantidade com sinal. |
| 10 | Operação que movimenta estoque não aceita data futura (servidor + `max` no campo de data). |
| 11 | `TRANSFERENCIA_ESTOQUE` é recusado na API (continua no enum para dados antigos). Perda, Transferência e Consumo direto saíram do filtro de origem. |
| 12 | Nome de produto único sem diferenciar maiúsculas, ao criar e ao renomear (409 `CONFLITO`, campo `nome`). |
| 13 | Sem `verValores`: `/estoque/saldos`, `/movimentos`, `/custo-medio` e `/ultimo-preco` devolvem custo/valor nulos, e a tela esconde o card, as colunas e a ordenação por valor. |
| 14 | A visão consolidada soma o valor de cada sítio pela base do próprio sítio (`consolidarSaldo`); o custo médio exibido é valor ÷ saldo. |
| 15 | O custo vaca/dia e a prévia da dieta usam o escopo de sítio do estoque (legado sem propriedade conta na principal); a prévia usa o sítio do lote. |

De quebra: o custo vaca/dia contava **toda** SAIDA (venda, devolução, adubo do café) como custo da vaca; agora conta só dieta e sanidade. O estorno com o dono sintético (`SHARED_ACCESS_TOKEN`, id 0) não grava mais `criadoPorId = 0`. E o item 19 (observação de estorno aparecendo para quem não tem a área) sumiu junto com o 8, porque o inverso agora carrega o vínculo.

---

## Severidade alta

### 1. ✅ Criar operação não exige a flag `lancar` [C]
`POST /financeiro/operacoes` e `POST /financeiro/operacoes/rascunho/confirmacao` não têm `exigePermissao("lancar")` ([financeiro.ts:170](../server/src/routes/financeiro.ts), [financeiro.ts:211](../server/src/routes/financeiro.ts)). O estorno, os cadastros e o ajuste de estoque exigem.
- Smoke: um usuário só com a área financeiro e sem `lancar` criou uma `COMPRA_ESTOQUE` (201, OP-0023). A compra gerou ENTRADA no estoque e mudou o custo médio do milho (1,50 → 1,4998).
- Com o mesmo usuário, `POST /estoque/ajustes` e `POST /estoque/produtos` retornaram 403, como esperado.

### 2. Nenhuma saída verifica o saldo; o estoque fica negativo sem aviso [C]
- **Venda** de 999.999 kg de milho com saldo de 1.900 kg foi aceita (201): o saldo foi a **−998.099 kg** e o valor em estoque a **−R$ 1.497.148,50**.
- **Sanidade** de 999.999 mL de vermífugo foi aceita sem aviso: saldo −998.108 mL.
- **Cancelar uma compra** cujo estoque já foi consumido também é aceito e deixa o saldo negativo.
- A regra "a vaca comeu, não bloqueia" está documentada só para a dieta ([nutricao.consumo.ts](../server/src/services/rebanho/nutricao.consumo.ts)), que pelo menos avisa na prévia (`insuficiente`). Venda, devolução, sanidade, aplicação e estorno não validam nem avisam.
- O card "Valor em estoque" soma valores negativos.

**Recomendação (pendente de decisão).** O financeiro trata os dois casos de forma diferente:
- **Liquidação** nunca supera o pendente (regra 6 do contrato): é um bloqueio duro sobre um número digitado no escritório.
- **Conta bancária** pode ficar negativa: `SALDO_INSUFICIENTE` existe em `FinanceiroError`, mas nenhum fluxo o lança, porque cheque especial existe de verdade.
- **Estoque físico negativo não existe**: é sempre entrada faltando ou digitação errada.

A proposta separa as saídas assim:
- **Bloquear** (`SALDO_INSUFICIENTE`, 409, saldo do sítio conferido dentro da transação com lock) venda, devolução ao fornecedor e baixa manual (ajuste negativo). São lançamentos de escritório, como a liquidação. A mensagem manda registrar antes a compra ou o inventário que falta.
- **Aceitar com aviso** a sanidade, a aplicação agrícola e a dieta. O fato físico já aconteceu, e a sanidade carrega a carência do leite, então o registro não pode se perder por falta de entrada. A dieta já faz isso (`insuficiente` na prévia); sanidade e aplicação ganham o mesmo `aviso` que já usam para "sem estoque".
- **Aceitar com aviso** também o cancelamento de uma entrada já consumida. Bloquear travaria o fluxo de correção, que exige cancelar a operação original antes de lançar a corrigida (`corrigeOperacaoId`).
- **Continuar expondo** os saldos negativos que sobrarem, pelo filtro "produtos com saldo negativo" que a tela já tem.

### 3. ✅ "Reabrir" o consumo da dieta apaga os movimentos fisicamente [C]
`DELETE /rebanho/consumo/:id` apaga o `ConsumoPeriodo`, e o `onDelete: Cascade` apaga junto as SAIDAs de estoque ([nutricao.consumo.ts `reabrirConsumoPeriodo`](../server/src/services/rebanho/nutricao.consumo.ts)).
- Smoke: 1 movimento NUTRICAO antes, 0 depois. O histórico não guarda nenhum rastro da baixa nem do estorno.
- Viola o contrato ("registros confirmados não são apagados, são estornados") e não grava `AuditoriaFinanceira`.
- O fechamento também não grava `criadoPorId` nem auditoria [L].

### 4. ✅ Produto inativo com saldo some do estoque, mas continua sendo consumido [C]
Inativei o adubo com 449 kg em estoque:
- a inativação foi aceita sem aviso;
- o produto sumiu de `/estoque/saldos` e do "Valor em estoque", porque `listarSaldos` filtra `ativo: true`;
- mesmo assim, uma **aplicação agrícola** e um **ajuste manual** do produto inativo geraram baixa normalmente.

O estoque físico continua existindo e mudando, mas ficou invisível.

---

## Severidade média

### 5. ✅ Venda sai com origem `AJUSTE_INVENTARIO` [C]
A escolha da origem ([operacoes.ts:197](../server/src/services/financeiro/operacoes.ts)) não trata `VENDA`, que cai em `AJUSTE_INVENTARIO`. O enum `OrigemMovimentoEstoque` nem tem uma origem VENDA.
- Smoke: a saída da venda OP-0013 aparece com o filtro de origem "Ajuste de estoque" e é rotulada como ajuste no histórico.
- Relatórios e contagens por origem misturam vendas com ajustes.

### 6. ✅ O cancelamento de operação reimplementa o estorno de estoque [C]
`estornarOperacao` ([operacoes.ts:400-411](../server/src/services/financeiro/operacoes.ts)) cria os movimentos inversos na mão em vez de usar `estornarMovimentoTx`.
- Smoke: o inverso do movimento #4 ficou com `criadoPorId = null`, e há **0** registros de `AuditoriaFinanceira` para o `MovimentoEstoque` estornado (o estorno por sanidade/aplicação audita cada movimento).
- Duas implementações da mesma regra tendem a divergir.

### 7. ✅ No histórico, não dá para saber se um estorno entrou ou saiu [C]
Todo estorno aparece como "Ajuste de estoque · Estorno" com a quantidade **sem sinal**:
- o estorno de compra de 1.000 mL (uma SAIDA) e o estorno de sanidade de 20 mL (uma ENTRADA) aparecem iguais;
- a coluna "Tipo" mostra a origem, não a direção. Só o ajuste manual mostra sinal (−100 mL).

### 8. ✅ Evento operacional excluído deixa o movimento sem vínculo [C]
Excluir um evento sanitário ou uma aplicação agrícola apaga o evento. O movimento original fica "Estornado", mas a coluna Origem/Destino passa a mostrar "—" (perde o animal ou talhão), e o estorno inverso também não tem vínculo. Não dá mais para saber de qual animal ou talhão veio a baixa.

### 9. ✅ A operação gerada pelo ajuste perde categoria, centro e sinal [C]
`registrarMovimentoTx` ([estoque.ts](../server/src/services/estoque/estoque.ts)) cria o `ItemOperacao` sem `categoriaId` e sem `centroCustoId`, e com a quantidade em módulo.
- Smoke (OP-0024): na tela, a operação mostra "10 mL × R$ 0,45 · Sem categoria · Sem centro". O produto tem categoria (Medicamento Animal) e o movimento gravou o centro 5 (Atividade Leiteira).
- Um ajuste de −10 mL aparece como "10 mL".

### 10. ✅ Compra com data futura é aceita e já conta no saldo [C]
Uma compra datada de 01/01/2027 foi aceita. Ela entra na hora no saldo e no custo médio e aparece no topo de "Últimas entradas".
O ajuste manual proíbe data futura (`naoFutura`); as operações não. Hoje o saldo é "tudo que já foi lançado", não "saldo até hoje".

### 11. ✅ `TRANSFERENCIA_ESTOQUE` é aceita e não faz nada [C]
O `operacaoSchema` aceita `TRANSFERENCIA_ESTOQUE` (201), mas o tipo não está em `incluiEstoque` nem em `retiraEstoque`, então não gera nenhum movimento. O tipo não aparece no formulário.
As origens `TRANSFERENCIA`, `PERDA` e `CONSUMO_DIRETO` estão no filtro do histórico, mas nenhum fluxo grava essas origens hoje.

### 12. ✅ Nome de produto duplicado com maiúsculas diferentes [C]
"Smoke Vermífugo" e "smoke vermífugo" foram criados os dois (201). O `@unique` de `Produto.nome` diferencia maiúsculas de minúsculas.

### 13. ✅ A flag `verValores` não é aplicada no servidor [C]
Um usuário da pecuária sem nenhuma flag recebeu `custoMedio`, `valor`, `custoUnitario`, `valorTotal` e `fornecedor` em `/estoque/saldos`, `/estoque/movimentos` e `/estoque/produtos/:id/custo-medio`. A flag só é usada no client (`App.tsx`), para mascarar valores na tela.

### 14. ✅ O valor consolidado não bate com a soma dos sítios [C]
Vermífugo: sítio 1 = R$ 410,90, sítio 2 = R$ 200,00, soma R$ 610,90. A visão consolidada mostra **R$ 596,95**, porque aplica ao saldo total um custo médio combinado das bases dos dois sítios.

### 15. ✅ Algumas leituras tratam o escopo de sítio de forma diferente [L]
O resto do estoque trata movimento sem `propriedadeId` como da propriedade principal. Duas leituras não fazem isso:
- `calcularCustoVacaDia` ([estoque.ts](../server/src/services/estoque/estoque.ts)) filtra `propriedadeId` estrito, então saídas legadas sem propriedade ficam fora do custo vaca/dia da principal;
- `resolverConsumo` (prévia da dieta) calcula o `saldoAtual` filtrando `propriedadeId` estrito pelo escopo da requisição. O custo e o "tem estoque" usam o sítio do lote.

---

## Severidade baixa

16. **Data inválida no filtro do histórico dá 500** [C]. `de=2026-13-45` passa pelo regex e quebra no `new Date`.
17. **Sítio inexistente numa escrita dá 500** [C]. Com `X-Propriedade-Id: 999`, `POST /financeiro/operacoes` e `POST /estoque/ajustes` falham com erro de FK. `resolverEscopoEscrita` aceita qualquer inteiro sem validar.
18. **O alerta de conflito do ajuste não some** [C]. Depois de "Atualizar saldo", o saldo e a diferença são recalculados, mas o alerta "O estoque mudou…" continua na tela até o próximo envio.
19. **Observação de estorno aparece para quem não tem a área** [C]. Um usuário só do financeiro vê "Estorno: evento sanitário #3 excluído" e "Estorno: operação agrícola #1 excluída". O filtro de vínculo só esconde a observação do movimento original, não a do inverso. São só IDs, sem número de animal.
20. **Mensagens de mês fechado diferentes em cada módulo** [C]. "período financeiro fechado", "O período financeiro está fechado. Reabra…", "mês financeiro fechado", "mês fechado — operação não pode ser registrada". O bloqueio em si funciona nos seis fluxos.
21. **O fechamento da dieta ignora produto sem estoque em silêncio** [C]. A resposta diz `movimentos: 1` sem mencionar o item pulado; só a prévia sinaliza `semEstoque`.
22. **Não existe rota nem tela para fechar um período financeiro** [L]. Nenhuma rota escreve `PeriodoFinanceiro`; o bloqueio só pôde ser testado alterando o banco direto.
23. **Aplicação de produto com 2+ centros sai sem centro** [C]. O talhão não tem centro de custo, então sem `centroCustoId` explícito a baixa fica sem centro. É coerente com a regra, mas deixa a alocação operacional incompleta.

---

## O que foi verificado e funciona

- Produto: categoria obrigatória, mínimo não negativo, produto sem movimento fora da lista de saldos.
- Custo médio ponderado: 1000 mL a 0,45 + 1000 mL a 0,55 = 0,50. Continua correto depois de ajustes, legado sem propriedade e estorno de compra (recalculou para 0,451).
- Compra à vista sem compromisso; consumo direto sem movimento de estoque; compra de produto com 2 centros sem centro no item; "último preço" e "custo médio" corretos.
- Venda e sanidade de produto nunca estocado não baixam: a venda exige centro e a sanidade salva com aviso.
- Ajuste por contagem: conflito 409 (API e tela), "já corresponde" 400, justificativa obrigatória, baixa de produto sem estoque recusada, ENTRADA manual recusada, confirmação pela tela com saldo recalculado.
- Dieta: prévia, fechamento e idempotência ("já foi fechado"). Sanidade valorizada pelo custo médio com o centro do lote. Aplicação com dose por hectare e conversão g→kg (400 g/ha × 2,5 ha = 1 kg); dose em L para produto em kg é recusada com mensagem clara.
- Estornos por cancelamento de operação, exclusão de evento sanitário e exclusão de aplicação: movimento inverso + original REVERTIDO; estorno duplo recusado.
- Mês fechado bloqueia ajuste, compra, estorno, sanidade, dieta e aplicação.
- Multi-sítio: saldo e custo médio por sítio; movimento legado sem propriedade conta na principal; ajuste em modo consolidado é bloqueado na tela.
- Permissões: área equipe recebe 403 em `/estoque/*`; vínculo animal/talhão escondido de quem só tem financeiro.
- Histórico: paginação, `porPagina` > 100 recusado, busca por produto, fornecedor e `OP-nnnn`, filtros de centro (incluindo "sem centro") e de período.
