// Catálogo de NAVEGAÇÃO da dashboard — fonte única de verdade dos deep-links que a
// IA pode oferecer ("veja os detalhes em [tal tabela] com [tais filtros]").
//
// Por que existe: o bot já sabe RESPONDER com números (ferramentas curadas), mas não
// sabe MANDAR o usuário para a tela com o recorte certo. Este arquivo descreve, de
// forma estática, as rotas do app e os filtros de deep-link de cada uma. É consumido
// em dois lugares:
//   1) `navegacaoResumo()` → bloco NAVEGAÇÃO injetado no system prompt do bot
//      (agent.ts), do mesmo jeito que taxonomiaResumo()/esquemaResumo().
//   2) `gerarDocMarkdown()` → o script scripts/gen-nav-doc.ts escreve docs/NAVEGACAO.md.
//
// Formato do link que a IA emite: markdown `[rótulo curto](/caminho?param=valor)`.
// As ROTAS (path) são as reais de client/src/router.ts. Os FILTROS (query params) são
// um ESQUEMA PLANEJADO: hoje o client não lê query string (navegação é useState +
// History API só com path). A implementação client dos filtros está descrita em
// PLANO_CLIENT abaixo — é a parte "planejar os filtros" (ainda não 100%).

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

// Catálogo enxuto, focado no que o assistente de DASHBOARD/financeiro + rebanho
// realmente linka. Não é o sitemap inteiro do app de propósito — só os alvos úteis.
export const NAV_CATALOG: RotaNav[] = [
  {
    path: "/gastos",
    titulo: "Contas (a vencer / vencidas / pagas)",
    quando:
      "Pedidos de DETALHE de contas a pagar, o que vence, o que está vencido, ou a lista de pagamentos de um fornecedor/categoria. É a tabela filtrável do financeiro.",
    filtros: [
      { param: "status", desc: "aba da tela", valores: ["aVencer", "vencidas", "pagas"] },
      { param: "categoria", desc: "filtra por categoria (parte do nome)" },
      { param: "pessoa", desc: "filtra por fornecedor/cliente (parte do nome)" },
      { param: "q", desc: "busca livre (fornecedor, descrição, valor)" },
      { param: "de", desc: "vencimento inicial YYYY-MM-DD" },
      { param: "ate", desc: "vencimento final YYYY-MM-DD" },
    ],
    exemplos: [
      "[Ver contas vencidas](/gastos?status=vencidas)",
      "[Pagamentos à Cargill](/gastos?pessoa=Cargill)",
      "[Gastos com ração](/gastos?categoria=Ração)",
    ],
  },
  {
    path: "/dashboard",
    titulo: "Painel do mês",
    quando:
      "Quando o usuário quer VER o painel de um mês específico (visão de caixa, receita, custeio, investimento, maiores categorias).",
    // Só `mes` está ligado no client (atividade/categoria-drill ainda não aplicam via URL).
    filtros: [{ param: "mes", desc: "mês do painel, YYYY-MM" }],
    exemplos: ["[Abrir o painel de mai/2026](/dashboard?mes=2026-05)"],
  },
  // NOTA: /categorias (PlanoContas) e /relatorio ainda renderizam DADO MOCK
  // (data/rionovo.ts) — foram REMOVIDOS do catálogo pra o bot não mandar o usuário
  // pra número falso. Recolocar quando forem plugados no backend real.
  {
    path: "/rebanho/animal",
    titulo: "Rebanho — lista de animais",
    quando: "Quando a resposta é sobre o rebanho/animais e o usuário pode querer ver a lista.",
    // `id` do animal não resolve confiável por URL (cockpit espera id do banco, não o
    // número do rebanho) — por ora o link abre a lista. Recolocar quando resolver por número.
    filtros: [],
    exemplos: ["[Ver o rebanho](/rebanho/animal)"],
  },
  {
    path: "/rebanho/producao",
    titulo: "Produção de leite",
    quando: "Pedidos de produção/controle leiteiro do rebanho.",
    filtros: [],
    exemplos: ["[Ver a produção de leite](/rebanho/producao)"],
  },
  {
    path: "/rebanho/sanidade",
    titulo: "Sanidade / alertas do rebanho",
    quando: "Pedidos de sanidade, CCS, mastite, alertas do rebanho.",
    filtros: [],
    exemplos: ["[Ver alertas de sanidade](/rebanho/sanidade)"],
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
    "REGRA DE OURO (link): SEMPRE que sua resposta trouxer dados/números que tenham uma tela correspondente na lista abaixo, TERMINE a mensagem com um deep-link markdown [rótulo curto](/caminho?param=valor) pro usuário ver os detalhes. Esse é o comportamento PADRÃO — inclua o link por padrão; só OMITA se nenhuma rota da lista casar com o assunto, ou se sua resposta for uma pergunta de esclarecimento (sem dados). Escolha a rota + filtros que melhor refletem o que você respondeu (status, categoria, mês, pessoa, animal…), usando os NOMES exatos dos dados reais que você buscou. Use SÓ caminhos e params desta lista (não invente). Até 2 links.",
    ...linhas,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// PLANO DE IMPLEMENTAÇÃO NO CLIENT (a parte "planejar os filtros" — ainda não feita).
// Emitido no docs/NAVEGACAO.md pelo gerador. Resumo do que falta para os deep-links
// realmente aplicarem filtro (hoje o client só navega por path, sem query string):
export const PLANO_CLIENT = `## Plano de implementação no client (filtros)

Hoje a navegação é \`useState<Tab>\` + History API gravando **só o path** (client/src/router.ts,
App.tsx) — **nenhum filtro vive na URL**. Para os deep-links acima aplicarem filtro:

1. **Parsear a query string na entrada** (App.tsx, junto de \`pathToTab\`): ler
   \`window.location.search\` → objeto de filtros, e passar para a tela via prop
   (ex.: \`deepLinkFiltros\`), reaproveitando o padrão do ⌘K (\`abrirId\`/\`onAbriuEntidade\`).
2. **Cada tela consome os params na montagem**: Gastos/ContasAVencer inicializa seu
   \`useState\` de filtro a partir de \`deepLinkFiltros\` (status, categoria, pessoa, q, de, ate);
   Dashboard lê \`mes\`/\`atividade\`/\`categoria\`; Rebanho abre \`id\` pelo cockpit já existente.
3. **Refletir filtro→URL** (opcional, fase 2): ao mudar um filtro, \`replaceState\` com a query
   atualizada, para o link ser compartilhável/recarregável.
4. **Tornar o link clicável no chat**: hoje o \`Formatado\` (client/src/components/ChatWidget.tsx)
   só entende \`**negrito**\`. Estender para detectar \`[rótulo](/caminho?filtros)\` e renderizar
   um \`<button>\` que chama um callback de navegação in-app (setTab + aplicar filtros) — **não**
   um \`<a href>\` puro (recarregaria a página e hoje não carrega filtro).

Ordem sugerida: 4 → 1 → 2 (clicável primeiro, depois os filtros de fato). Cada tela pode
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
