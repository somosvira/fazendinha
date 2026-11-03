# Proposta de Relatórios da Pecuária

Mockup navegável para aprovação, sem integração com API ou gravação de dados. Acesse `/mockups/relatorios-pecuaria/index.html` no servidor local.

Unifica Partos e pós-parto, Indicadores reprodutivos e Leite; prioriza o resultado, compacta filtros e separa consulta atual de emissão preservada. Histórico identifica relatório, sítio, período e emissão. Importação permanece ferramenta separada. Dados são ilustrativos e não comprovam disponibilidade de funcionalidades.

Revisão com impeccable e frontend-design: leitura primeiro; paleta neutra com verde discreto e vermelho apenas para desfecho; hierarquia por espaçamento e alinhamento; nenhuma informação desconhecida convertida em zero. Informações de origem ficam no detalhe, ajudas nas interrogações. Shadcn para tabs, diálogos, filtros, botões, badges e tabela. Controles de consulta, visualização e detalhes são navegáveis; exportação e preservação apenas explicam o comportamento pretendido.

A implementação posterior deve manter os contratos, autorizações, critérios, versões e snapshots das consultas reais. Não implementar o catálogo como funcionalidade real antes da aprovação.

## Builder proposto

O botão “Montar relatório” abre a proposta de configuração na própria página. Três fontes iniciais: Partos e pós-parto (um parto por linha), Reprodução (uma tentativa por linha) e Leite/ordenhas (uma ordenha por linha). Seleção e reordenação de campos, filtro categórico, ordenação e prévia em tabela/cartões. A proposta permite guardar configurações somente na memória da página, sem persistência real. O período é explicitamente ilustrativo.

Os campos são candidatos à implementação, sujeitos à conferência nos DTOs, autorização por área/sítio e regras de cada consulta. Não há cruzamento arbitrário entre fontes, soma de taxas nem conversão de não informado em zero. Persistência de modelos, exportação personalizada, agrupamentos e emissão de snapshots demandam definição e implementação posterior; não são funcionalidades existentes demonstradas por este mockup.
