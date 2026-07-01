# Planos — Dashboard (Fôlego/Ruptura) + Análises da IA por mês fechado

> Rascunhos para confirmar antes de implementar. Gerado em 30/jun/2026.

## Decisões confirmadas (30/jun)
- **#2 queima**: média de **6 meses**, configurável via `DASHBOARD_MESES_QUEIMA` (default 6). ✅ servidor pronto e verificado.
- **#2 aporte**: ignorar a identificação de aporte por enquanto (a queima não precisa dela). Voltar depois.
- **IA mês aberto**: só números + selo "análise quando fechar" (sem prévia de IA).
- **IA LLM**: usar **OpenAI** (o app não deveria ter Claude — ver achado abaixo).

> ⚠️ **Achado — caixa subestimado**: a queima (924.420/mês) é real e exata, mas
> `caixa = 6.325` → fôlego ≈ 0. Isso ocorre porque o `saldoInicial` das contas é 0
> (saldos de abertura não importados). **Fôlego/Ruptura só ficam confiáveis quando
> os saldos de abertura entrarem.** A queima em si independe disso.

> ⚠️ **Achado — Claude no app**: a IA do **Rebanho** usa **Claude** (`@anthropic-ai/sdk`,
> `claude-opus-4-8`) enquanto o **bot** usa **OpenAI**. Se o padrão é só OpenAI, a IA do
> rebanho precisa migrar (remove `@anthropic-ai/sdk` + `ANTHROPIC_*`).

---

## Plano #2 — Fôlego de caixa, Ruptura e Projeção (determinístico)

Hoje são XXX (mock). **Não é "IA"** — é projeção aritmética a partir de dados reais
que já temos: **caixa real** (saldo inicial + fluxo, já implementado) + **séries
mensais por mês fechado** (receita/custeio/investimento/fluxo).

### Fórmulas
- **Queima mensal** = média, sobre os últimos *N* meses fechados, de `saídas − entradas`.
  - *Queima operacional* = `custeio − receita` (o "déficit do leite").
  - *Queima total* = `custeio + investimento − receita` (inclui compra de gado).
- **Fôlego** = `caixa_atual ÷ queima_mensal` → "o caixa cobre X meses".
- **Ruptura** = projeta `caixa_t = caixa_0 − queima·t` mês a mês até cruzar zero →
  "ruptura em X meses (mês/ano)". Se a queima ≤ 0, "sem ruptura no horizonte".
- **Projeção de fluxo (gráfico)** = a mesma série `caixa_t` por *H* meses à frente.

### Decisões a confirmar
1. **Base da queima**: média de quantos meses fechados? (sugiro **3** ou **6**).
2. **Operacional, total, ou os dois?** A UI atual mostra os dois ("déficit operacional"
   vs "investimento") — sugiro **calcular ambos**.
3. **Aporte do proprietário**: projetar *com* aporte (entradas reais) ou *sem aporte*
   (pior caso)? A narrativa atual é "o negócio roda por aporte" → sugiro **sem aporte**
   como cenário principal.
4. **Horizonte** da projeção: 35 dias? **12 meses**?
5. **Como marcar "aporte" nos dados** — qual categoria/centro de custo representa o
   aporte do proprietário? Hoje não está marcado; precisa dessa identificação para
   separar aporte de receita operacional. **(bloqueio até definir)**

### Pré-requisitos de dado
- ✅ Caixa real (feito).
- ✅ Séries mensais (já no `buildDashboard`).
- ⚠️ Mapear o "aporte" (item 5).

---

## Plano — Análises da IA por **mês fechado**

### Princípio
A análise da IA é sobre **período fechado**, gerada **quando o mês fecha**
(`FechamentoMensal`). Fica **imutável** e barata — não re-gera a cada carregamento.
A IA só opina sobre o que já fechou; o mês corrente aparece como **número cru +
projeção** (Plano #2), nunca como "análise".

### Modelo de dados (novo)
```
model AnaliseMensal {
  id          Int      @id @default(autoincrement())
  ano         Int
  mes         Int      // 1-12
  geradoEm    DateTime @default(now())
  modeloIa    String
  resumoJson  Json     // KPIs do mês: receita/custeio/invest/fluxo/caixa,
                       // top categorias, top fornecedores, inconsistências
  narrativaMd String   // texto da IA (o "Resumo executivo" daquele mês)
  @@unique([ano, mes])
}
```

### Fluxo
1. **Fechar o mês** → cria `FechamentoMensal(ano,mes)` (hoje a tabela está vazia;
   precisa de rota/UI pra fechar).
2. **Gatilho**: ao fechar, um job:
   - computa os agregados do mês (determinístico — reusa `buildDashboard({from,to})`
     com o range = aquele mês);
   - chama o LLM **uma vez** para a narrativa;
   - grava `AnaliseMensal` (idempotente via `unique(ano,mes)`; permite re-gerar).
3. **Dashboard lê** `AnaliseMensal` para meses fechados — estável e barato.

### Como mostrar o atual (a tensão que você levantou)
Separar visualmente **dois planos**:
- **Realizado (fechado)** — números reais **+ análise da IA** gravada. Estável.
- **Em andamento (mês aberto)** — números **ao vivo/parciais** + **projeção**
  (Plano #2), com selo **"mês em aberto — análise quando fechar"**. Sem texto de IA
  (ou uma "prévia" claramente provisória, não persistida).

Interação com o **filtro mensal**:
- Range só em meses fechados → mostra as `AnaliseMensal` do período (a última, ou
  re-sumariza o conjunto).
- Range inclui o mês aberto → números ao vivo + aviso; a análise cobre só a parte fechada.

### Decisões a confirmar
1. Análise **automática no fechamento** ou **sob demanda** (botão "gerar análise")?
2. Mês aberto: **prévia provisória de IA** ou **só números + selo**? (sugiro só números + selo).
3. Granularidade: **por mês** só, ou também **trimestre/ano** (agregando meses fechados)?
4. **Quem fecha o mês** — precisa de rota/UI de fechamento (`FechamentoMensal` está vazio).
5. **Qual LLM** gera a narrativa: o agente do bot (OpenAI) ou o LLM do rebanho (Claude)?

### Consequência (boa) do seu raciocínio
Isto resolve o "dashboard só serve pra passado": o **passado fechado** é a verdade
analisada pela IA; o **presente** é número cru + projeção. Cada coisa no seu lugar,
sem a IA tendo que "adivinhar" um mês incompleto.
