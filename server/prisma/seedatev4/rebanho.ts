import { prisma } from '../../src/db.js';
import { cadastrar } from '../../src/services/pecuaria/rebanho/animais.js';
import { cadastrarAnimalSchema } from '../../src/services/pecuaria/rebanho/schemas.js';
import { criarLote } from '../../src/services/pecuaria/rebanho/lotes.js';
import { criarSituacaoInicial } from '../../src/services/pecuaria/reproducao/registros.js';
import { vincularPoliticaCiclo, decidirElegibilidadeCiclo } from '../../src/services/pecuaria/reproducao/elegibilidade.js';
import { registrarLactacaoHistorica } from '../../src/services/pecuaria/reproducao/lactacoes.js';
import { registrarPesagensColetivas } from '../../src/services/pecuaria/manejo/manejo.js';
import type { Contexto } from '../seedatev3/contexto.js';
import { AVISO, animaisV4, brincoV4, nomeV4 } from './catalogo.js';
import { acao, animal, id, key, ref, sitio, uid } from './base.js';

export async function rebanho(c: Contexto, apenas?: readonly number[]) {
  for (const nome of [...new Set(animaisV4.map(a => a.lote)), 'Cria', 'Matrizes destino'])
    await c.registro(ref(`lote:${nome}`), i => prisma.lote.findFirst({ where: i ? { id: i } : { nome: nomeV4(nome) } }), () => criarLote({
      nome: nomeV4(nome), propriedadeId: sitio(c, nome === 'Matrizes destino' ? 'Destino' : 'Escola'), centroCustoId: c.id('centro:Pecuária'), observacao: AVISO,
    }, uid(c)));
  for (const a of animaisV4.filter(a => !apenas || apenas.includes(a.numero))) {
    await c.registro(ref(`animal:${a.numero}`), i => prisma.animal.findFirst({ where: i ? { id: i } : { brinco: brincoV4(a.numero) } }), () => cadastrar(cadastrarAnimalSchema.parse({
      brinco: brincoV4(a.numero), nome: a.cenario, sexo: a.sexo, origem: 'COMPRADO', dataNascimento: c.dias(a.numero === 26 ? -850 : -2200 - a.numero), dataEntrada: c.dias(-600),
      partosAntesDaEntrada: a.numero === 26 || a.sexo === 'M' ? 0 : 2, propriedadeId: sitio(c), loteId: id(c, `lote:${a.lote}`), aptidao: 'LEITE',
      papelReprodutivo: a.papel, observacao: AVISO, composicao: [{ racaId: c.id('raca:HO'), fracao64: 64 }],
    }), uid(c), { nascimentoHistorico: true }));
    if (a.sexo === 'F' && a.numero !== 18) {
      await c.registro(ref(`inicial:${a.numero}`), i => prisma.situacaoInicialReprodutiva.findFirst({ where: i ? { id: i } : { animalId: animal(c, a.numero), data: new Date(c.dias(-500)) } }),
        () => criarSituacaoInicial({ chave: key(`inicial:${a.numero}`), animalId: animal(c, a.numero), propriedadeId: sitio(c), data: c.dias(-500), situacao: 'VAZIA', observacao: AVISO }, uid(c)));
      await acao(c, `ciclo:${a.numero}`, () => vincularPoliticaCiclo({ chave: key(`ciclo:${a.numero}`), animalId: animal(c, a.numero), propriedadeId: sitio(c), situacaoInicialId: id(c, `inicial:${a.numero}`) }, uid(c)));
      if (a.numero === 26) {
        const ciclo = await prisma.vinculoPoliticaCiclo.findFirstOrThrow({ where: { animalId: animal(c, 26), chaveCiclo: 'INICIAL' } });
        await acao(c, 'liberacao:26', () => decidirElegibilidadeCiclo({ chave: key('liberacao:26'), propriedadeId: sitio(c), vinculoCicloId: ciclo.id,
          data: c.dias(-30), tipo: 'LIBERAR', aptaDesde: c.dias(-30), motivo: 'Liberação demonstrativa explícita da novilha para testar a operação.' }, uid(c)));
      }
    }
    if ([1, 2, 3, 4, 5, 6, 14, 16, 17, 19, 28, 29].includes(a.numero)) await acao(c, `lactacao:${a.numero}`, () => registrarLactacaoHistorica({
      chave: key(`lactacao:${a.numero}`), animalId: animal(c, a.numero), propriedadeId: sitio(c), inicio: c.dias(-250),
      ...(a.numero === 16 ? { encerradaEm: c.dias(-30) } : {}), motivo: 'Lactação histórica fictícia, sem presumir parto que não foi documentado.',
    }, uid(c)));
  }
  await acao(c, 'pesagens', () => registrarPesagensColetivas({ chave: key('pesagens'), propriedadeId: sitio(c), data: c.dias(-2), tipo: 'ROTINA', origem: 'MANUAL',
    itens: [1, 2, 3, 22, 23, 26, 30].map(n => ({ animalId: animal(c, n), pesoKg: n === 26 ? 390 : 480 + n, observacao: AVISO })),
  }, uid(c)));
}
