import assert from 'node:assert/strict';

export const camposSitio = new Set(['propriedadeId', 'propriedadeOrigemId', 'propriedadeDestinoId',
  'origemPropriedadeId', 'destinoPropriedadeId', 'sitioId', 'origemId', 'destinoId']);
export const marcadorQA = /QA322R?[- ·]/;
export const nomeTabela = (schema, tabela) => `${schema}.${tabela}`;
export const citar = valor => '"' + valor.replaceAll('"', '""') + '"';
export const sqlTabela = tabela => tabela.split('.').map(citar).join('.');
export const identidade = (tabela, registro) => JSON.stringify(tabela.pk.map(c => registro[c]));

export function remapearJson(valor, mapa, contexto = '') {
  if (Array.isArray(valor)) return valor.map(v => remapearJson(v, mapa, contexto));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) =>
    [k, remapearJson(v, mapa, k === 'id' && ['propriedade', 'sitio'].includes(contexto) ? 'propriedadeId' : k)]));
  if (camposSitio.has(contexto) && Object.hasOwn(mapa, String(valor)))
    return typeof valor === 'string' ? String(mapa[valor]) : mapa[valor];
  return valor;
}

const uuids = valor => {
  const texto = JSON.stringify(valor);
  return texto.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [];
};

/** A direção é sempre pai → dependente; nunca remova um catálogo compartilhado por ser pai de QA. */
export function planejar(tabelas, fks, { sitiosQA, sitiosPreservados, idsManifestos }) {
  const indices = new Map(), nos = new Map();
  for (const tabela of tabelas.values()) {
    for (const row of tabela.rows) {
      const chave = tabela.nome + ':' + identidade(tabela, row);
      nos.set(chave, { chave, tabela, row, filhos: new Set(), pais: new Set() });
    }
  }
  for (const fk of fks) {
    const pai = tabelas.get(fk.pai);
    const chaveIndice = fk.pai + ':' + JSON.stringify(fk.destino);
    let indice = indices.get(chaveIndice);
    if (!indice) {
      indice = new Map(pai.rows.map(row => [JSON.stringify(fk.destino.map(c => row[c])), pai.nome + ':' + identidade(pai, row)]));
      indices.set(chaveIndice, indice);
    }
    for (const row of tabelas.get(fk.filho).rows) {
      const valores = fk.origem.map(c => row[c]);
      if (valores.some(v => v == null)) continue;
      const p = indice.get(JSON.stringify(valores));
      assert.ok(p, `FK órfã antes da consolidação: ${fk.nome}`);
      const filho = fk.filho + ':' + identidade(tabelas.get(fk.filho), row);
      if (p === filho) continue;
      nos.get(p).filhos.add(filho); nos.get(filho).pais.add(p);
    }
  }
  const protegidos = new Set(), remover = new Set();
  const filaProtegidos = [];
  for (const no of nos.values()) {
    const escopos = no.tabela.sitios.map(c => no.row[c]);
    const manifesto = typeof no.row.id === 'string' && idsManifestos.has(no.row.id);
    if (manifesto) protegidos.add(no.chave);
    if (escopos.some(id => sitiosPreservados.includes(id)) || no.tabela.nome === 'pecuaria.Animal' && manifesto) {
      protegidos.add(no.chave); filaProtegidos.push(no.chave);
    }
    if (escopos.some(id => sitiosQA.includes(id)) || no.tabela.nome === 'public.Propriedade' && sitiosQA.includes(no.row.id)
      || no.tabela.textos.some(c => marcadorQA.test(no.row[c] ?? ''))) remover.add(no.chave);
  }
  for (const chave of filaProtegidos) for (const filho of nos.get(chave).filhos)
    if (!protegidos.has(filho)) { protegidos.add(filho); filaProtegidos.push(filho); }
  let mudou = true;
  while (mudou) {
    const tamanho = remover.size;
    for (const chave of remover) for (const filho of nos.get(chave).filhos) remover.add(filho);
    const ids = new Set([...remover].map(k => nos.get(k).row.id).filter(v => typeof v === 'string'));
    for (const no of nos.values()) {
      if (remover.has(no.chave) || no.tabela.nome === 'public._prisma_migrations') continue;
      // Também cobre auditoria, resposta idempotente e identidades polimórficas sem FK.
      const referencias = Object.fromEntries(Object.entries(no.row).filter(([k]) => k !== 'id'));
      if (uuids(referencias).some(id => ids.has(id))) remover.add(no.chave);
    }
    mudou = remover.size !== tamanho;
  }
  const conflitos = [...remover].filter(chave => protegidos.has(chave));
  assert.deepEqual(conflitos, [], `QA alcançou dados preservados: ${conflitos.slice(0, 8).join(', ')}`);
  // Fechamento confirmado protege localização por animal-dias, mesmo sem FK entre ambos.
  for (const k of remover) {
    const loc = nos.get(k);
    if (loc.tabela.nome !== 'pecuaria.LocalizacaoAnimal' || !loc.row.loteId) continue;
    for (const f of remover) {
      const fechamento = nos.get(f);
      if (fechamento.tabela.nome === 'pecuaria.FechamentoConsumo' && fechamento.row.loteId === loc.row.loteId) loc.filhos.add(f);
    }
  }
  const pendentes = new Set(remover), ordem = [], desvincular = [];
  while (pendentes.size) {
    const folhas = [...pendentes].filter(k => [...nos.get(k).filhos].every(f => !pendentes.has(f)));
    if (!folhas.length) {
      // Única quebra admitida: o reenvio da evidência QA aponta à demanda que ela resolveu.
      const exame = [...pendentes].map(k => nos.get(k)).find(n => n.tabela.nome === 'pecuaria.ExameAnimal'
        && n.row.demandaAcompanhamentoId && n.tabela.nullable?.includes('demandaAcompanhamentoId'));
      const demanda = exame && [...pendentes].map(k => nos.get(k)).find(n => n.tabela.nome === 'pecuaria.DemandaAcompanhamentoReprodutivo'
        && n.row.id === exame.row.demandaAcompanhamentoId && n.filhos.has(exame.chave));
      if (!demanda) throw new Error('Ciclo de FK entre fixtures: ' + [...pendentes].slice(0, 16).join(', '));
      demanda.filhos.delete(exame.chave);
      desvincular.push({ no: exame, coluna: 'demandaAcompanhamentoId' });
      continue;
    }
    for (const k of folhas) { ordem.push(nos.get(k)); pendentes.delete(k); }
  }
  return { nos, remover, ordem, protegidos, desvincular };
}
