# Orientações para agentes

## Leitura e fonte de contexto

Antes de alterar o projeto, leia [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md) e o contrato relacionado à tarefa no [índice](docs/README.md). Em Pecuária, comece por [docs/pecuaria/README.md](docs/pecuaria/README.md); em Financeiro, por [seu contrato](docs/financeiro-rebuild-contrato.md).

Confira comportamento em rotas/serviços/interface, estrutura no schema e garantias SQL nas migrations, e invariantes nos testes. Investigue divergências entre essas fontes: documentação, seed, mock ou artefato visual isolado não prova que uma funcionalidade está disponível ou validada.

## Escopo atual

- Domínios ativos: Financeiro, Estoque, Pecuária V1–V4, Sítios e Contas/Acessos.
- Deploy exclusivamente em Cloudflare Workers, com interface e API no mesmo Worker, Neon para o banco e R2 para arquivos. Node atende desenvolvimento local e testes; não introduza outro provedor como pressuposto de implementação.
- Agricultura, Cultivo e Equipe/Ponto foram removidos. Não reintroduza seus módulos, rotas ou seeds como dependência de outra entrega. Categorias/centros financeiros e movimentos históricos dessas atividades podem permanecer.
- A pecuária anterior no schema `public` foi substituída pela base no schema `pecuaria`. Preserve a implementação atual; não recupere o rebanho legado.
- Reprodução V4 inclui tentativas, avaliações, gestação, partos/crias, visitas e IATF. Confira `docs/pecuaria/reproducao.md`; produção/qualidade do leite e laboratório/FIV permanecem fora do escopo. Partos, incluindo aborto e natimorto, reiniciam o ciclo de tentativas; genética da doadora não se confunde com a receptora.
- Protocolos/tarefas e exames usam a base comum descrita em `docs/pecuaria/protocolos-exames.md`. As entidades IATF anteriores são views de leitura; escreva pelo núcleo comum. Papel por data vem de `PeriodoReprodutivoAnimal`, separado da aptidão.
- O IDEAGRI serve à carga inicial e reconciliação. O Fazendinha é a fonte operacional após importar; não crie sincronização contínua por pressuposto.
- O bot anterior, `/ia` e WhatsApp estão suspensos em `client/src/featureFlags.ts` e `server/src/featureFlags.ts`. Não os reative incidentalmente. O novo assistente de consulta é separado: siga [seu contrato](docs/assistente-consulta.md), os gates e o registro de ferramentas de leitura.

## Fluxo de alterações visuais

- Antes de implementar uma página ou mudança de layout, gere um mockup e revise-o com as skills `impeccable` e `frontend-design`. Apresente o resultado para aprovação antes de escrever a interface. Preserve os dados e contratos funcionais no desenho. Na implementação, confira a tela no navegador; mockup e revisão visual não substituem validação funcional. Para os relatórios financeiros deste fluxo, priorize o desktop.

## Implementação

- Busque componentes, schemas, formatadores e serviços equivalentes antes de criar novos. Use TypeScript estrito e identificadores/mensagens em português consistentes com o domínio.
- Rotas Hono validam entradas com Zod e delegam aos serviços; cálculos puros ficam separados do acesso ao banco. Imports relativos do backend usam `.js`.
- Configuração de runtime vem de `server/src/env.ts`. Novas variáveis precisam de validação e exemplo sem segredo.
- Nos recursos de IA, priorize sempre o modelo de menor custo compatível com o fluxo, conforme preferência do usuário. Verifique preços/disponibilidade na documentação oficial ao trocar ou ampliar o modelo; não crie fallback automático para modelos mais caros. A escolha vigente e sua revisão ficam no [contrato do assistente](docs/assistente-consulta.md#política-de-custo).
- Preserve histórico, autoria, auditoria, escopo por sítio, localização na data do fato e garantias de idempotência/concorrência. Escritas que afetam múltiplos fatos devem manter a atomicidade do fluxo.
- Dinheiro usa `Prisma.Decimal` e as regras de `services/financeiro/regras.ts`. Compromisso não movimenta conta; estorno confirmado cria inverso, sem apagar o original. Não contorne período fechado.
- Autorização é do servidor: sessão, área, ação e escopo. Esconder um botão não protege uma rota. Confira `verValores` também em DTOs de custos e relatórios. `SHARED_ACCESS_TOKEN` é ponte existente, não base para recursos novos.
- Migre o banco por migrations. Não edite migrations aplicadas nem use `db push` como substituto: constraints/índices parciais e dados iniciais existem no SQL.
- Tailwind, Radix e Recharts fazem parte da implementação atual; isso descreve a stack, não uma direção visual. O visual atual não foi aprovado como padrão para os próximos passos. Defina alterações visuais pelo escopo da tarefa, preservando acessibilidade, estados e contratos funcionais. Não recupere regras estéticas de documentos antigos.
- A navegação usa `client/src/router.ts` + History API; preserve os contratos de URL/filtros dos fluxos afetados.

## Dados e validação

- Preserve alterações locais de outras tarefas. Não faça reset do checkout, limpeza de bancos, remoção de volumes ou reexecução de cargas para validar uma mudança comum.
- Use sempre e somente o PostgreSQL local `fazendinha_seedatev3` no desenvolvimento e na validação local. Não crie outro banco, clone ou cópia temporária para testes ou ensaio de migration. O seed é `seedatev3`; preserve seus dados e manifesto. Leia [desenvolvimento](docs/desenvolvimento.md).
- As flags `AUTH_DB_INTEGRATION`, `PECUARIA_DB_INTEGRATION` e `FINANCE_DB_INTEGRATION` habilitam escritas reais. Antes de executar integração local, confira que cada teste cria/remove apenas suas próprias fixtures e usa `fazendinha_seedatev3`; não rode rotinas de reset, limpeza global ou criação de bancos. Casos que exigem recriar estrutura ou banco ficam restritos ao CI externo.
- Rode os testes e builds proporcionais ao que mudou. Separe evidência automatizada de homologação manual e informe o que não foi executado. Não aprove nem resete marcações de roteiros pela atualização documental.
- Commits seguem `tipo(escopo): descrição` em PT-BR. Não publique, faça deploy ou altere ambientes como efeito colateral de uma tarefa local.

## Documentação

Decisões compartilhadas ficam nesta base neutra; `CLAUDE.md` apenas a referencia. Atualize o documento correspondente na mesma mudança que alterar comportamento, vocabulário ou contrato de dados.

Documente o estado atual e o necessário para operar/evoluir o domínio. Evite duplicar contratos em handoffs, catálogos manuais de componentes, contagens de testes ou relatos de sessões. Para uma feature nova, registre escopo, regras/efeitos, implementação e validação; mantenha propostas explicitamente separadas. Ao concluir, incorpore as decisões vigentes ao contrato e retire o plano temporário obsoleto. Não derive roadmap de documentos ou PRs antigos.
