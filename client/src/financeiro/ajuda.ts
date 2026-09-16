/* Textos do botão "Como funciona" de cada tela do financeiro.
 * Curtos de propósito: para que serve, o que dá pra fazer e as regras que mais confundem. */
export type AjudaTela = {
  paraQueServe: string;
  acoes: string[];
  bomSaber?: string[];
};

export const AJUDA_FINANCEIRO = {
  visaoGeral: {
    paraQueServe: "O retrato do dinheiro da fazenda: quanto tem hoje, quanto entrou e saiu no período e o que ainda vai vencer.",
    acoes: [
      "Ver o saldo geral das contas e o que foi recebido e pago no período",
      "Trocar o período no topo para comparar meses",
      "Acompanhar os próximos compromissos em lista ou calendário e registrar pagamentos",
      "Analisar receitas e despesas por categoria",
    ],
    bomSaber: [
      "A pagar e a receber não mexem no saldo: só contam quando o pagamento ou recebimento é registrado.",
    ],
  },
  operacoes: {
    paraQueServe: "Onde se registra tudo o que acontece no negócio: compras, vendas, despesas e receitas.",
    acoes: [
      "Criar uma nova operação ou continuar a que ficou em rascunho",
      "Ver os efeitos de cada operação no caixa, nos compromissos e no estoque",
      "Abrir uma operação para ver os detalhes e os documentos anexados",
      "Cancelar uma operação lançada errada",
    ],
    bomSaber: [
      "Nada é apagado: cancelar gera um lançamento inverso e fica registrado no histórico.",
      "Compra à vista já sai da conta; compra a prazo vira um compromisso a pagar.",
    ],
  },
  compromissos: {
    paraQueServe: "A agenda do que ainda vai ser pago ou recebido, com vencimento e quanto falta.",
    acoes: [
      "Filtrar entre a pagar, a receber e liquidados",
      "Ver em lista ou no calendário do mês",
      "Registrar um pagamento ou recebimento, inteiro ou parcial",
      "Criar um novo valor a pagar ou a receber",
    ],
    bomSaber: [
      "O saldo da conta só muda quando o pagamento ou recebimento é registrado.",
    ],
  },
  contas: {
    paraQueServe: "Os saldos de cada banco, caixa e aplicação, com o extrato de movimentações.",
    acoes: [
      "Conferir o saldo atual de cada conta",
      "Abrir uma conta para ver seus dados e o extrato",
      "Transferir dinheiro entre contas da fazenda",
    ],
    bomSaber: [
      "Transferência entre contas próprias não muda o saldo geral.",
      "Para criar ou editar contas, use Configurações.",
    ],
  },
  configuracoes: {
    paraQueServe: "Os cadastros que as operações usam: contas, clientes e fornecedores, categorias e centros de custo.",
    acoes: [
      "Criar e editar contas bancárias, caixas e aplicações",
      "Cadastrar clientes e fornecedores",
      "Organizar as categorias de receitas e despesas",
      "Definir centros de custo para separar as atividades",
    ],
    bomSaber: [
      "Desativar um cadastro não apaga o histórico, e dá para reativar depois.",
    ],
  },
  relatorios: {
    paraQueServe: "Os relatórios financeiros já emitidos, guardados com o período, o autor e o PDF.",
    acoes: [
      "Montar um novo relatório escolhendo período e filtros",
      "Abrir um relatório antigo para ver o conteúdo salvo",
      "Baixar o PDF de um relatório",
    ],
    bomSaber: [
      "Um relatório guarda os números do momento em que foi gerado.",
    ],
  },
} satisfies Record<string, AjudaTela>;
