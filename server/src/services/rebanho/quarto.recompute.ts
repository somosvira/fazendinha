// Cálculo puro da saúde por quarto mamário. Recebe os ExameQuarto de um animal e uma data de
// referência (`hoje`, ISO) → estado por quarto + agregados p/ ResumoAnimal. Determinístico: nenhuma
// dependência de Date.now() aqui, a janela de 12m é relativa ao `hoje` passado pelo chamador.

export type Quarto = "AE" | "AD" | "PE" | "PD";
export type ScoreCmt = "NEGATIVO" | "TRACOS" | "UMA_CRUZ" | "DUAS_CRUZES" | "TRES_CRUZES";
export type EstadoQuarto = "SADIO" | "ATIVO" | "CRONICO" | "PERDIDO";

export interface ExameQuartoIn {
  quarto: Quarto;
  data: string; // ISO YYYY-MM-DD
  scoreCmt?: ScoreCmt | null;
  ccs?: number | null;
  clinica?: boolean;
  perdido?: boolean;
}

export interface EstadoPorQuarto {
  estado: EstadoQuarto;
  positivos12m: number; // positivos firmes (subclínico OU clínico) na janela
  clinicas12m: number; // episódios clínicos na janela
  ultimoPositivo: string | null; // ISO da data do último positivo (qualquer janela)
}

export interface ResumoQuartos {
  porQuarto: Record<Quarto, EstadoPorQuarto>;
  quartosCronicos: number;
  quartosPerdidos: number;
}

export const CCS_POSITIVO = 400; // mil/mL: limiar de positivo subclínico
export const JANELA_MESES = 12;
export const DIAS_ATIVO = 60; // último positivo mais recente que isso → quarto ATIVO
const QUARTOS: Quarto[] = ["AE", "AD", "PE", "PD"];

// Positivo subclínico firme: 2+ cruzes no CMT OU CCS >= limiar. Traços/1 cruz = suspeita, não conta.
function positivoFirme(e: ExameQuartoIn): boolean {
  if (e.scoreCmt === "DUAS_CRUZES" || e.scoreCmt === "TRES_CRUZES") return true;
  if (e.ccs != null && e.ccs >= CCS_POSITIVO) return true;
  return false;
}

function diasEntre(deISO: string, ateISO: string): number {
  return Math.round((Date.parse(ateISO) - Date.parse(deISO)) / 86_400_000);
}

function dentroJanela(dataISO: string, hoje: string): boolean {
  const dias = diasEntre(dataISO, hoje);
  return dias >= 0 && dias <= JANELA_MESES * 30.5;
}

export function recomputarQuartos(exames: ExameQuartoIn[], hoje: string): ResumoQuartos {
  const porQuarto = {} as Record<Quarto, EstadoPorQuarto>;
  let quartosCronicos = 0;
  let quartosPerdidos = 0;

  for (const q of QUARTOS) {
    const doQuarto = exames.filter((e) => e.quarto === q);
    const naJanela = doQuarto.filter((e) => dentroJanela(e.data, hoje));

    const positivos = naJanela.filter((e) => positivoFirme(e) || e.clinica);
    const clinicas = naJanela.filter((e) => e.clinica);
    const positivos12m = positivos.length;
    const clinicas12m = clinicas.length;

    const perdido = doQuarto.some((e) => e.perdido);
    const cronico = positivos12m >= 3 || clinicas12m >= 2;

    const ultimoPositivoData =
      doQuarto
        .filter((e) => positivoFirme(e) || e.clinica)
        .map((e) => e.data)
        .sort()
        .at(-1) ?? null;
    const ativoRecente =
      ultimoPositivoData != null && diasEntre(ultimoPositivoData, hoje) <= DIAS_ATIVO;

    // Precedência: PERDIDO > CRONICO > ATIVO > SADIO.
    let estado: EstadoQuarto = "SADIO";
    if (perdido) estado = "PERDIDO";
    else if (cronico) estado = "CRONICO";
    else if (ativoRecente) estado = "ATIVO";

    if (estado === "PERDIDO") quartosPerdidos++;
    else if (estado === "CRONICO") quartosCronicos++;

    porQuarto[q] = { estado, positivos12m, clinicas12m, ultimoPositivo: ultimoPositivoData };
  }

  return { porQuarto, quartosCronicos, quartosPerdidos };
}
