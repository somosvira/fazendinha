# Issue #249 — matriz de efeitos esperados Financeiro × Estoque

Referência: [issue #249](https://github.com/somosvira/fazendinha/issues/249),
[contrato funcional](../financeiro-rebuild-contrato.md) e
[relatório da execução](249-integridade-financeiro.md).
Base da execução inicial: `0e9bc74`, em 12/09/2026. Matriz atualizada para o
fluxo de contagem de `e07fdf1` e a remoção do aviso em `43fbfc5`. Os resultados
abaixo são das execuções já registradas; esta atualização documental não executa
a suíte novamente. Suporte ausente não equivale a teste aprovado.

## Convenções e massa de referência

- Cada cenário é independente, salvo as etapas explicitamente encadeadas.
- Conta inicia em R$ 1.000; produto em kg; 10 kg × R$ 10/kg = R$ 100.
- Estoque inicia em zero, exceto saídas: estas recebem uma fixture de inventário
  de 10 kg. Compra recebida significa recebimento físico no ato da confirmação.
- `Pagar`/`Receber` indicam saldo **pendente**, não o valor original imutável do
  compromisso. Liquidar altera pendência/status; não reescreve a compra.
- Quantidades/saldos nas tabelas são estados finais; a seta indica antes → depois.
- **Passou**: cenário exercitado nos serviços reais com PostgreSQL. O alcance das
  asserções está indicado na seção de rastreabilidade; não comprova toda variante.
- **Falhou**: divergência reproduzida. **Pendente**: não executado nessa suíte.
  **Lacuna de suporte**: implementação inspecionada não oferece o fluxo completo;
  ainda precisa de decisão/correção e execução.
- **UI pendente em todas as linhas.** Nenhum resultado de backend equivale a QA
  visual, autorização HTTP ou validação de relatórios.

## Operações e efeitos mínimos

| ID | Cenário e condição | Estoque esperado (kg) | Conta esperada (R$) | Compromisso esperado | Resultado backend / limite |
|---|---|---|---|---|---|
| M01 | Compra para estoque recebida à vista | 0 → 10 | 1.000 → 900 | Não cria | Passou |
| M02 | Compra para estoque recebida a prazo | 0 → 10 | 1.000 → 1.000 | Cria Pagar 100 | Passou no fluxo encadeado M04–M05 |
| M03 | Compra recebida com 40 pagos no ato | 0 → 10 | 1.000 → 960 | Cria Pagar 60 | Passou; liquidação posterior desse compromisso ainda pendente |
| M04 | Liquidar 40 da compra M02 | 10 → 10; nenhum movimento novo | 1.000 → 960 | Pagar 100 → 60; PARCIAL | Passou no fluxo M02–M05 |
| M05 | Liquidar os 60 restantes de M04 | 10 → 10; nenhum movimento novo | 960 → 900 | Pagar 60 → 0; LIQUIDADO | Passou; um único movimento físico e duas liquidações ao final |
| M06 | Compra para consumo direto à vista | 0 → 0; nenhum movimento | 1.000 → 900 | Não cria | Passou para conta/estoque; prazo não executado |
| M07 | Serviço puro à vista | 0 → 0; nenhum movimento | 1.000 → 900 | Não cria | Passou para conta/estoque; serviço a prazo pendente |
| M08 | Venda de produto estocável à vista | 10 → 0 | 1.000 → 1.100 | Não cria | Passou para conta/estoque; venda a prazo pendente |
| M09 | Estoque > Ajustar quantidade: saldo 8, contagem 12, com justificativa | 8 → 12; delta +4 calculado no servidor | 1.000 → 1.000 | Não cria | Passou no teste encadeado de contagem; ajuste interno positivo também coberto |
| M10 | Estoque > Ajustar quantidade: saldo 10, contagem 8, com justificativa | 10 → 8; delta -2 calculado no servidor | 1.000 → 1.000 | Não cria | Passou no teste encadeado de contagem |
| M11 | Inventário inicial de 10 kg | 0 → 10 | 1.000 → 1.000 | Não cria | Passou |
| M12 | Bonificação recebida de 10 kg | 0 → 10 | 1.000 → 1.000 | Não cria | Passou |
| M13 | Devolução ao fornecedor, com restituição imediata de 100 | 10 → 0 | 1.000 → 1.100 | Não cria | Passou para conta/estoque; vínculo com compra original e devolução de compra ainda não paga pendentes |
| M14 | Devolução de venda com restituição ao cliente | Entrada do produto devolvido, se reaproveitável | Saída da restituição, se valor recebido antes | Se venda não recebida, definir abatimento do recebível | Lacuna de suporte; enum atual DEVOLUCAO representa devolução ao fornecedor. Direção, vínculo original, custo e abatimento precisam de contrato antes de automatizar |
| M15 | Produção: entrada de 10 kg acabados, sem financeiro | 0 → 10 | 1.000 → 1.000 | Não cria | Passou apenas para entrada simples; consumo de insumos/custeio não validado |
| M16 | Transferência física de 10 kg de A para B | A: 10 → 0; B: 0 → 10; total permanece 10 | Sem alteração | Não cria | Lacuna de suporte; falta fluxo de duas pontas vinculadas. Definir se origem/destino são locais ou propriedades |
| M17 | Compra a prazo ainda não recebida fisicamente | 0 → 0 até recebimento; entrada única depois | Sem alteração até liquidação | Pagar 100, se compra confirmada | Pendente; contrato separa recebimento/pagamento, mas fluxo atual de compra estocável gera entrada na confirmação |
| M18 | Estoque > Ajustar quantidade: saldo 12, contagem zero, com justificativa | 12 → 0; delta -12 | 1.000 → 1.000 | Não cria | Passou no teste encadeado de contagem; zero é uma contagem válida |

Nas linhas M14 e M16, os efeitos condicionais são requisitos a detalhar, não regras
já implementadas ou aprovadas. Não inventar restituição automática para uma compra
não paga ou aceitar transferência sem definir origem/destino. M17 é uma extensão
do contrato além da massa recebida no ato usada na suíte atual.

## Reversões, rascunho, atomicidade e concorrência

| ID | Ação / estado anterior | Estoque esperado (kg) | Conta esperada (R$) | Compromisso / histórico esperado | Resultado backend |
|---|---|---|---|---|---|
| R01 | Salvar rascunho de compra à vista e anexar documento | 0 → 0 | 1.000 → 1.000 | Não cria operação confirmada, compromisso ou transação; documento pertence ao rascunho | Passou |
| R02 | Confirmar R01 | 0 → 10 | 1.000 → 900 | Uma operação; documento promovido; rascunho removido somente no sucesso | Passou |
| R03 | Cancelar compra à vista M01 | 10 → 0 | 900 → 1.000 | Operação CANCELADA; originais preservados e reversão vinculada | Falhou: estoque -10; conta correta |
| R04 | Cancelar compra a prazo M02 antes de liquidar | 10 → 0 | 1.000 → 1.000 | Compromisso CANCELADO, sem exigibilidade; histórico preservado | Falhou: estoque -10 |
| R05 | Cancelar compra M03 parcialmente paga no ato | 10 → 0 | 960 → 1.000 | Compromisso residual CANCELADO; pagamento revertido | Falhou: estoque -10; conta correta |
| R06 | Cancelar compra após liquidações posteriores | Neutraliza a entrada original | Devolve o total efetivamente pago | Cancela pendências; preserva liquidações e suas reversões | Pendente; R05 não cobre liquidações posteriores |
| R07 | Repetir cancelamento de R03 | Nenhum novo delta | Nenhum novo delta | Rejeita; não gera segunda reversão nem apaga registros | Passou para repetição; saldo já incorreto de R03 não foi tratado como correto |
| R08 | Estornar só a liquidação integral de compra a prazo | 10 → 10 | 900 → 1.000 | Pagar 0 → 100, PENDENTE; preserva vínculo da liquidação e transação revertida | Falhou: vínculo Liquidacao excluído; conta e estoque corretos |
| R09 | Falha na auditoria ao confirmar compra parcial | 0 → 0 | 1.000 → 1.000 | Nenhuma operação/item/compromisso/transação/movimento/auditoria parcial | Passou: trigger real e comparação de estado completo |
| R10 | Mesma falha ao confirmar rascunho com documento | 0 → 0 | 1.000 → 1.000 | Rascunho e documento intactos; nova tentativa permitida | Passou, incluindo nova tentativa bem-sucedida |
| R11 | Falha durante cancelamento de compra à vista | 10 → 10 | 900 → 900 | Operação e efeitos originais intactos; nenhuma reversão parcial | Passou |
| R12 | Tentar liquidar 61 quando restam 60 | Sem alteração | Sem alteração | Rejeita e conserva pendência 60; não persiste pagamento | Passou, sequencial |
| R13 | Duas liquidações simultâneas de 60 para dívida de 100 | 10 → 10 | 1.000 → 940 | Uma aceita, outra recusada; pendente 40; total pago ≤ 100 | Falhou: ambas aceitas, pago 120 e conta 880 |
| R14 | Conta inativa, conta de outra propriedade, período fechado ou parceiro inativo | Sem alteração | Sem alteração | Rejeita operação sem efeitos parciais | Passou, quatro cenários de serviço; não valida toda autorização HTTP |
| R15 | Confirmar o mesmo rascunho simultaneamente | Uma única entrada | Um único pagamento | Uma única operação; sem duplicação de compromisso/documento | Pendente |
| R16 | Saída acima do estoque disponível | Sem alteração se política proibir negativo | Sem alteração se saída bloqueada | Rejeita atomicamente conforme regra do produto | Pendente: definir/verificar política, não presumir bloqueio universal |

## Proteções do ajuste por contagem

O fluxo parte de **Estoque > Ajustar quantidade**, com produto ativo e estocável,
quantidade final encontrada (não uma entrada/saída digitada) e justificativa de
pelo menos cinco caracteres. A quantidade admite zero e até duas casas decimais.
O servidor calcula `diferença = quantidade contada − saldo atual` na propriedade
selecionada. Conta, extrato financeiro e compromissos permanecem inalterados.

| ID | Ação / estado anterior | Efeito esperado | Cobertura / limite |
|---|---|---|---|
| A01 | Saldo 10; informar contagem 10 | Não confirmar nem criar operação, movimento ou auditoria de ajuste | Passou no serviço e no teste de componente |
| A02 | Tela consultou saldo 0, mas saldo atual é 10; enviar contagem 8 | Recusar sem gravação; preservar contagem/motivo na tela e exigir revisão após atualizar saldo | Passou no serviço; preservação e atualização cobertas no componente |
| A03 | Auditoria falha durante a confirmação | Desfazer operação, item, movimento e auditoria na mesma transação; saldo anterior intacto | Passou com falha real induzida no PostgreSQL |
| A04 | A tem 10; contar 2 em B, cujo saldo é zero | A permanece 10; B passa a 2; nenhum efeito financeiro | Passou no serviço; autorização HTTP não coberta |
| A05 | Clicar novamente enquanto salva | Uma requisição pelo formulário; botão bloqueado durante envio | Passou no componente; não comprova idempotência da API nem concorrência entre sessões |
| A06 | Abrir Nova operação | Ajuste de estoque não aparece entre os tipos selecionáveis | Coberto por teste do formulário; QA manual pendente |
| A07 | Abrir rascunho antigo do tipo AJUSTE_ESTOQUE | Tipo legado preservado, confirmação bloqueada enquanto mantiver esse tipo; sem o parágrafo de aviso removido | Inspeção do código; cenário manual pendente |
| A08 | Duas contagens simultâneas sobre o mesmo saldo | Evitar aplicação de diferença baseada em saldo vencido; conflito exige atualizar e revisar | Transação Serializable e tratamento de conflito implementados; teste concorrente específico pendente |

O tipo `AJUSTE_ESTOQUE` permanece na persistência para rastreabilidade. A retirada
da opção no formulário não significa remoção do tipo nem bloqueio geral das APIs
legadas. O roteiro manual correspondente é o **U10** em
[roteiro de interface](249-roteiro-interface.md).

## Registros que sustentam cada efeito

| Efeito | Persistência e verificação exigidas |
|---|---|
| Confirmação | Operacao CONFIRMADA e seus ItemOperacao; valores dos itens somam o total; propriedade correta |
| Entrada/saída física | MovimentoEstoque com origem permitida, operacaoId e itemOperacaoId quando aplicável; produto, quantidade, unidade e custo coerentes; propriedade da operação |
| Financeiro à vista/parcial | TransacaoFinanceira e MovimentoConta na direção correta; somente o valor realizado altera saldo |
| Prazo | CompromissoFinanceiro por parcela; valor original, vencimento, número e total de parcelas coerentes; nenhum movimento de conta antes do pagamento |
| Liquidação | Liquidacao vinculando compromisso/transação; saldo pendente derivado apenas de liquidações efetivas; nenhum novo movimento de estoque |
| Reversão | Evento inverso vinculado ao original e auditoria; histórico preservado; cálculo deve neutralizar o original exatamente uma vez |
| Contagem de estoque | Operação interna AJUSTE_ESTOQUE, item e movimento vinculados; propriedade e autor corretos; auditoria AJUSTE_CONTAGEM com motivo, saldo anterior, quantidade contada, diferença e movimentoId; sem transação financeira ou compromisso |
| Documento | Vínculo do rascunho promovido à operação na mesma transação; falha preserva estado anterior |
| Transferência física | Duas pontas vinculadas à mesma transferência; soma das quantidades zero; sem conta/compromisso financeiro |
| Falha | Comparar estado completo de todas as entidades antes/depois; nenhuma gravação parcial; avanço de sequence do PostgreSQL não conta como registro parcial |

Essas exigências são critérios da matriz. A suíte ainda não as afirma em todas as
combinações: M01 verifica diretamente vínculos, propriedade, quantidade, custo,
valor e unidade nominal; conversão de unidade, precisão fracionária, múltiplos
produtos/parcelas e rastreabilidade de item na reversão continuam pendentes.

## Rastreabilidade com os 30 testes de integração

Arquivo: [invariantes.test.ts](../../server/tests/financeiro/invariantes.test.ts).
Os nomes abaixo são os títulos usados pela suíte; uma linha da matriz pode ser
uma etapa do mesmo teste, não um teste adicional.

| Linhas da matriz | Título ou família de testes | Instâncias |
|---|---|---:|
| M01 | compra à vista cria entrada, pagamento e vínculos coerentes | 1 |
| M02, M04, M05 | compra a prazo e duas liquidações não duplicam estoque | 1 |
| M03 | pagamento parcial imediato cria compromisso apenas pelo restante | 1 |
| M06, M07 | COMPRA_CONSUMO_DIRETO / SERVICO não altera estoque | 2 |
| M09, M11, M12, M15 | AJUSTE_ESTOQUE / INVENTARIO_INICIAL / BONIFICACAO / PRODUCAO não cria efeito financeiro | 4 |
| M08, M13 | VENDA / DEVOLUCAO retira estoque e registra recebimento | 2 |
| R01, R02 | rascunho não produz efeitos e confirmação promove documentos | 1 |
| R03–R05 | cancelamento A_VISTA / A_PRAZO / PARCIAL neutraliza estoque e dinheiro sem apagar histórico | 3 |
| R07 | estorno repetido é recusado sem gerar novos efeitos | 1 |
| R08 | estorno de liquidação reabre compromisso e preserva vínculo histórico | 1 |
| R09 | falha após efeitos físicos/financeiros faz rollback completo | 1 |
| R10 | falha ao confirmar preserva rascunho e documento para nova tentativa | 1 |
| R11 | falha durante cancelamento conserva todos os efeitos originais | 1 |
| R12 | liquidação acima do restante não deixa pagamento parcial persistido | 1 |
| R13 | liquidações concorrentes não podem pagar mais que o compromisso | 1 |
| R14 | rejeita inativa / outra propriedade / período fechado / parceiro inativo sem efeitos parciais | 4 |
| M09, M10, M18 | contagem encontrada reduz, aumenta e zera o estoque sem dinheiro | 1 |
| A01, A02 | contagem com saldo antigo ou sem diferença não grava efeitos | 1 |
| A03 | falha de auditoria reverte ajuste de contagem inteiro | 1 |
| A04 | contagem usa somente movimentos da propriedade escolhida | 1 |
| Total | 25 passaram; 5 falharam, conforme relatório da execução | 30 |

R03–R05, R08 e R13 correspondem às cinco falhas. As outras linhas pendentes não
entram no denominador de 30. Testes de componente e de schema são coberturas
separadas e não entram nesse total. A suíte salva em estados.json os estados das etapas,
mas nem toda propriedade capturada tem uma asserção específica; registro de uma
informação não equivale a validação automatizada dela.

## Uso na continuação do QA

1. Usar IDs M/R/A nas issues de defeito e evidências de futuras execuções.
2. Para cada execução, registrar commit, data, estado anterior, resultado obtido,
   esperado, teste/tela usado e link da evidência; manter separado backend/UI.
3. Corrigir R03–R05, R08 e R13 e repetir a suíte; detalhar as regras em aberto de
   M14/M16/R16 antes de escrever testes que fixem decisões de produto.
4. Executar as linhas pendentes e completar a cobertura dos registros acima.
5. Repetir os fluxos aplicáveis pela interface, conferindo estoque, extrato,
   compromissos e relatórios. Esta coluna permanece pendente até execução real.
6. Só marcar o critério de execução da matriz na #249 quando os cenários mínimos
   tiverem evidência ou lacuna formalmente tratada; a existência desta tabela
   satisfaz a documentação da matriz, não sua execução integral.


## Classificação por item e centros de custo

Categoria identifica **o que foi comprado**; centro de custo identifica **a área
responsável**. Grupos foram removidos. O centro não define investimento. Os padrões
são Pecuária, Agronomia, Equipe e Gestão; podem ser editados/desativados.

| Cenário | Categoria Silagem | Categoria Vacinas | Conta | A pagar |
|---|---:|---:|---:|---:|
| Compra mista 800 + 200 a prazo | Comprado 800 | Comprado 200 | Sem alteração | 1.000 |
| Pagar 500 | Pago 400; pendente 400 | Pago 100; pendente 100 | −500 | 500 |
| Quitar os outros 500 | Pago acumulado 800 | Pago acumulado 200 | −1.000 acumulado | 0 |
| Estornar pagamento de 500 | −400 na data do estorno | −100 na data do estorno | +500 | Reabre 500 |
| Cancelar toda a compra | Comprado 0; pagamentos líquidos 0 | Comprado 0; pagamentos líquidos 0 | Retorna ao saldo anterior | 0 |
| Renomear categoria ou alterar produto | Mantém nome/classificação/800 históricos | Mantém 200 | Sem alteração | Sem alteração |

- Categoria e classificação são gravadas no item ao confirmar. Sem itens, ficam
  na operação (serviço). Descrição livre pode ficar em **Sem categoria**.
- Relatórios de compras usam a data da operação confirmada; pagamentos usam a
  data de cada pagamento/estorno; pendências usam o vencimento do compromisso.
- Pagamentos e parcelas são rateados sobre o saldo dos itens, fechando os centavos.
  A reversão desfaz exatamente o rateio original, mesmo em outro mês.
- Data, categoria (incluindo inativa/sem categoria), centro e fazenda filtram a análise.
  Consolidado soma propriedades; não significa que Principal inclui a Secundária.
- Produtos com o mesmo centro sugerem esse centro. Centros diferentes exigem
  escolha no formulário; escolha manual é preservada, inclusive no rascunho salvo.
- Transferências são reconhecidas pela transação. Uma despesa sem centro continua
  sendo despesa. Investimento deriva da classificação gravada no item/serviço.
- Fixture de centavos: itens 0,02 + 0,01, três pagamentos de 0,01, total por
  categoria 0,02 + 0,01, sem saldo residual.

Execução manual: seção **Classificação por item** no [checklist](249-checklist.html).
A massa local é recriada sem converter registros antigos, conforme decisão de
produto. As falhas físicas/concorrentes anteriores permanecem na matriz; esta
alteração trata classificação e relatórios.

### Verificação desta alteração

- Build de servidor e cliente concluído.
- Suíte do servidor: 1.295 testes passaram; 2 de integração de autenticação
  ficaram desativados no ambiente local habitual.
- Testes do formulário, configurações, exportação e relatório passaram. Os testes
  de análise/filtros e responsividade passaram após atualizar os mocks da API.
- PostgreSQL real: 27/32 testes passaram, incluindo os dois novos cenários de
  classificação. Permanecem as cinco falhas conhecidas: cancelamento físico nas
  três condições de pagamento, vínculo histórico da liquidação estornada e
  liquidações concorrentes acima do valor do compromisso.
- Seed reaplicada somente em `fazendinha_local`; saldo Principal 18.200,
  Secundária 500, zero pagamentos e compromissos. Checklist manual não executado.
