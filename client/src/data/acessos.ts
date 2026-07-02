/* Rio Novo — controle de acesso e permissões.
 * Port de src/dataAcessos.js do handoff de design. Dado estático (frontend-only):
 * o backend ainda não modela usuários/papéis. App.tsx mantém isto em estado.
 */

export type Aba = { id: string; label: string; desc: string };
export type Flag = { id: string; label: string; desc: string };
export type Papel = { nome: string; desc: string; abas: string[]; flags: string[] };
export type User = {
  id: string;
  nome: string;
  email: string;
  inicial: string;
  papel: string; // chave de PAPEIS ou "personalizado"
  status: "ativo" | "pendente" | "inativo";
  ultimoAcesso: string;
  abas: string[];
  flags: string[];
  dono?: boolean;
};

export const UPDATED_AT = "04/mai/2026, recebido do BPO";

// Abas do sistema (ordem de exibição na navegação)
export const ABAS: Aba[] = [
  { id: "dashboard", label: "Dashboard", desc: "Visão executiva, gráficos e números" },
  { id: "gastos", label: "Gastos", desc: "Tabela de lançamentos e notas fiscais" },
  { id: "lancar", label: "Lançar", desc: "Registrar entrada (receita) ou saída (gasto)" },
  { id: "caixinha", label: "Caixinha", desc: "Fundo fixo em dinheiro — entradas, saídas e saldo" },
  { id: "plano", label: "Categorias", desc: "Plano de contas e categorização" },
  { id: "ia", label: "IA", desc: "Pergunte sobre os números" },
  { id: "relatorio", label: "Relatório", desc: "Relatório gerencial editorial" },
];

// Permissões sensíveis (além da visibilidade de abas)
export const FLAGS: Flag[] = [
  { id: "verValores", label: "Ver valores em R$", desc: "Sem isso, vê estrutura e categorias mas com valores ocultos" },
  { id: "verInvestimento", label: "Ver pilha de Investimento", desc: "Compra de gado, máquinas, benfeitorias" },
  { id: "verSalarios", label: "Ver Pessoal / Salários", desc: "Folha, salários e detalhe de pessoal" },
  { id: "lancar", label: "Registrar lançamentos", desc: "Criar entradas (receitas) e saídas (gastos)" },
  { id: "exportar", label: "Exportar / baixar", desc: "Gerar PDF, CSV e relatórios" },
  { id: "gerenciarAcessos", label: "Gerenciar acessos", desc: "Convidar pessoas e definir permissões (admin)" },
];

// Papéis (presets de permissão)
export const PAPEIS: Record<string, Papel> = {
  proprietario: {
    nome: "Proprietário",
    desc: "Acesso total. Gerencia quem entra e o que cada um vê.",
    abas: ["dashboard", "gastos", "lancar", "caixinha", "plano", "ia", "relatorio"],
    flags: ["verValores", "verInvestimento", "verSalarios", "lancar", "exportar", "gerenciarAcessos"],
  },
  secretaria: {
    nome: "Secretária / Administrativo",
    desc: "Opera o dia a dia: lança gastos e organiza categorias.",
    abas: ["gastos", "lancar", "caixinha", "plano", "ia"],
    flags: ["verValores", "verSalarios", "lancar"],
  },
  contador: {
    nome: "Contador / BPO",
    desc: "Lê e concilia. Exporta relatórios. Não lança no operacional.",
    abas: ["dashboard", "gastos", "plano", "relatorio"],
    flags: ["verValores", "verInvestimento", "verSalarios", "exportar"],
  },
  gestor: {
    nome: "Gerente da fazenda",
    desc: "Acompanha operação e desempenho, sem dados de folha.",
    abas: ["dashboard", "gastos", "ia", "relatorio"],
    flags: ["verValores", "verInvestimento"],
  },
  consulta: {
    nome: "Sócio / Consulta",
    desc: "Apenas leitura do panorama. Não vê detalhe operacional.",
    abas: ["dashboard", "relatorio"],
    flags: ["verValores", "verInvestimento"],
  },
};

export const usuarios: User[] = [
  {
    id: "marco",
    nome: "Marco Antônio",
    email: "marco@rionovo.agr.br",
    inicial: "M",
    papel: "proprietario",
    status: "ativo",
    ultimoAcesso: "agora",
    abas: ["dashboard", "gastos", "lancar", "caixinha", "plano", "ia", "relatorio"],
    flags: ["verValores", "verInvestimento", "verSalarios", "lancar", "exportar", "gerenciarAcessos"],
    dono: true,
  },
  {
    id: "sandra",
    nome: "Sandra Oliveira",
    email: "sandra.adm@rionovo.agr.br",
    inicial: "S",
    papel: "secretaria",
    status: "ativo",
    ultimoAcesso: "há 12 min",
    abas: ["gastos", "lancar", "caixinha", "plano", "ia"],
    flags: ["verValores", "verSalarios", "lancar"],
  },
  {
    id: "aline",
    nome: "Aline Souza",
    email: "aline@contabilidadesouza.com.br",
    inicial: "A",
    papel: "contador",
    status: "ativo",
    ultimoAcesso: "há 2 dias",
    abas: ["dashboard", "gastos", "plano", "relatorio"],
    flags: ["verValores", "verInvestimento", "verSalarios", "exportar"],
  },
  {
    id: "roberto",
    nome: "Roberto Dias",
    email: "roberto.capataz@rionovo.agr.br",
    inicial: "R",
    papel: "gestor",
    status: "ativo",
    ultimoAcesso: "há 5 h",
    abas: ["dashboard", "gastos", "ia", "relatorio"],
    flags: ["verValores", "verInvestimento"],
  },
  {
    id: "joaopedro",
    nome: "João Pedro (filho)",
    email: "jp@rionovo.agr.br",
    inicial: "J",
    papel: "consulta",
    status: "ativo",
    ultimoAcesso: "há 1 semana",
    abas: ["dashboard", "relatorio"],
    flags: ["verValores", "verInvestimento"],
  },
  {
    id: "convite1",
    nome: "Dr. Henrique Vasconcelos",
    email: "henrique@vetvale.com.br",
    inicial: "H",
    papel: "gestor",
    status: "pendente",
    ultimoAcesso: "convite enviado há 1 dia",
    abas: ["dashboard", "ia"],
    flags: ["verValores"],
  },
];
