/** Catálogo de destinos da busca global; revisar junto com páginas, fluxos e permissões. */
import { tabToPath } from "../router";
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
  caminho: string;
  exigeLancamento?: boolean;
  exigeValores?: boolean;
}

// Resultado de entidade real vinda do backend (GET /api/busca?q=). Espelha o
// contrato do servidor: cada item aponta para uma aba de módulo (`tab`) e traz
export interface ResultadoBusca {
  tipo: string;
  entidadeId: string;
  label: string;
  sublabel: string;
  tab: string;
  grupo: string;
  caminho: string;
}

// ── O índice estático ───────────────────────────────────────────────────────
// Labels REAIS (mesmos do AppSidebar). O AppSidebar relabela "plano"→"Categorias";
// replicamos aqui para o usuário achar pelos dois nomes.
const comandosBase: (Omit<Comando, "caminho"> & { caminho?: string })[] = [
  // — Financeiro (grupo "Visão & gestão" / abas do ABAS) —
  { id: "fin-dashboard", tab: "dashboard", label: "Visão geral", grupo: "Financeiro", sinonimos: ["dashboard", "painel", "início", "home", "executivo"], descricao: "Resultados, saldos e compromissos do período" },
  { id: "fin-gastos", tab: "gastos", label: "Compromissos", grupo: "Financeiro", sinonimos: ["gastos", "despesa", "despesas", "custo", "custos", "saída", "saídas", "lançamentos", "notas"], descricao: "Valores a pagar e a receber" },
  { id: "fin-lancar", tab: "lancar", label: "Operações", grupo: "Financeiro", sinonimos: ["lançar", "lançamento", "registrar", "entrada", "receita", "saída", "nova nota", "nova operação"], descricao: "Fatos de negócio e seus efeitos financeiros e físicos" },
  { id: "fin-caixinha", tab: "caixinha", label: "Contas e extratos", grupo: "Financeiro", sinonimos: ["caixinha", "fundo fixo", "dinheiro", "troco", "caixa pequeno", "vale"], descricao: "Saldos e movimentos das contas" },
  // "fin-plano"/"fin-ia" removidos: abas Categorias e IA financeira ocultas até
  // terem backend real (ver data/acessos.ts).
  { id: "fin-relatorio", tab: "relatorio", label: "Relatórios", grupo: "Financeiro", sinonimos: ["central de relatórios", "relatório gerencial", "dre", "fluxo de caixa"], descricao: "Central de relatórios de toda a fazenda" },
  { id: "estoque", tab: "estoque", label: "Estoque", grupo: "Financeiro", sinonimos: ["insumo", "insumos", "saldo", "almoxarifado", "medicamento", "produto", "defensivo", "fertilizante"], descricao: "Estoque de insumos — saldos, movimentos e ajustes" },

  // — Pecuária: cadastro individual único, independentemente da finalidade —
  { id: "pec-rebanho", tab: "pec-rebanho", label: "Rebanho", grupo: "Pecuária", sinonimos: ["rebanho", "pecuária", "vaca", "vacas", "boi", "gado", "bovino", "animais", "brinco", "ficha do animal", "geral", "histórico do animal", "auditoria do animal", "lote", "movimentar", "saída", "pesagem", "peso", "gmd", "manejo"], descricao: "Cadastro de animais do rebanho" },
  { id: "pec-sanidade", tab: "pec-sanidade", label: "Sanidade", grupo: "Pecuária", sinonimos: ["vacina", "tratamento", "protocolo", "exame"], descricao: "Agenda e registros sanitários" },
  { id: "pec-relatorios", tab: "pec-relatorios", label: "Relatórios da Pecuária", grupo: "Pecuária", sinonimos: ["partos", "indicadores", "emissões", "exportar", "reprodução"], descricao: "Consultar, salvar e reimprimir relatórios reprodutivos" },
  { id: "pec-bezerreiro", tab: "pec-bezerreiro", label: "Bezerreiro", grupo: "Pecuária", sinonimos: ["bezerros", "colostragem", "aleitamento", "coleiras"], descricao: "Animais, alimentação e colostro" },
  { id: "pec-nutricao", tab: "pec-nutricao", label: "Nutrição", grupo: "Pecuária", sinonimos: ["dieta", "receita", "consumo"], descricao: "Dietas e consumo por lote" },
  { id: "acao-novo-animal", caminho: "/pecuaria/rebanho/animais/novo", exigeLancamento: true, tab: "pec-rebanho", label: "Novo animal", grupo: "Ações", acao: true, sinonimos: ["cadastrar animal", "novo animal", "cadastrar gado", "nova vaca", "registrar gado", "novo bovino"], descricao: "Cadastrar um novo animal no rebanho" },


  // Registros coletivos preexistentes permanecem acessíveis dentro de Pecuária.


  // — Administração (rodapé da sidebar) —
  { id: "adm-cadastros", tab: "cadastros", label: "Configurações financeiras", grupo: "Administração", sinonimos: ["cadastros", "produtos", "fornecedores", "clientes", "registro"] },
  { id: "adm-config", tab: "config", label: "Configurações", grupo: "Administração", sinonimos: ["config", "ajustes", "preferências", "setup"] },
  { id: "adm-sitios", tab: "sitios", label: "Sítios", grupo: "Administração", sinonimos: ["sítio", "propriedades", "propriedade", "fazendas", "unidades", "cadastrar sítio"] },
  { id: "adm-acessos", tab: "acessos", label: "Acessos", grupo: "Administração", sinonimos: ["permissões", "usuários", "perfis", "convidar", "permissão", "papéis"] },

  // — Ações (atalhos para a aba certa) —
  { id: "acao-lancar-gasto", tab: "lancar", label: "Abrir operações", grupo: "Ações", acao: true, sinonimos: ["nova despesa", "registrar saída", "novo lançamento", "lançar despesa", "registrar gasto"], descricao: "Consultar operações e iniciar um novo registro" },
  { id: "acao-relatorio-gerencial", tab: "relatorio", label: "Relatório financeiro gerencial", grupo: "Ações", acao: true, sinonimos: ["relatório gerencial", "saldo por conta", "compromissos", "exportar pdf", "exportar csv", "relatório financeiro"], descricao: "Montar e exportar o relatório financeiro do período" },
  { id: "acao-relatorio", tab: "relatorio", label: "Abrir relatórios", grupo: "Ações", acao: true, sinonimos: ["criar relatório", "exportar", "pdf", "csv", "fechamento"], descricao: "Abrir a central de relatórios" },
  { id: "acao-cadastros", tab: "cadastros", label: "Cadastros", grupo: "Ações", acao: true, sinonimos: ["produtos", "fornecedores", "registrar cadastro"], descricao: "Abrir os cadastros" },
  { id: "gerencial", tab: "gerencial", label: "Painel administrativo", grupo: "Administração", sinonimos: ["gestão", "gerencial", "indicadores", "visão da fazenda"] },
  { id: "pec-animais", tab: "pec-rebanho", label: "Animais", grupo: "Pecuária", caminho: "/pecuaria/rebanho/animais", sinonimos: ["brinco", "sisbov", "cadastro", "rebanho"] },
  { id: "pec-lotes", tab: "pec-rebanho", label: "Lotes de animais", grupo: "Pecuária", caminho: "/pecuaria/rebanho/lotes" },
  { id: "pec-reproducao", tab: "pec-reproducao", label: "Reprodução", grupo: "Pecuária", sinonimos: ["inseminação", "cobertura", "gestação", "tentativas", "transferência de embrião", "ciclos"] },
  { id: "pec-visitas", tab: "pec-visitas", label: "Visitas veterinárias", grupo: "Pecuária", sinonimos: ["atendimento", "veterinário", "agenda", "planner"] },
  { id: "pec-leite", tab: "pec-leite", label: "Leite", grupo: "Pecuária", sinonimos: ["produção", "ordenha", "lactação"] },
  ...[
    ["ordenhas", "Ordenhas", "aferição controle leiteiro individual medição"],
    ["producao", "Produção de leite", "custo litro cobertura"],
    ["estoque", "Estoque de leite", "saldo origens parcelas"],
    ["coletas", "Coletas de leite", "retiradas entregas"],
    ["qualidade", "Qualidade do leite", "amostras laudos laboratório ccs cbt gordura proteína"],
    ["vendas", "Vendas de leite", "comercialização comprador fechamento preço"],
    ["destinos", "Alimentação e descarte do leite", "consumo fornecimento casa funcionários"],
    ["relatorios", "Relatórios do leite", "emissões exportação"],
    ["configuracoes", "Configurações de produção", "tanques recipientes ordenha posições vigência"],
  ].map(([secao, label, termos]) => ({ id: `leite-${secao}`, tab: "pec-leite" as Tab, label, grupo: "Pecuária" as GrupoComando, caminho: `/pecuaria/leite?leiteSecao=${secao}`, sinonimos: termos.split(" ") })),
  ...[
    ["ciclos", "Manejo reprodutivo", "tentativas avaliação gestação inseminação cobertura"],
    ["programacoes", "Programações de protocolos", "iatf rodadas tarefas agenda"],
    ["partos", "Partos", "nascimentos crias aborto natimorto"],
    ["indicadores", "Indicadores reprodutivos", "fertilidade concepção iep"],
  ].map(([rotina, label, termos]) => ({ id: `repro-${rotina}`, tab: "pec-reproducao" as Tab, label, grupo: "Pecuária" as GrupoComando, caminho: `/pecuaria/reproducao?rotina=${rotina}`, sinonimos: termos.split(" ") })),
  ...[
    ["agenda", "Agenda sanitária", "tarefas protocolos rodadas"], ["ocorrencias", "Ocorrências sanitárias", "doenças tratamentos"],
    ["aplicacoes", "Aplicações sanitárias", "vacinas medicamentos"], ["exames", "Exames", "coletas resultados"], ["carencias", "Carências", "leite carne prazos"],
  ].map(([aba, label, termos]) => ({ id: `sanidade-${aba}`, tab: "pec-sanidade" as Tab, label, grupo: "Pecuária" as GrupoComando, caminho: `/pecuaria/sanidade?aba=${aba}`, sinonimos: termos.split(" ") })),
  { id: "nutricao-receitas", tab: "pec-nutricao", label: "Receitas nutricionais", grupo: "Pecuária", caminho: "/pecuaria/nutricao?aba=receitas", sinonimos: ["dietas", "ingredientes", "ração"] },
  { id: "nutricao-fechamentos", tab: "pec-nutricao", label: "Fechamentos nutricionais", grupo: "Pecuária", caminho: "/pecuaria/nutricao?aba=fechamentos", sinonimos: ["consumo", "conferência", "nutrição"] },
  ...[
    ["parceiros", "Clientes e fornecedores", "parceiros documento contato"], ["categorias", "Categorias financeiras", "classificação plano de contas"],
    ["centros", "Centros de custo", "centro gerencial"], ["grupos", "Grupos de categorias", "grupo financeiro"], ["produtos", "Cadastro de produtos", "insumos"],
  ].map(([aba, label, termos]) => ({ id: `cadastro-${aba}`, tab: "cadastros" as Tab, label, grupo: "Financeiro" as GrupoComando, caminho: `/financeiro/configuracoes?aba=${aba}`, sinonimos: termos.split(" ") })),
  ...[
    ["rebanho/categorias", "Categorias do rebanho", "regras animais"], ["rebanho/motivos", "Motivos de baixa", "baixas morte venda descarte"],
    ["genetica/racas", "Raças", "genética composição racial"], ["genetica/genitores", "Genitores externos", "touros doadoras filiação genética"],
    ["genetica/material-genetico", "Material genético", "sêmen embriões doadoras touros genética"],
    ["sanidade/protocolos", "Protocolos sanitários", "modelos etapas versão"], ["sanidade/doencas", "Doenças", "sanidade diagnósticos"],
    ["sanidade/tipos-exame", "Tipos de exame", "formatos resultados sanidade"], ["sanidade/tipos-aplicacao", "Tipos de aplicação", "vacinas medicamentos sanidade"],
    ["reproducao/politica", "Política reprodutiva", "reprodução elegibilidade"],
  ].map(([rota, label, termos]) => ({ id: `config-pec-${rota}`, tab: "config" as Tab, label, grupo: "Pecuária" as GrupoComando, caminho: `/configuracoes/pecuaria/${rota}`, sinonimos: termos.split(" ") })),
  { id: "acao-nova-operacao", tab: "lancar", label: "Nova operação", grupo: "Ações", acao: true, exigeLancamento: true, caminho: "/financeiro/operacoes/nova", sinonimos: ["registrar compra", "registrar venda", "lançar despesa"] },
  { id: "acao-nova-visita", tab: "pec-visitas", label: "Planejar visita", grupo: "Ações", acao: true, exigeLancamento: true, caminho: "/pecuaria/visitas/nova", sinonimos: ["nova visita", "veterinário"] },

];

export const COMANDOS: Comando[] = comandosBase.map(c => ({ ...c,
  exigeValores: c.exigeValores ?? ["dashboard", "gastos", "caixinha", "relatorio"].includes(c.tab),
  caminho: c.caminho ?? tabToPath(c.tab),
}));

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
  if (c.descricao && normalizar(c.descricao).includes(t)) return true;
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
