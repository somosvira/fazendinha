// Mappers da camada operacional Ideagri (Safra / TarefaAgricola / ApontamentoMaquina).
// Espelha plantio/mappers.ts: iso() de datas, Number() de Decimal, agregação pura
// testável sem DB (agregarSafra).

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

// Prisma Decimal | number | null → number | null (DTOs usam null, não undefined).
function num(v: any): number | null {
  return v == null ? null : Number(v);
}

// ── Tarefa ────────────────────────────────────────────────────────────────
export function toTarefaDTO(t: any) {
  return {
    id: t.id,
    safraId: t.safraId,
    talhaoId: t.talhaoId ?? null,
    talhaoCodigo: t.talhao?.codigo ?? null,
    lavouraId: t.lavouraId ?? null,
    lavouraNome: t.lavoura?.nome ?? null,
    tipo: t.tipo,
    descricao: t.descricao,
    responsavel: t.responsavel ?? null,
    produto: t.produto ?? null,
    unidade: t.unidade ?? null,
    qtdHaPrev: num(t.qtdHaPrev),
    qtdTotalPrev: num(t.qtdTotalPrev),
    dataPrevista: iso(t.dataPrevista),
    custoPrev: num(t.custoPrev),
    qtdHaReal: num(t.qtdHaReal),
    qtdTotalReal: num(t.qtdTotalReal),
    dataRealizada: iso(t.dataRealizada),
    custoReal: num(t.custoReal),
    status: t.status,
  };
}

// ── Apontamento ─────────────────────────────────────────────────────────────
export function toApontamentoDTO(a: any) {
  return {
    id: a.id,
    safraId: a.safraId ?? null,
    talhaoId: a.talhaoId ?? null,
    talhaoCodigo: a.talhao?.codigo ?? null,
    data: iso(a.data)!,
    tipo: a.tipo as "MAQUINA" | "HOMEM",
    recurso: a.recurso,
    operador: a.operador ?? null,
    implemento: a.implemento ?? null,
    horas: Number(a.horas),
    valorHora: num(a.valorHora),
    valorTotal: num(a.valorTotal),
    observacao: a.observacao ?? null,
  };
}

// ── Resumo da safra (PURA — testável sem DB) ────────────────────────────────
// Recebe as tarefas + apontamentos brutos (Prisma rows ou sintéticos) e devolve
// os agregados do SafraDTO.resumo. Decimal vira Number via num().
export interface ResumoSafra {
  tarefasTotal: number;
  tarefasConcluidas: number;
  custoPrevTotal: number;
  custoRealTotal: number;
  horasMaquina: number;
  horasHomem: number;
  custoOperacional: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function agregarSafra(tarefas: any[], apontamentos: any[]): ResumoSafra {
  const ts = tarefas ?? [];
  const aps = apontamentos ?? [];

  const tarefasConcluidas = ts.filter((t) => t.status === "CONCLUIDA").length;
  const custoPrevTotal = r2(ts.reduce((s, t) => s + (t.custoPrev != null ? Number(t.custoPrev) : 0), 0));
  const custoRealTotal = r2(ts.reduce((s, t) => s + (t.custoReal != null ? Number(t.custoReal) : 0), 0));

  const horasMaquina = r2(aps.filter((a) => a.tipo === "MAQUINA").reduce((s, a) => s + (a.horas != null ? Number(a.horas) : 0), 0));
  const horasHomem = r2(aps.filter((a) => a.tipo === "HOMEM").reduce((s, a) => s + (a.horas != null ? Number(a.horas) : 0), 0));
  const custoOperacional = r2(aps.reduce((s, a) => s + (a.valorTotal != null ? Number(a.valorTotal) : 0), 0));

  return {
    tarefasTotal: ts.length,
    tarefasConcluidas,
    custoPrevTotal,
    custoRealTotal,
    horasMaquina,
    horasHomem,
    custoOperacional,
  };
}

// ── Safra ────────────────────────────────────────────────────────────────
// Recebe uma row de Safra com tarefas + apontamentos incluídos e computa resumo.
export function toSafraDTO(s: any) {
  return {
    id: s.id,
    nome: s.nome,
    dataInicio: iso(s.dataInicio)!,
    dataFim: iso(s.dataFim)!,
    fechada: !!s.fechada,
    centroCustoNome: s.centroCusto?.nome ?? null,
    resumo: agregarSafra(s.tarefas ?? [], s.apontamentos ?? []),
  };
}
