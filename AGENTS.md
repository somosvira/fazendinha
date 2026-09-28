# Orientações para agentes

Antes de alterar o projeto, leia [`AI_RULES.md`](./AI_RULES.md), [`README.md`](./README.md) e o documento de arquitetura ou domínio relacionado à tarefa.

Para qualquer trabalho no eixo de pecuária, leia primeiro [`docs/pecuaria/README.md`](./docs/pecuaria/README.md) e o artefato correspondente à versão em questão. Essa página registra o estado das entregas, a ordem de evolução, as decisões que substituíram propostas antigas e os riscos de integração entre branches.

Regras de continuidade:

- trate o IDEAGRI apenas como fonte da carga inicial e referência de reconciliação;
- não reintroduza o módulo legado removido pela v1;
- preserve histórico, auditoria, escopo por sítio e as invariantes descritas nos testes;
- quando código e documentação divergirem, investigue migration, schema e testes antes de assumir que um artefato histórico representa a implementação atual;
- atualize a documentação na mesma mudança que alterar comportamento, vocabulário ou contrato de dados.

`CLAUDE.md` continua útil para o Claude Code, mas não é a única fonte de contexto. As decisões compartilhadas devem ficar em documentação neutra do repositório.
