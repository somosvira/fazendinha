import { prisma } from "../db.js";
import { Natureza } from "@prisma/client";

// ---------------------------------------------------------------------------
// Motor do "Resultado Operacional" (regime de CAIXA).
//   REALIZADO  -> lançamentos LIQUIDADOS, datados pela liquidação.
//   PROJECAO   -> lançamentos em ABERTO, datados pelo vencimento.
// Estrutura de saída: Centro de Custo > Natureza > Grupo > Categoria,
// com uma coluna por mês. Débitos entram com sinal negativo (como no original).
// ---------------------------------------------------------------------------

export type Tipo = "REALIZADO" | "PROJECAO";

export interface MesCol {
  ano: number;
  mes: number; // 1-12
  label: string; // "01/2025"
  key: string; // "2025-01"
}

export interface LinhaCategoria {
  categoria: string;
  valores: Record<string, number>; // key do mês -> valor (com sinal)
  total: number;
}
export interface BlocoGrupo {
  grupo: string;
  categorias: LinhaCategoria[];
  subtotais: Record<string, number>;
  total: number;
}
export interface BlocoNatureza {
  natureza: Natureza;
  grupos: BlocoGrupo[];
  totais: Record<string, number>; // "Credito Total" / "Debito Total" por mês
  total: number;
}
export interface BlocoCentro {
  centro: string;
  naturezas: BlocoNatureza[];
  totais: Record<string, number>; // resultado líquido do centro por mês
  total: number;
}
export interface Relatorio {
  titulo: string;
  tipo: Tipo;
  meses: MesCol[];
  centros: BlocoCentro[];
  totalGeral: Record<string, number>;
  totalGeralAcumulado: number;
}

export function mesKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function mesLabel(key: string): string {
  const [ano, mes] = key.split("-");
  return `${mes}/${ano}`;
}
function add(map: Record<string, number>, key: string, v: number) {
  map[key] = (map[key] ?? 0) + v;
}

export async function gerarResultadoOperacional(tipo: Tipo): Promise<Relatorio> {
  const situacao = tipo === "REALIZADO" ? "LIQUIDADO" : "ABERTO";

  const lancs = await prisma.lancamento.findMany({
    where: { situacao, estornado: false },
    include: {
      categoria: { include: { grupoCategoria: true } },
      centroCusto: true,
    },
    orderBy: [{ centroCustoId: "asc" }],
  });

  // Coleta de meses presentes.
  const mesesSet = new Set<string>();
  // centro -> natureza -> grupo -> categoria -> {mesKey: valor}
  type Acc = Map<string, Map<Natureza, Map<string, Map<string, Record<string, number>>>>>;
  const acc: Acc = new Map();
  const centroOrdem = new Map<string, number>();
  const grupoOrdem = new Map<string, number>();

  for (const l of lancs) {
    const data = tipo === "REALIZADO" ? l.dataLiquidacao : l.dataVencimento;
    if (!data) continue;
    const key = mesKey(data);
    mesesSet.add(key);

    const sinal = l.natureza === "CREDITO" ? 1 : -1;
    const valor = sinal * Number(l.valor);

    const centro = l.centroCusto.nome;
    const grupo = l.categoria.grupoCategoria.nome;
    const categoria = l.categoria.nome;
    centroOrdem.set(centro, l.centroCusto.ordem);
    grupoOrdem.set(grupo, l.categoria.grupoCategoria.id);

    if (!acc.has(centro)) acc.set(centro, new Map());
    const nMap = acc.get(centro)!;
    if (!nMap.has(l.natureza)) nMap.set(l.natureza, new Map());
    const gMap = nMap.get(l.natureza)!;
    if (!gMap.has(grupo)) gMap.set(grupo, new Map());
    const cMap = gMap.get(grupo)!;
    if (!cMap.has(categoria)) cMap.set(categoria, {});
    add(cMap.get(categoria)!, key, valor);
  }

  const meses: MesCol[] = [...mesesSet]
    .sort()
    .map((k) => {
      const [ano, mes] = k.split("-").map(Number);
      return { ano, mes, key: k, label: `${String(mes).padStart(2, "0")}/${ano}` };
    });

  // Monta a árvore com totais.
  const totalGeral: Record<string, number> = {};
  const centros: BlocoCentro[] = [];

  const centrosOrdenados = [...acc.keys()].sort(
    (a, b) => (centroOrdem.get(a) ?? 99) - (centroOrdem.get(b) ?? 99)
  );

  for (const centro of centrosOrdenados) {
    const nMap = acc.get(centro)!;
    const naturezas: BlocoNatureza[] = [];
    const centroTotais: Record<string, number> = {};

    // Crédito antes de Débito.
    const ordemNat: Natureza[] = ["CREDITO", "DEBITO"];
    for (const natureza of ordemNat) {
      const gMap = nMap.get(natureza);
      if (!gMap) continue;
      const grupos: BlocoGrupo[] = [];
      const natTotais: Record<string, number> = {};

      const gruposOrdenados = [...gMap.keys()].sort(
        (a, b) => (grupoOrdem.get(a) ?? 99) - (grupoOrdem.get(b) ?? 99)
      );
      for (const grupo of gruposOrdenados) {
        const cMap = gMap.get(grupo)!;
        const categorias: LinhaCategoria[] = [];
        const subtotais: Record<string, number> = {};
        for (const [categoria, valores] of [...cMap.entries()].sort()) {
          let total = 0;
          for (const [k, v] of Object.entries(valores)) {
            add(subtotais, k, v);
            add(natTotais, k, v);
            add(centroTotais, k, v);
            add(totalGeral, k, v);
            total += v;
          }
          categorias.push({ categoria, valores, total });
        }
        grupos.push({
          grupo,
          categorias,
          subtotais,
          total: Object.values(subtotais).reduce((a, b) => a + b, 0),
        });
      }
      naturezas.push({
        natureza,
        grupos,
        totais: natTotais,
        total: Object.values(natTotais).reduce((a, b) => a + b, 0),
      });
    }

    centros.push({
      centro,
      naturezas,
      totais: centroTotais,
      total: Object.values(centroTotais).reduce((a, b) => a + b, 0),
    });
  }

  return {
    titulo: "Relatório Detalhado RIO NOVO (por fluxo de caixa)",
    tipo,
    meses,
    centros,
    totalGeral,
    totalGeralAcumulado: Object.values(totalGeral).reduce((a, b) => a + b, 0),
  };
}
