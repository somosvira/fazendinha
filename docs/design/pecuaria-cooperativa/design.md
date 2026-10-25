# Pecuária V1–V5 — Cooperativa contemporânea

Pecuária compartilha identidade, navegação, consultas e primitivas com Financeiro e Estoque. Este guia descreve a composição atual; regras zootécnicas e efeitos pertencem aos [contratos pecuários](../../pecuaria/README.md). Tokens atuais estão no [design system](../../../client/DESIGN.md) e no [guia unificado](../cooperativa-unificada.md).

## Estrutura e navegação

Rebanho, Reprodução, Visitas, Leite, Sanidade, Nutrição e Relatórios são entradas próprias. Configurações concentra catálogos e políticas. Aliases históricos e contratos de URL continuam preservados; pesagem coletiva é ação da seleção de Animais.

O panorama do Rebanho mostra população e distribuições com denominador. Animais prioriza busca, filtros e consulta. Lotes oferece cartões e tabela, com composição/desempenho e cobertura. Ficha animal organiza Resumo, Cadastro, Histórico, Reprodução, Sanidade, Nutrição e Produção para fêmeas; ficha de lote conserva abas e fragmentos históricos.

Reprodução separa acompanhamento, agenda, protocolos, partos e indicadores. Visitas oferece Agenda do dia e Seleção livre, seguidas de preparação/atendimento. Filtro, seleção de animais, programação e fato executado não recebem o mesmo tratamento de estado.

Leite tem sete consultas: Ordenhas, Produção, Estoque, Coletas, Qualidade, Vendas e Alimentação e descarte. Configurações, relatórios e prévia histórica têm caminhos próprios. O [contexto visual V5](../leite/PRODUCT.md) conserva decisões da captura geral/individual; o contrato define os efeitos.

## Consulta e composição

Reutilize PageHeader, SubTabs, BarraConsulta, PainelFiltros, TabelaFinanceira e as primitivas de campos/diálogos. Cabeçalho e navegação ficam presentes durante carregamento. Falha não é apresentada como coleção vazia; um recorte sem resultados oferece revisão de filtros, sem sugerir cadastro a leitores.

Filtros adicionais/coluna usam rascunho até Aplicar. Paginação, ordenação e filtros mantêm contexto na URL quando previstos. Não ordenar apenas a página atual de uma coleção paginada no servidor. Cartões e tabelas compartilham dados, ações e permissão; documentos emitidos mantêm sua composição.

Seções principais da ficha são legíveis diretamente; evidências auxiliares podem expandir. Tabelas e valores exatos permanecem disponíveis quando existe alternativa gráfica. Não usar gráficos de uma página como total do rebanho nem juntar quantidades de unidades diferentes.

## Estados do animal e da operação

Finalidade, papel, diagnóstico, elegibilidade, lactação, carência e atividade são eixos independentes. Uma vaca pode ser gestante/lactante e estar em carência. Rótulos devem indicar evidência, data e desconhecimento, conforme o [modelo de estados](../../pecuaria/estados-animal.md).

Progresso do protocolo representa tarefas, não eficácia clínica. Ocorrência encerrada não autoriza “saudável”. Consumo atribuído não é ingestão medida. Medição salva não é estoque confirmado. Coleta não é recebimento. Cor não deve ocultar essas diferenças.

## Formulários e confirmação

Cadastros, fatos e correções usam rótulos explícitos, datas e motivos conforme o contrato. Ações frequentes ficam próximas do contexto; comandos irreversíveis/regularizações têm a confirmação existente. Cancelar, falha, gravação e reenvio preservam os campos e a identidade do trabalho.

No Leite, rascunho local, salvo e confirmado no estoque aparecem separadamente. Versão vencida exige conferência; não sobrescrever silenciosamente. Origens, tanques, natureza, produto e motivo não devem receber valores inventados para reproduzir um mockup.

## Fontes visuais e validação

O acabamento comum está em `cooperativa-theme.css`, `identidade-rural.css`, `tabelas-operacionais.css` e `rebanho-layout.css`; módulos acrescentam composição específica. Capturas de `output/qa/` de outubro de 2026 eram locais, não estão versionadas nesta árvore e não são links de operação.

As referências preservadas de [Reprodução](../reproducao/mockup-v1/README.md) e [Leite](../leite/PRODUCT.md) usam exemplos ilustrativos. [QA histórico](../../../design-qa.md) e [QA V5](../leite/design-qa.md) não comprovam automaticamente o banco atual, R2 ou homologação de campo. Atualizações de documentação não redefinem direção estética nem aprovam uma nova interface.
