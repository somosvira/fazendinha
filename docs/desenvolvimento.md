# Dados de desenvolvimento e carga inicial

## Cenário unificado até V3

`server/prisma/seedatev3.ts` é o seed padrão de desenvolvimento e do Prisma. Só aceita PostgreSQL local **`fazendinha_seedatev3`**, fora de produção, com namespace R2 `dev` ou `test` e todas as migrations aplicadas/inalteradas. Não cria nem exclui bancos.

Após configurar `server/.env` conforme o [README](../README.md):

```bash
pnpm --filter rionovo-server exec prisma migrate deploy
pnpm --filter rionovo-server run seedatev3
pnpm --filter rionovo-server run seedatev3 --verificar
```

O cenário reúne Principal/Destino, 18 animais, seis lotes, genética, pesagens/manejos, transferências/baixas, contas, operações/compromissos/liquidações/estornos, protocolos/ciclos/aplicações/exames e receitas/vigências/fechamentos. Documentos e relatórios demonstrativos usam R2; não são documentos fiscais reais. O seed principal permanece limitado à V3. O complemento opcional abaixo acrescenta manejo V4, sem produção de leite.

Catálogos demonstrativos ficam em `server/prisma/seedatev3/catalogos.ts`. Padrões são carga inicial editável, não regra clínica fixa. IDs existentes das migrations são reaproveitados, sem sobrescrever configurações do usuário. Centros financeiros chamados Agronomia/Equipe não reintroduzem os módulos retirados.

Acessos fictícios exclusivos desse ambiente; senha inicial: `SeedateV3!Local2026`.

| Perfil | E-mail | Configuração |
|---|---|---|
| Dono | `seedatev3.dono@example.test` | Acesso completo |
| Consulta | `seedatev3.consulta@example.test` | Consulta das duas áreas, sem lançamento |
| Operador | `seedatev3.operador@example.test` | Lançamento nas duas áreas, sem `verValores` |

O operador sem `verValores` recebe valores monetários nulos nos DTOs de operações/estoque e 403 nas consultas monetárias agregadas, relatórios, documentos e rascunhos financeiros. Pode criar uma nova operação com preços manuais por envio direto, sem autosave/retomada de rascunho, e registrar fatos físicos autorizados. Correção/cancelamento/estorno/liquidação e contas exigem visibilidade de valores. Para validar esse perfil, confira resposta da API além da interface, compare dono/consulta/operador e teste o sítio nos links diretos; veja o [contrato financeiro](financeiro-rebuild-contrato.md#permissões-e-documentos). O seed configura permissões e dados demonstrativos; não comprova homologação.

## Retomada e verificação

A data-base é calculada uma vez em `America/Sao_Paulo` e conservada com identidade do banco, versão, IDs, ações e etapas em `server/.seedatev3/manifesto.json`, ignorado pelo Git. Consulte `dataBase` no manifesto do ambiente; não assuma uma data fixa de uma sessão anterior. Datas que envelhecem são evolução natural, não motivo para repopular.

Reexecuções mantêm a data e não repetem etapas concluídas. Registro removido manualmente não é recriado automaticamente. Preserve manifesto junto do banco/backup; restauração exige conferir identidade. `migrate reset`, exclusão de volume ou descarte do manifesto invalidam a continuidade.

`--verificar` usa conexões somente leitura e confere relações, saldos, estoque por sítio/validade, carências, animal-dias, custos e arquivos. Para testar retomada no cenário apropriado, `--interromper-apos=catalogos` interrompe controladamente; rodar sem a opção continua. Etapas estão declaradas no entrypoint. O período fechado demonstrativo é uma fixture administrativa auditada, pois não há comando público de fechamento; não invente esse fluxo de interface.

A verificação do seed pode ler arquivos reais do R2. Não rode o seed nem sua preparação para validar apenas documentação/código sem alteração de dados. As configurações inertes dos testes unitários não servem para executar o cenário.

Backups e evidências locais ficam em `.backups/` e `server/.seedatev3/`, fora do Git. A manutenção do repositório não autoriza removê-los. Recuperação de bancos e volumes depende de seus backups, não de planos antigos ou de um novo seed.

## Seed V4 completa para simular a rotina

`seedatev3` continua sendo a base V3. **`seedatev4`** acrescenta a V4 e seu follow-up ao mesmo `fazendinha_seedatev3`, pelos serviços operacionais, com sítios e produtos próprios. Não reexecuta a V3, limpa dados, cria outro banco/clone/backup ou depende de R2. Os complementos anteriores não são pré-requisitos.

| Seed | Finalidade |
|---|---|
| `seed` / `seedatev3` | Cenário principal até V3; preservar dados e manifesto |
| `seedatev4` | Demonstração operacional completa da V4, complementar à V3 |
| `seedatev3:planner` | Preparação histórica; bloqueada no ambiente consolidado |
| `seedatev3:qa` | Preparação histórica de QA; bloqueada no ambiente consolidado |
| `seed:pecuaria` | Somente catálogos de raças/motivos |

```bash
pnpm --filter rionovo-server run seedatev4
pnpm --filter rionovo-server run seedatev4 --verificar
pnpm --filter rionovo-server run seedatev4:typecheck
```

Escolher **V4 · Fazenda Escola** na interface; **V4 · Fazenda Destino** demonstra transferência e continuidade clínica. Acessos da V3 permanecem, sem alteração de senhas/permissões. Produtos, doses e intervalos são fictícios para testar software, sem recomendação clínica.

O ambiente local consolidado tem somente **dois registros de sítio**, com a **Fazenda Escola** como principal. Os dados da V3 foram incorporados aos mesmos sítios da V4: o alias `sitio:Principal` aponta para Escola e `sitio:Destino` para Destino nos dois manifestos. Os cadastros antigos e as fixtures `QA322`/`QA322R` foram removidos. Animais, fatos, valores, datas, autoria e vínculos da V3/V4 permanecem; a consolidação muda somente as identidades de escopo. Reexecutar a seed preserva a configuração e não repõe os sítios antigos.

| Animais / área | Cenários preparados |
|---|---|
| `V4-001` a `V4-003` | Ciclos ativos com uma, duas e três tentativas; negativos anteriores e DG final pendente |
| `V4-004` a `V4-006` | Gestações após uma, duas e três tentativas, reconfirmação/sexo fetal e pacote de Serviço |
| `V4-007` / `V4-008` | Aborto explicado e novo ciclo ativo; perda gestacional distinta de aborto, com causa desconhecida e evidência textual |
| `V4-009` a `V4-012` | Natimorto, parto vivo, gêmeos/RP e TE/cria provisória; pesos, escore, lactação e colostro |
| `V4-013` a `V4-030` | Origem desconhecida, retorno, inconclusivo, seca, lactação histórica, descarte, alerta/bloqueio, doadora/receptora, cobertura/exposição, novilha liberada, material de estoque e transferência/retorno |
| `V4-031` a `V4-060` | IATF em evolução, IA/TE previstas no dia-base, hora desconhecida e programações sem início |
| `V4-061` a `V4-064` | Touro, execução anulada com consumo mantido/regularização pendente e protocolos sanitários em estados diferentes |
| `V4-065` | Dois partos factuais com intervalo de 410 dias; o saldo de partos anterior à entrada não fabrica datas |
| `V4-101` a `V4-220` | 120 matrizes com tentativa e DG de protocolo pendente, para paginação/confirmação em blocos |
| Visitas | Agenda de 120 animais; Seleção livre com dois rascunhos não confirmados; início IATF; visita encerrada com adiamento/ausência; visita vazia |
| Custos / nutrição | Saldos conhecidos próprios; material documentado, Serviço/pacote, zero comprovado, valor pendente e preparo dividido sem duplicação; dieta, vigência e fechamento classificados |
| Configuração / relatórios | Protocolos publicados/rascunhos, referência copiada, exame personalizado, elegibilidade, DG/reconfirmação, filtros V2, impressões e emissões PARTOS/INDICADORES |

São 185 animais-base e cinco crias vivas, criados aditivamente. O guia **`server/.seedatev3/v4/guia.html`** contém o mapa dos brincos e links reais das fichas/visitas. Os cenários descrevem a preparação inicial; o usuário pode evoluí-los normalmente. Consultar a data-base do guia ao filtrar relatórios.

O manifesto próprio `server/.seedatev3/v4/manifesto.json` congela a primeira data-base no Brasil e conserva IDs/ações/etapas. Reexecutar retoma sem restaurar resultados modificados pela interface. Manifesto ausente/corrompido, identidade incompatível, registro removido ou registros V4 sem manifesto impedem recriação silenciosa. `--verificar` usa conexões somente leitura; não escreve manifesto/guia nem aprova roteiros. `--interromper-apos=<etapa>` permite conferir a retomada sem desfazer dados.

Históricos de material usam origem documentada, sem fabricar baixas retroativas; atendimentos atuais têm estoque próprio disponível. R2/anexos permanecem pendentes. Snapshots/impressões locais não comprovam arquivos R2; a massa não substitui homologação pela fazenda.

### Manutenção local dos dois sítios

`server/scripts/consolidar-sitios-local.mjs` aceita somente o PostgreSQL de loopback `fazendinha_seedatev3` e os manifestos da mesma instância. Sem argumentos calcula a prévia; `--ensaiar` executa a transação e faz rollback conferido no próprio banco; `--aplicar` consolida; `--verificar` consulta o estado consolidado. Execute a partir de `server/`, com `node --env-file=.env scripts/consolidar-sitios-local.mjs --verificar`.

A manutenção identifica QA por sítio/marcador, descendentes de FK e referências de UUID. Recusa cruzar dados protegidos, remove o fechamento QA antes da localização e trata exclusivamente o vínculo circular exame/demanda QA. Mantém todas as FKs e validações de consistência; somente guardas de imutabilidade necessárias à manutenção administrativa são suspensas dentro da transação e restauradas antes do commit. Uma comparação de hashes de todos os registros sobreviventes exige igualdade integral, descontando apenas os IDs de sítio remapeados, inclusive em JSON/snapshots. Não cria banco, clone, cópia de ensaio ou backup, nem reexecuta cargas.

O evento `ConsolidacaoSitiosLocal` registra mapa, contagens e prova de preservação, sem cópia dos dados. A trava compartilhada com os seeds cobre a atualização atômica de cada manifesto após o commit; se houver interrupção nessa janela, repetir `--aplicar` reconhece o evento e conclui somente os arquivos. O marcador `server/.seedatev3/consolidacao-sitios.json` bloqueia preparações antigas de QA/planner. Os registros locais de execução QA são marcados como retirados; resultados e aceites manuais históricos continuam preservados.

As chaves e os hashes das requisições V3 já concluídas permanecem reservados e imutáveis. Como o escopo administrativo mudou, reenviar um pedido antigo ou reaproveitar sua chave no novo sítio resulta em conflito, impedindo duplicação; não há replay transparente dos sítios removidos. Recarregue a aplicação e use uma nova chave para uma nova operação. O manifesto mantém as ações concluídas, portanto retomar o seed não repete esses fatos. Arquivos/R2 continuam pendentes.

## Complemento do planner e manejo V4

`server/prisma/seedatev3-planner.ts` acrescenta dados ao **mesmo `fazendinha_seedatev3` já preparado**. Não execute novamente o seed principal para preparar este complemento. Todas as migrations devem estar aplicadas. A carga usa serviços de domínio e a mesma trava do seed principal; preserva o manifesto base, os animais existentes, as configurações da fazenda e os saldos dos produtos anteriores. Não necessita publicar arquivos no R2.

```bash
pnpm --filter rionovo-server run seedatev3:planner
pnpm --filter rionovo-server run seedatev3:planner --verificar
pnpm --filter rionovo-server run seedatev3:typecheck
```

O complemento mantém sua própria data-base e progresso em `server/.seedatev3/planner/manifesto.json`, também fora do Git. A data é o dia da primeira execução no Brasil e fica fixa nas retomadas. Consulte essa data no planner; pendências naturalmente ficam atrasadas com o passar dos dias. Não descarte nenhum dos dois manifestos. Registros `PLANNER` sem manifesto impedem uma nova carga; manifesto corrompido ou de outra instância também é recusado.

| Cenário preparado | Onde experimentar |
|---|---|
| 200 animais `PLN-001` a `PLN-200`, em lotes `PLANNER` | Principal concentra reprodução, maternidade e novilhas; Destino possui oito machos em protocolo sanitário |
| 120 matrizes com IA histórica e diagnóstico previsto para a data-base | Grupo grande para paginação, seleção parcial e confirmação em blocos; dez animais também constam na ficha preparada |
| IATF coletiva com aplicação no dia, retirada e IA futuras | Turma de 20 animais; etapas planejadas com produtos próprios do cenário |
| Cinco animais com início conhecido apenas pelo dia e etapas em horas | Pendência explícita de previsão; nenhum horário é inventado |
| Cinco turmas reprodutivas com um animal e cinco participações sanitárias sem rodada | Comparação de manejo individual com grupos coletivos |
| Novilhas com inseminação no dia, retirada no dia e início futuro ainda não realizado | Aplicações e retiradas anteriores efetivamente registradas; nenhuma execução futura |
| Histórico reprodutivo de dez animais e sanitário de seis | Todas as etapas realizadas deixam de ser pendências do planner; não se falsifica encerramento administrativo da programação |
| Protocolos sanitários com aplicação no dia, exame no dia, atrasados, futuros e outro sítio | Animais também presentes em reprodução permitem distinguir animais únicos de procedimentos |
| Dez partos, nove crias vivas e respectivos fornecimentos de colostro | Inclui gemelar, natimorto, aborto, dificuldade, peso/escore da matriz e duas ocorrências de retenção de placenta |
| IA, TE, gestação, reconfirmação e sexagem | Vínculos históricos e filiação, inclusive doadora externa distinta da receptora no nascimento por TE |
| Lactações históricas, secagem, DEL e ausência de histórico | Seleções habituais por DEL, pós-parto, secas, RP e descarte; ausência de DEL também pode decorrer de secagem |

Há duas visitas novas no Principal: **`PLANNER · Planejar atendimento`**, vazia para testar a montagem, e **`PLANNER · Ficha de campo preparada`**, do dia anterior, com dez animais selecionados e uma impressão persistida. A saída do comando informa o endereço da primeira visita. A inclusão no planejamento e a impressão não realizam os diagnósticos. Visitas anteriores do usuário não são alteradas.

Os três produtos novos têm estoque demonstrativo próprio nos dois sítios, via ajustes de inventário auditados; aplicações realizadas e uma IA com estoque produzem baixas reais desses insumos. IA/TE históricas documentadas conservam justificativa e não fabricam consumo retroativo. Nenhum período fechado é contornado. Produtos, doses, intervalos, carências, volumes de colostro e valores são **fictícios para teste de software**, não protocolos clínicos recomendados nem padrões globais do app.

Reexecutar conclui somente etapas ainda não preparadas, sem restaurar resultados que alguém tenha alterado na interface. `--verificar` usa conexões somente leitura, confere referências e filiação e informa totais do complemento e grupos atuais. Essa conferência não substitui a homologação manual do planner, da impressão ou do atendimento; não altera marcações de roteiros.

## Complemento de homologação V4 e Playwright

O [roteiro V4](pecuaria/artefatos/testes-v4-guia.html#preparacao-qa) relaciona cada caso à preparação e separa automação, apoio técnico e aceite humano. O [caderno de estudo](pecuaria/artefatos/caderno-estudo-v4.html) explica a entrega; sua consolidação final contém propostas para PRs de follow-up, não critérios já implementados no PR #319.

Depois do complemento do planner, preparar **uma única vez no mesmo banco**:

```bash
pnpm --filter rionovo-server run seedatev3:qa
pnpm --filter rionovo-server run seedatev3:qa --verificar
pnpm --filter rionovo-server run seedatev3:typecheck
```

`server/prisma/seedatev3-qa.ts` reutiliza a validação de destino local, migrations, identidade e trava do seed. Seu manifesto é `server/.seedatev3/qa-v4/manifesto.json`. Recusa registros QA sem manifesto; nunca reinicia a carga nem restaura fatos alterados na homologação. Não precisa de arquivos no R2. Os manifestos base/planner são lidos e conferidos, sem gravação. Saldos existentes não são usados na preparação: produtos QA têm saldo e custo explícitos próprios.

São três sítios **QA V4 · Homologação A/B/C** e animais identificados por `QA4-`: 48 casos individuais; lote de 209 fêmeas e quatro machos (101–313); três animais para importação sintética (801–803); quatro crias vivas com identificação provisória. Há grupo de 120 diagnósticos pendentes, sanidade sobreposta, participações IATF ausentes/únicas/ambíguas/retiradas, dia sem horário, formato de exame publicado/mutável, três estados de política, parto e pós-parto, estoque válido/vencido/sem validade/sem saldo e Serviço para atribuição. O roteiro informa as pré-condições específicas e os ramos a construir pela interface.

A referência **D** é a `dataBase` do manifesto QA, congelada na primeira execução. No sítio A há política desde D−600; B tem apenas uma vigência posterior a D; C não tem configuração. Não avançar datas da carga para esconder pendências. O período fechado é uma fixture auditada somente no sítio A, no mês anterior a D. Não fechar nem reabrir períodos de Principal/Destino para testar.

| Perfil adicional | E-mail | Permissões |
|---|---|---|
| Consulta QA | `qa.v4.consulta@example.test` | Pecuária, leitura/exportação; sem área Financeiro |
| Operador QA | `qa.v4.operador@example.test` | Pecuária, lançamento, sem valores |
| Financeiro QA | `qa.v4.financeiro@example.test` | Financeiro, sem acesso à Pecuária |

Senha inicial fictícia igual à base: `SeedateV3!Local2026`; dono continua sendo o acesso base. Não há lista de sítios permitidos no cadastro de usuário atual. Testar escopo do sítio nos fatos/requisições e proteção de valores não comprova ACL por usuário e sítio.

As visitas QA incluem uma ficha preparada, uma encerrada e uma de **Compatibilidade anterior**. Esta última reproduz atividade anterior sem protocolo, rascunho com participação retirada e impressão com contexto incompleto. Apenas essas fixtures recebem preparação administrativa auditada; o seed não reescreve impressões reais. Os demais fatos são criados pelos serviços do domínio. Retirada, falha de rede, concorrência, correção e reenvio nos casos do roteiro devem ser exercitados no momento da execução, não aprovados pela existência da massa.

Para V4-51, o complemento gera `carga-sintetica.json` e `mapa-sintetico.json` em sua pasta ignorada. São dados inventados, com identidade `QA_V4_SINTETICO`, sem consumo de estoque. O seed **não importa** esse arquivo. Primeiro executar a prévia, preservando os relatórios:

```bash
pnpm --filter rionovo-server run import:pecuaria:v4 --arquivo=.seedatev3/qa-v4/carga-sintetica.json --mapeamento=.seedatev3/qa-v4/mapa-sintetico.json --relatorio=.seedatev3/qa-v4/previa-sintetica.json
```

Aplicação/reenvio pertencem ao caso técnico, somente sobre essas fixtures e no banco autorizado. A importação real do IDEAGRI não faz parte da homologação.

Use o MCP Playwright configurado no Codex, com o app iniciado em `http://localhost:41875`. Cada execução deve registrar commit, data-base, perfis, IDs e evidências por caso em `output/qa-v4/<execução>/`, fora do Git. Sessões independentes para concorrência/permissões; nunca publicar cookies ou tokens. Não trocar o roteiro por chamadas diretas à API sem declarar que se trata de apoio técnico. Preservar marcações/exportações anteriores e não aprovar o aceite humano V4-52 automaticamente.

`--verificar` dos complementos confere seus registros, sem restaurar estado. O verificador principal V3 conserva contagens globais do cenário original e não é um oráculo para o banco ampliado; não remover dados para satisfazer essas contagens. A homologação é feita com os verificadores dos complementos e com os casos do roteiro.

## Guia manual V3

O [guia](pecuaria/artefatos/testes-v3-guia.html) conserva os casos, marcações e notas anteriores. A preparação histórica dependia de outro banco e está desativada no desenvolvimento local: **o único banco permitido é `fazendinha_seedatev3`**. Não crie `fazendinha_v3_teste` nem use a preparação antiga para limpar ou substituir o cenário atual.

`server/scripts/preparar-guia-v3.ts` permite somente consulta no banco de desenvolvimento. As opções históricas de preparação, limpeza e verificação de saldos iniciais são recusadas. Use os dados existentes para a homologação; casos dependentes da massa antiga devem registrar a necessidade de adaptação, sem reset de dados ou de marcações do HTML. A verificação do seed atual continua disponível por `seedatev3 --verificar`.

## Carga inicial IDEAGRI

Os utilitários mantidos formam a cadeia existente de Rebanho/Genética:

1. `scripts/extract-pecuaria.sh` / `scripts/pecuaria-dump.sql`: extração da fonte; confira os caminhos locais antes de executar.
2. `scripts/build-pecuaria-json.mjs`: transformação para o JSON de carga; comportamento coberto por `build-pecuaria-json.test.mjs`.
3. `seed:pecuaria`: catálogos de raças/motivos, distinto do seed demonstrativo completo.
4. `import:pecuaria`: importa `server/prisma/pecuaria_v1.json`, gerado e ignorado pelo Git.
5. `validar:pecuaria`: conciliação da carga.

A importação não sincroniza alterações do IDEAGRI: animal já importado é ignorado; a passada de genética preenche lados vazios sem sobrescrever filiação editada. O importador trata animais em transações individuais e relata falhas; execução parcial não significa carga integral concluída. A carga histórica de Sanidade/Nutrição V3 ainda não está entregue.

### Ensaio opcional de volume nutricional

`server/src/services/pecuaria/nutricao/volume.integration.test.ts` é um ensaio sintético de leitura com milhares de lotes, receitas, vigências e fechamentos. Exige `PECUARIA_DB_INTEGRATION=1` e `NUTRICAO_VOLUME_INTEGRATION=1`; antes de escrever, valida que `DATABASE_URL` aponta para localhost e banco `qa_volume_` com sufixo hexadecimal. Prepare um banco novo com migrations completas e descarte somente esse banco ao terminar, inclusive em falha. Nunca aponte o ensaio para seed, banco operacional ou banco de outra tarefa.

O teste registra tempo de serviço, bytes JSON e quantidade de statements SQL reais do Prisma, incluindo transação e relações. Confere escopo por sítio, custos desconhecidos/zero/mascarados, exclusão de estornos e páginas profundas. Não mede HTTP, Workers/Neon, concorrência ou rede, nem define SLA. A flag adicional evita executar o cenário de volume em toda suíte de integração comum.

## Carga financeira Rio Novo

`server/prisma/seed-rio-novo.ts` importa os fatos liquidados da aba `RN_SICOOB PJ` do relatório Rio Novo. A carga lê somente a tabela detalhada: não interpreta abas de projeção ou consolidações como novos fatos. Ela cria o sítio `Rio Novo`, a conta `BB MAGC`, os centros, categorias e parceiros necessários, preservando data, sentido, valor, categoria, centro de custo, parceiro e referência documental disponível.

Use primeiro a conferência sem escrita e depois a importação em um banco local de desenvolvimento com migrations aplicadas e um dono ativo:

```bash
pnpm --filter rionovo-server run seed:rio-novo -- "/mnt/c/caminho/Relatório Rio Novo 2026.05.04.xlsx" --verificar
pnpm --filter rionovo-server run seed:rio-novo -- "/mnt/c/caminho/Relatório Rio Novo 2026.05.04.xlsx"
```

O seed só aceita PostgreSQL local, usa uma chave determinística por linha do relatório e pode ser reexecutado sem duplicar operações. Transferências, saldo inicial, ajustes, estornos, aplicações e valores ainda a identificar são importados como aporte/retirada, pois a planilha não informa uma contraparte interna suficiente para criar transferência entre contas. Os demais créditos viram vendas sem estoque e os débitos viram serviços sem estoque; não se inferem quantidades, produtos, lotes ou compromissos a partir do extrato.

Seeds de demonstração por módulo/PR e a massa do Excel anterior foram retirados. Fixtures dos testes, catálogos das migrations e importador atual continuam disponíveis.

## Carga técnica V4 e testes de reprodução

A V4 tem ferramentas separadas do seed V3. Não rode `seed`, `db push` ou uma carga histórica para testar uma mudança comum. **Toda validação local usa somente `fazendinha_seedatev3`**, sem criar banco descartável, clone ou cópia para ensaio. `DATABASE_URL` e `DIRECT_URL` no `server/.env` devem apontar para esse mesmo banco; o Prisma usa a conexão direta nas migrations.

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
