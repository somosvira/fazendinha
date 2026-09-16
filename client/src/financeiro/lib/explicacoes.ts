/* Explicações em linguagem simples dos seletores do financeiro. Os efeitos
 * seguem o contrato do rebuild (docs/financeiro-rebuild-contrato.md) e o
 * service de operações: incluiEstoque / retiraEstoque / pagar ou receber. */

export type Fluxo = { rotulo: "Produto" | "Serviço" | "Dinheiro"; de: string; para: string };
export type ExplicacaoTipo = {
  /** Uma linha, mostrada dentro da lista de opções. */
  descricao: string;
  /** Frase mostrada embaixo do campo com o tipo escolhido. */
  explicacao: string;
  itens: Fluxo | null;
  dinheiro: Fluxo | null;
};

export const EXPLICACAO_TIPO: Record<string, ExplicacaoTipo> = {
  COMPRA_ESTOQUE: {
    descricao: "Você compra algo que fica guardado, como ração ou adubo.",
    explicacao: "O produto entra no estoque e o dinheiro sai da conta — na hora ou nas parcelas.",
    itens: { rotulo: "Produto", de: "Fornecedor", para: "Estoque" },
    dinheiro: { rotulo: "Dinheiro", de: "Conta", para: "Fornecedor" },
  },
  COMPRA_CONSUMO_DIRETO: {
    descricao: "Você compra algo que é usado na hora, como diesel ou uma peça.",
    explicacao: "Não passa pelo estoque: o item é usado direto e o dinheiro sai da conta.",
    itens: { rotulo: "Produto", de: "Fornecedor", para: "Uso imediato" },
    dinheiro: { rotulo: "Dinheiro", de: "Conta", para: "Fornecedor" },
  },
  SERVICO: {
    descricao: "Alguém faz um trabalho para a fazenda, como um conserto ou frete.",
    explicacao: "Nada entra no estoque. O dinheiro sai da conta para quem fez o serviço.",
    itens: { rotulo: "Serviço", de: "Prestador", para: "Fazenda" },
    dinheiro: { rotulo: "Dinheiro", de: "Conta", para: "Prestador" },
  },
  VENDA: {
    descricao: "Você vende para um cliente, como leite, café ou animais.",
    explicacao: "O produto sai do estoque e o dinheiro entra na conta — na hora ou nas parcelas.",
    itens: { rotulo: "Produto", de: "Estoque", para: "Cliente" },
    dinheiro: { rotulo: "Dinheiro", de: "Cliente", para: "Conta" },
  },
  INVENTARIO_INICIAL: {
    descricao: "Registra o que você já tem guardado antes de começar a usar o sistema.",
    explicacao: "Serve para o estoque começar com a quantidade certa. Não mexe em dinheiro.",
    itens: { rotulo: "Produto", de: "Contagem", para: "Estoque" },
    dinheiro: null,
  },
  BONIFICACAO: {
    descricao: "Você recebe produtos sem pagar, como um brinde ou bônus do fornecedor.",
    explicacao: "O produto entra no estoque sem sair dinheiro da conta.",
    itens: { rotulo: "Produto", de: "Fornecedor", para: "Estoque" },
    dinheiro: null,
  },
  DEVOLUCAO: {
    descricao: "Você devolve ao fornecedor algo que tinha comprado.",
    explicacao: "O produto sai do estoque e o dinheiro volta para a conta.",
    itens: { rotulo: "Produto", de: "Estoque", para: "Fornecedor" },
    dinheiro: { rotulo: "Dinheiro", de: "Fornecedor", para: "Conta" },
  },
  PRODUCAO: {
    descricao: "Algo feito na própria fazenda, como silagem ou mudas.",
    explicacao: "O produto entra no estoque sem comprar de ninguém. Não mexe em dinheiro.",
    itens: { rotulo: "Produto", de: "Fazenda", para: "Estoque" },
    dinheiro: null,
  },
  AJUSTE_ESTOQUE: {
    descricao: "Correção de quantidade, feita pela tela de Estoque.",
    explicacao: "Ajustes de estoque são registrados na tela de Estoque da Pecuária.",
    itens: null,
    dinheiro: null,
  },
};

export type ExplicacaoCondicao = { descricao: string; hoje: string; depois: string; parteHoje: number };

export const EXPLICACAO_CONDICAO: Record<string, ExplicacaoCondicao> = {
  A_VISTA: { descricao: "Tudo é pago ou recebido hoje. O saldo da conta muda na hora.", hoje: "tudo", depois: "nada", parteHoje: 1 },
  A_PRAZO: { descricao: "Nada é pago hoje. O valor vira parcelas com vencimento, e o saldo só muda quando cada uma for paga.", hoje: "nada", depois: "tudo, em parcelas", parteHoje: 0 },
  PARCIAL: { descricao: "Uma parte é paga hoje e o restante vira parcelas para depois.", hoje: "uma parte", depois: "o restante, em parcelas", parteHoje: 0.5 },
  SEM_EFEITO_FINANCEIRO: { descricao: "Não envolve dinheiro. Nenhuma conta ou parcela é movimentada.", hoje: "nada", depois: "nada", parteHoje: 0 },
};

export const EXPLICACAO_CLASSIFICACAO: Record<string, string> = {
  "": "Ainda não decidido. Dá para classificar depois.",
  CUSTEIO: "Gasto do dia a dia para produzir: ração, vacina, diesel.",
  INVESTIMENTO: "Compra que dura anos: máquina, cerca, construção.",
};

export const EXPLICACAO_BASE_VALOR: Record<string, string> = {
  UNITARIO: "Você informa o preço de cada unidade e o total é calculado.",
  TOTAL: "Você informa quanto custou o item inteiro e o preço por unidade é calculado.",
};
