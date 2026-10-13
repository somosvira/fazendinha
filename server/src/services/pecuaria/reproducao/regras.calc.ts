import type { EtapaIatf } from "./schemas.js";

export function calendarioIatf(inicio: Date, etapas: EtapaIatf[]) {
  return etapas.map((etapa, indice) => ({ ...etapa, etapa: indice, previstaEm: new Date(inicio.getTime() + etapa.intervalo * (etapa.unidade === "DIAS" ? 86400000 : 3600000)) }));
}

export function contadoresCiclo(partosAnteriores: number, partos: { data: Date; status: string; incluidoSaldoAnterior: boolean }[], tentativas: { data: Date; status: string }[], referencia: Date) {
  const validos = partos.filter((p) => p.status === "VALIDO" && p.data <= referencia);
  const ultimo = validos.sort((a, b) => b.data.getTime() - a.data.getTime())[0];
  return { partos: partosAnteriores + validos.filter((p) => !p.incluidoSaldoAnterior).length, tentativasCiclo: tentativas.filter((t) => t.status === "VALIDO" && t.data <= referencia && (!ultimo || t.data > ultimo.data)).length };
}

type Avaliacao = { data: Date; resultado: string };
type Gestacao = { confirmadaEm: Date; encerradaEm: Date | null; status: string };

/** A última evidência conclusiva prevalece. Uma anotação de campo não apaga o diagnóstico anterior. */
export function situacaoReprodutiva(input: {
  gestacao?: Gestacao | null;
  ultimaAvaliacao?: Avaliacao | null;
  avaliacoes?: Avaliacao[];
  ultimaTentativa?: { data: Date } | null;
  ultimoParto?: { data: Date } | null;
  inicial?: { data: Date; situacao: string } | null;
}) {
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
    if (input.gestacao.encerradaEm) evidencias.push({ data: input.gestacao.encerradaEm, situacao: "VAZIA", prioridade: 3 });
  }
  if (input.ultimoParto) evidencias.push({ ...input.ultimoParto, situacao: "VAZIA", prioridade: 4 });
  return evidencias.sort((a, b) => b.data.getTime() - a.data.getTime() || b.prioridade - a.prioridade)[0]?.situacao ?? "DESCONHECIDA";
}
