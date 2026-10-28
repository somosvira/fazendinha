import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { verificarReferenciasPg } from './referencias.js';

export const VERSAO = 1;
export const BANCO = 'fazendinha_seedatev3';
export const diretorio = fileURLToPath(new URL('../../.seed/', import.meta.url));
export const schemaManifesto = z.object({
  versao: z.literal(VERSAO), banco: z.literal(BANCO), identidade: z.string(),
  baseline: z.object({ nome: z.string(), checksum: z.string().regex(/^[a-f0-9]{64}$/) }),
  fuso: z.literal('America/Sao_Paulo'), dataBase: z.string().date(),
  ids: z.record(z.string()), etapas: z.array(z.string()), acoes: z.array(z.string()), criadoEm: z.string().datetime(),
});
export type Manifesto = z.infer<typeof schemaManifesto>;
export type ModoSeed = 'executar' | 'preflight' | 'verificar';
export function validarDestino(url: string, ambiente: string) {
  const destino = new URL(url);
  if (ambiente === 'production' || !['localhost', '127.0.0.1', '[::1]'].includes(destino.hostname)
    || destino.pathname !== `/${BANCO}` || !['postgres:', 'postgresql:'].includes(destino.protocol)
    || ['host', 'hostaddr', 'port', 'dbname', 'service', 'options'].some(p => destino.searchParams.has(p))) {
    throw new Error(`Seed permitido apenas no PostgreSQL local ${BANCO}, fora de produção e sem redirecionamento por parâmetros.`);
  }
  return destino;
}
export function hojeBrasil(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}
export const iso = (data: Date) => data.toISOString().slice(0, 10);
export const dia = (data: string) => new Date(`${data}T00:00:00Z`);
export function deslocar(data: string, dias: number) { const d = dia(data); d.setUTCDate(d.getUTCDate() + dias); return iso(d); }
export function noMes(data: string, mes: number, numeroDia: number) { const d = dia(data); return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + mes, numeroDia))); }
export function chave(nome: string) {
  const h = createHash('sha256').update(`seed-unificada:${VERSAO}:${nome}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Manifesto local novo. Não lê nem depende dos manifestos V3/V4/V5. */
export class ContextoSeed {
  constructor(public manifesto: Manifesto, public verificar: boolean, private interromperApos?: string, private pasta = diretorio, public prisma?: PrismaClient) {}
  get dataBase() { return this.manifesto.dataBase; }
  get usuarioId() { return this.numero('usuario:dono'); }
  get sitioIds() { return { principal: this.numero('sitio:Principal'), arrendado: this.numero('sitio:Arrendado'), test: this.numero('sitio:Test') }; }
  id(nome: string) { const id = this.manifesto.ids[nome]; if (!id) throw new Error(`Referência ausente: ${nome}`); return id; }
  numero(nome: string) { const n = Number(this.id(nome)); if (!Number.isSafeInteger(n) || n < 1) throw new Error(`Referência numérica inválida: ${nome}`); return n; }
  dias(n: number) { return deslocar(this.dataBase, n); }
  mes(n: number, d: number) { return noMes(this.dataBase, n, d); }
  async salvar() {
    if (this.verificar) throw new Error('Verificação não pode escrever o manifesto.');
    schemaManifesto.parse(this.manifesto);
    await mkdir(this.pasta, { recursive: true, mode: 0o700 });
    const destino = `${this.pasta}/manifesto.json`, temporario = `${destino}.${process.pid}.tmp`;
    await writeFile(temporario, `${JSON.stringify(this.manifesto, null, 2)}\n`, { mode: 0o600 });
    await rename(temporario, destino);
  }
  async guardar(nome: string, valor: string | number) {
    if (this.verificar) throw new Error('Verificação não pode preparar registros.');
    const anterior = this.manifesto.ids[nome];
    if (anterior && anterior !== String(valor)) throw new Error(`Referência divergente: ${nome}. Nenhum fato será sobrescrito.`);
    if (!anterior) { this.manifesto.ids[nome] = String(valor); await this.salvar(); }
  }
  async registro(nome: string, buscar: (id?: string) => Promise<{ id: string | number } | null>, criar: () => Promise<{ id: string | number }>) {
    if (this.verificar) throw new Error('Verificação não pode preparar registros.');
    const id = this.manifesto.ids[nome], existente = await buscar(id);
    if (id && (!existente || String(existente.id) !== id)) throw new Error(`${nome} foi removido ou divergiu. Não será recriado automaticamente.`);
    const registro = existente ?? await criar(); await this.guardar(nome, registro.id); return registro;
  }
  async acao(nome: string, concluida: () => Promise<boolean>, executar: () => Promise<unknown>) {
    if (this.verificar) throw new Error('Verificação não pode executar ações.');
    if (this.manifesto.acoes.includes(nome)) return;
    if (!await concluida()) await executar();
    this.manifesto.acoes.push(nome); await this.salvar();
  }
  async etapa(nome: string, executar: () => Promise<void>) {
    if (this.verificar) throw new Error('Verificação não pode executar etapas.');
    if (!this.manifesto.etapas.includes(nome)) {
      process.stdout.write(`[seed] ${nome}\n`); await executar(); this.manifesto.etapas.push(nome); await this.salvar();
    }
    if (this.interromperApos === nome) throw new Error(`Interrupção de teste após ${nome}; execute novamente para retomar.`);
  }
}
export { ContextoSeed as Contexto };

export function argumentos(args: string[]) {
  const conhecidos = args.every(a => ['--preflight', '--verificar', '--arquivos-r2'].includes(a) || /^--interromper-apos=[a-z][a-z0-9:-]*$/.test(a));
  if (!conhecidos || (args.includes('--preflight') && args.includes('--verificar'))) throw new Error('Argumentos inválidos da seed única.');
  const modo: ModoSeed = args.includes('--preflight') ? 'preflight' : args.includes('--verificar') ? 'verificar' : 'executar';
  if (modo !== 'executar' && args.some(a => a === '--arquivos-r2' || a.startsWith('--interromper-apos='))) throw new Error('Modos somente leitura não aceitam etapas de escrita.');
  return { modo, arquivosR2: args.includes('--arquivos-r2'), interromperApos: args.find(a => a.startsWith('--interromper-apos='))?.split('=')[1] };
}

/** Até retornar, só consulta o PostgreSQL; nenhum serviço de domínio é importado. */
export async function abrirContexto(modo: ModoSeed = 'executar', interromperApos?: string) {
  const url = validarDestino(process.env.DATABASE_URL ?? '', process.env.NODE_ENV ?? 'development');
  if (!['dev', 'test'].includes(process.env.STORAGE_NAMESPACE ?? '')) throw new Error('Seed exige STORAGE_NAMESPACE=dev ou test.');
  if (process.env.DIRECT_URL) {
    const direta = validarDestino(process.env.DIRECT_URL, process.env.NODE_ENV ?? '');
    if (direta.hostname !== url.hostname || (direta.port || '5432') !== (url.port || '5432') || direta.pathname !== url.pathname) throw new Error('DIRECT_URL deve apontar à mesma instância local de DATABASE_URL.');
  }
  const cliente = new pg.Client({ connectionString: url.toString(), options: '-c default_transaction_read_only=on' });
  await cliente.connect();
  try {
    const trava = await cliente.query<{ livre: boolean }>("SELECT pg_try_advisory_lock(hashtext('seed-unificada-v1')) AS livre");
    if (!trava.rows[0]?.livre) throw new Error('Outra execução da seed única está em andamento.');
    const pastas = (await readdir(new URL('../migrations/', import.meta.url))).filter(n => /^\d/.test(n)).sort();
    const baselines = pastas.filter(n => n.endsWith('_base_unificada'));
    if (baselines.length !== 1 || pastas[0] !== baselines[0]) throw new Error('Seed única exige uma baseline inicial, sem histórico anterior; conclua a consolidação antes da carga.');
    const nome = baselines[0];
    const esperadas = new Map(await Promise.all(pastas.map(async pasta => [pasta, createHash('sha256').update(await readFile(new URL(`../migrations/${pasta}/migration.sql`, import.meta.url))).digest('hex')] as const)));
    const checksum = esperadas.get(nome)!;
    const migrations = await cliente.query<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations');
    const ativas = migrations.rows.filter(m => !m.rolled_back_at);
    const baselineAplicada = ativas.find(m => m.migration_name === nome);
    if (!baselineAplicada?.finished_at || ativas.length !== pastas.length || new Set(ativas.map(m => m.migration_name)).size !== pastas.length || ativas.some(m => !m.finished_at || esperadas.get(m.migration_name) !== m.checksum)) throw new Error('Baseline aplicada ou cadeia de migrations ausente, divergente ou incompleta.');
    const db = await cliente.query<{ identidade: string }>("SELECT oid::text || ':' || current_database() AS identidade FROM pg_database WHERE datname=current_database()");
    const identidade = `${url.hostname}:${url.port || '5432'}:${db.rows[0].identidade}:${baselineAplicada.finished_at.toISOString()}`;
    let manifesto: Manifesto;
    try { manifesto = schemaManifesto.parse(JSON.parse(await readFile(`${diretorio}/manifesto.json`, 'utf8'))); }
    catch (erro) {
      if (!(erro instanceof Error && 'code' in erro && erro.code === 'ENOENT')) throw erro;
      if (modo === 'verificar') throw new Error('Manifesto da seed única inexistente.');
      const fatos = await cliente.query<{ total: string }>(`SELECT (SELECT count(*) FROM public."Operacao") + (SELECT count(*) FROM pecuaria."Animal") + (SELECT count(*) FROM public."Usuario") + (SELECT count(*) FROM public."Produto") + (SELECT count(*) FROM public."Parceiro") + (SELECT count(*) FROM public."ContaFinanceira") + (SELECT count(*) FROM public."Propriedade" WHERE nome <> 'Propriedade principal') AS total`);
      if (fatos.rows[0].total !== '0') throw new Error('Banco contém fatos ou usuários sem manifesto da seed única. Preserve os dados e prepare a substituição separadamente.');
      manifesto = { versao: VERSAO, banco: BANCO, identidade, baseline: { nome, checksum }, fuso: 'America/Sao_Paulo', dataBase: hojeBrasil(), ids: {}, etapas: [], acoes: [], criadoEm: new Date().toISOString() };
    }
    if (manifesto.identidade !== identidade || manifesto.baseline.nome !== nome || manifesto.baseline.checksum !== checksum) throw new Error('Manifesto pertence a outra instância ou baseline.');
    await verificarReferenciasPg(cliente, manifesto);
    const contexto = new ContextoSeed(manifesto, modo !== 'executar', interromperApos);
    return { contexto, cliente, fechar: async () => { await cliente.end(); } };
  } catch (erro) { await cliente.end(); throw erro; }
}
