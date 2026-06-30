# Checklist da visita à fazenda — Indicadores zootécnicos Embrapa

**Para:** Felipe (em campo)
**Sobre:** Fazenda Rio Novo — atividade leiteira
**Referência:** 24 indicadores da Embrapa Gado de Leite

---

## Como usar este documento

Este checklist tem três blocos:

- **Bloco A — Perguntas para fazer ao Marco Antônio e à equipe** (medir a realidade).
- **Bloco B — Coisas para conferir com os próprios olhos** (anotar amostras / fotos).
- **Bloco C — Decisões para alinhar** (o que precisamos antes de plugar no sistema).

Cada indicador tem:
- **🎯 Meta Embrapa** — referência de qualidade.
- **📋 Pergunta(s)** — o que perguntar.
- **🔍 Como verificar** — onde olhar / o que coletar.
- **📝 Status no sistema** — se o cálculo já está pronto ou o que falta.

---

## Bloco A — INDICADORES PRODUTIVOS

### 1. % Vacas em Lactação (%VL)

🎯 **Meta:** ≥ 83% (alto desempenho); 75–83% (médio)
📋 **Pergunta:**
- Hoje, de cada 10 vacas no rebanho, quantas estão dando leite?
- Vocês acompanham esse número mês a mês?
- Quando uma vaca passa muito tempo seca, qual o gatilho para descarte?

🔍 **Conferir:** Conte na rotina da ordenha — vacas que entram x vacas adultas totais.
📝 **Sistema:** ✅ Calculado em `dashboard.agg.ts` (KPI `emLactacao` / `secas`). Endpoint pronto.

---

### 2. Duração da Lactação (DL)

🎯 **Meta:** ~305 dias (padrão); aceitável 270–310
📋 **Pergunta:**
- Em média, quantos meses uma vaca fica produzindo entre um parto e a próxima secagem?
- Vocês têm meta de duração? Como decidem secar — por data fixa ou por queda na produção?

🔍 **Conferir:** Pedir 5 fichas de vacas secas recentemente — anotar dt do parto e dt da secagem.
📝 **Sistema:** ✅ Cálculo implementado (`duracaoLactacaoMedia`). Depende de `EventoReprodutivo` PARTO + SECAGEM estarem sendo registrados.

---

### 3. Persistência da Lactação

🎯 **Meta:** ≥ 90% (queda ≤ 10% mês a mês após o pico)
📋 **Pergunta:**
- Quantos kg/dia a melhor vaca dá no pico? E 2 meses depois?
- Vocês fazem controle leiteiro mensal individual? Com qual frequência? Pesa em todas as ordenhas?
- Quem registra os pesos? Em papel, planilha, app?

🔍 **Conferir:** Pegar 3 vacas com lactação avançada e olhar histórico de pesos. Calcular pico vs 60-90 dias depois.
📝 **Sistema:** ✅ Cálculo implementado (`persistenciaLactacao`). **REQUER ≥ 4 controles leiteiros por lactação no banco** — confirmar se eles vão alimentar isso.

---

### 4. Produção por Vaca Ordenhada (PVO)

🎯 **Meta:** ≥ 18 L/d (intensivo); 10–18 L/d (médio)
📋 **Pergunta:**
- Quantos litros, em média, cada vaca em lactação dá por dia hoje?
- Esse número varia muito entre estações?
- Vocês conseguem comparar primeira lactação vs vacas multíparas?

🔍 **Conferir:** Olhar tanque do dia ÷ nº de vacas ordenhadas.
📝 **Sistema:** ✅ `ResumoAnimal.producaoMediaDia` (média móvel 3 controles) + KPI agregado.

---

### 5. Produção por Lactação

🎯 **Meta:** ≥ 5.500 kg/lactação (intensivo); 3.000–5.500 kg (médio)
📋 **Pergunta:**
- Vocês têm noção de quanto cada vaca produz "do parto até secar"?
- Existe alguma vaca que vocês consideram a melhor? Quanto ela deu na última lactação?

🔍 **Conferir:** Em 3 vacas que secaram nos últimos 60 dias, somar a produção registrada.
📝 **Sistema:** ✅ Cálculo implementado com regra do trapézio (`producaoPorLactacao`). Para lactações fechadas é "real"; abertas é "projetada".

---

### 6. Período Seco

🎯 **Meta:** 60 dias (ideal); aceitável 45–70
📋 **Pergunta:**
- Quantos dias vocês deixam uma vaca seca antes do próximo parto?
- Como decidem o dia de secar? Acompanham a previsão do parto?
- Já secaram vaca por mastite (decisão sanitária e não calendário)?

🔍 **Conferir:** Anotar 3 vacas que pariram recentemente e checar quanto tempo ficaram secas antes.
📝 **Sistema:** ✅ Implementado (`periodoSecoMedio`).

---

## Bloco A — INDICADORES REPRODUTIVOS

### 7. Intervalo de Partos (IP)

🎯 **Meta:** ≤ 395 dias (~13 meses)
📋 **Pergunta:**
- Em quanto tempo, em média, uma vaca pare de novo depois do parto anterior?
- Vocês têm vacas com mais de 15 meses entre partos? Quantas?
- Vocês conhecem o conceito de IEP? Usam essa medida na decisão de descarte?

🔍 **Conferir:** Pegar 5 vacas com 2+ partos no histórico — calcular intervalo médio.
📝 **Sistema:** ✅ IP **projetado** já existe em `ResumoAnimal.iepProjetado`. IP **real** agora calculado em `intervaloPartosMedio`.

---

### 8. Período de Serviço (PS) / Dias em Aberto

🎯 **Meta:** ≤ 120 dias
📋 **Pergunta:**
- Quanto tempo depois do parto vocês começam a tentar inseminar de novo?
- Quantas inseminações, em média, até uma vaca emprenhar?
- Existem vacas que "ficam vazias" muito tempo? Quando vocês desistem?

🔍 **Conferir:** Em 5 vacas prenhes hoje, ver: data do último parto → data da IA que pegou.
📝 **Sistema:** ✅ Implementado (`periodoServicoMedio`).

---

### 9. % Prenhez do Rebanho

🎯 **Meta:** ≥ 60% das vacas + novilhas
📋 **Pergunta:**
- De cada 10 vacas adultas, quantas estão prenhes hoje?
- Vocês usam IATF (inseminação a tempo fixo) ou só observando cio?
- Quem é o responsável pela parte reprodutiva? Veterinário próprio ou contratado?

🔍 **Conferir:** Pedir lista de prenhes do mês.
📝 **Sistema:** ✅ KPI `prenhez` em dashboard.

---

### 10. % Prenhez ao 1º Serviço

🎯 **Meta:** ≥ 50% (ideal); ≥ 40% (aceitável)
📋 **Pergunta:**
- Das vacas que vocês inseminam, qual a porcentagem que pega de primeira?
- Vocês acompanham esse número?
- Quem faz o diagnóstico de gestação? Em quantos dias após IA?

🔍 **Conferir:** Pegar 10 IAs recentes — checar resultado do 1º DG de cada uma.
📝 **Sistema:** ✅ Implementado (`pctPrenhezPrimeiroServico`).

---

### 11. Taxa de Gestação

🎯 **Meta:** ≥ 40%
📋 **Pergunta:**
- De cada 10 inseminações que vocês fazem, quantas dão prenhez confirmada?
- Usam mesmo sêmen sempre ou variam? De qual touro/central?
- Protocolo de IA é o mesmo para todas?

🔍 **Conferir:** Histórico de 20 IAs do trimestre + DGs correspondentes.
📝 **Sistema:** ✅ Implementado (`taxaGestacao`).

---

### 12. Idade ao 1º Parto (IPP)

🎯 **Meta:** 22–26 meses
📋 **Pergunta:**
- Com que idade vocês colocam novilha para inseminar pela primeira vez? Por peso ou idade?
- Quando ela pare pela 1ª vez?
- Vocês têm controle de pesagem das bezerras/novilhas?

🔍 **Conferir:** Pegar 5 vacas de primeira cria — anotar dt nascimento + dt do 1º parto.
📝 **Sistema:** ✅ Implementado (`idadePrimeiroPartoMedia`). Ignora animais com `numPartosEntrada > 0` (compraram já parida).

---

### 13. Taxa de Natalidade

🎯 **Meta:** ≥ 80%
📋 **Pergunta:**
- No ano passado, quantos bezerros nasceram VIVOS?
- Quantas vacas tinham no rebanho na média?
- Tiveram partos múltiplos (gêmeos)?

🔍 **Conferir:** Cadernos de nascimento ou livro do veterinário.
📝 **Sistema:** ⚠️ Cálculo implementado (`taxaNatalidade`), **mas hoje só temos `numCrias` (total)** — não distinguimos nascidos vivos de natimortos. **Decidir** se vamos adicionar `criasVivas` / `criasNatimortas` ao `EventoReprodutivo` PARTO.

---

### 14. Taxa de Abortos e Natimortos

🎯 **Meta:** abortos ≤ 5%; natimortos ≤ 8%
📋 **Pergunta:**
- Quantos abortos vocês tiveram nos últimos 12 meses?
- Em que fase da gestação foram? Causa conhecida (infecciosa, nutricional)?
- Algum natimorto (nasceu morto)?
- **Importante:** vocês registram o aborto em algum lugar hoje? Como?

🔍 **Conferir:** Falar com o veterinário do rebanho.
📝 **Sistema:** ❌ **Schema atual NÃO tem evento ABORTO** — só CIO, INSEMINACAO, DIAGNOSTICO, PARTO, SECAGEM. Cálculo já está pronto, falta o dado. **Proposta de schema na seção C.**

---

## Bloco A — INDICADORES PRODUTIVO-REPRODUTIVOS

### 15. PDIP — Produção por Dia de Intervalo de Partos

🎯 **Meta:** ≥ 14 kg/dia
📋 **Pergunta:** *(derivado — não precisa perguntar)*
🔍 **Conferir:** Fórmula = produção_lactação_kg ÷ intervalo_de_partos_dias.
📝 **Sistema:** ✅ Implementado. Requer #5 + #7 funcionando.

---

### 16. PLVA — Produção de Leite por Vaca por Ano

🎯 **Meta:** ≥ 5.000 kg/vaca/ano (intensivo); 2.500–5.000 (médio)
📋 **Pergunta:** *(derivado)*
📝 **Sistema:** ✅ Implementado (`plva`).

---

## Bloco A — INDICADORES DE GESTÃO

### 17. Taxa de Lotação (UA/ha)

🎯 **Meta:** 1,5–3,0 UA/ha (pastagem manejada)
📋 **Pergunta:**
- **Quantos hectares totais de pastagem para o rebanho leiteiro?**
- Os animais ficam soltos, em piquetes rotacionados, ou em confinamento?
- Quantos piquetes existem? Qual o capim predominante (Tifton, Mombaça, Marandu)?
- Vocês fazem manejo rotacionado? Quantos dias de descanso?
- Tem irrigação na pastagem? Em quantos hectares?

🔍 **Conferir:**
- Pedir mapa / croqui das pastagens.
- Foto aérea (Google Earth se necessário) para validar área.
- Anotar área por piquete e capim de cada um.

📝 **Sistema:** ❌ **Schema do rebanho leite NÃO tem área de pastagem.** O módulo Corte tem `Piquete.areaHa` — leite não. **Proposta de schema na seção C.**

---

### 18. Produtividade da Terra (L/ha/ano)

🎯 **Meta:** ≥ 5.000 L/ha/ano (intensivo); 1.500–5.000 (médio)
📋 **Pergunta:** *(derivado de #17 + produção total)*
- Como referência: qual a produção média diária do tanque (litros/dia)?

🔍 **Conferir:** ticket do laticínio mostra quantidade entregue.
📝 **Sistema:** ❌ Mesmo gap de #17 (falta `areaPastagemHa`).

---

### 19. Produtividade da Mão de Obra (L/funcionário/dia)

🎯 **Meta:** ≥ 250 L/funcionário/dia (intensivo)
📋 **Pergunta:**
- Quantos funcionários trabalham diretamente com o rebanho leiteiro?
- O que cada um faz (ordenhador, campeiro, tratorista, gerente)?
- Algum é por diária / temporário? Como contar (equivalente integral)?
- O Marco Antônio faz parte da contagem ou é gestão?

🔍 **Conferir:** Folha de pagamento / livro de ponto.
📝 **Sistema:** ❌ **Não há modelo `Funcionario` no schema.** Folha aparece só como `Lancamento` (categoria "Salários"). **Proposta de schema na seção C.**

---

### 20. Relação Leite / Concentrado (kg leite / kg ração)

🎯 **Meta:** ≥ 2,0 (eficiência ok); ≥ 3,0 (alta)
📋 **Pergunta:**
- Quantos kg de ração vocês fornecem por vaca por dia, em média?
- Qual a marca / tipo (proteína, energético)?
- Vocês compram em saco de 25 kg, big bag, ou granel?
- Como vocês registram a entrada da ração e a saída para os cochos?

🔍 **Conferir:**
- Nota fiscal da última compra de ração.
- Visitar o silo / depósito — estimar estoque.

📝 **Sistema:** ⚠️ Cálculo implementado (`relacaoLeiteConcentrado`). Requer que **`MovimentoEstoque`** de ração esteja sendo lançado (com tipo SAIDA quando consumido). Confirmar se o fluxo está sendo seguido.

---

### 21. Taxa de Descarte

🎯 **Meta:** 18–22% ao ano (renovação saudável); > 30% indica problema
📋 **Pergunta:**
- Quantas vacas vocês venderam ou descartaram no último ano?
- Quais foram os motivos principais (mastite, fertilidade, baixa produção, idade)?
- Vocês têm critério escrito para descarte ou é caso a caso?

🔍 **Conferir:** Cruzar notas fiscais de venda de gado com lista de baixas.
📝 **Sistema:** ⚠️ Implementado com heurística — analisa texto do `motivoBaixa`. Para ficar preciso, **proposta de enum `MotivoBaixa` na seção C**.

---

## Bloco A — INDICADORES SANITÁRIOS

### 22. Mortalidade de Adultos

🎯 **Meta:** ≤ 2% ao ano
📋 **Pergunta:**
- Tiveram morte de vacas/novilhas no último ano? Quantas?
- Causa identificada (doença, parto, acidente, raio)?
- Existe necropsia ou registro veterinário?

🔍 **Conferir:** Caderno do veterinário / declarações de óbito.
📝 **Sistema:** ⚠️ Heurística por `motivoBaixa`.

---

### 23. Mortalidade de Bezerros (até 1 ano)

🎯 **Meta:** ≤ 8% (até 1 ano); ≤ 3% no aleitamento
📋 **Pergunta:**
- Quantos bezerros morreram no último ano antes de completar 1 ano?
- A maioria foi nos primeiros dias (diarreia, mordedura) ou mais tarde?
- Como é o manejo do colostro nas primeiras horas?

🔍 **Conferir:** Bezerreiro — anotar idade dos bezerros vivos e registros de óbitos.
📝 **Sistema:** ⚠️ Heurística por `motivoBaixa`.

---

### 24. CCS — Contagem de Células Somáticas

🎯 **Meta:** ≤ 200 mil/mL (excelente); ≤ 400 mil/mL (limite legal BR)
📋 **Pergunta:**
- Qual é a CCS do tanque atual? E há 3 meses?
- O laticínio paga bonificação por qualidade? A partir de que valor?
- Vocês fazem CCS individual ou só do tanque?
- Qual o protocolo quando uma vaca passa de 400 mil?

🔍 **Conferir:** Último laudo do tanque (geralmente vem na fatura do laticínio).
📝 **Sistema:** ✅ Plenamente implementado (`EventoSanitario.ccs`, tendência em `ResumoAnimal.ccs`).

---

## Bloco B — O QUE OBSERVAR / FOTOGRAFAR

| Item | Por quê | Como capturar |
|---|---|---|
| Mapa/croqui das pastagens | Calcular taxa de lotação e produtividade da terra | Pedir cópia ou desenhar com Marco Antônio |
| Ticket de entrega do leite (laticínio) | Validar produção diária do tanque + CCS + gordura/proteína | Foto do ticket dos últimos 30 dias |
| Caderno de eventos reprodutivos | Validar se IA/DG/parto estão sendo registrados | Foto das últimas páginas |
| Caderno do veterinário | Conferir mortes, abortos, mastites | Foto |
| Folha de ponto / pagamento (sem dados pessoais) | Contar funcionários equivalentes integrais | Anotar números |
| Última NF de ração | Validar consumo e custo unitário | Foto |
| Sala de ordenha — leituras de pesos | Ver como é registrado (manual / automático) | Foto + observação do processo |
| Brincos / SISBOV | Confirmar que numeração bate com o sistema | Foto de 5 animais aleatórios |

---

## Bloco C — DECISÕES PARA ALINHAR ANTES DE PLUGAR NO SISTEMA

Hoje a lógica de cálculo dos 24 indicadores **já está pronta no backend** (rota `GET /api/rebanho/indicadores-embrapa`). Mas **4 indicadores não vão calcular** até decidirmos mudanças no banco. Levar essas perguntas para o Marco Antônio:

### Decisão 1 — Registrar abortos e natimortos? (indicador #14)

**Proposta:** adicionar no schema:

```prisma
enum TipoEventoReprodutivo {
  CIO
  INSEMINACAO
  DIAGNOSTICO
  PARTO
  SECAGEM
  ABORTO         // NOVO
}

model EventoReprodutivo {
  // ...
  criasVivas     Int?     // NOVO — para PARTO
  criasNatimortas Int?    // NOVO — para PARTO
  causaAborto    String?  // NOVO — para ABORTO (infecciosa, nutricional, etc)
}
```

**Pergunta para o Marco Antônio:** "Você quer ter relatório de aborto e taxa de natimortos, ou esse dado é pequeno demais para se preocupar?"

---

### Decisão 2 — Categorizar motivo de baixa? (indicadores #21, #22, #23)

**Hoje:** `Animal.motivoBaixa` é texto livre — funciona com heurística (palavras tipo "morte", "venda") mas é impreciso.

**Proposta:**

```prisma
enum MotivoBaixa {
  VENDA
  DESCARTE_FERTILIDADE
  DESCARTE_PRODUCAO
  DESCARTE_MASTITE
  DESCARTE_IDADE
  DESCARTE_OUTROS
  MORTE_DOENCA
  MORTE_PARTO
  MORTE_ACIDENTE
  MORTE_OUTRA
  TRANSFERENCIA
}

model Animal {
  motivoBaixa     String?       // mantém para histórico textual
  motivoBaixaEnum MotivoBaixa?  // NOVO
}
```

**Pergunta:** "Quando você dá baixa numa vaca, qual a granularidade de motivo que faz sentido? Esses 10 motivos cobrem ou tem outros?"

---

### Decisão 3 — Cadastrar área de pastagem? (indicadores #17, #18)

**Hoje:** schema do rebanho leite **não tem** `areaPastagemHa`. O módulo Corte tem (`Piquete.areaHa`), mas não está sendo usado pelo leite.

**Proposta A (mais simples):** adicionar `areaPastagemHa` no `Grupo`:

```prisma
model Grupo {
  // ...
  areaPastagemHa Decimal? @db.Decimal(7, 2)  // NOVO
  tipoCapim      String?                       // NOVO
}
```

**Proposta B (mais completa):** reusar `Piquete` (já existe no Corte) e ligar `Grupo` a um piquete.

**Pergunta:** "Você quer ver produtividade da terra (litros/ha/ano)? Se sim, vamos cadastrar as áreas de cada lote."

---

### Decisão 4 — Cadastrar funcionários? (indicador #19)

**Hoje:** sem modelo de funcionário.

**Proposta:**

```prisma
enum FuncaoFuncionario {
  ORDENHADOR
  CAMPEIRO
  TRATORISTA
  GERENTE
  OUTRO
}

model Funcionario {
  id            Int       @id @default(autoincrement())
  nome          String
  funcao        FuncaoFuncionario
  dataAdmissao  DateTime  @db.Date
  dataDemissao  DateTime? @db.Date
  ativo         Boolean   @default(true)
  cargaSemanal  Int?      // horas/semana (40 = integral)
}
```

**Pergunta:** "Você quer acompanhar produtividade por funcionário (L/dia/pessoa)? Para isso vamos cadastrar a equipe — pelo menos quantos são, qual a função, e quantos são integrais."

---

## Resumo do que voltar com

- [ ] Mapa ou croqui da pastagem com áreas
- [ ] Tickets de leite dos últimos 30 dias (ou pelo menos uma semana)
- [ ] Lista dos funcionários da atividade leiteira (nome + função + integral/parcial)
- [ ] Resposta sobre as 4 decisões de schema (aborto, motivo de baixa, área, funcionário)
- [ ] Foto da última nota de ração
- [ ] Nome do laticínio e tabela de bonificação por CCS/gordura/proteína
- [ ] Cópia (ou foto) do caderno reprodutivo das últimas 4-8 semanas
- [ ] Confirmação do nome do veterinário responsável + se ele tem registros próprios que vale puxar

---

## Anexo — Status técnico no sistema (resumo)

| # | Indicador | Status | Endpoint |
|---|---|---|---|
| 1 | %VL | ✅ pronto | `/api/rebanho/dashboard` + `/api/rebanho/indicadores-embrapa` |
| 2 | DL | ✅ pronto | `/api/rebanho/indicadores-embrapa` |
| 3 | Persistência | ✅ pronto (requer dados) | `/api/rebanho/indicadores-embrapa` |
| 4 | PVO | ✅ pronto | `/api/rebanho/dashboard` |
| 5 | Prod/Lactação | ✅ pronto | `/api/rebanho/indicadores-embrapa` |
| 6 | Período Seco | ✅ pronto | `/api/rebanho/indicadores-embrapa` |
| 7 | IP real | ✅ pronto | `/api/rebanho/indicadores-embrapa` |
| 8 | PS | ✅ pronto | `/api/rebanho/indicadores-embrapa` |
| 9 | %Prenhez | ✅ pronto | `/api/rebanho/dashboard` |
| 10 | %Prenhez 1ª IA | ✅ pronto | `/api/rebanho/indicadores-embrapa` |
| 11 | Taxa gestação | ✅ pronto | `/api/rebanho/indicadores-embrapa` |
| 12 | IPP | ✅ pronto | `/api/rebanho/indicadores-embrapa` |
| 13 | Natalidade | ⚠️ usa `numCrias` (sem separar vivos/natimortos) | `/api/rebanho/indicadores-embrapa` |
| 14 | Abortos | ❌ requer schema | — |
| 15 | PDIP | ✅ pronto | `/api/rebanho/indicadores-embrapa` |
| 16 | PLVA | ✅ pronto | `/api/rebanho/indicadores-embrapa` |
| 17 | Lotação | ❌ requer schema | — |
| 18 | Prod. terra | ❌ requer schema | — |
| 19 | Prod. mão de obra | ❌ requer schema | — |
| 20 | Leite/Concentrado | ✅ pronto (depende de MovimentoEstoque RACAO) | `/api/rebanho/indicadores-embrapa` |
| 21 | Descarte | ⚠️ heurística por texto | `/api/rebanho/indicadores-embrapa` |
| 22 | Mort. adultos | ⚠️ heurística por texto | `/api/rebanho/indicadores-embrapa` |
| 23 | Mort. bezerros | ⚠️ heurística por texto | `/api/rebanho/indicadores-embrapa` |
| 24 | CCS | ✅ pronto | `/api/rebanho/dashboard` |

**Total:** 17 funcionando · 4 com heurística/dado parcial · 3 bloqueados por schema.
