# Dados de desenvolvimento e carga inicial

## Seed única de desenvolvimento

`server/prisma/seed.ts` é a única entrada demonstrativa e o comando configurado no Prisma. Seus módulos internos ficam em `server/prisma/seed/`; o [guia da seed](../server/prisma/seed/README.md) descreve os cenários e as chaves para navegação. O código está preparado para o cenário integrado; o resultado de cada ambiente depende da baseline aplicada e da conferência efetivamente executada. A existência do gerador não comprova carga completa, arquivos R2 ou homologação pela fazenda.

O destino permitido é exclusivamente o PostgreSQL local **`fazendinha_seedatev3`**, fora de produção, com `STORAGE_NAMESPACE=dev` ou `test`. `DATABASE_URL` e `DIRECT_URL`, quando fornecida, devem apontar para esse mesmo banco. O preflight exige a baseline canônica `20261025000000_base_unificada` como primeira migration, seguida de incrementais: cada arquivo deve corresponder a uma única aplicação ativa concluída com checksum idêntico, sem migrations desconhecidas ou pendentes no banco. Tentativas revertidas não substituem uma aplicação concluída. A identidade do manifesto permanece ancorada na baseline, permitindo retomar após incrementais válidas; manifesto e exclusão mútua continuam conferidos antes de importar os serviços que escrevem. O executor não cria banco, limpa dados ou aplica migrations.

Após configurar `server/.env` conforme o [README](../README.md), use:

```bash
pnpm --filter rionovo-server run seed --preflight
pnpm --filter rionovo-server run seed
pnpm --filter rionovo-server run seed --verificar
pnpm --filter rionovo-server run seed:typecheck
```

A execução normal exige a baseline correspondente aplicada. Um banco com fatos ou usuários sem o manifesto desta seed é recusado. Substituir um ambiente existente por uma instalação da baseline é uma manutenção separada: exige autorização, preservação dos dados/manifestos e recuperação preparada. Não use `migrate reset`, `db push`, exclusão de volumes, remoção do manifesto ou outro banco para contornar a guarda.

O cenário possui exatamente três sítios: Principal, Arrendado e Test, com 72, 36 e 24 animais ativos. No Principal há 36 lactantes, 12 secas/gestantes, dez novilhas, oito crias e seis matrizes de finalidade Reprodução. As oito crias são geradas pelos partos e estão incluídas nas quantidades. Arrendado reúne receptoras, novilhas, um touro e Nelore de corte; Test possui somente Nelore de corte. Papel reprodutivo, finalidade, raça, lactação e situação sanitária são eixos independentes.

Compras e entradas abastecem o estoque antes dos consumos. Rebanho, localização, partos/crias, terceira e quarta tentativas, lactações, sanidade, visitas, dietas e leite compartilham os mesmos fatos. IA/TE históricas documentadas conservam justificativa sem fabricar baixa retroativa ou custo; as tentativas recentes com estoque produzem consumo real. Produtos, doses, resultados, preços e intervalos são sintéticos para teste de software, sem recomendação veterinária ou representação de resultados da fazenda. Novos produtos sanitários declaram os dois prazos pelo contrato normal do catálogo; o exemplo de histórico de aplicação incompleto possui prazo fictício de 96 horas para leite e 48 para carne. Isso não preenche o snapshot da aplicação 13: ela permanece `NAO_INFORMADO` com prazo de leite `null`, independentemente das 96 horas do medicamento no catálogo. Cadastros existentes recuperados pelo manifesto não são renomeados nem têm seus prazos restaurados.

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

Para executar no único banco de desenvolvimento, acrescentam-se `--executar --banco-confirmado=fazendinha_seedatev3 --manifesto-confirmado=HASH_DA_PREVIA`. Produção é bloqueada. STG remoto exige namespace `staging`, conexão Neon com TLS e as confirmações explícitas de ambiente e `host/banco` descritas na ferramenta histórica abaixo; publicar código não autoriza aplicar a carga. Conflitos causam saída não zero e precisam de leitura do relatório, inclusive quando uma execução foi parcial. Reexecutar respeita chaves de origem e detecta mudanças de hash, sem sobrescrever silenciosamente fatos operacionais.

O relatório identifica namespace, host e banco de destino, sem credenciais. `manifesto.hash` identifica o plano revisável: origem, operações de criar/reutilizar, hashes dos registros, dependências explícitas, autoria, destino do CLI e resolução dos animais/localizações. Mudanças nesses dados invalidam a revisão. Uma execução com manifesto divergente da prévia é bloqueada antes de escrever. A identidade do manifesto é independente da ordem dos itens; o hash histórico dos vínculos V4 continua compatível. A execução local aceita exclusivamente `fazendinha_seedatev3`.

Chaves duplicadas no mesmo plano bloqueiam a execução, mesmo quando os registros coincidem. O `recibo` conserva IDs dos vínculos já encontrados e discrimina criação, reutilização concorrente, falha e bloqueio por dependência. Uma falha não executa os descendentes sem vínculo; registros independentes podem concluir, com transação própria para fato/vínculo/auditoria. Para retomar, gere outra prévia do estado atual e revise seu novo manifesto; não apague fatos, restaure o banco ou remova vínculos globalmente. Correções de origem e associação de fatos operacionais existentes ainda exigem reconciliação específica.

O CLI V4 também reserva o recibo antes de carregar ambiente/banco, protege tanto o arquivo de carga quanto o mapeamento contra sobrescrita (inclusive por aliases) e publica o relatório completo por substituição atômica. Erro anterior à gravação conserva o relatório existente; falha de publicação após commits informa o arquivo reservado para recuperação. As limitações de filesystem e a recuperação por nova prévia descritas abaixo também se aplicam ao V4.

A carga conserva anotações e dados originais de IATF, relações comprovadas, períodos e lactações. Referências sem correspondência, origens desconhecidas, paridade sem reconciliação e protocolos sem precisão operacional suficiente aparecem como pendências. Os arquivos extraídos, mapas com dados da fazenda e relatórios não devem ser versionados.


### Baixas históricas sem classificação

A migration incremental `20261029000000_baixa_historica_tipo_indeterminado` acrescenta o tipo específico e as evidências de regularização, sem alterar registros antigos. Não executá-la incidentalmente ao testar interface. As rotas e precauções do fluxo estão no [contrato da Pecuária](pecuaria/README.md#regularização-de-baixa-histórica).

O importador técnico V1 não transforma mais uma classe de descarte em venda ou ausência de tipo em morte. O cálculo puro `classificacao-baixa-origem.ts` recusa casos ambíguos, preservando o rollback do animal já existente no importador e o relatório de falhas. A resolução desses casos exige dados comprovados e a regularização específica; não refazer uma carga nem apagar o banco para suprir essa lacuna.

## Reconciliação técnica STG de fatos históricos

`server/prisma/import-pecuaria-stg.ts` prepara e executa decisões explícitas de carga/reconciliação de pesagens, leite, ECC, qualidade e mastite. O contrato do envelope está em `prisma/import-stg/contrato.ts`; os formatos de cada fato e suas garantias pertencem aos handlers de `src/services/pecuaria/importacao/historico.ts`. A ferramenta reutiliza manifesto/dependências do importador V4. Não substitui a seed, não cria banco, não aplica migrations e não instala sincronização contínua.

A entrada JSON exige `bancoOrigem`, `autorId` ativo no destino e `itens`. Cada item tem `chave` única no formato `TABELA:id`, `dependencias` com chaves da mesma origem, `operacao` e `fato: { tipo, dados }`. Os tipos aceitos são `PESAGEM`, `LEITE`, `ECC`, `QUALIDADE`, `MASTITE` e `ASSOCIACAO_PESO_SECAGEM`; campos extras no envelope/item e formatos inválidos são recusados. `bancoOrigem` global e a chave **completa** do item são injetados em `fato.dados.bancoOrigem`/`chaveOrigem` antes da validação do domínio. Se esses campos vierem informados e divergirem, a carga é rejeitada; não há sobrescrita silenciosa de proveniência.

As decisões são diferentes:

- `CRIAR` solicita um novo fato. Origem idêntica já comprovada por `VinculoImportacaoPecuaria` reutiliza seu ID, sem executar novamente o fato.
- `VINCULAR` reconhece um fato existente, com `destinoId` e `motivo` explícitos. O handler confere a compatibilidade; semelhança de animal/data/valor não comprova equivalência.
- `CORRIGIR` exige o vínculo anterior, o mesmo `destinoId`, `motivo`, `versaoEsperada` do fato e `hashOrigemEsperado` do vínculo anterior. O handler precisa autorizar a correção. Hash divergente não é atualizado por `CRIAR`/`VINCULAR`.

Candidatos a duplicidade exigem `VINCULAR` ou revisão explícita com `duplicidadesRevisadas` cobrindo todos os IDs apresentados e motivo. A decisão não cria equivalências por proximidade temporal. Mapeamentos de unidade, escala e origem precisam estar comprovados nos dados do domínio; a ferramenta não os preenche por suposição.

Os handlers cobrem `PESAGEM`, `LEITE` documental, `ECC`, `QUALIDADE` e `MASTITE`, conforme o [contrato de incorporação histórica](pecuaria/leite.md#incorporação-documental-e-clínica). `CORRIGIR` está habilitado somente para o documento `LEITE`, com versão, motivo e identidade preservada. Pesagens e fatos clínicos não são reescritos por essa operação; exigem revisão auditada específica do domínio. O envelope não amplia as permissões de correção de cada handler.

Execute em `server/`, com o `.env` autorizado configurado. Prévia é o padrão e só lê o banco; o relatório é gravado no arquivo solicitado:

```bash
pnpm import:pecuaria:stg --arquivo=/caminho/carga.json --relatorio=/caminho/previa-stg.json
```

O manifesto SHA256 conserva autor, banco de origem, destino exato sem credenciais, operações, dependências, hashes, candidatos/revisões e o contexto preparado pelos handlers. A comparação dos snapshots históricos usa assinatura canônica: a reordenação de chaves pelo JSONB não invalida um reenvio idêntico; valores, autoria, `null` e a ordem das parcelas, achados e tratamentos continuam relevantes. Revise o relatório completo. Alterar carga, decisão, destino, autoria ou contexto de domínio invalida a confirmação anterior.

A execução local aceita **somente** `fazendinha_seedatev3` em loopback, com confirmação explícita. Não execute contra outro banco nem recrie a base para ensaiar:

```bash
pnpm import:pecuaria:stg --arquivo=/caminho/carga.json --relatorio=/caminho/recibo-stg.json --executar --banco-confirmado=fazendinha_seedatev3 --manifesto-confirmado=HASH_DA_PREVIA
```

Para STG remoto, configure `STORAGE_NAMESPACE=staging`, URL Neon com `sslmode=require`, e confirme tanto ambiente quanto `host/banco` exatos apresentados na prévia. Esse comando só pode ser usado na carga/reconciliação autorizada; disponibilizar a ferramenta não autoriza executá-la:

```bash
pnpm import:pecuaria:stg --arquivo=/caminho/carga.json --relatorio=/caminho/recibo-stg.json --executar --ambiente-confirmado=staging --destino-confirmado=HOST_NEON/BANCO_STG --manifesto-confirmado=HASH_DA_PREVIA
```

Produção (`STORAGE_NAMESPACE=prod`) é bloqueada, inclusive na prévia. Antes de carregar ambiente/banco, a ferramenta confere que o relatório existente é arquivo regular e tem permissão de escrita, que a pasta permite escrita e que o destino não é a origem, inclusive por link simbólico ou hard link. Reserva um arquivo privado temporário no mesmo filesystem sem truncar o relatório anterior; publica o JSON completo por substituição atômica depois da escrita e sincronização. Se o destino for alterado durante a carga, conserva o novo recibo temporário e informa seu caminho para recuperação. O cancelamento anterior à gravação limpa somente a própria reserva. `--ajuda` não conecta ao banco. Confirmações são guardas técnicas e não substituem autorização da manutenção.

A reserva verifica tipo/permissões e a possibilidade inicial de criar o arquivo; não garante espaço ou disponibilidade futura do filesystem. Disco cheio, perda do volume ou falha de escrita após commits podem impedir um recibo completo. Nesse caso, o erro identifica o arquivo temporário, advertindo quando pode estar incompleto; a recuperação usa as auditorias transacionais e uma nova prévia, sem repetir fatos nem remover vínculos.

Um conflito na prévia bloqueia o lote inteiro. Na execução, cada unidade grava fato, vínculo de origem e auditoria na mesma transação `Serializable`, pelo executor transacional pecuário. O contexto é preparado novamente antes da gravação; divergência exige nova prévia. A falha reverte a unidade e bloqueia seus descendentes; unidades independentes podem ter sido concluídas. O recibo distingue `CRIADO`, `REUTILIZADO`, `VINCULADO`, `CORRIGIDO`, `PENDENTE`, `FALHOU` e `BLOQUEADO`, com ID somente quando efetivamente resolvido, chave/hash da origem, contexto preparado e manifesto executado. Não refaça a seed nem remova fatos para recuperar uma execução parcial.

Reenvio do manifesto original é aceito sem novas escritas somente quando o **lote inteiro** já está concluído, com hashes/IDs atuais e auditorias comprovando aquela mesma carga, autoria, destino e manifesto. Associações de peso na secagem exigem também revalidação do vínculo ativo pelo núcleo atual, conforme a seção abaixo. O manifesto completo fica na auditoria do primeiro item; as demais conservam seu hash. Uma execução parcial exige uma nova prévia. Ao concluir esse novo plano, o reuso recebe auditoria da nova decisão revisada, sem repetir fato ou vínculo; o reenvio integral desse plano não acrescenta outra auditoria. A chave única de origem permanece em `VinculoImportacaoPecuaria`.

Validação unitária da orquestração, sem banco:

```bash
AUTH_DB_INTEGRATION=0 PECUARIA_DB_INTEGRATION=0 FINANCE_DB_INTEGRATION=0 \
DATABASE_URL=postgresql://test:test@127.0.0.1:1/fazendinha_seedatev3 \
pnpm test:import:pecuaria:stg
pnpm import:pecuaria:stg:typecheck
```

Os testes usam persistência em memória, o executor transacional real e doubles dos handlers para conferir manifesto, dependências, rollback, origem, correção e recuperação. Não homologam a carga, as constraints PostgreSQL, concorrência real, unidades/escalas dos arquivos de origem ou acesso a STG. Testes dos handlers validam as regras de cada domínio separadamente.

### Associação histórica de peso na secagem

A reconciliação STG aceita o fato `ASSOCIACAO_PESO_SECAGEM`, com chave de origem **própria**, separado do fato `PESAGEM`. A pesagem continua sendo criada ou reconhecida pelo caminho anterior; associá-la não cria outro peso nem altera seu tipo, origem, precisão ou contexto. O handler `src/services/pecuaria/importacao/peso-secagem.ts` reutiliza as prévias e o executor transacional de `reproducao/peso-secagem.ts`. Não registra encerramento, data, motivo ou lactação para satisfazer uma associação.

Em `fato.dados`, informe `pesagem: { id }` ou `pesagem: { chaveOrigem: "TABELA:id" }`, além de `lactacaoId`, `propriedadeId` e `evidenciaEncerramento` quando comprovados. A referência por origem consulta exclusivamente `VinculoImportacaoPecuaria` do mesmo `bancoOrigem` e precisa apontar à entidade `Pesagem`; essa chave é acrescentada às dependências do item. Não se procura uma pesagem pela proximidade de animal/data/valor. `bancoOrigem` e a chave completa da associação continuam injetados canonicamente pelo envelope.

Exemplo estrutural **fictício** de uma solicitação ainda sem prova; não representa registro da fazenda nem carga autorizada:

```json
{
  "bancoOrigem": "IDEAGRI_EXEMPLO",
  "autorId": 7,
  "itens": [{
    "chave": "ASSOCIACAO_SECAGEM:exemplo-1",
    "operacao": "CRIAR",
    "fato": {
      "tipo": "ASSOCIACAO_PESO_SECAGEM",
      "dados": {
        "pesagem": { "chaveOrigem": "PESO:exemplo-1" },
        "lactacaoId": null,
        "propriedadeId": null,
        "evidenciaEncerramento": null
      }
    }
  }]
}
```

A prévia e o recibo apresentam `associacoesSecagem` por chave com `COMPROVADA`, `PENDENTE` ou `CONFLITO`, IDs efetivamente resolvidos, referência da pesagem, motivo e indicação de execução. O resumo `pesosSecagem` conta os itens `PESAGEM` de tipo `SECAGEM` existentes no arquivo: total, pesos a criar/reutilizáveis, candidatos, conflitos e quantidades criadas/reutilizadas no recibo. `manifesto.contexto.resumoSecagens` conserva a quantidade e os mapeamentos revisados. As contagens vêm da entrada real: os **100 casos mencionados pela fazenda não foram fornecidos, carregados, inventados ou homologados** por esta implementação.

Falta de pesagem conciliada, lactação/encerramento comprovado, sítio ou evidência suficiente produz `PENDENTE`. Isso não impede importar uma pesagem válida ou executar registros independentes. A execução da pendência não chama o núcleo de associação, não cria `VinculoImportacaoPecuaria`, não devolve `destinoId` fictício e não libera itens que dependam da associação concluída. O motivo fica no relatório/recibo; não é uma associação persistida. Uma incompatibilidade factual do núcleo (animal, data exata, sítio, contexto externo ou outro vínculo ativo) é `CONFLITO` e precisa de revisão.

Quando a pesagem ainda será criada, a primeira etapa pode conter `PESAGEM` e a solicitação de associação por sua origem: o peso é importado e a associação permanece pendente nesse manifesto. Gere **outra prévia** após conciliar o peso e completar as provas. Só então a segunda etapa associa a identidade existente, com fato de vínculo, origem e auditoria na mesma transação. Não reescreva o hash ou os dados do peso para acrescentar a associação. Um peso avulso de tipo `SECAGEM`, sem solicitação explícita de associação, continua sendo somente pesagem.

`CRIAR` cria a associação comprovada ou recupera a associação ativa idêntica. `VINCULAR` exige que `destinoId` seja o vínculo ativo exatamente conferido. `CORRIGIR` de associação é recusado neste CLI: substituir, corrigir ou revogar o vínculo já gravado pertence à manutenção auditada da lactação. A chave da origem não é remapeada silenciosamente para outra associação.

Reenvio integral e reuso normal de uma associação consultam o núcleo **atual** e exigem que o vínculo ativo ainda tenha o mesmo ID registrado na origem. Reabrir a lactação e revogar o vínculo invalida a prova estática de conclusão: a leitura passa a pendente enquanto estiver aberta; um novo encerramento sem o vínculo ativo original gera conflito. Não se ressuscita associação revogada nem se substitui seu ID pela mera repetição do manifesto. O peso e o histórico anterior permanecem preservados. Na execução, a verificação é repetida sob trava do animal antes de afirmar reutilização.

O CLI publica `pendentes` e as contagens de associações também no stdout. Código de saída **0** indica conclusão sem pendências; **1**, conflito/falha/bloqueio; **2**, prévia ou execução com pendências e sem falha. Código 2 não significa rollback dos pesos válidos já concluídos. A pendência exclui o lote da prova de reenvio integral concluído; somente uma nova prévia com a prova necessária pode resolvê-la.

Testes com dados fictícios verificam prévia sem escrita, ausência de ID/origem falsa na pendência, reutilização da pesagem, dependências, rollback da associação, preservação da precisão, reenvio, reabertura/revogação e novo encerramento. Não substituem integração SQL, arquivos reais, conferência dos mapeamentos dos 100 casos ou homologação da fazenda.
