# Dados de desenvolvimento e carga inicial

## Seed única de desenvolvimento

`server/prisma/seed.ts` é a única entrada demonstrativa e o comando configurado no Prisma. Seus módulos internos ficam em `server/prisma/seed/`; o [guia da seed](../server/prisma/seed/README.md) descreve os cenários e as chaves para navegação. O código está preparado para o cenário integrado; o resultado de cada ambiente depende da baseline aplicada e da conferência efetivamente executada. A existência do gerador não comprova carga completa, arquivos R2 ou homologação pela fazenda.

O destino permitido é exclusivamente o PostgreSQL local **`fazendinha_seedatev3`**, fora de produção, com `STORAGE_NAMESPACE=dev` ou `test`. `DATABASE_URL` e `DIRECT_URL`, quando fornecida, devem apontar para esse mesmo banco. O preflight confere identidade, baseline única/checksum, migrations concluídas, manifesto e exclusão mútua antes de importar os serviços que escrevem. O executor não cria banco, limpa dados ou aplica migrations.

Após configurar `server/.env` conforme o [README](../README.md), use:

```bash
pnpm --filter rionovo-server run seed --preflight
pnpm --filter rionovo-server run seed
pnpm --filter rionovo-server run seed --verificar
pnpm --filter rionovo-server run seed:typecheck
```

A execução normal exige a baseline correspondente aplicada. Um banco com fatos ou usuários sem o manifesto desta seed é recusado. Substituir um ambiente existente por uma instalação da baseline é uma manutenção separada: exige autorização, preservação dos dados/manifestos e recuperação preparada. Não use `migrate reset`, `db push`, exclusão de volumes, remoção do manifesto ou outro banco para contornar a guarda.

O cenário possui exatamente três sítios: Principal, Arrendado e Test, com 72, 36 e 24 animais ativos. No Principal há 36 lactantes, 12 secas/gestantes, dez novilhas, oito crias e seis matrizes de finalidade Reprodução. As oito crias são geradas pelos partos e estão incluídas nas quantidades. Arrendado reúne receptoras, novilhas, um touro e Nelore de corte; Test possui somente Nelore de corte. Papel reprodutivo, finalidade, raça, lactação e situação sanitária são eixos independentes.

Compras e entradas abastecem o estoque antes dos consumos. Rebanho, localização, partos/crias, terceira e quarta tentativas, lactações, sanidade, visitas, dietas e leite compartilham os mesmos fatos. IA/TE históricas documentadas conservam justificativa sem fabricar baixa retroativa ou custo; as tentativas recentes com estoque produzem consumo real. Produtos, doses, resultados, preços e intervalos são sintéticos para teste de software, sem recomendação veterinária ou representação de resultados da fazenda.

## Acessos demonstrativos

A seed cria somente os dois usuários abaixo, ativos e como donos, com o maior permissionamento vigente, Financeiro/Pecuária, valores, lançamentos, exportação e gestão de acessos. Senhas são armazenadas por `hashSenha`; a preparação não envia e-mails.

| E-mail | Senha inicial local |
|---|---|
| `fellipe@test.com` | `test1234` |
| `rafael@test.com` | `test1234` |

Perfis restritos são fixtures temporárias de testes, sem outros usuários persistentes na seed. Valide as permissões também na API: visibilidade de botão não comprova autorização e `verValores` precisa ser respeitado em DTOs, custos e relatórios. Consulte o [contrato financeiro](financeiro-rebuild-contrato.md#permissões-e-documentos).

## Retomada, arquivos e verificação

O manifesto `server/.seed/manifesto.json`, ignorado pelo Git, congela a data-base em `America/Sao_Paulo` e registra identidade do banco, baseline/checksum, chaves, IDs, ações e etapas. Reexecução continua o que faltou sem restaurar resultados alterados pela interface. Remoção ou divergência de referência interrompe a preparação; não apague o manifesto para recarregar. Preserve banco, manifesto e evidências locais em conjunto.

`--preflight` confere o ambiente sem escrita e `--verificar` usa conexões somente leitura, sem atualizar manifesto, guia ou marcações de roteiros. A conferência verifica o estado atual e pode apontar divergências após o uso do cenário; ela não desfaz a simulação. `--interromper-apos=<etapa>` permite ensaiar interrupção/retomada no mesmo executor em condições autorizadas. As etapas válidas são as declaradas no entrypoint.

A preparação local não depende de publicação de arquivos. `--arquivos-r2` é uma etapa adicional explícita, com bucket, credenciais e namespace autorizados; sem ela, a cobertura de anexos permanece pendente. Snapshots ou arquivos locais não comprovam upload, download ou vínculo R2. O guia é emitido ao final da conferência da execução normal.

Os executores demonstrativos por versão, planner, QA e catálogo separado foram retirados. Não há cadeia de complementos a executar depois desta seed. Helpers antigos ainda necessários a testes ou utilitários históricos não são outra entrada de carga. Diretórios privados anteriores e backups não devem ser apagados pela manutenção do código; os manifestos antigos não são adotados automaticamente pelo executor novo.

## Homologação e testes

Os [roteiros V3](pecuaria/artefatos/testes-v3-guia.html) e [V4](pecuaria/artefatos/testes-v4-guia.html) conservam casos, marcações e evidências anteriores. Seus IDs, perfis e preparações históricas não descrevem o cenário atual. Adapte a referência do caso ao guia vigente e registre bloqueios quando faltar uma fixture; não recrie os sítios ou usuários antigos nem altere aceites pela atualização documental. O caderno V4 continua como material de estudo, com propostas distinguíveis do contrato implementado.

`server/scripts/preparar-guia-v3.ts` permite somente consulta no banco autorizado; suas preparações e limpezas antigas permanecem recusadas. Testes unitários, builds, verificações SQL e homologação manual são evidências distintas. Não rode uma seed para validar apenas documentação ou uma mudança comum. Testes com `AUTH_DB_INTEGRATION`, `PECUARIA_DB_INTEGRATION` ou `FINANCE_DB_INTEGRATION` escrevem: revise o ciclo de fixtures antes de executá-los localmente. Casos que recriam estrutura ou outro banco ficam no CI externo.

## Carga inicial IDEAGRI

Os utilitários mantidos formam a cadeia existente de Rebanho/Genética:

1. `scripts/extract-pecuaria.sh` / `scripts/pecuaria-dump.sql`: extração da fonte; confira os caminhos locais antes de executar.
2. `scripts/build-pecuaria-json.mjs`: transformação para o JSON de carga; comportamento coberto por `build-pecuaria-json.test.mjs`.
3. `import:pecuaria`: importa `server/prisma/pecuaria_v1.json`, gerado e ignorado pelo Git.
4. `validar:pecuaria`: conciliação da carga.

O importador prepara os catálogos de raças e motivos recebidos no próprio JSON; não depende de um executor de seed de catálogos separado. A importação não sincroniza alterações do IDEAGRI: animal já importado é ignorado; a passada de genética preenche lados vazios sem sobrescrever filiação editada. O importador trata animais em transações individuais e relata falhas; execução parcial não significa carga integral concluída. A carga histórica de Sanidade/Nutrição V3 ainda não está entregue.

### Ensaio opcional de volume nutricional

`server/src/services/pecuaria/nutricao/volume.integration.test.ts` é um ensaio sintético de leitura com milhares de lotes, receitas, vigências e fechamentos. Exige `PECUARIA_DB_INTEGRATION=1` e `NUTRICAO_VOLUME_INTEGRATION=1`; seu preparo cria uma massa volumosa em banco isolado `qa_volume_`. Por exigir outro banco, este ensaio fica restrito ao CI externo. Não execute sua preparação nem crie esse banco no desenvolvimento local; use somente `fazendinha_seedatev3` com fixtures próprias proporcionais à mudança.

O teste registra tempo de serviço, bytes JSON e quantidade de statements SQL reais do Prisma, incluindo transação e relações. Confere escopo por sítio, custos desconhecidos/zero/mascarados, exclusão de estornos e páginas profundas. Não mede HTTP, Workers/Neon, concorrência ou rede, nem define SLA. A flag adicional evita executar o cenário de volume em toda suíte de integração comum.

## Carga financeira Rio Novo

`server/prisma/import-rio-novo.ts` importa os fatos liquidados da aba `RN_SICOOB PJ` do relatório Rio Novo. A carga lê somente a tabela detalhada: não interpreta abas de projeção ou consolidações como novos fatos. Ela cria o sítio `Rio Novo`, a conta `BB MAGC`, os centros, categorias e parceiros necessários, preservando data, sentido, valor, categoria, centro de custo, parceiro e referência documental disponível.

Use primeiro a conferência sem escrita e depois a importação em um banco local de desenvolvimento com migrations aplicadas e um dono ativo:

```bash
pnpm --filter rionovo-server run import:rio-novo -- "/mnt/c/caminho/Relatório Rio Novo 2026.05.04.xlsx" --verificar
pnpm --filter rionovo-server run import:rio-novo -- "/mnt/c/caminho/Relatório Rio Novo 2026.05.04.xlsx"
```

O importador aceita PostgreSQL local; no desenvolvimento, use exclusivamente `fazendinha_seedatev3`. Ele usa uma chave determinística por linha do relatório e pode ser reexecutado sem duplicar operações. Transferências, saldo inicial, ajustes, estornos, aplicações e valores ainda a identificar são importados como aporte/retirada, pois a planilha não informa uma contraparte interna suficiente para criar transferência entre contas. Os demais créditos viram vendas sem estoque e os débitos viram serviços sem estoque; não se inferem quantidades, produtos, lotes ou compromissos a partir do extrato.

Seeds de demonstração por módulo/PR e a massa do Excel anterior foram retirados. Fixtures dos testes, catálogos das migrations e importador atual continuam disponíveis.

## Carga técnica V4 e testes de reprodução

A carga real V4 tem ferramentas separadas da seed demonstrativa única. Não rode `seed`, `db push` ou uma carga histórica para testar uma mudança comum. **Toda validação local usa somente `fazendinha_seedatev3`**, sem criar banco descartável, clone ou cópia para ensaio. `DATABASE_URL` e `DIRECT_URL` no `server/.env` devem apontar para esse mesmo banco; o Prisma usa a conexão direta nas migrations.

As flags de integração habilitam escritas reais. Antes de executar uma suíte local, confira que sua preparação/limpeza altera somente fixtures próprias, sem colisão com dados existentes. Não rode indiscriminadamente a suíte inteira com todas as flags. Testes que recriam banco/estrutura e a bateria financeira que cria bancos estão restritos ao CI externo. Migrations locais são aplicadas diretamente no banco de desenvolvimento, sem recarregar o cenário. Testes unitários, builds e consultas de conferência continuam disponíveis.

O extrator `scripts/extract-pecuaria-v4.sh` exige caminho explícito de uma **cópia** Firebird e diretório de saída fora do Git, ambos acessíveis pelo Windows em `/mnt/c`. Recusa o diretório operacional `Ideagri/dados`. Consultas usam transação somente de leitura; erros SQL/UDF interrompem a transformação automática, conservando o dump para inspeção. `scripts/build-pecuaria-v4-json.mjs` verifica sentinelas e totais das tabelas antes de gerar o JSON. A presença de um dump não prova que a extração terminou integralmente.

```bash
scripts/extract-pecuaria-v4.sh '/mnt/c/copia/DADOS777.FDB' '/mnt/c/copia/saida-v4'
pnpm --filter rionovo-server run import:pecuaria:v4:typecheck
```

O contrato de carga e mapeamento fica em `server/prisma/import-v4/contrato.ts`. A prévia é o padrão e escreve somente o relatório solicitado; ela não cria animais nem importa fatos no banco. Informe carga, mapeamento e relatório explicitamente:

```bash
pnpm --filter rionovo-server run import:pecuaria:v4 --arquivo=/caminho/carga.json --mapeamento=/caminho/mapa.json --relatorio=/caminho/previa.json
```

Para executar no único banco de desenvolvimento, acrescentam-se `--executar --banco-confirmado=fazendinha_seedatev3`. O importador recusa execução em ambiente de produção ou banco remoto; publicar código não autoriza aplicar a carga. Conflitos causam saída não zero e precisam de leitura do relatório, inclusive quando uma execução foi parcial. Reexecutar respeita chaves de origem e detecta mudanças de hash, sem sobrescrever silenciosamente fatos operacionais.

A carga conserva anotações e dados originais de IATF, relações comprovadas, períodos e lactações. Referências sem correspondência, origens desconhecidas, paridade sem reconciliação e protocolos sem precisão operacional suficiente aparecem como pendências. Os arquivos extraídos, mapas com dados da fazenda e relatórios não devem ser versionados.
