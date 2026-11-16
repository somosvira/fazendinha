import { prisma } from '../../src/db.js';
import { encerrarLactacao } from '../../src/services/pecuaria/reproducao/registros.js';
import { manterPesoSecagem } from '../../src/services/pecuaria/reproducao/peso-secagem.js';
import type { PesoSecagemInput } from '../../src/services/pecuaria/reproducao/peso-secagem.schemas.js';
import { hojeFazendaDate } from '../../src/services/pecuaria/rebanho/regras.js';
import { chave, iso, type Contexto } from './contexto.js';
import { AVISO } from './rebanho.js';

const lactacaoDe = (c: Contexto, numero: number, aberta: boolean) => prisma.lactacaoAnimal.findFirstOrThrow({
  where: { animalId: c.id(`animal:${numero}`), propriedadeId: c.sitioIds.principal, encerradaEm: aberta ? null : { not: null } }, orderBy: { inicio: 'desc' } });

/** Peso na secagem: duas secagens novas com pesagem e uma secagem antiga regularizada com peso informado. */
export async function pesagensSecagem(c: Contexto) {
  const uid = c.usuarioId, propriedadeId = c.sitioIds.principal, hoje = iso(hojeFazendaDate());
  const secagens: [number, PesoSecagemInput][] = [
    [33, { acao: 'REGISTRAR', data: hoje, pesoKg: 548, origem: 'BALANCA', precisao: 'MEDIDO', observacao: AVISO }],
    [34, { acao: 'REGISTRAR', data: hoje, pesoKg: 520, origem: 'MANUAL', precisao: 'ESTIMADO', observacao: 'Fita de pesagem; valor sintético.' }],
  ];
  for (const [numero, pesoSecagem] of secagens) {
    const nome = `secagem:${numero}`;
    await c.acao(nome, async () => !!await prisma.lactacaoAnimal.findFirst({ where: { animalId: c.id(`animal:${numero}`), encerradaEm: { not: null }, inicio: { gte: new Date(`${c.dias(-460)}T00:00:00Z`) } } }), async () => {
      const lactacao = await lactacaoDe(c, numero, true);
      await encerrarLactacao(lactacao.id, propriedadeId, hoje, 'Secagem demonstrativa com peso registrado.', uid, { chave: chave(nome), pesoSecagem });
    });
  }
  // Secagem histórica (D−70) sem peso: o registro posterior preserva a data do fato.
  await c.acao('secagem:historica:37', async () => !!await prisma.vinculoPesagemSecagem.findFirst({ where: { lactacao: { animalId: c.id('animal:37') } } }), async () => {
    const lactacao = await lactacaoDe(c, 37, false);
    await manterPesoSecagem(lactacao.id, { chave: chave('secagem:historica:37'), propriedadeId, versaoEsperada: lactacao.versao, motivo: 'Peso anotado no caderno de campo na secagem.',
      pesoSecagem: { acao: 'REGISTRAR', data: iso(lactacao.encerradaEm!), pesoKg: 535, origem: 'MANUAL', precisao: 'INFORMADO', observacao: AVISO } }, uid);
  });
}
