# IDEagri — o que falta (checklist de paridade)

**O que é.** Lista enxuta e acionável do que o **IDEagri tem e o Fazendinha ainda não tem** (ou tem parcial). Derivado de [`ideagri-catalogo-features.md`](./ideagri-catalogo-features.md) — aquele é o catálogo completo tela-a-tela com status; **este** é só a fila de lacunas em formato de checkbox, para bater o olho e decidir a próxima fatia.

**Como ler.**
- `[ ]` = ainda não temos (⬜ no catálogo).
- `[~]` = temos parcial (🟡 no catálogo) — falta completar.
- Marcar `[x]` quando entregar, e refletir no catálogo.
- **Dado 777** = há dado real na Fazenda Rio Novo para validar já (número = linhas na tabela-fato do IDEagri; `vazio` = replicável, mas sem dado para testar).

> **Fora de escopo permanente** (não entram aqui): seção 11 do catálogo (encanamento interno do IDEagri — backup, exportadores, consulta SQL, integrações de colar/parlor) e o **financeiro** (nossa fonte é o Excel real do BPO, não o IDEagri).

Atualizado em **2026-07-24** após auditoria direta do `DADOS777.FDB`. Os PRs #170–#192 entregaram boas fundações, mas **não** equivalem a paridade funcional integral: import, semântica avançada, IATF/TETF, TE/FIV, genética e parto ainda têm lacunas. A fonte e o gate de aceite estão em [`reproducao-paridade-ideagri.md`](./reproducao-paridade-ideagri.md).

---

## 🔥 Prioridade alta — paridade reprodutiva validável na 777

- [~] **Fidelidade do histórico IA / cobrição / TE** (`REPRODUCAO`: **832 / 61 / 146**) — o transformador atual colapsa os três em `INSEMINACAO`. Separar fatos, manter id de origem e reconciliar por animal/data.
- [~] **Diagnóstico reprodutivo** (**1843**) — o evento básico existe; completar campos/métodos e validar efeitos contra a tela oficial.
- [~] **Parto** (**352**) — completar 7 tipos, 4 auxílios, aborto/natimorto, criação/vínculo das crias e transição de categoria/lactação.
- [~] **Exames ginecológicos** (**248 + 44 resultados**) — evento/worklist existem; importar histórico e dicionário oficial sem reduzir 44 resultados a 9.
- [~] **Programação IATF/TETF** (**74 + 466**) — agenda D0/D+n existe; importar dados e completar TETF, implante/perda, estímulo, CIDR, produtos, doses e execução.
- [ ] **Aptidão e aptidão automática de novilhas** — duas telas oficiais sem equivalente histórico/operacional.
- [ ] **Coleta FIV/TE** (**7**) — doadora, reprodutor, técnico, oócitos e embriões por qualidade/estágio.
- [ ] **Receber coletas / dados IATF** (`DADOSCOLETA`: **4**) — reproduzir sincronização/mobile ou obter N/A assinado.

As entregas de movimentação, análise de leite e princípio ativo continuam válidas em seus domínios, mas não fecham os gaps acima.

## 🟨 Prioridade média — genética, insumos e operação em escala

- [~] **Biblioteca de reprodutores + central de sêmen** (**67 + 25**) — CRUD reduzido existe; falta import e vínculo estruturado com os eventos.
- [ ] **Tipo/associação/estoque de sêmen** (**3 tipos**) — doses, lotes, localização e baixa atômica na IA.
- [ ] **Catálogos genéticos completos** (**271 indicadores + 20 marcadores + 15 caseínas**) — importar provas, valores e pedigree.
- [~] **Recomendação/medida/medidas combinadas de acasalamento** — ranking simples existe; faltam fórmulas, pedigree/endogamia e plano equivalente.
- [ ] **Pool de doadoras** — tela e model faltam; validar com fixture porque a 777 está vazia.
- [~] **Agenda de manejos** — mostra vacinas e próxima etapa IATF; falta execução real, exames, TE/FIV e demais manejos futuros.
- [ ] **Lançamento coletivo reprodutivo** — bulk atual altera grupo/setor, não registra IA/TE/DG/exame/secagem em lote.

As demais entregas dos PRs #176–#186 permanecem feitas nos seus respectivos domínios.

## 🧊 Prioridade baixa — grande, sem dado, ou diferencial futuro

**As 5 pequenas/self-contained foram entregues (PRs #188–#192).** Sobram só as **2 grandes**, deixadas de fora de propósito:

- [ ] **Construtor de relatórios / dashboards montáveis** (Análise · `RELATORIO` 165, `CAMPORELATORIO` 572) — usuário monta colunas/filtros/SQL. Diferencial de revenda, mas grande. Nossos painéis são fixos (mais bonitos). **Fora de escopo por ora.**
- [ ] **Correlação/consulta ABCZ** (Genética · —) — integração com a associação de raça (registro genealógico oficial + comunicações de nascimento/cobertura/pesagem). **Diferencial de nicho, sob demanda — não pré-requisito, não roadmap.** (Parecer via deep-research 2026-07-20, fontes primárias IDEAGRI + ABCZ, 9 claims verificados.)
  - **Só serve rebanho registrado/associado à ABCZ** (zebu de elite / PO). A Rio Novo é **laticínio comercial** de Holandês (taurino, fora da ABCZ) / Girolando — inaplicável. Para leite/corte comercial (a maioria do mercado de revenda) a ABCZ **não muda a venda**; as partes úteis (composição racial, genealogia mãe/pai) já estão prontas.
  - **Sem API pública.** A integração real (ex.: IDEAGRI) opera guardando **login/senha do criador no site da ABCZ** + automação web; exige autorização formal + **termo de comunicação por terceiros registrado em cartório**; depende de **correspondência byte-a-byte** dos dados (sem normalização) e não cobre FIV/TE. Esforço moderado-alto e **frágil** (depende do site/credenciais da ABCZ).
  - **Conflito estratégico:** a própria ABCZ vende ERP concorrente (**Produz**, integração proprietária ao banco dela) — ela compete com ERPs independentes, não os habilita.
  - **Se for perseguir cabanha:** o padrão certo é um **conector genérico de associação de registro** (IDEAGRI integra ABCGH/Holandês, ANCP, **Girolando** também) — começar por **Girolando** (o que a Rio Novo já cria), não pela ABCZ pura. ABCZ entra **só com um cliente de cabanha concreto pagando por isso**.
- [x] **Rebanho quantitativo (relatório clássico)** (Rebanho · —) — efetivo por categoria × faixa etária. **PR #188**.
- [x] **Composição de produto (ração formulada)** (Estoque · —) — receita/composição de ração (ingredientes × proporção %). **PR #189**.
- [x] **Lote de produto / validade + múltiplos locais de armazenamento** (Estoque · —) — `LoteProduto` (código/validade/local) + `LocalArmazenamento`. **PR #190**.
- [x] **Clima / registro de chuva** (Análise · vazio) — `RegistroChuva` (pluviômetro) + acumulado mensal. **PR #191**.
- [x] **Ajuste de U.A. de referência** (Nutrição · —) — conversão efetivo → UA / UA/ha (reusa pesos-referência de Parâmetros). **PR #192**.

---

## Já entregue como fundação (não implica paridade integral) — referência

Marcos recentes que fecharam gaps do IDEagri (ver catálogo para a lista completa de ✅):

- [~] **Exames ginecológicos — fundação** (#170) — evento `EXAME_GINECOLOGICO` + achados + worklist "precisa de exame" (exposta no #171).
- [~] **Programação IATF por lote/data — fundação** (#171) — `ProgramacaoIATFLote` aplica o protocolo (#163) a um lote com calendário D0/D7/D9/D11.
- [x] **Movimentação lote/setor como fato histórico** (#172) — `MovimentacaoAnimal` no cockpit ("onde a vaca esteve").
- [x] **Análise de leite (qualidade)** (#173) — tendência de CCS, distribuição por faixa e piores CCS na aba Produção.
- [x] **Princípio ativo + composição de medicamento** (#174) — `PrincipioAtivo` + `ProdutoPrincipioAtivo`; base carência/antibiótico.
- [~] **Fundações da prioridade média (#176–#186):** indução de lactação (#176), grau de cruzamento (#177), desmame como evento (#178), escore de teto (#179), alteração coletiva/bulk (#180), filtro de animais salvo (#181), tanque + análise de tanque (#182), agenda de manejos (#183), protocolo sanitário (#184), biblioteca de reprodutores (#185), recomendação de acasalamento (#186).
- [x] **5 pequenas da prioridade baixa (#188–#192):** rebanho quantitativo (#188), composição de ração formulada (#189), lote/validade + locais de armazenamento (#190), clima/registro de chuva (#191), ajuste de U.A. de referência (#192). A auditoria reprodutiva de 2026-07-24 reabriu gaps específicos listados acima.
- [x] **CMT / mastite por quarto** (#168) — `ExameQuarto` por teta, mapa de úbere, quarto crônico → sugestão.
- [x] **Histórico de lactações** (#146–147) + **pico/persistência** (#158) + **curva de lactação** (#154).
- [x] **Correção 305 oficial** (#151–152).
- [x] **Catálogo IATF configurável** (#163).
- [x] **Vacinação agendada com lembrete** (#160).
- [x] **Secagem** — retorno à fila (#150) + work-list "a secar" (#156).
- [x] **Carência de leite ativa** na produção (#153).
