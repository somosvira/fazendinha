// Cálculo puro do filtro de animais salvo — sem I/O. Normaliza os critérios salvos para o
// formato aceito pelo listarAnimais (ignora vazios). Espelha FILTRO do IDEagri.

export interface FiltroSalvo {
  status: string;
  grupoId: number | null;
  setor: string | null;
  categoria: string | null;
  busca: string | null;
}

export interface CriteriosQuery {
  status: "ATIVO" | "BAIXADO" | "TODOS";
  grupoId?: number;
  setor?: string;
  categoria?: string;
  q?: string;
}

const STATUS_VALIDOS = new Set(["ATIVO", "BAIXADO", "TODOS"]);

// Converte um filtro salvo nos parâmetros de consulta (só os campos preenchidos).
export function criteriosParaQuery(filtro: FiltroSalvo): CriteriosQuery {
  const status = STATUS_VALIDOS.has(filtro.status) ? (filtro.status as CriteriosQuery["status"]) : "ATIVO";
  const q: CriteriosQuery = { status };
  if (filtro.grupoId != null) q.grupoId = filtro.grupoId;
  if (filtro.setor && filtro.setor.trim()) q.setor = filtro.setor.trim();
  if (filtro.categoria && filtro.categoria.trim()) q.categoria = filtro.categoria.trim();
  if (filtro.busca && filtro.busca.trim()) q.q = filtro.busca.trim();
  return q;
}
