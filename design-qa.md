# QA — dashboard financeiro compacto

final result: passed

Referência: mockup aprovado nesta conversa em 08/out/2026. Comparação visual com captura local em desktop (1440 × 1024), além de verificações responsivas em 390, 720 e 1180px. Evidências locais em `/tmp/fazendinha-dashboard-qa/`: `desktop.png`, `calendar.png`, `mobile.png`, `mobile-calendar.png` e capturas de tablet.

## Resultado

- Cinco indicadores compactos, compromissos e contas lado a lado, gráficos na segunda linha e rastreabilidade recolhida.
- Categorias mantêm rosca, legenda, filtro e estornos; Linhas/Barras preserva acumulado versus movimento do intervalo.
- Calendário abre em Dialog, com título e descrição acessíveis, fechamento por Escape e consulta de detalhes. Liquidação mantém permissões e validações existentes.
- Corrigidos durante a revisão: quebra de valores dos indicadores, descrições longas ampliando linhas, botões de eventos com conteúdo horizontal e expansão indevida do modal no celular.
- Nenhum erro de execução capturado no navegador. Sem overflow horizontal da página. Tabelas/calendário usam rolagem horizontal contida e indicação no celular.

## Diferenças deliberadas da imagem

A imagem usa dados ilustrativos; a tela usa os dados reais retornados pela API, incluindo 47 vencidos e descrições maiores. Rótulos e valores completos permanecem acessíveis. O tema Terrano e os componentes existentes do aplicativo foram preservados. O link ilustrativo de pagamentos por categoria não ganhou uma rota artificial: o filtro funcional continua no próprio painel.

Com o mesmo viewport desktop, a página tem aproximadamente 1164px de altura, contra 3843px da versão anterior capturada em largura semelhante (1512px). Redução aproximada de 70%; não se exige que toda a página caiba em uma única tela para preservar legibilidade.

## Verificação técnica e limites

`pnpm --filter rionovo-client test`: 121 arquivos, 938 testes aprovados (base atualizada com `origin/main`). `pnpm --filter rionovo-client build`: aprovado; permanece o aviso de bundle acima de 500kB, já existente.

A verificação visual local utilizou um snapshot de respostas de leitura, com gravações bloqueadas. Não foram efetuadas liquidações na produção. Os testes automatizados exercitam validação, seleção de conta, permissões, filtros, período, modal e dados obsoletos de requisições anteriores. Não houve alteração de API ou persistência.
