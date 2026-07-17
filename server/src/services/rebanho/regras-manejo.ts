export const ESTADOS_ELEGIVEIS_PRENHEZ = new Set(["PEV", "VAZIA", "INSEMINADA", "PRENHE"]);

export interface LimiaresManejo {
  pevDias: number;
  gestacaoDias: number;
  secagemAntec: number;
  ccsAlto: number;
}

export function ehElegivelPrenhez(status: string | null | undefined): boolean {
  return status != null && ESTADOS_ELEGIVEIS_PRENHEZ.has(status);
}

export function ehVaziaAtrasada(status: string | null | undefined, del: number | null | undefined, pevDias: number): boolean {
  return status === "VAZIA" && del != null && del > pevDias;
}

export function ehCcsAlto(ccs: number | null | undefined, limite: number): boolean {
  return ccs != null && ccs >= limite;
}

export function ehSecagemAtrasada(status: string | null | undefined, previsaoSecagem: string | null | undefined, hoje: string): boolean {
  return status === "PRENHE" && previsaoSecagem != null && previsaoSecagem < hoje;
}

export function ehPartoProximo(status: string | null | undefined, diasGestacao: number | null | undefined, gestacaoDias: number, janelaDias = 30): boolean {
  return status === "PRENHE" && diasGestacao != null && diasGestacao >= gestacaoDias - janelaDias;
}

export function ehDgPendente(status: string | null | undefined, ultimoDgData: string | null | undefined): boolean {
  return status === "INSEMINADA" && ultimoDgData == null;
}
