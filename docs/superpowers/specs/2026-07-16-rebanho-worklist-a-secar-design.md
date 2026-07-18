# Rebanho — Salvaguarda de secagem + retorno à fila

**Data:** 2026-07-16 (revisto 2026-07-18) · **Módulo:** Rebanho / Reprodução · **Linha:** complementos do Histórico de Lactações

## Revisão de escopo (2026-07-18)

A versão original desta spec planejava a fila operacional "A secar" inteira: regra canônica, endpoint, renome de slug, janela +30 dias, pills de urgência, `EventoForm` preparado, retorno à lista e salvaguarda de lactações — 7 tasks.

Entretanto, o **PR #149 ("worklists acionáveis", já mergeado em `main`)** reconstruiu toda a camada de worklists e entregou, genericamente para todas as filas (inclusive secagem):

- fila server-driven canônica em `services/rebanho/regras-manejo.ts` + rota `routes/rebanho/worklists.ts`;
- componente `WorklistCanonica.tsx` que lista, ordena e expõe a ação primária "Registrar" + "Abrir ficha" — o clique **não** abre o cockpit primeiro;
- `registroInline` em `RebanhoContent.tsx` já carregando `tipoInicial: { dominio, tipo }`, de modo que clicar "Registrar" na fila de secagem já abre o `EventoForm` em `SECAGEM` com o animal travado;
- `EventoForm.tsx` já aceitando `tipoInicial`;
- deep-link por `chave` no `router.ts`.

Logo, a maior parte da UX descrita na spec original **já existe**. Reimplementá-la significaria renomear e duplicar código que já funciona, contrariando o próprio princípio da spec ("não manter cópias divergentes da regra"). Renome de slug e janela +30 dias passam a ser melhorias de baixo valor e alto risco de divergência — ficam fora.

**O que esta fatia realmente fecha:**

1. **Salvaguarda obrigatória do histórico de lactações** — hoje ainda destrutiva; é o único item crítico de integridade de dados.
2. **Retorno à fila após registrar pela worklist** — hoje o pós-salvamento sempre navega ao cockpit; deve permanecer na lista quando a ação nasceu de uma worklist, para a pessoa continuar a fila.
3. **`dataInicial` no `EventoForm`** — pequeno complemento para a secagem já abrir com a data de hoje.

Ficam **fora**: renome `secagem-atrasada → secar`, janela +30 dias, pills de urgência dedicadas, qualquer redesenho de Dashboard, correção 305, aba analítica de Lactações, secagem em lote. A regra de elegibilidade da fila de secagem permanece a de #149 (`ehSecagemAtrasada`: prenhe com `previsaoSecagem < hoje`).

## Salvaguarda obrigatória do histórico de lactações

O fluxo atual `server/src/services/rebanho/eventos.ts#recomputarAnimal` executa `deleteMany` em todas as lactações do animal e as recria apenas com `numero`, `dtInicio` e `dtFim`. Depois dos PRs #146/#147, isso é destrutivo: registrar **qualquer** evento reprodutivo apaga `motivoSecagem`, `tipoAleitamento`, `induzida`, `producaoTotal`, `producao305` e `duracaoDias` importados.

A recomputação deve virar **não destrutiva**:

- preservar as lactações históricas já persistidas e todos os campos enriquecidos;
- ao registrar `PARTO`, criar/garantir apenas o novo ciclo correspondente (idempotente quando o ciclo com aquele início já existe);
- ao registrar `SECAGEM`, encerrar somente a lactação aberta mais recente (`dtFim = data do evento`) e gravar `motivoSecagem` nesse mesmo registro;
- ao excluir `SECAGEM`, reabrir somente o ciclo encerrado por esse evento (limpar `dtFim` e `motivoSecagem`, sem tocar nos demais campos);
- ao excluir `PARTO`, **preservar a lactação correspondente** nesta fatia: sem FK/proveniência não é seguro distinguir um ciclo histórico importado de um criado pelo app; apagar arriscaria perder produção e metadados reais;
- ao excluir outros eventos reprodutivos, não alterar lactações;
- executar mutação do evento + operações de lactação + recomputação do resumo **na mesma transação Prisma**, para não deixar evento e read-model divergentes em caso de falha.

A correspondência entre ciclo derivado e persistido usa `dtInicio` como identidade natural dentro do animal, com `numero` como verificação/ordenação. Havendo dado legado ambíguo (mais de uma lactação com o mesmo início), a operação **falha com erro de domínio explícito**, traduzido pela rota para **HTTP 409** — nunca apaga, mescla silenciosamente ou responde 500.

### Divisão em camadas

- **Cálculo puro** (`reproducao.recompute.ts`, já entregue nesta branch na Task 1): `planejarSincronizacaoLactacoes(persistidas, mutacao, numPartosEntrada)` recebe as lactações estruturais persistidas + a mutação de evento (`CRIACAO`/`EXCLUSAO`) e retorna operações declarativas `CRIAR | ENCERRAR | REABRIR`, sem I/O. Lança `ConflitoLactacaoError` (`AMBIGUIDADE` | `SEM_LACTACAO_ABERTA`). **Testado e verde.**
- **Persistência** (`eventos.ts`): `recomputarAnimal` passa a receber a mutação recém-aplicada, lê as lactações estruturais, chama o planner, aplica as operações pontuais e recomputa o resumo — tudo dentro de `prisma.$transaction`. `registrarEvento`/`excluirEvento` criam/deletam o evento **dentro da mesma transação** e propagam o `ConflitoLactacaoError`.
- **Rota** (`routes/rebanho/eventos.ts`): o `fail()` mapeia `ConflitoLactacaoError` para `409`.

Testes de regressão provam que uma lactação com `producaoTotal`/`producao305`/`tipoAleitamento`/`induzida` preenchidos mantém esses valores após registrar uma secagem e após registrar outro evento reprodutivo.

## Retorno à fila após registrar pela worklist

Hoje `RebanhoContent.onSalvo` sempre faz `onNavReb("animal")`, levando ao cockpit. Quando o registro nasceu de uma worklist, a pessoa deve **permanecer na fila** para continuar o trabalho.

- `registroInline` ganha `retorno: "lista" | "cockpit"`.
- `registrarDaWorklist` (ação vinda de `WorklistCanonica`) marca `retorno: "lista"`.
- Registro genérico (botão "Registrar evento" na aba / cockpit) marca `retorno: "cockpit"` — comportamento atual preservado; a ausência do campo também cai em `"cockpit"` por compatibilidade.
- No `onSalvo`:
  - `"lista"` → **não** navega ao cockpit; incrementa `recarga` (estado já existente) para remontar a aba via `key`, forçando o `WorklistCanonica` a rebuscar a fila; a vaca seca sai porque o resumo atualizado não satisfaz mais a regra.
  - `"cockpit"` → fluxo atual (`onNavReb("animal")` + flash do evento).
- Se a API falhar, o modal permanece aberto, preserva os dados e exibe mensagem PT-BR; a lista não muda otimisticamente (comportamento atual do `EventoForm`, mantido).

## `dataInicial` no `EventoForm`

`EventoForm` aceita `dataInicial?: string`. Quando presente, o campo `data` inicializa com esse valor (uma única vez, ao abrir), sem afetar chamadas sem a prop (que continuam com `data: ""`). `registrarDaWorklist`, no caso da secagem, passa `dataInicial = HOJE`. O motivo continua selecionável, sem gravar silenciosamente antes da confirmação.

## Arquivos

### Backend
- `server/src/services/rebanho/reproducao.recompute.ts` — planner puro **(já entregue)**.
- `server/src/services/rebanho/reproducao.recompute.test.ts` — testes do planner **(já entregues)**.
- `server/src/services/rebanho/eventos.ts` — substituir `deleteMany + createMany` por sincronização pontual/transacional que usa o planner; aplicar `motivoSecagem`; preservar campos enriquecidos; manter resumo coerente.
- `server/src/services/rebanho/eventos.test.ts` (novo) — regressão de preservação, secagem do ciclo aberto correto, exclusão que reabre, ambiguidade → erro, rollback em falha.
- `server/src/routes/rebanho/eventos.ts` — `fail()` mapeia `ConflitoLactacaoError` → 409.

### Frontend
- `client/src/rebanho/RebanhoContent.tsx` — `registroInline.retorno`; `registrarDaWorklist` marca `"lista"`; `onSalvo` bifurca lista/cockpit; `recarga` como `key` das abas de worklist.
- `client/src/rebanho/components/EventoForm.tsx` — prop `dataInicial`, inicialização one-shot.

## Testes e verificação

### Automatizados
1. Testes puros do planner (já verdes).
2. Testes de service da sincronização não destrutiva: secagem encerra o ciclo aberto e preserva produção/flags; outro evento reprodutivo não altera lactações; exclusão de secagem reabre sem apagar metadados; exclusão de parto preserva o ciclo; ambiguidade dispara conflito; falha provoca rollback integral.
3. Teste de rota traduzindo conflito estrutural → HTTP 409.
4. Suítes completas de server e client verdes; typecheck e build dos dois workspaces.

### Runtime / navegador (Postgres local isolado — nunca o Neon de produção, pois o passo escreve dados)
1. abrir Reprodução → fila de secagem;
2. registrar a secagem de uma vaca com motivo;
3. confirmar que a interface **permanece na fila** e a vaca sai da lista;
4. abrir o cockpit dessa vaca e confirmar que a lactação encerrada manteve `producaoTotal`/`producao305`/`tipoAleitamento`/`induzida` e recebeu `motivoSecagem`;
5. registrar outro evento reprodutivo em outra vaca e confirmar que as lactações dela não perderam metadados;
6. registrar um evento pelo fluxo genérico (não-worklist) e confirmar que ainda navega ao cockpit.

## Não-objetivos
- renome de slug `secagem-atrasada → secar` e janela +30 dias (superados/redundantes após #149);
- pills de urgência dedicadas, secagem em lote, agenda/calendário;
- alterar `SECAGEM_ANTEC`, schema Prisma ou import do Ideagri;
- corrigir em lote dados históricos já sobrepostos (a operação apenas recusa ambiguidade);
- Correção 305 e aba analítica de Lactações.

## Evolução seguinte
1. **Correção 305 oficial** — importar `CORRECAO305` e usar o valor zootécnico oficial;
2. **Aba analítica Lactações** — persistência, vida produtiva e comparação entre ciclos sobre dados completos;
3. retomar a fila geral com **Exames ginecológicos**.
