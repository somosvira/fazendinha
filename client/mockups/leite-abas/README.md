# Proposta visual para as outras abas do Leite

Estado: proposta aprovada pelo usuário; implementação operacional descrita em `docs/pecuaria/leite.md` e `docs/pecuaria/leite-qualidade.md`. Este arquivo continua sendo apenas o protótipo estático.

Abrir com o servidor local: `/mockups/leite-abas/index.html`.

O protótipo usa os componentes shadcn existentes (Card, Button, Badge, Tabs, Dialog, Input e SelectCampo), a ajuda por campo `AjudaCampo`, o alternador de visualização e a distribuição de consumo já implementada. A identidade atual é preservada; os componentes tornam a comparação de volumes e estados mais direta.

Os dados são estáticos. Estoque e algumas ordenhas/retiradas reproduzem exemplos observados na base local em 26/10/2026; valores comerciais, laudos e série temporal contêm exemplos ilustrativos. A série de qualidade exibe três datas exemplificadas, não resultados reais consultados. Os botões de comando abrem uma descrição da continuidade proposta, sem salvar ou simular uma operação concluída. A busca, o filtro de preço, os detalhes, as ajudas, a troca de parâmetro, a restrição demonstrativa de valores e o toggle funcionam dentro do protótipo. Paginação é apenas representada. Tabelas simplificadas ilustram a alternância, sem substituir as colunas reais na implementação.

## Propostas por rotina

- **Ordenhas:** volume principal, composição por natureza e ações conforme estado. Destacar ausência de aferição antes de eventual pendência de classificação. Resumo de todo o recorte independente da página. Não preencher ausências com zero.
- **Estoque:** barra de composição do saldo físico, três naturezas e coberturas de classificação/custo separadas. Produtos em linhas compactas. Não é um medidor de capacidade nem uma representação da localização atual em tanque.
- **Coletas:** cronologia com data física, litros, comprador e preço pendente/definido. A consulta atual é paginada e não fornece volume agregado de todo o recorte; não somar a página como se fosse o total.
- **Qualidade:** resultados e unidades visíveis no cartão, pendências separadas. Evolução apenas dentro da mesma identidade de série, formato, origem e unidade. Parâmetros não numéricos continuam com representação própria. O gráfico de todo o recorte exige fonte compacta de série completa, pois a consulta atual é paginada. Sem julgamento clínico, conversão implícita ou preço inferido.
- **Vendas:** destacar litros e valores já disponíveis no DTO, preservar valor restrito e preço pendente. Operação aberta mostra retirada física; fechamento mostra reconhecimento comercial. Venda avulsa tem etapas próprias. Venda não significa recebimento financeiro.
- **Alimentação e descarte:** reaproveitar o componente de distribuição já aprovado e manter os registros rastreáveis abaixo. O resumo inclui Nutrição; a lista de destinos diretos não equivale ao total do dia. No protótipo, Funcionários/Casa permanecem ilustrativamente em aberto; a implementação passou a registrar as retiradas internas, conforme o contrato vigente. Preservar também o histórico de descarte físico e seus comandos na implementação.

## Revisão das telas atuais

Inspeção da interface local autenticada e fontes dos componentes/serviços. Não foram feitas gravações, estornos, importações, emissões novas nem homologação completa de todos os comandos.

| Prioridade | Evidência atual | Encaminhamento |
| --- | --- | --- |
| Alta | Estoque apresenta `descarteLitros`/natureza `NAO_COMERCIAL` como “Descarte”, ainda dentro do saldo. | Rotular como “Não comercial”; reservar “Descarte físico” para a saída confirmada. Mesmo cuidado nos filtros de ordenhas. Não renomear DTO incidentalmente. |
| Alta | Ordenhas pode priorizar `A_CLASSIFICAR` sobre `SEM_AFERICAO` no rótulo da situação. | Mostrar primeiro “Sem aferição”; classificação/estoque são dimensões distintas. |
| Média | Vendas recebe `quantidadeLitros`, `valorTotal` e resumo do recorte, mas a listagem não os destaca. | Aproveitar o DTO existente com rótulos conforme modalidade/estado e respeito a `verValores`. |
| Média | Ordenhas, Coletas e Qualidade usam cartões genéricos altos com campos repetidos. | Composição compacta por domínio, litros/datas/resultados prioritários, tabela alternativa preservada. |
| Média | Qualidade mostra resultados por parâmetro apenas em tabela e mistura controles nativos com os componentes do sistema. | Uniformizar shadcn e permitir visualização numérica de uma série comparável, mediante consulta adequada. |
| Média | Alimentação/descarte tem filtros e histórias independentes; o volume nutricional não aparece como destino direto. | Mostrar o escopo de cada consulta e as origens no detalhe; não misturar os totais ou esconder estornos. |
| Média | Configurações ocupa muitas linhas com previsão de coleta repetida como tabela. | Proposta posterior: faixa de dias previstos, vigência clara e cartões de equipamentos; manter tabela de calibração técnica. Não representar previsão como coleta realizada. |
| Média | Relatório preservado aberto cresce com várias tabelas longas e operações comerciais de muitas colunas. | Sumário por seção, indicadores operacionais e composição visual com base no snapshot; manter detalhamento tabular/exportação e período integral dos acordos. Nunca recalcular uma emissão antiga com o estado atual. |
| Baixa | Conferir importação repete títulos e tem instrução solta sob o arquivo. | Compactar cabeçalho, distribuir em etapas Arquivo / Validação / Prévia e mover ajuda complementar por campo. Manter a evidência de litros e a conferência explícita, pois evitam erro de importação. |

## Limites para implementar

Preservar URLs, filtros, escopo por sítio, paginação no servidor, origem e autoria dos registros, vínculos de documentos, permissões, correções/estornos e versões. Ausência de aferição, valor desconhecido, zero medido e valor restrito continuam diferentes. Gráficos não substituem as leituras exatas ou a navegação para a origem.

Validado nesta proposta: compilação TypeScript do protótipo e dependências importadas; navegação das seis abas no navegador, apresentação visual desktop, alternância tabela/componentes, ajuda por campo e abertura/fechamento de detalhe. Sem aprovação final de acessibilidade/mobile ou testes de escrita do domínio. Esta proposta registra a inspeção direta e o desenho aprovado; o contrato do domínio descreve a implementação e seus limites de validação.
