import { appendFileSync, readFileSync } from "node:fs";
import { conferenciaBulaSchema } from "../../../server/src/services/estoque/bulas.schemas.js";

type Item = { id: string; nome: string; fabricante: string | null; apresentacao: string | null; conferencia: unknown };
type Original = Omit<Item, "conferencia"> & { conferenciaBula: unknown };
const [pesquisaArquivo, originaisArquivo, destino] = process.argv.slice(2);
if (!pesquisaArquivo || !originaisArquivo || !destino) throw new Error("Informe pesquisa, snapshot original e migration de destino");
const itens = (JSON.parse(readFileSync(pesquisaArquivo, "utf8")) as { itens: Item[] }).itens;
const originais = JSON.parse(readFileSync(originaisArquivo, "utf8")) as Original[];
const porId = new Map(originais.map(item => [item.id, item]));
if (porId.size !== originais.length || itens.length !== originais.length) throw new Error("Cobertura da pesquisa divergente");
const literal = (valor: unknown) => valor == null ? "NULL" : "'" + String(valor).replaceAll("'", "''") + "'";
const json = (valor: unknown) => literal(JSON.stringify(valor)) + "::jsonb";
const ids = new Set<string>();
const sql = ["-- Pesquisa documental: somente motivos pendentes; não valida dados clínicos nem substitui referências existentes."];
for (const item of itens) {
  const anterior = porId.get(item.id);
  if (!anterior || ids.has(item.id) || !/^[a-f0-9-]{36}$/.test(item.id) || anterior.nome !== item.nome || anterior.fabricante !== item.fabricante || anterior.apresentacao !== item.apresentacao) throw new Error("Identidade ou cobertura da pesquisa divergente");
  ids.add(item.id);
  if (item.conferencia === null) continue; // A referência confirmada é gerada separadamente.
  const conferencia = conferenciaBulaSchema.parse(item.conferencia);
  const conferenciaAnterior = conferenciaBulaSchema.parse(anterior.conferenciaBula);
  if (conferenciaAnterior.pendencias.some(p => !conferencia.pendencias.some(n => n.campo === p.campo && n.motivo === p.motivo))) throw new Error("Pesquisa não pode apagar pendência anterior sem conferência");
  const guarda = `p.id = ${literal(item.id)}::uuid AND p.ativo AND p."usoSanitario" AND p.nome = ${literal(item.nome)} AND p.apresentacao IS NOT DISTINCT FROM ${literal(item.apresentacao)} AND (SELECT f.nome FROM public."FabricanteProduto" f WHERE f.id = p."fabricanteId") IS NOT DISTINCT FROM ${literal(item.fabricante)} AND p."orientacaoBula" IS NULL AND p."conferenciaBula" IS NOT DISTINCT FROM ${json(anterior.conferenciaBula)}`;
  sql.push(`DO $pesquisa$ BEGIN IF (SELECT count(*) FROM public."ProdutoCatalogo" p WHERE ${guarda}) <> 1 THEN RAISE EXCEPTION 'Pesquisa alterada ou identidade divergente'; END IF; UPDATE public."ProdutoCatalogo" p SET "conferenciaBula" = ${json(conferencia)}, "atualizadoEm" = CURRENT_TIMESTAMP WHERE ${guarda}; END $pesquisa$;`);
}
appendFileSync(destino, "\n" + sql.join("\n\n") + "\n");
console.log(JSON.stringify({ pesquisados: ids.size, pendentes: sql.length - 1 }));
