// Manutenção explícita. O executor normal da seed nunca reinicializa dados.
import { createHash } from 'node:crypto';
import { closeSync, cpSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const servidor = fileURLToPath(new URL('../', import.meta.url));
const repositorio = resolve(servidor, '..');
const bancoPermitido = 'fazendinha_seedatev3';
const diretoriosPrivados = ['.seed', '.seedatev3', '.seedatev4', '.seedatev5'];
const hash = conteudo => createHash('sha256').update(conteudo).digest('hex');
const quote = valor => '"' + valor.replaceAll('"', '""') + '"';

export function validarArgumentos(argumentos, ambiente, raiz = repositorio) {
  if (argumentos.length !== 2 || !argumentos.includes(`--confirmar=${bancoPermitido}`)) throw Error('Informe --confirmar=fazendinha_seedatev3 e --backup=/caminho/NOVO.dump.');
  const arquivo = argumentos.find(a => a.startsWith('--backup='))?.slice(9);
  if (!arquivo || !isAbsolute(arquivo)) throw Error('Informe um caminho absoluto novo para o backup.');
  const backup = join(realpathSync(dirname(arquivo)), arquivo.slice(arquivo.lastIndexOf('/') + 1));
  const caminhoRelativo = relative(realpathSync(raiz), backup);
  if (caminhoRelativo !== '..' && !caminhoRelativo.startsWith('../') && !isAbsolute(caminhoRelativo)) throw Error('Backup e sidecar devem ficar fora do repositório.');
  if ([backup, `${backup}.json`, `${backup}.manifestos`].some(existsSync)) throw Error('Backup, sidecar ou diretório de manifestos já existe; nenhum arquivo será sobrescrito.');
  const validar = texto => {
    const url = new URL(texto || '');
    if (ambiente.NODE_ENV === 'production' || !['postgres:', 'postgresql:'].includes(url.protocol)
      || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== `/${bancoPermitido}` || url.search) throw Error('Substituição restrita ao PostgreSQL local fazendinha_seedatev3, sem parâmetros alternativos.');
    return url;
  };
  const api = validar(ambiente.DATABASE_URL), url = validar(ambiente.DIRECT_URL || ambiente.DATABASE_URL);
  if (api.hostname !== url.hostname || (api.port || '5432') !== (url.port || '5432') || api.pathname !== url.pathname) throw Error('URLs devem identificar a mesma instância local.');
  return { url, backup };
}

export function preservarManifestos(pasta = servidor) {
  const encontrados = [];
  const percorrer = (diretorio, prefixo) => {
    for (const entrada of readdirSync(diretorio, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const caminho = join(diretorio, entrada.name), relativo = `${prefixo}/${entrada.name}`;
      if (entrada.isSymbolicLink()) throw Error(`Link simbólico inesperado nos manifestos: ${relativo}`);
      if (entrada.isDirectory()) percorrer(caminho, relativo);
      else if (entrada.isFile() && entrada.name === 'manifesto.json') {
        const conteudo = readFileSync(caminho);
        encontrados.push({ caminho: relativo, sha256: hash(conteudo), conteudoBase64: conteudo.toString('base64') });
      }
    }
  };
  for (const nome of diretoriosPrivados) if (existsSync(join(pasta, nome))) {
    if (lstatSync(join(pasta, nome)).isSymbolicLink()) throw Error(`Link simbólico inesperado nos manifestos: ${nome}`);
    percorrer(join(pasta, nome), nome);
  }
  return encontrados;
}

async function conferirExclusividade(db) {
  const outros = await db.query("SELECT count(*)::int AS total FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'");
  if (outros.rows[0].total !== 0) throw Error('Pare os escritores e as outras conexões do banco antes da substituição.');
}

export async function inventariar(db) {
  const identidade = (await db.query("SELECT current_database() AS banco, oid::text AS oid FROM pg_database WHERE datname=current_database()")).rows[0];
  if (identidade.banco !== bancoPermitido) throw Error('A conexão efetiva não corresponde ao banco autorizado.');
  const tabelas = (await db.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','pecuaria') ORDER BY schemaname,tablename")).rows;
  const dados = [];
  for (const t of tabelas) {
    const resumo = (await db.query(`SELECT count(*)::text AS quantidade,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS hash FROM ${quote(t.schemaname)}.${quote(t.tablename)} t`)).rows[0];
    dados.push({ ...t, ...resumo });
  }
  const sequencias = [];
  const nomes = (await db.query("SELECT schemaname,sequencename FROM pg_sequences WHERE schemaname IN ('public','pecuaria') ORDER BY schemaname,sequencename")).rows;
  for (const s of nomes) sequencias.push({ ...s, ...(await db.query(`SELECT last_value::text,is_called FROM ${quote(s.schemaname)}.${quote(s.sequencename)}`)).rows[0] });
  const estrutura = (await db.query(`SELECT md5(coalesce(string_agg(definicao,E'\n' ORDER BY definicao),'')) AS hash FROM (
    SELECT concat('coluna:',n.nspname,':',c.relname,':',a.attname,':',format_type(a.atttypid,a.atttypmod),':',a.attnotnull,':',pg_get_expr(d.adbin,d.adrelid)) AS definicao
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
      WHERE n.nspname IN ('public','pecuaria') AND a.attnum>0 AND NOT a.attisdropped
    UNION ALL SELECT concat('constraint:',n.nspname,':',c.conname,':',pg_get_constraintdef(c.oid))
      FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','pecuaria')
    UNION ALL SELECT concat('funcao:',n.nspname,':',pg_get_functiondef(p.oid))
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','pecuaria') AND p.prokind IN ('f','p')
    UNION ALL SELECT concat('trigger:',n.nspname,':',pg_get_triggerdef(t.oid))
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','pecuaria') AND NOT t.tgisinternal
    UNION ALL SELECT concat('indice:',schemaname,':',indexdef) FROM pg_indexes WHERE schemaname IN ('public','pecuaria')
    UNION ALL SELECT concat('view:',schemaname,':',viewname,':',definition) FROM pg_views WHERE schemaname IN ('public','pecuaria')
    UNION ALL SELECT concat('enum:',n.nspname,':',t.typname,':',e.enumsortorder,':',e.enumlabel)
      FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','pecuaria')
  ) catalogo`)).rows[0].hash;
  return { ...identidade, estrutura, dados, sequencias };
}

export async function substituirBaseLocal({ argumentos = process.argv.slice(2), ambiente = process.env, pastaServidor = servidor, raiz = repositorio,
  conectar = opcoes => new pg.Client(opcoes), comando = spawnSync, log = console.log } = {}) {
  const { url, backup } = validarArgumentos(argumentos, ambiente, raiz);
  const manifestos = preservarManifestos(pastaServidor);
  const ativo = join(pastaServidor, '.seed');
  if (existsSync(ativo) && statSync(ativo).dev !== statSync(dirname(backup)).dev) throw Error('O backup precisa ficar no mesmo sistema de arquivos para arquivar .seed por rename após o reset.');
  const db = conectar({ connectionString: url.toString(), options: '-c default_transaction_read_only=on', application_name: 'substituicao-base-local' });
  // pg_dump recebe a senha somente pelo ambiente do processo, nunca pela linha de comando.
  const ambientePg = Object.fromEntries(Object.entries(ambiente).filter(([nome]) => !nome.startsWith('PG')));
  Object.assign(ambientePg, { PGHOST: url.hostname.replace(/^\[|\]$/g, ''), PGPORT: url.port || '5432', PGDATABASE: bancoPermitido,
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGOPTIONS: '-c default_transaction_read_only=on' });
  let conectado = false;
  try {
    await db.connect(); conectado = true;
    const trava = await db.query("SELECT pg_try_advisory_lock(hashtext('seed-unificada-v1')) AS livre");
    if (!trava.rows[0].livre) throw Error('A seed está em execução; substituição interrompida.');
    await conferirExclusividade(db);
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const antes = await inventariar(db);
    const snapshot = (await db.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
    const fd = openSync(backup, 'wx', 0o600);
    let dump;
    try { dump = comando('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', `--snapshot=${snapshot}`], { env: ambientePg, stdio: ['ignore', fd, 'pipe'] }); }
    finally { closeSync(fd); }
    if (dump.status !== 0 || statSync(backup).size === 0) throw Error('Falha ao criar backup novo; nenhum reset foi executado. Preserve os arquivos para diagnóstico.');
    const leitura = comando('pg_restore', ['--list', backup], { encoding: 'utf8', env: ambientePg });
    if (leitura.status !== 0) throw Error('Backup novo não pôde ser lido; nenhum reset foi executado.');
    const sha256 = hash(readFileSync(backup));
    const pastaManifestos = `${backup}.manifestos`;
    mkdirSync(pastaManifestos, { mode: 0o700 });
    const copiados = [];
    for (const nome of diretoriosPrivados) if (existsSync(join(pastaServidor, nome))) {
      const destino = join(pastaManifestos, nome);
      cpSync(join(pastaServidor, nome), destino, { recursive: true, force: false, errorOnExist: true, preserveTimestamps: true });
      copiados.push({ origem: nome, destino });
    }
    const sidecar = { versao: 1, criadoEm: new Date().toISOString(), origem: { host: url.hostname, porta: url.port || '5432', ...antes },
      backup: { arquivo: backup, sha256, bytes: statSync(backup).size, snapshot }, manifestos,
      diretoriosPreservados: copiados, destinoManifestoAtivo: existsSync(ativo) ? join(pastaManifestos, 'local-ativo') : null };
    writeFileSync(`${backup}.json`, `${JSON.stringify(sidecar, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await db.query('ROLLBACK');
    await conferirExclusividade(db);
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const depois = await inventariar(db);
    await db.query('ROLLBACK');
    if (JSON.stringify(antes) !== JSON.stringify(depois) || JSON.stringify(manifestos) !== JSON.stringify(preservarManifestos(pastaServidor))
      || sha256 !== hash(readFileSync(backup))) throw Error('Banco, manifestos ou backup mudaram após a preservação; nenhum reset foi executado.');
    await conferirExclusividade(db);
    const aplicar = comando('pnpm', ['exec', 'prisma', 'migrate', 'reset', '--force', '--skip-seed'], { cwd: pastaServidor, stdio: 'inherit', env: ambiente });
    if (aplicar.status !== 0) throw Error('A instalação falhou; preserve backup e sidecar e confira a recuperação antes de continuar.');
    // A baseline nova muda a identidade Prisma: o manifesto anterior deve sair do caminho ativo.
    // As cópias acima continuam preservadas mesmo se o rename falhar após o reset.
    if (sidecar.destinoManifestoAtivo) {
      try { renameSync(ativo, sidecar.destinoManifestoAtivo); }
      catch { throw Error(`Baseline instalada, mas .seed não foi arquivada. Preserve ${pastaManifestos} e mova o diretório ativo antes da nova seed; não repita o reset.`); }
    }
    log(`Baseline instalada. Backup e manifestos preservados em ${backup} e ${backup}.json. Execute a seed única separadamente.`);
    return sidecar;
  } finally {
    if (conectado) {
      try { await db.query('ROLLBACK'); }
      finally { await db.end(); }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  substituirBaseLocal().catch(erro => { console.error(erro instanceof Error ? erro.message : 'Falha na manutenção local.'); process.exitCode = 1; });
}
