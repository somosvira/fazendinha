# Auditoria de UI — módulo Financeiro (2026-09-24)

Avaliação visual de todas as telas do financeiro, feita durante a rodada de testes manuais pós-#297 (produto universal). Foco **só em UI** (aparência, consistência, legibilidade); regras de negócio ficam fora, salvo quando um texto da tela induz a erro.

- **Base:** `main` @ `7e62d72` + correções do PR [#298](https://github.com/somosvira/fazendinha/pull/298).
- **Ambiente:** Postgres local com o `seed` do financeiro (Fazenda Demonstração), Chrome em **1280×800** (desktop comum, sidebar aberta).
- **Telas:** Visão geral, Operações (lista, detalhe, nova), Compromissos, Contas e extratos, Configurações financeiras, Relatórios (lista, novo).

**Nota média ≈ 6/10.** A base visual é boa (tipografia Newsreader + DM Sans, paleta terrosa, cards). O que dá a sensação de "estranho" é a mistura de componentes nativos do navegador com os estilizados e tabelas estourando a largura.

---

## 1. Já corrigido no PR #298

| Problema | Correção |
|---|---|
| Saldo de abertura vinha com `0,00` real; clicar e digitar não substituía | Campo vazio com `0,00` como placeholder (vazio = zero) e seleção do valor ao focar |
| Diálogo de desativar: botão "Desativar" com a mesma cor do fundo, igual a "Manter ativa" | Ação destrutiva sempre com botão vermelho preenchido, em todo o app (sai a prop `dangerFilled`) |
| Abas de Configurações da mesma cor do fundo | Controle segmentado com a aba ativa destacada (padrão do seletor Lista/Calendário) |
| Ícones de ação sem explicação | Dica no hover: Editar / Desativar / Reativar |
| Setas de mover conta para cima/baixo | Removidas |
| Filtros de Produtos com `<select>` nativo, quadrados e cortando "Todos os fornecedo…" | `SelectFiltro` (Radix estilizado), dimensionado pelo conteúdo |
| Tabela de Produtos cortando a coluna de ações | Larguras mínimas reduzidas para caber em 1280px |
| Texto das linhas alinhado ao topo e ícones mais abaixo | Células das tabelas do financeiro centralizadas na vertical |

---

## 2. Problemas transversais (aparecem em várias telas)

### 2.1 Tabelas estourando a largura — **mais grave**
Em 1280px a última coluna é cortada e exige rolagem lateral:
- **Operações:** colunas Valor e Status cortadas (tabela 1044px em área de 958px).
- **Contas e extratos:** botão "Ver conta →" cortado (1010px em 958px).
- **Extrato geral:** coluna Saída cortada.

Foi o que apareceu no primeiro print do teste (nome da conta cortado à esquerda depois de rolar). Somar as `larguraMinima` de cada `TabelaFinanceira` e mantê-las abaixo de ~950px, ou esconder colunas secundárias abaixo de `xl`.

### 2.2 `<select>` nativo misturado com o Select estilizado
Operações, Nova operação, Contas e Extrato usam o nativo, que corta texto e destoa do resto:
- "Compra para estoqu", "Valor u", "Liquidação integral n" (Nova operação);
- placeholders de busca cortados ("Buscar por operação, parceiro ou r", "Nome, instituição ou identifi").

Trocar pelo `SelectFiltro` / `Select` do `components/ui/select.tsx`.

### 2.3 Radio e checkbox nativos (azul do navegador)
Fora da paleta: "Único para a operação / Por item" (Nova operação), cards de "Leitura financeira" (Novo relatório), "Mostrar somente vencidos" (Compromissos).

### 2.4 Quatro linguagens de aba/filtro
Sublinhado (Configurações, antes do #298), chips escuros (A pagar / A receber), segmentado branco (Lista/Calendário), botão bege (período). Nada parece clicável do mesmo jeito — escolher um padrão para "trocar de seção" e outro para "filtrar".

### 2.5 Alinhamento e formatação de tabelas
- Contas e Extrato geral centralizam tudo, inclusive dinheiro; as demais alinham à esquerda. Valores monetários à direita, texto à esquerda, em todas.
- Etiquetas misturam caixa: efeitos em minúscula ("a pagar", "estoque") e status capitalizado ("Confirmada").

### 2.6 Rótulos crus ou divergentes
- Visão geral mostra o enum: "BANCO · Sicoob", "CAIXA".
- O mesmo tipo aparece como "Banco" (Contas) e "Conta bancária" (Configurações).
- Período no gráfico de Contas: "01/01/2026 A 31/12/2026" (A maiúsculo).

### 2.7 Jargão técnico na interface
"Condição de prazo, não status" (card Vencidos), "Volume econômico confirmado", "Transferências sem as duas pontas", "Avulsas (sem operação)". Linguagem do modelo de dados, não do usuário da fazenda.

---

## 3. Bugs encontrados junto

1. **Gráfico "Receitas e despesas"** (Visão geral e Contas): meses futuros repetem o valor do último mês com dado. Com dados só em setembro, out/nov/dez mostram os mesmos R$ 25 mil / R$ 12 mil — deveriam ser zero ou não aparecer.
2. **Novo relatório cria rascunho ao abrir**: só visitar a tela adiciona "Relatório financeiro — agosto/2026" em *Trabalhos ativos* na sidebar.
3. **Revisão da Nova operação enganosa**: em "Compra para estoque", antes de escolher o produto, o painel diz "Nenhum movimento físico de estoque será gerado" e "Registrar pagamento integral de R$ 0,00".

---

## 4. Nota por tela

| Tela | Nota | Pontos |
|---|---|---|
| **Visão geral** | 6 | Cards de saldo e "Próximos compromissos" bons. O bloco "Base financeira / Rastreabilidade" é um painel de diagnóstico técnico no meio do dashboard. Bug do gráfico. "BANCO/CAIXA" crus. Dois donuts em sequência com a mesma forma. Eixo Y com escala irregular ("R$ 6.500", "R$ 13 mil"). |
| **Operações (lista)** | 5 | Valor e Status cortados. Três selects nativos e "Todos os status" sozinho numa segunda linha, largura total. Coluna Operação estreita, nomes quebrando em 2 linhas. |
| **Detalhe da operação** | 7,5 | Limpo e bem hierarquizado (itens / efeitos / valor). Abre com a rolagem herdada da lista (sem o cabeçalho). "Cancelar operação" vermelho sólido é o elemento mais chamativo da tela. Itens espremidos em 3 linhas. Contagens de "Efeitos gerados" sem link para os registros. |
| **Nova operação** | 5,5 | Selects nativos cortando texto; radio azul. Linha Quantidade / Base do valor / Valor unitário / Total desalinhada (rótulos quebram em 2 linhas, caixa do total fora da grade). Painel de revisão com a mensagem enganosa de estoque. |
| **Compromissos** | 7 | A lista mais bem resolvida. Etiqueta "Pendente" muda de posição entre linhas (abaixo do título numa, ao lado na outra). Ícones ↗/↙ dos cards não comunicam "a pagar"/"a receber". Três estilos de controle na mesma tela. Checkbox nativo. |
| **Contas e extratos** | 5 | "Ver conta" cortado; tabela toda centralizada. Gráfico duplica o da Visão geral (com o mesmo bug). Blocos de receitas/despesas em verde e vermelho saturados, fora da paleta. "▶ Ver valores por mês" com o triângulo nativo do `<details>`. Extrato geral com a coluna Saída cortada e dinheiro centralizado. |
| **Configurações financeiras** | 5 → ~7 | Após o #298: abas, filtros, ações e confirmação resolvidos. Falta: pill "Ativa" em toda linha é ruído (marcar só as inativas); campo de data nativo no painel da conta. |
| **Relatórios (lista)** | 6,5 | Estado vazio sem CTA ("Nenhum relatório foi gerado ainda" sem botão para criar). Ícone de atualizar sem dica. |
| **Novo relatório** | 7 | Bom resumo lateral e cards de escolha claros. Radio azul nativo. Setas ⌃⌄ dos multi-selects diferentes do chevron dos selects simples. Cria rascunho só de abrir. |

---

## 5. Ordem sugerida de correção

1. Tabelas cabendo em 1280px; dinheiro à direita, texto à esquerda.
2. Trocar todos os `<select>` nativos pelo Select estilizado; resolver textos e placeholders cortados.
3. Radio e checkbox no estilo do app.
4. Bug do gráfico; rótulos crus e divergentes ("BANCO", "Banco" × "Conta bancária").
5. Um padrão único de abas/filtros.
6. Revisar textos com jargão técnico.

## 6. Decisões de produto em aberto

- **Rastreabilidade na Visão geral:** remover, ou mover para outro lugar (ex.: dentro de Relatórios, ou uma tela de diagnóstico)?
- **Rascunho do Novo relatório:** criar ao abrir a tela ou só quando o usuário começar a editar?
