import { prisma } from "../db.js";
import { mesKey, mesLabel, type Tipo } from "./relatorio.js";

// ===========================================================================
// Painel por ATIVIDADE (Leite × Café × Outros).
// Para cada atividade e mês: receita (créditos), despesa operacional (débitos
// em centros não-investimento), investimento (débitos em centros de
// investimento) e o detalhamento por grupo de categoria.
// Tudo em magnitude positiva; o cliente calcula lucro = receita - despesa.
// ===========================================================================

export type AtividadeNome = "Leite" | "Café" | "Outros";

function atividadeDe(centro: string): AtividadeNome {
  const c = centro.toLowerCase();
  if (c.includes("leit")) return "Leite";
  if (c.includes("café") || c.includes("cafe") || c.includes("plantio")) return "Café";
  return "Outros";
}

export interface Serie {
  receita: Record<string, number>;
  despesa: Record<string, number>;
  investimento: Record<string, number>;
  despesaPorGrupo: Record<string, Record<string, number>>; // grupo -> mes -> valor
  receitaPorGrupo: Record<string, Record<string, number>>;
}

export interface Dashboard {
  titulo: string;
  tipo: Tipo;
  meses: { key: string; label: string }[];
  anos: number[];
  atividades: Record<AtividadeNome, Serie>;
  consolidado: Serie;
}

const serieVazia = (): Serie => ({
  receita: {},
  despesa: {},
  investimento: {},
  despesaPorGrupo: {},
  receitaPorGrupo: {},
});

function add(map: Record<string, number>, k: string, v: number) {
  map[k] = (map[k] ?? 0) + v;
}
function add2(mm: Record<string, Record<string, number>>, grupo: string, k: string, v: number) {
  if (!mm[grupo]) mm[grupo] = {};
  mm[grupo][k] = (mm[grupo][k] ?? 0) + v;
}

export async function gerarDashboard(tipo: Tipo = "REALIZADO"): Promise<Dashboard> {
  const situacao = tipo === "REALIZADO" ? "LIQUIDADO" : "ABERTO";
  const lancs = await prisma.lancamento.findMany({
    where: { situacao, estornado: false },
    include: { categoria: { include: { grupoCategoria: true } }, centroCusto: true },
  });

  const atividades: Record<AtividadeNome, Serie> = {
    Leite: serieVazia(),
    Café: serieVazia(),
    Outros: serieVazia(),
  };
  const consolidado = serieVazia();
  const mesesSet = new Set<string>();

  for (const l of lancs) {
    const data = tipo === "REALIZADO" ? l.dataLiquidacao : l.dataVencimento;
    if (!data) continue;
    const key = mesKey(data);
    mesesSet.add(key);

    const ativ = atividadeDe(l.centroCusto.nome);
    const grupo = l.categoria.grupoCategoria.nome;
    const mag = Number(l.valor);
    const alvos = [atividades[ativ], consolidado];

    if (l.natureza === "CREDITO") {
      for (const s of alvos) {
        add(s.receita, key, mag);
        add2(s.receitaPorGrupo, grupo, key, mag);
      }
    } else if (l.centroCusto.ehInvestimento) {
      for (const s of alvos) add(s.investimento, key, mag);
    } else {
      for (const s of alvos) {
        add(s.despesa, key, mag);
        add2(s.despesaPorGrupo, grupo, key, mag);
      }
    }
  }

  const keys = [...mesesSet].sort();
  const meses = keys.map((key) => ({ key, label: mesLabel(key) }));
  const anos = [...new Set(keys.map((k) => Number(k.slice(0, 4))))].sort();

  return {
    titulo: "Painel por Atividade — Fazenda Rio Novo",
    tipo,
    meses,
    anos,
    atividades,
    consolidado,
  };
}
