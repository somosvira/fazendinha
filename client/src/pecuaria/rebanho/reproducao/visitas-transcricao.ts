import { dataHoraISO } from "./CampoDataIatf";
import type { RascunhoVisita, TipoAtividade } from "./visitas-api";
import type { ParticipanteVisita } from "./visitas-api";
function momentoBR(valor: string | undefined): string {
  if (!valor) throw new Error("Informe a data realizada.");
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return dataHoraISO(valor);
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

export const rotulosResultadoAvaliacao: Record<string, string> = {
  POSITIVO: "Prenhez confirmada",
  NEGATIVO: "Vazia",
  RECONFIRMACAO: "Continua gestante",
  SEXAGEM: "Sexo fetal observado",
  INCONCLUSIVO: "Inconclusivo",
  NAO_AVALIADO: "Não avaliada",
};

export const rotulosCondutaAvaliacao: Record<string, string> = {
  AGUARDAR: "Acompanhar / retorno",
  IATF: "Indicar IATF",
  DESCARTE: "Restringir reprodução / descarte",
};

export function ehAvaliacaoTarefa(p: ParticipanteVisita): boolean {
  return p.snapshot.tarefaPlanejada?.tarefa.tipo === "AVALIACAO";
}

export function resultadoPrincipalVisita(tipo: TipoAtividade, p: ParticipanteVisita, r: RascunhoVisita): string | null {
  const resultado = tipo === "AVALIACAO_REPRODUTIVA" ? r.resultado
    : tipo === "TAREFA_IATF" && ehAvaliacaoTarefa(p) ? String(r.dados?.resultado ?? "") : "";
  return resultado ? rotulosResultadoAvaliacao[resultado] ?? resultado : null;
}

export function pendenciaAvaliacaoTarefa(dados: Record<string, unknown> | undefined, gestacaoConhecida = false): string | null {
  if (!dados?.resultado) return "Informe o resultado da avaliação.";
  if (dados.resultado === "SEXAGEM" && !dados.sexoFetal) return "Informe o sexo fetal.";
  if (["SEXAGEM", "RECONFIRMACAO"].includes(String(dados.resultado)) && !dados.gestacaoId)
    return "Vincule a gestação conhecida para esta avaliação.";
  if (dados.resultado === "NEGATIVO" && gestacaoConhecida)
    return "Há gestação conhecida: registre a perda ou corrija o diagnóstico antes de confirmar.";
  if (dados.resultado === "POSITIVO" && !dados.tentativaId && !dados.gestacaoId &&
    (typeof dados.motivoVinculoDesconhecido !== "string" || dados.motivoVinculoDesconhecido.trim().length < 5))
    return "Vincule a tentativa ou explique o vínculo desconhecido.";
  return null;
}

/** Contexto congelado da lista: ausência de dado nunca é convertida em zero ou “não”. */
export function contextoTranscricao(
  snapshot: import("./visitas-api").ParticipanteVisita["snapshot"],
  dataVisita: string,
) {
  const lactacao = snapshot.situacaoProdutiva === "SECA" ? "Seca"
    : snapshot.situacaoProdutiva === "LACTANTE"
      ? snapshot.del == null ? "Lactante · DEL não informado" : `DEL ${snapshot.del}`
      : snapshot.situacaoProdutiva === "SEM_LACTACAO" ? "Sem lactação registrada"
        : "Lactação não informada";
  const rp = !snapshot.ultimoParto ? "Sem parto registrado"
    : snapshot.retencaoPlacenta === true ? "Sim"
      : snapshot.retencaoPlacenta === false ? "Não" : "Não informado";
  const dias = snapshot.tentativa
    ? Math.floor((Date.parse(dataVisita.slice(0, 10)) - Date.parse(snapshot.tentativa.data.slice(0, 10))) / 86_400_000)
    : null;
  const rotulosSituacao: Record<string, string> = {
    GESTANTE: "Gestante",
    VAZIA: "Vazia",
    DESCONHECIDA: "Desconhecida",
    APTA: "Apta",
    AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico",
  };
  // O snapshot já considera avaliações e situação inicial. A tentativa isolada
  // não comprova que o diagnóstico continua pendente em impressões antigas.
  const situacao = snapshot.situacao
    ? rotulosSituacao[snapshot.situacao] ?? "Situação não reconhecida"
    : snapshot.gestacao ? "Gestação registrada no contexto" : "Situação não preservada";
  return {
    lactacao,
    rp,
    tentativa: snapshot.tentativa
      ? `${snapshot.tentativa.tipo} ${dias != null && dias >= 0 ? `há ${dias} dias` : snapshot.tentativa.data.slice(0, 10)}`
      : "Sem tentativa registrada",
    situacao: snapshot.restricoes?.length ? `${situacao} · Restrição reprodutiva` : situacao,
  };
}
