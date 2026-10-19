import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import pg from 'pg';
import { citar, sqlTabela, camposSitio, marcadorQA, remapearJson, planejar } from './consolidacao-sitios-local/modelo.mjs';

const args = process.argv.slice(2);
assert.ok(args.every(a => ['--aplicar', '--verificar', '--ensaiar'].includes(a)) && args.length <= 1, 'Use prévia sem argumentos, --ensaiar, --aplicar ou --verificar');
const aplicar = args.includes('--aplicar'), verificar = args.includes('--verificar'), ensaiar = args.includes('--ensaiar');
const alterar = aplicar || ensaiar;
const url = new URL(process.env.DATABASE_URL ?? '');
assert.ok(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  && ['postgres:', 'postgresql:'].includes(url.protocol) && url.pathname === '/fazendinha_seedatev3' && !url.search,
'Somente fazendinha_seedatev3 local, sem parâmetros alternativos');
const pasta = new URL('../.seedatev3/', import.meta.url);
const arquivos = [new URL('manifesto.json', pasta), new URL('v4/manifesto.json', pasta)];
const manifestos = await Promise.all(arquivos.map(async arquivo => JSON.parse(await readFile(arquivo, 'utf8'))));
assert.equal(manifestos[0].identidade, manifestos[1].identidade, 'Manifestos de instâncias diferentes');
const escola = Number(manifestos[1].ids['seedatev4-v1:sitio:Escola']);
const destino = Number(manifestos[1].ids['seedatev4-v1:sitio:Destino']);
assert.ok([escola, destino].every(n => Number.isSafeInteger(n) && n > 2) && escola !== destino);
const mapa = { 1: escola, 2: destino }, sitiosQA = [36, 37, 38, 39];
const entidade = 'consolidacao-sitios-v3-v4-v1';
const db = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
const hash = valor => createHash('sha256').update(valor).digest('hex');
const arquivosQA = ['fixtures.json', 'resultados.json'].map(nome => new URL('../../output/qa-pr322/' + nome, import.meta.url));
// Valida metadados existentes antes da primeira escrita no banco.
for (const arquivo of arquivosQA) {
  try { JSON.parse(await readFile(arquivo, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}
async function gravarJsonAtomico(arquivo, valor) {
  const temporario = new URL(arquivo.href + '.consolidacao.tmp');
  await writeFile(temporario, JSON.stringify(valor, null, 2) + '\n', { mode: 0o600 });
  await rename(temporario, arquivo);
}

async function catalogo() {
  const { rows: colunas } = await db.query(`SELECT c.table_schema s,c.table_name t,c.column_name c,c.data_type tipo,c.is_nullable
    FROM information_schema.columns c JOIN information_schema.tables t USING(table_schema,table_name)
    WHERE c.table_schema IN ('public','pecuaria') AND t.table_type='BASE TABLE' ORDER BY c.table_schema,c.table_name,c.ordinal_position`);
  const { rows: pks } = await db.query(`SELECT n.nspname||'.'||t.relname nome,
    array_agg(a.attname::text ORDER BY k.ord) pk FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(num,ord)
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.num WHERE c.contype='p' AND n.nspname IN ('public','pecuaria') GROUP BY n.nspname,t.relname`);
  const tabelas = new Map(pks.map(t => [t.nome, { ...t, rows: [], colunas: [], sitios: [], textos: [], json: [], nullable: [] }]));
  for (const c of colunas) {
    const t = tabelas.get(c.s + '.' + c.t); assert.ok(t, 'Tabela sem PK: ' + c.t);
    t.colunas.push(c.c);
    if (c.is_nullable === 'YES') t.nullable.push(c.c);
    if (camposSitio.has(c.c) && ['integer', 'bigint'].includes(c.tipo)) t.sitios.push(c.c);
    if (['text', 'character varying'].includes(c.tipo) && !['senhaHash', 'tokenHash'].includes(c.c)) t.textos.push(c.c);
    if (['json', 'jsonb'].includes(c.tipo)) t.json.push(c.c);
  }
  const { rows: fks } = await db.query(`SELECT c.conname nome,ns.nspname||'.'||t.relname filho,np.nspname||'.'||p.relname pai,
    array_agg(a.attname::text ORDER BY k.ord) origem,array_agg(b.attname::text ORDER BY k.ord) destino
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=t.relnamespace
    JOIN pg_class p ON p.oid=c.confrelid JOIN pg_namespace np ON np.oid=p.relnamespace
    CROSS JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY k(num,pnum,ord)
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.num JOIN pg_attribute b ON b.attrelid=p.oid AND b.attnum=k.pnum
    WHERE c.contype='f' AND ns.nspname IN ('public','pecuaria') GROUP BY c.oid,c.conname,ns.nspname,t.relname,np.nspname,p.relname`);
  return { tabelas, fks };
}

async function normalizador() {
  // Só altera IDs de sítio explicitamente identificados; cálculo no PostgreSQL conserva a precisão JSON.
  await db.query(`CREATE FUNCTION pg_temp.remapear_sitio(v jsonb,mapa jsonb,contexto text DEFAULT '') RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE AS $func$
    DECLARE k text; x jsonb; r jsonb; texto text;
    BEGIN
      IF jsonb_typeof(v)='object' THEN
        r:='{}'::jsonb;
        FOR k,x IN SELECT * FROM jsonb_each(v) LOOP
          r:=r||jsonb_build_object(k,pg_temp.remapear_sitio(x,mapa,CASE WHEN k='id' AND contexto IN ('propriedade','sitio') THEN 'propriedadeId' ELSE k END));
        END LOOP; RETURN r;
      ELSIF jsonb_typeof(v)='array' THEN
        SELECT coalesce(jsonb_agg(pg_temp.remapear_sitio(e,mapa,contexto) ORDER BY ord),'[]'::jsonb) INTO r FROM jsonb_array_elements(v) WITH ORDINALITY a(e,ord); RETURN r;
      ELSIF contexto=ANY(ARRAY[${[...camposSitio].map(k => "'" + k + "'").join(',')}]) AND jsonb_typeof(v) IN ('number','string') THEN
        texto:=v#>>'{}'; IF mapa ? texto THEN RETURN CASE WHEN jsonb_typeof(v)='string' THEN to_jsonb(mapa->>texto) ELSE mapa->texto END; END IF;
      END IF; RETURN v;
    END $func$`);
}

async function estados(tabelas, plano, esperado, completo = false) {
  const estados = new Map();
  for (const t of tabelas.values()) {
    const { rows } = await db.query(`SELECT jsonb_build_array(${t.pk.map(citar).join(',')})::text chave,
      md5(${esperado ? 'pg_temp.remapear_sitio(to_jsonb(t),$1)' : 'to_jsonb(t)'}::text) hash FROM ${sqlTabela(t.nome)} t`, esperado ? [JSON.stringify(mapa)] : []);
    for (const r of rows) {
      const chave = t.nome + ':' + JSON.stringify(JSON.parse(r.chave));
      if (!completo && (plano.remover.has(chave) || t.nome === 'public.Propriedade' && [1, 2].includes(JSON.parse(r.chave)[0]))) continue;
      estados.set(chave, r.hash);
    }
  }
  return estados;
}

async function atualizarManifestos(relatorio) {
  for (let i = 0; i < arquivos.length; i++) {
    // Relê a versão corrente; preserva data-base, IDs e ações diferentes dos dois aliases administrativos.
    const atual = JSON.parse(await readFile(arquivos[i], 'utf8'));
    assert.equal(atual.identidade, manifestos[0].identidade);
    for (const [k, v] of Object.entries(atual.ids))
      if ((k === 'sitio:Principal' || k === 'sitio:Destino') && Object.hasOwn(mapa, v)) atual.ids[k] = String(mapa[v]);
    await gravarJsonAtomico(arquivos[i], atual);
  }
  // Somente metadados de conclusão, sem cópia de registros; permite reconhecer a manutenção autorizada.
  await gravarJsonAtomico(new URL('consolidacao-sitios.json', pasta), relatorio);
  for (const arquivo of arquivosQA) {
    let anterior;
    try { anterior = JSON.parse(await readFile(arquivo, 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    if (arquivo.pathname.endsWith('/fixtures.json')) anterior.retiradasEm = relatorio.concluidaEm;
    else { anterior.fixtures ??= {}; anterior.fixtures.retiradasEm = relatorio.concluidaEm; }
    await gravarJsonAtomico(arquivo, anterior);
  }
}

await db.connect();
try {
  const { rows: [servidor] } = await db.query('SELECT current_database() banco,host(inet_server_addr()) endereco');
  assert.equal(servidor.banco, 'fazendinha_seedatev3'); assert.ok(['127.0.0.1', '::1'].includes(servidor.endereco));
  await db.query('BEGIN'); await db.query("SET LOCAL lock_timeout='5s'"); await db.query("SET LOCAL statement_timeout='90s'");
  // A trava de sessão cobre também a atualização dos manifestos depois do COMMIT.
  assert.equal((await db.query("SELECT pg_try_advisory_lock(hashtext('seedatev3')) livre")).rows[0].livre, true, 'Seed em execução');
  const { tabelas, fks } = await catalogo();
  if (alterar) await db.query('LOCK TABLE ' + [...tabelas.keys()].map(sqlTabela).join(',') + ' IN SHARE ROW EXCLUSIVE MODE');
  const sitios = (await db.query('SELECT id,nome,principal,ativo FROM public."Propriedade" ORDER BY id')).rows;
  const concluida = (await db.query('SELECT depois FROM pecuaria."AuditoriaPecuaria" WHERE entidade=$1 AND "entidadeId"=$2', ['ConsolidacaoSitiosLocal', entidade])).rows[0]?.depois;
  assert.ok(sitios.some(s => s.id === escola && s.nome === 'V4 · Fazenda Escola') && sitios.some(s => s.id === destino && s.nome === 'V4 · Fazenda Destino'));
  assert.deepEqual(sitios.map(s => s.id).sort((a, b) => a - b), (concluida ? [escola, destino] : [1, 2, ...sitiosQA, escola, destino]).sort((a, b) => a - b), 'Sítios inesperados; não inferir remoções');
  assert.ok(sitios.filter(s => sitiosQA.includes(s.id)).every(s => marcadorQA.test(s.nome)), 'Sítio QA foi renomeado; revisar autoria');
  for (const t of tabelas.values()) t.rows = (await db.query('SELECT to_jsonb(t) row FROM ' + sqlTabela(t.nome) + ' t')).rows.map(r => r.row);
  const plano = planejar(tabelas, fks, { sitiosQA, sitiosPreservados: [1, 2, escola, destino], idsManifestos: new Set(manifestos.flatMap(m => Object.values(m.ids))) });
  const porTabela = {}; for (const no of plano.ordem) porTabela[no.tabela.nome] = (porTabela[no.tabela.nome] ?? 0) + 1;
  if (concluida) {
    assert.equal(plano.remover.size, 0, 'Novas fixtures QA encontradas após a consolidação');
    assert.ok(sitios.every(s => s.ativo) && sitios.find(s => s.id === escola).principal);
    for (const no of plano.nos.values()) assert.deepEqual(remapearJson(no.row, mapa), no.row, 'Escopo antigo restante: ' + no.chave);
    if (!aplicar) for (const m of manifestos) {
      assert.equal(Number(m.ids['sitio:Principal']), escola, 'Conclua os manifestos com --aplicar');
      assert.equal(Number(m.ids['sitio:Destino']), destino, 'Conclua os manifestos com --aplicar');
    }
    await db.query('COMMIT'); if (aplicar) await atualizarManifestos(concluida);
    console.log(JSON.stringify({ estado: 'consolidado', sitios, relatorio: concluida }));
  } else if (!alterar) {
    await db.query('ROLLBACK'); assert.ok(!verificar, 'Consolidação ainda não aplicada');
    console.log(JSON.stringify({ estado: 'previa', mapa, removerQA: porTabela, totalQA: plano.remover.size, desvinculosQA: plano.desvincular.length, registrosPreservados: plano.nos.size - plano.remover.size - 2 }));
  } else {
    const original = ensaiar ? await estados(tabelas, plano, false, true) : null;
    await normalizador();
    const antes = await estados(tabelas, plano, true);
    const guardas = (await db.query(`SELECT ns.nspname||'.'||c.relname tabela,t.tgname nome,t.tgenabled modo,p.proname funcao
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE NOT t.tgisinternal AND ns.nspname IN ('public','pecuaria') ORDER BY tabela,nome`)).rows;
    const excecoes = new Set(['impedir_edicao_valorizacao_estoque', 'proteger_identidade_valorizada', 'proteger_politica_e_ciclo',
      'proteger_decisao_elegibilidade', 'proteger_snapshot_relatorio_reprodutivo', 'proteger_versao_selecao_visita', 'proteger_vinculo_pesagem_parto']);
    const tabelasAlteradas = new Set([...plano.nos.values()].filter(n => plano.remover.has(n.chave)
      || JSON.stringify(remapearJson(n.row, mapa)) !== JSON.stringify(n.row)).map(n => n.tabela.nome));
    const suspensas = guardas.filter(g => excecoes.has(g.funcao) && tabelasAlteradas.has(g.tabela));
    assert.ok(suspensas.every(g => g.modo === 'O'), 'Guarda já tinha configuração excepcional');
    for (const g of suspensas) await db.query(`ALTER TABLE ${sqlTabela(g.tabela)} DISABLE TRIGGER ${citar(g.nome)}`);
    for (const { no, coluna } of plano.desvincular) {
      const r = await db.query('UPDATE ' + sqlTabela(no.tabela.nome) + ' SET ' + citar(coluna) + '=NULL WHERE ' + no.tabela.pk.map((c, i) => citar(c) + '=$' + (i + 1)).join(' AND '), no.tabela.pk.map(c => no.row[c]));
      assert.equal(r.rowCount, 1);
    }
    for (const no of plano.ordem) await db.query('DELETE FROM ' + sqlTabela(no.tabela.nome) + ' WHERE ' + no.tabela.pk.map((c, i) => citar(c) + '=$' + (i + 1)).join(' AND '), no.tabela.pk.map(c => no.row[c]));
    // O trigger imediato da participação exige que a programação já tenha o sítio de destino.
    const ordemAtualizacao = [...tabelas.values()].sort((a, b) => Number(b.nome === 'pecuaria.ProgramacaoProtocolo') - Number(a.nome === 'pecuaria.ProgramacaoProtocolo'));
    for (const t of ordemAtualizacao) {
      if (t.nome === 'public.Propriedade') continue;
      for (const coluna of t.sitios) await db.query(`UPDATE ${sqlTabela(t.nome)} SET ${citar(coluna)}=CASE ${citar(coluna)} WHEN 1 THEN $1::integer WHEN 2 THEN $2::integer END WHERE ${citar(coluna)} IN (1,2)`, [escola, destino]);
      for (const coluna of t.json) await db.query(`UPDATE ${sqlTabela(t.nome)} SET ${citar(coluna)}=pg_temp.remapear_sitio(${citar(coluna)}::jsonb,$1)
        WHERE ${citar(coluna)}::jsonb IS DISTINCT FROM pg_temp.remapear_sitio(${citar(coluna)}::jsonb,$1)`, [JSON.stringify(mapa)]);
    }
    await db.query('DELETE FROM public."Propriedade" WHERE id IN (1,2)');
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    for (const g of suspensas) await db.query(`ALTER TABLE ${sqlTabela(g.tabela)} ENABLE TRIGGER ${citar(g.nome)}`);
    const depois = await estados(tabelas, plano, false);
    assert.equal(depois.size, antes.size, 'Contagem preservada');
    for (const [id, h] of antes) assert.equal(depois.get(id), h, 'Alteração além do escopo de sítio: ' + id);
    const guardasDepois = (await db.query(`SELECT ns.nspname||'.'||c.relname tabela,t.tgname nome,t.tgenabled modo,p.proname funcao
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE NOT t.tgisinternal AND ns.nspname IN ('public','pecuaria') ORDER BY tabela,nome`)).rows;
    assert.deepEqual(guardasDepois, guardas, 'Guardas não restauradas');
    assert.equal((await db.query('SELECT count(*)::int n FROM public."Propriedade"')).rows[0].n, 2);
    const relatorio = { versao: 1, concluidaEm: new Date().toISOString(), mapa, sitios: [escola, destino], fixturesRemovidas: porTabela,
      registrosPreservados: antes.size, prova: hash(JSON.stringify([...antes].sort())), guardasRestauradas: true, chavesEstrangeirasAtivas: true,
      reenvio: 'Chaves e hashes históricos reservados; pedido com novo escopo deve usar nova chave. Não há replay transparente do sítio removido.' };
    await db.query(`INSERT INTO pecuaria."AuditoriaPecuaria" (id,entidade,"entidadeId",acao,depois,"usuarioId","criadoPorId","propriedadeId","atualizadoEm")
      VALUES($1,'ConsolidacaoSitiosLocal',$2,'CONSOLIDACAO_LOCAL',$3,1,1,$4,now())`, [randomUUID(), entidade, JSON.stringify(relatorio), escola]);
    if (ensaiar) {
      await db.query('ROLLBACK');
      assert.deepEqual(await estados(tabelas, plano, false, true), original, 'Rollback não restaurou os registros');
      console.log(JSON.stringify({ estado: 'ensaio_com_rollback', ...relatorio, rollbackConferido: true }));
    } else {
      await db.query('COMMIT');
      // Se o processo terminar após COMMIT, --aplicar reconhece a auditoria e conclui somente os arquivos.
      await atualizarManifestos(relatorio);
      console.log(JSON.stringify({ estado: 'aplicado', ...relatorio }));
    }
  }
} catch (e) { await db.query('ROLLBACK').catch(() => {}); console.error(e); process.exitCode = 1; }
finally { await db.end(); }
