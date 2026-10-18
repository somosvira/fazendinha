# Verificação visual do painel administrativo

Data: 18/10/2026. Referência: mockup único aprovado. Escopo: apresentação em `/gerencial`, dentro da aplicação existente.

## Referência e evidências

- Fonte: `/Users/montes/.codex/generated_images/01a14a2e-000e-7a80-85be-b5a41be76a4c/exec-22985031-66e5-468e-866e-237e73da3b89.png`.
- Fonte raster: 1487 × 1058; frame pretendido: desktop 1440 × 1024.
- Implementação: `http://127.0.0.1:41881/gerencial?inicio=2026-10-01&fim=2026-10-17`.
- Captura desktop: `docs/gerencial/artefatos/painel-adm-desktop.jpg`, 1425 × 1013 pixels retornados pelo navegador com viewport configurado em 1440 × 1024 CSS px. O navegador integrado captura a área disponível sem a barra de rolagem; não foi esticada a imagem para aparentar correspondência pixel a pixel.
- Captura da página completa: `docs/gerencial/artefatos/painel-adm-desktop-completo.jpg`.
- Comparação conjunta da fonte e captura desktop: `docs/gerencial/artefatos/painel-adm-comparacao.jpg`.
- Comparação conjunta focada em centros, custos e nutrição: `docs/gerencial/artefatos/painel-adm-comparacao-detalhe.jpg`.
- Composições de comparação preservam proporções e usam miniaturas de até 890 pixels de largura por lado. Os originais foram preservados. É uma comparação visual de hierarquia e legibilidade, não medição de fidelidade geométrica exata.
- Celular: viewport 390 × 844 CSS px; `painel-adm-celular.jpg` e `painel-adm-celular-nutricao.jpg`, no mesmo diretório de artefatos.
- Perfil restrito real: `docs/gerencial/artefatos/painel-adm-restrito.jpg`.

Estado: aplicação autenticada, API real na worktree e banco local autorizado `fazendinha_seedatev3`. Desktop/celular autorizado usa período 01–17/10/2026; estoque tem corte próprio de 18/10/2026. Restrito usa período padrão 01–18/10/2026. Não há fetch congelado nesta verificação integrada.

## Histórico da comparação e correções

1. Primeira comparação conjunta: `/tmp/fazendinha-painel-mockup-baseline/comparacao-inicial.jpg`. Encontrado P2 de densidade: quatro expansões nutricionais e duas de custos aumentavam desnecessariamente a altura inicial. Resultado inicial bloqueado para ajuste.
2. Correção: detalhes agrupados sob “Detalhes da nutrição” e “Detalhes dos custos diretos”, com avisos próximos dos valores e espaçamentos compactados. Os detalhes anteriores foram preservados.
3. Verificação no sítio Destino revelou P2 de texto para valor desconhecido: “Inclui Não apurado de nutrição”. Corrigido para explicar que o custo não está apurado; singular/plural também corrigidos. O valor não foi convertido em zero.
4. Nova captura desktop e comparação conjunta final mostram a composição corrigida. A captura móvel de nutrição mostra valor, cobertura, aviso e índices sem corte ou colisão.

## Superfícies avaliadas

| Superfície | Avaliação |
|---|---|
| Fontes e tipografia | Hierarquia editorial com títulos/valores serifados e texto funcional sem serifa. O serifado local usa Georgia como aproximação da referência; diferenças de peso e desenho são refinamento P3, sem prejuízo observado de leitura. Valores diários mantêm quatro casas; média populacional tem uma casa. |
| Espaçamento e organização | Resumo horizontal, centros abertos, colunas de centros/custos e nutrição, estoque abaixo. Margens, alinhamento numérico e divisores consistentes. Em celular os blocos seguem uma coluna, sem transbordamento horizontal da página no recorte verificado. |
| Cores e estados | Papel claro, verde discreto e âmbar para parcial/pendente. Restrição textual e ícone, sem depender apenas da cor. Contraste não foi medido instrumentalmente. |
| Imagens e ícones | O mockup não exige foto/ilustração/asset raster novo. Mantida a marca real do Shell; usados ícones Lucide existentes e progress nativo. Nenhuma ilustração foi substituída por desenho em CSS/SVG artesanal. |
| Textos e conteúdo | Rótulos coerentes, custo desconhecido distinto de zero e cobertura explicitamente de animal-dias. Produtos e transações contados por identidade distinta. Não há rótulo “Proposta visual” dentro da página operacional. |

## Diferenças intencionais da referência

- O Shell atual Terrano, a seleção global de sítio e os dois inputs de data substituem o cabeçalho ilustrativo Fazendinha e o campo único de período. A seleção não foi duplicada.
- Sanidade desconhecida, pendências por finalidade, aviso de alcance nutricional e detalhes foram preservados conforme o plano; a tela real é mais longa e o estoque não cabe inteiro no primeiro viewport desktop. O atalho Estoque permite alcançá-lo diretamente. Remover esses dados para caber no frame reduziria o contrato de consulta aprovado.
- A amostra tem 13 produtos em 27 grupos; a contagem ilustrativa de 27 produtos foi corrigida para identidades distintas. A data do estoque vem da consulta real de 18/10/2026.

## Interações observadas

- Login com dono e operador locais; operador não mostra valores nas áreas monetárias do painel e preserva clínica autorizada.
- Seleção global de sítio Destino: contexto e `propriedadeId=115` atualizados.
- Mudança da data inicial via teclado nativo e Aplicar período: URL atualizada; voltar/avançar restauram contexto; recarga conserva consulta.
- Atalho Nutrição leva e transfere foco à seção, sem alterar a query.
- Detalhes da nutrição e recorte de vacas abrem; expansão por Enter funciona.
- Link nutricional abre o módulo existente com período; voltar restaura o painel.
- Logs do navegador consultados ao final do percurso restrito retornaram sem erros/avisos.
- Celular: `innerWidth=390`, largura de documento 375 (área sem scrollbar); tabela tem conteúdo 430 dentro de bloco de 293, com rolagem própria.

## Pendências e limites

- Sem achados visuais acionáveis P0/P1/P2 após as correções descritas.
- P3: refinar correspondência do serifado e scrollbar dos atalhos móveis se necessário após uso real.
- Não constitui auditoria WCAG: leitor de tela, zoom, contraste medido e todos os destinos operacionais não foram homologados integralmente.
- Aceite com a fazenda, CI remoto e ambiente de destino permanecem etapas separadas.
- Testes automatizados e resultados de build ficam no HTML da entrega; esta aprovação é visual e funcional para o percurso observado.

## Checklist da implementação

- [x] Referência e implementação abertas e comparadas conjuntamente.
- [x] Comparação focada de tabela, métricas e cobertura.
- [x] Corrigir densidade inicial e texto de custo desconhecido.
- [x] Capturar novamente após correções.
- [x] Conferir celular, navegação principal e restrição com perfil real.
- [x] Registrar diferenças intencionais e limites de evidência.

final result: passed

## Integração para o PR separado

Após incorporar a main atual, foram corrigidos o sítio selecionado ao entrar pelo menu e a restauração do sítio nos links de origem. A revisão independente reconferiu essas correções. Passaram 89 testes focados do cliente e 16 do backend, além dos builds do cliente e servidor. Esta etapa não repetiu a inspeção visual acima nem executou integração com escritas.
