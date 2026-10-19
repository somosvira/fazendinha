import { Prisma } from "@prisma/client";
export function ultimaAcaoRegularizacao(historico: unknown): string | null {
  const evento = Array.isArray(historico) ? historico.at(-1) : null;
  return evento && typeof evento === "object" && typeof evento.acao === "string" ? evento.acao : null;
}
export function situacaoTarefaComum(t: { regularizacaoPendente?: boolean; historicoRegularizacao?: unknown; realizadaEm?: Date | null; dispensadaEm: Date | null; execucao: { canceladaEm: Date | null }; aplicacoes?: { status: string }[]; exames?: { status: string }[]; tentativas?: { status: string }[]; vinculos?: { estado?: string; aplicacao?: {status?: string} | null; exame?: {status?: string} | null; tentativa?: {status?: string} | null }[] }) {
  if (t.regularizacaoPendente) return "REGULARIZACAO_PENDENTE";
  if (ultimaAcaoRegularizacao(t.historicoRegularizacao) === "ENCERRAR_SEM_SUBSTITUICAO") return "ENCERRADA_SEM_SUBSTITUICAO";
  if (t.realizadaEm || t.aplicacoes?.some(a => a.status === "VALIDO") || t.exames?.some(e => e.status === "VALIDO") || t.tentativas?.some(e => e.status === "VALIDO") || t.vinculos?.some(v => v.estado === "ATUAL" && [v.aplicacao,v.exame,v.tentativa].some(f => f?.status === "VALIDO"))) return "REALIZADA";
  return t.execucao.canceladaEm ? "EXECUCAO_CANCELADA" : t.dispensadaEm ? "DISPENSADA" : "PENDENTE";
}
export function condicaoSituacaoTarefa(situacao?: string, hoje?: Date): Prisma.TarefaProtocoloWhereInput {
  const encerrada: Prisma.TarefaProtocoloWhereInput = { vinculos: { some: { estado: "ENCERRADO" } } };
  const realizada: Prisma.TarefaProtocoloWhereInput = { OR: [{ realizadaEm: { not: null } }, { aplicacoes: { some: { status: "VALIDO" } } }, { exames: { some: { status: "VALIDO" } } }, { tentativas: { some: { status: "VALIDO" } } }, { vinculos: { some: { estado: "ATUAL", OR: [{aplicacao:{status:"VALIDO"}},{exame:{status:"VALIDO"}},{tentativa:{status:"VALIDO"}}] } } }] };
  const livre: Prisma.TarefaProtocoloWhereInput[] = [{ regularizacaoPendente: false }, { NOT: encerrada }];
  if (situacao === "REGULARIZACAO_PENDENTE") return { regularizacaoPendente: true };
  if (situacao === "ENCERRADA_SEM_SUBSTITUICAO") return { AND: [{ regularizacaoPendente: false }, encerrada] };
  if (situacao === "REALIZADA") return { AND: [...livre, realizada] };
  if (situacao === "EXECUCAO_CANCELADA") return { AND: [...livre, { NOT: realizada }, { execucao: { canceladaEm: { not: null } } }] };
  if (situacao === "DISPENSADA") return { AND: [...livre, { NOT: realizada }, { execucao: { canceladaEm: null } }, { dispensadaEm: { not: null } }] };
  if (situacao === "PENDENTE" || situacao === "ATRASADA") return { AND: [...livre, { NOT: realizada }, { execucao: { canceladaEm: null } }, { dispensadaEm: null }, ...(situacao === "ATRASADA" && hoje ? [{ previstaPara: { lt: hoje } }] : [])] };
  return {};
}

export const vinculoRegularizacaoSelect = { orderBy: { ordem: "desc" }, take: 1, select: {
  estado: true, aplicacao: { select: { propriedadeId: true, status: true } }, exame: { select: { propriedadeId: true, status: true } }, tentativa: { select: { propriedadeId: true, status: true } },
} } as const;
export function propriedadeRegularizacao(t: { vinculos?: { aplicacao?: { propriedadeId: number | null } | null; exame?: { propriedadeId: number | null } | null; tentativa?: { propriedadeId: number | null } | null }[]; execucao: { propriedadeId: number | null } }) {
  const v = t.vinculos?.[0];
  return v?.aplicacao?.propriedadeId ?? v?.exame?.propriedadeId ?? v?.tentativa?.propriedadeId ?? t.execucao.propriedadeId;
}


export type EventoOperacional = { id: string; tipo: string; registradoEm: Date; ocorridaEm: Date; motivo: string; eventoCorrigidoId?: string | null };
export function ultimoEventoOperacional(eventos: EventoOperacional[] = []) {
  const ordenados = [...eventos].sort((a,b) => b.registradoEm.getTime() - a.registradoEm.getTime() || b.id.localeCompare(a.id));
  const ultimo = ordenados.find(e => e.tipo !== "RETIFICACAO_JUSTIFICATIVA");
  if (!ultimo) return null;
  const retificacao = ordenados.find(e => e.eventoCorrigidoId === ultimo.id);
  return { ...ultimo, motivo: retificacao?.motivo ?? ultimo.motivo };
}
export function situacaoOperacionalTarefa(t: Parameters<typeof situacaoTarefaComum>[0] & {previstaPara: Date; precisaoTemporal?: string; previsaoPendente?: boolean; eventos?: EventoOperacional[]}, agora = new Date()): import("./operacao.dto.js").SituacaoOperacional {
  const comum = situacaoTarefaComum(t);
  if (comum !== "PENDENTE") return ({ REALIZADA:"ATENDIDO", REGULARIZACAO_PENDENTE:"REGULARIZACAO_PENDENTE", ENCERRADA_SEM_SUBSTITUICAO:"ENCERRADO", EXECUCAO_CANCELADA:"RETIRADO", DISPENSADA:"DISPENSADO" } as const)[comum];
  const evento = ultimoEventoOperacional(t.eventos);
  if (evento?.tipo === "ADIAMENTO") return "ADIADO";
  if (evento?.tipo === "NAO_ATENDIDO") return "NAO_ATENDIDO";
  const hoje = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(agora);
  const futura = t.precisaoTemporal === "HORA" ? t.previstaPara > agora : t.previstaPara.toISOString().slice(0,10) > hoje;
  return t.previsaoPendente || futura ? "PREVISTO" : "SEM_REGISTRO";
}
/** Mesmo predicado utilizado pela lista, filtro e contagem; aliases t/p definidos na consulta. */
export function sqlSituacaoOperacional(agora: Date) {
  return Prisma.sql`CASE
    WHEN t."regularizacaoPendente" THEN 'REGULARIZACAO_PENDENTE'
    WHEN (t."historicoRegularizacao"->-1->>'acao') = 'ENCERRAR_SEM_SUBSTITUICAO' THEN 'ENCERRADO'
    WHEN t."realizadaEm" IS NOT NULL
      OR EXISTS (SELECT 1 FROM pecuaria."AplicacaoProduto" f WHERE f."tarefaId"=t.id AND f.status='VALIDO')
      OR EXISTS (SELECT 1 FROM pecuaria."ExameAnimal" f WHERE f."tarefaId"=t.id AND f.status='VALIDO')
      OR EXISTS (SELECT 1 FROM pecuaria."TentativaReprodutiva" f WHERE f."tarefaId"=t.id AND f.status='VALIDO')
      OR EXISTS (SELECT 1 FROM pecuaria."VinculoTarefaProtocolo" v
        LEFT JOIN pecuaria."AplicacaoProduto" a ON a.id=v."aplicacaoId"
        LEFT JOIN pecuaria."ExameAnimal" x ON x.id=v."exameId"
        LEFT JOIN pecuaria."TentativaReprodutiva" r ON r.id=v."tentativaId"
        WHERE v."tarefaId"=t.id AND v.estado='ATUAL' AND (a.status='VALIDO' OR x.status='VALIDO' OR r.status='VALIDO')) THEN 'ATENDIDO'
    WHEN p."canceladaEm" IS NOT NULL THEN 'RETIRADO'
    WHEN t."dispensadaEm" IS NOT NULL THEN 'DISPENSADO'
    WHEN (SELECT e.tipo::text FROM pecuaria."EventoTarefaProtocolo" e WHERE e."tarefaId"=t.id AND e.tipo::text <> 'RETIFICACAO_JUSTIFICATIVA' ORDER BY e."registradoEm" DESC,e.id DESC LIMIT 1)='ADIAMENTO' THEN 'ADIADO'
    WHEN (SELECT e.tipo::text FROM pecuaria."EventoTarefaProtocolo" e WHERE e."tarefaId"=t.id AND e.tipo::text <> 'RETIFICACAO_JUSTIFICATIVA' ORDER BY e."registradoEm" DESC,e.id DESC LIMIT 1)='NAO_ATENDIDO' THEN 'NAO_ATENDIDO'
    WHEN t."previsaoPendente" OR (CASE WHEN t."precisaoTemporal"::text='HORA' THEN t."previstaEm">(${agora}::timestamptz AT TIME ZONE 'UTC') ELSE t."previstaEm"::date > (${agora}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date END) THEN 'PREVISTO'
    ELSE 'SEM_REGISTRO' END`;
}

export function tarefaOperacionalAtrasada(t: Parameters<typeof situacaoOperacionalTarefa>[0], agora = new Date()) {
  if (t.previsaoPendente || !["NAO_ATENDIDO", "SEM_REGISTRO", "ADIADO", "REGULARIZACAO_PENDENTE"].includes(situacaoOperacionalTarefa(t, agora))) return false;
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  return t.precisaoTemporal === "HORA" ? t.previstaPara < agora : t.previstaPara.toISOString().slice(0, 10) < hoje;
}
/** Predicado sobre a projeção `tarefas`, compartilhado pelo filtro e agregado. */
export function sqlAtrasoOperacional(agora: Date) {
  return Prisma.sql`NOT "previsaoPendente" AND situacao IN ('NAO_ATENDIDO','SEM_REGISTRO','ADIADO','REGULARIZACAO_PENDENTE') AND (CASE WHEN "precisaoTemporal"::text='HORA' THEN "previstaEm"<(${agora}::timestamptz AT TIME ZONE 'UTC') ELSE "previstaEm"::date<(${agora}::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date END)`;
}
export function contextoRegularizacaoOperacao(t: Parameters<typeof propriedadeRegularizacao>[0], propriedadeId: number | null) {
  const sitio = propriedadeRegularizacao(t);
  return { propriedadeRegularizacaoId: propriedadeId == null || propriedadeId === sitio ? sitio : null };
}
