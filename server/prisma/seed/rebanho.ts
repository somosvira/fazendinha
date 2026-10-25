import { prisma } from '../../src/db.js';
import { cadastrar, movimentar, definirCategoriaManual } from '../../src/services/pecuaria/rebanho/animais.js';
import { cadastrarAnimalSchema } from '../../src/services/pecuaria/rebanho/schemas.js';
import { criarLote } from '../../src/services/pecuaria/rebanho/lotes.js';
import { registrarPesagensColetivas } from '../../src/services/pecuaria/manejo/manejo.js';
import { chave, dia, type Contexto } from './contexto.js';

export const AVISO = 'Cenário sintético de desenvolvimento. Animais, doses, resultados e intervalos fictícios; não são recomendação clínica.';
export const faixa = (de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, i) => de + i);
export const brincoSeed = (n: number) => `DEV-${String(n).padStart(3, '0')}`;
export type SitioSeed = 'Principal' | 'Arrendado' | 'Test';
export type AnimalSeed = { numero: number; sitio: SitioSeed; grupo: string; lote: string; sexo: 'F' | 'M'; aptidao: 'LEITE' | 'CORTE' | 'REPRODUCAO'; papel: 'NENHUM' | 'DOADORA' | 'RECEPTORA'; raca: 'HO' | 'NE'; idade: number; criaParto?: boolean };
function grupo(de: number, ate: number, dados: Omit<AnimalSeed, 'numero'>): AnimalSeed[] { return faixa(de, ate).map(numero => ({ numero, ...dados })); }
const principal = { sitio: 'Principal', sexo: 'F', aptidao: 'LEITE', papel: 'NENHUM', raca: 'HO', idade: 2000 } as const;
export const animaisSeed: readonly AnimalSeed[] = [
  ...grupo(1, 36, { ...principal, grupo: 'Lactantes', lote: 'Lactantes' }).map(a => ({ ...a, papel: a.numero === 7 ? 'RECEPTORA' as const : a.papel })),
  ...grupo(37, 48, { ...principal, grupo: 'Secas', lote: 'Secas' }),
  ...grupo(49, 58, { ...principal, grupo: 'Novilhas', lote: 'Novilhas', idade: 600 }),
  ...grupo(59, 61, { ...principal, grupo: 'Reprodução', lote: 'Reprodução', aptidao: 'REPRODUCAO', papel: 'DOADORA' }),
  ...grupo(62, 64, { ...principal, grupo: 'Reprodução', lote: 'Reprodução', aptidao: 'REPRODUCAO', papel: 'RECEPTORA' }),
  ...grupo(65, 72, { ...principal, grupo: 'Crias', lote: 'Crias', idade: 0, criaParto: true }).map((a, i) => ({ ...a, sexo: i % 2 ? 'M' as const : 'F' as const })),
  ...grupo(101, 112, { ...principal, sitio: 'Arrendado', grupo: 'Receptoras', lote: 'Receptoras arrendado', aptidao: 'REPRODUCAO', papel: 'RECEPTORA' }),
  ...grupo(113, 126, { ...principal, sitio: 'Arrendado', grupo: 'Novilhas', lote: 'Novilhas arrendado', idade: 600 }),
  ...grupo(127, 127, { ...principal, sitio: 'Arrendado', grupo: 'Touro', lote: 'Touro arrendado', sexo: 'M', aptidao: 'REPRODUCAO', raca: 'NE' }),
  ...grupo(128, 136, { ...principal, sitio: 'Arrendado', grupo: 'Corte', lote: 'Corte arrendado', aptidao: 'CORTE', raca: 'NE' }),
  ...grupo(201, 212, { ...principal, sitio: 'Test', grupo: 'Matrizes', lote: 'Matrizes test', aptidao: 'CORTE', raca: 'NE' }),
  ...grupo(213, 220, { ...principal, sitio: 'Test', grupo: 'Garrotes', lote: 'Garrotes test', sexo: 'M', aptidao: 'CORTE', raca: 'NE', idade: 500 }),
  ...grupo(221, 224, { ...principal, sitio: 'Test', grupo: 'Crias', lote: 'Crias test', aptidao: 'CORTE', raca: 'NE', idade: 120 }),
];
export const lactantesSeed = faixa(1, 36);
export async function acaoPecuaria(c: Contexto, nome: string, executar: () => Promise<unknown>) {
  await c.acao(nome, async () => !!await prisma.requisicaoPecuaria.findUnique({ where: { chave: chave(nome) } }), executar);
}

export async function rebanho(c: Contexto) {
  const uid = c.numero('usuario:dono');
  for (const a of animaisSeed.filter((a, i, todos) => todos.findIndex(b => b.lote === a.lote) === i)) {
    const propriedadeId = c.numero(`sitio:${a.sitio}`);
    await c.registro(`lote:${a.lote}`, id => prisma.lote.findFirst({ where: id ? { id } : { nome: a.lote, propriedadeId } }), () => criarLote({ nome: a.lote, propriedadeId, centroCustoId: c.id('centro:Pecuária'), observacao: AVISO }, uid));
  }
  for (const a of animaisSeed.filter(a => !a.criaParto)) {
    // Duas matrizes comprovam a recria no arrendado e a entrada histórica no plantel principal.
    const transferida = [35, 36].includes(a.numero);
    const propriedadeId = c.numero(`sitio:${transferida ? 'Arrendado' : a.sitio}`);
    await c.registro(`animal:${a.numero}`, id => prisma.animal.findFirst({ where: id ? { id } : { brinco: brincoSeed(a.numero) } }), () => cadastrar(cadastrarAnimalSchema.parse({
      brinco: brincoSeed(a.numero), nome: `${a.grupo} ${a.numero}`, sexo: a.sexo, origem: 'COMPRADO',
      dataNascimento: c.dias(-a.idade), dataEntrada: c.dias(a.idade > 700 ? -700 : -a.idade + 30),
      partosAntesDaEntrada: a.sexo === 'F' && a.idade > 1000 ? 2 : 0, propriedadeId,
      loteId: c.id(`lote:${transferida ? 'Receptoras arrendado' : a.lote}`), aptidao: a.aptidao, papelReprodutivo: a.papel,
      composicao: [{ racaId: c.id(`raca:${a.raca}`), fracao64: 64 }], observacao: AVISO,
    }), uid, { nascimentoHistorico: true }));
    if (transferida) await c.acao(`transferencia:${a.numero}`, async () => !!await prisma.localizacaoAnimal.findFirst({ where: { animalId: c.id(`animal:${a.numero}`), propriedadeId: c.numero('sitio:Principal'), desde: dia(c.dias(-660)) } }), () => movimentar({ animalIds: [c.id(`animal:${a.numero}`)], propriedadeId: c.numero('sitio:Principal'), loteId: c.id('lote:Lactantes'), data: c.dias(-660), motivo: 'Recria no arrendado e ingresso no plantel leiteiro.' }, uid, c.numero('sitio:Arrendado')));
  }
  const touro = await prisma.categoriaAnimal.findUniqueOrThrow({ where: { chavePadrao: 'M_REPRODUTOR' } });
  await c.acao('categoria:touro', async () => !!await prisma.categoriaManualAnimal.findFirst({ where: { animalId: c.id('animal:127'), categoriaId: touro.id } }), () => definirCategoriaManual(c.id('animal:127'), { categoriaId: touro.id, data: c.dias(-690), motivo: 'Touro reprodutor demonstrativo do sítio arrendado.' }, uid));
  for (const sitio of ['Principal', 'Arrendado', 'Test'] as const) for (const [data, ganho] of [[c.dias(-25), 0], [c.dias(-5), 8]] as const) {
    const nome = `pesagens:${sitio}:${data}`;
    await acaoPecuaria(c, nome, () => registrarPesagensColetivas({ chave: chave(nome), propriedadeId: c.numero(`sitio:${sitio}`), data, tipo: 'ROTINA', origem: 'BALANCA',
      itens: animaisSeed.filter(a => a.sitio === sitio && !a.criaParto).map(a => ({ animalId: c.id(`animal:${a.numero}`), pesoKg: (a.idade > 1000 ? 500 : a.idade > 350 ? 320 : 110) + ganho, observacao: AVISO })),
    }, uid));
  }
}
