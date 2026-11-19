import { readFileSync, writeFileSync } from "node:fs";
import { orientacaoBulaSchema } from "../../../server/src/services/estoque/bulas.schemas.js";

type Entrada = {
  nomeCatalogo: string; fabricanteCatalogo: string;
  itens: { id: string; apresentacao: string }[];
  orientacao: unknown;
};
const arquivo = process.argv[2], destino = process.argv[3];
if (!arquivo || !destino) throw new Error("Informe o JSON conferido e o arquivo SQL de destino");
const entradas: Entrada[] = JSON.parse(readFileSync(arquivo, "utf8"));
const literal = (v: string) => "'" + v.replaceAll("'", "''") + "'";
const ids = new Set<string>();
const sql = entradas.map(e => {
  const orientacao = orientacaoBulaSchema.parse(e.orientacao);
  if (!e.nomeCatalogo || !e.fabricanteCatalogo || !e.itens.length) throw new Error("Identidade do produto incompleta");
  const consulta = e.itens.map(item => {
    if (!/^[a-f0-9-]{36}$/.test(item.id) || ids.has(item.id)) throw new Error("Identidade inválida ou repetida");
    ids.add(item.id);
    return "(p.id = " + literal(item.id) + "::uuid AND p.apresentacao = " + literal(item.apresentacao) + ")";
  }).join(" OR ");
  return [
    "DO $curadoria$",
    "DECLARE quantidade integer;",
    "BEGIN",
    '  UPDATE public."ProdutoCatalogo" p',
    '    SET "orientacaoBula" = ' + literal(JSON.stringify(orientacao)) + '::jsonb, "atualizadoEm" = CURRENT_TIMESTAMP',
    '    FROM public."FabricanteProduto" f',
    '    WHERE f.id = p."fabricanteId" AND f.nome = ' + literal(e.fabricanteCatalogo),
    "      AND p.nome = " + literal(e.nomeCatalogo) + " AND (" + consulta + ");",
    "  GET DIAGNOSTICS quantidade = ROW_COUNT;",
    "  IF quantidade <> " + e.itens.length + " THEN",
    "    RAISE EXCEPTION 'Identidade ou apresentação divergente na curadoria de bulas';",
    "  END IF;",
    "END $curadoria$;",
  ].join("\n");
});
writeFileSync(destino, "-- Referências oficiais conferidas. Preserva perfis da fazenda e fatos históricos.\n" + sql.join("\n\n") + "\n");
console.log(JSON.stringify({ produtos: entradas.length, apresentacoes: ids.size }));
