# Visita à Fazenda Rio Novo — Documento de campo (completo)

**Para:** Felipe (em campo)
**Quando:** 2026-07-01
**Sobre:** Atividade leiteira — Fazenda Rio Novo
**Referência:** 24 indicadores da Embrapa Gado de Leite

> Documento autocontido. Parte 1 é a **síntese de bolso** (uma página, para o celular).
> Parte 2 é o **checklist completo dos 24 indicadores**.
> Parte 3 são as **decisões de schema** com proposta de código Prisma.
> Parte 4 é o **status técnico** indicador por indicador.
>
> **Princípio editorial:** chegar com perguntas específicas, não com "me conta como vocês trabalham". Mostrar que você conhece o sistema dele e está só fechando lacunas pontuais.

---

# Parte 1 — Síntese de bolso

## 🔴 Os 4 bloqueadores — sem essas respostas, 4 indicadores não calculam

| # | Bloqueio | Pergunta de ouro para o Marco Antônio | O que decidir |
|---|---|---|---|
| **#14** | Aborto e natimorto | "Quer ter relatório de aborto e natimorto, ou esse dado é pequeno demais?" | Adicionar enum `ABORTO` + campos `criasVivas/Natimortas` no parto |
| **#17/18** | Área de pastagem (UA/ha e L/ha/ano) | "Quer ver litros por hectare/ano? Quantos hectares de pastagem o gado leiteiro ocupa hoje?" | Adicionar `areaPastagemHa` (Grupo) ou ligar a `Piquete` |
| **#19** | Mão de obra (L/funcionário/dia) | "Quer acompanhar produtividade por funcionário? Posso cadastrar a equipe?" | Criar `Funcionario` (nome, função, integral/parcial) |
| **#21/22/23** | Motivo de baixa estruturado | "Quando você dá baixa, esses 10 motivos cobrem? (venda, descarte mastite/fertil/prod/idade, morte doença/parto/acidente, transferência)" | Adicionar enum `MotivoBaixa` ao `Animal` |

## 🟡 As 4 validações — confirmar se o dado existe na rotina

Cálculo já existe; só não sei se o dado *chega* nele.

1. **Controle leiteiro mensal individual?** (sem isso, persistência #3 não calcula) — "Vocês pesam cada vaca uma vez por mês? Em papel, planilha ou app? Quem registra?"
2. **`numCrias` separa vivos x natimortos?** (afeta #13) — "Quando registra parto, anota só o total ou separa vivo/morto?"
3. **Saída de ração é lançada no estoque?** (sem isso, #20 leite/concentrado não calcula) — "Como vocês baixam a ração quando vai para o cocho? Tem alguém anotando, ou só entra a NF e some?"
4. **Eventos reprodutivos (IA, DG, parto) onde são anotados?** — "Cadernos? Planilha? Quem é a fonte da verdade?"

## 📸 As 8 fotos que não podem faltar

Prioridade nessa ordem — se faltar tempo, são as primeiras.

1. **Mapa/croqui das pastagens** com áreas marcadas (ou Marco Antônio desenhando) → destrava #17/18
2. **Tickets do laticínio** dos últimos 30 dias (litros + CCS + gordura/proteína)
3. **Última NF de ração** (marca, kg, preço, fornecedor) → destrava #20
4. **Caderno reprodutivo** — fotos das últimas 4-8 páginas (IA, DG, parto)
5. **Caderno do veterinário** — abortos, mortes, mastites
6. **Sala de ordenha em operação** — como pesam o leite (manual? automático?)
7. **Brincos/SISBOV de 5 animais aleatórios** — validar se a numeração bate com o sistema
8. **Tabela de bonificação do laticínio** (foto da fatura — CCS/gordura/proteína por faixa)

## ❓ As 10 perguntas de ouro

Se só der tempo para essas:

1. Quantos hectares de pastagem para o leite? (UA/ha)
2. Quantos funcionários direto no leite? Função de cada um? Algum por diária?
3. Vocês registram aborto em algum lugar?
4. Quando dá baixa numa vaca — quais são os motivos mais comuns?
5. Faz controle leiteiro individual mensal? Quem registra?
6. Saída de ração para o cocho — como é registrada?
7. CCS do tanque atual? E há 3 meses?
8. Quantas vacas em lactação hoje? Quantas secas? Quantas prenhes?
9. Em quantos meses, em média, uma vaca pare de novo?
10. Qual é o laticínio? Tem bonificação por qualidade? A partir de que valor?

## 📋 Para voltar com (check-out)

- [ ] Mapa/croqui da pastagem (foto ou cópia)
- [ ] Lote de tickets do leite (foto)
- [ ] Foto da última NF de ração
- [ ] Foto de 4-8 páginas do caderno reprodutivo
- [ ] Foto do caderno do veterinário
- [ ] Lista de funcionários do leite (nome + função + integral/parcial)
- [ ] Respostas das 4 decisões de schema
- [ ] Nome do laticínio + tabela de bonificação
- [ ] Nome do veterinário responsável (+ se tem registros próprios para puxar)

## 🎯 Roteiro de 1h sugerido

1. **Tour 20 min** — sala de ordenha, bezerreiro, depósito de ração, piquetes. Fotos durante o tour.
2. **Cadernos 15 min** — sentar com Marco Antônio e ver os registros: reprodução, veterinário, leite. Fotografar.
3. **As 4 decisões 15 min** — abrir uma a uma, mostrar o "antes/depois" que aparece no sistema se ele topar.
4. **Pendências e próximos passos 10 min** — combinar como ele vai mandar os tickets do mês, quem é o vet, quando volta para validar.

---

# Parte 2 — Checklist completo dos 24 indicadores

## Como usar

Cada indicador tem:

- **🎯 Meta Embrapa** — referência de qualidade.
- **📋 Pergunta(s)** — o que perguntar.
- **🔍 Como verificar** — onde olhar / o que coletar.
- **📝 Status no sistema** — se o cálculo já está pronto ou o que falta.

---

## A. Indicadores produtivos

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

## B. Indicadores reprodutivos

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
📝 **Sistema:** ❌ **Schema atual NÃO tem evento ABORTO** — só CIO, INSEMINACAO, DIAGNOSTICO, PARTO, SECAGEM. Cálculo já está pronto, falta o dado. **Proposta de schema na Parte 3.**

---

## C. Indicadores produtivo-reprodutivos

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

## D. Indicadores de gestão

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

📝 **Sistema:** ❌ **Schema do rebanho leite NÃO tem área de pastagem.** O módulo Corte tem `Piquete.areaHa` — leite não. **Proposta de schema na Parte 3.**

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
📝 **Sistema:** ❌ **Não há modelo `Funcionario` no schema.** Folha aparece só como `Lancamento` (categoria "Salários"). **Proposta de schema na Parte 3.**

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
📝 **Sistema:** ⚠️ Implementado com heurística — analisa texto do `motivoBaixa`. Para ficar preciso, **proposta de enum `MotivoBaixa` na Parte 3**.

---

## E. Indicadores sanitários

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

## F. O que observar / fotografar (tabela mestre)

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

# Parte 3 — Decisões de schema para alinhar

Hoje a lógica de cálculo dos 24 indicadores **já está pronta no backend** (rota `GET /api/rebanho/indicadores-embrapa`). Mas **4 indicadores não vão calcular** até decidirmos mudanças no banco. Levar essas perguntas para o Marco Antônio.

## Decisão 1 — Registrar abortos e natimortos? (indicador #14)

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

## Decisão 2 — Categorizar motivo de baixa? (indicadores #21, #22, #23)

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

## Decisão 3 — Cadastrar área de pastagem? (indicadores #17, #18)

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

## Decisão 4 — Cadastrar funcionários? (indicador #19)

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

# Parte 4 — Status técnico no sistema

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

---

*Documento gerado em 2026-06-30 para a visita de 2026-07-01. Para a auditoria técnica completa do código atual, ver `auditoria-indicadores-zootecnicos.md`.*
