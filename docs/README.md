# Documentação do projeto

Para discutir uma tela, comece pelo [produto](../client/PRODUCT.md), pelo [design](../client/DESIGN.md) e pelo [fluxo de trabalho](../AGENTS.md#fluxo-de-alterações-visuais). O manual explica como usar o sistema. As referências abaixo ajudam a investigar questões específicas.

## Entender e operar

| Documento | Conteúdo |
|---|---|
| [Manual navegável HTML](guia/index.html) | Financeiro → Operações/Estoque; Pecuária → Rebanho/Reprodução/Produção/Sanidade/Nutrição; registro, consulta e correção dos fatos |
| [Fontes do manual](guia/README.md) | Capítulos editáveis e regeneração do HTML |
| [Estados do animal](pecuaria/estados-animal.md) | Eixos independentes, evidências, transições e desconhecimento |
| [Lacunas e limites](lacunas.md) | Perguntas para decisão e levantamento histórico datado |

## Referências por domínio

Para usar Financeiro, Estoque, Pecuária e Leite, abra os capítulos do [manual](guia/README.md). As [decisões de negócio](decisoes-de-negocio.md) explicam o motivo das distinções mais importantes. As [questões para decisão](lacunas.md#questões-para-decisão) ficam fora do manual.

Para conferir o que o sistema executa, consulte os serviços e testes de [Financeiro](../server/src/services/financeiro/), [Estoque](../server/src/services/estoque/), [Pecuária](../server/src/services/pecuaria/) e [Leite](../server/src/services/pecuaria/leite/). As [rotas](../server/src/routes/) definem os acessos e comandos disponíveis.

Os documentos reúnem propostas, descrições de implementação e decisões de épocas diferentes. Para uma regra relevante à tarefa, confira o comportamento no código e nos testes. Para afirmar que houve aceite de produto ou homologação, localize a decisão ou a evidência do cenário correspondente.

| Documento | Quando consultar |
|---|---|
| [Produtos](produtos.md) | Catálogo de produtos do sistema (fabricante, classificação técnica, princípios ativos), produtos da fazenda e adoção; carga por migration de dados |
| [Referência IDEAGRI do leite](pecuaria/leite-ideagri-referencia.md) | Proveniência e limites do mapeamento, sem presumir importação automática |
| [Painel gerencial](painel-gerencial.md) | Caixa, estoque, custos, nutrição, produção e cobertura |
| [Busca global](busca-global.md) | Registros, páginas, ações, destinos, escopo, permissões e manutenção do catálogo |
| [Assistente Terrano](assistente-consulta.md) | Conversa, pesagem com confirmação, Radar, gates e política de custo |
| [Metas](metas.md) | Página independente, indicadores, medições, etapas, histórico e permissões |

## Arquitetura, design e desenvolvimento

| Documento | Conteúdo |
|---|---|
| [README](../README.md) | Visão do projeto e comandos |
| [Arquitetura](../ARCHITECTURE.md) | Organização, runtime, autorização, banco e testes |
| [System design](system-design.md) | Fronteiras, relações, fatos/snapshots e fluxos entre domínios |
| [Contexto de produto](../client/PRODUCT.md) | Percurso de registro e análise, princípios e limites |
| [Design system](../client/DESIGN.md) | Princípios compartilhados de leitura, interação, identidade visual e reúso |
| [Desenvolvimento](desenvolvimento.md) | Banco local único, seed integrada, dados e importadores |
| [Guia da seed](../server/prisma/seed/README.md) | Preparação autorizada, retomada e conferência do cenário V5 |
| [Deploy](../DEPLOY.md) | Cloudflare Workers/Neon/R2 e reconciliação da baseline |
| [Orientações para agentes](../AGENTS.md) | Escopo, preservação, implementação e documentação |

## Evidências e referências históricas

A [pesquisa de interfaces agro](design/pesquisa-interfaces-agro.md) documenta referências examinadas em uma revisão anterior.

### Referência visual de responsividade

[Responsividade e densidade da interface](design/responsividade/README.md) registra a revisão do shell, da navegação lateral e dos protocolos. A grade de animais mostrada ali é histórica; a [aba Animais](../client/DESIGN.md#overview) tem referência própria. Evidência local não substitui homologação em STG e dispositivos físicos.

[QA de interface](../design-qa.md), [QA do leite](design/leite/design-qa.md), [QA gerencial](gerencial/design-qa.md) e [validação operacional](design/validacao-refino-operacional.md) conservam suas datas, cenários e limites. Mockups aprovados continuam como referência visual com dados ilustrativos; não comprovam persistência ou disponibilidade.

Os roteiros [V3](pecuaria/artefatos/testes-v3-guia.html), [V4](pecuaria/artefatos/testes-v4-guia.html), [follow-up V4](pecuaria/artefatos/testes-follow-up-v4.html) e [finalidade V5](pecuaria/artefatos/homologacao-v5-finalidade.md) preservam IDs, aceites e armazenamento próprios. A preparação histórica pode não existir na seed atual; registre o bloqueio sem recriá-la ou alterar o aceite pela revisão documental.

O material conceitual de [protocolos](pecuaria/artefatos/protocolos/index.html), [V4](pecuaria/artefatos/conceitos-v4.html) e seus mockups conserva proveniência. As propostas antigas têm o escopo e a data das respectivas entregas. O Git preserva também as [anotações de design do Financeiro em outubro](https://github.com/somosvira/fazendinha/blob/4271f29952902fa1e4ccb30909b6c11afa35d607/MEMORY.md). Skills em `.agents/skills/` são ferramentas e não contratos do produto; não se remove seu funcionamento numa limpeza documental.

[Ficha do animal — Geral](pecuaria/planos/ficha-animal-geral.md) registra as decisões da reorganização implementada, as verificações por rodada e seus limites. Os [princípios de design](../client/DESIGN.md) orientam propostas futuras.
