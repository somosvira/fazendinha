import { prisma } from '../../src/db.js';
import { salvarConfiguracao, registrarPerfil, mudarFase } from '../../src/services/pecuaria/bezerreiro/gestao.js';
import { consultarPrevisao, confirmarOferta } from '../../src/services/pecuaria/bezerreiro/aleitamento.js';
import { registrarRetiradaColostro, confirmarRetiradaColostro, destinarColostro } from '../../src/services/pecuaria/bezerreiro/colostro.js';
import { fechamentosSobrepostosTx } from '../../src/services/pecuaria/bezerreiro/alimentacao-compartilhada.js';
import { consultaSchema } from '../../src/services/pecuaria/bezerreiro/schemas.js';
import { hojeFazendaDate } from '../../src/services/pecuaria/rebanho/regras.js';
import { chave, iso, type Contexto } from './contexto.js';
import { AVISO } from './rebanho.js';
import { posicoes } from './leite/producao.js';
import { ref } from './leite/catalogo.js';

const RESPONSAVEL = 'Equipe demonstrativa do bezerreiro';
const PERCENTUAL_OFERTA = [50, 50] as const;

/** Política, colostragem rastreável, participações por localização e ofertas confirmadas no Principal. */
export async function bezerreiro(c: Contexto) {
  const uid = c.usuarioId, propriedadeId = c.sitioIds.principal;

  // A rotina tem uma única lista de ofertas compartilhada pelas fases, como na tela de Configurações.
  const ofertas = PERCENTUAL_OFERTA.map((percentual, ordem) => ({ identidadeId: chave(`bezerreiro:oferta:${ordem}`), ordem, percentual: String(percentual), horarioPrevisto: ordem ? '16:00' : '06:00' }));
  await c.acao('bezerreiro:configuracao', async () => !!await prisma.configuracaoBezerreiro.findFirst({ where: { propriedadeId } }), () => salvarConfiguracao({
    chave: chave('bezerreiro:configuracao'), propriedadeId, versaoEsperada: 0, brixReferencia: '22', percentualPesoColostro: '10', imunidade: null,
    fases: [
      { nome: 'Aleitamento inicial', coleiraNome: 'Azul', cor: '#2563eb', litrosDia: '6', publicada: true, criteriosTransicao: { idadeDias: 30, automatico: false }, ofertas },
      { nome: 'Desaleitamento', coleiraNome: 'Amarela', cor: '#ca8a04', litrosDia: '3', publicada: true, criteriosTransicao: { idadeDias: 60, automatico: false }, ofertas },
    ],
  }, uid));
  const fase = await prisma.faseBezerreiroVersao.findFirstOrThrow({ where: { propriedadeId, nome: 'Aleitamento inicial', publicada: true }, orderBy: { versao: 'desc' }, include: { ofertas: { orderBy: { ordem: 'asc' } } } });

  // Colostro do parto gemelar DEV-001: retirada nova, estoque confirmado, duas crias e duas unidades no banco.
  const partoId = c.id('parto:1'), parto = await prisma.partoAnimal.findUniqueOrThrow({ where: { id: partoId } });
  const crias = await prisma.criaParto.findMany({ where: { partoId, viva: true }, orderBy: { ordem: 'asc' } });
  const data = iso(parto.data), litrosCrias = 2, unidades = 2;
  const litros = crias.length * litrosCrias + unidades * 2;
  const retirada = await c.registro('bezerreiro:retirada', id => prisma.loteColostro.findFirst({ where: id ? { id } : { partoId, primeiraRetirada: true, status: { not: 'ESTORNADO' } } }), () => registrarRetiradaColostro({
    chave: chave('bezerreiro:retirada'), propriedadeId, partoId, data, horarioEstimado: false, primeiraRetirada: true, quantidadeLitros: litros,
    producao: { tipo: 'NOVA', posicaoId: posicoes[2].posicaoId, parcela: { recipiente: 'Balde de colostro DEV-001', versaoEsperada: 0, litros, natureza: 'COLOSTRO', animaisOrigem: [parto.animalId], responsavel: RESPONSAVEL, observacao: AVISO, primeiraOrdenhaColostro: true } },
    responsavel: RESPONSAVEL, observacao: AVISO,
  }, uid));
  const loteId = String(retirada.id);
  await c.acao('bezerreiro:retirada:confirmar', async () => (await prisma.loteColostro.findUniqueOrThrow({ where: { id: loteId } })).status === 'CONFIRMADO', async () => {
    const lote = await prisma.loteColostro.findUniqueOrThrow({ where: { id: loteId } });
    await confirmarRetiradaColostro(loteId, { chave: chave('bezerreiro:retirada:confirmar'), propriedadeId, versaoEsperada: lote.versao, produtoId: c.id(ref('produto:colostro')), motivoNatureza: 'Primeira ordenha demonstrativa do parto gemelar.' }, uid);
  });
  await c.acao('bezerreiro:colostro:destinar', async () => !!await prisma.destinacaoColostro.findFirst({ where: { origem: { loteColostroId: loteId } } }), async () => {
    const origem = await prisma.origemColostro.findFirstOrThrow({ where: { loteColostroId: loteId } });
    await destinarColostro(origem.id, { chave: chave('bezerreiro:colostro:destinar'), propriedadeId, versaoEsperada: origem.versao, data, horarioEstimado: false,
      crias: crias.map(cria => ({ criaId: cria.id, quantidadeLitros: litrosCrias, tipo: 'FRESCO' as const, forma: 'MAMADEIRA' as const })),
      unidades: Array.from({ length: unidades }, (_, i) => ({ codigo: `BC-DEV001-${i + 1}` })), responsavel: RESPONSAVEL, observacao: AVISO,
      excecaoBrix: { motivo: 'Brix não medido nesta demonstração; exceção explícita.', responsavel: RESPONSAVEL } }, uid);
  });

  // O lote Crias vira bezerreiro: as localizações atuais são regularizadas como participações.
  const lote = c.id('lote:Crias');
  const perfil = await c.registro('bezerreiro:perfil', id => prisma.perfilBezerreiro.findFirst({ where: id ? { id } : { loteId: lote } }), async () => {
    const locais = await prisma.localizacaoAnimal.findMany({ where: { loteId: lote, ate: null } });
    return registrarPerfil({ chave: chave('bezerreiro:perfil'), propriedadeId, loteId: lote, regularizacao: { motivo: 'Regularização demonstrativa das crias já no lote.', localizacoes: locais.map(l => ({ id: l.id, animalId: l.animalId, desde: iso(l.desde) })) } }, uid);
  });
  const perfilId = String(perfil.id);
  for (const p of await prisma.participacaoBezerreiro.findMany({ where: { perfilId, ate: null }, orderBy: { desde: 'asc' } })) {
    await c.acao(`bezerreiro:fase:${p.animalId}`, async () => !!await prisma.periodoFaseBezerreiro.findFirst({ where: { participacaoId: p.id } }), () => mudarFase(p.id, {
      chave: chave(`bezerreiro:fase:${p.animalId}`), propriedadeId, versaoEsperada: p.versao, faseVersaoId: fase.id, desde: iso(p.desde), motivo: 'Programação inicial demonstrativa.' }, uid));
  }

  // Ofertas de hoje, sem horário: a data-base já tem fechamento de Nutrição das crias e o leite tem movimentos até hoje.
  // Manhã conforme o previsto; tarde abaixo do previsto, justificada.
  // Em uma seed nova, hoje pode coincidir com o fechamento anterior: estas ofertas são consumo adicional explícito.
  const hoje = iso(hojeFazendaDate());
  for (const [ordem, fator] of [[0, 1], [1, 0.8]] as const) {
    const nome = `bezerreiro:oferta:${ordem}`;
    await c.acao(nome, async () => !!await prisma.ofertaBezerreiro.findFirst({ where: { perfilId, data: new Date(`${hoje}T00:00:00Z`), ofertaProgramadaId: fase.ofertas[ordem].id, status: 'CONFIRMADO' } }), async () => {
      const previa = await consultarPrevisao(propriedadeId, consultaSchema.parse({ data: hoje, perfilId }));
      const sobreposicoes = await prisma.$transaction(tx => fechamentosSobrepostosTx(tx, propriedadeId, new Date(`${hoje}T00:00:00Z`), previa.grupos.flatMap(g => g.participantes.map(p => p.animalId))));
      const grupos = previa.grupos.map(g => {
        const previsto = g.participantes.reduce((n, p) => n + Number(p.litrosDia) * PERCENTUAL_OFERTA[ordem] / 100, 0);
        const ids = new Set(g.participantes.map(p => p.animalId));
        const fechamentos = sobreposicoes.filter(f => f.animalIds.some(id => ids.has(id)));
        const motivos = [
          ...(fechamentos.length ? [`Oferta demonstrativa adicional ao consumo já registrado na Nutrição; não substitui o fechamento ${fechamentos.map(f => f.fechamentoId).join(', ').slice(0, 200)}.`] : []),
          ...(fator === 1 ? [] : ['Sobra no balde da tarde; consumo abaixo do previsto.']),
        ];
        return { coleiraId: g.coleiraId, quantidadeLitros: (previsto * fator).toFixed(3), ...(fechamentos.length ? { consumoAdicional: true } : {}), ...(motivos.length ? { justificativa: motivos.join(' ') } : {}) };
      }).filter(g => Number(g.quantidadeLitros) > 0);
      if (!grupos.length) throw new Error('Bezerreiro sem participantes hoje.');
      await confirmarOferta({ chave: chave(nome), propriedadeId, perfilId, contextoToken: previa.contextoToken, data: hoje, horarioEstimado: false, ocorridoEm: null,
        ofertaProgramadaId: fase.ofertas[ordem].id, responsavel: RESPONSAVEL, observacao: AVISO, grupos }, uid);
    });
  }
}
