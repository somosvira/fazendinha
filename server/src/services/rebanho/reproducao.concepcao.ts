// Taxa de concepção por método de cobertura (IA × TE).
//
// Regime: reprodução 100% interna (IATF + transferência de embrião). O KPI que a
// administração cita ("~35% de concepção") é o percentual de coberturas que viram
// prenhez confirmada no diagnóstico de gestação.
//
// Método de cobertura: INSEMINACAO → "IA"; TRANSFERENCIA_EMBRIAO → "TE".
// "Prenhe" = diagnóstico com resultado "positivo" (é assim que o campo `resultado`
// é gravado hoje — enum minúsculo "positivo"/"negativo" em eventos.schemas.ts;
// aqui comparamos case-insensitive por segurança).
//
// Atribuição: um DIAGNOSTICO é atribuído à cobertura (IA ou TE) mais recente ANTES
// dele, no MESMO animal — por isso o input precisa de `animalId` pra agrupar. Um
// diagnóstico positivo resolve a cobertura pendente (evita contagem dupla em
// reconfirmações); diagnóstico sem cobertura anterior é ignorado.
//
// taxa = prenhes / coberturas, ou `null` quando não há coberturas (nunca NaN).

export type MetodoCobertura = "IA" | "TE";

export interface EvtConcepcao {
  animalId: number | string;
  tipo: "CIO" | "INSEMINACAO" | "DIAGNOSTICO" | "PARTO" | "SECAGEM" | "TRANSFERENCIA_EMBRIAO" | string;
  data: string; // ISO YYYY-MM-DD
  resultado?: string | null;
}

export interface TaxaConcepcaoMetodo {
  metodo: MetodoCobertura;
  coberturas: number;
  prenhes: number;
  taxa: number | null;
}

const metodoDaCobertura = (tipo: string): MetodoCobertura | null =>
  tipo === "INSEMINACAO" ? "IA" : tipo === "TRANSFERENCIA_EMBRIAO" ? "TE" : null;

const ehPositivo = (r?: string | null): boolean => (r ?? "").trim().toLowerCase() === "positivo";

export function calcularTaxaConcepcao(eventos: EvtConcepcao[]): TaxaConcepcaoMetodo[] {
  const coberturas: Record<MetodoCobertura, number> = { IA: 0, TE: 0 };
  const prenhes: Record<MetodoCobertura, number> = { IA: 0, TE: 0 };

  // agrupa por animal e ordena por data (estável) — a atribuição do diagnóstico
  // depende da sequência cronológica de cada fêmea.
  const porAnimal = new Map<string, EvtConcepcao[]>();
  for (const e of eventos) {
    const k = String(e.animalId);
    (porAnimal.get(k) ?? porAnimal.set(k, []).get(k)!).push(e);
  }

  for (const evs of porAnimal.values()) {
    const ordenados = evs.slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
    let pendente: MetodoCobertura | null = null; // cobertura ainda não diagnosticada
    for (const e of ordenados) {
      const m = metodoDaCobertura(e.tipo);
      if (m) {
        coberturas[m]++;
        pendente = m;
      } else if (e.tipo === "DIAGNOSTICO" && pendente) {
        if (ehPositivo(e.resultado)) prenhes[pendente]++;
        pendente = null; // resolve a cobertura (evita dupla contagem em reconfirmações)
      }
    }
  }

  const linha = (metodo: MetodoCobertura): TaxaConcepcaoMetodo => ({
    metodo,
    coberturas: coberturas[metodo],
    prenhes: prenhes[metodo],
    taxa: coberturas[metodo] > 0 ? prenhes[metodo] / coberturas[metodo] : null,
  });

  return [linha("IA"), linha("TE")];
}
