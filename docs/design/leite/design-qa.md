# Inspeção visual — produção de leite

> Registro histórico da apresentação anterior. Para a adaptação aprovada ao padrão da main, consulte a [verificação atual](implementacao-main/README.md). As capturas abaixo não representam o layout vigente.

result: passed

Resultado restrito ao cenário visual descrito. Não comprova migrations aplicadas, concorrência no PostgreSQL, integração com o seed ou homologação real da fazenda.

## Referência e cenário

- Referência aprovada: [opção 2 — Ordenha em foco](ordenha-aprovada.png).
- Contexto e adaptações: [PRODUCT.md](PRODUCT.md).
- Capturas válidas: [desktop](review/desktop.png), [celular](review/mobile.png).
- Amostras adicionais: comercial em [desktop](review/comercial-desktop.png) e [celular](review/comercial-mobile.png), qualidade em [desktop](review/qualidade-desktop.png) e [celular](review/qualidade-mobile.png), [relatório preservado](review/relatorio-desktop.png) e [segregação de origens](review/segregacao-desktop.png).
- Dimensões solicitadas: 1487 × 1058 e 390 × 844. O navegador preservou o zoom do usuário em 110%; o viewport CSS efetivo é menor. A captura direta via CDP conserva as dimensões do viewport de imagem e evita o recorte incorreto observado na API de screenshot intermediária.
- Componentes reais da aplicação, com catorze animais e medições ilustrativas: Manhã completa, Tarde parcial e Noite não informada. A prévia se identifica como QA com dados ilustrativos, sem banco. Não foi usado endpoint operacional para gravar esses números.

## Comparação

A composição conserva título/data, seleção de ordenha, uma coluna de litros por animal, resumo diário, cobertura e ação de salvar persistente. Os números da referência são ilustrativos; a implementação soma suas próprias medições e não reproduz totais inconsistentes. Horários, raça e lote ausentes não foram preenchidos para copiar a imagem. O shell é o componente real existente.

No desktop, tabela e resumo aparecem lado a lado. No celular, as ordenhas rolam horizontalmente dentro do grupo; a selecionada é revelada ao carregar, mudar posição/data ou redimensionar. O filtro mantém inclusão à esquerda e busca legível à direita. A primeira linha e seu campo de litros ficam visíveis acima do rodapé no cenário capturado. A tabela conserva rolagem horizontal para suas colunas.

Revisão independente Impeccable: `disposition: ship`, restrita aos ajustes pontuados. Foram corrigidos seleção fora de vista, busca comprimida e declaração incompleta de abas. A seleção agora usa grupo de botões nativos com `aria-pressed`; a execução manual completa de teclado não foi feita. Foco visível e estados de zero, desconhecido, parcial e consulta permanecem no código e nos testes.

## Detector e limites

O [detector](review/detector.json) foi executado uma vez. Seu único aviso, `border-accent-on-rounded`, apontou uma linha CSS então minificada que reunia o sublinhado da navegação com outras regras arredondadas. A borda está na navegação sem arredondamento, não numa lateral de cartão; aviso avaliado como falso positivo. Não foi repetido o detector para obter uma saída artificialmente limpa.

Na rodada ampliada foram inspecionados a listagem comercial e seus formulários de criação, a listagem de qualidade, a emissão preservada aberta e a separação entre leite comercial e colostro. As capturas finais de ordenhas e qualidade mostram a navegação com nove seções. Tabelas comerciais e de qualidade mantêm rolagem horizontal local; seus contêineres têm foco e descrição explícitos. O gráfico com um dia limita a largura da barra. A revisão independente Impeccable não encontrou novo bloqueio visual nessas amostras.

Estoque, programação e destinos têm testes focados e foram amostrados no código; a [captura adicional de estoque](review/estoque.png) é auxiliar. Estados de falha, vazios, edição, navegação completa por teclado e toda a jornada de venda/recebimento não tiveram uma rodada visual completa. Nenhum formulário financeiro foi confirmado como transação real. A prévia histórica aguarda os registros de origem; suas linhas ilustrativas não constituem carga. A aprovação desta inspeção não amplia o escopo para essas jornadas nem para dados reais. A V5 continua com as pendências descritas no [contrato funcional](../../pecuaria/leite.md).
