import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gerarArquivo, gerarSql, normalizarNome, sqlTexto, uuidV5, validarCatalogo } from './gerar-migration.mjs';

const base = () => ({
  versao: 1,
  fonte: 'IDEAGRI_DADOS000',
  geradoEm: '2026-11-09T00:00:00.000Z',
  fabricantes: [{ codigo: '2', nome: "Lab. D'Ávila" }, { codigo: '1', nome: 'Zoetis' }],
  classificacoes: [{ codigo: '36', nome: 'Endectocidas', estrutura: '4.10' }],
  principiosAtivos: [{ codigo: '1', nome: 'Abamectina' }, { codigo: '2', nome: 'Ivermectina' }],
  produtos: [
    { codigoOrigem: '20', nome: "Vermífugo O'Brien \\ 1%", apresentacao: 'Frasco 50 ml', fabricanteCodigo: '2', classificacaoCodigo: '36', unidadeSugerida: 'UN', usoSanitario: true, usoNutricional: false, usoGenetico: false, principiosAtivos: ['2', '1', '2'], ativo: true },
    { codigoOrigem: '3', nome: 'Sal mineral', apresentacao: null, fabricanteCodigo: null, classificacaoCodigo: null, unidadeSugerida: 'KG', usoSanitario: false, usoNutricional: true, usoGenetico: false, principiosAtivos: [], ativo: true },
  ],
});

test('sqlTexto dobra aspas, usa E\'\' para barra invertida e trata nulo', () => {
  assert.equal(sqlTexto("D'Ávila"), "'D''Ávila'");
  assert.equal(sqlTexto("a\\b'c"), "E'a\\\\b''c'");
  assert.equal(sqlTexto(null), 'NULL');
  assert.equal(sqlTexto(undefined), 'NULL');
  assert.equal(sqlTexto("'; DROP TABLE x; --"), "'''; DROP TABLE x; --'");
  assert.throws(() => sqlTexto('a\0b'), /NUL/);
});

test('uuidV5 é determinístico, versão 5 e distingue entradas', () => {
  const a = uuidV5('IDEAGRI_DADOS000|produto|1000');
  assert.equal(a, uuidV5('IDEAGRI_DADOS000|produto|1000'));
  assert.notEqual(a, uuidV5('IDEAGRI_DADOS000|produto|1001'));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  // Vetor conhecido da RFC 4122 (namespace DNS, "www.example.com").
  assert.equal(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'), '2ed6657d-e927-568b-95e1-2665a8aea6a2');
});

test('normalizarNome espelha a função SQL (acentos, espaços, caixa)', () => {
  assert.equal(normalizarNome('  Álcool   ÇÃO  '), 'alcool cao');
});

test('o SQL é idempotente por construção: determinístico e com ON CONFLICT que só atualiza se mudou', () => {
  const a = gerarSql(base());
  const embaralhado = base();
  embaralhado.produtos.reverse(); embaralhado.fabricantes.reverse();
  assert.equal(gerarSql(embaralhado), a, 'a ordem da entrada não pode mudar o SQL');
  assert.equal(gerarSql({ ...base(), geradoEm: 'outro' }), a, 'geradoEm não entra no SQL');
  assert.equal((a.match(/ON CONFLICT \("fonte", "codigoOrigem"\) DO UPDATE/g) ?? []).length, 1);
  assert.equal((a.match(/ON CONFLICT \("codigoOrigem"\) DO UPDATE/g) ?? []).length, 3);
  assert.equal((a.match(/IS DISTINCT FROM/g) ?? []).length, 5);
  assert.match(a, /SET "ativo" = false/);
  assert.match(a, /NOT IN \(\s+'3',\s+'20'\s+\)/);
  // Em "Produto" só há o UPDATE de nome dos adotados não renomeados, sem colisão.
  assert.equal((a.match(/UPDATE public\."Produto"/g) ?? []).length, 1);
  assert.doesNotMatch(a, /INSERT INTO public\."Produto"|DELETE FROM public\."Produto"/);
  assert.doesNotMatch(a, /\bDROP\b|\bTRUNCATE\b/);
});

test('escapa nomes e vínculos; princípios ativos repetidos são removidos e ordenados a partir de 1', () => {
  const sql = gerarSql(base());
  assert.ok(sql.includes("'Lab. D''Ávila'"));
  assert.ok(sql.includes("E'Vermífugo O''Brien \\\\ 1%'"));
  assert.ok(sql.includes("('20', '2', 1)"));
  assert.ok(sql.includes("('20', '1', 2)"));
  assert.ok(!sql.includes("('20', '2', 3)"));
  assert.ok(sql.includes('NULL'));
});

test('ids são os UUIDv5 de fonte + código', () => {
  const sql = gerarSql(base());
  assert.ok(sql.includes(uuidV5('IDEAGRI_DADOS000|produto|20')));
  assert.ok(sql.includes(uuidV5('IDEAGRI_DADOS000|fabricante|1')));
  assert.ok(sql.includes(uuidV5('IDEAGRI_DADOS000|principioativo|2')));
});

test('rejeita entradas inconsistentes antes de gerar SQL', () => {
  const com = (f) => { const c = base(); f(c); return c; };
  assert.throws(() => validarCatalogo(com((c) => { c.produtos[0].fabricanteCodigo = '99'; })), /fabricante inexistente/);
  assert.throws(() => validarCatalogo(com((c) => { c.produtos[0].classificacaoCodigo = '99'; })), /classificação inexistente/);
  assert.throws(() => validarCatalogo(com((c) => { c.produtos[0].principiosAtivos = ['99']; })), /princípio ativo inexistente/);
  assert.throws(() => validarCatalogo(com((c) => { c.produtos[1].codigoOrigem = '20'; })), /produto repetido/);
  assert.throws(() => validarCatalogo(com((c) => { c.produtos[0].unidadeSugerida = 'XX'; })), /unidade inválida/);
  assert.throws(() => validarCatalogo(com((c) => { c.principiosAtivos[1].nome = ' ABAMECTINA '; })), /normalizado repetido/);
  assert.throws(() => validarCatalogo(com((c) => { c.fonte = "X'; --"; })), /"fonte" inválida/);
  assert.throws(() => validarCatalogo(com((c) => { c.versao = 0; })), /versao/);
});

test('gerarArquivo grava migration.sql', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'catalogo-'));
  try {
    const entrada = path.join(dir, 'catalogo.json');
    writeFileSync(entrada, JSON.stringify(base()));
    const r = gerarArquivo(entrada, path.join(dir, 'm1'));
    assert.equal(readFileSync(r.saida, 'utf8'), gerarSql(base()));
    assert.equal(gerarArquivo(entrada, path.join(dir, 'm2')).bytes, r.bytes);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('nome dos produtos adotados: só não renomeados, só se mudou, sem colisão, restrito à fonte', () => {
  const sql = gerarSql(base());
  const bloco = sql.slice(sql.indexOf('WITH novo AS'), sql.indexOf('-- Princípios ativos'));
  assert.match(bloco, /p\."nomeAlterado" = false/);
  assert.match(bloco, /c\."fonte" = 'IDEAGRI_DADOS000'/);
  assert.match(bloco, /IS DISTINCT FROM n\."nome"/);
  assert.match(bloco, /NOT EXISTS \(SELECT 1 FROM public\."Produto" o WHERE o\."nome" = m\."nome" AND o\."id" <> p\."id"\)/);
  assert.match(bloco, /count\(\*\) FROM mudou d WHERE d\."nome" = m\."nome"\) = 1/);
  assert.match(bloco, /btrim\(c\."nome"\) \|\| ' \(' \|\| btrim\(c\."apresentacao"\) \|\| '\)'/);
  assert.match(bloco, /SET "nome" = m\."nome", "updatedAt" = now\(\)/);
  assert.ok(sql.indexOf('WITH novo AS') > sql.indexOf('INSERT INTO public."ProdutoCatalogo"'), 'o nome é atualizado depois da carga do catálogo');
});

test('linhas legadas com o mesmo nomeNormalizado são reivindicadas antes de cada insert, sem mudar o id', () => {
  const sql = gerarSql(base());
  for (const tabela of ['FabricanteProduto', 'ClassificacaoTecnicaProduto', 'PrincipioAtivo']) {
    const i = sql.indexOf(`UPDATE public."${tabela}" t`);
    const j = sql.indexOf(`INSERT INTO public."${tabela}"`);
    assert.ok(i >= 0 && j > i, `${tabela}: UPDATE de reivindicação antes do INSERT`);
    const bloco = sql.slice(i, j);
    assert.match(bloco, /SET "codigoOrigem" = v\."codigo"/);
    assert.doesNotMatch(bloco, /SET[^;]*"id"/);
    assert.match(bloco, /t\."nomeNormalizado" = v\."normalizado"/);
    assert.match(bloco, /t\."codigoOrigem" LIKE 'LEGADO-%'/);
    assert.match(bloco, /NOT EXISTS/);
    assert.match(bloco, /public\.normalizar_nome_produto_v1\(/);
  }
  assert.equal(gerarSql(base()), gerarSql(base()));
});
