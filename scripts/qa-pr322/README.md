# QA local do PR #322

**Fixtures históricas retiradas.** O banco local foi consolidado nos dois sítios V4; os sítios QA322/QA322R e seus registros foram removidos por solicitação do dono. As instruções e evidências abaixo descrevem a execução anterior, não uma massa ainda disponível. Não retome esses scripts contra IDs antigos nem recrie os sítios: use a [demonstração V4 consolidada](../../docs/desenvolvimento.md#seed-v4-completa-para-simular-a-rotina). Os helpers de preparação antigos estão bloqueados após a consolidação. Casos, resultados e marcações de aceite manual permanecem como histórico.

O roteiro entregue é [`../../docs/pecuaria/artefatos/testes-follow-up-v4.html`](../../docs/pecuaria/artefatos/testes-follow-up-v4.html): 164 casos do diff até `18fa8349`, com pré-condições, dados de borda, passos, resultados esperados, evidências automáticas e aceite manual independente. Abra o HTML diretamente; ele funciona offline, conserva marcações em `terrano:qa:pr322:manual:v1` e importa/exporta somente essas marcações. Não altera os guias V3/V4.

## Ambiente e efeitos

- Aplicação `http://localhost:41875`, API `http://localhost:41873`; PostgreSQL 15 nativo do Homebrew em 5432. Único banco de desenvolvimento: `fazendinha_seedatev3`.
- Não criar banco, clone ou backup; não executar reset, recarga, limpeza global, migrations ou seed para repetir estes casos. O manifesto/data-base original permanece preservado.
- As requisições reais criam fatos auditados próprios: sítios `QA322-20261017 · A/B`, matrizes `QA322-01` a `09`, produtos, protocolos, visitas, classificações, compras sem pagamento e perdas/transferências de estoque QA. A obrigação de R$330 é fictícia e não foi paga. Não consomem os produtos originais do seed.
- Na execução histórica, a sequência clínica inicial em `QA322-07` e a primeira atividade de visita foram mantidas; o ensaio corrigido usou `QA322-08` e a atividade indicada no registro. As fixtures foram posteriormente retiradas pela consolidação. Nunca escolher `atividades[0]` por posição.
- R2/arquivos reais não foram preparados; aborto legado sem explicação não foi fabricado por desativação de constraints. Esses casos ficam bloqueados na execução de navegador. Aceite clínico/operacional da fazenda, impressora real e auditoria integral de acessibilidade continuam humanos.

## Execução histórica pelo Playwright MCP

O MCP foi usado nesta sessão com navegador real; não exige iniciar Docker ou instalar outro Playwright. `browser_run_code_unsafe` recebe `filename` absoluto, cujo conteúdo é uma função `async(page)`, **não** um módulo Node. Os scripts usam a página autenticada e APIs HTTP reais do aplicativo. `require` e importação dinâmica não estão disponíveis nesse executor.

1. Verificar a branch e o commit local. Iniciar o aplicativo pelo procedimento de [desenvolvimento](../../docs/desenvolvimento.md); confirmar as duas URLs e o banco. Autenticar o dono fictício local já documentado no seed. Não exportar tokens ou credenciais reais.
2. Executar `preparar.mcp.js`. Ele registra os IDs e a data-base em `sessionStorage['qa322:fixtures:v1']`. Exportar esse JSON para `output/qa-pr322/fixtures.json` após cada fase. Esse arquivo é um registro de IDs/respostas das fixtures, não uma cópia do banco. Preservar o registro ao fechar a sessão para não duplicar a preparação.
3. Executar `navegador.mcp.js`, alterando somente a constante `lote`: `biblioteca`, depois `politica` e `custos`. A biblioteca é acessada pela rota real Configurações, e custos/demandas pela ficha `/pecuaria/rebanho/animais/:id#reproducao`.
4. Executar `api.mcp.js` por lotes: `comercial`, `politica`, `custos`, `perdas`, `estoque`. Os testes inválidos de perda precisam preceder a gravação da perda pela UI. A média do estoque é conferida antes de esgotar as três unidades QA.
5. Executar o lote `perdas` da UI. Executar `preparar-contextos.mcp.js` com `lote='visita'`, e o lote `visitas` da UI. A API prepara a ficha; os resultados/drafts individuais são preenchidos e confirmados pela interface. Preparação não é execução clínica.
6. Executar `preparar-contextos.mcp.js` com `lote='clinica'`. Exportar o registro de fixtures para o arquivo local acima. Do diretório `server`, executar:

   ```sh
   pnpm exec tsx --env-file=.env scripts/qa-pr322-preparar-legado.ts --arquivo=../output/qa-pr322/fixtures.json
   ```

   O helper recusa produção/outro banco/sítios ou animais fora das fixtures. Ele cria somente a gestação fictícia anterior ao primeiro DG, com auditoria e constraints normais. Reimportar o JSON atualizado para a mesma chave de `sessionStorage`; executar o lote `clinica` da API, depois `perfis.mcp.js` e `origem-invalida` da UI. As duas demandas são selecionadas por `finalidade === 'RECONFIRMACAO'`, pois existe também a demanda de DG. A ordem é D2 → retry → tentativa de trocar ocorrência → anulação do DG; não antecipar a anulação.
7. Preparar o lote `indicadores` de `preparar-contextos.mcp.js`. Executar `indicadores` da API e da UI. O oráculo usa setembro/2026, corte D=17/10 e janela de40 dias: uma perda, uma gestação com reconfirmação em D e uma incompleta → 1/2=50%, uma incompleta separada.
8. Executar os demais lotes da API: `seguranca`, `aborto`, `conflito-visita`, `estoque-fifo`, `concorrencia`, `complementos`. FIFO precisa preceder concorrência, pois esta esgota o saldo próprio restante. Executar o lote `qualidade` da UI. O503 desse lote é uma resposta controlada de **leitura**; não é falha do servidor real.
9. Gerar o HTML com resultados, executar `roteiro.mcp.js` e regenerar para incorporar seus dois casos. Esse ensaio cria marcações temporárias, confere persistência/exportação/importação/filtros/celular/impressão e restaura o estado manual anterior. A exportação produzida no teste não é aceite humano. Conferir que todos os aceites novos continuam pendentes.

Os lotes usam resultados em `sessionStorage['qa322:resultados:v1']` e pulam casos já aprovados (API também pula parciais) para retomar a **mesma execução** sem repetir efeitos. Isso não é uma nova passagem de testes. Em outra revisão, primeiro comparar código, fixtures e estado atual e planejar dados aditivos próprios; não apagar resultados para forçar reexecução de casos que consomem saldo ou encerram gestação.

Os scripts são o registro executável desta sessão, com dependências e pré-condições explícitas; ainda não são uma suíte CI independente capaz de preparar qualquer estado inicial. A preparação clínica e a recuperação do registro exigem os passos acima. As evidências do HTML informam exatamente qual variante foi exercitada; casos parciais ou sem automação não equivalem a aprovação completa.

## Consolidar evidências

Exportar do navegador somente os registros QA para `output/qa-pr322/` (pasta ignorada):

- `fixtures.json`: valor da chave de fixtures, para retomada técnica.
- `resultados.json`: `{data, ferramenta, resultados: Object.values(registro), pendencias, capturas}`; cada resultado tem `id`, `status` (`passed`, `failed`, `partial`, `blocked`), `modo`, `detalhe`, `data` e, quando disponível, duração/evidência.
- PNGs obtidos pelo Playwright, identificados por fluxo. Capturas selecionadas são embutidas no HTML para portabilidade; falhas de seletor da preparação não são defeitos do produto e não são publicadas como resultado final.

Na raiz do repositório, com Node22:

```sh
node scripts/qa-pr322/gerar-roteiro.mjs --resultados output/qa-pr322/resultados.json
```

`casos.json` é a fonte dos casos; `gerar-roteiro.mjs` rejeita IDs/status inválidos e resultados duplicados. Nenhuma dependência externa é carregada pelo HTML. Para corrigir um caso, alterar o catálogo/gerador e regenerar; o armazenamento manual é preservado pela chave própria e por IDs estáveis.

## Retomada de 17/10/2026

O relatório final tem 164 registros: 161 aprovações técnicas e três bloqueios explícitos. As 23 coberturas parciais foram completadas. Dos 70 casos antes sem execução, 69 receberam validação técnica; o aceite com responsável da fazenda exige participação humana. Permanecem separados o arquivo/R2 e a contraprova SQL de aborto legado sem observação: o banco atual não contém esse legado, e a trigger não foi desativada para fabricá-lo. Os 11 testes do serviço de correção desse legado passaram.

A retomada utiliza `server/scripts/qa-pr322-restantes.ts`. A execução exige **Node 22.22.2** e guarda o registro de IDs/chaves em `output/qa-pr322/fixtures.json`, sem exportar tabelas ou copiar o banco. Na pasta `server`:

```sh
/Users/montes/.local/share/mise/installs/node/22.22.2/bin/node --env-file=.env --import tsx scripts/qa-pr322-restantes.ts --lote=preparar
```

Os lotes executados, em ordem, foram: `custos`, `estoque`, `abertura`, `comercial`, `politicas`, `origens`, `estoque-complementos`, `pacote`, `indicadores-preparar`, `indicadores`, `clinica-complementos`, `perdas-complementos`, `temporal`, `visitas-volume`, `nutricao`, `seguranca-final`, `consumos-paginacao`, `transferencia`, `rascunho-comercial` e `preservacao`. Cada um pula casos já aprovados e reutiliza suas próprias fixtures. O lote final compara hashes/contagens dos registros identificados no manifesto original; guarda somente hashes, sem cópia dos registros.

As fixtures adicionais usam prefixo `QA322R-20261017`. Os sítios são 38 (Retomada) e 39 (Destino); o período de outubro/2026 do sítio 39 foi fechado como cenário de teste e continua fechado. Existem 101 animais para limite de visita, 101 exames próprios para paginação e históricos clínicos, dietas e produtos identificados no registro. O caixa próprio da retomada recebeu abertura fictícia de R$1.000 e pagamento parcial de R$90; as contas originais não foram usadas. Nada foi limpo ao terminar.

Para os complementos de navegador, primeiro gerar a sincronização do registro local:

```sh
node scripts/qa-pr322/sincronizar-retomada.mjs
```

Abrir a aplicação local no Playwright MCP e executar `output/qa-pr322/sincronizar-retomada.mcp.js` via `browser_run_code_unsafe`. Isso atualiza apenas as chaves de sessão QA. Os scripts `restantes.mcp.js`, `finalizacao.mcp.js`, `links-retry.mcp.js` e `estados.mcp.js` contêm os percursos complementares; a chave `qa322:resultados:retomada:v1` evita repetir escritas aprovadas. Exportar e mesclar esses resultados por ID com o arquivo local; não sobrescrever evidência nativa com um registro antigo do navegador. `estados.mcp.js` repete somente leituras controladas, sem efeitos de negócio.

As respostas503 usadas nos ensaios são interceptações explícitas. No retry de classificação, a primeira requisição é encaminhada ao servidor e só sua resposta é substituída, para provar idempotência após gravação. As contraprovas React simulam a API e são identificadas assim no HTML. Elas completam trocas de sítio/alvo, resposta tardia, permissão e preservação dos editores; não são apresentadas como navegador ou PostgreSQL real.

A execução encontrou e corrigiu o escopo explícito da IATF e seus headers de execução/regularização, além da distinção entre carregamento/vazio/erro na biblioteca, nas políticas e nas demandas. O caso COM-10 foi alinhado ao contrato atual: pagamento parcial não é abatimento e mantém a dívida restante. R2 não foi configurado, e nenhum aceite humano foi criado pela automação.

A validação geral ficou registrada separadamente do catálogo: cliente completo com 1.299 aprovações e um timeout de 5 s; ao repetir o arquivo `FormOperacao`, 78 testes passaram e cinco excederam o limite curto ou sofreram o efeito subsequente. Esses cinco passaram com as mesmas asserções e limite de 30 s apenas na chamada CLI. O limite do repositório não foi alterado. Servidor: 1.597 testes aprovados e 256 ignorados pelas guardas de integração; typechecks e build cliente passaram. Isso não é uma execução integral verde de CI remota.
