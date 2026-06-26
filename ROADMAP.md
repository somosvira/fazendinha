# ROADMAP.md — Caminho do Produto

> **De onde viemos, onde estamos, para onde vamos.**
> Roadmap vivo: revisar mensalmente, ajustar trimestralmente. Datas são intenções, não promessas.

---

## Sumário

1. [Filosofia do roadmap](#1-filosofia-do-roadmap)
2. [Onde estamos hoje (status snapshot)](#2-onde-estamos-hoje-status-snapshot)
3. [MVP — Fundação](#3-mvp--fundação)
4. [V1 — Operação diária completa](#4-v1--operação-diária-completa)
5. [V2 — Inteligência aplicada](#5-v2--inteligência-aplicada)
6. [V3 — Plataforma](#6-v3--plataforma)
7. [Longo prazo (12–36 meses)](#7-longo-prazo-1236-meses)
8. [O que NÃO entra](#8-o-que-não-entra)
9. [Riscos e dependências](#9-riscos-e-dependências)
10. [Como propor mudança](#10-como-propor-mudança)

---

## 1. Filosofia do roadmap

| Princípio | Tradução prática |
|---|---|
| **Profundidade > Vastidão** | Antes de abrir o módulo seguinte, esgotar o atual. |
| **Decisão > Relatório** | Toda versão tem que entregar pelo menos 1 nova decisão acionável ao produtor. |
| **Validação real** | Cada release tem que rodar na Fazenda Rio Novo (e em ≥ 1 fazenda parceira nas próximas) por ≥ 30 dias antes de generalizar. |
| **MVP é o que dá lucro** | O sistema só está "pronto" quando o produtor consegue argumentar economias concretas com ele. |
| **Reuso sobre reinvenção** | Toda nova funcionalidade deve listar quais componentes/serviços existentes reúsa. |

---

## 2. Onde estamos hoje (status snapshot)

**Data:** 2026-06-26.

### Em produção (Fazenda Rio Novo)

- ✅ Dashboard financeiro 23 meses (Jul/24 → Mai/26).
- ✅ DRE simplificada com classificação custeio/investimento (Fatia 22).
- ✅ Top 12 categorias, inconsistências, fechamento mensal.
- ✅ Cadastro de animais (bovinos e caprinos) com raça pura + grau de sangue composto + categoria por espécie.
- ✅ Ficha do animal com **painel executivo** (score, financeiro, tendências, percentis, projeções, genealogia).
- ✅ Timeline por animal (reprodução, sanidade, produção).
- ✅ Cadastros: produtos, fornecedores, dietas, lotes.
- ✅ Estoque com saldos, movimentos, custo vaca/dia.
- ✅ Custo de produção (R$/litro estimado).
- ✅ Custo de sanidade com rateio.
- ✅ Configuração de modo de produção (ORDENHA / TOTAL_DIARIO / TANQUE_LOTE) e preço do leite.
- ✅ IA conversacional "Rúmi" sobre o rebanho (Claude).
- ✅ Recepção de NF por WhatsApp com confirmação assistida (em estabilização).

### Em desenvolvimento (junho/26)

- 🔄 Worklists reprodutivas finalizadas (aInseminar, dgPendente, aSecar, partosPrevistos).
- 🔄 Painel "Hoje" — agregando as ações do dia (cross-domínio).
- 🔄 Estabilização do fluxo NF→WhatsApp→Lancamento.
- 🔄 Recompute automático de `ResumoAnimal` na criação de evento.

### Conhecidos abertos

- Backend Hono cobre maior parte do rebanho; restam endpoints de simulação financeira.
- Frontend ainda mistura mocks (`R`) com chamadas reais; transição em andamento.
- Sem autenticação real ainda.
- Sem suite de testes E2E.
- Multi-tenant ainda não implementado.

---

## 3. MVP — Fundação

**Status:** ✅ entregue.

Objetivo: substituir o relatório Excel mensal do BPO + colocar a base do rebanho em produção.

### Critérios de saída do MVP (atingidos)

1. Rio Novo opera o financeiro **sem precisar do Excel BPO**.
2. Cada animal tem ficha individual com histórico mínimo.
3. Dashboard cabe em **uma tela** com 4 seções (timeline, DRE, categorias, inconsistências).
4. Produtor abre o sistema e entende em **< 5 segundos** se o mês está bom ou ruim.

### O que ficou de fora propositalmente

- Multi-tenant.
- Aplicativo nativo.
- IA preditiva (mastite, descarte).
- Integração com ordenhadeira.

---

## 4. V1 — Operação diária completa

**Janela:** 2026 H2.

**Tema:** "tudo o que o produtor faz no dia a dia cabe no Fazendinha".

### Objetivos

1. **Painel "Hoje"** unificado:
   - 5 ações de manejo do dia.
   - Saldo financeiro do dia / mês.
   - Alertas críticos (CCS, secagem, estoque mínimo).
   - Fechamento com 0 itens pendentes.

2. **Reprodução completa**:
   - Worklists finalizadas com volumes e impacto em R$.
   - Registro de cio, IA, DG, parto, secagem em **3 cliques cada**.
   - Protocolos IATF como **catálogo configurável** (D0, D7, D9, D11 padrão).

3. **Sanidade completa**:
   - Histórico de mastite por quarto.
   - Carência ativa visível na produção (não vender o leite dessa vaca).
   - Vacinação obrigatória com lembrete por data.
   - CMT como entrada rápida via tablet.

4. **Produção**:
   - Tela de lançamento rápido (modos ORDENHA, TOTAL_DIARIO, TANQUE_LOTE).
   - Curva de lactação por animal com pontos reais.
   - Ranking de produção e queda recente.

5. **Estoque amarrado ao manejo**:
   - APLICACAO em sanidade → SAIDA automática de estoque do medicamento.
   - Alertas de mínimo no painel "Hoje".
   - Ponte automática compra → financeiro (já existe; refinar UX).

6. **WhatsApp como interface secundária**:
   - Lançar nota fiscal por foto (já existe; reduzir fricção).
   - Consulta rápida do tipo "como tá o caixa?" "qual vaca devo inseminar?".

### Métricas de sucesso V1

| KPI | Meta |
|---|---|
| % de fazenda lançando 80% das despesas pelo sistema | ≥ 90% |
| Tempo médio para lançar despesa via WhatsApp | < 90 segundos |
| Frequência de uso do painel "Hoje" | ≥ 5x/semana |
| % de eventos reprodutivos com registro feito no mesmo dia | ≥ 80% |
| Animais com ≥ 1 evento nos últimos 30 dias | ≥ 80% |

---

## 5. V2 — Inteligência aplicada

**Janela:** 2027 H1.

**Tema:** "o sistema sugere, o produtor decide".

### Objetivos

1. **Painel "Hoje" preditivo**:
   - "Inseminar #1188 hoje — janela ótima fecha amanhã."
   - "Prevemos R$ X negativo na semana que vem; antecipar venda?".
   - "Vaca #0942 indica padrão de mastite subclínica recorrente; cogite descarte."

2. **Score 0–100 do rebanho**:
   - Painel comparando o **rebanho como um portfólio**.
   - Ranking de animais e categorias subutilizadas.
   - Simulação: "descartando as 10 piores, qual o impacto no lucro?".

3. **Predições por IA**:
   - **Mastite subclínica** com 14 dias de antecedência (CCS, carga horária, padrão).
   - **Falha reprodutiva** após 2 IA negativas (sugere protocolo ou descarte).
   - **Queda de produção** detectada antes do produtor (DEL, dieta, idade, sanidade).
   - **Descarte sugerido** com simulação de payback de reposição.

4. **Simulações financeiras**:
   - Cenário "preço do leite cai R$ 0,20/L" → impacto no DRE projetado.
   - Cenário "troca de fornecedor de ração" → custo vaca/dia simulado.
   - Cenário "aumento de 10% no rebanho em lactação" → receita e infra necessária.

5. **WhatsApp como interface primária**:
   - Resumo diário automático ("ontem você produziu X L, tem Y a inseminar, alerta Z").
   - Decisões diretas pelo chat ("inseminar 1188" via texto).
   - Captura de fotos de cio/mastite/manejo classificada por IA.

6. **Conexão com IDEagri / ferramentas legadas**:
   - Importação periódica.
   - Conciliação de animais (genealogia, histórico de partos).

### Métricas de sucesso V2

| KPI | Meta |
|---|---|
| Acurácia da predição de mastite (precision @ 14d) | ≥ 70% |
| Acurácia da sugestão de descarte (payback validado em 6m) | ≥ 65% |
| % de interações via WhatsApp | ≥ 40% das ações totais |
| Aumento médio de produção/vaca em fazendas ≥ 6 meses no V2 | +5% |

---

## 6. V3 — Plataforma

**Janela:** 2027 H2 – 2028.

**Tema:** "Fazendinha vira a infraestrutura digital da fazenda".

### Objetivos

1. **Multi-tenant em escala**:
   - Onboarding de novas propriedades em < 30 min (importação financeira + cadastro inicial).
   - Isolamento de dados por propriedade.
   - Plano de cobrança (SaaS).

2. **Aplicativo nativo (iOS/Android)**:
   - Capacitor sobre web ou React Native — decisão depende de uso real.
   - Foco em: painel "Hoje", lançamento de evento, captura de mídia (foto/áudio).
   - Offline-first para áreas sem conexão.

3. **Integrações IoT**:
   - **Ordenhadeira** (Delaval, GEA, Boumatic) — produção individual automática.
   - **Balança eletrônica** — pesagens corporais.
   - **Colares de atividade** (Allflex, Nedap) — detecção de cio automatizada.
   - **Robôs de ordenha** quando aplicável.
   - **Sensores ambientais** (temperatura, umidade) para conforto térmico.

4. **Marketplace de insumos**:
   - Cotação automática de ração / medicamentos quando estoque baixa.
   - Histórico de preço por fornecedor.
   - Pedido de compra direto integrado ao financeiro.

5. **Benchmarking entre fazendas**:
   - Comparativo de CCS, IEP, custo/litro, score médio.
   - Painel "minha fazenda vs média da região / raça / sistema".
   - Anonimizado por padrão; opt-in para clube.

### Métricas de sucesso V3

| KPI | Meta |
|---|---|
| Propriedades ativas | ≥ 100 |
| NPS médio dos produtores | ≥ 60 |
| Receita recorrente mensal | viabilizar operação independente |
| % de fazendas usando ≥ 1 integração IoT | ≥ 30% |

---

## 7. Longo prazo (12–36 meses)

Ideias em incubação. Validar antes de comprometer.

### Inteligência de mercado

- Score de crédito rural derivado da operação real (parceria com bancos).
- Previsão de preço do leite por região e safra.
- Hedge / contratos a termo dentro do app.

### Cadeia produtiva

- Integração com cooperativa (carga de leite, qualidade, pagamento).
- Programa de bonificação de qualidade automatizado.
- Rastreabilidade do leite até prateleira.

### Ciência de dados / pesquisa

- Compartilhamento opt-in de dados anonimizados com universidades.
- Estudos longitudinais de raças, dietas, sistemas.
- Publicação de benchmarks regionais.

### Verticalização

- Módulo de bovinocultura de corte (engorda, abate).
- Módulo de outros leites (búfala).
- Outras espécies (caprinos já entrou; ovinos sob avaliação).

### Internacionalização

- Espanhol/Inglês — só quando houver demanda comprovada.
- LATAM como segundo mercado natural.

---

## 8. O que NÃO entra

Coisas que parecem boas mas **rejeitamos deliberadamente** (revisar PRODUCT.md §10):

- Configurador genérico de relatórios.
- Cores neon, glassmorphism, dark mode.
- Login social, gamificação, social features.
- Multi-idioma no MVP.
- Telas-planilha com 30 colunas.
- Tela de "todas as transações ordenadas por data" — quem precisa disso usa Excel.
- App para o BPO — backoffice usa o web.

Se uma feature dessa lista aparece como pedido, voltar à pergunta-mãe:

> **"Qual decisão do produtor isso melhora?"**

---

## 9. Riscos e dependências

| Risco | Mitigação |
|---|---|
| Adoção lenta (mudar do Excel é difícil) | Onboarding assistido nas primeiras fazendas; metas concretas de tempo gasto. |
| Qualidade do dado (lançamento manual incompleto) | WhatsApp + OCR para reduzir fricção; "completude" como métrica visível. |
| Custo de Anthropic em escala | Otimizar prompts; usar Sonnet/Haiku onde Opus não é necessário; cache. |
| Conexão rural fraca | V3 offline-first; sincronização em background. |
| Concorrência (IDEagri, Conpec) | Diferencial é integração financeira; verticalizar mais fundo no agro leiteiro. |
| Regulação (LGPD, sanidade) | Privacidade desde o design; logs minimizados; opt-in para benchmarks. |
| Falha de IoT integration | Cada parceria como projeto separado; não bloquear roadmap em vendor único. |

---

## 10. Como propor mudança

1. **Conexão com missão** — Como isso aumenta lucratividade? Quem decide melhor?
2. **Tamanho** — É feature ou módulo? MVP de quanto?
3. **Reuso** — O que já existe?
4. **NÃO-fazemos** — O que fica de fora?
5. **Sucesso** — Como medir em 30/90/180 dias?

Documentar como issue + breve RFC. Decisão coletiva.

---

## Referências cruzadas

- [`PRODUCT.md`](./PRODUCT.md) — missão e visão.
- [`DOMAIN.md`](./DOMAIN.md) — domínio que sustenta o que construímos.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — fundação técnica.
- [`AI_RULES.md`](./AI_RULES.md) — como qualquer agente deve trabalhar nesse roadmap.
- `docs/HANDOFF-*.md` — passagens de bastão e contexto operacional.
- `docs/benchmark-ideagri.md` — análise do concorrente atual mais relevante.
