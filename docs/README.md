# Documentação do projeto

A base documenta o código atual. Setup e comandos ficam no [README](../README.md); regras comuns de contribuição em [AGENTS.md](../AGENTS.md).

| Documento | Quando consultar |
|---|---|
| [Design unificado](design/cooperativa-unificada.md) | Direção Cooperativa contemporânea desta entrega, padrões compartilhados e guias por módulo |
| [Arquitetura](../ARCHITECTURE.md) | Organização, runtimes, autenticação, escopo e testes |
| [Financeiro e estoque](financeiro-rebuild-contrato.md) | Dinheiro, efeitos físicos, estornos, períodos e rastreabilidade |
| [Pecuária](pecuaria/README.md) | Rebanho, genética, sanidade, peso, nutrição e limites atuais |
| [Reprodução V4](pecuaria/reproducao.md) | Tentativas, gestação, parto/crias, visitas, IATF e reconciliação técnica |
| [Follow-up V4 — produto e entidades](pecuaria/artefatos/follow-up-v4-entrega.html) | Valorização do saldo, custos diretos, acompanhamento e indicadores; diagramas das entidades, estado de validação e complementos adiados |
| [Evolução do manejo reprodutivo](pecuaria/artefatos/plano-evolucao-manejo-reprodutivo.html) | Resumo da entrega por pacote, situação da validação e links para os contratos vigentes |
| [Mockups do manejo reprodutivo](pecuaria/artefatos/mockups-manejo-reprodutivo.html) | Quatro referências visuais aprovadas com dados ilustrativos: planner, avaliação coletiva, parto e indicadores; controles desenhados, sem operação real |
| [Separação entre agenda e seleção livre — plano](pecuaria/artefatos/plano-separacao-fluxos-visitas.html) | Plano incorporado ao contrato de reprodução: duas entradas independentes, critérios V2 e preparação comum |
| [Correções do fluxo de visitas](pecuaria/artefatos/plano-correcao-visitas.html) | Encaminhamento do plano concluído para o contrato, a explicação das sete correções e o roteiro de homologação |
| [Entrada de visitas — mockup](pecuaria/artefatos/mockup-selecao-livre.html#entrada) | Referência visual aprovada: entrada sem caminho pré-selecionado, agenda e seleção livre em percursos separados; dados fictícios, sem conexão com o app |
| [Conceitos e interface V4](pecuaria/artefatos/conceitos-v4.html) | Explicação dos relacionamentos e dos fluxos de contexto, parto, colostro, visita, elegibilidade, indicadores e relatórios em relação às telas |
| [Testes manuais da branch V4](pecuaria/artefatos/testes-manuais-branch-v4.html) | Execução humana do follow-up e alterações locais: consultas, ações de gravação, bordas e evidências; marcações próprias inicialmente pendentes |
| [Guia manual V4](pecuaria/artefatos/testes-v4-guia.html) | Roteiro específico com pré-condições, resultados esperados e registro/exportação da execução; inicia pendente |
| [Protocolos, exames e papéis](pecuaria/protocolos-exames.md) | Modelo comum implementado, versões, migração, compatibilidade e limites |
| [Desenvolvimento](desenvolvimento.md) | Seed unificado, carga IDEAGRI e preparação do guia manual |
| [Deploy](../DEPLOY.md) | Publicação exclusiva em Cloudflare Workers, configuração e migrations |
| [Guia manual V3](pecuaria/artefatos/testes-v3-guia.html) | Homologação sequencial ainda em uso; marcações locais no navegador |

Propostas antigas não substituem os contratos operacionais; consulte o resumo de execução e os contratos vigentes para identificar o estado atual. A direção Cooperativa contemporânea está documentada para o escopo desta entrega; novas direções visuais precisam de definição própria. Para novas features, crie documentação focada na mudança e diferencie requisitos propostos, comportamento implementado e validação realizada. A existência de código ou de um roteiro não comprova homologação de um ambiente.
