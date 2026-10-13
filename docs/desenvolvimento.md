# Dados de desenvolvimento e carga inicial

## Cenário unificado até V3

`server/prisma/seedatev3.ts` é o seed padrão de desenvolvimento e do Prisma. Só aceita PostgreSQL local **`fazendinha_seedatev3`**, fora de produção, com namespace R2 `dev` ou `test` e todas as migrations aplicadas/inalteradas. Não cria nem exclui bancos.

Após configurar `server/.env` conforme o [README](../README.md):

```bash
pnpm --filter rionovo-server exec prisma migrate deploy
pnpm --filter rionovo-server run seedatev3
pnpm --filter rionovo-server run seedatev3 --verificar
```

O cenário reúne Principal/Destino, 18 animais, seis lotes, genética, pesagens/manejos, transferências/baixas, contas, operações/compromissos/liquidações/estornos, protocolos/ciclos/aplicações/exames e receitas/vigências/fechamentos. Documentos e relatórios demonstrativos usam R2; não são documentos fiscais reais. O seed permanece limitado à V3: não cria cenários de reprodução V4 nem produção de leite.

Catálogos demonstrativos ficam em `server/prisma/seedatev3/catalogos.ts`. Padrões são carga inicial editável, não regra clínica fixa. IDs existentes das migrations são reaproveitados, sem sobrescrever configurações do usuário. Centros financeiros chamados Agronomia/Equipe não reintroduzem os módulos retirados.

Acessos fictícios exclusivos desse ambiente; senha inicial: `SeedateV3!Local2026`.

| Perfil | E-mail | Configuração |
|---|---|---|
| Dono | `seedatev3.dono@example.test` | Acesso completo |
| Consulta | `seedatev3.consulta@example.test` | Consulta das duas áreas, sem lançamento |
| Operador | `seedatev3.operador@example.test` | Lançamento nas duas áreas, sem `verValores` |

O perfil de operador não deve ser tratado como protegido para valores financeiros: há mascaramento incompleto na API, descrito no [contrato financeiro](financeiro-rebuild-contrato.md#permissões-e-documentos). O seed configura permissões, mas não corrige essa limitação.

## Retomada e verificação

A data-base é calculada uma vez em `America/Sao_Paulo` e conservada com identidade do banco, versão, IDs, ações e etapas em `server/.seedatev3/manifesto.json`, ignorado pelo Git. Consulte `dataBase` no manifesto do ambiente; não assuma uma data fixa de uma sessão anterior. Datas que envelhecem são evolução natural, não motivo para repopular.

Reexecuções mantêm a data e não repetem etapas concluídas. Registro removido manualmente não é recriado automaticamente. Preserve manifesto junto do banco/backup; restauração exige conferir identidade. `migrate reset`, exclusão de volume ou descarte do manifesto invalidam a continuidade.

`--verificar` usa conexões somente leitura e confere relações, saldos, estoque por sítio/validade, carências, animal-dias, custos e arquivos. Para testar retomada no cenário apropriado, `--interromper-apos=catalogos` interrompe controladamente; rodar sem a opção continua. Etapas estão declaradas no entrypoint. O período fechado demonstrativo é uma fixture administrativa auditada, pois não há comando público de fechamento; não invente esse fluxo de interface.

A verificação do seed pode ler arquivos reais do R2. Não rode o seed nem sua preparação para validar apenas documentação/código sem alteração de dados. As configurações inertes dos testes unitários não servem para executar o cenário.

Backups e evidências locais ficam em `.backups/` e `server/.seedatev3/`, fora do Git. A manutenção do repositório não autoriza removê-los. Recuperação de bancos e volumes depende de seus backups, não de planos antigos ou de um novo seed.

## Guia manual V3

O [guia](pecuaria/artefatos/testes-v3-guia.html) e `server/scripts/preparar-guia-v3.ts` usam exclusivamente o PostgreSQL local **`fazendinha_v3_teste`**, independente do seed unificado. Os sítios são Guia V3 — Principal/Destino; brincos usam GV3.

A preparação reproduzível está em `server/scripts/preparar-guia-v3.ts`: por padrão só consulta; `--preparar` inclui os pré-requisitos faltantes e `--verificar` confere os saldos **iniciais**, logins e 110 animal-dias. Para recomeçar o guia no banco Docker local, use `--limpar --preparar --verificar`: remove todos os dados operacionais locais, preserva uma conta financeira utilizável e recria somente os dois sítios, usuários e fixtures deste guia. A limpeza invalida sessões abertas, mas não altera migrations, código nem as marcações do HTML. O script bloqueia banco remoto ou outro nome de banco. A criação de animais/lotes/produtos e operações utiliza os serviços existentes, mantendo auditoria.

Para consulta, sem preparar nem limpar, a partir da raiz do projeto:

```bash
cd server
pnpm exec tsx --env-file=.env scripts/preparar-guia-v3.ts
```

No banco dedicado ao guia, acrescente as opções à chamada do script conforme a tarefa. Execute no diretório `server` para resolver corretamente os caminhos do script e do arquivo `.env`:

| Opções | Efeito |
|---|---|
| `--preparar --verificar` | Completar pré-requisitos e conferir o cenário inicial |
| `--limpar --preparar --verificar` | Reiniciar o banco local do guia e conferir saldos iniciais |

O script exige `--preparar` junto de `--limpar`. A verificação é do cenário inicial. `--limpar` remove dados operacionais e só deve ser usado quando a tarefa autorizar reiniciar esse banco. Não execute a preparação no banco do seed.

Marcações e notas do HTML ficam no navegador e não são prova de execução automatizada. O roteiro usa datas e nomes fixos de seu cenário; isso não define a data-base do seed nem o estado de outro ambiente.

## Carga inicial IDEAGRI

Os utilitários mantidos formam a cadeia existente de Rebanho/Genética:

1. `scripts/extract-pecuaria.sh` / `scripts/pecuaria-dump.sql`: extração da fonte; confira os caminhos locais antes de executar.
2. `scripts/build-pecuaria-json.mjs`: transformação para o JSON de carga; comportamento coberto por `build-pecuaria-json.test.mjs`.
3. `seed:pecuaria`: catálogos de raças/motivos, distinto do seed demonstrativo completo.
4. `import:pecuaria`: importa `server/prisma/pecuaria_v1.json`, gerado e ignorado pelo Git.
5. `validar:pecuaria`: conciliação da carga.

A importação não sincroniza alterações do IDEAGRI: animal já importado é ignorado; a passada de genética preenche lados vazios sem sobrescrever filiação editada. O importador trata animais em transações individuais e relata falhas; execução parcial não significa carga integral concluída. A carga histórica de Sanidade/Nutrição V3 ainda não está entregue.

Seeds de demonstração por módulo/PR e a massa do Excel anterior foram retirados. Fixtures dos testes, catálogos das migrations e importador atual continuam disponíveis.

## Carga técnica V4 e testes de reprodução

A V4 tem ferramentas separadas do seed V3. Não rode `seed`, `db push` ou uma carga histórica para testar uma mudança comum. Para integração, crie um PostgreSQL descartável e passe **`DATABASE_URL` e `DIRECT_URL` apontando para o mesmo banco** em todos os comandos: o Prisma usa a conexão direta para migrations e pode ler `DIRECT_URL` de `server/.env` mesmo quando somente `DATABASE_URL` foi sobrescrita.

```bash
# Use a conexão de um banco descartável criado especificamente para o teste.
export PECUARIA_QA_URL='postgresql://usuario:senha@127.0.0.1:porta/banco_descartavel'
DATABASE_URL="$PECUARIA_QA_URL" DIRECT_URL="$PECUARIA_QA_URL" pnpm --filter rionovo-server exec prisma migrate deploy
DATABASE_URL="$PECUARIA_QA_URL" DIRECT_URL="$PECUARIA_QA_URL" PECUARIA_DB_INTEGRATION=1 pnpm --filter rionovo-server test
```

O extrator `scripts/extract-pecuaria-v4.sh` exige caminho explícito de uma **cópia** Firebird e diretório de saída fora do Git, ambos acessíveis pelo Windows em `/mnt/c`. Recusa o diretório operacional `Ideagri/dados`. Consultas usam transação somente de leitura; erros SQL/UDF interrompem a transformação automática, conservando o dump para inspeção. `scripts/build-pecuaria-v4-json.mjs` verifica sentinelas e totais das tabelas antes de gerar o JSON. A presença de um dump não prova que a extração terminou integralmente.

```bash
scripts/extract-pecuaria-v4.sh '/mnt/c/copia/DADOS777.FDB' '/mnt/c/copia/saida-v4'
pnpm --filter rionovo-server run import:pecuaria:v4:typecheck
```

O contrato de carga e mapeamento fica em `server/prisma/import-v4/contrato.ts`. A prévia é o padrão e escreve somente o relatório solicitado; ela não cria animais nem importa fatos no banco. Informe carga, mapeamento e relatório explicitamente:

```bash
DATABASE_URL="$PECUARIA_QA_URL" DIRECT_URL="$PECUARIA_QA_URL" pnpm --filter rionovo-server run import:pecuaria:v4 --arquivo=/caminho/carga.json --mapeamento=/caminho/mapa.json --relatorio=/caminho/previa.json
```

Para executar no banco **local** escolhido, acrescentam-se `--executar --banco-confirmado=nome_do_banco`. O importador recusa execução em ambiente de produção ou banco remoto; publicar código não autoriza aplicar a carga. Conflitos causam saída não zero e precisam de leitura do relatório, inclusive quando uma execução foi parcial. Reexecutar respeita chaves de origem e detecta mudanças de hash, sem sobrescrever silenciosamente fatos operacionais.

A carga conserva anotações e dados originais de IATF, relações comprovadas, períodos e lactações. Referências sem correspondência, origens desconhecidas, paridade sem reconciliação e protocolos sem precisão operacional suficiente aparecem como pendências. Os arquivos extraídos, mapas com dados da fazenda e relatórios não devem ser versionados.
