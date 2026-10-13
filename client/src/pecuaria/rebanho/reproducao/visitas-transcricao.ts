import type { RascunhoVisita, TipoAtividade } from "./visitas-api";
function momentoBR(valor: string | undefined): string {
  if (!valor) throw new Error("Informe a data e hora realizada.");
  const data = new Date(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor) ? `${valor}:00-03:00` : valor,
  );
  if (!Number.isFinite(data.getTime()))
    throw new Error("Informe uma data e hora válida.");
  return data.toISOString();
}
export function dadosConfirmacaoVisita(
  tipo: TipoAtividade,
  r: RascunhoVisita,
): Record<string, unknown> {
  if (r.status === "ADIADO" || r.status === "NAO_ATENDIDO") return {};
  const { status: _status, dados, inicioEfetivo, realizadaEm, ...campos } = r;
  if (tipo === "TAREFA_IATF")
    return {
      realizadaEm: momentoBR(realizadaEm),
      dados: dados ?? {},
      motivo: r.motivo || undefined,
    };
  if (tipo === "INICIAR_IATF")
    return {
      participanteIatfId: r.participanteIatfId,
      inicioEfetivo: momentoBR(inicioEfetivo),
      cienciaSanitaria: r.cienciaSanitaria,
    };
  if (tipo === "AVALIACAO_REPRODUTIVA")
    return Object.fromEntries(
      Object.entries(campos).filter(([, v]) => v !== ""),
    );
  return dados ?? {};
}
