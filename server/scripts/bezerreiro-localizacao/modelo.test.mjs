import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepararManifesto, sha256 } from './modelo.mjs';
import { consultaSnapshot } from './consulta.mjs';

const agora = '2026-11-02T15:00:00.000Z';
const fonte = { projetoId: 'projeto-sintetico', branchId: 'branch-stg-sintetico', banco: 'banco-sintetico', ambiente: 'stg' };
function fixture() {
  const anterior = { id: 'animal-a', brinco: 'A', ideagriId: 1, propriedadeId: 2, desde: '2026-10-20T00:00:00.000Z', entradaGrupoFDB: '2026-10-01', cores: ['VERDE'], desmamaFDB: '2026-10-15' };
  return {
    configuracao: { versao: 1, fonte, lotes: [{ id: 'lote-a', propriedadeId: 2, sitio: 'Sítio sintético' }] },
    analise: [anterior], animaisAnteriores: [{ ...anterior }], evidencias: {}, agora,
    snapshot: { versaoFormato: 1, fonte, capturadoEm: '2026-11-02T14:00:00Z', dataReferencia: '2026-11-02', snapshotTransacao: '1:2:',
      lotes: [{ id: 'lote-a', propriedadeId: 2, ativo: true, nome: 'Nome sem gatilho' }],
      animais: [{ id: 'animal-a', brinco: 'A', dataNascimento: '2026-09-01', dataEntrada: '2026-09-01' }],
      localizacoes: [{ id: 'local-a', animalId: 'animal-a', loteId: 'lote-a', propriedadeId: 2, desde: '2026-10-20', ate: null }],
      perfis: [], participacoes: [], fases: [], ofertas: [], baixas: [] },
  };
}
const perfil = { id: 'perfil-a', loteId: 'lote-a', propriedadeId: 2, ativo: true, versao: 3 };
const participacao = { id: 'participacao-a', animalId: 'animal-a', perfilId: 'perfil-a', desde: '2026-10-20', ate: null, versao: 4 };

test('propõe intervalo atual provado; preserva cor/desmama documentais sem criar fase ou fatos', () => {
  const entrada = fixture();
  const antes = structuredClone(entrada);
  const m = prepararManifesto(entrada);
  assert.equal(m.resumo.comprovados, 1);
  assert.equal(m.resumo.antecedentesIDEAGRIPendentes, 1);
  assert.deepEqual(m.propostas[0].intervaloProposto, { desde: '2026-10-20', ate: null, localizacaoId: 'local-a' });
  assert.equal(m.propostas[0].alimentacao.faseVersaoId, null);
  assert.equal(m.propostas[0].alimentacao.coleiraId, null);
  assert.equal(m.executavelAutomaticamente, false);
  assert.equal(m.comandos[0].corpo.regularizacao.localizacoes[0].desde, '2026-10-20');
  assert.deepEqual(entrada, antes);
});

test('coincidência IDEAGRI é separada da prova de permanência atual', () => {
  const f = fixture(); f.analise[0].entradaGrupoFDB = '2026-10-20';
  const m = prepararManifesto(f);
  assert.equal(m.resumo.datasCoincidentes, 1);
  assert.equal(m.propostas[0].historico.pendencia, null);
});

test('sem snapshot bloqueia toda proposta e todo comando', () => {
  const f = fixture(); delete f.snapshot;
  const m = prepararManifesto(f);
  assert.equal(m.resumo.pendentes, 1);
  assert.equal(m.comandos[0].corpo, null);
  assert.ok(m.bloqueios.includes('SNAPSHOT_ATUAL_AUSENTE'));
  assert.equal(m.propostas[0].intervaloProposto, null);
});

test('snapshot antigo/futuro ou de outro ambiente não habilita carga', () => {
  for (const capturadoEm of ['2026-10-31T14:00:00Z', '2026-11-03T14:00:00Z']) {
    const f = fixture(); f.snapshot.capturadoEm = capturadoEm;
    assert.equal(prepararManifesto(f).comandos[0].corpo, null);
  }
  const f = fixture(); f.snapshot.fonte = { ...fonte, ambiente: 'prod' };
  assert.throws(() => prepararManifesto(f), /outro ambiente/);
});

test('snapshot incompleto, IDs repetidos e evidências cruzadas inconsistentes são recusados', () => {
  const f = fixture(); delete f.snapshot.participacoes;
  assert.throws(() => prepararManifesto(f), /incompleto/);
  const g = fixture(); g.snapshot.animais.push(g.snapshot.animais[0]);
  assert.throws(() => prepararManifesto(g), /IDs duplicados/);
  const h = fixture(); h.animaisAnteriores[0].propriedadeId = 999;
  assert.throws(() => prepararManifesto(h), /Evidências divergentes/);
});

test('perfil existente e participação conciliada são preservados com ID/versão/fase originais', () => {
  const f = fixture(); f.snapshot.perfis = [perfil]; f.snapshot.participacoes = [participacao];
  f.snapshot.fases = [{ id: 'fase-a', participacaoId: participacao.id, desde: '2026-10-22', ate: null, faseVersaoId: 'fase-versao-a' }];
  const m = prepararManifesto(f);
  assert.equal(m.resumo.jaConciliados, 1);
  assert.equal(m.lotes[0].acaoPerfil, 'REUTILIZAR');
  assert.equal(m.propostas[0].intervaloProposto, null);
  assert.equal(m.propostas[0].evidencia.participacoesExistentes[0].versao, 4);
  assert.equal(m.propostas[0].evidencia.fasesExistentes[0].faseVersaoId, 'fase-versao-a');
});

test('participação histórica encerrada não é reaberta nem impede nova permanência comprovada', () => {
  const f = fixture(); f.snapshot.perfis = [perfil];
  f.snapshot.participacoes = [{ ...participacao, desde: '2026-10-01', ate: '2026-10-10' }];
  assert.equal(prepararManifesto(f).resumo.comprovados, 1);
});

test('participação parcialmente sobreposta ou em outro perfil bloqueia lote coletivo inteiro', () => {
  for (const p of [{ ...participacao, desde: '2026-10-21' }, { ...participacao, perfilId: 'outro-perfil' }]) {
    const f = fixture(); f.snapshot.perfis = [perfil]; f.snapshot.participacoes = [p];
    const m = prepararManifesto(f);
    assert.equal(m.comandos[0].corpo, null);
    assert.ok(m.propostas[0].conflitos.includes('PARTICIPACAO_EXISTENTE_EXIGE_CONCILIACAO'));
  }
});

test('perfil inativo/duplicado ou lote/sítio divergente impede comando', () => {
  for (const perfis of [[{ ...perfil, ativo: false }], [perfil, { ...perfil, id: 'perfil-b' }], [{ ...perfil, propriedadeId: 999 }]]) {
    const f = fixture(); f.snapshot.perfis = perfis;
    assert.equal(prepararManifesto(f).comandos[0].corpo, null);
  }
  const f = fixture(); f.snapshot.localizacoes[0].propriedadeId = 999;
  assert.equal(prepararManifesto(f).comandos[0].corpo, null);
});

test('movido para fora da coorte original fica pendente e não recebe participação fictícia', () => {
  const f = fixture(); f.snapshot.localizacoes[0].loteId = 'outro-lote';
  const m = prepararManifesto(f);
  assert.equal(m.propostas[0].situacao, 'PENDENTE');
  assert.equal(m.propostas[0].intervaloProposto, null);
});

test('novos ocupantes entram na conferência exata do lote mesmo fora da análise anterior', () => {
  const f = fixture();
  f.snapshot.animais.push({ ...f.snapshot.animais[0], id: 'animal-novo', brinco: 'Novo' });
  f.snapshot.localizacoes.push({ ...f.snapshot.localizacoes[0], id: 'local-novo', animalId: 'animal-novo' });
  const m = prepararManifesto(f);
  assert.equal(m.resumo.animais, 2);
  assert.equal(m.comandos[0].corpo.regularizacao.localizacoes.length, 2);
  assert.equal(m.propostas.find(p => p.animalId === 'animal-novo').evidencia.analiseAnterior, null);
});

test('não usa nome de lote nem categoria como gatilho', () => {
  const f = fixture(); f.snapshot.animais[0].categoria = 'VACA';
  f.snapshot.lotes[0].nome = 'Outro nome';
  assert.equal(prepararManifesto(f).resumo.comprovados, 1);
  f.snapshot.localizacoes[0].loteId = 'outro-lote-chamado-bezerreiro';
  assert.equal(prepararManifesto(f).resumo.comprovados, 0);
});

test('baixa ativa, localização duplicada/futura e cronologia inválida bloqueiam', () => {
  const mutacoes = [
    f => f.snapshot.baixas.push({ id: 'baixa', animalId: 'animal-a', data: '2026-10-25', estornadaEm: null }),
    f => f.snapshot.localizacoes.push({ ...f.snapshot.localizacoes[0], id: 'outra-local' }),
    f => { f.snapshot.localizacoes[0].desde = '2026-11-03'; },
    f => { f.snapshot.localizacoes[0].desde = '2026-08-01'; },
  ];
  for (const alterar of mutacoes) { const f = fixture(); alterar(f); assert.equal(prepararManifesto(f).comandos[0].corpo, null); }
});

test('fatos dependentes sem participação conciliada exigem conferência e são conservados', () => {
  const f = fixture(); f.snapshot.ofertas = [{ id: 'oferta', status: 'CONFIRMADO', participantesSnapshot: [{ animalId: 'animal-a' }] }];
  const m = prepararManifesto(f);
  assert.ok(m.propostas[0].conflitos.includes('FATOS_DEPENDENTES_EXIGEM_CONFERENCIA'));
  assert.equal(m.propostas[0].evidencia.ofertasExistentes[0].id, 'oferta');
});

test('intervalos vazios de localização não viram permanência; participação vazia bloqueia', () => {
  const f = fixture();
  f.snapshot.localizacoes.push({ ...f.snapshot.localizacoes[0], id: 'zero', desde: '2026-10-20', ate: '2026-10-20' });
  assert.equal(prepararManifesto(f).resumo.comprovados, 1);
  f.snapshot.participacoes.push({ ...participacao, ate: participacao.desde });
  assert.equal(prepararManifesto(f).comandos[0].corpo, null);
});

test('ausência de fim não é interpretada como intervalo aberto e horário não é convertido', () => {
  const f = fixture(); delete f.snapshot.localizacoes[0].ate;
  assert.throws(() => prepararManifesto(f), /fim ausente/);
  const g = fixture(); g.snapshot.localizacoes[0].desde = '2026-10-20T15:12:00Z';
  assert.throws(() => prepararManifesto(g), /horário/);
});

test('mesma entrada conserva chave de reenvio e hashes canônicos', () => {
  const f = fixture();
  assert.deepEqual(prepararManifesto(f), prepararManifesto(structuredClone(f)));
  assert.equal(sha256({ a: 1, b: 2 }), sha256({ b: 2, a: 1 }));
  const antes = prepararManifesto(f).comandos[0].corpo.chave;
  assert.match(antes, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  f.snapshot.localizacoes[0].desde = '2026-10-21';
  assert.notEqual(prepararManifesto(f).comandos[0].corpo.chave, antes);
});

test('consulta usa IDs explícitos, preserva localizações completas e só contém SELECTs', () => {
  const f = fixture(); const sql = consultaSnapshot(f.configuracao, ["animal'citado"]);
  assert.match(sql, /'animal''citado'/);
  assert.match(sql, /JOIN coorte c ON c.id=l\."animalId"/);
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|ALTER|CALL)\b/i);
  assert.doesNotMatch(sql, /WHERE.*nome=/);
});

test('CLI recusa opção de escrita, não carrega credenciais e não sobrescreve manifesto', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bezerreiro-previa-'));
  try {
    const f = fixture();
    for (const [nome, dados] of [['lotes.json', f.configuracao], ['animais-stg.json', f.animaisAnteriores], ['analise-animais.json', f.analise], ['snapshot.json', f.snapshot]])
      await writeFile(join(dir, nome), JSON.stringify(dados));
    await writeFile(join(dir, 'RELATORIO.md'), 'Evidência sintética de teste.');
    const script = new URL('./previa.mjs', import.meta.url);
    const args = [script.pathname, `--lotes=${join(dir, 'lotes.json')}`, `--evidencias-dir=${dir}`, `--saida=${join(dir, 'manifesto.json')}`];
    const primeiro = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(primeiro.status, 0, primeiro.stderr);
    const arquivo = await readFile(join(dir, 'manifesto.json'), 'utf8');
    assert.equal(JSON.parse(arquivo).comandos[0].corpo, null);
    assert.notEqual(spawnSync(process.execPath, args).status, 0);
    assert.equal(await readFile(join(dir, 'manifesto.json'), 'utf8'), arquivo);
    assert.notEqual(spawnSync(process.execPath, [script.pathname, '--executar']).status, 0);
    const codigo = await readFile(new URL('./previa.mjs', import.meta.url), 'utf8');
    assert.doesNotMatch(codigo, /DATABASE_URL|DIRECT_URL|dotenv|fetch\(|PrismaClient|import.*pg/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
