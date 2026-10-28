# Documentação do projeto

A documentação vigente descreve a base integrada até a V5. Comece pelo manual para entender o produto; consulte os contratos para regras completas e o código/SQL para conferir a implementação. Merge, deploy, testes e homologação são evidências diferentes.

## Entender e operar

| Documento | Conteúdo |
|---|---|
| [Manual navegável HTML](guia/index.html) | Financeiro → Operações/Estoque; Pecuária → Rebanho/Reprodução/Produção/Sanidade/Nutrição; exemplos, estados, diagramas e lacunas |
| [Fontes do manual](guia/README.md) | Capítulos editáveis e regeneração do HTML |
| [Estados do animal](pecuaria/estados-animal.md) | Eixos independentes, evidências, transições e desconhecimento |
| [Lacunas e limites](lacunas.md) | Limitações verificadas e perguntas sem implementação aprovada |

## Contratos vigentes

| Documento | Quando consultar |
|---|---|
| [Financeiro e Estoque](financeiro-rebuild-contrato.md) | Operações, obrigações, dinheiro, efeitos físicos, valores, estornos e autorização |
| [Visão geral financeira](financeiro-dashboard-grid.md) | Bases dos indicadores e navegação para detalhes |
| [Pecuária](pecuaria/README.md) | Rebanho, genética, sanidade, peso, nutrição e integrações |
| [Alertas e programação sanitária](pecuaria/alertas.md) | Núcleo persistido, idade/data fixa, calendário, atendimento e cobertura |
| [Reprodução](pecuaria/reproducao.md) | Tentativas, gestação, parto/crias, lactação, visitas, políticas e indicadores |
| [Protocolos e exames](pecuaria/protocolos-exames.md) | Núcleo comum, versões, momentos, tarefas, papéis e limites do executor |
| [Produção V5](pecuaria/leite.md) | Aferição geral/individual, população, configuração e rotina leiteira |
| [Estoque e valor do leite](pecuaria/leite-decisoes-estoque.md) | Natureza, origens, segregação, consumo e apropriação de custo |
| [Comercialização do leite](pecuaria/leite-comercial.md) | Coletas, preço posterior, vendas, entregas e demonstrativos |
| [Qualidade do leite](pecuaria/leite-qualidade.md) | Formatos, datas, versões, parâmetros e vínculo comercial |
| [Relatórios do leite](pecuaria/leite-relatorios.md) | Consulta viva, conferência física e emissões preservadas |
| [Referência IDEAGRI do leite](pecuaria/leite-ideagri-referencia.md) | Proveniência e limites do mapeamento, sem presumir importação automática |
| [Painel gerencial](painel-gerencial.md) | Caixa, estoque, custos, nutrição, produção e cobertura |
| [Assistente de consulta](assistente-consulta.md) | Ferramentas de leitura, ajuda, gates e política de custo |

## Arquitetura, design e desenvolvimento

| Documento | Conteúdo |
|---|---|
| [README](../README.md) | Visão do projeto e comandos |
| [Arquitetura](../ARCHITECTURE.md) | Organização, runtime, autorização, banco e testes |
| [System design](system-design.md) | Fronteiras, relações, fatos/snapshots e fluxos entre domínios |
| [Contexto de produto](../client/PRODUCT.md) | Usuários, propósito, princípios e limites |
| [Design system](../client/DESIGN.md) | Tokens e componentes observados no código |
| [Design unificado](design/cooperativa-unificada.md) | Composição e interação compartilhadas, com guias de Financeiro/Pecuária/Leite |
| [Desenvolvimento](desenvolvimento.md) | Banco local único, seed integrada, dados e importadores |
| [Guia da seed](../server/prisma/seed/README.md) | Preparação autorizada, retomada e conferência do cenário V5 |
| [Deploy](../DEPLOY.md) | Cloudflare Workers/Neon/R2 e reconciliação da baseline |
| [Orientações para agentes](../AGENTS.md) | Escopo, preservação, implementação e documentação |

## Evidências e referências históricas

[QA de interface](../design-qa.md), [QA do leite](design/leite/design-qa.md), [QA gerencial](gerencial/design-qa.md) e [validação operacional](design/validacao-refino-operacional.md) conservam suas datas, cenários e limites. Não substituem contratos atuais. Mockups aprovados continuam como referência visual com dados ilustrativos; não comprovam persistência ou disponibilidade.

Os roteiros [V3](pecuaria/artefatos/testes-v3-guia.html), [V4](pecuaria/artefatos/testes-v4-guia.html), [follow-up V4](pecuaria/artefatos/testes-follow-up-v4.html) e [finalidade V5](pecuaria/artefatos/homologacao-v5-finalidade.md) preservam IDs, aceites e armazenamento próprios. A preparação histórica pode não existir na seed atual; registre o bloqueio sem recriá-la ou alterar o aceite pela revisão documental.

O material conceitual de [protocolos](pecuaria/artefatos/protocolos/index.html), [V4](pecuaria/artefatos/conceitos-v4.html) e seus mockups conserva proveniência. Propostas antigas incorporadas aos contratos foram retiradas como planos; diferenças ainda não implementadas ficam em [lacunas](lacunas.md). O histórico completo permanece no Git. Skills em `.agents/skills/` são ferramentas e não contratos do produto; não se remove seu funcionamento numa limpeza documental.
