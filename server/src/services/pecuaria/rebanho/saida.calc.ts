// Planejamento de saída (fecha localização/destino abertos) e do estorno (reabre).

export class SaidaError extends Error {
  constructor(message: string, public codigo: "INATIVO" | "DATA" | "CONFLITO" = "DATA") {
    super(message);
    this.name = "SaidaError";
  }
}

export interface LinhaAberta {
  id: string;
  desde: Date | string;
}

export interface PlanoSaida {
  fecharLocalizacao: { id: string; ate: Date | string } | null;
  fecharDestino: { id: string; ate: Date | string } | null;
}

export function planejarSaida(input: {
  animalAtivo: boolean;
  localizacaoAberta: LinhaAberta | null;
  destinoAberto: LinhaAberta | null;
  data: Date | string;
}): PlanoSaida {
  if (!input.animalAtivo) {
    throw new SaidaError("Animal já está inativo (saída não estornada)", "INATIVO");
  }
  const t = (v: Date | string) => (typeof v === "string" ? new Date(v) : v).getTime();
  if (input.localizacaoAberta && t(input.data) < t(input.localizacaoAberta.desde)) {
    throw new SaidaError("Data da saída não pode ser anterior ao início da localização atual");
  }
  if (input.destinoAberto && t(input.data) < t(input.destinoAberto.desde)) {
    throw new SaidaError("Data da saída não pode ser anterior ao início do destino atual");
  }

  return {
    fecharLocalizacao: input.localizacaoAberta ? { id: input.localizacaoAberta.id, ate: input.data } : null,
    fecharDestino: input.destinoAberto ? { id: input.destinoAberto.id, ate: input.data } : null,
  };
}

export interface PlanoEstornoSaida {
  reabrirLocalizacao: { id: string } | null;
  reabrirDestino: { id: string } | null;
}

/**
 * Reabre exatamente as linhas que a saída fechou (ids gravados na própria SaidaAnimal).
 * Não deduz pela data: uma movimentação no mesmo dia da saída também fecha uma linha
 * com o mesmo `ate`, e reabrir a errada restaura a localização anterior.
 * Se já existir linha aberta (não deveria), recusa para não violar "uma aberta por animal".
 */
export function planejarEstornoSaida(input: {
  saida: { localizacaoFechadaId: string | null; destinoFechadoId: string | null };
  localizacaoAberta: { id: string } | null;
  destinoAberto: { id: string } | null;
}): PlanoEstornoSaida {
  const { saida } = input;
  if (saida.localizacaoFechadaId && input.localizacaoAberta && input.localizacaoAberta.id !== saida.localizacaoFechadaId) {
    throw new SaidaError("Animal já tem uma localização aberta; não é possível reabrir a da saída", "CONFLITO");
  }
  if (saida.destinoFechadoId && input.destinoAberto && input.destinoAberto.id !== saida.destinoFechadoId) {
    throw new SaidaError("Animal já tem um destino aberto; não é possível reabrir o da saída", "CONFLITO");
  }
  return {
    reabrirLocalizacao: saida.localizacaoFechadaId ? { id: saida.localizacaoFechadaId } : null,
    reabrirDestino: saida.destinoFechadoId ? { id: saida.destinoFechadoId } : null,
  };
}
