import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { planejar, remapearJson } from './modelo.mjs';

test('remapeia escopos e snapshots sem alterar versões, valores ou identidades de pessoas', () => {
  const dados = { propriedadeId: 1, versao: 1, quantidade: 2, usuario: { id: 1 }, propriedade: { id: 2, nome: 'Destino' },
    participantes: [{ snapshot: { propriedadeId: '1', animalId: 'a' } }], origemId: 1, destinoId: 2 };
  assert.deepEqual(remapearJson(dados, { 1: 114, 2: 115 }), { ...dados, propriedadeId: 114,
    propriedade: { id: 115, nome: 'Destino' }, participantes: [{ snapshot: { propriedadeId: '114', animalId: 'a' } }], origemId: 114, destinoId: 115 });
  assert.equal(dados.propriedadeId, 1);
});

const tabela = (nome, rows, sitios = []) => ({ nome, pk: ['id'], textos: ['nome'], sitios, rows });
const opcoes = { sitiosQA: [36], sitiosPreservados: [1, 114], idsManifestos: new Set(['animal-v3']) };
test('remove descendentes QA e conserva o catálogo compartilhado e os animais V3/V4', () => {
  const tabelas = new Map([
    ['public.Catalogo', tabela('public.Catalogo', [{ id: 'catalogo', nome: 'Compartilhado' }])],
    ['pecuaria.Animal', tabela('pecuaria.Animal', [{ id: 'animal-v3', nome: 'V3', catalogoId: 'catalogo', propriedadeId: 1 },
      { id: 'animal-qa', nome: 'QA322-01', catalogoId: 'catalogo', propriedadeId: 36 }], ['propriedadeId'])],
    ['pecuaria.Exame', tabela('pecuaria.Exame', [{ id: 'exame-qa', nome: 'Sem prefixo', animalId: 'animal-qa' }])],
  ]);
  const fks = [ { nome: 'catalogo', pai: 'public.Catalogo', filho: 'pecuaria.Animal', origem: ['catalogoId'], destino: ['id'] },
    { nome: 'animal', pai: 'pecuaria.Animal', filho: 'pecuaria.Exame', origem: ['animalId'], destino: ['id'] } ];
  assert.deepEqual(planejar(tabelas, fks, opcoes).ordem.map(n => n.row.id), ['exame-qa', 'animal-qa']);
});
test('recusa remover um fato V3/V4 que referencie objeto QA', () => {
  const tabelas = new Map([['public.Objeto', tabela('public.Objeto', [{ id: 'qa', nome: 'QA322 objeto' }])],
    ['pecuaria.Animal', tabela('pecuaria.Animal', [{ id: 'animal-v3', nome: 'V3', objetoId: 'qa', propriedadeId: 1 }], ['propriedadeId'])]]);
  assert.throws(() => planejar(tabelas, [{ nome: 'objeto', pai: 'public.Objeto', filho: 'pecuaria.Animal', origem: ['objetoId'], destino: ['id'] }], opcoes), /dados preservados/);
});

test('desvincula somente o ciclo nullable exame/demanda de QA antes da remoção', () => {
  const exame = tabela('pecuaria.ExameAnimal', [{ id: 'exame', nome: 'QA322 exame', demandaAcompanhamentoId: 'demanda' }]);
  exame.nullable = ['demandaAcompanhamentoId'];
  const demanda = tabela('pecuaria.DemandaAcompanhamentoReprodutivo', [{ id: 'demanda', nome: 'QA322 demanda', exameResolucaoId: 'exame' }]);
  const tabelas = new Map([[exame.nome, exame], [demanda.nome, demanda]]);
  const fks = [{ nome: 'demanda', pai: demanda.nome, filho: exame.nome, origem: ['demandaAcompanhamentoId'], destino: ['id'] },
    { nome: 'exame', pai: exame.nome, filho: demanda.nome, origem: ['exameResolucaoId'], destino: ['id'] }];
  const plano = planejar(tabelas, fks, opcoes);
  assert.deepEqual(plano.ordem.map(n => n.row.id), ['demanda', 'exame']);
  assert.deepEqual(plano.desvincular.map(n => n.coluna), ['demandaAcompanhamentoId']);
  exame.nullable = [];
  assert.throws(() => planejar(tabelas, fks, opcoes), /Ciclo de FK/);
});

test('remove o fechamento QA antes da localização que ele protegia por animal-dias', () => {
  const loc = tabela('pecuaria.LocalizacaoAnimal', [{ id: 'loc', nome: 'QA322 local', loteId: 'lote' }]);
  const f = tabela('pecuaria.FechamentoConsumo', [{ id: 'fechamento', nome: 'QA322 consumo', loteId: 'lote' }]);
  assert.deepEqual(planejar(new Map([[loc.nome, loc], [f.nome, f]]), [], opcoes).ordem.map(n => n.row.id), ['fechamento', 'loc']);
});

test('remove respostas e referências polimórficas QA sem alcançar o catálogo compartilhado', () => {
  const qa = '00000000-0000-4000-a000-000000000036';
  const t = tabela('public.Objeto', [{ id: qa, nome: 'QA322 objeto' }, { id: 'catalogo', nome: 'Referência compartilhada' }]);
  const a = tabela('public.Auditoria', [{ id: 'historico-qa', nome: 'Registro sem prefixo', depois: { resultado: { fonteId: qa, catalogoId: 'catalogo' } } }]);
  const plano = planejar(new Map([[t.nome, t], [a.nome, a]]), [], opcoes);
  assert.deepEqual(new Set(plano.ordem.map(n => n.row.id)), new Set([qa, 'historico-qa']));
});

test('a preparação histórica no navegador recusa a massa consolidada antes de qualquer escrita', async () => {
  const source = await readFile(new URL('../../../scripts/qa-pr322/preparar.mcp.js', import.meta.url), 'utf8');
  const chamadas = [];
  const contexto = { location: { hostname: 'localhost' }, sessionStorage: { getItem: () => null, setItem: () => assert.fail('Não gravar preparação') },
    localStorage: { getItem: () => 'token-ficticio-de-teste' }, fetch: async (path, init) => {
      chamadas.push({ path, method: init.method });
      return { ok: true, status: 200, json: async () => [{ id: 114, nome: 'V4 · Fazenda Escola' }, { id: 115, nome: 'V4 · Fazenda Destino' }] };
    } };
  const preparar = new vm.Script('(' + source + ')').runInNewContext(contexto);
  await assert.rejects(preparar({ evaluate: fn => fn() }), /Fixtures QA históricas retiradas/);
  assert.deepEqual(chamadas, [{ path: '/api/propriedades?incluirInativos=true', method: 'GET' }]);
});
