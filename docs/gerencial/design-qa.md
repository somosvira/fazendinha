# Verificação visual do painel administrativo

Data: 18/10/2026. Escopo: revisão visual e funcional da implementação de `/gerencial` com os três gráficos e o resumo de compromissos.

## Evidência capturada

A aplicação autenticada foi conferida contra o banco local autorizado `fazendinha_seedatev3`, em contexto consolidado e período de 01/07/2026 a 18/10/2026. As capturas mostram a página inteira; seus pixels não foram esticados para coincidir com o viewport configurado.

- [Captura desktop](artefatos/painel-graficos-desktop.png): viewport configurado em 1440 × 1024 CSS px; raster retornado de 1425 × 2655.
- [Captura celular](artefatos/painel-graficos-celular.png): viewport configurado em 390 × 844 CSS px; raster retornado de 375 × 4696. `document.documentElement.scrollWidth` foi 390; a página não cria rolagem horizontal. A tabela mensal mantém sua própria rolagem horizontal para conservar as colunas legíveis.
- A consulta observada retornou R$ 124.200,00 recebidos e R$ 12.760,00 pagos no período. O saldo atual a pagar foi R$ 2.070,00, com R$ 850,00 vencidos e R$ 1.220,00 a vencer. O estoque retornou R$ 655.040,70 com situação completa e corte em 18/10/2026. Estes valores descrevem a consulta local capturada, não números fixos do painel.

## Interações verificadas

- Os três gráficos ficaram visíveis: recebimentos e pagamentos mensais, pagamentos por centro de custo e saldo a pagar por vencimento. Rótulos e valores continuam disponíveis em texto/tabela, sem depender do hover.
- No campo de início, ArrowUp mudou 01/07 para 02/07 e Enter aplicou o novo período à URL. Voltar pelo histórico restaurou 01/07.
- “Ver compromissos” abriu a lista com “A pagar” selecionado, escopo “Todo o período” e total de R$ 2.070,00, igual ao painel. Voltar retornou ao painel.
- O console do navegador terminou sem erros.

## Acessibilidade e limites

Os testes automatizados cobrem os nomes e valores textuais dos gráficos, estados vazios, mascaramento dos blocos restritos, estoque desconhecido sem conversão para zero, escopo nos links, entrada direta em compromissos e resposta antiga após troca de sítio. Blocos restritos e estoque desconhecido não foram visualmente homologados nesta captura real.

O percurso de teclado foi conferido para o filtro de período, mas não foi feita auditoria completa WCAG, medição instrumental de contraste nem homologação integral com leitor de tela. Aceite da fazenda, CI remoto e ambiente de destino são etapas independentes desta verificação local.

## Resultado

A composição desktop e móvel foi conferida após o ajuste de formatação monetária. Não foram observados cortes nos gráficos nem transbordamento horizontal da página no percurso capturado. A rolagem horizontal da tabela mensal fica contida no próprio bloco.
