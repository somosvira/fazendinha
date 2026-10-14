import type { Prisma } from "@prisma/client";
export function ultimaAcaoRegularizacao(historico: unknown): string | null {
  const evento = Array.isArray(historico) ? historico.at(-1) : null;
  return evento && typeof evento === "object" && typeof evento.acao === "string" ? evento.acao : null;
}
export function situacaoTarefaComum(t: { regularizacaoPendente?: boolean; historicoRegularizacao?: unknown; realizadaEm?: Date | null; dispensadaEm: Date | null; execucao: { canceladaEm: Date | null }; aplicacoes?: { status: string }[]; exames?: { status: string }[] }) {
  if (t.regularizacaoPendente) return "REGULARIZACAO_PENDENTE";
  if (ultimaAcaoRegularizacao(t.historicoRegularizacao) === "ENCERRAR_SEM_SUBSTITUICAO") return "ENCERRADA_SEM_SUBSTITUICAO";
  if (t.realizadaEm || t.aplicacoes?.some(a => a.status === "VALIDO") || t.exames?.some(e => e.status === "VALIDO")) return "REALIZADA";
  return t.execucao.canceladaEm ? "EXECUCAO_CANCELADA" : t.dispensadaEm ? "DISPENSADA" : "PENDENTE";
}
export function condicaoSituacaoTarefa(situacao?: string, hoje?: Date): Prisma.TarefaProtocoloWhereInput {
  const encerrada: Prisma.TarefaProtocoloWhereInput = { vinculos: { some: { estado: "ENCERRADO" } } };
  const realizada: Prisma.TarefaProtocoloWhereInput = { OR: [{ realizadaEm: { not: null } }, { aplicacoes: { some: { status: "VALIDO" } } }, { exames: { some: { status: "VALIDO" } } }] };
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
  aplicacao: { select: { propriedadeId: true } }, exame: { select: { propriedadeId: true } }, tentativa: { select: { propriedadeId: true } },
} } as const;
export function propriedadeRegularizacao(t: { vinculos?: { aplicacao?: { propriedadeId: number | null } | null; exame?: { propriedadeId: number | null } | null; tentativa?: { propriedadeId: number | null } | null }[]; execucao: { propriedadeId: number | null } }) {
  const v = t.vinculos?.[0];
  return v?.aplicacao?.propriedadeId ?? v?.exame?.propriedadeId ?? v?.tentativa?.propriedadeId ?? t.execucao.propriedadeId;
}
