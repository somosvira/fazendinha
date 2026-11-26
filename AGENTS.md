# Orientações para agentes do Fazendinha

## Antes de alterar o projeto

Para propostas de UI/UX, parta da tarefa do usuário, do [produto](client/PRODUCT.md) e dos [princípios de design](client/DESIGN.md). Observe onde a pessoa encontra dificuldade e quais componentes já resolvem parte do problema. A proposta explica a escolha de composição. O mockup aprovado orienta aquela entrega. Uma escolha local passa a orientar outras telas quando o usuário a adota como princípio compartilhado.

Antes de alterar o projeto, consulte o [README](README.md) e a [arquitetura](ARCHITECTURE.md). Use as [referências por domínio](docs/README.md#referências-por-domínio) quando precisar esclarecer dados, permissões, cálculos ou efeitos da operação. Mockups anteriores, roteiros e descrições de telas ajudam a entender a história de uma entrega.

Confira o comportamento na interface, rotas e serviços, a estrutura no schema, as garantias no SQL das migrations e os invariantes nos testes. Quando fontes divergirem, descreva a diferença entre o que foi decidido e o que está implementado. Seed, captura, mockup e pesquisa de concorrentes têm usos específicos e exigem confirmação antes de fundamentar afirmações sobre o produto em funcionamento.

Em Financeiro, Pecuária e Leite, use o manual para instruções de uso. Registre o motivo de uma [decisão de negócio](docs/decisoes-de-negocio.md) quando ele ajudar a interpretar o sistema. Sugestões ainda em discussão ficam fora do manual.

## Fluxo de alterações visuais

Para criar uma página ou alterar o layout ou a interação de um fluxo, siga esta sequência.

1. **Análise.** Percorra a tarefa atual. Qual dado a pessoa precisa registrar ou entender? Onde encontra dificuldade e o que fará com o resultado?
2. **Proposta.** Explique como a solução melhora esse percurso, quais componentes existentes se encaixam e o que justifica uma variação.
3. **Mockup e aprovação.** Mostre as escolhas, as ações e a resposta da interface com dados representativos. Apresente o mockup ao usuário. Uma mudança material na proposta volta para sua avaliação.
4. **Plano após o aceite.** Divida o trabalho conforme as dependências. Priorize modelos econômicos para execução delimitada e modelos de maior capacidade para decisões complexas e revisão do código.
5. **Implementação e revisão de código.** Implemente a proposta aprovada e confira o fluxo, os dados, as permissões e os testes pertinentes.
6. **Revisão manual.** Percorra a tarefa na interface real até o resultado, confira seu uso no desktop e no celular e apresente a entrega para revisão humana.

### Ferramentas para definir e criar mockups

| Ambiente | Uso no projeto |
|---|---|
| Claude | Use a skill `frontend-design` para definir a composição, criar o mockup e revisar a proposta com os princípios compartilhados do produto e do design. |
| Codex | Use o plugin **Product Design** para definir o problema, explorar a solução e criar o mockup. Use o plugin **Impeccable** em conjunto para trabalhar organização, alinhamento, densidade, controles e responsividade durante a criação e a revisão. Carregue o contexto Impeccable a partir de `client/`, onde estão `PRODUCT.md` e `DESIGN.md`. |

Indique as ferramentas realmente usadas. Se uma estiver indisponível, informe qual etapa foi afetada e qual alternativa está disponível. A aprovação da proposta pertence ao usuário.

Para testes manuais, reutilize a aba do navegador do chat. Se o usuário indicar o Chrome ou outro navegador, reutilize a aba existente nele. Use sessões separadas do Playwright para testes automatizados repetíveis, em segundo plano, e encerre as temporárias ao finalizar.

## Escopo dos domínios

- Financeiro, Estoque, Pecuária V1–V5, Sítios e Contas/Acessos são os domínios ativos. Agricultura, Cultivo e Equipe/Ponto foram removidos; preserve apenas as categorias, centros e movimentos históricos cabíveis.
- Interface e API rodam no mesmo Cloudflare Worker. O banco é Neon e os arquivos ficam em R2. Node atende desenvolvimento e testes locais.
- A base operacional da pecuária usa o schema `pecuaria`. Preserve essa base e mantenha o rebanho legado de `public` fora dos fluxos atuais. O IDEAGRI serve à carga inicial e à reconciliação. Após a importação, o Fazendinha é a fonte operacional.
- [Reprodução](server/src/services/pecuaria/reproducao) cobre tentativas, avaliações, gestação, partos/crias, visitas e IATF. Partos, inclusive aborto e natimorto, reiniciam o ciclo de tentativas. Preserve a distinção entre genética da doadora e gestação da receptora. Laboratório/FIV permanecem fora do escopo.
- [Protocolos e tarefas](server/src/services/pecuaria/protocolos) são escritos no núcleo comum. Entidades IATF anteriores são views de leitura. O papel por data vem de `PeriodoReprodutivoAnimal`, independente da aptidão.
- [Produção e qualidade do leite](server/src/services/pecuaria/leite) usam formatos manuais versionados a partir do laudo, exames comuns para animais e amostras próprias para origens coletivas. O mapeamento automático IDEAGRI permanece pendente.
- O bot anterior, `/ia` e WhatsApp permanecem suspensos pelas flags do cliente e do servidor. O [assistente de consulta](docs/assistente-consulta.md) tem gates e registro próprio de ferramentas de leitura. Nos recursos de IA, escolha o modelo de menor custo compatível, confira disponibilidade e preços oficiais ao rever o modelo e preserve a política de custo, sem fallback automático mais caro.

## Implementação e integração

- Reutilize componentes, schemas, formatadores e serviços equivalentes. Use TypeScript estrito, identificadores e mensagens em português. Rotas Hono validam entradas com Zod e delegam aos serviços. Separe cálculo puro de acesso ao banco. Imports relativos no backend usam `.js`. Centralize variáveis de runtime em `server/src/env.ts`, com validação e exemplo sem segredo.
- Preserve histórico, autoria, auditoria, escopo por sítio, localização na data do fato, idempotência e concorrência. Uma escrita que produz vários fatos deve ser atômica. A autorização no servidor verifica sessão, área, ação e escopo. Respeite `verValores` também nos DTOs e relatórios. Reserve `SHARED_ACCESS_TOKEN` para a ponte existente.
- Dinheiro usa `Prisma.Decimal` e `services/financeiro/regras.ts`. Compromisso não movimenta conta. Estorno confirmado cria o inverso e conserva o original. Respeite o período fechado.
- Faça mudanças no banco por novas migrations. Preserve as aplicadas. Constraints, índices parciais e dados iniciais dependem do SQL; não use `db push`.
- A navegação usa `client/src/router.ts` e History API. Ao alterar páginas, registros, fluxos, URLs, filtros ou permissões, confira na mesma mudança o catálogo da busca global, fontes de registros, destino exato ou consulta filtrada, gates e testes. Documente exclusões justificadas no [contrato da busca](docs/busca-global.md).
- Ao criar ou ampliar relatórios, confira a cobertura das variáveis no [catálogo do builder](client/src/pecuaria/relatorios/catalogo.ts), nos adapters e nos testes e justifique eventuais exclusões na revisão da mudança.

## Dados, validação e entrega

- Preserve alterações de outras tarefas, dados e volumes. Use exclusivamente o PostgreSQL local `fazendinha_seedatev3`, inclusive para ensaio de migration. Não crie bancos, clones ou cópias temporárias. O seed único é `seed`; preserve seu manifesto em `server/.seed/`. Substituição da base exige autorização explícita, backup e manutenção separada. Siga o [guia de desenvolvimento](docs/desenvolvimento.md).
- `AUTH_DB_INTEGRATION`, `PECUARIA_DB_INTEGRATION` e `FINANCE_DB_INTEGRATION` habilitam escritas reais. Antes de rodar integração local, confira o destino e que cada teste cria e remove somente suas fixtures. Reset, limpeza global, recarga de dados e recriação de estrutura não fazem parte da validação local. Casos que exigem recriação ficam no CI externo.
- Distinga teste automatizado, revisão manual e homologação. Atualizações documentais preservam as marcações dos roteiros. Commits seguem `tipo(escopo): descrição` em PT-BR. Publicação, deploy e alterações de ambiente exigem escopo próprio.
- Atualize a referência existente quando mudarem o significado de um dado, seus efeitos, as permissões ou o modo de operar. Registre o que foi observado, proposto ou aprovado conforme a evidência disponível. Documente escolhas visuais de alcance geral em `client/DESIGN.md` quando acordadas com o usuário. A evolução de uma tela pode ficar no próprio mockup e na revisão da entrega.
