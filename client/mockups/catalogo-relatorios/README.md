# Expansão dos relatórios com dados existentes — proposta

Mockup de escopo em `/mockups/catalogo-relatorios/index.html`. Reaproveita o padrão aprovado dos quatro relatórios complementares, com seleção de área para o catálogo maior. Dados explicitamente ilustrativos: não consulta API, não representa importação IDEAGRI e não comprova entrega operacional. Botões e filtros demonstram composição; exportação não gera arquivo.

## Pacote proposto: 27 fontes factuais

| Área | Fontes | Evidência funcional para implementação |
|---|---|---|
| Rebanho | Cadastro/situação atual, último peso/GMD, histórico de pesagens, lotes, movimentações, baixas, genitores e materiais genéticos | `client/src/pecuaria/rebanho/api.ts`, `types.ts`; `server/src/routes/pecuaria/rebanho.ts`; serviços de rebanho e cálculo de peso existentes |
| Reprodução | Tentativas, gestações, lactações e agenda de protocolos | API e serviços de Reprodução e núcleo comum de protocolos; quatro relatórios de acompanhamento já implementados permanecem disponíveis |
| Sanidade | Ocorrências, aplicações, exames/resultados e carências | `server/src/routes/pecuaria/sanidade.ts`; consultas paginadas e por data/sujeito existentes |
| Leite | Qualidade/resultados, coletas, vendas, estoque/origens, fornecimentos, descartes e retiradas internas | Rotas `leite-qualidade.ts`, `leite-consultas-comerciais.ts`, `leite-consultas-v5.ts`, `leite-retiradas-internas.ts` e demais operações do leite; relatórios de produção existentes permanecem disponíveis |
| Nutrição | Composição versionada de dietas, atribuições/vigências e fechamentos de consumo | `server/src/routes/pecuaria/nutricao.ts`; DTOs em `client/src/pecuaria/rebanho/nutricao/api.ts` |
| Custos diretos | Componentes de custos operacionais registrados, por escopo autorizado | `client/src/pecuaria/rebanho/custos/api.ts`; serviços existentes de custo e cobertura, com autorização de valores |

Filtros de situação/categoria/finalidade não são novos modelos de dados; reutilizar a consulta correspondente. Catálogos de raças, categorias, doenças, tipos de exame/aplicação e perfis de formatos podem ser oferecidos como modelos auxiliares de cadastro ao integrar suas variáveis, sem duplicar os relatórios factuais. Relatórios financeiros já existentes permanecem no Financeiro, com seus gates; não transferir dados monetários para Pecuária por mera disponibilidade física da tabela.

## Limites de implementação

- Sem novas coletas, colunas obrigatórias ou importações para tornar esses relatórios utilizáveis com os registros atuais. Fontes ainda sem consulta consolidada podem exigir um endpoint de leitura autorizado; não montar N+1 de fichas no cliente nem considerar dados de outra página como conjunto completo.
- Uma fonte corresponde a uma granularidade. Exames/qualidade têm uma observação por campo e sujeito, com versão/formato/unidade. Não somar resultados incompatíveis. Movimentação e seus participantes podem exigir fonte de itens separada, sem multiplicar totais do cabeçalho.
- Posição atual não se converte em efetivo de uma data passada. Carências usam referência; pesagem usa data do fato; baixas usam data da baixa; nutrição conserva intervalos e permanência. Fila atual e histórico não são a mesma população.
- Estoque, produção, coleta, venda, retirada interna e descarte são fatos separados. Cadastro de material não comprova saldo. Dieta atribuída não comprova consumo. Custo conhecido parcial não é lucro.
- Valor oculto, ausente, pendente e zero permanecem distintos. A autorização é do servidor. Exportações devem conferir permissão, escopo e recorte completo; nunca oferecer uma página como exportação integral.
- Cada fonte nova entra no catálogo do builder na mesma alteração, com campos, granularidade e unidade. Referências e autoria podem ser secundárias, mas permanecem selecionáveis quando autorizadas.
- Modelos customizados do IDEAGRI com filtros sem definição não serão copiados pelo nome. Sobrevivência, padrões raciais, persistência/projeções, indicadores epidemiológicos, otimização nutricional, custo econômico integral, benchmarking, FIV e clima não são simples apresentações de consultas existentes: exigem definição/validação ou dados fora do escopo.

Revisão com impeccable e frontend-design: preservação do padrão aprovado, hierarquia compacta, agrupamento por área, variáveis em interrogações shadcn, tabela/cartões sobre a mesma fonte e indicação da referência temporal. Mockup aprovado pelo usuário. A implementação operacional e seus limites vigentes estão em [Relatórios da Pecuária](../../../docs/pecuaria/relatorios.md#catálogo-operacional); este artefato continua ilustrativo.
