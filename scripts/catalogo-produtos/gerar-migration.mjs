#!/usr/bin/env node
// Gera a migration de dados do catálogo de produtos do sistema (docs/produtos.md, "Carga e atualização").
//
// Uso: node scripts/catalogo-produtos/gerar-migration.mjs <catalogo-curado.json> <diretorio-da-migration>
//
// Entrada: saída de curar.mjs (catalogo-curado.json).
// Saída:   <diretorio-da-migration>/migration.sql
//
//  - linhas legadas (codigoOrigem 'LEGADO-%') com o mesmo nomeNormalizado são reivindicadas antes do insert.
// O SQL é determinístico (mesma entrada, mesmos bytes) e idempotente:
//  - fabricantes, classificações técnicas e princípios ativos entram por codigoOrigem;
//  - produtos entram por (fonte, codigoOrigem), com ON CONFLICT DO UPDATE que só grava quando algo mudou;
//  - a lista de princípios ativos de cada produto da fonte é substituída;
//  - produtos da fonte que não estão no arquivo ficam ativo = false (nunca são apagados).
//  - em "Produto" (produtos da fazenda) só o nome muda: produto adotado com nomeAlterado = false recebe o
//    novo nome completo do item, quando ele mudou e nenhum outro Produto já o usa. Os demais campos
//    da fazenda nunca são tocados; os herdáveis são lidos do catálogo (docs/produtos.md, Herança).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Namespace fixo dos UUIDv5 do catálogo. Mudar este valor muda todos os ids: não mudar.
export const NAMESPACE_CATALOGO = '6f0a8d3e-5c1b-4f7a-9e2d-3b8c1a7d4e50';
export const UNIDADES_VALIDAS = ['UN', 'KG', 'G', 'T', 'L', 'ML', 'SC', 'DOSE', 'CX', 'M', 'HA'];

const ACENTOS_ORIGEM = 'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñÝýÿ';
const ACENTOS_DESTINO = 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy';

/** Espelha public.normalizar_nome_produto_v1 (migration 20261108120000). */
export function normalizarNome(valor) {
  return [...valor.replace(/\s+/g, ' ').trim()].map((c) => {
    const i = ACENTOS_ORIGEM.indexOf(c);
    return i < 0 ? c : ACENTOS_DESTINO[i];
  }).join('').toLowerCase();
}

/** UUID versão 5 (SHA-1) conforme RFC 4122. */
export function uuidV5(nome, namespace = NAMESPACE_CATALOGO) {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const h = createHash('sha1').update(ns).update(Buffer.from(nome, 'utf8')).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Literal de texto SQL. Aspas dobradas; barra invertida só em E'' para não depender de standard_conforming_strings. */
export function sqlTexto(valor) {
  if (valor === null || valor === undefined) return 'NULL';
  const texto = String(valor);
  if (texto.includes('\0')) throw new Error('Texto com caractere NUL não pode virar literal SQL');
  const aspas = texto.replace(/'/g, "''");
  return texto.includes('\\') ? `E'${aspas.replace(/\\/g, '\\\\')}'` : `'${aspas}'`;
}
const sqlBool = (v) => (v ? 'true' : 'false');
const sqlNormalizado = (nome) => `public.normalizar_nome_produto_v1(${sqlTexto(nome)})`;

function exigir(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

/** Valida o catálogo curado e devolve estruturas prontas para gerar o SQL. Falha cedo, antes de escrever. */
export function validarCatalogo(catalogo) {
  exigir(Number.isInteger(catalogo.versao) && catalogo.versao > 0, '"versao" deve ser inteiro positivo');
  exigir(typeof catalogo.fonte === 'string' && /^[A-Z0-9_]{1,40}$/.test(catalogo.fonte), '"fonte" inválida (A-Z, 0-9, _; até 40)');
  for (const lista of ['fabricantes', 'classificacoes', 'principiosAtivos', 'produtos']) {
    exigir(Array.isArray(catalogo[lista]), `"${lista}" deve ser lista`);
  }
  const limites = { fabricantes: [2, 160], classificacoes: [2, 160], principiosAtivos: [2, 100] };
  const codigos = {};
  for (const [lista, [min, max]] of Object.entries(limites)) {
    const vistos = new Set();
    const normalizados = new Map();
    for (const item of catalogo[lista]) {
      exigir(typeof item.codigo === 'string' && item.codigo !== '', `${lista}: código vazio`);
      exigir(!vistos.has(item.codigo), `${lista}: código repetido ${item.codigo}`);
      vistos.add(item.codigo);
      const nome = String(item.nome ?? '').trim();
      exigir(nome.length >= min && nome.length <= max, `${lista} ${item.codigo}: nome fora de ${min}-${max} caracteres`);
      const n = normalizarNome(item.nome);
      exigir(!normalizados.has(n), `${lista}: nome normalizado repetido "${n}" (${normalizados.get(n)} e ${item.codigo})`);
      normalizados.set(n, item.codigo);
    }
    codigos[lista] = vistos;
  }
  const produtos = new Set();
  for (const p of catalogo.produtos) {
    exigir(typeof p.codigoOrigem === 'string' && p.codigoOrigem !== '', 'produto sem codigoOrigem');
    exigir(!produtos.has(p.codigoOrigem), `produto repetido ${p.codigoOrigem}`);
    produtos.add(p.codigoOrigem);
    const nome = String(p.nome ?? '').trim();
    exigir(nome.length >= 2 && nome.length <= 200, `produto ${p.codigoOrigem}: nome fora de 2-200 caracteres`);
    exigir(p.apresentacao == null || String(p.apresentacao).length <= 200, `produto ${p.codigoOrigem}: apresentação com mais de 200 caracteres`);
    exigir(UNIDADES_VALIDAS.includes(p.unidadeSugerida), `produto ${p.codigoOrigem}: unidade inválida ${p.unidadeSugerida}`);
    exigir(p.fabricanteCodigo == null || codigos.fabricantes.has(p.fabricanteCodigo), `produto ${p.codigoOrigem}: fabricante inexistente ${p.fabricanteCodigo}`);
    exigir(p.classificacaoCodigo == null || codigos.classificacoes.has(p.classificacaoCodigo), `produto ${p.codigoOrigem}: classificação inexistente ${p.classificacaoCodigo}`);
    exigir(Array.isArray(p.principiosAtivos), `produto ${p.codigoOrigem}: principiosAtivos deve ser lista`);
    for (const pa of p.principiosAtivos) exigir(codigos.principiosAtivos.has(pa), `produto ${p.codigoOrigem}: princípio ativo inexistente ${pa}`);
  }
  return catalogo;
}

const em = (linhas) => linhas.join(',\n');

function upsertAuxiliar(tabela, fonte, itens, rotulo) {
  if (!itens.length) return '';
  const valores = itens.map((i) => `  (${sqlTexto(uuidV5(`${fonte}|${rotulo}|${i.codigo}`))}::uuid, ${sqlTexto(i.codigo)}, ${sqlTexto(i.nome.trim())}, ${sqlNormalizado(i.nome)})`);
  const reivindicar = itens.map((i) => `  (${sqlTexto(i.codigo)}, ${sqlNormalizado(i.nome)})`);
  return `-- ${tabela}: ${itens.length}
-- Linha legada (codigoOrigem 'LEGADO-<id>', criada pela migration de schema) com o mesmo nome normalizado é
-- reivindicada: ganha o codigoOrigem do item e mantém o id. O upsert abaixo (por codigoOrigem) então a atualiza
-- em vez de violar a unicidade de nomeNormalizado. Nada depende de id determinístico: as referências são por codigoOrigem.
UPDATE public."${tabela}" t
SET "codigoOrigem" = v."codigo"
FROM (VALUES
${em(reivindicar)}
) AS v("codigo", "normalizado")
WHERE t."nomeNormalizado" = v."normalizado"
  AND t."codigoOrigem" LIKE 'LEGADO-%'
  AND NOT EXISTS (SELECT 1 FROM public."${tabela}" o WHERE o."codigoOrigem" = v."codigo");

INSERT INTO public."${tabela}" ("id", "codigoOrigem", "nome", "nomeNormalizado")
VALUES
${em(valores)}
ON CONFLICT ("codigoOrigem") DO UPDATE SET
  "nome" = EXCLUDED."nome",
  "nomeNormalizado" = EXCLUDED."nomeNormalizado",
  "ativo" = true
WHERE (public."${tabela}"."nome", public."${tabela}"."nomeNormalizado", public."${tabela}"."ativo")
  IS DISTINCT FROM (EXCLUDED."nome", EXCLUDED."nomeNormalizado", true);
`;
}

/** Gera o texto completo de migration.sql. */
export function gerarSql(catalogo) {
  validarCatalogo(catalogo);
  const { fonte, versao } = catalogo;
  const produtos = [...catalogo.produtos].sort((a, b) => a.codigoOrigem.localeCompare(b.codigoOrigem, 'en', { numeric: true }));
  const ordenar = (l) => [...l].sort((a, b) => a.codigo.localeCompare(b.codigo, 'en', { numeric: true }));
  const fabricantes = ordenar(catalogo.fabricantes), classificacoes = ordenar(catalogo.classificacoes), principios = ordenar(catalogo.principiosAtivos);

  const resumo = createHash('sha256').update(JSON.stringify({ fonte, versao, fabricantes, classificacoes, principios, produtos })).digest('hex');
  const partes = [];
  partes.push(`-- Catálogo de produtos do sistema, fonte ${fonte}, versão ${versao}.
-- Gerado por scripts/catalogo-produtos/gerar-migration.mjs a partir da extração curada; não editar à mão.
-- Conteúdo: ${fabricantes.length} fabricantes, ${classificacoes.length} classificações técnicas, ${principios.length} princípios ativos, ${produtos.length} produtos.
-- sha256 do conteúdo: ${resumo}
-- Idempotente: reaplicar o mesmo arquivo não altera nenhuma linha.
-- Produtos da fazenda ("Produto"): só o nome dos adotados e não renomeados acompanha o catálogo.
`);
  partes.push(upsertAuxiliar('FabricanteProduto', fonte, fabricantes, 'fabricante'));
  partes.push(upsertAuxiliar('ClassificacaoTecnicaProduto', fonte, classificacoes, 'classificacao'));
  partes.push(upsertAuxiliar('PrincipioAtivo', fonte, principios, 'principioativo'));

  if (produtos.length) {
    const valores = produtos.map((p) => `  (${sqlTexto(uuidV5(`${fonte}|produto|${p.codigoOrigem}`))}::uuid, ${sqlTexto(p.codigoOrigem)}, ${sqlTexto(p.nome.trim())}, ${sqlTexto(p.apresentacao == null || String(p.apresentacao).trim() === '' ? null : String(p.apresentacao).trim())}, ${sqlTexto(p.fabricanteCodigo ?? null)}, ${sqlTexto(p.classificacaoCodigo ?? null)}, ${sqlTexto(p.unidadeSugerida)}, ${sqlBool(p.usoSanitario)}, ${sqlBool(p.usoNutricional)}, ${sqlBool(p.usoGenetico)}, ${sqlBool(p.ativo !== false)})`);
    partes.push(`-- ProdutoCatalogo: ${produtos.length}
INSERT INTO public."ProdutoCatalogo"
  ("id", "fonte", "codigoOrigem", "nome", "nomeNormalizado", "apresentacao", "fabricanteId", "classificacaoTecnicaId",
   "unidadeSugerida", "usoSanitario", "usoNutricional", "usoGenetico", "ativo", "versaoCatalogo", "atualizadoEm")
SELECT v."id", ${sqlTexto(fonte)}, v."codigo", v."nome", public.normalizar_nome_produto_v1(v."nome"), v."apresentacao", f."id", c."id",
  v."unidade"::"UnidadeMedida", v."san", v."nut", v."gen", v."ativo", ${versao}, now()
FROM (VALUES
${em(valores)}
) AS v("id", "codigo", "nome", "apresentacao", "fabricante", "classificacao", "unidade", "san", "nut", "gen", "ativo")
LEFT JOIN public."FabricanteProduto" f ON f."codigoOrigem" = v."fabricante"
LEFT JOIN public."ClassificacaoTecnicaProduto" c ON c."codigoOrigem" = v."classificacao"
ON CONFLICT ("fonte", "codigoOrigem") DO UPDATE SET
  "nome" = EXCLUDED."nome",
  "nomeNormalizado" = EXCLUDED."nomeNormalizado",
  "apresentacao" = EXCLUDED."apresentacao",
  "fabricanteId" = EXCLUDED."fabricanteId",
  "classificacaoTecnicaId" = EXCLUDED."classificacaoTecnicaId",
  "unidadeSugerida" = EXCLUDED."unidadeSugerida",
  "usoSanitario" = EXCLUDED."usoSanitario",
  "usoNutricional" = EXCLUDED."usoNutricional",
  "usoGenetico" = EXCLUDED."usoGenetico",
  "ativo" = EXCLUDED."ativo",
  "versaoCatalogo" = EXCLUDED."versaoCatalogo",
  "atualizadoEm" = EXCLUDED."atualizadoEm"
WHERE (public."ProdutoCatalogo"."nome", public."ProdutoCatalogo"."apresentacao", public."ProdutoCatalogo"."fabricanteId",
       public."ProdutoCatalogo"."classificacaoTecnicaId", public."ProdutoCatalogo"."unidadeSugerida", public."ProdutoCatalogo"."usoSanitario",
       public."ProdutoCatalogo"."usoNutricional", public."ProdutoCatalogo"."usoGenetico", public."ProdutoCatalogo"."ativo")
  IS DISTINCT FROM (EXCLUDED."nome", EXCLUDED."apresentacao", EXCLUDED."fabricanteId", EXCLUDED."classificacaoTecnicaId",
       EXCLUDED."unidadeSugerida", EXCLUDED."usoSanitario", EXCLUDED."usoNutricional", EXCLUDED."usoGenetico", EXCLUDED."ativo");
`);
  }

  // Itens da fonte que saíram do arquivo ficam inativos; nunca são apagados.
  const lista = produtos.map((p) => sqlTexto(p.codigoOrigem));
  partes.push(`-- Itens da fonte ${fonte} ausentes desta versão ficam inativos.
UPDATE public."ProdutoCatalogo"
SET "ativo" = false, "versaoCatalogo" = ${versao}, "atualizadoEm" = now()
WHERE "fonte" = ${sqlTexto(fonte)} AND "ativo" = true
${lista.length ? `  AND "codigoOrigem" NOT IN (\n${em(lista.map((c) => `    ${c}`))}\n  )` : '  AND true'};
`);

  // Produto da fazenda adotado e não renomeado acompanha o nome completo do item, sem colisão.
  // Mesmo formato de nomeCompletoCatalogo (server/src/services/estoque/produtos-catalogo.calc.ts).
  partes.push(`-- Produtos da fazenda adotados com nomeAlterado = false recebem o nome completo atualizado do item.
-- Colisão com outro Produto (ou entre dois adotados) mantém o nome atual.
WITH novo AS (
  SELECT p."id", CASE WHEN c."apresentacao" IS NULL OR btrim(c."apresentacao") = '' THEN btrim(c."nome")
    ELSE btrim(c."nome") || ' (' || btrim(c."apresentacao") || ')' END AS "nome"
  FROM public."Produto" p
  JOIN public."ProdutoCatalogo" c ON c."id" = p."produtoCatalogoId"
  WHERE c."fonte" = ${sqlTexto(fonte)} AND p."nomeAlterado" = false
), mudou AS (
  SELECT n."id", n."nome" FROM novo n JOIN public."Produto" p ON p."id" = n."id" WHERE p."nome" IS DISTINCT FROM n."nome"
)
UPDATE public."Produto" p
SET "nome" = m."nome", "updatedAt" = now()
FROM mudou m
WHERE p."id" = m."id"
  AND NOT EXISTS (SELECT 1 FROM public."Produto" o WHERE o."nome" = m."nome" AND o."id" <> p."id")
  AND (SELECT count(*) FROM mudou d WHERE d."nome" = m."nome") = 1;
`);

  // Lista simples de princípios ativos por produto: substitui a lista de todos os produtos da fonte.
  const vinculos = [];
  for (const p of produtos) {
    [...new Set(p.principiosAtivos)].forEach((pa, i) => vinculos.push(`  (${sqlTexto(p.codigoOrigem)}, ${sqlTexto(pa)}, ${i + 1})`));
  }
  partes.push(`-- Princípios ativos por produto (lista simples, sem concentração): ${vinculos.length} vínculos.
DELETE FROM public."ProdutoCatalogoPrincipioAtivo" l
USING public."ProdutoCatalogo" p
WHERE l."produtoCatalogoId" = p."id" AND p."fonte" = ${sqlTexto(fonte)};
${vinculos.length ? `
INSERT INTO public."ProdutoCatalogoPrincipioAtivo" ("produtoCatalogoId", "principioAtivoId", "ordem")
SELECT p."id", pa."id", v."ordem"
FROM (VALUES
${em(vinculos)}
) AS v("produto", "principio", "ordem")
JOIN public."ProdutoCatalogo" p ON p."fonte" = ${sqlTexto(fonte)} AND p."codigoOrigem" = v."produto"
JOIN public."PrincipioAtivo" pa ON pa."codigoOrigem" = v."principio";
` : ''}`);

  return partes.filter(Boolean).join('\n');
}

export function gerarArquivo(entrada, diretorio) {
  const catalogo = JSON.parse(readFileSync(entrada, 'utf8'));
  const sql = gerarSql(catalogo);
  mkdirSync(diretorio, { recursive: true });
  const saida = path.join(diretorio, 'migration.sql');
  writeFileSync(saida, sql, 'utf8');
  return { saida, bytes: Buffer.byteLength(sql), produtos: catalogo.produtos.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [entrada, diretorio] = process.argv.slice(2);
  if (!entrada || !diretorio) {
    console.error('Uso: node scripts/catalogo-produtos/gerar-migration.mjs <catalogo-curado.json> <diretorio-da-migration>');
    process.exit(2);
  }
  const r = gerarArquivo(entrada, diretorio);
  console.log(`${r.produtos} produtos -> ${r.saida} (${r.bytes} bytes)`);
}
