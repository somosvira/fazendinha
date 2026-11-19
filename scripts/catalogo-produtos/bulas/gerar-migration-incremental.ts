import { readFileSync, writeFileSync } from "node:fs";
import { orientacaoBulaSchema } from "../../../server/src/services/estoque/bulas.schemas.js";

// Lotes posteriores à introdução de conferenciaBula: apenas novas referências.
const [arquivo, destino] = process.argv.slice(2);
if (!arquivo || !destino) throw new Error("Informe referências e destino SQL");
const literal = (valor: unknown) => valor == null ? "NULL" : "'" + String(valor).replaceAll("'", "''") + "'";
const entradas = JSON.parse(readFileSync(arquivo, "utf8")) as { nomeCatalogo: string; fabricanteCatalogo: string | null; itens: { id: string; apresentacao: string | null }[]; orientacao: unknown }[];
const sql = ["-- Curadoria incremental: somente referências oficiais. Preserva histórico, templates, estoque e custos."];
const ids = new Set<string>();
for (const entrada of entradas) {
  const orientacao = orientacaoBulaSchema.parse(entrada.orientacao);
  for (const item of entrada.itens) {
    if (!/^[a-f0-9-]{36}$/.test(item.id) || ids.has(item.id)) throw new Error("Identificador inválido ou duplicado");
    ids.add(item.id);
    const guarda = `p.id = ${literal(item.id)}::uuid AND p.nome = ${literal(entrada.nomeCatalogo)} AND p.apresentacao IS NOT DISTINCT FROM ${literal(item.apresentacao)} AND (SELECT f.nome FROM public."FabricanteProduto" f WHERE f.id = p."fabricanteId") IS NOT DISTINCT FROM ${literal(entrada.fabricanteCatalogo)} AND p."orientacaoBula" IS NULL`;
    sql.push(`DO $curadoria$ BEGIN IF (SELECT count(*) FROM public."ProdutoCatalogo" p WHERE ${guarda}) <> 1 THEN RAISE EXCEPTION 'Identidade divergente ou referência já preenchida'; END IF; UPDATE public."ProdutoCatalogo" p SET "orientacaoBula" = ${literal(JSON.stringify(orientacao))}::jsonb, "conferenciaBula" = NULL, "atualizadoEm" = CURRENT_TIMESTAMP WHERE ${guarda}; END $curadoria$;`);
  }
}
writeFileSync(destino, sql.join("\n\n") + "\n");
console.log(JSON.stringify({ referencias: ids.size }));
