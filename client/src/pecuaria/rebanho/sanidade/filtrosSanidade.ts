export const ABAS_SANIDADE = ["agenda", "aplicacoes", "exames", "carencias", "ocorrencias"] as const;
export type AbaSanidade = typeof ABAS_SANIDADE[number];
export type FiltrosSanidade = {
  animalIds: string[]; loteIds: string[]; situacoes: string[];
  buscaAnimal: string; de: string; ate: string; pagina: number;
};
export type FiltrosPorAba = Record<AbaSanidade, FiltrosSanidade>;
const plurais = ["animalIds", "loteIds", "situacoes"] as const;
const escalares = ["buscaAnimal", "de", "ate"] as const;

export function lerFiltrosSanidade(params: URLSearchParams, ativa: AbaSanidade): FiltrosPorAba {
  return Object.fromEntries(ABAS_SANIDADE.map((aba) => {
    const ler = (chave: string) => params.get(`${aba}.${chave}`) ?? (aba === ativa ? params.get(chave) : null) ?? "";
    const lista = (plural: string, singular: string) => [...new Set((ler(plural) || ler(singular)).split(",").filter(Boolean))];
    return [aba, {
      animalIds: lista("animalIds", "animalId"), loteIds: lista("loteIds", "loteId"), situacoes: lista("situacoes", "situacao"),
      buscaAnimal: ler("buscaAnimal"), de: ler("de"), ate: ler("ate"), pagina: Math.max(1, Number(ler("pagina")) || 1),
    }];
  })) as FiltrosPorAba;
}

export function gravarFiltrosSanidade(params: URLSearchParams, filtros: FiltrosPorAba, ativa: AbaSanidade) {
  for (const aba of ABAS_SANIDADE) {
    for (const chave of plurais) {
      const valor = filtros[aba][chave].join(",");
      if (valor) params.set(`${aba}.${chave}`, valor);
      if (aba === ativa && valor) params.set(chave, valor);
    }
    for (const chave of escalares) {
      const valor = filtros[aba][chave];
      if (valor) params.set(`${aba}.${chave}`, valor);
      if (aba === ativa && valor) params.set(chave, valor);
    }
    if (filtros[aba].pagina > 1) params.set(`${aba}.pagina`, String(filtros[aba].pagina));
  }
  const atual = filtros[ativa];
  if (atual.animalIds.length === 1) params.set("animalId", atual.animalIds[0]);
  if (atual.loteIds.length === 1) params.set("loteId", atual.loteIds[0]);
  if (atual.situacoes.length === 1) params.set("situacao", atual.situacoes[0]);
  if (atual.pagina > 1) params.set("pagina", String(atual.pagina));
}

export function consultaFiltrosSanidade(filtros: FiltrosSanidade): URLSearchParams {
  const params = new URLSearchParams({ pagina: String(filtros.pagina), porPagina: "50" });
  for (const chave of plurais) if (filtros[chave].length) params.set(chave, filtros[chave].join(","));
  for (const chave of escalares) if (filtros[chave].trim()) params.set(chave, filtros[chave].trim());
  return params;
}
