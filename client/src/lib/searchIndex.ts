/* Rio Novo — índice estático + busca pura para a command palette (⌘K).
 *
 * Fonte única dos destinos navegáveis (páginas/abas) + atalhos de ação.
 * Espelha o AppSidebar (MODULOS subs) e as abas do Financeiro/Administração.
 * Não toca em `window` nem em estado — `buscar()` é pura e testável.
 *
 * Quando o backend ganhar entidades reais (talhões/animais/lançamentos),
 * basta concatenar mais `Comando[]` antes de chamar `buscar()`.
 */

import type { Tab } from "../components/Shell";

export type GrupoComando =
  | "Financeiro"
  | "Pecuária"
  | "Administração"
  | "Ações";

export interface Comando {
  id: string;
  tab: Tab;
  label: string;
  grupo: GrupoComando;
  sinonimos?: string[];
  acao?: boolean;
  descricao?: string;
}

// Resultado de entidade real vinda do backend (GET /api/busca?q=). Espelha o
// contrato do servidor: cada item aponta para uma aba de módulo (`tab`) e traz
export interface ResultadoBusca {
  tipo: "categoria" | "fornecedor";
  entidadeId: string;
  label: string;
  sublabel: string;
  tab: string;
  grupo: string;
}

// ── O índice estático ───────────────────────────────────────────────────────
// Labels REAIS (mesmos do AppSidebar). O AppSidebar relabela "plano"→"Categorias";
// replicamos aqui para o usuário achar pelos dois nomes.
export const COMANDOS: Comando[] = [
  // — Financeiro (grupo "Visão & gestão" / abas do ABAS) —
  { id: "fin-dashboard", tab: "dashboard", label: "Dashboard", grupo: "Financeiro", sinonimos: ["painel", "visão geral", "início", "home", "executivo"], descricao: "Visão executiva, gráficos e números" },
  { id: "fin-gastos", tab: "gastos", label: "Gastos", grupo: "Financeiro", sinonimos: ["despesa", "despesas", "custo", "custos", "saída", "saídas", "lançamentos", "notas"], descricao: "Tabela de lançamentos e notas fiscais" },
  { id: "fin-lancar", tab: "lancar", label: "Lançar", grupo: "Financeiro", sinonimos: ["lançamento", "registrar", "entrada", "receita", "saída", "nova nota"], descricao: "Registrar entrada (receita) ou saída (gasto)" },
  { id: "fin-caixinha", tab: "caixinha", label: "Caixinha", grupo: "Financeiro", sinonimos: ["fundo fixo", "dinheiro", "troco", "caixa pequeno", "vale"], descricao: "Fundo fixo em dinheiro — entradas, saídas e saldo" },
  // "fin-plano"/"fin-ia" removidos: abas Categorias e IA financeira ocultas até
  // terem backend real (ver data/acessos.ts).
  { id: "fin-relatorio", tab: "relatorio", label: "Relatórios", grupo: "Financeiro", sinonimos: ["central de relatórios", "relatório gerencial", "dre", "fluxo de caixa"], descricao: "Central de relatórios de toda a fazenda" },
  { id: "estoque", tab: "estoque", label: "Estoque", grupo: "Financeiro", sinonimos: ["insumo", "insumos", "saldo", "almoxarifado", "medicamento", "produto", "defensivo", "fertilizante"], descricao: "Estoque de insumos — saldos, movimentos e ajustes" },

  // — Pecuária: cadastro individual único, independentemente da finalidade —
  { id: "pec-rebanho", tab: "pec-rebanho", label: "Rebanho", grupo: "Pecuária", sinonimos: ["rebanho", "pecuária", "vaca", "vacas", "boi", "gado", "bovino", "animais", "brinco", "ficha do animal", "lote", "movimentar", "saída", "pesagem"], descricao: "Cadastro de animais do rebanho" },
  { id: "acao-novo-animal", tab: "pec-rebanho", label: "Novo animal", grupo: "Ações", acao: true, sinonimos: ["cadastrar animal", "novo animal", "cadastrar gado", "nova vaca", "registrar gado", "novo bovino"], descricao: "Cadastrar um novo animal no rebanho" },


  // Registros coletivos preexistentes permanecem acessíveis dentro de Pecuária.


  // — Administração (rodapé da sidebar) —
  { id: "adm-cadastros", tab: "cadastros", label: "Cadastros", grupo: "Administração", sinonimos: ["produtos", "fornecedores", "clientes", "registro"] },
  { id: "adm-config", tab: "config", label: "Configurações", grupo: "Administração", sinonimos: ["config", "ajustes", "preferências", "setup"] },
  { id: "adm-sitios", tab: "sitios", label: "Sítios", grupo: "Administração", sinonimos: ["sítio", "propriedades", "propriedade", "fazendas", "unidades", "cadastrar sítio"] },
  { id: "adm-acessos", tab: "acessos", label: "Acessos", grupo: "Administração", sinonimos: ["permissões", "usuários", "perfis", "convidar", "permissão", "papéis"] },

  // — Ações (atalhos para a aba certa) —
  { id: "acao-lancar-gasto", tab: "lancar", label: "Lançar gasto", grupo: "Ações", acao: true, sinonimos: ["nova despesa", "registrar saída", "novo lançamento", "lançar despesa", "registrar gasto"], descricao: "Registrar uma nova saída" },
  { id: "acao-relatorio-gerencial", tab: "relatorio", label: "Relatório financeiro gerencial", grupo: "Ações", acao: true, sinonimos: ["relatório gerencial", "saldo por conta", "compromissos", "exportar pdf", "exportar csv", "relatório financeiro"], descricao: "Montar e exportar o relatório financeiro do período" },
  { id: "acao-relatorio", tab: "relatorio", label: "Abrir relatórios", grupo: "Ações", acao: true, sinonimos: ["criar relatório", "exportar", "pdf", "csv", "fechamento"], descricao: "Abrir a central de relatórios" },
  { id: "acao-cadastros", tab: "cadastros", label: "Cadastros", grupo: "Ações", acao: true, sinonimos: ["produtos", "fornecedores", "registrar cadastro"], descricao: "Abrir os cadastros" },
];

// IDs (do array COMANDOS) curados para a tela vazia — o primeiro Painel/Dashboard
// de cada módulo + os destinos-topo do Financeiro, em ordem de navegação.
const CURADORIA_IDS = [
  "fin-dashboard",
  "fin-gastos",
  "fin-lancar",
  "fin-relatorio",
  "pec-rebanho",
];

// ── Normalização ────────────────────────────────────────────────────────────
// minúsculas + remove acentos (NFD) — busca tolerante: "nutricao" acha "Nutrição".
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokens(q: string): string[] {
  return normalizar(q).split(/\s+/).filter(Boolean);
}

// Posições de rank (menor = melhor):
//  0 label começa com a query inteira
//  1 alguma palavra do label começa com a query inteira
//  2 label contém a query inteira (substring)
//  3 sinônimo OU grupo casa (fallback)
function rankComando(c: Comando, qFull: string): number {
  const label = normalizar(c.label);
  const grupo = normalizar(c.grupo);
  const sins = (c.sinonimos || []).map(normalizar);

  if (label.startsWith(qFull)) return 0;
  if (label.split(/\s+/).some((w) => w.startsWith(qFull))) return 1;
  if (label.includes(qFull)) return 2;
  if (sins.some((s) => s.includes(qFull)) || grupo.includes(qFull)) return 3;
  return 4; // não casou no full — só sobreviveu pelo filtro por tokens
}

// Um comando "casa" o token se ele aparece (substring) em label, grupo ou sinônimo.
function casaToken(c: Comando, t: string): boolean {
  if (normalizar(c.label).includes(t)) return true;
  if (normalizar(c.grupo).includes(t)) return true;
  return (c.sinonimos || []).some((s) => normalizar(s).includes(t));
}

/**
 * Busca pura sobre `comandos`. Query vazia → curadoria de destinos-topo
 * (na ordem de navegação). Senão filtra por TODOS os tokens (AND) e ranqueia,
 * mantendo a ordem original como desempate estável. Limita a ~24 resultados.
 */
export function buscar(comandos: Comando[], q: string): Comando[] {
  const ts = tokens(q);

  // Query vazia → curadoria (na ordem do CURADORIA_IDS, só o que existe na lista).
  if (ts.length === 0) {
    const out: Comando[] = [];
    for (const id of CURADORIA_IDS) {
      const c = comandos.find((x) => x.id === id);
      if (c) out.push(c);
    }
    return out;
  }

  const qFull = normalizar(q).replace(/\s+/g, " ").trim();

  // Filtra: precisa casar TODOS os tokens.
  const candidatos = comandos
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => ts.every((t) => casaToken(c, t)));

  // Ordena por rank; desempate pela ordem original (estável).
  candidatos.sort((a, b) => {
    const ra = rankComando(a.c, qFull);
    const rb = rankComando(b.c, qFull);
    if (ra !== rb) return ra - rb;
    return a.i - b.i;
  });

  return candidatos.slice(0, 24).map(({ c }) => c);
}
