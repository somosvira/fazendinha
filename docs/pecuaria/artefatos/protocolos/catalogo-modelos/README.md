# Catálogo de modelos — proposta visual

Mockup isolado para revisão. Não altera o cadastro operacional ou o banco. Os nomes, produtos, quantidades e instruções são fictícios, sem validade clínica.

- Alternância Cartões/Tabela compartilha busca, inclusão de inativos e paginação de até 10 protocolos.
- Cards exibem até quatro etapas explícitas e indicam as restantes; Ver detalhes abre modal de consulta com etapas, procedimentos, produtos/modelos, quantidade por animal, instruções e modo de atendimento.
- Etapas do modal são paginadas em até 10 registros. O exemplo “Modelo extenso” permite testar a segunda página. Os demais exemplos incluem até três procedimentos por etapa; na implementação, listas de procedimentos também devem respeitar o máximo de 10.
- IA/TE não fixam material genético; o detalhe informa sua definição no atendimento. Exames referenciam modelo cadastrado.
- Ausência de agrupamento em versões antigas é apresentada como procedimentos individuais; não se inferem etapas pela data nem modo de atendimento ausente.
- Protocolos ativos são o padrão. Inativos têm identificação própria. Cadastros antigos não concluídos conservam aviso e acesso Concluir cadastro; a demonstração apenas explica esse encaminhamento.
- Nova versão/Inativar são ações separadas da consulta. Inativação é simulada em memória. Novo protocolo aponta ao builder local existente; Nova versão explica o encaminhamento previsto, sem usar um ID fictício na aplicação; o mockup não cria versões.

Abrir `index.html` ou servir a pasta `docs/pecuaria` e acessar `/artefatos/protocolos/catalogo-modelos/`. `?area=sanitario` apresenta o mesmo padrão no domínio sanitário.

Mockup aprovado e aplicado aos dois cadastros. A implementação usa `CatalogoModelosProtocolos` e `DetalheModeloProtocolo`; as regras descritas na entrega estão no [contrato dos protocolos](https://github.com/somosvira/fazendinha/blob/4271f29952902fa1e4ccb30909b6c11afa35d607/docs/pecuaria/protocolos-exames.md). A demonstração permanece isolada com dados fictícios. No legado real, etapas não agrupadas e modos não informados continuam explícitos.

Revisão visual orientada pelo Impeccable e pelos componentes atuais de consulta. Naquela revisão, a skill `frontend-design` estava indisponível. Para novos mockups, siga o [fluxo por ambiente](../../../../../AGENTS.md#ferramentas-para-definir-e-criar-mockups).

Conferência local: sintaxe JavaScript, carregamento HTTP, cards/tabela, busca, inclusão de inativos, navegação do catálogo (10 + 1 registros) e das etapas do modal (10 + 2). Layout inspecionado em desktop e em iframe de 390 px; não representa homologação em aparelho físico. Prévias `preview-cards.png`, `preview-table.png`, `preview-modal.png` e `preview-mobile.png` registram a apresentação. Nenhuma escrita no banco ou alteração na interface operacional foi executada.
