import { RebanhoError } from "../rebanho/regras.js";

/** Converte uma data civil e horário IANA sem depender do fuso do Worker.
 * Horas inexistentes/ambíguas de transição de verão exigem revisão explícita. */
export function instanteProgramado(data: string, horario: string, fuso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) throw new RebanhoError("VALIDACAO", "Data ou horário da automação inválido");
  let formato: Intl.DateTimeFormat;
  try { formato = new Intl.DateTimeFormat("sv-SE", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
  catch { throw new RebanhoError("VALIDACAO", "Fuso horário inválido"); }
  const esperado = `${data} ${horario}`;
  const civil = Date.parse(`${data}T${horario}:00Z`);
  const candidatos: number[] = [];
  // Todos os deslocamentos IANA atuais têm resolução de 15 minutos.
  for (let delta = -14 * 60; delta <= 14 * 60; delta += 15) {
    const instante = civil + delta * 60_000;
    if (formato.format(new Date(instante)).replace(",", "") === esperado) candidatos.push(instante);
  }
  if (candidatos.length !== 1) throw new RebanhoError("VALIDACAO", "Horário inexistente ou ambíguo neste fuso; revise a etapa");
  return new Date(candidatos[0]);
}

export function validarDataAutomacao(programada: Date, agora: Date) {
  if (programada.getTime() <= agora.getTime()) throw new RebanhoError("VALIDACAO", "Etapa vencida: revise o início retroativo e registre ou reprograme a etapa antes de ativar a automação", "inicio");
}
