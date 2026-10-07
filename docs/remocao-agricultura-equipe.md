# Retirada de agricultura e equipe — 03/10/2026

Base atualizada em 07/10/2026: exclusivamente `main@517f33f`, que recebeu a V3 pelo PR #311. O PR #310 incorpora essa `main` e aponta para ela; seu diff não inclui mais as entregas da V3 como novidades. Esta limpeza não implica homologação da V3 nem altera marcações do roteiro manual.

## Resultado

- Frontend: retirada de Plantio, Cultivo e Equipe; navegação, busca e login exibem somente os módulos disponíveis. URLs antigas deixam de ser rotas válidas.
- Backend: retirada de rotas e serviços agrícolas e de ponto, busca de talhões, agregação física de café e backfill dessas entidades.
- Produtos/estoque: retirados uso agrícola, filtro agrícola e vínculos com talhões. Usos genético, sanitário e nutricional, lotes por validade, saldos, custos, movimentos, estornos e navegação para fatos da pecuária permanecem.
- Banco: migration `20261003220000_remover_agricultura_equipe` retira 23 tabelas exclusivas e seus enums, além de `Categoria.usoAgricola` e `Produto.usoAgricola`. Executa em transação, sem `CASCADE`, para falhar se surgir dependência não prevista.
- Permissões: áreas disponíveis passam a Financeiro e Pecuária; áreas descontinuadas são retiradas dos usuários. Rebanho/gado_corte são normalizados para Pecuária sem conceder acesso novo.
- Seeds: plantio, plantios reais e ponto retirados dos comandos e do seed geral.
- Financeiro: contadores de uso dos centros de custo e mensagens do cadastro deixam de referenciar safras. Categorias e centros foram consultados com sucesso no banco local após a migration; os três testes do cadastro gerencial passaram.

## Preservação

Operações financeiras, categorias, centros de custo, parceiros e produtos já existentes permanecem, inclusive lançamentos históricos ligados às atividades agrícolas. Movimentos de estoque originados por agricultura permanecem como histórico físico, sem vínculo operacional ao módulo retirado. A origem `APLICACAO` permanece compatível com esse histórico. Não excluir categorias financeiras pelo nome: isso apagaria significado contábil de operações existentes.

Pecuária V1/V2/V3 e suas auditorias, identidades, relações, perfis, receitas, aplicações, protocolos, exames, fechamentos e rastreabilidade de partidas permanecem. Contas/acessos, sítios e infraestrutura compartilhada também permanecem. IA já estava suspensa; a alteração apenas retira seu caminho agrícola.

Migrations anteriores e documentos históricos continuam como evidência e para reconstrução de bancos desde a baseline. Documentos antigos não representam disponibilidade atual do produto.

## Validação

A migration foi aplicada em cópia descartável de `fazendinha_v3_teste`. Comparação de conteúdo das 69 tabelas preservadas passou (exceto os campos retirados e a normalização explícita das áreas). O banco de origem não participa dos testes de integração.

- 502 testes de pecuária/estoque passaram em 45 arquivos, com integrações PostgreSQL habilitadas na cópia descartável.
- 156 testes da interface passaram em dez arquivos (130 de navegação/produtos/estoque e 26 de configurações financeiras); os 51 casos de sidebar/roteamento foram repetidos após a limpeza final e passaram (sobreposição com a rodada anterior).
- Compilação TypeScript do servidor e da interface passaram. Build de produção da interface passou.
- Migration aplicada com sucesso somente no banco local `fazendinha_v3_teste`. Nenhum usuário mantém as áreas agricultura/equipe e as tabelas retiradas não existem mais.
- Backup completo anterior à aplicação: `Documents/Codex/2026-10-03/fi/outputs/fazendinha-v3-antes-limpeza-agro-20261003.dump`, formato custom do PostgreSQL.
- Staging/produção não fazem parte desta aplicação local. O código foi publicado no PR #310. A V3 continua com homologação manual própria pendente; esta rodada não aprova esses casos.

## Revisão de regressões do PR #310 — 04/10/2026

A comparação separa a base local V3 (`a6abe32`) da limpeza, para não tratar entregas de lotes por validade como remoções agrícolas. Foram corrigidos três problemas fora do escopo:

- A referência técnica sanitária havia saído dos formulários de Produto e aplicação. Restaurados o preenchimento, a sugestão do perfil e o envio da referência revisada, com testes de preservação ao trocar categoria e registrar aplicação.
- O contrato `ProdutoInput` de Estoque havia perdido os usos genético/sanitário/nutricional e `rastrearPartidas`. Os campos foram restaurados. A alteração visual da ativação de lotes também foi retirada desta limpeza, preservando a interface da base V3.
- O seed financeiro importava `centros-atividade`, removido, e enviava `usoAgricola` ao Prisma. Corrigido sem retirar categorias ou centros financeiros.

A revisão das relações Prisma confirmou que nenhuma tabela de pecuária, operação financeira, partida ou movimento do estoque compartilhado é retirada. Silos e movimentos de silos pertencem ao Cultivo legado e não abastecem os fechamentos nutricionais V3; sua exclusão continua no escopo agrícola, sem converter seus saldos para o estoque compartilhado. Os lançamentos financeiros e movimentos compartilhados agrícolas existentes continuam preservados, embora percam o vínculo com talhões.

As rotas de estoque agora são testadas com o gate de área: Financeiro e Pecuária continuam autorizados; Agricultura/Equipe isoladas não concedem acesso. O filtro de produto cobre os três usos preservados. Valores continuam exigindo Financeiro e `verValores`.

Nova restauração do backup em banco descartável confirmou conteúdo idêntico nas 69 tabelas mantidas antes/depois da migration, exceto campos e áreas explicitamente retirados. Na integração, as falhas por horário futuro dos dados de teste e contagem global concorrente foram corrigidas nas fixtures; os sete casos desses arquivos passaram no reteste. Nenhuma regra operacional foi relaxada. Compilação do servidor e build da interface passaram. A revisão não substitui a homologação manual completa da V3 nem aplica mudanças a produção.

A cadeia completa de migrations também passou em banco vazio; o seed financeiro corrigido criou cinco operações (incluindo transferência) e duas entradas de estoque, com saldo de 1.500 unidades. Ambos os bancos de revisão são descartáveis.

Resultados desta revisão (retestes têm sobreposição com as baterias):

- Servidor: 673 casos passaram na bateria inicial; dois casos com expectativas agrícolas antigas falharam. Após correção e ampliação do gate, os 55 testes das rotas de estoque passaram. Outros 76 casos de integração ficaram desabilitados nessa bateria unitária.
- Estoque/pecuária com PostgreSQL: 497 de 502 passaram inicialmente; as cinco falhas de fixtures descritas acima foram resolvidas, e os sete testes dos dois arquivos afetados passaram.
- Interface: 602 de 604 passaram na bateria de 69 arquivos. Os dois casos afetados pelo timeout de carregamento passaram no reteste do arquivo de responsividade (21/21), sem mudança no código financeiro. Os 21 casos focados de Produto, aplicação sanitária e ativação de lotes também passaram.
- Compilação TypeScript do servidor, build de produção da interface e `git diff --check` passaram. Conferência visual manual completa não foi refeita.

## Conciliação com a V3 final — 07/10/2026

Conflitos resolvidos preservando os fluxos finais da V3, inclusive ciclos/participantes, prévia e execução de etapas com desvios, procedimentos vinculados a Serviço, revisões de ocorrências/exames, fechamento nutricional e validação com foco nos campos. O código operacional de pecuária e de operações financeiras permanece igual à base V3 final; diferenças nos testes da pecuária são a retirada de `usoAgricola` de uma fixture e correções anteriores de horário/contagem isolada por sítio.

Apenas arquivos exclusivos de Plantio/Cultivo/Equipe/Ponto continuam excluídos. O filtro agrícola do cadastro de Produtos não retorna com o merge. A consulta geral de partidas, retirada pela própria V3 final em favor da ficha do Produto, permanece retirada. Permissões finais de escrita financeira e proteção de valores são preservadas. Rotas agrícolas/ponto respondem 404 após autenticação; não ficam tratadas como canais suspensos do assistente.

Prevalecem as decisões de produto da V3 final sobre a restauração histórica de 04/10: referência técnica não volta aos formulários; valores históricos continuam armazenados e protegidos ao editar. Cadastro/edição compartilham a opção de ativar controle de lotes, com prévia obrigatória em Produto existente. Nenhuma funcionalidade final da V3 foi retirada para acomodar a limpeza.

A migration original de remoção não foi reescrita. Sua cadeia foi executada em banco descartável vazio, incluindo a migration posterior de ciclos. Staging, produção e o banco de trabalho manual não participam desta aplicação.

Validação desta conciliação:

- Servidor sem integração: 1.026 testes aprovados, 115 casos PostgreSQL desabilitados nessa execução. Configuração de banco inerte explícita, sem conexão ao banco manual.
- Servidor em PostgreSQL descartável: 1.136 aprovados na suíte completa; os cinco casos de concorrência financeira, habilitados por `FINANCE_DB_INTEGRATION`, passaram separadamente. Total de 1.141 casos distintos aprovados, sem casos restantes ignorados. A rodada sem integração é um subconjunto e não se soma a esse total.
- Interface: 936 testes aprovados em 121 arquivos. Builds de servidor e interface e `git diff --check` aprovados.
- Comparação com a V3 final: código operacional em `client/src/pecuaria`, `server/src/services/pecuaria` e `server/src/routes/pecuaria` idêntico; as 55 definições Prisma de modelos/enums do schema `pecuaria` também são idênticas.
- Preservação: uma segunda base descartável recebeu todas as migrations da V3, inclusive ciclos, antes da remoção, seeds financeiros/rebanho e um ciclo com participante. Conteúdo das 70 tabelas mantidas comparado antes/depois por contagem e digest de cada linha: idêntico, descontando somente `usoAgricola` e `Usuario.areas`, cuja normalização foi conferida separadamente. Permaneceram 21 animais, 101 auditorias, 39 pesagens, cinco operações, dois movimentos de estoque, um ciclo e uma participação. As 23 tabelas retiradas deixaram de existir.
- A cadeia também passou na ordem de instalação desde zero, com a remoção anterior à migration de ciclos. Os dois bancos descartáveis foram removidos ao finalizar a validação.

Homologação visual/manual completa da V3 e carga IDEAGRI continuam fora desta conciliação; nenhuma marcação do guia foi aprovada ou resetada.

### Conferência final exclusivamente com a main — 07/10/2026

Após o PR #311, `origin/main` avançou para `517f33f`. A integração desse commit foi sem conflitos e sem alteração na árvore de código previamente validada. A partir desta atualização, somente `main` será usada como base de integração e de revisão; branches de versões anteriores não são fontes para novas conciliações.

A comparação direta confirmou código operacional da pecuária e 55 definições Prisma desse schema idênticos à `main`. Operações, rascunhos, regras financeiras, contas e telas centrais de operações/compromissos/contas/relatórios continuam idênticos; alterações financeiras restantes retiram apenas filtros, contadores e contratos agrícolas. Nenhum arquivo de financeiro/pecuária é excluído. Todas as migrations herdadas da `main` permanecem byte a byte; a única migration acrescentada é a remoção já validada. As 23 tabelas retiradas coincidem exatamente com o escopo Agricultura/Equipe; nenhuma coluna física dos modelos mantidos é removida além dos dois campos `usoAgricola`, e só o default de `Usuario.areas` muda.

Não foi necessário repetir as suítes: o merge não modificou o código nem as migrations cobertos pelas execuções descritas acima. Esta rodada acrescenta conferência estrutural contra a `main` atual e atualização documental, sem aplicar migrations ou alterar bancos.
