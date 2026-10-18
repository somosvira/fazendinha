import type { Context } from "hono";
import { resolverEscopoEscrita as resolverEscrita, resolverEscopoLeitura as resolverLeitura } from "../../services/propriedade.js";

// O apresentador usa o mesmo sítio já resolvido para o serviço, inclusive em
// escritas cujo sítio explícito prevalece sobre o seletor global.
export async function resolverEscopoLeitura(c: Context) {
  const sitio = await resolverLeitura(c);
  c.set("sitioCustosPecuaria", sitio);
  return sitio;
}

export async function resolverEscopoEscrita(c: Context, explicitoId?: number | null) {
  const sitio = await resolverEscrita(c, explicitoId);
  c.set("sitioCustosPecuaria", sitio);
  return sitio;
}
