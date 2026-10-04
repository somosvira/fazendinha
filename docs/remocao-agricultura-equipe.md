# Retirada de agricultura e equipe — 03/10/2026

Base: `codex/pecuaria-v3`, PR #308, incluindo alterações locais de lotes por validade. Esta limpeza não implica homologação da V3 nem altera marcações do roteiro manual.

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
- Staging/produção e publicação no GitHub não fazem parte desta aplicação local. A V3 continua com homologação manual própria pendente; esta rodada não aprova esses casos.
