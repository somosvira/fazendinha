# DOMAIN.md — Conhecimento de Pecuária Leiteira

> **Documento obrigatório antes de codar qualquer coisa do rebanho.**
> O objetivo é ensinar um desenvolvedor que nunca esteve numa fazenda de leite a entender o domínio bem o suficiente para tomar decisões de implementação sensatas.

Se você só vai mexer em CSS, leia pelo menos as seções 1, 2 e o glossário no fim.

---

## Sumário

1. [Modelo mental do animal](#1-modelo-mental-do-animal)
2. [Ciclo de vida da vaca leiteira](#2-ciclo-de-vida-da-vaca-leiteira)
3. [Lactação](#3-lactação)
4. [Reprodução](#4-reprodução)
5. [Secagem](#5-secagem)
6. [Sanidade](#6-sanidade)
7. [Nutrição](#7-nutrição)
8. [Produção e ordenha](#8-produção-e-ordenha)
9. [Eventos](#9-eventos)
10. [Indicadores zootécnicos](#10-indicadores-zootécnicos)
11. [Lucro por animal](#11-lucro-por-animal)
12. [Categorias e raças](#12-categorias-e-raças)
13. [Caprinos](#13-caprinos)
14. [Glossário](#14-glossário)

---

## 1. Modelo mental do animal

Cada animal no sistema tem **três camadas**:

1. **Identidade** — quem é (número, nome, sexo, espécie, raça, grau de sangue, genealogia, brinco eletrônico, SISBOV, setor).
2. **Histórico** — o que aconteceu com ele (eventos reprodutivos, sanitários, controles leiteiros, pesagens, lactações).
3. **Estado atual derivado** — o que ele *é hoje* (status reprodutivo, DEL, CCS, produção média) — calculado a partir do histórico e armazenado em `ResumoAnimal` como cache.

> **Regra de ouro:** o **histórico é a verdade**. Se o estado derivado divergir, recalculamos. Nunca permitir edição direta do `ResumoAnimal` por humano.

### Sexo e categoria

| Sexo | Categoria (bovino) | Quando |
|---|---|---|
| F | BEZERRA | Do nascimento ao desmame (~6 meses) |
| F | NOVILHA | Após desmame, antes do primeiro parto |
| F | VACA | Após o primeiro parto |
| M | BEZERRO | Do nascimento ao desmame |
| M | TOURO | Macho adulto reprodutor |

A passagem de NOVILHA para VACA é **definida pelo primeiro parto**, não pela idade. A passagem de BEZERRA para NOVILHA é mais flexível (~6 meses ou pelo desmame).

---

## 2. Ciclo de vida da vaca leiteira

```mermaid
flowchart LR
  N[Nascimento] --> B[Bezerra<br/>0 a 6 meses]
  B --> NV[Novilha<br/>6 a 24 meses]
  NV --> CB[Cobertura/IA<br/>~15 meses]
  CB --> PR1[Prenhez<br/>~280 dias]
  PR1 --> P1[1° Parto<br/>~24 meses]
  P1 --> L1[Lactação<br/>~305 dias]
  L1 --> SE[Secagem<br/>~60 dias]
  SE --> P2[Próximo parto]
  P2 --> L2[Próxima lactação]
  L2 --> SE2[...]
```

Uma vaca produtiva passa **a vida toda em ciclos** de:
**Parto → Lactação (305d) → Secagem (60d) → Parto seguinte**.

A **eficiência** dela é medida pela rapidez de fechar esses ciclos sem perder produção ou saúde.

### Vida útil típica

- Primeira IA: ~15 meses
- Primeiro parto: ~24 meses
- Vida produtiva: **3 a 6 lactações** (varia por raça, manejo e saúde)
- Descarte: por baixa produção, problemas reprodutivos, mastite recorrente ou idade

---

## 3. Lactação

**Lactação** é o período em que a vaca produz leite, do **parto** até a **secagem**. A referência padrão é a **lactação de 305 dias**.

### Curva de lactação

A produção diária **não é constante**. Ela segue uma curva característica:

```
Litros/dia
   |
40 |        ___
   |      _/   \_
30 |    _/       \__
   |   /           \___
20 |  /                \____
   | /                      \___
10 |/                           \____ secagem
   +---------------------------------------> dias
   0   30   60   90  120  150  180  210  240  270  305
       ↑               ↑              ↑
       pico         declínio    persistência
```

| Fase | Dias | Característica |
|---|---|---|
| Início | 0–60 | Subida rápida, balanço energético negativo (vaca usa reserva). |
| **Pico** | 60–90 | Maior produção do ciclo. Define o teto da lactação. |
| Declínio | 90–200 | Cai ~5–8% ao mês. **Persistência** é o quanto ela "segura" a queda. |
| Final | 200–305 | Produção baixa, vaca preparando próximo parto. |

### DEL — Dias em Lactação

`DEL = hoje − dataParto` (do parto atual).

Métrica central no manejo. Define:

- O que esperar de produção (curva).
- Se ela já pode/deve ser inseminada.
- Quando vai ser seca.
- Se está atrasando o ciclo (DEL alto + ainda vazia = problema).

### Ordem da lactação

| Ordem | Característica |
|---|---|
| 1ª | Primípara — produz menos (~75% do potencial). |
| 2ª–4ª | Pico de produção da vida da vaca. |
| 5ª+ | Vaca madura; declínio começa em algum ponto. |

### Produção em 305 dias (P305)

Projeção/total da lactação. É a métrica padrão da indústria para comparar vacas.

- **Real:** soma dos controles leiteiros até 305 dias.
- **Projetada:** `produção_média_diária × 305` (estimativa enquanto ainda em curso).

---

## 4. Reprodução

A reprodução é o **coração econômico** da fazenda leiteira: vaca só dá leite depois de parir. Cada dia parada custa.

### Status reprodutivo

| Status | Significado | Cor mental | Ação esperada |
|---|---|---|---|
| **PEV** | Período de Espera Voluntário — pariu há pouco; está apta, mas o manejo ainda espera para começar a inseminar. | Verde/amarelo | Após o PEV terminar, inseminar no próximo cio. |
| **VAZIA** | Não está prenhe e nem inseminada recentemente. | Cinza/atenção | Inseminar! Cada dia parada perde dinheiro. |
| **INSEMINADA** | Foi inseminada e aguarda diagnóstico. | Azul/aguardando | Fazer DG 30d depois. |
| **PRENHE** | DG positivo. | Verde | Manejar até secagem e parto. |

### PEV — Período de Espera Voluntário

Janela após o parto em que **não se insemina** propositalmente, para a vaca se recuperar, voltar a ciclar e atingir balanço energético positivo.

- Padrão: **45–60 dias** (definição da fazenda).
- Antes do PEV terminar: status `PEV`.
- Após o PEV: passa a `VAZIA` (apta).

### Cio

Sinal fisiológico de que a vaca está em fase fértil. Detectado por:

- **Observação visual** (monta, vulva inchada, comportamento).
- **Sensores** (colares de atividade).
- **Sincronização** via protocolos (IATF).

Cio dura ~12 horas. Inseminação deve acontecer ~12 horas depois.

### Inseminação Artificial (IA)

Substitui a monta natural. Usa sêmen congelado de touros selecionados.

- Mais barato e seguro que ter touro na fazenda.
- Permite escolher genética por vaca.
- Requer técnico treinado.

### IATF — Inseminação Artificial em Tempo Fixo

Protocolo hormonal que **sincroniza** o cio de várias vacas, permitindo inseminar todas no mesmo dia, **sem precisar observar cio**.

- Protocolo típico: **11 dias** (CIDR + hormônios em dias D0, D7/8, D9, IA no D11).
- No sistema, registramos qual protocolo, qual dia (`IATF 11d (D0)`, `(D9)`, etc.).
- Usado em rebanhos grandes ou onde detecção de cio é fraca.

### DG — Diagnóstico de Gestação

Confirmação se a inseminação pegou. Métodos:

- **Ultrassom** (28–35 dias pós-IA) — padrão moderno.
- **Palpação retal** (45+ dias) — tradicional.
- **Sanguíneo / leite** (PAGs, 30+ dias) — laboratorial.

Resultado: `POSITIVO` (prenhe) ou `NEGATIVO` (volta para `VAZIA`).

### Gestação

Duração média **bovinos:** 280–285 dias.
Duração média **caprinos:** 150 dias.

Fases:

- 0–60 dias: confirmação, risco maior de perda embrionária.
- 60–210 dias: gestação estável; vaca continua em lactação.
- 210 dias: deve-se **secar** a vaca (interromper a ordenha por ~60 dias).
- 280 dias: parto.

### IEP — Intervalo Entre Partos

`IEP = dias entre dois partos consecutivos`.

- **Ideal:** ~365 dias (uma cria/lactação por ano).
- **Aceitável:** até ~395 dias.
- **Ruim:** > 420 dias — sinaliza problema reprodutivo no rebanho.

IEP **projetado** (rebanho ativo): estimativa do próximo IEP baseada em DEL atual + dias esperados até nova prenhez + 280 de gestação.

### Taxa de prenhez

`taxa_prenhez = prenhes / (prenhes + vazias aptas)`. Indicador-síntese da eficiência reprodutiva da fazenda.

---

## 5. Secagem

**Secagem** = parar de ordenhar a vaca **antes do próximo parto**. Dura ~60 dias.

### Por quê secar?

- Recuperação fisiológica do úbere.
- Regeneração das células secretoras.
- Garantir colostro de qualidade ao bezerro.
- Vaca que não secou produz menos na próxima lactação.

### Quando secar?

`secagem = parto_previsto − 60 dias`.

Outras razões para secar:

- Fim de ciclo natural (305 dias atingidos).
- Mastite incurável.
- Baixa produção (< 5 L/d, secagem precoce).
- Vaca vendida ou descartada.

### Tipos de secagem

| Tipo | Como |
|---|---|
| **Abrupta** | Para de ordenhar de um dia para o outro; só com produção já baixa. |
| **Gradual** | Reduz frequência de ordenha aos poucos. |
| **Com terapia** | Aplicação intramamária de antibiótico de longa ação para prevenir mastite no período seco. |

### Período seco

Os ~60 dias entre secagem e parto. Vaca **não produz leite**, mas continua consumindo e custando.

---

## 6. Sanidade

### CCS — Contagem de Células Somáticas

Número de células de defesa (principalmente leucócitos) por mL de leite. **Indicador principal de saúde do úbere**.

| CCS (mil cél/mL) | Interpretação |
|---|---|
| < 200 | Excelente |
| 200–400 | Aceitável |
| 400–750 | **Alerta** — provável mastite subclínica |
| > 750 | Crítico — provável mastite clínica |

> No sistema: `ccs >= 400` ⇒ flag de **alerta visual**. Tendência "subindo" em 3+ controles ⇒ alerta crítico.

**Importância financeira:**

- Cooperativas pagam **mais por leite com CCS baixo** (bonificação).
- CCS alto reduz produção da própria vaca.
- Pode levar a descarte de leite por contaminação.

### Mastite

Inflamação da glândula mamária. Principal doença econômica do rebanho leiteiro.

#### Por quartos

A vaca tem **4 quartos** (4 glândulas independentes). Cada um pode mastitizar isolado.

Codificação usada no sistema (referência IDEagri):

| Código | Quarto |
|---|---|
| AD ou FD | Anterior Direito (Frontal Direito) |
| AE ou FE | Anterior Esquerdo |
| PD ou TR | Posterior Direito (Traseiro Direito) |
| PE ou TT | Posterior Esquerdo |

#### Tipos

| Tipo | Sinais | Tratamento |
|---|---|---|
| **Subclínica** | Sem sinais visíveis. Detectada por CCS alto, CMT positivo. | Cultivo + antibiótico específico ou descarte. |
| **Clínica leve** | Grumos no leite, leve inchaço. | Intramamário + ordenha frequente. |
| **Clínica moderada/grave** | Inchaço, dor, leite alterado, vaca febril. | Antibiótico sistêmico + intramamário. |
| **Gangrenosa** | Tecido necrosado. Risco de morte. | Emergência veterinária; muitas vezes perda do quarto ou descarte da vaca. |

#### Carência

Tempo após aplicação de medicamento em que o **leite não pode ser entregue** (vai para descarte).

- Tipicamente 72–96h para tratamento de mastite.
- Sistema deve mostrar: "leite em carência até DD/MM" e bloquear contagem desses dias na produção comercial.

### ECC — Escore de Condição Corporal

Avaliação visual da gordura corporal da vaca. Escala **1 a 5** (com meios: 1,5; 2; 2,5; etc.).

| ECC | Interpretação |
|---|---|
| < 2,5 | Magra — problemas reprodutivos prováveis. |
| 2,75–3,25 | **Ideal** para vaca em produção. |
| 3,5 | Vaca seca / pré-parto. |
| > 4 | Sobrepeso — risco metabólico, parto distócico. |

> Algumas escolas usam **1 a 9**. No Brasil, predomina 1 a 5. Padronizar no formulário.

### Outras doenças relevantes

| Doença | Domínio | O que é |
|---|---|---|
| Brucelose | Reprodutiva | Aborto contagioso; controle por vacina obrigatória. |
| Tuberculose | Sanidade | Zoonose; teste anual obrigatório em algumas regiões. |
| Febre aftosa | Sanidade | Vacinação obrigatória (calendário oficial). |
| Cetose | Metabólica | Energia negativa pós-parto. |
| Hipocalcemia (febre vitular) | Metabólica | Cálcio baixo no pós-parto imediato. |
| Retenção de placenta | Reprodutiva | Placenta não sai em 24h; risco de infecção uterina. |
| Metrite | Reprodutiva | Infecção uterina; atrasa próxima IA. |
| Laminite | Locomoção | Inflamação do casco; comum em vacas confinadas. |
| Doença do casco | Locomoção | Sinal pode ser claudicação visível. |

---

## 7. Nutrição

A vaca consome ~3% do peso vivo em matéria seca por dia. Uma vaca de 600 kg come **~18 kg MS/dia**.

### Componentes da dieta

| Tipo | Exemplo | Função |
|---|---|---|
| **Volumoso** | Silagem de milho, capim, feno | Fibra, base do rúmen. |
| **Concentrado** | Farelo de soja, milho moído, ração | Proteína e energia. |
| **Mineral** | Suplemento mineral | Microelementos. |
| **Aditivos** | Tamponantes, leveduras | Saúde ruminal. |

### Indicadores de dieta no sistema

| Campo | O que é |
|---|---|
| `PB%` | Proteína Bruta — % proteína. Vaca em pico precisa de ~17–18%. |
| `ED Mcal/kg` | Energia Digestível por kg de matéria seca. ~1,6–1,7 Mcal/kg para alta produção. |
| `% MS` | Matéria seca do produto (oposto de umidade). Silagem ~30%, ração ~88%. |

### Lotes

Vacas com necessidades parecidas são agrupadas em **lotes** (grupos): por produção, por DEL, por categoria. Cada lote tem **uma dieta**.

- Lote "Alta Produção" — vacas em pico.
- Lote "Média Produção" — vacas em declínio.
- Lote "Pré-parto / Vacas Secas" — dieta de transição.
- Lote "Recria" — novilhas.

### Custo da nutrição

Tipicamente **50–65% do custo total** da fazenda leiteira. É **a maior alavanca de lucratividade**.

---

## 8. Produção e ordenha

### Modos de registro suportados

| Modo | O que é | Quando usar |
|---|---|---|
| `ORDENHA` | Pesagem individual de cada vaca por ordenha (manhã/tarde/noite). | Fazendas com balança de leite individual. Mais granular. |
| `TOTAL_DIARIO` | Total da vaca no dia (soma das ordenhas). | Fazendas que registram só o total. |
| `TANQUE_LOTE` | Litros do tanque (ou do lote) ÷ rateio por vacas em lactação. | Fazendas sem controle individual; resultado é estimativa. |

### Frequência de ordenha

- 2x/dia (manhã + tarde) — padrão.
- 3x/dia — alta produção (+10–15% de produção, +20% de mão de obra).

### Controle leiteiro

Pesagem oficial mensal/quinzenal para indicadores (P305, gordura, proteína, CCS).

### Qualidade do leite

| Parâmetro | Faixa típica |
|---|---|
| Gordura | 3,5–4,2% |
| Proteína | 3,0–3,4% |
| Lactose | 4,5–4,9% |
| CCS | < 400 mil cél/mL |
| CBT (bactérias totais) | < 100 mil UFC/mL |

Cooperativas pagam **bônus** ou **descontos** sobre cada um.

---

## 9. Eventos

Todo o histórico do animal é uma sequência de eventos. No sistema, organizados em 3 famílias.

### Eventos reprodutivos (`EventoReprodutivo`)

| Tipo | Campos relevantes |
|---|---|
| `CIO` | data, observação |
| `INSEMINACAO` | reprodutor, protocolo, tentativa |
| `DIAGNOSTICO` | resultado (POSITIVO/NEGATIVO), data prevista do parto |
| `PARTO` | tipo (normal/distócico/cesárea), nº crias, sexo, escore colostro |
| `SECAGEM` | motivo, produção total da lactação |

### Eventos sanitários (`EventoSanitario`)

| Tipo | Campos relevantes |
|---|---|
| `OCORRENCIA` | doença, dias de tratamento |
| `APLICACAO` | produto, dose, carência, lote |
| `EXAME` | CCS, gordura, proteína |
| `MASTITE` | quarto, severidade, cultivo |
| `VACINA` | produto |

### Eventos de produção (`ControleLeiteiro`, `ProducaoLote`)

Implícitos: cada controle vira ponto na timeline.

### Pesagens (`Pesagem`)

Peso corporal e GMD (Ganho Médio Diário).

---

## 10. Indicadores zootécnicos

### Reprodutivos

| Indicador | Fórmula | Meta |
|---|---|---|
| **IEP** | dias entre dois partos consecutivos | ≤ 395 |
| **Taxa de prenhez** | prenhes ÷ aptas | ≥ 25% |
| **Taxa de concepção** | DG+ ÷ inseminações | ≥ 40% |
| **Taxa de descoberta de cio** | observadas em cio ÷ aptas | ≥ 60% |
| **Idade ao 1º parto** | meses | 22–26 |
| **Dias em aberto** | parto → próxima prenhez | ≤ 120 |
| **Serviços por concepção** | inseminações ÷ prenhez | ≤ 2,5 |

### Produtivos

| Indicador | Fórmula | Meta |
|---|---|---|
| **Produção média/vaca/dia** | total ÷ vacas em lactação | depende do sistema; 25–35 L/d em sistemas intensivos |
| **P305** | produção em 305 dias | depende da raça |
| **Persistência** | produção 2° mês ÷ pico | ≥ 90% |
| **Tendência** | comparação móvel últimos 3 controles | "subindo" / "estavel" / "descendo" |

### Sanitários

| Indicador | Fórmula | Meta |
|---|---|---|
| **CCS médio do rebanho** | média ponderada (controle) | < 400 mil |
| **% vacas com CCS alto** | (ccs ≥ 400) ÷ total em ordenha | < 15% |
| **Taxa de mastite clínica** | casos/mês ÷ vacas em ordenha | < 5%/mês |
| **% descarte por mastite** | descartes_mastite ÷ total descartes | < 30% |

### Composição do rebanho

| Indicador | Fórmula | Meta |
|---|---|---|
| **% vacas em lactação** | em lactação ÷ vacas | ≥ 85% |
| **% vacas secas** | secas ÷ vacas | ≤ 15% |
| **Relação novilhas:vacas** | novilhas ÷ vacas | ~20–25% (renovação) |

---

## 11. Lucro por animal

A pergunta-mãe do produto. Como calculamos:

### Receita

```
receita_lactação = litros_produzidos × preço_do_leite
```

Onde `litros_produzidos` é o acumulado real (até hoje) ou projeção (P305).

### Custo

```
custo_animal = custo_vaca_dia × DEL + custo_sanidade_específico + alocação_indireta
```

- **Custo vaca/dia** vem do consumo de insumos do estoque (últimos 30 dias / vacas em lactação / 30).
- **Custo sanidade específico** = soma de aplicações registradas para o animal × custo do produto + rateio de medicamentos do rebanho.
- **Alocação indireta** (energia, mão de obra, sede, depreciação) — pode entrar como rateio simples.

### Lucro e margem

```
lucro = receita − custo
margem = lucro ÷ receita
```

**Faixas de interpretação:**

| Margem | Tom |
|---|---|
| ≥ 20% | **positivo** — vaca rentável |
| 0–20% | **atenção** — rentável, mas frágil |
| < 0% | **negativo** — está custando dinheiro |

> **Honestidade obrigatória.** A margem deve mostrar valor real, mesmo que negativo. Não decorar.

### Decisão de descarte

Descarte tipicamente justificado quando:

- Margem < 0% em 2 lactações seguidas.
- Produção < 50% da média do rebanho na mesma ordem de lactação.
- Mastite crônica em ≥ 2 quartos.
- IEP > 450 dias com falha em 3+ IAs.

---

## 12. Categorias e raças

### Categorias bovinas

`BEZERRA`, `NOVILHA`, `VACA`, `BEZERRO`, `TOURO`.

### Categorias caprinas

`CABRITA`, `CABRA`, `CABRITO`, `BODE`.

### Raças bovinas leiteiras suportadas

| Código | Raça | Espécie |
|---|---|---|
| HO | Holandês | Bovino |
| GO | Gir Leiteiro | Bovino |
| GL | Girolando | Bovino |
| JE | Jersey | Bovino |
| PS | Pardo Suíço | Bovino |
| SI | Sindi | Bovino |
| GU | Guzerá | Bovino |
| NE | Nelore | Bovino |
| AN | Angus | Bovino |
| BH | Brahman | Bovino |
| SN | Senepol | Bovino |
| TB | Tabapuã | Bovino |
| BG | Brangus | Bovino |
| CR | Caracu | Bovino |

### Raças caprinas leiteiras suportadas

| Código | Raça | Espécie |
|---|---|---|
| SA | Saanen | Caprino |
| PA | Parda Alpina | Caprino |
| AB | Anglo-Nubiana | Caprino |

### Grau de sangue

Quando há cruzamento (animal mestiço), expressamos em **frações**:
`1/2 HO × GIR`, `5/8 HO`, `7/8 HO`, `9/16 GL`.

No sistema: campo texto livre `grauSangue` no `Animal`. O componente padroniza a entrada.

### Genealogia

`Animal.maeId` e `Animal.paiId` quando o reprodutor está cadastrado. Se não, `Animal.paiNome` texto livre (sêmen importado).

---

## 13. Caprinos

O sistema suporta **caprinos** desde a migration 20260625220000. Equivalências:

| Conceito bovino | Equivalente caprino |
|---|---|
| Vaca | Cabra |
| Novilha | Cabrita (após desmame, antes de parir) |
| Bezerra | Cabrita (até o desmame) |
| Touro | Bode |
| Bezerro | Cabrito |

Diferenças fisiológicas relevantes:

- **Gestação:** ~150 dias (vs ~280 bovinos).
- **Produção:** ~3–5 L/dia (vs 25–40 L/dia em bovinos).
- **CCS:** referência **mais alta** que em bovinos; > 1.000 mil cél/mL é tolerado em alguns mercados.
- **Lactação:** ~270–290 dias.
- **Múltiplos partos:** comum (gêmeos, trigêmeos).

---

## 14. Glossário

| Termo | Significado |
|---|---|
| **DEL** | Dias em Lactação. Tempo desde o parto até hoje. |
| **CCS** | Contagem de Células Somáticas. Indicador de saúde do úbere. |
| **CBT** | Contagem Bacteriana Total no leite. |
| **IEP** | Intervalo Entre Partos. Ideal 365d, aceitável até 395d. |
| **IATF** | Inseminação Artificial em Tempo Fixo. Protocolo hormonal. |
| **IA** | Inseminação Artificial. |
| **DG** | Diagnóstico de Gestação. Positivo = prenhe. |
| **PEV** | Período de Espera Voluntário pós-parto. |
| **P305** | Produção em 305 dias da lactação. |
| **ECC** | Escore de Condição Corporal (1–5). |
| **MS** | Matéria Seca. Componente nutricional. |
| **PB** | Proteína Bruta (% da dieta). |
| **ED** | Energia Digestível (Mcal/kg). |
| **GMD** | Ganho Médio Diário (kg/dia). |
| **SISBOV** | Sistema Brasileiro de Identificação Individual de Bovinos. |
| **Brinco eletrônico** | RFID para identificação automatizada. |
| **Quarto** | Cada uma das 4 glândulas mamárias da vaca. |
| **Cio** | Sinal de fertilidade da fêmea. Dura ~12h. |
| **Monta** | Cobertura natural (touro). |
| **Sêmen** | Material reprodutivo masculino, congelado/comercializado. |
| **CIDR** | Implante hormonal usado em protocolos IATF. |
| **Lactação** | Período de produção de leite, do parto à secagem. |
| **Secagem** | Interrupção da ordenha, ~60d antes do próximo parto. |
| **Período seco** | Os ~60 dias entre secagem e parto. |
| **Cooperativa** | Comprador padrão do leite; remunera por volume + qualidade. |
| **Colostro** | Primeiro leite pós-parto. Imunidade do bezerro. |
| **Brix do colostro** | % sólidos no colostro. ≥ 22 = bom, ≥ 24 = ótimo. |
| **Carência** | Dias em que o leite não pode ser comercializado após medicamento. |
| **Persistência** | Capacidade da vaca manter produção pós-pico. |
| **Pico** | Maior produção diária da lactação (geralmente entre dia 60–90). |
| **Tanque** | Reservatório refrigerado onde o leite é armazenado até a coleta. |
| **Distocia** | Parto difícil (apresentação irregular, cesárea, ajuda mecânica). |
| **Aborto** | Perda da gestação após 42 dias. |
| **Cetose** | Doença metabólica pós-parto (energia negativa). |
| **Mastite** | Inflamação da mamária; principal doença econômica leiteira. |
| **Subclínica** | Sem sinais aparentes (detectada por CCS, CMT). |
| **Clínica** | Sinais visíveis (grumos, inchaço, dor). |
| **CMT** | Califórnia Mastite Teste — reagente para CCS qualitativo no curral. |
| **Reposição** | Novilha que entra no plantel substituindo vaca descartada. |
| **Descarte** | Saída da vaca do plantel (venda, abate, morte). |
| **Recria** | Fase de criação da bezerra até 1° parto. |
| **Setor** | Localização física na propriedade (curral, piquete, lote). |
| **Lote / Grupo** | Conjunto de animais sob mesma dieta/manejo. |
| **TMR** | Total Mixed Ration — ração total misturada. |
| **Confinamento** | Sistema de produção onde as vacas ficam em estábulo o tempo todo. |
| **Semiconfinamento** | Pasto + concentrado no curral. |
| **Pasto** | Sistema extensivo, base forrageira. |
| **Free stall** | Estábulo com baias individuais livres. |
| **Compost barn** | Estábulo com cama de serragem compostada. |

---

## Vocabulário dos cadastros financeiros

- **Conta bancária:** disponibilidade mantida numa instituição; pode ser corrente, poupança ou de pagamento. **Caixa físico:** dinheiro em espécie sob responsabilidade da fazenda. Dinheiro é forma de pagamento, não outro tipo de conta.
- **Aplicação financeira:** cadastro básico de saldo e instituição; este escopo não inclui rentabilidade, resgates automáticos nem conciliação de investimentos.
- **Papéis do parceiro:** a mesma pessoa/empresa pode ser cliente, fornecedor, prestador de serviço, funcionário/colaborador, sócio/proprietário ou outro. Esses papéis não são contas de acesso nem permissões. Sócio/proprietário identifica a contraparte de aportes/retiradas; não torna o parceiro dono do sistema.
- **Prestador de serviço:** contraparte de uma operação de serviço. Não pressupõe venda de produtos; se também fornecer materiais, marcar fornecedor.
- **Fornecedores do produto:** catálogo opcional de parceiros que normalmente fornecem um produto. Um produto pode não ter fornecedor cadastrado e uma compra pode usar outro fornecedor; o fornecedor efetivo permanece registrado na operação, preservando o histórico do movimento de estoque.
- **Produto universal:** o cadastro guarda só identidade, categoria, unidade padronizada, se controla estoque, mínimo, centros e fornecedores. O que o produto *faz* no sistema vem da categoria (uso sanitário, nutricional ou agrícola, marcados pelo usuário). O *preço* vem das compras: as saídas de estoque são valoradas pelo custo médio ponderado das entradas daquele produto no sítio; venda e devolução também saem a custo médio, nunca ao preço de venda.
- **Unidade:** lista fixa (un, kg, g, t, L, mL, sc, dose, cx, m, ha) com conversão dentro da mesma base (g↔kg↔t, mL↔L). A dose de uma aplicação agrícola é convertida para a unidade do produto; bases diferentes são recusadas.
- **Centros de custo do produto:** onde o produto pode ser usado (nenhum, um ou vários). É a "receita" de classificação: ao escolher o produto num item de operação, categoria (e classificação) e o centro único vêm preenchidos. Não existe mais "setor" de produto.
- **Centro de custo por operação ou por item:** uma operação pode ter um centro único (todos os itens herdam) ou centros por item (nota mista). O centro efetivo de cada parte é o do item ou, na falta, o da operação; relatórios e custos por atividade leem por parte. Item não estocável (frete, serviço) precisa de centro efetivo; item estocável pode ficar sem, porque o custo dele vai para a atividade no consumo.
- **Custo financeiro × alocação operacional:** o custo financeiro é lido pela compra (por item). As saídas de estoque (dieta, sanidade, aplicação agrícola, ajuste) registram para qual centro o consumo foi, e isso alimenta custos operacionais (custo vaca/dia, custo por talhão) sem entrar nos relatórios financeiros — evita contar duas vezes.
- **Estoque único:** Pecuária e Plantio veem o mesmo estoque, filtrado por centro de custo. Aplicações e adubações com produto do estoque dão baixa automática (dose × área do talhão).
- **Preferência de pagamento:** sugestão opcional de forma, condição e prazos em dias. Pode ser ignorada ou alterada em cada operação; nunca obriga uma forma de liquidação.

## Referências cruzadas

- [`PRODUCT.md`](./PRODUCT.md) — por que esses conceitos importam ao produto.
- [`METRICS.md`](./METRICS.md) — fórmulas exatas e janelas temporais usadas no sistema.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — como esses conceitos viram modelos Prisma.
- [`AI_RULES.md`](./AI_RULES.md) — como qualquer IA deve usar este vocabulário.
