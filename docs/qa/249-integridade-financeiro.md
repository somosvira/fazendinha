# Issue #249 — integração Financeiro/Estoque em PostgreSQL

Base analisada: `0e9bc74` (main, incluindo #259). Execução local em 12/09/2026,
Node 22.21.1, Prisma 6.19.3 e Vitest 2.1.9. Nenhuma regra de negócio foi alterada.

## Executar

Na raiz da worktree, após `pnpm install --frozen-lockfile`:

```sh
pnpm --filter rionovo-server test:financeiro:integration
pnpm --filter rionovo-server exec tsc -p tsconfig.financeiro.json
```

Requer PostgreSQL local e usuário com permissão de criar bancos. O padrão usa o
usuário do sistema em `127.0.0.1:5432/postgres`. Para outra configuração local,
defina `QA_DATABASE_ADMIN_URL`. Hosts remotos e query parameters são recusados.
O runner não usa `DATABASE_URL`/`DIRECT_URL` da aplicação nem carrega `.env`;
substitui ambas as URLs por um banco novo com nome aleatório `fazendinha_qa249_*`.

Cada execução aplica migrations, executa fixtures determinísticas isoladas por
cenário e remove seu próprio banco no `finally`, inclusive quando há falhas.
Interrupção abrupta do processo pode impedir o `finally`. Nunca se deve apontar
este runner para um banco da aplicação. Não usa seeds de negócio ou produção.

O diretório temporário informado no terminal contém `resultados.json` (Vitest) e
`estados.json` (antes/depois, incluindo registros completos e auditoria). Preserve
esses arquivos ao anexar evidências a uma issue; diretórios temporários podem ser
limpos pelo sistema. Nenhum dado ou credencial de produção entra nas fixtures.

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
usam o Prisma e os serviços reais; nenhuma implementação de `$transaction` é
simulada. Sequências de IDs podem avançar em rollback do PostgreSQL; isso não é
tratado como registro parcial.

## Limites desta entrega

Esta é a automação inicial das invariantes, não a conclusão integral da #249.
Ainda faltam QA pela interface, transferência de estoque, devolução de venda,
ajuste negativo, política de estoque insuficiente, conversões/unidades e precisão
fracionária, confirmação concorrente de rascunho, relatórios e cenários dos PRs
UUID/offline ainda não integrados. Os casos de escopo aqui verificam a conta no
serviço, não toda a autorização HTTP entre propriedades.

Próximo passo: registrar os três defeitos em issues vinculadas à #249, corrigir em
mudanças específicas e repetir este comando. Depois, completar a matriz e o QA
visual antes de encerrar a issue geral.
