import { prisma } from '../../src/db.js';
import { criarRegra, previaRegra, ativarRegra, type RegraAlertaInput } from '../../src/services/pecuaria/sanidade/alertas/regras.js';
import { avaliarAlertasTemporais } from '../../src/services/pecuaria/sanidade/alertas/avaliador.js';
import { decidirNecessidade } from '../../src/services/pecuaria/sanidade/alertas/decisoes.js';
import { cadastrarProgramacao } from '../../src/services/pecuaria/sanidade/programacoes/consulta.js';
import { previaAtivacaoProgramacao, ativarProgramacao } from '../../src/services/pecuaria/sanidade/programacoes/ativacao.js';
import type { CadastroProgramacao } from '../../src/services/pecuaria/sanidade/programacoes/schemas.js';
import { criarAplicacao } from '../../src/services/pecuaria/sanidade/aplicacoes.js';
import { hojeFazendaDate } from '../../src/services/pecuaria/rebanho/regras.js';
import { chave, dia, iso, type Contexto } from './contexto.js';
import { AVISO } from './rebanho.js';

const ABERTAS = ['PROXIMO', 'PENDENTE', 'ADIADO'];

/** Regras, programações e alertas publicados pelo mesmo avaliador do cron; decisões usam o fluxo idempotente da interface. */
export async function alertasSanitarios(c: Contexto) {
  const uid = c.usuarioId, s = c.sitioIds;
  const regras: [string, RegraAlertaInput][] = [
    ['bezerras', { nome: 'Primeira vacina de bezerras (demonstrativa)', gatilho: 'IDADE', idadeMeses: 2, dataFixa: null, idadeMinimaMeses: null, idadeMaximaMeses: 12, sexo: 'F',
      produtoId: c.id('produto:vacina'), protocoloId: null, tipoAplicacaoId: c.id('aplicacao:Vacina'), cuidado: 'Primeira dose sintética',
      propriedadeIds: [s.principal, s.test], antecedenciaDias: 60, prazoDias: 30, vigencia: c.dias(-30), orientacao: AVISO }],
    ['vermifugo', { nome: 'Vermifugação de novilhas arrendadas (demonstrativa)', gatilho: 'DATA_FIXA', idadeMeses: null, dataFixa: c.dias(20), idadeMinimaMeses: 12, idadeMaximaMeses: null, sexo: null,
      produtoId: c.id('produto:vermifugo'), protocoloId: null, tipoAplicacaoId: c.id('aplicacao:Vermífugo'), cuidado: 'Dose sintética única',
      propriedadeIds: [s.arrendado], antecedenciaDias: 30, prazoDias: 10, vigencia: c.dias(-10), orientacao: AVISO }],
  ];
  for (const [ref, input] of regras) {
    const nome = `regra-alerta:${ref}`;
    await c.registro(nome, id => prisma.regraAlertaSanitario.findFirst({ where: id ? { id } : { nome: input.nome } }), () => criarRegra(input, uid));
    await c.acao(`${nome}:ativar`, async () => (await prisma.regraAlertaSanitario.findUniqueOrThrow({ where: { id: c.id(nome) } })).ativo, async () => {
      const previa = await previaRegra(c.id(nome));
      await ativarRegra(c.id(nome), { base: previa.base, revisao: previa.revisao }, uid);
    });
  }

  const mes = Number(c.dataBase.slice(5, 7));
  const programacoes: [string, CadastroProgramacao, boolean][] = [
    ['campanha', { propriedadeId: s.principal, nome: 'Campanha anual de vacinação (demonstrativa)', tipo: 'VACINACAO', meses: [mes, (mes % 12) + 1], ano: null,
      vigenciaInicio: c.mes(0, 1), vigenciaFim: null, precisao: 'MES', dia: null, recorrencia: 'CAMPANHA_ANUAL', produtoId: c.id('produto:vacina-reforco'), procedimento: null,
      publico: { sexo: 'F', idadeMinimaMeses: 12 }, publicoConferido: true, fonte: 'Calendário sintético de teste', observacao: AVISO, sujeitoTipo: 'ANIMAL',
      executor: 'APLICACAO', tipoExameId: null, antecedenciaDias: 0, regraEquivalenteId: null }, true],
    ['exame', { propriedadeId: s.test, nome: 'Verificação de brucelose do rebanho test (demonstrativa)', tipo: 'VERIFICACAO', meses: [(mes % 12) + 1], ano: Number(c.mes(1, 1).slice(0, 4)),
      vigenciaInicio: c.mes(0, 1), vigenciaFim: null, precisao: 'DIA', dia: 10, recorrencia: 'SEM_REPETICAO', produtoId: null, procedimento: 'Coleta sintética para exame',
      publico: { idadeMinimaMeses: 12 }, publicoConferido: true, fonte: null, observacao: AVISO, sujeitoTipo: 'ANIMAL',
      executor: 'EXAME_ANIMAL', tipoExameId: c.id('exame:Brucelose'), antecedenciaDias: 15, regraEquivalenteId: null }, true],
    // Rascunho: o público ainda não foi conferido e a tela mostra a pendência de ativação.
    ['rascunho', { propriedadeId: s.arrendado, nome: 'Vermifugação semestral (rascunho demonstrativo)', tipo: 'VERMIFUGACAO', meses: [3, 9], ano: null,
      vigenciaInicio: null, vigenciaFim: null, precisao: 'DIA', dia: 15, recorrencia: 'JANELA_ELEGIBILIDADE', produtoId: c.id('produto:vermifugo'), procedimento: null,
      publico: { criterioPendente: 'Confirmar com o veterinário a faixa de peso.' }, publicoConferido: false, fonte: null, observacao: AVISO, sujeitoTipo: 'ANIMAL',
      executor: 'APLICACAO', tipoExameId: null, antecedenciaDias: 7, regraEquivalenteId: null }, false],
  ];
  for (const [ref, input, ativar] of programacoes) {
    const nome = `programacao-sanitaria:${ref}`;
    await c.registro(nome, id => prisma.programacaoSanitaria.findFirst({ where: id ? { id } : { nome: input.nome, propriedadeId: input.propriedadeId } }), () => cadastrarProgramacao(input, uid));
    if (ativar) await c.acao(`${nome}:ativar`, async () => (await prisma.programacaoSanitaria.findUniqueOrThrow({ where: { id: c.id(nome) } })).ativo, async () => {
      const previa = await previaAtivacaoProgramacao(c.id(nome), input.propriedadeId);
      await ativarProgramacao(c.id(nome), input.propriedadeId, { revisao: previa.revisao, chavePrevia: previa.chavePrevia }, uid);
    });
  }

  // Mesmo produtor do cron: publica necessidades e alertas sem fabricar linhas diretamente.
  await c.acao('alertas:avaliar', async () => false, async () => {
    for (let i = 0; i < 20; i++) if ((await avaliarAlertasTemporais(prisma, new Date(), 50)).estado === 'CONCLUIDO') return;
    throw new Error('Avaliação sanitária não concluiu.');
  });

  const necessidades = await prisma.necessidadeSanitaria.findMany({ where: { regraId: c.id('regra-alerta:bezerras'), alertaId: { not: null } }, orderBy: { animalId: 'asc' } });
  const conferencia = necessidades.find(n => n.situacao === 'CONFERENCIA_INICIAL');
  const abertas = necessidades.filter(n => ABERTAS.includes(n.situacao));
  const decidir = async (ref: string, n: typeof necessidades[number] | undefined, extra: Record<string, unknown>) => {
    if (!n) return;
    await c.acao(`alerta:${ref}`, async () => false, () => decidirNecessidade({ chave: chave(`alerta:${ref}`), alertaId: n.alertaId, animalId: n.animalId, propriedadeId: n.propriedadeId, revisao: n.revisao, ...extra }, uid));
  };
  await decidir('confirmar', conferencia, { acao: 'CONFIRMAR_NECESSIDADE', motivo: 'Conferência demonstrativa da necessidade inicial.' });
  await decidir('adiar', abertas[1], { acao: 'ADIAR', novaData: iso(new Date(hojeFazendaDate().getTime() + 7 * 864e5)), motivo: 'Adiamento demonstrativo por manejo do lote.' });
  await decidir('dispensar', abertas[2], { acao: 'DISPENSAR', motivo: 'Dispensa demonstrativa: dose registrada fora do sistema.' });
  const atendida = abertas[0];
  const data = iso(hojeFazendaDate());
  if (atendida) await c.registro('fato:aplicacao:alerta', id => prisma.aplicacaoProduto.findFirst({ where: id ? { id } : { animalId: atendida.animalId, produtoId: c.id('produto:vacina'), data: dia(data) } }), async () => {
    const p = await prisma.produto.findUniqueOrThrow({ where: { id: c.id('produto:vacina') } });
    const sitio = atendida.propriedadeId === s.principal ? 'Principal' : 'Test';
    return criarAplicacao({ chave: chave('aplicacao:alerta'), animalId: atendida.animalId, propriedadeId: atendida.propriedadeId, data, aplicadaEm: `${data}T12:00:00Z`,
      produtoId: p.id, nomeProdutoAplicado: p.nome, origemInsumo: 'BAIXA_ESTOQUE', tipoAplicacaoId: c.id('aplicacao:Vacina'), dose: '2', unidadeDose: 'ML', via: 'Subcutânea',
      ...(p.rastrearPartidas ? { partidaId: c.id(`partida:${sitio}:vacina`) } : {}), estadoCarenciaLeite: 'INFORMADO', estadoCarenciaCarne: 'INFORMADO', carenciaLeiteHoras: 0, carenciaCarneHoras: 0,
      referenciaCarencia: AVISO, alertaId: atendida.alertaId!, alertaRevisao: atendida.revisao, confirmarCuidadoAlerta: true }, uid);
  });
}
