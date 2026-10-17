import { deslocarCalendario } from "../protocolos/calendario.calc.js";
import type { EtapaIatf } from "./schemas.js";
import { contarPartos } from "../rebanho/partos.calc.js";

export function calendarioIatf(inicio: Date, etapas: EtapaIatf[], precisao: "DIA" | "HORA" = "HORA") {
  return etapas.map((etapa, indice) => {
    const previsaoPendente = precisao === "DIA" && (etapa.unidade === "HORAS" || !Number.isInteger(etapa.intervalo));
    // Sem hora de referência, conservar apenas a data do início como referência.
    // Não converter 12h/36h em um dia de vencimento arbitrário.
    const previstaEm = previsaoPendente ? inicio : deslocarCalendario(inicio, etapa.intervalo, etapa.unidade, precisao);
    return { ...etapa, etapa: indice, previstaEm, precisaoTemporal: precisao, previsaoPendente };
  });
}

export function contadoresCiclo(partosAnteriores: number, partos: { data: Date; status: string; incluidoSaldoAnterior: boolean }[], tentativas: { data: Date; status: string }[], referencia: Date) {
  const validos = partos.filter((p) => p.status === "VALIDO" && p.data <= referencia);
  const ultimo = validos.sort((a, b) => b.data.getTime() - a.data.getTime())[0];
  return { partos: contarPartos(partosAnteriores, partos, referencia), tentativasCiclo: tentativas.filter((t) => t.status === "VALIDO" && t.data <= referencia && (!ultimo || t.data > ultimo.data)).length };
}

type Avaliacao = { data: Date; resultado: string };
type Gestacao = { confirmadaEm: Date; encerradaEm: Date | null; status: string;tipoEncerramento?:string|null };

/** A última evidência conclusiva prevalece. Uma anotação de campo não apaga o diagnóstico anterior. */
export function situacaoReprodutiva(input: {
  referencia?: Date;
  gestacao?: Gestacao | null;
  ultimaAvaliacao?: Avaliacao | null;
  avaliacoes?: Avaliacao[];
  ultimaTentativa?: { data: Date } | null;
  ultimoParto?: { data: Date } | null;
  inicial?: { data: Date; situacao: string } | null;
}) {
  if (input.referencia) {
    const referencia = input.referencia;
    return situacaoReprodutiva({
      ...input,
      referencia: undefined,
      gestacao: input.gestacao && input.gestacao.confirmadaEm <= referencia
        ? { ...input.gestacao, encerradaEm: input.gestacao.encerradaEm && input.gestacao.encerradaEm <= referencia ? input.gestacao.encerradaEm : null }
        : null,
      avaliacoes: input.avaliacoes?.filter((a) => a.data <= referencia),
      ultimaAvaliacao: input.ultimaAvaliacao && input.ultimaAvaliacao.data <= referencia ? input.ultimaAvaliacao : null,
      ultimaTentativa: input.ultimaTentativa && input.ultimaTentativa.data <= referencia ? input.ultimaTentativa : null,
      ultimoParto: input.ultimoParto && input.ultimoParto.data <= referencia ? input.ultimoParto : null,
      inicial: input.inicial && input.inicial.data <= referencia ? input.inicial : null,
    });
  }
  // Uma situação de entrada não desfaz uma gestação operacional ainda aberta.
  if (input.gestacao?.status === "VALIDO" && !input.gestacao.encerradaEm) return "GESTANTE";
  const evidencias: Array<{ data: Date; situacao: string; prioridade: number }> = [];
  if (input.inicial) evidencias.push({ ...input.inicial, prioridade: 0 });
  if (input.ultimaTentativa) evidencias.push({ ...input.ultimaTentativa, situacao: "AGUARDANDO_DIAGNOSTICO", prioridade: 1 });
  for (const avaliacao of input.avaliacoes ?? (input.ultimaAvaliacao ? [input.ultimaAvaliacao] : [])) {
    if (["POSITIVO", "RECONFIRMACAO", "SEXAGEM", "NEGATIVO"].includes(avaliacao.resultado)) {
      evidencias.push({ data: avaliacao.data, situacao: avaliacao.resultado === "NEGATIVO" ? "VAZIA" : "GESTANTE", prioridade: 2 });
    }
  }
  if (input.gestacao?.status === "VALIDO") {
    evidencias.push({ data: input.gestacao.confirmadaEm, situacao: "GESTANTE", prioridade: 2 });
    if (input.gestacao.encerradaEm) evidencias.push({ data: input.gestacao.encerradaEm, situacao: ["PERDA","PARTO"].includes(input.gestacao.tipoEncerramento??"")?"VAZIA":"DESCONHECIDA", prioridade: 3 });
  }
  if (input.ultimoParto) evidencias.push({ ...input.ultimoParto, situacao: "VAZIA", prioridade: 4 });
  return evidencias.sort((a, b) => b.data.getTime() - a.data.getTime() || b.prioridade - a.prioridade)[0]?.situacao ?? "DESCONHECIDA";
}

/** Encerramento libera o intervalo a partir da data final; intervenção no dia continua sendo regra própria. */
export function intervalosSobrepostos(
  a: { inicio: Date; fim: Date | null },
  b: { inicio: Date; fim: Date | null },
) {
  // Um fato de início e encerramento no mesmo dia ainda ocupa aquele dia clínico.
  const fimA = a.fim && a.fim <= a.inicio ? new Date(a.inicio.getTime() + 86400000) : a.fim;
  const fimB = b.fim && b.fim <= b.inicio ? new Date(b.inicio.getTime() + 86400000) : b.fim;
  return (!fimA || b.inicio < fimA) && (!fimB || a.inicio < fimB);
}
