# Issue #249 — integração Financeiro/Estoque em PostgreSQL

Base analisada: `0e9bc74` (main, incluindo #259). Execução local em 12/09/2026,
Node 22.21.1, Prisma 6.19.3 e Vitest 2.1.9. Nenhuma regra de negócio foi alterada.

## Matriz de efeitos esperados

A [matriz Financeiro × Estoque](249-matriz-efeitos.md) documenta os efeitos
esperados, o estado da validação e a correspondência com os 26 testes. Inclui
os cenários mínimos da #249 e identifica separadamente falhas, execução
pendente e lacunas de suporte. Todo QA pela interface continua pendente.

## QA manual e massa de teste

O [roteiro pela interface](249-roteiro-interface.md) descreve 18 fluxos, as
entidades necessárias, os saldos esperados e como adicionar a massa ao banco local
com `seed:qa249` e abrir o app com `pnpm dev`, nas portas habituais. A suíte
automatizada usa tabelas separadas dentro do mesmo banco local.

## Executar

Na raiz da worktree, após `pnpm install --frozen-lockfile`:

```sh
pnpm --filter rionovo-server test:financeiro:integration
pnpm --filter rionovo-server exec tsc -p tsconfig.financeiro.json
```

Requer PostgreSQL local e `server/.env` apontando para **fazendinha_local**.
O runner usa essa conexão só para criar um banco temporário `qa249_test_*` no
mesmo servidor, aplica as migrations nele e injeta um cliente Prisma real
apontado para ele. Ao terminar apaga esse banco; o fazendinha_local e os dados de
desenvolvimento são preservados. (Era um schema temporário; virou banco porque o
Prisma usa os schemas fixos `public` e `pecuaria`.) Não execute esse runner contra produção.

As evidências `resultados.json` e `estados.json` ficam no diretório temporário
informado pelo comando. Interrupção abrupta pode impedir a limpeza do schema.
A seed manual é independente e aditiva; usa as tabelas habituais de `public`.

A configuração dedicada inclui `server/tests/financeiro`, fora do glob da suíte
comum. Falhas reais continuam vermelhas: não há `it.fails`, skip ou atualização de
expectativas para aceitar defeitos. O comando retorna exit code 1 enquanto alguma
invariante falhar.

## Resultado: 26 cenários, 21 passaram, 5 falharam

| Grupo | Cenários | Resultado |
|---|---:|---|
| Compra à vista, a prazo com liquidações sucessivas, pagamento parcial imediato | 3 | Passaram |
| Serviço e consumo direto sem movimento físico | 2 | Passaram |
| Inventário, bonificação, produção e ajuste positivo sem efeito financeiro | 4 | Passaram |
| Rascunho sem efeitos e promoção de documento na confirmação | 1 | Passou |
| Rollback da criação e recuperação do rascunho após falha | 2 | Passaram |
| Liquidação acima do restante, sequencial | 1 | Passou |
| Cancelamento à vista, a prazo e parcial | 3 | Falharam: saldo físico -10 em vez de 0 |
| Segundo cancelamento sem novos efeitos | 1 | Passou |
| Estorno de liquidação com preservação do vínculo histórico | 1 | Falhou: Liquidacao removida |
| Venda e devolução ao fornecedor | 2 | Passaram |
| Conta inativa, conta de outra propriedade, período fechado, parceiro inativo | 4 | Passaram |
| Rollback durante cancelamento | 1 | Passou |
| Duas liquidações concorrentes do mesmo compromisso | 1 | Falhou: pagamento de 120 para dívida de 100 |

## Defeitos reproduzidos (ainda sem correção ou issue individual publicada)

### 1. Cancelamento distorce saldo físico

- Fixture: estoque inicial zero; compra de 10 kg por R$ 100.
- Antes do cancelamento: estoque 10 kg.
- Após cancelar: esperado 0 kg; consulta real retorna -10 kg nas três condições.
- Conta financeira retorna corretamente a R$ 1.000 e o histórico físico fica salvo.
- Causa observada: `estornarOperacao` marca a entrada original como REVERTIDO e
  cria a saída inversa; `listarSaldos` filtra somente CONFIRMADO, excluindo a entrada
  e contando apenas a saída. Arquivos: `operacoes.ts` e `rebanho/estoque.ts`.
- Prioridade sugerida: alta; afeta estoque exibido após reversão.

### 2. Estorno remove o vínculo histórico da liquidação

- Fixture: compromisso de R$ 100, integralmente liquidado.
- Após estorno: conta volta a R$ 1.000, compromisso volta a PENDENTE e estoque
  permanece 10 kg, mas a lista de liquidações passa de um registro para zero.
- Causa observada: `estornarTransacaoTx` executa `liquidacao.delete`.
- Transações e auditoria permanecem: a perda é especificamente do vínculo
  estruturado compromisso/transação, não de todo o histórico financeiro.
- Prioridade sugerida: média; definir representação de reversão que preserve esse
  vínculo e mantenha o cálculo do pendente correto.

### 3. Liquidações simultâneas ultrapassam o compromisso

- Fixture: compromisso de R$ 100, conta com R$ 1.000.
- Duas requisições de R$ 60 leem o restante antes de qualquer inserção.
- Ambas concluem; total liquidado R$ 120, conta R$ 880. Esperado: somente uma
  aceita, R$ 60 liquidado e conta R$ 940, com erro/retry seguro para a outra.
- Intercalação reproduzida por trigger temporário e advisory lock do PostgreSQL
  na inserção de TransacaoFinanceira. A barreira é liberada somente depois que
  ambas as transações aguardam; não depende de sorte no escalonamento.
- Causa observada: leitura/validação/escrita do restante não protege o compromisso
  contra liquidações concorrentes. Arquivo: `operacoes.ts`, `liquidarCompromisso`.
- Prioridade sugerida: alta; permite pagamento acima do valor devido.

## Como a atomicidade foi verificada

Um trigger temporário lança `QA249_FALHA_INDUZIDA` ao inserir auditoria, depois das
escritas de negócio dentro da transação. O teste compara o estado completo antes e
depois: operação, itens, compromisso, transação, movimentos físicos/financeiros,
rascunho, documento e auditoria. O trigger é removido em `finally`.

O caso de rascunho também confirma uma nova tentativa bem-sucedida. Estes testes
usam o Prisma e os serviços reais; o módulo de conexão é substituído por um
Prisma real no banco temporário, sem simular `$transaction` ou consultas. Sequências de IDs podem avançar em rollback do PostgreSQL; isso não é
tratado como registro parcial.

## Limites desta entrega

Esta é a automação inicial das invariantes, não a conclusão integral da #249.
Ainda faltam QA pela interface, transferência de estoque, devolução de venda,
ajuste negativo, política de estoque insuficiente, conversões/unidades e precisão
fracionária, confirmação concorrente de rascunho, relatórios e cenários dos PRs
UUID/offline ainda não integrados. Os casos de escopo aqui verificam a conta no
serviço, não toda a autorização HTTP entre propriedades.

Próximo passo: registrar os três defeitos em issues vinculadas à #249, corrigir em
mudanças específicas e repetir este comando. Depois, executar os cenários pendentes da matriz e o QA
visual antes de encerrar a issue geral.

## Atualização: ajuste de contagem no Estoque

Nova operação não oferece mais ajuste de estoque. O endpoint
`POST /rebanho/estoque/ajustes` recebe quantidadeContada, saldoEsperado e
justificativa; calcula o delta na transação, recusa saldo alterado e conserva
origem, item, autoria e auditoria. Zero é válido; nenhuma diferença não cria
movimento. O tipo interno e as rotas legadas são preservados.

Validação PostgreSQL atual: **30 casos, 25 passaram e 5 falharam**. Os quatro
novos casos de contagem passaram. Os três defeitos previamente documentados
continuam pendentes, incluindo o cálculo de saldo após reversão; esta mudança
não corrige esses defeitos. O roteiro U10 e o checklist HTML foram atualizados.
