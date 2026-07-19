// Cálculo puro do status de uma vacina agendada — sem I/O, testável isoladamente.
// Todas as datas são a data civil ISO (YYYY-MM-DD); comparação lexicográfica é segura nesse formato.

export type StatusVacina = "aplicada" | "vencida" | "proxima" | "emdia";

// Antecedência (em dias) com que uma vacina agendada entra no lembrete como "próxima".
export const JANELA_VACINA_DIAS = 15;

const MS = 86_400_000;
const somaDias = (isoDia: string, dias: number) => new Date(Date.parse(`${isoDia}T00:00:00Z`) + dias * MS).toISOString().slice(0, 10);

/**
 * Status de uma vacina agendada em relação a `hoje`:
 *  - "aplicada": já registrada (aplicadaEm != null) — precedência sobre tudo.
 *  - "vencida":  a data prevista já passou e não foi aplicada (ação atrasada).
 *  - "proxima":  vence dentro da janela de antecedência [hoje, hoje+janelaDias] (lembrete).
 *  - "emdia":    prevista para além da janela (nada a fazer ainda).
 */
export function statusVacina(
  dataPrevista: string,
  aplicadaEm: string | null,
  hoje: string,
  janelaDias: number = JANELA_VACINA_DIAS,
): StatusVacina {
  if (aplicadaEm != null) return "aplicada";
  if (dataPrevista < hoje) return "vencida";
  if (dataPrevista <= somaDias(hoje, janelaDias)) return "proxima";
  return "emdia";
}

/** Uma vacina "pendente" (entra na worklist/lembrete) é vencida ou próxima. */
export function vacinaPendente(status: StatusVacina): boolean {
  return status === "vencida" || status === "proxima";
}
