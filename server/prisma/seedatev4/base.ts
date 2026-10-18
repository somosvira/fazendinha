import { prisma } from '../../src/db.js';
import { chave, type Contexto } from '../seedatev3/contexto.js';
import { PREFIXO } from './catalogo.js';

export const ref = (nome: string) => `${PREFIXO}${nome}`;
export const key = (nome: string) => chave(ref(nome));
export const id = (c: Contexto, nome: string) => c.id(ref(nome));
export const uid = (c: Contexto) => c.numero('usuario:dono');
export const sitio = (c: Contexto, nome = 'Escola') => c.numero(ref(`sitio:${nome}`));
export const animal = (c: Contexto, numero: number) => id(c, `animal:${numero}`);
export async function acao(c: Contexto, nome: string, executar: () => Promise<unknown>) {
  await c.acao(ref(nome), async () => !!await prisma.requisicaoPecuaria.findUnique({ where: { chave: key(nome) } }), executar);
}
