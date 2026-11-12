import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  amostrar,
  curar,
  gerarRelatorio,
  limparEspacos,
  mapearUnidade,
  mulberry32,
  normalizar,
  separarApresentacao,
  serializarCatalogo,
  UNIDADES_VALIDAS,
  validarMapaClasses,
  validarMapaUnidades,
} from './curar.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const lerJson = (f) => JSON.parse(readFileSync(path.join(aqui, f), 'utf8'));
const mapaClassesReal = lerJson('classificacao-uso.json');
const mapaUnidadesReal = lerJson('unidade-medida.json');

// Mapas mínimos para os testes do núcleo.
const mapaClasses = {
  classes: {
    36: { nome: 'Endectocidas', estrutura: '4.10', uso: ['sanitario'], incluir: true, motivo: 'x' },
    42: { nome: 'Minerais', estrutura: '4.16', uso: ['nutricional'], incluir: true, motivo: 'x' },
    75: { nome: 'Herbicidas', estrutura: '3.28', uso: [], incluir: false, motivo: 'agrícola' },
  },
};
const mapaUnidades = {
  fallback: 'UN',
  unidades: {
    20: { nome: 'Unidade', unidade: 'UN', fallback: false },
    9: { nome: 'Litro', unidade: 'L', fallback: false },
    7: { nome: 'Hora', unidade: 'UN', fallback: true },
  },
};

let seq = 0;
const prod = (o = {}) => {
  seq += 1;
  return { CDPRODUTO: String(1000 + seq), NOME: `Produto ${seq} (Frasco 10 ml)`, TIPO: 'P', ATIVO: '0', COMPOSTO: '0', CDUNIDADEMEDIDA: '20', CDCLASSIFICACAO: '36', CDFABRICANTE: '1001', ...o };
};
const extracao = (produtos, extra = {}) => ({
  metadata: { extractedAt: '2026-11-09T00:00:00.000Z' },
  records: {
    PRODUTO: produtos,
    CLASSIFICACAO: [
      { CDCLASSIFICACAO: '36', DESCRICAO: 'Endectocidas', ESTRUTURA: '4.10' },
      { CDCLASSIFICACAO: '42', DESCRICAO: 'Minerais', ESTRUTURA: '4.16' },
      { CDCLASSIFICACAO: '75', DESCRICAO: 'Herbicidas', ESTRUTURA: '3.28' },
    ],
    PESSOA: [{ CDPESSOA: '1001', NOME: 'Fab A' }, { CDPESSOA: '1002', NOME: 'Fab B' }, { CDPESSOA: '1003', NOME: 'Sem uso' }],
    PRINCIPIOATIVO: [{ CDPRINCIPIOATIVO: '1', NOME: 'Abamectina' }, { CDPRINCIPIOATIVO: '2', NOME: 'Ivermectina' }, { CDPRINCIPIOATIVO: '3', NOME: 'Nao usado' }],
    PRODUTOPRINCIPIOATIVO: [],
    UNIDADEMEDIDA: [],
    ...extra,
  },
});
const rodar = (ex) => curar(ex, { classes: mapaClasses, unidades: mapaUnidades });

test('separarApresentacao: separa só o último grupo entre parênteses', () => {
  assert.deepEqual(separarApresentacao('Aba-Allvet LA (Frasco 1000 ml)'), { nome: 'Aba-Allvet LA', apresentacao: 'Frasco 1000 ml' });
  assert.deepEqual(separarApresentacao('Biomox 20% PS(Sachê 100 g)'), { nome: 'Biomox 20% PS', apresentacao: 'Sachê 100 g' });
  assert.deepEqual(separarApresentacao('Caldex (Mgp) (Frasco 100 ml)'), { nome: 'Caldex (Mgp)', apresentacao: 'Frasco 100 ml' });
  assert.deepEqual(separarApresentacao('Mastizone V.S. ( Vaca Seca ) (Seringa 10 g)'), { nome: 'Mastizone V.S. ( Vaca Seca )', apresentacao: 'Seringa 10 g' });
  assert.deepEqual(separarApresentacao('Aciendel Piolhicida (Fr, 2,5 l)'), { nome: 'Aciendel Piolhicida', apresentacao: 'Fr, 2,5 l' });
});

test('separarApresentacao: sem parêntese final ou grupo que não é embalagem fica no nome', () => {
  assert.deepEqual(separarApresentacao('Deccox'), { nome: 'Deccox', apresentacao: null });
  assert.deepEqual(separarApresentacao('Caldex (Mgp)'), { nome: 'Caldex (Mgp)', apresentacao: null });
  assert.deepEqual(separarApresentacao('(Frasco 10 ml)'), { nome: '(Frasco 10 ml)', apresentacao: null });
  assert.deepEqual(separarApresentacao('Vacina (Frasco 10 ml) Bovina'), { nome: 'Vacina (Frasco 10 ml) Bovina', apresentacao: null });
});

test('separarApresentacao: colapsa espaços e não interpreta quantidades', () => {
  assert.deepEqual(separarApresentacao('  Vaxall   Cd  (Frasco   100 ml) '), { nome: 'Vaxall Cd', apresentacao: 'Frasco 100 ml' });
  assert.equal(separarApresentacao('X (Barrica 10 quilogramas)').apresentacao, 'Barrica 10 quilogramas');
});

test('normalizar e limparEspacos', () => {
  assert.equal(limparEspacos('  a \t b\n c  '), 'a b c');
  assert.equal(normalizar('  Soluçâo   ÁGUA  Pó '), 'solucao agua po');
  assert.equal(normalizar(null), '');
});

test('mapearUnidade: mapeia, sinaliza fallback e trata código ausente', () => {
  assert.deepEqual(mapearUnidade('9', mapaUnidades), { unidade: 'L', fallback: false, motivo: null });
  assert.equal(mapearUnidade(7, mapaUnidades).fallback, true);
  assert.deepEqual(mapearUnidade('999', mapaUnidades), { unidade: 'UN', fallback: true, motivo: 'codigo-ausente-no-mapa' });
  assert.equal(mapearUnidade(null, mapaUnidades).unidade, 'UN');
});

test('mapeamentos reais: válidos, completos e dentro do enum do schema.prisma', () => {
  validarMapaClasses(mapaClassesReal);
  validarMapaUnidades(mapaUnidadesReal);
  assert.equal(Object.keys(mapaClassesReal.classes).length, 96);
  assert.equal(Object.keys(mapaUnidadesReal.unidades).length, 25);
  const schema = readFileSync(path.join(aqui, '../../server/prisma/schema.prisma'), 'utf8');
  const enumBody = /enum UnidadeMedida \{([^}]*)\}/.exec(schema)?.[1] ?? '';
  const noSchema = enumBody.split('\n').map((l) => l.trim()).filter((l) => /^[A-Z]+$/.test(l));
  assert.deepEqual([...UNIDADES_VALIDAS].sort(), [...noSchema].sort());
  for (const u of Object.values(mapaUnidadesReal.unidades)) assert.ok(noSchema.includes(u.unidade));
  for (const [c, v] of Object.entries(mapaClassesReal.classes)) {
    if (!v.incluir) assert.deepEqual(v.uso, [], `classe excluída ${c} não deveria ter uso`);
  }
});

test('validarMapaClasses rejeita uso desconhecido', () => {
  assert.throws(() => validarMapaClasses({ classes: { 1: { uso: ['foo'], incluir: true, motivo: 'x' } } }), /uso inválido/);
  assert.throws(() => validarMapaUnidades({ fallback: 'UN', unidades: { 1: { unidade: 'XX' } } }), /inválido/);
});

test('curar: aplica uso da classe, unidade e campos do contrato', () => {
  const ex = extracao([
    prod({ CDPRODUTO: '10', NOME: 'Ivermec  Plus (Frasco 50 ml)', CDUNIDADEMEDIDA: '9' }),
    prod({ CDPRODUTO: '11', NOME: 'Mineral X', CDCLASSIFICACAO: '42', CDFABRICANTE: '1002', CDUNIDADEMEDIDA: '7' }),
  ], {
    PRODUTOPRINCIPIOATIVO: [
      { CDPRODUTOPRINCIPIOATIVO: '5', CDPRODUTO: '10', CDPRINCIPIOATIVO: '2' },
      { CDPRODUTOPRINCIPIOATIVO: '4', CDPRODUTO: '10', CDPRINCIPIOATIVO: '1' },
      { CDPRODUTOPRINCIPIOATIVO: '6', CDPRODUTO: '10', CDPRINCIPIOATIVO: '2' },
    ],
  });
  const { catalogo, stats } = rodar(ex);
  assert.equal(catalogo.fonte, 'IDEAGRI_DADOS000');
  assert.equal(catalogo.geradoEm, '2026-11-09T00:00:00.000Z');
  const [a, b] = catalogo.produtos;
  assert.deepEqual(a, {
    codigoOrigem: '10', nome: 'Ivermec Plus', apresentacao: 'Frasco 50 ml', fabricanteCodigo: '1001', classificacaoCodigo: '36',
    unidadeSugerida: 'L', usoSanitario: true, usoNutricional: false, usoGenetico: false, principiosAtivos: ['1', '2'], ativo: true,
  });
  assert.equal(b.apresentacao, null);
  assert.equal(b.usoNutricional, true);
  assert.equal(b.unidadeSugerida, 'UN');
  assert.deepEqual(b.principiosAtivos, []);
  assert.equal(stats.unidadeFallbackProdutos, 1);
  assert.equal(stats.vinculosPaRepetidos, 1);
});

test('curar: só inclui fabricantes, classificações e PAs referenciados, ordenados', () => {
  const ex = extracao([
    prod({ CDPRODUTO: '20', CDFABRICANTE: '1002' }),
    prod({ CDPRODUTO: '3', CDFABRICANTE: '1001' }),
  ], { PRODUTOPRINCIPIOATIVO: [{ CDPRODUTOPRINCIPIOATIVO: '1', CDPRODUTO: '3', CDPRINCIPIOATIVO: '2' }] });
  const { catalogo } = rodar(ex);
  assert.deepEqual(catalogo.produtos.map((p) => p.codigoOrigem), ['3', '20']);
  assert.deepEqual(catalogo.fabricantes.map((f) => f.codigo), ['1001', '1002']);
  assert.deepEqual(catalogo.classificacoes.map((c) => c.codigo), ['36']);
  assert.deepEqual(catalogo.principiosAtivos.map((x) => x.codigo), ['2']);
});

test('curar: exclui classe fora do escopo, serviço e composto, com motivo', () => {
  const ex = extracao([
    prod({ CDPRODUTO: '1' }),
    prod({ CDPRODUTO: '2', CDCLASSIFICACAO: '75', NOME: 'Herbicida (Embalagem 20 l)' }),
    prod({ CDPRODUTO: '3', TIPO: 'S', CDCLASSIFICACAO: null, CDFABRICANTE: null, NOME: 'Agenda macro' }),
    prod({ CDPRODUTO: '4', COMPOSTO: '1' }),
  ]);
  const { catalogo, excluidos, stats } = rodar(ex);
  assert.deepEqual(catalogo.produtos.map((p) => p.codigoOrigem), ['1']);
  assert.deepEqual(stats.porMotivo, { 'classe-excluida': 1, 'tipo-nao-produto': 1, composto: 1 });
  assert.deepEqual(excluidos.map((e) => [e.codigoOrigem, e.motivo]), [['2', 'classe-excluida'], ['3', 'tipo-nao-produto'], ['4', 'composto']]);
  assert.equal(stats.excluidosPorClasse['75'], 1);
});

test('curar: ATIVO da fonte não afeta inclusão; item sem classificação (TIPO P) é mantido sem uso', () => {
  const ex = extracao([
    prod({ CDPRODUTO: '1', ATIVO: '0' }),
    prod({ CDPRODUTO: '2', ATIVO: '1' }),
    prod({ CDPRODUTO: '3', CDCLASSIFICACAO: null }),
  ]);
  const { catalogo } = rodar(ex);
  assert.equal(catalogo.produtos.length, 3);
  assert.ok(catalogo.produtos.every((p) => p.ativo === true));
  const sem = catalogo.produtos.find((p) => p.codigoOrigem === '3');
  assert.equal(sem.classificacaoCodigo, null);
  assert.deepEqual([sem.usoSanitario, sem.usoNutricional, sem.usoGenetico], [false, false, false]);
});

test('curar: deduplica por nome + apresentação + fabricante normalizados, mantendo o menor código', () => {
  const ex = extracao([
    prod({ CDPRODUTO: '30', NOME: 'Soluçâo Vet (Frasco 10 ml)', CDFABRICANTE: '1001' }),
    prod({ CDPRODUTO: '9', NOME: 'SOLUCAO  VET(frasco 10 ML)', CDFABRICANTE: '1001' }),
    prod({ CDPRODUTO: '31', NOME: 'Soluçâo Vet (Frasco 10 ml)', CDFABRICANTE: '1002' }), // outro fabricante: fica
    prod({ CDPRODUTO: '32', NOME: 'Soluçâo Vet (Frasco 20 ml)', CDFABRICANTE: '1001' }), // outra apresentação: fica
  ]);
  const { catalogo, duplicados, stats } = rodar(ex);
  assert.deepEqual(catalogo.produtos.map((p) => p.codigoOrigem), ['9', '31', '32']);
  assert.deepEqual(duplicados, [{ mantido: '9', descartado: '30', nome: 'Soluçâo Vet (Frasco 10 ml)' }]);
  assert.equal(stats.porMotivo.duplicado, 1);
  assert.equal(stats.mesmoNomeApresentacaoFabricantesDiferentes, 1);
});

test('curar: classe sem mapeamento interrompe com erro explícito', () => {
  const ex = extracao([prod()]);
  ex.records.CLASSIFICACAO.push({ CDCLASSIFICACAO: '999', DESCRICAO: 'Nova', ESTRUTURA: '9.99' });
  assert.throws(() => rodar(ex), /sem mapeamento.*999/);
});

test('curar é determinístico e a serialização é estável', () => {
  const ex = extracao([prod({ CDPRODUTO: '7' }), prod({ CDPRODUTO: '2' })]);
  const a = serializarCatalogo(rodar(ex).catalogo);
  const b = serializarCatalogo(rodar(JSON.parse(JSON.stringify(ex))).catalogo);
  assert.equal(a, b);
  assert.deepEqual(JSON.parse(a).produtos.map((p) => p.codigoOrigem), ['2', '7']);
});

test('amostrar: semente fixa dá a mesma amostra', () => {
  const lista = Array.from({ length: 100 }, (_, i) => i);
  assert.deepEqual(amostrar(lista, 10, mulberry32(42)), amostrar(lista, 10, mulberry32(42)));
  assert.equal(amostrar(lista, 10, mulberry32(42)).length, 10);
  assert.equal(amostrar([1, 2], 10, mulberry32(1)).length, 2);
});

test('gerarRelatorio: gera seções esperadas', () => {
  const ex = extracao([prod({ CDPRODUTO: '1' }), prod({ CDPRODUTO: '2', CDCLASSIFICACAO: '75' })]);
  const r = curar(ex, { classes: mapaClasses, unidades: mapaUnidades });
  const md = gerarRelatorio(r, { mapaClasses, mapaUnidades, extracao: ex });
  for (const s of ['## Contagens', '## Distribuição de uso', '## Classes excluídas', '## Unidades', '## Duplicidades', '## O que significam ATIVO e TIPO', '## Perguntas abertas', '### 30 incluídos', '### 15 excluídos']) {
    assert.ok(md.includes(s), s);
  }
});
