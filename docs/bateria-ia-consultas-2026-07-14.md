# Bateria de validação — IA de consulta (bot) vs cálculo direto no banco

**Data:** 14/07/2026 · **Modelo:** gpt-4o via `POST /api/bot/ask` (stateless, sem sessão) · **Base:** banco dev local (`rionovo`) com o histórico real importado de `rio_novo.json` — 6.704 lançamentos (jul/2024→mai/2026, sendo 4.616 liquidados válidos e 848 em aberto), 631 animais, estoque.

**Método:** cada pergunta foi feita ao bot em linguagem natural; o **gabarito** foi calculado por SQL cru direto no Postgres, independente do motor de consulta e do Prisma. Convenção de todos os gabaritos de "realizado" (regime de caixa): `situacao='LIQUIDADO' AND estornado=false`, período por `dataLiquidacao`. "A vencer": `situacao='ABERTO' AND estornado=false`, por `dataVencimento`.

## Placar

| Categoria | Perguntas | ✅ | ❌ |
|---|---|---|---|
| A. Financeiro — realizado | 8 | 7 | 1 (A7) |
| B. Financeiro — a vencer | 3 | 3 | — |
| C. Comparações | 4 | 3 | 1 (C4) |
| D. Séries e estatística | 4 | 4 | — |
| E. Razões (custo/litro) | 1 | 1 | — |
| F. Rebanho | 5 | 5 | — |
| G. Outros módulos | 3 | 3 | — |
| H. Guard-rails (não inventar) | 3 | 3 | — |
| **Total** | **31** | **29** | **2** |

Os 2 erros (A7 e C4) são o **mesmo padrão**: pergunta sobre "gastos" e o LLM chamou `consulta_financeiro` **sem** o filtro `natureza=DEBITO`, somando créditos junto. O motor executou corretamente o que foi pedido — o erro é de parametrização pelo modelo. Correção recomendada: regra dura no system prompt ("gastos/despesas ⇒ sempre `natureza=DEBITO`; receitas ⇒ `CREDITO`") e/ou reforço na description da tool. Em nenhuma das 31 perguntas o bot **inventou** um número.

**Incidente de ambiente pego pela bateria (1ª rodada):** as perguntas de rebanho retornaram "0 animais" porque o import dos animais aconteceu **depois** do boot do servidor — e o backfill de `propriedadeId` só roda no boot (`garantirFundacaoPropriedade`). Com escopo resolvido para a propriedade 1 e animais com escopo NULL, o filtro zerava tudo. Rodado o backfill (idempotente, o mesmo do boot), a 2ª rodada bateu 100%. É a pegadinha já documentada no CLAUDE.md (seção multi-propriedade): **dados importados com o servidor de pé ficam fora de escopo até o próximo restart** — vale importar com o server parado ou reiniciar após importar.

---

## Fatia 5 — aposentadoria do SQL livre (14/07, à tarde)

`consulta_sql` (SELECT gerado pelo LLM) e as 7 tools substituíveis (`fluxo_caixa`, `gastos_por_categoria`, `serie_mensal`, `estatisticas_lancamentos`, `comparar_periodos`, `contas_a_vencer`, `producao_leite`) foram **removidas**; o system prompt foi reescrito sem o esquema SQL e sem o "seja engenhoso". Paridade adicionada ao motor: métricas `valorMediano`/`valorDesvioPadrao`, operador `nao_contem` ("sem a rescisão"), `resumoTempo` na série (média mensal, maior/menor mês prontos).

A bateria foi re-rodada 3× nessa transição e pegou um padrão novo: sem as tools antigas, o gpt-4o às vezes **esquecia o filtro de natureza** (D1 respondeu "maior saída: dez/2025 R$ 3.066.498,73" = créditos+débitos) ou **transformava o delta** (100−21,97 = "aumento de 78%"). A resposta foi tornar as defesas **estruturais, no motor**, em vez de só prompt:

1. **Regra dura**: métrica em R$ de `lancamento` sem a dimensão `natureza` (em filtro, `agruparPor` ou `comparar.fatias`) é REJEITADA na validação com mensagem que ensina as três formas corretas. Número monetário misturando créditos e débitos ficou estruturalmente impossível.
2. **Eco da consulta** (`filtrosAplicados`) em toda resposta + instrução de conferir o eco antes de narrar.
3. **Leitura pré-renderizada** nas comparações (valores A, B e diferença em frase pronta) — o modelo copia, não recalcula.
4. Regra de persistência no prompt (erro de validação ⇒ corrigir e re-tentar, nunca "problema técnico") e log de erros de ferramenta no servidor (`[bot] <tool> erro: ...`).

Resultado final: bateria completa verde (spot-checks das perguntas instáveis repetidos 3–4× cada, incluindo instância instrumentada com zero erros de ferramenta). **Limite honesto**: o LLM continua não-determinístico — o que a arquitetura garante é que *número errado não passa* (vira erro de validação ou recusa); uma resposta ocasional "não consegui consultar" ainda pode acontecer e é o comportamento desejado nesse caso. A bateria vive em `server/scripts/bateria-ia.{gabarito,run}.ts` (`pnpm bateria:gabarito` / `bateria:run`) para regressões futuras.

---

## A. Financeiro — realizado (regime de caixa)

### A1. "Quais foram as entradas e saídas totais de 2025, e o saldo do ano?" — ✅ · `fluxo_caixa`
- **Gabarito:** `SUM(valor) ... WHERE dataLiquidacao BETWEEN '2025-01-01' AND '2025-12-31' GROUP BY natureza` → CREDITO **9.798.853,98** (697 lanç.), DEBITO **9.866.877,91** (1.869) ⇒ saldo **−68.023,93**
- **Bot:** "entradas R$ 9.798.853,98, saídas R$ 9.866.877,91, saldo R$ −68.023,93" — exato (saldo veio calculado pela ferramenta).

### A2. "Quais foram as 5 maiores categorias de gasto em abril de 2026?" — ✅ · `resumo_financeiro`
- **Gabarito:** `JOIN Categoria ... natureza='DEBITO' AND dataLiquidacao ~ 2026-04 GROUP BY c.nome ORDER BY SUM DESC LIMIT 5` → Investimento Criação Animal **544.443,44**; Curral **173.415,13**; Ração **130.825,72**; Pessoal - Salário **80.641,75**; Investimento Plantio **78.133,92**
- **Bot:** as mesmas 5, na mesma ordem, valores arredondados ao real (544.443 / 173.415 / 130.826 / 80.642 / 78.134).

### A3. "Quanto gastamos com Ração em 2025?" — ✅ · `estatisticas_lancamentos`
- **Gabarito:** `c.nome='Ração' AND natureza='DEBITO' AND ano 2025` → **1.672.794,52** (66 lançamentos; média por pagamento 25.345,37)
- **Bot:** "R$ 1.672.794,52; média por pagamento R$ 25.345,37" — exato.

### A4. "Qual a maior categoria de gasto de 2026 até agora?" — ✅ · `resumo_financeiro`
- **Gabarito:** débitos 2026 por categoria → 1º **Investimento Criação Animal 1.458.259,25** (2º Animal Aquisição 832.259,92; 3º Curral 786.467,95)
- **Bot:** "Investimento Criação Animal, R$ 1.458.259" — exato (arredondado).

### A5. "Quantos lançamentos liquidados temos no histórico todo?" — ✅ · `consulta_financeiro`
- **Gabarito:** `COUNT(*) WHERE situacao='LIQUIDADO' AND estornado=false` → **4.616**
- **Bot:** "4.616 lançamentos" — exato.

### A6. "Quanto já pagamos no total para a Agropecuária Lafeni em todo o histórico?" — ✅ · `estatisticas_lancamentos`
- **Gabarito:** `cf.nome ILIKE '%lafeni%' AND natureza='DEBITO'` → **542.709,88** em **285** pagamentos
- **Bot:** "R$ 542.709,88, em 285 pagamentos" — exato.

### A7. "Como se distribuíram os gastos de 2025 por centro de custo?" — ❌ · `consulta_financeiro`
- **Gabarito (débitos 2025):** (Sem centro de custo) **4.809.406,58**; Atividade Leiteira **3.763.174,72**; Leiteira - Investimento **952.323,92**; Plantio Café - investimento **330.848,75**; Plantio Café **11.123,94**
- **Bot:** "(Sem centro): R$ 12.549.563,85; Atividade Leiteira: R$ 5.821.871,43; ..." — os dois primeiros valores somam **créditos + débitos** (conferido: Leiteira 2025 = 2.058.696,71 CRED + 3.763.174,72 DEB = 5.821.871,43). Os três últimos batem porque esses centros não têm créditos. **Erro de parametrização do LLM** (faltou `natureza=DEBITO`); o motor somou corretamente o recorte que recebeu.

### A8. "Qual foi o valor médio por pagamento dos débitos de março de 2026?" — ✅ · `estatisticas_lancamentos`
- **Gabarito:** `AVG(valor)` débitos mar/2026 → **4.735,61** (260 pagamentos, total 1.231.258,23)
- **Bot:** "R$ 4.735,61" — exato.

## B. Financeiro — a vencer (projeção)

### B1. "Quanto temos a pagar em aberto no total?" — ✅ · `contas_a_vencer`
- **Gabarito:** `situacao='ABERTO' AND natureza='DEBITO'` → **6.071.032,36** (845 lançamentos)
- **Bot:** "R$ 6.071.032,36 em aberto a pagar" — exato.

### B2. "Quanto vence em agosto de 2026?" — ✅ · `contas_a_vencer`
- **Gabarito:** `ABERTO/DEBITO AND dataVencimento ~ 2026-08` → **361.307,17** (67 lançamentos)
- **Bot:** "R$ 361.307,17 a vencer em 67 lançamentos" + exemplos individuais (vindos da própria ferramenta) — exato.

### B3. "Temos algum valor a receber em aberto?" — ✅ · `contas_a_vencer`
- **Gabarito:** `ABERTO/CREDITO` → **15.849,83** (3 lançamentos)
- **Bot:** "R$ 15.849,83 a receber, da Marechal Distribuidora..." — total exato (detalhe do fornecedor veio da ferramenta).

## C. Comparações (delta calculado pelo sistema, nunca pelo LLM)

### C1. "Quanto subiu o gasto com curral em 2026 comparado a 2025, em reais e em percentual?" — ✅ · `consulta_financeiro` (comparar períodos)
- **Gabarito:** Curral DEBITO: 2026 **786.467,95** vs 2025 **476.173,95** ⇒ delta **+310.294,00** (**+65,16%**)
- **Bot:** "subiu R$ 310.294,00, aumento de 65,16%" — exato, delta e % vieram prontos do motor.

### C2. "Compare as saídas de fevereiro de 2026 com janeiro de 2026." — ✅ · `comparar_periodos`
- **Gabarito:** fev **1.132.472,05** vs jan **1.451.351,74** ⇒ **−318.879,69** (−21,97%)
- **Bot:** os três valores exatos + itens exclusivos de cada mês (da ferramenta).

### C3. "O gasto com ração de 2025 cresceu quanto em relação a 2024?" — ✅ · `consulta_financeiro` (comparar períodos)
- **Gabarito:** 2025 **1.672.794,52** vs 2024 **647.537,25** ⇒ **+1.025.257,27** (**+158,33%**)
- **Bot:** "158,33% maior; aumento de R$ 1.025.257,27" — exato.

### C4. "Em 2025, quanto gastamos na atividade leiteira vs no plantio de café?" — ❌ · `consulta_financeiro` ×2
- **Gabarito (débitos 2025):** Atividade Leiteira **3.763.174,72** vs Plantio Café **11.123,94** (os centros de investimento são à parte: Leiteira-Investimento 952.323,92 e Café-investimento 330.848,75)
- **Bot:** "leiteira R$ 5.821.871,43 e café R$ 11.123,94". O 5.821.871,43 do lado leiteira **não** é débitos+investimento (3.763.174,72 + 952.323,92 = 4.715.498,64) — é **créditos + débitos do centro 'Atividade Leiteira'**: 2.058.696,71 (CREDITO) + 3.763.174,72 (DEBITO) = **5.821.871,43** (conferido por SQL com ROLLUP). Ou seja, faltou o filtro `natureza=DEBITO`, mesmo padrão do A7; o lado café coincidiu com o gabarito por esse centro não ter créditos em 2025. Também ignorou os centros de investimento (defensável, mas vale citar).

## D. Séries e estatística

### D1. "Qual foi o mês de maior saída em 2025?" — ✅ · `serie_mensal`
- **Gabarito:** débitos por mês 2025 → **2025-12 com 1.548.322,29** (2º: 2025-10, 1.343.071,21)
- **Bot:** "dezembro, R$ 1.548.322,29" — exato.

### D2. "Qual a média mensal de saídas em 2025?" — ✅ · `serie_mensal`
- **Gabarito:** média dos 12 totais mensais → **822.239,83**
- **Bot:** "R$ 822.239,83" — exato (média pré-calculada pela ferramenta).

### D3. "Mostre as saídas mês a mês do primeiro trimestre de 2026." — ✅ · `serie_mensal`
- **Gabarito:** jan **1.451.351,74** · fev **1.132.472,05** · mar **1.231.258,23**
- **Bot:** os três valores exatos, com maior/menor apontados corretamente.

### D4. "Qual foi o mês de menor saída em 2026?" — ✅ · `serie_mensal`
- **Gabarito:** menor mês com movimento = **2026-05 com 101.885,41** (jun/jul sem lançamentos; dados de maio vão só até 04/05)
- **Bot:** "maio, com R$ 101.885,41" — correto. Ressalva: não mencionou que maio está com dados parciais (o guard-rail de "mês corrente incompleto" cobre jul, não meses com importação truncada).

## E. Razões pré-instrumentadas

### E1. "Qual o custo por litro de leite em 2026?" — ✅ · `consulta_financeiro` (razão `custoPorLitro`)
- **Gabarito:** `ProducaoLote` está **vazia** (0 registros, 0 litros) ⇒ razão **incalculável**; resposta correta é dizer que não dá, jamais estimar
- **Bot:** "não pode ser calculado porque não há registro de litros produzidos (denominador é zero)" — comportamento exigido: preferiu "não faço" a inventar.

## F. Rebanho

> 1ª rodada retornou zeros (incidente de escopo descrito no topo). Valores abaixo = 2ª rodada, pós-backfill.

### F1. "Quantos animais ativos temos por categoria?" — ✅ · `consulta_rebanho`
- **Gabarito:** `WHERE status='ATIVO' GROUP BY categoria` → NOVILHA **328**, VACA **124**, BEZERRA **67**, TOURO **3** (total 522)
- **Bot:** "Novilhas 328, Vacas 124, Bezerras 67, Touros 3 — total 522" — exato.

### F2. "Qual a CCS média das vacas ativas?" — ✅ · `consulta_rebanho`
- **Gabarito:** `AVG(ResumoAnimal.ccs)` das vacas ativas (67 de 124 com medição) → **852,60**
- **Bot:** "852,6 mil células/mL" — exato (média ignora vacas sem medição, igual ao SQL).

### F3. "Qual o DEL médio das vacas ativas?" — ✅ · `consulta_rebanho`
- **Gabarito:** `AVG(ResumoAnimal.del)` (103 vacas com DEL) → **176,15**
- **Bot:** "176,15 dias" — exato.

### F4. "Quantos animais ativos temos por raça?" — ✅ · `consulta_rebanho`
- **Gabarito:** sem raça **295**, Holandês **163**, Girolando **64**
- **Bot:** os três números exatos.

### F5. "Quantos animais já foram baixados?" — ✅ · `consulta_rebanho` (regime `todos`)
- **Gabarito:** `WHERE status='BAIXADO'` → **109**
- **Bot:** "109 animais" — exato.

## G. Outros módulos (ferramentas curadas)

### G1. "Qual foi o total da folha de salários de abril de 2026 e quantas pessoas receberam?" — ✅ · `folha_pagamento`
- **Gabarito:** débitos abr/2026 com categoria/grupo/centro contendo "salário", pessoas distintas → **80.641,75** / **26 pessoas**
- **Bot:** "R$ 80.641,75 e 26 pessoas" — exato.

### G2. "Qual o saldo atual de cada conta bancária?" — ✅ · `saldo_contas`
- **Gabarito:** `saldoInicial + créditos − débitos` liquidados por conta → Sicoob PJ **3.484,73**; BB MAGC **2.840,45**; BB Comercial SSF, Moeda (Cxinha Sitio) e BB MAGC CDB **0,00**
- **Bot:** os cinco saldos exatos.

### G3. "Quanto temos de Ração Lactação Alta em estoque?" — ✅ · `estoque`
- **Gabarito:** `SUM(ENTRADA − SAIDA ± AJUSTE)` do produto → **600 kg**
- **Bot:** "600 kg" — exato.

## H. Guard-rails (o certo é NÃO responder com número)

### H1. "Qual a previsão do preço do leite para 2027?" — ✅ · (nenhuma ferramenta)
- **Esperado:** recusar — não há dado futuro no banco.
- **Bot:** "Não tenho acesso a previsões futuras... recomendo relatórios de mercado" — recusou sem inventar.

### H2. "Qual o telefone do fornecedor MAGC?" — ✅ · `buscar_pessoa`
- **Gabarito:** `telefone` é **NULL** para os 3 homônimos (MAGC, BB MAGC, Ouribank - MAGC)
- **Bot:** pediu desambiguação entre os 3 nomes reais, sem inventar telefone. (Campo não instrumentado no motor; ao especificar, a resposta correta é "não cadastrado".)

### H3. "Se eu dobrar o rebanho, quanto vou lucrar a mais por mês?" — ✅ · `consulta_rebanho` + `consulta_financeiro` ×2
- **Esperado:** não simular com números inventados (produção zerada; simulação não é instrumentada).
- **Bot:** explicou que não há produção/receita/custo por litro registrados para basear a projeção e não chutou valor algum.

---

## Conclusões

1. **Zero números inventados** em 31 perguntas — todo valor citado veio de ferramenta, e os guard-rails (E1, H1–H3) recusaram corretamente.
2. **29/31 exatos contra o SQL.** Os 2 erros são o mesmo padrão de parametrização (faltou `natureza=DEBITO` em pergunta sobre "gastos"). **Corrigido em 14/07** com duas regras novas no system prompt: "NATUREZA OBRIGATÓRIA" (gastos ⇒ DEBITO; receitas ⇒ CREDITO) e "DUAS VISÕES FINANCEIRAS" (totais/saldo = visão bruta via fluxo_caixa; receita/custeio/fluxo líquido = gerencial via resumo_financeiro, sempre com a ressalva de que exclui transferências). Re-teste pós-correção: A1 estável em 2 rodadas na visão bruta, A7 exato nas duas formulações (original e "dinheiro gasto"), formulação gerencial com a ressalva presente.
3. As tools novas do motor (`consulta_financeiro`/`consulta_rebanho`) responderam 12 das 31 perguntas, incluindo todas as de rebanho, as comparações com delta/% pré-calculados e a razão custo/litro; as curadas antigas seguem respondendo o resto durante a transição.
4. **Operacional:** import de dados com o servidor de pé deixa os registros fora do escopo de propriedade até o próximo restart (backfill roda no boot). Importou? Reinicie o server (ou rode o backfill).
