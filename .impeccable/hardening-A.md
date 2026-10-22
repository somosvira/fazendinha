# Hardening frontend — Pecuária e Estoque

Escopo desta rodada: interfaces de Pecuária e Estoque; testes com respostas simuladas, sem escritas no seed. As garantias de autorização e mascaramento do servidor são uma revisão separada. Não é homologação integral nem nota automática 4/4.

## Defeito e correção

Receita, publicação, vigência, estorno nutricional, conferência de períodos e renomear lote de estoque dependiam apenas de estado React para impedir envios simultâneos. Dois eventos no mesmo batch podiam iniciar duas chamadas antes do próximo render. Travas síncronas por instância agora encerram essa janela e são liberadas após sucesso/erro. Os campos e a chave de confirmação de períodos permanecem na falha; validações também são verificadas no handler, não apenas no botão desabilitado.

## Matriz de evidência e lacunas

| Família | Evidência nesta rodada | Limite explícito |
|---|---|---|
| Receitas nutricionais | Teste novo: dois submits no mesmo batch, uma chamada; 403 preserva nome/quantidade e permite retry. URL publicar em perfil consulta não oferece confirmação. 404 na lista oferece retry e recupera dados. | HTTP é simulado por rejeição do módulo API; não prova sessão/servidor real. Publicação protegida por código, sem novo teste concorrente próprio. |
| Fechamento/estorno | Teste novo: estornos simultâneos produzem uma chamada. Existentes: motivo preservado na falha, consulta não abre estorno nem custo. | Não reproduz perda da resposta depois de commit real; idempotência é contrato do servidor. |
| Conferência de períodos | Testes novos: concorrência, retry com mesma chave e quantidade preservada; verValores=false esconde custo mesmo com custo no payload. | Sem teste browser de rede interrompida; prévia e confirmação têm trava compartilhada por instância. |
| Atribuição/correção de vigência | Código validado: trava, data obrigatória, motivo mínimo no handler. Suíte existente cobre lote explícito/publicadas/contexto e erro. | Não foi criado teste concorrente específico de cada ação. |
| Estoque | Teste novo: renomear lote concorrente, 403 preserva nome e permite retry. Suítes existentes cobrem saldo, transferência/perda, lotes, acesso consulta, retry e navegação. | Não há nova homologação de todos os perfis autenticados; valores do estoque dependem do DTO mascarado pelo servidor. |
| Rebanho | Suítes de forms e ficha executadas; ficha consulta sem ações de escrita. Inspeção dos seis forms encontrou trava síncrona existente. | Não foi feita nova matriz manual de todos os status 400/401/403/404/500 por formulário. |
| Sanidade | Suítes existentes executadas: permissões de consulta, formulário, chave de retry, falhas com campos preservados, rodadas, protocolos e reconciliação. | Nenhuma mutação nova nesta rodada; ausência de defeito nos testes não equivale a cobertura de todos os cenários reais. |

## Arquivos de implementação alterados nesta rodada

- client/src/pecuaria/rebanho/nutricao/FormReceitaDieta.tsx
- client/src/pecuaria/rebanho/nutricao/ReceitasDieta.tsx
- client/src/pecuaria/rebanho/nutricao/ConsultaFechamento.tsx
- client/src/pecuaria/rebanho/nutricao/FormOperacaoNutricional.tsx
- client/src/pecuaria/rebanho/nutricao/ConferenciaPeriodos.tsx
- client/src/estoque/ProdutoEstoqueDetalhe.tsx

Testes adicionados às suítes ReceitasDieta, ConsultaFechamento, ConferenciaPeriodos e ProdutoEstoqueDetalhe. Contrato atualizado em docs/pecuaria/README.md. As outras alterações locais já presentes não foram removidas ou atribuídas a esta rodada.

## Execução

- `npx vitest run src/estoque src/pecuaria/rebanho/nutricao src/pecuaria/rebanho/forms src/pecuaria/rebanho/telas/DetalheAnimal.test.tsx`: 26 arquivos, 186 testes passaram. Depois desse comando, a conferência recebeu mais dois testes e foi revalidada abaixo.
- `npx vitest run src/pecuaria/rebanho/sanidade src/pecuaria/rebanho/nutricao/ConferenciaPeriodos.test.tsx`: 17 arquivos, 99 testes passaram, incluindo os cinco testes finais da conferência. As duas contagens têm sobreposição; não somar como testes distintos.
- `git diff --check`: limpo.
- `npx tsc --noEmit`: falhou no estado compartilhado em FormConta, FormOperacao e OperacaoFinanceiraDetalhe por valores financeiros `string | null`; comunicado ao responsável financeiro. Nenhum diagnóstico de Pecuária/Estoque nesta execução. Não registrar build global aprovado.
- Avisos Recharts de dimensão zero vieram de jsdom sem layout; não constituem medição de regressão visual ou performance.

Não executei detector nem uma nova avaliação visual. Para concluir qualidade integral ainda faltam prova de sessão autenticada restrita em ambiente isolado, matriz real de respostas do servidor e submissões após perda de resposta. Os testes locais não certificam autorização de backend.

## Rodada adicional — autenticação

Arquivos: components/Login.tsx, RecuperarSenha.tsx, DefinirSenha.tsx; api/auth.ts recebeu apenas preservação de `status` no Error. ARCHITECTURE.md registra o comportamento.

| Fluxo | Correção/prova automatizada | Limite |
|---|---|---|
| Login | Trava síncrona; credenciais preservadas na recusa; alerta recebe foco; teste de dois submits no mesmo batch | Não autentica conta real nem verifica cookie real |
| Recuperação | Trava síncrona; email preservado na falha; erro anunciado/focado; retry e confirmação neutra | Não envia email real nem valida entrega |
| Convite/reset | Sem formulário enquanto link valida; 404 inválido, rede/5xx transitório com retry; trava de gravação; senha preservada; respostas antigas ignoradas ao mudar token/desmontar | Não consome token real; uso único e revogação são servidor |
| Sessão/contexto | Teste ignora conclusão de sessão de token antigo após troca; outro ignora validação antiga; convite novo entra uma única vez | Não simula troca de usuário em outra aba; root valida integração de sessão |

`AuthHardening.test.tsx` adiciona sete testes de interação/API mockada; mais Login.test.ts, DefinirSenha.test.ts e RecuperarSenha.test.tsx: quatro arquivos/dez testes passaram. SSR de DefinirSenha agora espera estado de validação, não campos prematuros. A affordance mostrar senha dos dois campos foi preservada e testada após validação. `git diff --check` limpo. Não há nova certificação visual nem nota global.

Checagem final desta rodada: `npx tsc --noEmit` passou no estado compartilhado atualizado (os erros financeiros mencionados na execução anterior já não ocorreram).
