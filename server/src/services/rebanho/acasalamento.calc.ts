// Cálculo puro da recomendação de acasalamento — sem I/O, testável isoladamente.
// Dado uma vaca e a biblioteca de reprodutores, ranqueia os touros por mérito genético
// (PTA leite + TPI normalizados) e evita consanguinidade (não cruzar com o próprio pai).

export interface ReprodutorCand {
  id: number;
  nome: string;
  codigo: string | null;
  ptaLeite: number | null;
  tpi: number | null;
}

export interface VacaAlvo {
  paiNome: string | null; // nome/código do pai da vaca (consanguinidade direta)
}

export interface Recomendacao {
  id: number;
  nome: string;
  score: number; // [0,1] mérito genético; 0 para consanguíneo ou sem métrica
  consanguineo: boolean;
  motivo: string;
}

// Normaliza um campo para [0,1] via min-max sobre o catálogo. Se todos iguais → 0.5 (neutro)
// para quem tem valor; quem não tem valor não pontua nesse campo.
function normalizar(cands: readonly ReprodutorCand[], campo: "ptaLeite" | "tpi"): Map<number, number> {
  const vals = cands.map((c) => c[campo]).filter((v): v is number => v != null);
  const out = new Map<number, number>();
  if (vals.length === 0) return out;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min;
  for (const c of cands) {
    const v = c[campo];
    if (v == null) continue;
    out.set(c.id, span === 0 ? 0.5 : (v - min) / span);
  }
  return out;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function recomendar(vaca: VacaAlvo, reprodutores: readonly ReprodutorCand[]): Recomendacao[] {
  if (reprodutores.length === 0) return [];
  const nLeite = normalizar(reprodutores, "ptaLeite");
  const nTpi = normalizar(reprodutores, "tpi");
  const pai = norm(vaca.paiNome);

  const recs: Recomendacao[] = reprodutores.map((c) => {
    const consanguineo = pai !== "" && (norm(c.nome) === pai || (c.codigo != null && norm(c.codigo) === pai));
    // score = média das métricas disponíveis; 0 se nenhuma.
    const partes: number[] = [];
    if (nLeite.has(c.id)) partes.push(nLeite.get(c.id)!);
    if (nTpi.has(c.id)) partes.push(nTpi.get(c.id)!);
    const meritoBruto = partes.length ? partes.reduce((a, b) => a + b, 0) / partes.length : 0;
    const score = consanguineo ? 0 : Math.round(meritoBruto * 1000) / 1000;

    const motivo = consanguineo
      ? "consanguíneo — evitar (é o pai da vaca)"
      : partes.length === 0
        ? "sem índices genéticos cadastrados"
        : (nLeite.get(c.id) ?? 0) >= (nTpi.get(c.id) ?? 0)
          ? "bom PTA de leite"
          : "bom TPI";

    return { id: c.id, nome: c.nome, score, consanguineo, motivo };
  });

  // Não-consanguíneos primeiro (score desc); consanguíneos no fim (desempate por id).
  return recs.sort((a, b) =>
    Number(a.consanguineo) - Number(b.consanguineo) || b.score - a.score || a.id - b.id);
}
