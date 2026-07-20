# IDEagri — o que falta (checklist de paridade)

**O que é.** Lista enxuta e acionável do que o **IDEagri tem e o Fazendinha ainda não tem** (ou tem parcial). Derivado de [`ideagri-catalogo-features.md`](./ideagri-catalogo-features.md) — aquele é o catálogo completo tela-a-tela com status; **este** é só a fila de lacunas em formato de checkbox, para bater o olho e decidir a próxima fatia.

**Como ler.**
- `[ ]` = ainda não temos (⬜ no catálogo).
- `[~]` = temos parcial (🟡 no catálogo) — falta completar.
- Marcar `[x]` quando entregar, e refletir no catálogo.
- **Dado 777** = há dado real na Fazenda Rio Novo para validar já (número = linhas na tabela-fato do IDEagri; `vazio` = replicável, mas sem dado para testar).

> **Fora de escopo permanente** (não entram aqui): seção 11 do catálogo (encanamento interno do IDEagri — backup, exportadores, consulta SQL, integrações de colar/parlor) e o **financeiro** (nossa fonte é o Excel real do BPO, não o IDEagri).

Atualizado em **2026-07-19** (pós-PR #168).

---

## 🔥 Prioridade alta — tem dado real na 777 para validar já

- [ ] **Exames ginecológicos** (Reprodução · dado 777: **248**) — eventos clínicos reprodutivos por animal (útero/ovário/resultado) no cockpit + work-list "precisa de exame". Enum `EXAME_GINECOLOGICO` + dicionário de resultados. *Próximo candidato natural.*
- [~] **Programação IATF/TETF por lote/data** (Reprodução · **67 + 418**) — o catálogo de protocolo já existe (#163); falta **aplicar o protocolo a um lote** com calendário de etapas D0/D7/D9/D11.
- [ ] **Movimentação entre grupos/setores como fato histórico** (Rebanho · **1504 + 289**) — hoje temos setor/grupo atual por animal; falta o histórico de trocas ("onde a vaca esteve") no cockpit.
- [~] **Análise de leite — tela dedicada** (Produção/Qualidade · **467**) — CCS/gordura/proteína já entram como evento; falta tela de qualidade com tendência de CCS ao longo do tempo.
- [ ] **Princípio ativo (composição de medicamento)** (Estoque/Sanidade · **665 / 12445**) — `PRINCIPIOATIVO` + `PRODUTOPRINCIPIOATIVO`; base para carência/antibiótico. (A carência de leite já está ativa via #153; falta a base estruturada.)

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

- [x] **CMT / mastite por quarto** (#168) — `ExameQuarto` por teta, mapa de úbere, quarto crônico → sugestão.
- [x] **Histórico de lactações** (#146–147) + **pico/persistência** (#158) + **curva de lactação** (#154).
- [x] **Correção 305 oficial** (#151–152).
- [x] **Catálogo IATF configurável** (#163).
- [x] **Vacinação agendada com lembrete** (#160).
- [x] **Secagem** — retorno à fila (#150) + work-list "a secar" (#156).
- [x] **Carência de leite ativa** na produção (#153).
