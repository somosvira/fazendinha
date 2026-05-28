import { prisma } from "../db.js";
import { Natureza } from "@prisma/client";
import { mesKey, mesLabel, type Tipo } from "./relatorio.js";

// ===========================================================================
// Relatório MENSAL — detalhe de um único mês: linhas = C/D > Grupo > Categoria,
// colunas = Centro de Custo (espelha as abas "01.2025", "05.2026"...).
// ===========================================================================

export interface MensalCategoria {
  categoria: string;
  porCentro: Record<string, number>; // centro -> valor (com sinal)
  total: number;
}
export interface MensalGrupo {
  grupo: string;
  categorias: MensalCategoria[];
  subtotais: Record<string, number>;
  total: number;
}
export interface MensalNatureza {
  natureza: Natureza;
  grupos: MensalGrupo[];
  totais: Record<string, number>;
  total: number;
}
export interface RelatorioMensal {
  titulo: string;
  mesKey: string;
  label: string;
  tipo: Tipo;
  centros: string[];
  naturezas: MensalNatureza[];
  totalGeral: Record<string, number>;
  totalGeralAcumulado: number;
}

function add(map: Record<string, number>, key: string, v: number) {
  map[key] = (map[key] ?? 0) + v;
}

export async function listarMesesRealizados(): Promise<string[]> {
  const lancs = await prisma.lancamento.findMany({
    where: { situacao: "LIQUIDADO", estornado: false, dataLiquidacao: { not: null } },
    select: { dataLiquidacao: true },
  });
  const set = new Set<string>();
  for (const l of lancs) if (l.dataLiquidacao) set.add(mesKey(l.dataLiquidacao));
  return [...set].sort();
}

export async function gerarRelatorioMensal(mes: string, tipo: Tipo = "REALIZADO"): Promise<RelatorioMensal> {
  const situacao = tipo === "REALIZADO" ? "LIQUIDADO" : "ABERTO";
  const lancs = await prisma.lancamento.findMany({
    where: { situacao, estornado: false },
    include: { categoria: { include: { grupoCategoria: true } }, centroCusto: true },
  });

  type GMap = Map<string, Map<string, Record<string, number>>>; // grupo -> categoria -> {centro: valor}
  const acc = new Map<Natureza, GMap>();
  const centrosSet = new Set<string>();
  const grupoOrdem = new Map<string, number>();

  for (const l of lancs) {
    const data = tipo === "REALIZADO" ? l.dataLiquidacao : l.dataVencimento;
    if (!data || mesKey(data) !== mes) continue;
    const sinal = l.natureza === "CREDITO" ? 1 : -1;
    const valor = sinal * Number(l.valor);
    const centro = l.centroCusto.nome;
    const grupo = l.categoria.grupoCategoria.nome;
    const categoria = l.categoria.nome;
    centrosSet.add(centro);
    grupoOrdem.set(grupo, l.categoria.grupoCategoria.id);

    if (!acc.has(l.natureza)) acc.set(l.natureza, new Map());
    const gMap = acc.get(l.natureza)!;
    if (!gMap.has(grupo)) gMap.set(grupo, new Map());
    const cMap = gMap.get(grupo)!;
    if (!cMap.has(categoria)) cMap.set(categoria, {});
    add(cMap.get(categoria)!, centro, valor);
  }

  const centros = [...centrosSet].sort();
  const totalGeral: Record<string, number> = {};
  const naturezas: MensalNatureza[] = [];

  for (const natureza of ["CREDITO", "DEBITO"] as Natureza[]) {
    const gMap = acc.get(natureza);
    if (!gMap) continue;
    const grupos: MensalGrupo[] = [];
    const natTotais: Record<string, number> = {};
    const gruposOrdenados = [...gMap.keys()].sort((a, b) => (grupoOrdem.get(a) ?? 99) - (grupoOrdem.get(b) ?? 99));
    for (const grupo of gruposOrdenados) {
      const cMap = gMap.get(grupo)!;
      const categorias: MensalCategoria[] = [];
      const subtotais: Record<string, number> = {};
      for (const [categoria, porCentro] of [...cMap.entries()].sort()) {
        let total = 0;
        for (const [centro, v] of Object.entries(porCentro)) {
          add(subtotais, centro, v);
          add(natTotais, centro, v);
          add(totalGeral, centro, v);
          total += v;
        }
        categorias.push({ categoria, porCentro, total });
      }
      grupos.push({ grupo, categorias, subtotais, total: Object.values(subtotais).reduce((a, b) => a + b, 0) });
    }
    naturezas.push({ natureza, grupos, totais: natTotais, total: Object.values(natTotais).reduce((a, b) => a + b, 0) });
  }

  return {
    titulo: "Relatório Detalhado RIO NOVO (por fluxo de caixa)",
    mesKey: mes,
    label: mesLabel(mes),
    tipo,
    centros,
    naturezas,
    totalGeral,
    totalGeralAcumulado: Object.values(totalGeral).reduce((a, b) => a + b, 0),
  };
}

// ===========================================================================
// Realizado DIÁRIO — um mês, dia a dia, detalhando fornecedor/categoria.
// ===========================================================================

export interface LinhaDiaria {
  natureza: Natureza;
  grupo: string;
  categoria: string;
  fornecedor: string | null;
  centro: string;
  documento: string | null;
  valor: number; // com sinal
}
export interface Dia {
  data: string; // YYYY-MM-DD
  label: string; // DD/MM/YYYY
  linhas: LinhaDiaria[];
  total: number;
}
export interface RelatorioDiario {
  titulo: string;
  mesKey: string;
  label: string;
  dias: Dia[];
  total: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function gerarRealizadoDiario(mes: string): Promise<RelatorioDiario> {
  const lancs = await prisma.lancamento.findMany({
    where: { situacao: "LIQUIDADO", estornado: false, dataLiquidacao: { not: null } },
    include: {
      categoria: { include: { grupoCategoria: true } },
      centroCusto: true,
      clienteFornecedor: true,
    },
  });

  const porDia = new Map<string, LinhaDiaria[]>();
  for (const l of lancs) {
    if (!l.dataLiquidacao || mesKey(l.dataLiquidacao) !== mes) continue;
    const sinal = l.natureza === "CREDITO" ? 1 : -1;
    const dia = isoDate(l.dataLiquidacao);
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia)!.push({
      natureza: l.natureza,
      grupo: l.categoria.grupoCategoria.nome,
      categoria: l.categoria.nome,
      fornecedor: l.clienteFornecedor?.nome ?? null,
      centro: l.centroCusto.nome,
      documento: l.numeroDocumento,
      valor: sinal * Number(l.valor),
    });
  }

  const dias: Dia[] = [...porDia.keys()].sort().map((data) => {
    const linhas = porDia
      .get(data)!
      .sort((a, b) => a.natureza.localeCompare(b.natureza) || a.grupo.localeCompare(b.grupo));
    return {
      data,
      label: data.split("-").reverse().join("/"),
      linhas,
      total: linhas.reduce((s, l) => s + l.valor, 0),
    };
  });

  return {
    titulo: "Relatório Detalhado RIO NOVO — Realizado Diário",
    mesKey: mes,
    label: mesLabel(mes),
    dias,
    total: dias.reduce((s, d) => s + d.total, 0),
  };
}
