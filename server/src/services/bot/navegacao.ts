// Catálogo de NAVEGAÇÃO da dashboard — fonte única de verdade dos deep-links que a
// IA pode oferecer ("veja os detalhes em [tal tabela] com [tais filtros]").
//
// Por que existe: o bot já sabe RESPONDER com números (ferramentas curadas), mas não
// sabe MANDAR o usuário para a tela com o recorte certo. Este arquivo descreve, de
// forma estática, as rotas do app e os filtros de deep-link de cada uma.
// `navegacaoResumo()` injeta o catálogo no system prompt do bot (agent.ts).
// O assistente está suspenso por featureFlags.ts; este catálogo não é o sitemap.
//
// Formato do link que a IA emite: markdown `[rótulo curto](/caminho?param=valor)`.
// As ROTAS (path) são as reais de client/src/router.ts.
//
// Filtros e exemplos deste catálogo precisam ser conferidos contra a tela atual
// antes de reativar o assistente. A presença de um param aqui não garante que o
// client aplique esse recorte; router.ts e os componentes são a implementação.

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
