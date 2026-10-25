import { prisma } from '../../../src/db.js';
import type { Contexto } from '../contexto.js';
import { key, ref } from './catalogo.js';
export const id = (c: Contexto, n: string) => c.id(ref(n));
export const sitio = (c: Contexto) => c.numero('sitio:Principal');
export const uid = (c: Contexto) => c.numero('usuario:dono');
export const ctx = (c: Contexto) => ({ propriedadeId: sitio(c), usuarioId: uid(c) });
export async function guardar(c: Contexto, n: string, valor: string) {
  const existente = c.manifesto.ids[ref(n)];
  if (existente && existente !== valor) throw new Error(`Referência V5 mudou: ${n}. Confira sem sobrescrever o cenário.`);
  c.manifesto.ids[ref(n)] = valor; await c.salvar();
}
/** Recupera a resposta já confirmada mesmo se o processo cair antes de salvar o manifesto. */
export async function executar(c: Contexto, n: string, fn: () => Promise<unknown>, recuperarRecibo: (recibo: unknown) => unknown = recibo => recibo) {
  await c.acao(ref(n), async () => false, async () => {
    const anterior = await prisma.requisicaoPecuaria.findUnique({ where: { chave: key(n) } });
    if (anterior && (anterior.propriedadeId !== sitio(c) || anterior.usuarioId !== uid(c))) throw new Error(`Chave de outro contexto: ${n}`);
    const resultado: unknown = anterior ? recuperarRecibo(anterior.resultadoIds) : await fn();
    if (resultado && typeof resultado === 'object' && 'id' in resultado && typeof resultado.id === 'string') await guardar(c, n, resultado.id);
  });
}
