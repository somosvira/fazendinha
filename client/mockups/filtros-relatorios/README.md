# Filtros dos relatórios — referência visual aprovada

Mockup em `/mockups/filtros-relatorios/index.html`, revisado com impeccable e frontend-design. Usa componentes shadcn existentes; dados ilustrativos, sem chamadas às consultas, alteração do banco ou implementação operacional. O seletor permite explorar os campos das fontes atuais. Somente a amostra de concepções simula a aplicação de critérios.

## Escopo proposto

Botão Filtros na consulta e no builder. Dialog com seleção em rascunho, aplicar/cancelar/limpar, critérios aplicados em chips, ajuda em tooltip. A troca de fonte limpa critérios incompatíveis. URL e modelos preservam apenas critérios validados para a fonte, sem guardar dados da consulta. Desktop é prioritário; o painel adapta campos e mantém rodapé acessível em tela menor.

- População dos motores reprodutivos: sítio autorizado, lote histórico, papéis por data e tipos de tentativa onde o cálculo os utiliza. Datas de início/fim, corte dos resultados, deslocamento analítico de TE, estimativa de concepção, modo IEP e janela de perdas usam os parâmetros já existentes, com limites e metodologia explícitos. Não oferecer um parâmetro em um relatório que não o utiliza.
- Registros factuais: permitir critérios sobre campos escalares comprovados da respectiva fonte, incluindo identificação, categoria/sexo/finalidade quando disponíveis, situação, origem, datas, quantidades, intervalos, produtos/parceiros/responsáveis, classificações e cobertura. Não presumir dimensões ausentes de um DTO nem usar categoria atual para responder por categoria histórica.
- Operadores adequados ao tipo: texto contém/igual/diferente; escolhas e booleanos; datas e números com limites/intervalos inclusivos; informado/não informado. Zero, falso, ausência e valor oculto são distintos. IDs técnicos e JSON de evidências não se tornam operadores numéricos. Valores monetários exigem autorização também para filtrar, evitando inferência por contagens.
- Exames/qualidade: formato/versão/campo/unidade delimitam comparações numéricas, sem comparar resultados heterogêneos nem inventar limites clínicos.
- Fontes atuais: filtro de posição atual; fontes históricas: referência factual de cada fonte. Estoque atual não ganha saldo histórico artificial. Cadastros compartilhados continuam identificados como tais.
- Critérios atuam no conjunto completo autorizado antes da paginação; conjuntos grandes exigem paginação/consulta no servidor, sem carregar fichas N+1. População é filtrada antes do cálculo. Refinamento de fatos/resultados é separado da população; resumos compatíveis acompanham o resultado filtrado sem somar/médiar taxas ou transformar ausência em zero. Mesmo filtro para cartões/tabela/CSV/builder, respeitando o limite explícito de exportação da página existente.

## Limites comprovados

A auditoria em `output/filtros-ideagri/` contém escolhas salvas e códigos, não a enumeração completa de opções da instalação. Estação de monta, regra de retoque, muco, temperatura/ECC e inferências clínicas não serão criados como filtros funcionais por semelhança de nome. Entram somente se o fato e a semântica forem confirmados na implementação existente. Categoria e situação produtiva históricas exigem prova na data; campos sem essa garantia permanecem indisponíveis naquele relatório. O objetivo é aproveitar todos os critérios comprovados, não copiar controles que não alterariam a consulta.

## Verificação prevista para implementação

Regressões por fonte para valores ausentes/zero, unidades, datas, combinação AND entre critérios, múltiplos valores OR do mesmo critério, escopo histórico, autorização monetária e filtro anterior à paginação. Testes dos motores preservam denominadores e histórico. Navegação/cancelamento, respostas obsoletas, exportação e modelos inválidos também precisam de cobertura.

A proposta foi aprovada. O painel operacional e os templates foram implementados; o estado vigente, regras e limites estão no [contrato de relatórios](../../../docs/pecuaria/relatorios.md#filtros-e-templates-de-critérios). Este mockup continua ilustrativo.
