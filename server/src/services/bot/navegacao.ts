// Catálogo de NAVEGAÇÃO da dashboard — fonte única de verdade dos deep-links que a
// IA pode oferecer ("veja os detalhes em [tal tabela] com [tais filtros]").
//
// Por que existe: o bot já sabe RESPONDER com números (ferramentas curadas), mas não
// sabe MANDAR o usuário para a tela com o recorte certo. Este arquivo descreve, de
// forma estática, as rotas do app e os filtros de deep-link de cada uma. É consumido
// em dois lugares:
//   1) `navegacaoResumo()` → bloco NAVEGAÇÃO injetado no system prompt do bot
//      (agent.ts), do mesmo jeito que taxonomiaResumo().
//   2) `gerarDocMarkdown()` → o script scripts/gen-nav-doc.ts escreve docs/NAVEGACAO.md.
//
// Formato do link que a IA emite: markdown `[rótulo curto](/caminho?param=valor)`.
// As ROTAS (path) são as reais de client/src/router.ts.
//
// Sobre os FILTROS (query params): são um ESQUEMA PLANEJADO — o client ainda não lê query string nas telas
//     do financeiro (navegação é useState + History API só com path). Os nomes abaixo
//     espelham o estado real de cada tela para a implementação ser mecânica; o plano
//     está em PLANO_CLIENT no fim do arquivo.

export interface FiltroNav {
  /** nome do query param, ex.: "status" */
  param: string;
  /** o que ele faz */
  desc: string;
  /** valores permitidos, quando é um enum */
  valores?: string[];
}

export interface RotaNav {
  /** pathname real (client/src/router.ts) */
  path: string;
  titulo: string;
  /** quando a IA DEVE oferecer este link (gatilho editorial) */
  quando: string;
  filtros: FiltroNav[];
  /** deep-links de exemplo, já no formato markdown */
  exemplos: string[];
}

// Catálogo enxuto, focado no que o assistente de DASHBOARD/financeiro + rebanho (v1)
// realmente linka. Não é o sitemap inteiro do app de propósito — só os alvos úteis.
export const NAV_CATALOG: RotaNav[] = [
  {
    path: "/financeiro",
    titulo: "Financeiro — visão geral do período",
    quando:
      "Quando o usuário quer VER o panorama do caixa: saldo das contas, quanto entrou e saiu no período, o que está a pagar e a receber, e as maiores despesas por categoria.",
    filtros: [
      { param: "de", desc: "início do período, YYYY-MM-DD" },
      { param: "ate", desc: "fim do período, YYYY-MM-DD" },
    ],
    exemplos: ["[Abrir a visão geral do financeiro](/financeiro)"],
  },
  {
    path: "/financeiro/compromissos",
    titulo: "Compromissos (a pagar / a receber / liquidados)",
    quando:
      "Pedidos de DETALHE do que está em aberto: contas a pagar, o que vence, o que já venceu, valores a receber de um cliente. É a agenda de valores pendentes — não confundir com o dinheiro já movimentado.",
    filtros: [
      { param: "aba", desc: "aba da tela", valores: ["PAGAR", "RECEBER", "LIQUIDADOS"] },
      { param: "vencidos", desc: "mostrar somente vencidos", valores: ["true"] },
    ],
    exemplos: [
      "[Ver o que está a pagar](/financeiro/compromissos?aba=PAGAR)",
      "[Ver os compromissos vencidos](/financeiro/compromissos?aba=PAGAR&vencidos=true)",
      "[Ver o que há a receber](/financeiro/compromissos?aba=RECEBER)",
    ],
  },
  {
    path: "/financeiro/operacoes",
    titulo: "Operações financeiras",
    quando:
      "Quando a resposta trata de compras, vendas, serviços ou lançamentos já registrados, e o usuário pode querer ver a lista com os efeitos de cada um (estoque, pagamento, recebimento, compromisso).",
    filtros: [
      { param: "busca", desc: "texto livre: descrição, parceiro ou número da operação" },
      { param: "tipo", desc: "tipo da operação", valores: ["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "APORTE", "RETIRADA", "TRANSFERENCIA_FINANCEIRA", "DEVOLUCAO"] },
      { param: "status", desc: "situação da operação", valores: ["CONFIRMADA", "CANCELADA"] },
      { param: "efeito", desc: "efeito gerado pela operação", valores: ["ESTOQUE", "PAGAMENTO", "RECEBIMENTO", "A_PAGAR", "A_RECEBER", "TRANSFERENCIA", "SEM_EFEITOS"] },
      { param: "de", desc: "data inicial, YYYY-MM-DD" },
      { param: "ate", desc: "data final, YYYY-MM-DD" },
    ],
    exemplos: [
      "[Ver as compras do período](/financeiro/operacoes?tipo=COMPRA_ESTOQUE)",
      "[Ver as operações da Cargill](/financeiro/operacoes?busca=Cargill)",
      "[Ver as vendas confirmadas](/financeiro/operacoes?tipo=VENDA&status=CONFIRMADA)",
    ],
  },
  {
    path: "/financeiro/contas",
    titulo: "Contas e extratos",
    quando:
      "Perguntas de saldo: quanto há em caixa ou no banco, e o extrato de uma conta específica. Também é o destino de transferências entre contas próprias.",
    filtros: [],
    exemplos: ["[Ver as contas e saldos](/financeiro/contas)"],
  },
  {
    path: "/financeiro/relatorios",
    titulo: "Relatórios financeiros",
    quando:
      "Quando o usuário pede um fechamento ou consolidação por tipo de operação, a partir do que já está registrado.",
    filtros: [],
    exemplos: ["[Abrir os relatórios financeiros](/financeiro/relatorios)"],
  },
  {
    path: "/financeiro/configuracoes",
    titulo: "Configurações financeiras",
    quando: "Quando o usuário precisa consultar ou manter contas, parceiros, categorias e centros de custo.",
    filtros: [],
    exemplos: ["[Abrir as configurações financeiras](/financeiro/configuracoes)"],
  },
  {
    path: "/pecuaria/rebanho",
    titulo: "Rebanho — lista de animais",
    quando: "Quando a resposta é sobre o rebanho/animais e o usuário pode querer ver a lista.",
    filtros: [],
    exemplos: ["[Ver o rebanho](/pecuaria/rebanho)"],
  },
];

/**
 * Bloco compacto para o system prompt do bot (mesmo papel de taxonomiaResumo()).
 * É estático (não bate no banco), então é síncrono. Mantido curto de propósito —
 * entra em TODO prompt.
 */
export function navegacaoResumo(): string {
  const linhas = NAV_CATALOG.map((r) => {
    const params = r.filtros.length
      ? " Filtros: " +
        r.filtros
          .map((f) => (f.valores ? `${f.param}(${f.valores.join("|")})` : f.param))
          .join(", ") +
        "."
      : "";
    const ex = r.exemplos[0] ? ` Ex.: ${r.exemplos[0]}` : "";
    return `- ${r.path} — ${r.titulo}: ${r.quando}${params}${ex}`;
  });
  return [
    "REGRA DE OURO (link): SEMPRE que sua resposta trouxer dados/números que tenham uma tela correspondente na lista abaixo, TERMINE a mensagem com um deep-link markdown [rótulo curto](/caminho?param=valor) pro usuário ver os detalhes. Esse é o comportamento PADRÃO — inclua o link por padrão; só OMITA se nenhuma rota da lista casar com o assunto, ou se sua resposta for uma pergunta de esclarecimento (sem dados). Escolha a rota + filtros que melhor refletem o que você respondeu (status, categoria, mês, pessoa…), usando os NOMES exatos dos dados reais que você buscou. Use SÓ caminhos e params desta lista (não invente). Até 2 links.",
    ...linhas,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// PLANO DE IMPLEMENTAÇÃO NO CLIENT (a parte "planejar os filtros" — ainda não feita).
// Emitido no docs/NAVEGACAO.md pelo gerador. Resumo do que falta para os deep-links
// realmente aplicarem filtro (hoje o client só navega por path, sem query string):
export const PLANO_CLIENT = `## Plano de implementação no client (filtros)

O que **falta**: as telas do financeiro ainda não leem query string. A navegação é
\`useState<Tab>\` + History API gravando só o path (client/src/router.ts, App.tsx), e cada
tela inicializa os próprios filtros em \`useState\`. Para os links do financeiro aplicarem
filtro:

1. **Parsear a query string na entrada** (App.tsx, junto de \`pathToTab\`): ler
   \`window.location.search\` -> objeto de filtros e passar para a tela via prop
   (ex.: \`deepLinkFiltros\`).
2. **Cada tela consome os params na montagem**, usando os nomes que ela já tem em estado:
   - \`CompromissosFinanceiros\` -> \`aba\` (PAGAR | RECEBER | LIQUIDADOS) e \`soVencidos\`;
   - \`OperacoesFinanceiras\` -> \`busca\`, \`tipo\`, \`status\`, \`efeito\`, \`inicio\`/\`fim\`;
   - \`VisaoGeralFinanceira\` -> período (\`de\`/\`ate\`), que já vai à API como inicio/fim.
3. **Refletir filtro->URL** (opcional, fase 2): ao mudar um filtro, \`replaceState\` com a
   query atualizada, para o link ser compartilhável e recarregável.
4. **Tornar o link clicável no chat**: o \`Formatado\` (client/src/components/ChatWidget.tsx)
   só entende \`**negrito**\`. Estender para detectar \`[rótulo](/caminho?filtros)\` e renderizar
   um \`<button>\` que chama um callback de navegação in-app (setTab + aplicar filtros) — **não**
   um \`<a href>\` puro (recarregaria a página).

Ordem sugerida: 4 -> 1 -> 2 (clicável primeiro, depois os filtros de fato). Cada tela pode
entrar incrementalmente; enquanto uma não lê os params, o link ainda abre a aba certa.`;

/** Documento markdown completo (rotas + filtros + plano) — usado pelo gerador. */
export function gerarDocMarkdown(geradoEm: string): string {
  const rotas = NAV_CATALOG.map((r) => {
    const filtros = r.filtros.length
      ? r.filtros
          .map((f) => `  - \`${f.param}\`${f.valores ? ` (${f.valores.join(" | ")})` : ""} — ${f.desc}`)
          .join("\n")
      : "  - (sem filtros de deep-link)";
    const exemplos = r.exemplos.map((e) => `  - ${e}`).join("\n");
    return `### \`${r.path}\` — ${r.titulo}\n\n**Quando linkar:** ${r.quando}\n\n**Filtros:**\n${filtros}\n\n**Exemplos:**\n${exemplos}`;
  }).join("\n\n");

  return `# Navegação da dashboard (deep-links da IA)

> **Gerado por \`scripts/gen-nav-doc.ts\` a partir de \`server/src/services/bot/navegacao.ts\`.**
> Não editar à mão — mexer no catálogo e rodar \`pnpm gen:nav-doc\`. Gerado em ${geradoEm}.

Este é o guia que a IA recebe no contexto (via \`navegacaoResumo()\`) para responder com
links internos que levam o usuário à tela/tabela certa, já com o recorte aplicado.

Formato do link: \`[rótulo curto](/caminho?param=valor&param2=valor2)\`.

## Rotas e filtros

${rotas}

${PLANO_CLIENT}
`;
}
