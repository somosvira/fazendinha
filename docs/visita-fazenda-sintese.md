# Visita à Fazenda Rio Novo — Síntese de bolso

**Para:** Felipe (em campo, tempo curto)
**Objetivo:** destravar os indicadores zootécnicos Embrapa que ainda não calculam, validar fontes de dados e voltar com material concreto.

> Versão extensa: [visita-fazenda-checklist-zootecnico.md](./visita-fazenda-checklist-zootecnico.md)
> Auditoria técnica: [auditoria-indicadores-zootecnicos.md](./auditoria-indicadores-zootecnicos.md)

---

## 🔴 Os 4 bloqueadores — sem essas respostas, 4 indicadores não calculam

Estes não rodam hoje. Volte com as 4 respostas.

| # | Bloqueio | Pergunta de ouro para o Marco Antônio | O que decidir |
|---|---|---|---|
| **#14** | Aborto e natimorto | "Quer ter relatório de aborto e natimorto, ou esse dado é pequeno demais?" | Adicionar enum `ABORTO` + campos `criasVivas/Natimortas` no parto |
| **#17/18** | Área de pastagem (UA/ha e L/ha/ano) | "Quer ver litros por hectare/ano? Quantos hectares de pastagem o gado leiteiro ocupa hoje?" | Adicionar `areaPastagemHa` (Grupo) ou ligar a `Piquete` |
| **#19** | Mão de obra (L/funcionário/dia) | "Quer acompanhar produtividade por funcionário? Posso cadastrar a equipe?" | Criar `Funcionario` (nome, função, integral/parcial) |
| **#21/22/23** | Motivo de baixa estruturado | "Quando você dá baixa, esses 10 motivos cobrem? (venda, descarte mastite/fertil/prod/idade, morte doença/parto/acidente, transferência)" | Adicionar enum `MotivoBaixa` ao `Animal` |

---

## 🟡 As 4 validações — confirmar se o dado existe na rotina

Cálculo existe; só não sei se o dado *chega* nele.

1. **Controle leiteiro mensal individual?** (sem isso, persistência #3 não calcula) — Pergunta: "Vocês pesam cada vaca uma vez por mês? Em papel, planilha ou app? Quem registra?"
2. **`numCrias` separa vivos x natimortos?** (afeta #13) — Pergunta: "Quando registra parto, anota só o total ou separa vivo/morto?"
3. **Saída de ração é lançada no estoque?** (sem isso, #20 leite/concentrado não calcula) — Pergunta: "Como vocês baixam a ração quando vai para o cocho? Tem alguém anotando, ou só entra a NF e some?"
4. **Eventos reprodutivos (IA, DG, parto) onde são anotados?** — Pergunta: "Cadernos? Planilha? Quem é a fonte da verdade?"

---

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

---

## ❓ As 10 perguntas de ouro (se só der tempo para essas)

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

---

## 📋 Para voltar com (resumo do que enche a mala)

- [ ] Mapa/croqui da pastagem (foto ou cópia)
- [ ] Lote de tickets do leite (foto)
- [ ] Foto da última NF de ração
- [ ] Foto de 4-8 páginas do caderno reprodutivo
- [ ] Foto do caderno do veterinário
- [ ] Lista de funcionários do leite (nome + função + integral/parcial)
- [ ] Respostas das 4 decisões de schema
- [ ] Nome do laticínio + tabela de bonificação
- [ ] Nome do veterinário responsável (+ se tem registros próprios para puxar)

---

## 🎯 Como conduzir a conversa (sugestão de roteiro de 1h)

1. **Tour 20 min** — sala de ordenha, bezerreiro, depósito de ração, piquetes. Foto durante o tour.
2. **Cadernos 15 min** — sentar com Marco Antônio e ver os registros: reprodução, veterinário, leite. Fotografar.
3. **As 4 decisões 15 min** — abrir uma a uma, mostrar o "antes/depois" que aparece no sistema se ele topar.
4. **Pendências e próximos passos 10 min** — combinar como ele vai mandar os tickets do mês, quem é o vet, quando volta para validar.

**Princípio:** chegar com perguntas específicas (não "me conta como vocês trabalham"). Mostrar que você já conhece o sistema dele e está fechando lacunas pontuais.
