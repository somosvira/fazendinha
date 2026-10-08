import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { z } from 'zod';
import { env } from '../../src/env.js';

export const VERSAO = 1;
export const BANCO = 'fazendinha_seedatev3';
export const diretorio = fileURLToPath(new URL('../../.seedatev3/', import.meta.url));
const arquivo = `${diretorio}/manifesto.json`;
const schemaManifesto = z.object({
  versao: z.literal(VERSAO), banco: z.literal(BANCO), identidade: z.string(),
  dataBase: z.string().date(), ids: z.record(z.string()), etapas: z.array(z.string()),
  acoes: z.array(z.string()), criadoEm: z.string().datetime(),
});
export type Manifesto = z.infer<typeof schemaManifesto>;

export function validarDestino(url: string, ambiente: string) {
  const destino = new URL(url);
  if (ambiente === 'production' || !['localhost', '127.0.0.1', '[::1]'].includes(destino.hostname)
    || destino.pathname !== `/${BANCO}` || !['postgres:', 'postgresql:'].includes(destino.protocol)) {
    throw new Error(`Seed permitido apenas no PostgreSQL local ${BANCO}, fora de produção.`);
  }
  return destino;
}

export function hojeBrasil(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}
export const iso = (data: Date) => data.toISOString().slice(0, 10);
export const dia = (data: string) => new Date(`${data}T00:00:00Z`);
export function deslocar(data: string, dias: number) { const d = dia(data); d.setUTCDate(d.getUTCDate() + dias); return iso(d); }
export function noMes(data: string, deslocamento: number, numeroDia: number) {
  const d = dia(data); return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + deslocamento, numeroDia)));
}
export function chave(nome: string) {
  const h = createHash('sha256').update(`seedatev3:${VERSAO}:${nome}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Estado local atômico; nunca é uma fonte de saldos ou fatos de negócio. */
export class Contexto {
  constructor(public manifesto: Manifesto, public verificar: boolean, private interromperApos?: string, private pasta = diretorio) {}
  id(nome: string) { const id = this.manifesto.ids[nome]; if (!id) throw new Error(`Referência ausente: ${nome}`); return id; }
  numero(nome: string) { return Number(this.id(nome)); }
  dias(n: number) { return deslocar(this.manifesto.dataBase, n); }
  mes(n: number, d: number) { return noMes(this.manifesto.dataBase, n, d); }
  async salvar() {
    if (this.verificar) throw new Error('Verificação não pode escrever o manifesto.');
    await mkdir(this.pasta, { recursive: true });
    const destino = `${this.pasta}/manifesto.json`;
    const temporario = `${destino}.${process.pid}.tmp`;
    await writeFile(temporario, `${JSON.stringify(this.manifesto, null, 2)}\n`, { mode: 0o600 });
    await rename(temporario, destino);
  }
  async registro(nome: string, buscar: (id?: string) => Promise<{ id: string | number } | null>, criar: () => Promise<{ id: string | number }>) {
    if (this.verificar) throw new Error('Verificação não pode preparar registros.');
    const id = this.manifesto.ids[nome];
    const existente = await buscar(id);
    if (id && !existente) throw new Error(`${nome} foi removido manualmente. Não será recriado automaticamente.`);
    const registro = existente ?? await criar();
    if (!id) { this.manifesto.ids[nome] = String(registro.id); await this.salvar(); }
    return registro;
  }
  async acao(nome: string, concluida: () => Promise<boolean>, executar: () => Promise<unknown>) {
    if (this.verificar) throw new Error('Verificação não pode executar ações.');
    if (this.manifesto.acoes.includes(nome)) return;
    if (!await concluida()) await executar();
    this.manifesto.acoes.push(nome); await this.salvar();
  }
  async etapa(nome: string, executar: () => Promise<void>) {
    if (this.verificar) throw new Error('Verificação não pode executar etapas.');
    if (this.manifesto.etapas.includes(nome)) {
      if (this.interromperApos === nome) throw new Error(`Interrupção de teste após ${nome}; execute novamente para retomar.`);
      return;
    }
    process.stdout.write(`[seedatev3] ${nome}\n`);
    await executar(); this.manifesto.etapas.push(nome); await this.salvar();
    if (this.interromperApos === nome) throw new Error(`Interrupção de teste após ${nome}; execute novamente para retomar.`);
  }
}

export async function abrirContexto(verificar: boolean, interromperApos?: string) {
  const url = validarDestino(env.DATABASE_URL, env.NODE_ENV);
  if (!['dev', 'test'].includes(env.STORAGE_NAMESPACE)) throw new Error('Seed exige STORAGE_NAMESPACE=dev ou test.');
  const cliente = new pg.Client({ connectionString: url.toString() });
  await cliente.connect();
  try {
    const trava = await cliente.query<{ livre: boolean }>("SELECT pg_try_advisory_lock(hashtext('seedatev3')) AS livre");
    if (!trava.rows[0].livre) throw new Error('Outra execução do seedatev3 está em andamento.');
    if (verificar) await cliente.query('SET default_transaction_read_only = on');
    const migrations = await cliente.query<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations');
    const pasta = new URL('../migrations/', import.meta.url);
    for (const nome of (await readdir(pasta)).filter(n => /^\d/.test(n))) {
      const sql = await readFile(new URL(`${nome}/migration.sql`, pasta));
      const hash = createHash('sha256').update(sql).digest('hex');
      if (!migrations.rows.some(m => m.migration_name === nome && m.finished_at && !m.rolled_back_at && m.checksum === hash)) {
        throw new Error(`Migration ausente, alterada ou incompleta: ${nome}. Aplique prisma migrate deploy primeiro.`);
      }
    }
    if (migrations.rows.some(m => !m.finished_at && !m.rolled_back_at)) throw new Error('Há migration interrompida.');
    const identidadeDb = await cliente.query<{ identidade: string }>("SELECT oid::text || ':' || current_database() AS identidade FROM pg_database WHERE datname=current_database()");
    const identidade = `${url.hostname}:${url.port}:${identidadeDb.rows[0].identidade}:${migrations.rows.filter(m => m.finished_at).map(m => m.finished_at!.toISOString()).sort()[0]}`;
    let manifesto: Manifesto;
    try { manifesto = schemaManifesto.parse(JSON.parse(await readFile(arquivo, 'utf8'))); }
    catch (e) {
      if (!(e instanceof Error && 'code' in e && e.code === 'ENOENT')) throw e;
      if (verificar) throw new Error('Manifesto inexistente; prepare o cenário primeiro.');
      const fatos = await cliente.query<{ total: string }>('SELECT (SELECT count(*) FROM public."Operacao") + (SELECT count(*) FROM pecuaria."Animal") AS total');
      if (fatos.rows[0].total !== '0') throw new Error('Banco contém fatos sem manifesto. Não será sobrescrito.');
      manifesto = { versao: VERSAO, banco: BANCO, identidade, dataBase: hojeBrasil(), ids: {}, etapas: [], acoes: [], criadoEm: new Date().toISOString() };
    }
    if (manifesto.identidade !== identidade) throw new Error('Manifesto pertence a outra instância do banco. Preserve-o antes de preparar um banco novo.');
    const contexto = new Contexto(manifesto, verificar, interromperApos);
    if (!verificar) await contexto.salvar();
    return { contexto, fechar: async () => { await cliente.end(); } };
  } catch (e) { await cliente.end(); throw e; }
}
