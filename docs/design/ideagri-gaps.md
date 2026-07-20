# IDEagri — o que falta (checklist de paridade)

**O que é.** Lista enxuta e acionável do que o **IDEagri tem e o Fazendinha ainda não tem** (ou tem parcial). Derivado de [`ideagri-catalogo-features.md`](./ideagri-catalogo-features.md) — aquele é o catálogo completo tela-a-tela com status; **este** é só a fila de lacunas em formato de checkbox, para bater o olho e decidir a próxima fatia.

**Como ler.**
- `[ ]` = ainda não temos (⬜ no catálogo).
- `[~]` = temos parcial (🟡 no catálogo) — falta completar.
- Marcar `[x]` quando entregar, e refletir no catálogo.
- **Dado 777** = há dado real na Fazenda Rio Novo para validar já (número = linhas na tabela-fato do IDEagri; `vazio` = replicável, mas sem dado para testar).

> **Fora de escopo permanente** (não entram aqui): seção 11 do catálogo (encanamento interno do IDEagri — backup, exportadores, consulta SQL, integrações de colar/parlor) e o **financeiro** (nossa fonte é o Excel real do BPO, não o IDEagri).

Atualizado em **2026-07-20** (pós-PRs #170–#192 — prioridade **alta**, **média** e as **5 pequenas da baixa** fechadas; só restam as **2 grandes** da baixa: construtor de relatórios e consulta ABCZ).

---

## 🔥 Prioridade alta — tem dado real na 777 para validar já

**Todas entregues (PRs #170–#174) — ver "Já entregue" abaixo.** As próximas fatias saem da lista de prioridade média.

- [x] **Exames ginecológicos** (Reprodução · **248**) — evento `EXAME_GINECOLOGICO` + dicionário de achados + worklist "precisa de exame". **PR #170** (+ worklist exposta no #171).
- [x] **Programação IATF/TETF por lote/data** (Reprodução · **67 + 418**) — aplica o protocolo do catálogo (#163) a um lote inteiro com calendário D0/D7/D9/D11. **PR #171**.
- [x] **Movimentação entre grupos/setores como fato histórico** (Rebanho · **1504 + 289**) — `MovimentacaoAnimal` ("onde a vaca esteve") no cockpit. **PR #172**.
- [x] **Análise de leite — tela dedicada** (Produção/Qualidade · **467**) — tendência de CCS, distribuição por faixa, piores CCS. **PR #173**.
- [x] **Princípio ativo (composição de medicamento)** (Estoque/Sanidade · **665 / 12445**) — `PrincipioAtivo` + `ProdutoPrincipioAtivo`; base carência/antibiótico. **PR #174**.

## 🟨 Prioridade média — TODAS ENTREGUES (PRs #176–#186)

**Bloco de prioridade média zerado (2026-07-20).** As próximas fatias saem da prioridade baixa.

- [x] **Agenda de eventos / manejos futuros** (Sanidade/Repro) — calendário unificado (vacinas + próximas etapas IATF de lote), atrasados destacados. **PR #183**.
- [x] **Protocolo sanitário / aplicação por animal** (Sanidade) — catálogo D0/D+n + aplicação com agenda derivada (espelha IATF). **PR #184**.
- [x] **Biblioteca de reprodutores + central de sêmen + índices genéticos** (Genética · **65 + 25 + 271**) — `Reprodutor` + `CentralSemen` com PTAs. **PR #185**.
- [x] **Recomendação/medida de acasalamento** (Genética) — motor de cruzamento dirigido (mérito genético + evita consanguinidade). **PR #186**.
- [x] **Grau de cruzamento** (Genética · 32) — grau de sangue exibido no cockpit + composição do rebanho por grau. **PR #177**.
- [x] **Alteração coletiva de animais (bulk)** (Rebanho) — mover N animais de grupo/setor de uma vez (grava movimentações). **PR #180**.
- [x] **Seleção/filtro de animais salvo** (Rebanho · 52) — `FiltroAnimal` (status/grupo/setor/categoria/busca) + aplicar. **PR #181**.
- [x] **Desmama/desaleitamento como evento** (Rebanho) — evento `DESMAME` na timeline (peso opcional). **PR #178**.
- [x] **Escore de teto** (Sanidade) — `ExameQuarto.escoreTeto` (1–4, hiperqueratose) no mapa de úbere. **PR #179**.
- [x] **Indução de lactação** (Produção) — `LACTACAO.INDUZIDA` exposta + toggle. **PR #176**.
- [x] **Tanque + análise de tanque** (Produção/Qualidade) — `Tanque` + `AnaliseTanque` (CCS/CBT/tendência). **PR #182**.

## 🧊 Prioridade baixa — grande, sem dado, ou diferencial futuro

**As 5 pequenas/self-contained foram entregues (PRs #188–#192).** Sobram só as **2 grandes**, deixadas de fora de propósito:

- [ ] **Construtor de relatórios / dashboards montáveis** (Análise · `RELATORIO` 165, `CAMPORELATORIO` 572) — usuário monta colunas/filtros/SQL. Diferencial de revenda, mas grande. Nossos painéis são fixos (mais bonitos). **Fora de escopo por ora.**
- [ ] **Correlação/consulta ABCZ** (Genética · —) — integração com a associação de raça (registro genealógico oficial + comunicações). **Fora de escopo — provavelmente permanente.** A ABCZ registra **zebu de elite / puro de origem**; a Rio Novo é **laticínio comercial** de Holandês (taurino, fora da ABCZ) / Girolando. Só agrega valor a quem cria animais registrados p/ venda de genética — não a um rebanho leiteiro comercial. As partes úteis (composição racial, genealogia mãe/pai) já estão prontas. Se um dia fizer sentido, o candidato p/ leite seria Girolando/PMGZ ou controle leiteiro oficial, não ABCZ pura.
- [x] **Rebanho quantitativo (relatório clássico)** (Rebanho · —) — efetivo por categoria × faixa etária. **PR #188**.
- [x] **Composição de produto (ração formulada)** (Estoque · —) — receita/composição de ração (ingredientes × proporção %). **PR #189**.
- [x] **Lote de produto / validade + múltiplos locais de armazenamento** (Estoque · —) — `LoteProduto` (código/validade/local) + `LocalArmazenamento`. **PR #190**.
- [x] **Clima / registro de chuva** (Análise · vazio) — `RegistroChuva` (pluviômetro) + acumulado mensal. **PR #191**.
- [x] **Ajuste de U.A. de referência** (Nutrição · —) — conversão efetivo → UA / UA/ha (reusa pesos-referência de Parâmetros). **PR #192**.

---

## Já entregue (paridade alcançada) — referência

Marcos recentes que fecharam gaps do IDEagri (ver catálogo para a lista completa de ✅):

- [x] **Exames ginecológicos** (#170) — evento `EXAME_GINECOLOGICO` + achados + worklist "precisa de exame" (exposta no #171).
- [x] **Programação IATF por lote/data** (#171) — `ProgramacaoIATFLote` aplica o protocolo (#163) a um lote com calendário D0/D7/D9/D11.
- [x] **Movimentação lote/setor como fato histórico** (#172) — `MovimentacaoAnimal` no cockpit ("onde a vaca esteve").
- [x] **Análise de leite (qualidade)** (#173) — tendência de CCS, distribuição por faixa e piores CCS na aba Produção.
- [x] **Princípio ativo + composição de medicamento** (#174) — `PrincipioAtivo` + `ProdutoPrincipioAtivo`; base carência/antibiótico.
- [x] **Prioridade média completa (#176–#186):** indução de lactação (#176), grau de cruzamento (#177), desmame como evento (#178), escore de teto (#179), alteração coletiva/bulk (#180), filtro de animais salvo (#181), tanque + análise de tanque (#182), agenda de manejos (#183), protocolo sanitário (#184), biblioteca de reprodutores (#185), recomendação de acasalamento (#186).
- [x] **5 pequenas da prioridade baixa (#188–#192):** rebanho quantitativo (#188), composição de ração formulada (#189), lote/validade + locais de armazenamento (#190), clima/registro de chuva (#191), ajuste de U.A. de referência (#192). Restam só as 2 grandes (construtor de relatórios, ABCZ), fora de escopo de propósito.
- [x] **CMT / mastite por quarto** (#168) — `ExameQuarto` por teta, mapa de úbere, quarto crônico → sugestão.
- [x] **Histórico de lactações** (#146–147) + **pico/persistência** (#158) + **curva de lactação** (#154).
- [x] **Correção 305 oficial** (#151–152).
- [x] **Catálogo IATF configurável** (#163).
- [x] **Vacinação agendada com lembrete** (#160).
- [x] **Secagem** — retorno à fila (#150) + work-list "a secar" (#156).
- [x] **Carência de leite ativa** na produção (#153).
