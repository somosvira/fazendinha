# Mapa de áreas do app × prioridade offline

Levantamento de todas as telas do Rio Novo, agrupadas do jeito que o usuário
percebe elas no uso (a navegação lateral do app), com uma avaliação de quão
difícil seria dar suporte offline pra cada uma e quão útil isso seria na
prática. Feito em 2026-08-24, cruzando a conversa sobre arquitetura offline
(TanStack Query + IndexedDB + fila de mutação + UUID/LWW) com o código real.

Companheiro do [OFFLINE_STRATEGY.md](OFFLINE_STRATEGY.md) — este aqui é o
levantamento tela-a-tela; aquele é a estratégia e o progresso da rollout.

## Como ler as colunas

**Dificuldade offline** — o quanto custa dar suporte a essa tela na
arquitetura proposta (cache de leitura fácil pra tudo; a variação real está
na escrita):
- 🟢 **Baixa** — tela só de leitura, cache de `GET` resolve sozinho.
- 🟡 **Média** — escrita simples de uma entidade só, CRUD comum (UUID + fila +
  LWW mecânicos, sem lógica extra).
- 🔴 **Alta** — a escrita cruza mais de uma tabela, depende de recompute
  pesado no servidor, é multi-etapa/sequencial, ou esbarra numa regra de
  negócio que rejeita (não só "conflito de dado desatualizado") — ex.:
  `FechamentoMensal` bloqueando lançamento em mês fechado.
- ⚫ **N/A** — depende de um serviço externo em tempo real (OpenAI, OCR no
  servidor, Meta Cloud API); não existe "versão offline" possível sem trocar
  a arquitetura inteira daquele pedaço.

**Utilidade offline** — o quanto essa tela é realmente usada longe de sinal
bom (curral, piquete, talhão, lavoura) vs. no escritório/casa com wifi.

---

## Financeiro

| Feature | O que é / o que faz | Dificuldade offline | Utilidade offline |
|---|---|---|---|
| **Dashboard** | Painel executivo: timeline de 23 meses, DRE, categorias, inconsistências. Só leitura. | 🟢 **Baixa** — cache de `GET` simples | 🟡 **Média** — bom pra checar saldo rápido, mas uso típico é no escritório |
| **Lançar** | Formulário de novo lançamento (receita/despesa), cria/vincula categoria, centro de custo, conta, fornecedor. | 🔴 **Alta** — grava `Lancamento`, mas o servidor rejeita (423) se o mês de competência estiver fechado (`FechamentoMensal`); a fila precisa tratar isso como erro de negócio definitivo, não como "tentar de novo depois" | 🔴 **Alta** — lançar um gasto rápido (combustível, insumo) fora do escritório é um caso de uso real |
| **Gastos** | Listagem/filtro de lançamentos por atividade (Leite/Café/Outros/Misto) + reclassificação. | 🟡 **Média** — leitura fácil, reclassificar é escrita simples de um campo | 🟢🟡 **Baixa-Média** |
| **Plano de contas** | CRUD de Categoria/GrupoCategoria/CentroCusto — cadastro compartilhado entre sítios. | 🟡 **Média** — CRUD simples, mas é dado compartilhado (mais chance de dois usuários colidirem) | 🟢 **Baixa** — mexido de vez em quando, no escritório |
| **Contas a vencer** | Lista de lançamentos `ABERTO` vencendo/vencidos + botão "marcar como paga". | 🔴 **Alta** — mesma trava de mês fechado, mais checagem de "já foi paga por outro usuário" (409) — conflito real, não só timestamp | 🟡 **Média** |
| **Caixinha** | Caixa físico (dinheiro em espécie); cada movimento espelha um lançamento. | 🔴 **Alta** — escrita dupla/atômica (movimento + reflexo em `Lancamento`) | 🔴 **Alta** — despesa pequena em dinheiro é exatamente o tipo de gasto feito fora do escritório |
| **Relatório** | Snapshot do fechamento mensal + exportação em PDF (`html2pdf`, já roda no client). | 🟢 **Baixa** — é leitura, PDF já é gerado no navegador | 🟢 **Baixa** — uso mensal, tipicamente no escritório pra fechar contas |
| **Simulador de cenários** *(dentro da aba IA)* | What-if de preço do leite/crescimento de custeio; cálculo roda no próprio client hoje. | 🟢 **Baixa** — só precisa que o payload base esteja cacheado | 🟢🟡 **Baixa-Média** |
| **IA / assistente conversacional** *(aba IA, cobre financeiro + rebanho)* | Chat com o agente OpenAI — responde perguntas e usa os mesmos services de domínio como "ferramentas". | ⚫ **N/A** — depende de chamada de rede pra OpenAI, sem alternativa local | ⚫ **N/A** quando offline |

## Canais alternativos

| Feature | O que é / o que faz | Dificuldade offline | Utilidade offline |
|---|---|---|---|
| **Notas fiscais (upload + OCR)** | Foto/PDF de nota fiscal → OCR no servidor (Tesseract) extrai dados → valida contra um lançamento. | 🔴 **Alta** — o *upload* dá pra enfileirar (guardar a foto local e mandar depois), mas o OCR em si sempre roda no servidor, nunca no dispositivo | 🔴 **Alta** — a foto é tirada na hora da compra, muitas vezes em local sem sinal (revenda, posto, fazenda) |
| **WhatsApp bot** | Canal conversacional via Meta Cloud API — pergunta ou lança gasto por mensagem. | ⚫ **N/A** — o "cliente" é o WhatsApp do próprio usuário; a mensagem já depende de internet pra sair, não existe camada offline possível aqui | ⚫ **N/A** |

## Rebanho (gado leiteiro)

| Feature | O que é / o que faz | Dificuldade offline | Utilidade offline |
|---|---|---|---|
| **Dashboard** | KPIs do dia + "cockpit" de alertas/tarefas urgentes. Só leitura. | 🟢 **Baixa** | 🟡 **Média** |
| **Animal** | Lista + ficha completa (cockpit: lactação, saúde, IATF, genealogia) + cadastro/edição/baixa/edição em massa. | 🔴 **Alta** — a ficha cruza várias entidades recalculadas via `*.recompute.ts` no servidor; escrita offline fica "desatualizada" até sincronizar e recomputar | 🟡 **Média** — cadastro/baixa é frequente, mas não necessariamente feito no pasto |
| **Reprodução** | Registrar evento (cio, IA, diagnóstico, parto, secagem) + programar protocolo IATF em lote (multi-etapa: programar → executar cada dia → exceções por animal). | 🔴 **Alta** — a programação em lote tem estado sequencial, difícil de enfileirar fora de ordem | 🔴 **Alta** — registro de parto/cio acontece no curral, na hora |
| **Acasalamento** | Planos com ranking de touros calculado no servidor (mérito genético, parentesco, sêmen disponível) + config de indicadores/regras/combinações. | 🔴 **Alta** — o ranking depende de cálculo pesado sobre todo o rebanho + estoque de sêmen atualizado; replicar isso offline é duplicar um algoritmo inteiro no client | 🟢 **Baixa** — decisão de acasalamento é feita com calma, no escritório |
| **FIV** | Cadastro de coletas de oócitos por doadora + "pool de doadoras" (gera várias coletas de uma vez). | 🟡 **Média** — CRUD simples, mas "aplicar pool" expande uma ação em N registros | 🟡 **Média** |
| **Relatórios** | Monta relatório por template/filtros, exporta, e permite montar "folha de campo" pra imprimir → depois lançar os dados coletados de volta no sistema. | 🟡 **Média** — a parte de relatório é leitura fácil; "lançar dados de campo" já é um lote de escrita, no mesmo espírito do que viraria a fila offline | 🔴 **Alta** — a folha de campo já existe justamente pra suprir a falta de conectividade hoje (imprime, preenche, digita depois); é a candidata mais natural pra virar fila de verdade |
| **Sanidade** | Registrar evento sanitário (doença, tratamento, vacina) + protocolos. | 🟡 **Média** | 🔴 **Alta** — aplicação de vacina/tratamento acontece no curral |
| **Nutrição** | Lotes/dietas + lançamento de consumo do lote (baixa automática no estoque). | 🔴 **Alta** — lançar consumo dispara baixa de estoque automaticamente; LWW por registro não garante a consistência do saldo | 🟡 **Média** |
| **Produção** | KPIs de produção + lançamento agregado por lote/dia (modo tanque). | 🟡 **Média** | 🔴 **Alta** — a leitura do tanque acontece na ordenha, local clássico de sinal ruim |
| **Estoque** | Saldos de insumos, cadastro de produto, movimento (entrada/saída/ajuste) — pode ter reflexo financeiro. | 🔴 **Alta** — movimento de estoque mexe em mais de uma tabela | 🟡 **Média** — almoxarifado costuma ter sinal melhor que o pasto |
| **Custo** | Dashboard de custo/litro, custo vaca/dia. Só leitura. | 🟢 **Baixa** | 🟢 **Baixa** |
| **Carteira** | Score/ranking de vacas (Elite → Descarte) + simulador "descartar N piores" que não grava nada. | 🟢 **Baixa** — leitura + simulação client-side stateless | 🟢🟡 **Baixa-Média** |
| **Sugestões** | Cartões de decisão priorizados por impacto financeiro estimado. **Não é IA/LLM** — é motor de regras determinístico no servidor. | 🟢 **Baixa** — resultado é só consulta | 🟡 **Média** |

## Plantel (gado de corte)

| Feature | O que é / o que faz | Dificuldade offline | Utilidade offline |
|---|---|---|---|
| **Dashboard** | KPIs gerais (cabeças, UA, arrobas, GMD médio). Só leitura, uso de escritório. | 🟢 **Baixa** | 🟢🟡 **Baixa-Média** |
| **Lote** | Lista + cockpit + cadastro/edição/baixa de lote. | 🟡 **Média** | 🟢 **Baixa** — gestão administrativa, não é tela de campo |
| **Pesagem** | Registrar pesagem (peso médio, método, GMD recalculado a partir da anterior). | 🟡 **Média** — escrita simples, mas o GMD depende do histórico local pra calcular certo offline | 🔴 **Alta** — apontamento clássico de curral/balança |
| **Pasto** | Painel de piquetes (ocupação, lotação, capim). Só leitura, sem cadastro. | 🟢 **Baixa** | 🔴 **Alta** — checar qual piquete está livre é útil andando no pasto |
| **Sanidade** | Registrar manejo sanitário (vacina, vermífugo, carrapaticida, marcação) + calendário Embrapa de referência. | 🟡 **Média** | 🔴 **Alta** — registrado no curral, com carência que importa na hora |
| **Nutrição** | Registrar suplementação aplicada ao lote + catálogo de referência. | 🟡 **Média** | 🟡 **Média** — cocho/curral, mas menos urgente que sanidade/pesagem |
| **Comercial** | Registrar operação comercial (venda/compra/transferência) + simulador "vender hoje x esperar" usando curva de mercado (B3). | 🔴 **Alta** — o simulador depende de cotação de mercado atualizada pra fazer sentido | 🟢🟡 **Baixa-Média** — decisão comercial normalmente precisa de internet pra cotação |
| **Custo** | Dashboard custo/arroba/ha + comparativo Cepea/Esalq. Só leitura. | 🟢 **Baixa** | 🟢 **Baixa** |

## Plantio (café)

| Feature | O que é / o que faz | Dificuldade offline | Utilidade offline |
|---|---|---|---|
| **Dashboard** | Painel geral da lavoura (área, fase fenológica, sacas, alertas). Só leitura. | 🟢 **Baixa** | 🟢🟡 **Baixa-Média** |
| **Talhão** | Cadastro/edição/baixa de talhão + cockpit de detalhe. | 🟡 **Média** | 🟢 **Baixa** — tela cadastral-base, não de apontamento |
| **Fenologia** | Consulta de fase fenológica + timeline. Sem formulário próprio de registro. | 🟢 **Baixa** | 🟡 **Média** — acompanhamento indireto de campo |
| **Fitossanidade** | Registrar aplicação (fungicida/inseticida/herbicida), roçagem, capina, inspeção MIP. | 🟡 **Média** | 🔴 **Alta** — apontamento feito andando na lavoura, sinal ruim |
| **Nutrição** | Registrar adubação/calagem/gessagem/amostragem de solo/foliar + planos de adubação. | 🟡 **Média** | 🔴 **Alta** — registrado no momento da adubação, no talhão |
| **Colheita** | Painel de maturação + registro de passada de derriça (litros, rendimento, método). | 🟡 **Média** | 🔴 **Alta** — a tela de apontamento mais claramente "de campo" do módulo |
| **Planejamento** | Tarefas planejadas → "realizar" tarefa + apontamento de hora-máquina/homem. | 🟡 **Média** — dois modos de formulário, sem cálculo pesado embutido | 🟡 **Média** — apontamento de horas pode ser feito no fim do dia de campo |
| **Estoque** | Consulta de saldo de insumos. Hoje só leitura (botão de "registrar movimento" existe mas sem ação implementada). | 🟢 **Baixa** — é leitura hoje | 🟢 **Baixa** — consulta de almoxarifado |
| **Custo** | Dashboard custo/saca/ha + comparativo Cepea/Esalq. Só leitura. | 🟢 **Baixa** | 🟢 **Baixa** |

## Cultivo (milho e grãos)

| Feature | O que é / o que faz | Dificuldade offline | Utilidade offline |
|---|---|---|---|
| **Dashboard** | Painel geral (safras, área, produção, ocupação de silos). Só leitura. | 🟢 **Baixa** | 🟢🟡 **Baixa-Média** |
| **Safras** | CRUD de safra + cadastro de áreas (parcelas). | 🟡 **Média** | 🟢 **Baixa** — gestão administrativa |
| **Custos** | Lançar custo por safra/área (adubação, preparo, plantio, tratos, colheita, transporte, mão de obra, máquina). | 🟡 **Média** | 🟡 **Média** — pode ser preenchido no fim de uma operação de campo, mas é lançamento financeiro, não inspeção |
| **Produção** | Registrar produção (sacas/toneladas) por safra/área, com destino venda ou silo. | 🟡 **Média** — precisa saber pra qual silo vai (referência que teria que estar cacheada) | 🔴 **Alta** — apontamento no momento da descarga da colheitadeira/caminhão |
| **Silos** | Cadastro de silo + extrato de movimentos + lançar saída manual (entradas de colheita são automáticas). | 🟡 **Média** | 🟡 **Média** — conferência costuma ser feita no armazém, sinal geralmente melhor que no talhão |
| **Custo** | Dashboard custo/ha/saca/tonelada. Só leitura. | 🟢 **Baixa** | 🟢 **Baixa** |

## Equipe

| Feature | O que é / o que faz | Dificuldade offline | Utilidade offline |
|---|---|---|---|
| **Dashboard** | Visão executiva de RH/ponto/folha. Só leitura. | 🟢 **Baixa** | 🟢🟡 **Baixa-Média** |
| **Funcionários** | CRUD de cadastro (salário, jornada, PIX, admissão). | 🟡 **Média** — dado sensível, cadastro raramente feito fora do escritório | 🟢 **Baixa** |
| **Ponto** | Registro de jornada (entrada/saída/intervalo). | 🟡 **Média** — escrita simples por registro, mas "bate ponto" real de campo precisa suportar vários funcionários no mesmo dispositivo/dia | 🔴 **Alta** — bater ponto no curral/lavoura sem sinal é um caso de uso clássico de app offline |
| **Folha** | Rateio de custo de mão de obra por setor — majoritariamente derivado de Ponto + Funcionário. | 🟢🟡 **Baixa-Média** — é cálculo/leitura na maior parte | 🟢 **Baixa** — uso mensal, escritório |

## Administração & Acessos

| Feature | O que é / o que faz | Dificuldade offline | Utilidade offline |
|---|---|---|---|
| **Cadastros de referência** | CRUD de Produto, Raça, CentroCusto etc. — compartilhado entre módulos e sítios. | 🟡 **Média** | 🟢 **Baixa** |
| **Acessos** | Gestão de usuários, papéis e permissões. | 🟢 **Baixa** — poucas escritas, mas sem motivo de investir | ⚪ **Muito baixa** — ação administrativa sensível, sempre no escritório |
| **Configurações** | Ajustes gerais do sistema. | 🟢 **Baixa** | ⚪ **Muito baixa** |

---

## Síntese

O padrão que aparece em quase todo módulo operacional é o mesmo:

- **Dashboards e telas de custo são fáceis e pouco úteis offline** — já são
  só leitura (cache resolve sozinho), mas normalmente são consultados no
  escritório com wifi bom, não valem a prioridade.
- **Telas de apontamento pontual de campo são as mais valiosas e ficam numa
  dificuldade média** — Pesagem/Sanidade (corte), Fitossanidade/Nutrição/Colheita
  (café), Produção (milho), Ponto (equipe): escrita simples de um evento, sem
  recompute pesado embutido na própria tela. São a prioridade natural de um
  primeiro rollout.
- **As telas mais difíceis são as que cruzam múltiplas tabelas ou dependem
  de recompute/regra de negócio no servidor** — Lançar/Contas a vencer
  (trava de `FechamentoMensal`), Acasalamento (ranking calculado sobre todo
  o rebanho), Animal (ficha cruza vários resumos), Nutrição do rebanho
  (baixa automática de estoque). Essas exigem tratar rejeição de negócio
  como algo diferente de "conflito de dado desatualizado".
- **IA (chat), Notas fiscais (OCR) e WhatsApp bot são estruturalmente
  diferentes** — dependem de um serviço externo em tempo real; o máximo que
  dá pra fazer offline é enfileirar o *envio* (a foto da nota, a pergunta),
  nunca o processamento em si.
