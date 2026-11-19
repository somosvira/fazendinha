import { readFileSync, writeFileSync } from "node:fs";
import { conferenciaBulaSchema, orientacaoBulaSchema } from "../../../server/src/services/estoque/bulas.schemas.js";
const [arquivo, pendenciasArquivo, destino] = process.argv.slice(2);
if (!arquivo || !pendenciasArquivo || !destino) throw new Error("Informe referências, pendências e destino SQL");
const literal = (v: unknown) => v == null ? "NULL" : "'" + String(v).replaceAll("'", "''") + "'";
const json = (v: unknown) => literal(JSON.stringify(v)) + "::jsonb";
const pesquisa = conferenciaBulaSchema.parse({ estado: "PESQUISA_PENDENTE", pendencias: [{ campo: "pesquisa", motivo: "Pesquisa de fonte oficial para esta apresentação ainda pendente. Dose, via e carências não foram conferidas." }], fontesParaConferencia: [] });
const sql = [
  '-- Informações oficiais parciais, com proveniência por campo. Não altera Produto, perfis sanitários, templates, aplicações, estoque ou custos.',
  'ALTER TABLE public."ProdutoCatalogo" ADD COLUMN "conferenciaBula" JSONB;',
  'ALTER TABLE public."ProdutoCatalogo" ADD CONSTRAINT "ProdutoCatalogo_conferencia_bula_objeto" CHECK ("conferenciaBula" IS NULL OR jsonb_typeof("conferenciaBula") = \'object\');',
  `UPDATE public."ProdutoCatalogo" SET "conferenciaBula" = ${json(pesquisa)} WHERE ativo AND "usoSanitario" AND "orientacaoBula" IS NULL;`,
];
const pendencias = JSON.parse(readFileSync(pendenciasArquivo, "utf8")) as { nomeCatalogo: string; motivo?: string; estado?: string; urls?: string[]; urlsExaminadas?: string[]; apresentacoesPendentes?: string[] }[];
const agrupados = new Map<string, typeof pendencias>();
for (const p of pendencias) agrupados.set(p.nomeCatalogo, [...(agrupados.get(p.nomeCatalogo) ?? []), p]);
for (const [nome, grupo] of agrupados) {
  const motivos = [...new Set(grupo.map(p => p.motivo ?? "Documento oficial identificado, mas a conferência desta apresentação ainda não foi concluída."))];
  const campo = (m: string) => /apresenta|frasco|seringa|embalagem/i.test(m) ? "apresentacao" : /compos|fórmula|formula|princípio|concentra/i.test(m) ? "concentracao" : /carência|carencia/i.test(m) ? "carencias" : /fabricante|identidade|titular|versão/i.test(m) ? "identidade" : "pesquisa";
  const fontes = [...new Set(grupo.flatMap(p => [...(p.urls ?? []), ...(p.urlsExaminadas ?? [])]).filter(u => typeof u === "string" && u.startsWith("https://")))];
  const dados = conferenciaBulaSchema.parse({ estado: grupo.some(p => p.estado === "DIVERGENCIA") ? "IDENTIDADE_PENDENTE" : "CONFERENCIA_PENDENTE", pendencias: motivos.map(m => ({ campo: campo(m), motivo: m })), fontesParaConferencia: fontes });
  sql.push(`UPDATE public."ProdutoCatalogo" SET "conferenciaBula" = ${json(dados)} WHERE ativo AND "orientacaoBula" IS NULL AND public.normalizar_nome_produto_v1(nome) = public.normalizar_nome_produto_v1(${literal(nome)});`);
}
const banamine = conferenciaBulaSchema.parse({ estado: "IDENTIDADE_PENDENTE", pendencias: [{ campo: "identidade", motivo: "O nome histórico Banamine não distingue a versão injetável da transdérmica. Confirmar formulação e apresentação antes de associar doses, via ou carências da ficha consultada." }], fontesParaConferencia: ["https://www.msd-saude-animal.com.br/produto/banamine-injetavel/", "https://www.msd-saude-animal.com.br/produto/banamine-transdermal/"] });
sql.push(`UPDATE public."ProdutoCatalogo" SET "conferenciaBula" = ${json(banamine)} WHERE id = '2d3c2183-acc8-50c5-b54a-b9f67e2786d2'::uuid AND nome = 'Banamine' AND fonte = 'IDEAGRI_DADOS777' AND "orientacaoBula" IS NULL;`);
const entradas = JSON.parse(readFileSync(arquivo, "utf8")) as { nomeCatalogo: string; fabricanteCatalogo: string | null; itens: { id: string; apresentacao: string | null }[]; orientacao: unknown }[];
const ids = new Set<string>();
for (const e of entradas) {
  const orientacao = orientacaoBulaSchema.parse(e.orientacao);
  for (const item of e.itens) {
    if (!/^[a-f0-9-]{36}$/.test(item.id) || ids.has(item.id)) throw new Error("Identificador inválido ou duplicado");
    ids.add(item.id);
    const guarda = `p.id = ${literal(item.id)}::uuid AND p.nome = ${literal(e.nomeCatalogo)} AND p.apresentacao IS NOT DISTINCT FROM ${literal(item.apresentacao)} AND (SELECT f.nome FROM public."FabricanteProduto" f WHERE f.id = p."fabricanteId") IS NOT DISTINCT FROM ${literal(e.fabricanteCatalogo)}`;
    sql.push(`DO $curadoria$ BEGIN IF (SELECT count(*) FROM public."ProdutoCatalogo" p WHERE ${guarda}) <> 1 THEN RAISE EXCEPTION 'Identidade da referência parcial divergente'; END IF; UPDATE public."ProdutoCatalogo" p SET "orientacaoBula" = ${json(orientacao)}, "conferenciaBula" = NULL, "atualizadoEm" = CURRENT_TIMESTAMP WHERE ${guarda}; END $curadoria$;`);
  }
}
writeFileSync(destino, sql.join("\n\n") + "\n");
console.log(JSON.stringify({ referencias: ids.size, nomesComPendenciasDocumentadas: agrupados.size }));
