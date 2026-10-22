# Volume nutricional local

Executado em PostgreSQL local, banco novo `qa_volume_91c69f0b6144aace`, criado e removido pelo harness em `finally`. Migrations completas; nenhuma carga operacional, seed ou banco de QA de outra tarefa foi alterado. Primeira tentativa foi descartada por fixture incompleta (faltava participação compatível com animal-dias); o segundo banco e a fixture corrigida passaram.

Fixture: 2 sítios, 1.201 lotes, 1.200 animais/localizações, 1.200 receitas/ingredientes, 2.200 vigências, 2.201 fechamentos (um estornado), 2.200 itens e 2.201 participações. As constraints/migrations permanecem habilitadas. Os dados são sintéticos de leitura, não homologação de cadastro operacional por interface.

| Consulta de serviço | Tempo observado ms | Statements SQL | Bytes JSON |
|---|---:|---:|---:|
| Receitas, sítio com 1.000 usos atuais | 124,68 | 7 | 754.981 |
| Receitas, global com 1.200 usos atuais | 71,86 | 7 | 777.181 |
| Resumo, sítio com 2.000 confirmados | 82,51 | 7 | 511.133 |
| Resumo sem valores | 67,49 | 7 | 511.128 |
| Fechamentos confirmados, página 80 × 25 | 40,08 | 15 | 39.373 |
| Fechamentos estornados | 20,35 | 15 | 1.007 |
| Vigências, página 40 × 25 | 25,03 | 11 | 10.974 |

Contagem real por eventos de query do Prisma, incluindo statements transacionais e carregamento de relações; “duas consultas” no desenho do catálogo significa duas operações lógicas Prisma, não dois statements SQL. Tempo de serviço inclui materialização, sem HTTP/rede/browser. Uma execução sequencial, sem benchmark estatístico: a segunda leitura pode aproveitar cache. Não estabelece SLA, p95 ou comparação de velocidade entre escopos.

Assertions aprovadas: catálogo não trunca receitas/usos; sítio não recebe uso externo; resumo inclui todos os 2.000 confirmados e exclui o estorno; custo desconhecido é null, quantidade zero conserva zero conhecido/cobertura parcial e lote vazio representa zero; sem verValores todos os campos de custo são null; fechamento externo não entra na página; total/itens por status e páginas profundas corretos; lote externo explícito gera não encontrado. As rotas/autorização por sessão não foram reexercitadas neste teste de serviço; permanecem na suíte/QA anteriores.

Auth DB executado depois da carga, sem concorrência: reset de uso único com revogação de sessões e token expirado sem alterar senha aprovados. A lacuna local de convite foi posteriormente fechada em novo banco descartável `qa_volume_9af9b34f9e34e2f1`, também removido no finally: suíte ampliada 5/5 passou, incluindo convite válido/ativação/login/permissões preservadas, substituição de link anterior, reuso recusado, convite expirado sem alterar usuário e disputa simultânea com exatamente um vencedor. Log `convite-auth-db-final.log`. Não depende de e-mail externo: o fluxo gera e consome o link real via serviço com PostgreSQL. Não equivale a medir entrega de e-mail ou homologar o browser.

Reproduzir no ambiente local dedicado disponível na porta54332: `node .impeccable/validar-volume.mjs`. O harness define as flags e URLs exclusivamente localhost, aplica migrations em novo nome aleatório e descarta somente esse nome. O teste de volume exige também `NUTRICAO_VOLUME_INTEGRATION=1` e valida prefixo `qa_volume_` antes de gravar; não é habilitado só pela flag comum de Pecuária.

Log completo: `volume-nutricao-final.log`. Teste: `server/src/services/pecuaria/nutricao/volume.integration.test.ts`.

Limites restantes: representatividade de dados e volume reais depende do usuário; latência Neon/Cloudflare/Workers, carga simultânea e rede dos dispositivos exigem ambiente autorizado e orçamento/critério de aceite. Não houve carga externa, ensaio de saturação ou escrita operacional. Catálogo/resumo crescem com o número de receitas/lotes atuais; resultado de ~755KB em mil receitas é uma observação útil, não evidência de tamanho constante nem de nota máxima automática.
