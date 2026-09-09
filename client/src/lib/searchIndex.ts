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
  | "Plantio"
  | "Milho"
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
// o `entidadeId` que o cockpit daquele módulo abre (talhão/animal/lote id).
export interface ResultadoBusca {
  tipo: "talhao" | "animal" | "lote" | "categoria" | "fornecedor";
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
  { id: "fin-relatorio", tab: "relatorio", label: "Relatórios", grupo: "Financeiro", sinonimos: ["central de relatórios", "relatório gerencial", "rebanho", "reprodução", "sanidade", "produção", "dre", "fluxo de caixa"], descricao: "Central de relatórios de toda a fazenda" },

  // — Pecuária: cadastro individual único, independentemente da finalidade —
  { id: "reb-dashboard", tab: "reb-dashboard", label: "Painel", grupo: "Pecuária", sinonimos: ["rebanho", "pecuária", "leite", "corte", "visão geral", "início"], descricao: "Painel unificado da pecuária" },
  { id: "reb-animal", tab: "reb-animal", label: "Animal", grupo: "Pecuária", sinonimos: ["vaca", "vacas", "boi", "gado", "rebanho", "bovino", "brinco", "ficha do animal"] },
  { id: "reb-reproducao", tab: "reb-reproducao", label: "Reprodução", grupo: "Pecuária", sinonimos: ["cio", "inseminação", "iatf", "prenhez", "gestação", "dg", "diagnóstico", "parto", "secagem"] },
  { id: "reb-acasalamento", tab: "reb-acasalamento", label: "Acasalamento", grupo: "Pecuária", sinonimos: ["cruzamento", "touro", "genética", "consanguinidade", "plano", "pedigree"] },
  { id: "reb-fiv", tab: "reb-fiv", label: "FIV / TE", grupo: "Pecuária", sinonimos: ["fiv", "te", "transferência de embrião", "coleta", "oócito", "embrião", "doadora", "pool", "aspiração"] },
  { id: "reb-sanidade", tab: "reb-sanidade", label: "Sanidade", grupo: "Pecuária", sinonimos: ["vacina", "vacinação", "doença", "carência", "tratamento", "mastite", "ccs", "saúde"] },
  { id: "reb-nutricao", tab: "reb-nutricao", label: "Nutrição", grupo: "Pecuária", sinonimos: ["dieta", "ração", "alimentação", "lote", "trato", "concentrado", "volumoso"] },
  { id: "reb-producao", tab: "reb-producao", label: "Controle leiteiro", grupo: "Pecuária", sinonimos: ["produção", "leite", "litros", "ordenha", "tanque", "controle leiteiro"] },
  { id: "reb-estoque", tab: "reb-estoque", label: "Estoque", grupo: "Pecuária", sinonimos: ["insumo", "insumos", "saldo", "almoxarifado", "medicamento", "produto"] },
  { id: "reb-custo", tab: "reb-custo", label: "Custo", grupo: "Pecuária", sinonimos: ["custeio", "custo vaca/dia", "rentabilidade", "margem", "despesa", "litro"] },

  // — Plantio · café (MODULOS[plantio].subs) —
  { id: "pla-dashboard", tab: "pla-dashboard", label: "Painel", grupo: "Plantio", sinonimos: ["plantio", "lavoura", "café", "visão geral", "início"], descricao: "Painel da lavoura de café" },
  { id: "pla-talhao", tab: "pla-talhao", label: "Talhão", grupo: "Plantio", sinonimos: ["lavoura", "gleba", "plantio", "área", "parcela", "campo"] },
  { id: "pla-fenologia", tab: "pla-fenologia", label: "Fenologia", grupo: "Plantio", sinonimos: ["florada", "estádio", "maturação", "ciclo", "grão", "chumbinho"] },
  { id: "pla-fitossanidade", tab: "pla-fitossanidade", label: "Fitossanidade", grupo: "Plantio", sinonimos: ["ferrugem", "broca", "praga", "pragas", "doença", "doenças", "mip", "cercospora", "bicho-mineiro", "defensivo"] },
  { id: "pla-nutricao", tab: "pla-nutricao", label: "Nutrição & solo", grupo: "Plantio", sinonimos: ["adubação", "adubo", "solo", "npk", "foliar", "calagem", "fertilizante", "análise de solo"] },
  { id: "pla-colheita", tab: "pla-colheita", label: "Colheita", grupo: "Plantio", sinonimos: ["safra", "derriça", "saca", "sacas", "café", "rendimento", "colher"] },
  { id: "pla-planejamento", tab: "pla-planejamento", label: "Planejamento", grupo: "Plantio", sinonimos: ["calendário", "cronograma", "agenda", "operações", "safra"] },
  { id: "pla-estoque", tab: "pla-estoque", label: "Estoque", grupo: "Plantio", sinonimos: ["insumo", "insumos", "saldo", "defensivo", "fertilizante", "almoxarifado"] },
  { id: "pla-custo", tab: "pla-custo", label: "Custo", grupo: "Plantio", sinonimos: ["custeio", "custo por saca", "rentabilidade", "margem", "despesa"] },

  // Registros coletivos preexistentes permanecem acessíveis dentro de Pecuária.
  { id: "cor-dashboard", tab: "cor-dashboard", label: "Resumo dos lotes", grupo: "Pecuária", sinonimos: ["corte", "plantel", "boi", "engorda", "visão geral", "lotes coletivos"], descricao: "Resumo dos registros coletivos" },
  { id: "cor-lote", tab: "cor-lote", label: "Lotes coletivos", grupo: "Pecuária", sinonimos: ["lote", "boiada", "grupo", "tropa", "animais", "histórico"] },
  { id: "cor-pesagem", tab: "cor-pesagem", label: "Pesagens", grupo: "Pecuária", sinonimos: ["peso", "gmd", "arroba", "balança", "ganho de peso"] },
  { id: "cor-pasto", tab: "cor-pasto", label: "Pasto", grupo: "Pecuária", sinonimos: ["pastagem", "piquete", "capim", "lotação", "forragem"] },
  { id: "cor-sanidade", tab: "cor-sanidade", label: "Sanidade coletiva", grupo: "Pecuária", sinonimos: ["vacina", "doença", "carência", "tratamento", "vermífugo", "saúde", "lote"] },
  { id: "cor-nutricao", tab: "cor-nutricao", label: "Nutrição coletiva", grupo: "Pecuária", sinonimos: ["dieta", "ração", "suplemento", "sal mineral", "cocho", "confinamento", "lote"] },
  { id: "cor-comercial", tab: "cor-comercial", label: "Comercialização", grupo: "Pecuária", sinonimos: ["venda", "vendas", "abate", "frigorífico", "preço", "arroba", "negócio"] },
  { id: "cor-custo", tab: "cor-custo", label: "Custos dos lotes", grupo: "Pecuária", sinonimos: ["custeio", "custo por arroba", "rentabilidade", "margem", "despesa"] },

  // — Milho (MODULOS[cultivo].subs) —
  { id: "mil-dashboard", tab: "mil-dashboard", label: "Painel", grupo: "Milho", sinonimos: ["milho", "cultivo", "safra", "visão geral", "início", "painel"], descricao: "Painel do milho" },
  { id: "mil-safras", tab: "mil-safras", label: "Safras", grupo: "Milho", sinonimos: ["milho", "safra", "safrinha", "cultivo", "lavoura de milho", "custo de safra"], descricao: "Safras de milho — custo de safra" },
  { id: "mil-custos", tab: "mil-custos", label: "Lançar custos", grupo: "Milho", sinonimos: ["custeio", "adubo", "adubação", "horas de trator", "caminhão", "lançar custo", "despesa da safra", "apontamento"] },
  { id: "mil-producao", tab: "mil-producao", label: "Produção", grupo: "Milho", sinonimos: ["colheita", "saca", "sacas", "silagem", "toneladas", "grão"] },
  { id: "mil-silos", tab: "mil-silos", label: "Silos", grupo: "Milho", sinonimos: ["silo", "estoque", "silagem", "saldo", "armazenagem", "comida de vaca"] },
  { id: "mil-custo", tab: "mil-custo", label: "Custo de produção", grupo: "Milho", sinonimos: ["custo por saca", "custo por tonelada", "custo por hectare", "custeio", "rentabilidade", "margem"] },

  // — Administração (rodapé da sidebar) —
  { id: "adm-cadastros", tab: "cadastros", label: "Cadastros", grupo: "Administração", sinonimos: ["produtos", "fornecedores", "clientes", "raças", "registro"] },
  { id: "adm-config", tab: "config", label: "Configurações", grupo: "Administração", sinonimos: ["config", "ajustes", "preferências", "preço do leite", "setup"] },
  { id: "adm-acessos", tab: "acessos", label: "Acessos", grupo: "Administração", sinonimos: ["permissões", "usuários", "perfis", "convidar", "permissão", "papéis"] },
  { id: "eqp-dashboard", tab: "eqp-dashboard", label: "Painel", grupo: "Administração", sinonimos: ["equipe", "ponto", "folha", "rh", "visão geral", "painel"], descricao: "Painel da equipe" },
  { id: "eqp-funcionarios", tab: "eqp-funcionarios", label: "Funcionários", grupo: "Administração", sinonimos: ["equipe", "colaboradores", "peão", "empregados", "salário", "cadastro de funcionário"] },
  { id: "eqp-ponto", tab: "eqp-ponto", label: "Ponto", grupo: "Administração", sinonimos: ["jornada", "bater ponto", "entrada", "saída", "horas", "presença", "folha de ponto"] },
  { id: "eqp-folha", tab: "eqp-folha", label: "Folha", grupo: "Administração", sinonimos: ["folha de pagamento", "hora extra", "salário", "pagamento", "extras", "total a pagar"] },

  // — Ações (atalhos para a aba certa) —
  { id: "acao-lancar-gasto", tab: "lancar", label: "Lançar gasto", grupo: "Ações", acao: true, sinonimos: ["nova despesa", "registrar saída", "novo lançamento", "lançar despesa", "registrar gasto"], descricao: "Registrar uma nova saída" },
  { id: "acao-novo-talhao", tab: "pla-talhao", label: "Novo talhão", grupo: "Ações", acao: true, sinonimos: ["cadastrar talhão", "nova lavoura", "nova gleba", "novo plantio", "nova área"], descricao: "Cadastrar um novo talhão" },
  { id: "acao-novo-animal", tab: "reb-animal", label: "Novo animal", grupo: "Ações", acao: true, sinonimos: ["cadastrar animal", "nova vaca", "registrar gado", "novo bovino"], descricao: "Cadastrar um novo animal" },
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
  "reb-dashboard",
  "reb-animal",
  "pla-dashboard",
  "cor-dashboard",
  "mil-dashboard",
  "eqp-dashboard",
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
