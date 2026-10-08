# Design QA — reorganização da navegação

**Status: bloqueado para aprovação visual.**

## Escopo

- Referências: `output/design/remanejamento-sidebar-2026-10-07-v2/imagens/`.
- Telas previstas para conferência: Rebanho, Sanidade, Pesagem e manejo,
  Nutrição, Configurações Financeiro, Configurações Pecuária, Protocolos,
  ficha do animal e Estoque/Produto.
- Viewports planejadas: 1440 × 1000 e mobile.

## Evidência executada

- Build de produção do cliente concluído com sucesso.
- Testes focados de rota, autorização, sidebar, ficha contínua, Sanidade,
  Nutrição e receitas concluídos com sucesso.
- Chromium local abriu a aplicação em `http://127.0.0.1:41875`; a captura do
  login está em `/tmp/terrano-browser.png`.

## Bloqueio

O ambiente local autenticado não ficou disponível: o login de QA documentado
retornou `erro 500` pela API local. Sem uma sessão não foi possível capturar e
comparar as nove telas de operação contra os mockups. Nenhuma aprovação visual
é inferida desta evidência. Quando a API de login estiver disponível, repetir a
captura desktop e mobile das nove rotas acima e atualizar este documento com
as divergências e seu status.
