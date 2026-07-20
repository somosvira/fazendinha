# IDEagri — o que falta (checklist de paridade)

**O que é.** Lista enxuta e acionável do que o **IDEagri tem e o Fazendinha ainda não tem** (ou tem parcial). Derivado de [`ideagri-catalogo-features.md`](./ideagri-catalogo-features.md) — aquele é o catálogo completo tela-a-tela com status; **este** é só a fila de lacunas em formato de checkbox, para bater o olho e decidir a próxima fatia.

**Como ler.**
- `[ ]` = ainda não temos (⬜ no catálogo).
- `[~]` = temos parcial (🟡 no catálogo) — falta completar.
- Marcar `[x]` quando entregar, e refletir no catálogo.
- **Dado 777** = há dado real na Fazenda Rio Novo para validar já (número = linhas na tabela-fato do IDEagri; `vazio` = replicável, mas sem dado para testar).

> **Fora de escopo permanente** (não entram aqui): seção 11 do catálogo (encanamento interno do IDEagri — backup, exportadores, consulta SQL, integrações de colar/parlor) e o **financeiro** (nossa fonte é o Excel real do BPO, não o IDEagri).

Atualizado em **2026-07-20** (pós-PRs #170–#174 — bloco de prioridade alta zerado).

---

## 🔥 Prioridade alta — tem dado real na 777 para validar já

**Todas entregues (PRs #170–#174) — ver "Já entregue" abaixo.** As próximas fatias saem da lista de prioridade média.

- [x] **Exames ginecológicos** (Reprodução · **248**) — evento `EXAME_GINECOLOGICO` + dicionário de achados + worklist "precisa de exame". **PR #170** (+ worklist exposta no #171).
- [x] **Programação IATF/TETF por lote/data** (Reprodução · **67 + 418**) — aplica o protocolo do catálogo (#163) a um lote inteiro com calendário D0/D7/D9/D11. **PR #171**.
- [x] **Movimentação entre grupos/setores como fato histórico** (Rebanho · **1504 + 289**) — `MovimentacaoAnimal` ("onde a vaca esteve") no cockpit. **PR #172**.
- [x] **Análise de leite — tela dedicada** (Produção/Qualidade · **467**) — tendência de CCS, distribuição por faixa, piores CCS. **PR #173**.
- [x] **Princípio ativo (composição de medicamento)** (Estoque/Sanidade · **665 / 12445**) — `PrincipioAtivo` + `ProdutoPrincipioAtivo`; base carência/antibiótico. **PR #174**.

## 🟨 Prioridade média — valor de produto, mas sem dado real (replicar)

- [~] **Agenda de eventos / manejos futuros** (Sanidade/Repro · vazio) — vacinação agendada já feita (#160); falta o **calendário unificado** de todos os manejos (exames, protocolos) → work-lists proativas.
- [ ] **Protocolo sanitário / aplicação por animal** (Sanidade · 9 cat. / 0) — catálogo de 9 protocolos existe no IDEagri; replicar como cadastro + calendário.
- [ ] **Biblioteca de reprodutores + central de sêmen + índices genéticos** (Genética · **65 + 25 + 271**) — catálogo de touros com PTAs/índices genômicos; base para recomendação de acasalamento.
- [ ] **Recomendação/medida de acasalamento** (Genética · vazio) — motor de cruzamento dirigido (evita consanguinidade, busca ganho genético). Depende da biblioteca de reprodutores.
- [ ] **Grau de cruzamento** (Genética · 32) — grau de sangue (Holandês/Gir etc.); complementa a composição racial que já temos.
- [ ] **Alteração coletiva de animais (bulk)** (Rebanho · —) — editar N animais de uma vez. Útil na operação.
- [~] **Seleção/filtro de animais salvo** (Rebanho · 52) — temos filtros simples; IDEagri tem construtor de filtros salvos.
- [~] **Desmama/desaleitamento como evento** (Rebanho · —) — hoje é proxy por categoria; falta evento/status DESMAME no schema.
- [~] **Escore de teto** (Sanidade · vazio) — o estado por quarto (#168) já modela saúde de úbere; falta o escore de teto formal (hiperqueratose).
- [ ] **Indução de lactação** (Produção · —) — flag `LACTACAO.INDUZIDA`.
- [ ] **Tanque + análise de tanque** (Produção/Qualidade · vazio) — cadastro/gestão de tanques de resfriamento + qualidade do leite bulk.

## 🧊 Prioridade baixa — grande, sem dado, ou diferencial futuro

- [ ] **Construtor de relatórios / dashboards montáveis** (Análise · `RELATORIO` 165, `CAMPORELATORIO` 572) — usuário monta colunas/filtros/SQL. Diferencial de revenda, mas grande. Nossos painéis são fixos (mais bonitos).
- [ ] **Correlação/consulta ABCZ** (Genética · —) — integração com associação de raça (registro genealógico).
- [~] **Lote de produto / validade + múltiplos locais de armazenamento** (Estoque · —) — temos `loteProduto` em eventos e setor no estoque; falta gestão de lotes/validade e locais físicos múltiplos.
- [ ] **Composição de produto (ração formulada)** (Estoque · —) — receita/composição de ração.
- [ ] **Rebanho quantitativo (relatório clássico)** (Rebanho · —) — efetivo por categoria/idade ao longo do tempo. Temos KPIs no Dashboard; falta o relatório histórico.
- [ ] **Clima / registro de chuva** (Análise · vazio) — estação meteorológica.
- [ ] **Ajuste de U.A. de referência** (Nutrição · —) — unidade animal para conversão de lotação.

---

## Já entregue (paridade alcançada) — referência

Marcos recentes que fecharam gaps do IDEagri (ver catálogo para a lista completa de ✅):

- [x] **Exames ginecológicos** (#170) — evento `EXAME_GINECOLOGICO` + achados + worklist "precisa de exame" (exposta no #171).
- [x] **Programação IATF por lote/data** (#171) — `ProgramacaoIATFLote` aplica o protocolo (#163) a um lote com calendário D0/D7/D9/D11.
- [x] **Movimentação lote/setor como fato histórico** (#172) — `MovimentacaoAnimal` no cockpit ("onde a vaca esteve").
- [x] **Análise de leite (qualidade)** (#173) — tendência de CCS, distribuição por faixa e piores CCS na aba Produção.
- [x] **Princípio ativo + composição de medicamento** (#174) — `PrincipioAtivo` + `ProdutoPrincipioAtivo`; base carência/antibiótico.
- [x] **CMT / mastite por quarto** (#168) — `ExameQuarto` por teta, mapa de úbere, quarto crônico → sugestão.
- [x] **Histórico de lactações** (#146–147) + **pico/persistência** (#158) + **curva de lactação** (#154).
- [x] **Correção 305 oficial** (#151–152).
- [x] **Catálogo IATF configurável** (#163).
- [x] **Vacinação agendada com lembrete** (#160).
- [x] **Secagem** — retorno à fila (#150) + work-list "a secar" (#156).
- [x] **Carência de leite ativa** na produção (#153).
