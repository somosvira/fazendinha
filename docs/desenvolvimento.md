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

O perfil de operador não deve ser tratado como protegido para valores financeiros: há mascaramento incompleto na API, descrito no [contrato financeiro](financeiro-rebuild-contrato.md#permissões-e-documentos). O seed configura permissões, mas não corrige essa limitação.

## Retomada e verificação

A data-base é calculada uma vez em `America/Sao_Paulo` e conservada com identidade do banco, versão, IDs, ações e etapas em `server/.seedatev3/manifesto.json`, ignorado pelo Git. Consulte `dataBase` no manifesto do ambiente; não assuma uma data fixa de uma sessão anterior. Datas que envelhecem são evolução natural, não motivo para repopular.

Reexecuções mantêm a data e não repetem etapas concluídas. Registro removido manualmente não é recriado automaticamente. Preserve manifesto junto do banco/backup; restauração exige conferir identidade. `migrate reset`, exclusão de volume ou descarte do manifesto invalidam a continuidade.

`--verificar` usa conexões somente leitura e confere relações, saldos, estoque por sítio/validade, carências, animal-dias, custos e arquivos. Para testar retomada no cenário apropriado, `--interromper-apos=catalogos` interrompe controladamente; rodar sem a opção continua. Etapas estão declaradas no entrypoint. O período fechado demonstrativo é uma fixture administrativa auditada, pois não há comando público de fechamento; não invente esse fluxo de interface.

A verificação do seed pode ler arquivos reais do R2. Não rode o seed nem sua preparação para validar apenas documentação/código sem alteração de dados. As configurações inertes dos testes unitários não servem para executar o cenário.

Backups e evidências locais ficam em `.backups/` e `server/.seedatev3/`, fora do Git. A manutenção do repositório não autoriza removê-los. Recuperação de bancos e volumes depende de seus backups, não de planos antigos ou de um novo seed.

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
