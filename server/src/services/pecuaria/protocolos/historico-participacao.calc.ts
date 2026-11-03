function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}

/** A versão completa é a evidência; nome do modelo e cronologia não classificam procedimentos. */
export function iaPrevistaNoModelo(etapas: readonly { tipo: string; configuracao: unknown }[]): boolean | null {
  if (!etapas.length) return null;
  let desconhecida = false;
  for (const etapa of etapas) {
    if (etapa.tipo !== "TENTATIVA") continue;
    const config = objeto(etapa.configuracao);
    const tipoPlano = objeto(config.planoTentativa).tipo;
    if (config.tentativaTipo != null && tipoPlano != null && config.tentativaTipo !== tipoPlano) { desconhecida = true; continue; }
    const tipo = config.tentativaTipo ?? tipoPlano;
    if (tipo === "IA") return true;
    if (tipo !== "TE") desconhecida = true;
  }
  return desconhecida ? null : false;
}
