import type { Context } from "hono";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";

/**
 * Leitura de um registro existente: com um sítio na sidebar usa esse sítio; em Consolidado,
 * usa o sítio do próprio registro, para a consulta consolidada conseguir abrir o detalhe.
 */
export async function sitioDoRegistro(c: Context, buscar: () => Promise<{ propriedadeId: number } | null>, rotulo: string) {
  const escopo = await resolverEscopoLeitura(c);
  if (escopo !== null) return escopo;
  const registro = await buscar();
  if (!registro) throw new RebanhoError("NAO_ENCONTRADO", `${rotulo} não encontrado`);
  return registro.propriedadeId;
}
