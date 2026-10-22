import type { CarenciaAnimal } from "./api";
import { dataHoraSanitaria } from "./rotulos";

export function resumoCarencia(estado: CarenciaAnimal["leite"], agora = Date.now(), prazoZero = false): string {
  if (estado.estado === "NENHUMA") return "Sem aplicações válidas";
  if (estado.estado === "NAO_INFORMADO") return "Carência desconhecida — revisar";
  if (estado.estado === "NAO_APLICAVEL") return "Não se aplica — confirmado";
  if (estado.estado !== "CONHECIDO") return "Carência desconhecida — revisar";
  if (estado.prazoZero || prazoZero) return "Sem carência · prazo zero confirmado";
  return `${new Date(estado.ate).getTime() > agora ? "Vigente até" : "Sem carência · encerrada em"} ${estado.precisaoAproximada ? "≈ " : ""}${dataHoraSanitaria(estado.ate)}`;
}
