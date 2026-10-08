import { prisma } from '../../src/db.js';
import { criarOcorrencia, encerrarOcorrencia } from '../../src/services/pecuaria/sanidade/ocorrencias.js';
import { criarProtocolo, publicarProtocolo, dispensarTarefa } from '../../src/services/pecuaria/sanidade/protocolos.js';
import { criarRodada } from '../../src/services/pecuaria/sanidade/rodadas.js';
import { criarAplicacao, type AplicacaoInput } from '../../src/services/pecuaria/sanidade/aplicacoes.js';
import { registrarExame } from '../../src/services/pecuaria/sanidade/exames.js';
import { salvarRateio } from '../../src/services/pecuaria/sanidade/rateios.js';
import { chave, dia, type Contexto } from './contexto.js';
import { obterPartida } from './financeiro.js';

export async function sanidade(c: Contexto) {
  const uid = c.numero('usuario:dono');
  for (const [ref, nome, produto, tipo] of [
    ['vacina', 'Vacinação demonstrativa', 'vacina', 'Vacina'], ['verminose', 'Controle de verminose demonstrativo', 'vermifugo', 'Vermífugo'],
    ['acompanhamento', 'Acompanhamento demonstrativo', 'medicamento', 'Tratamento'], ['rascunho', 'Protocolo em estudo — demonstração', 'vacina', 'Vacina'],
  ] as const) {
    await c.registro(`protocolo:${ref}`, id => prisma.protocoloSanitario.findFirst({ where: id ? { id } : { nome } }), () => criarProtocolo({ nome, descricao: 'Produtos, doses, intervalos e parâmetros fictícios: não são recomendação veterinária.', etapas: [
      { diaRelativo: 0, tipo: 'APLICACAO', produtoId: c.id(`produto:${produto}`), tipoAplicacaoId: c.id(`aplicacao:${tipo}`), dose: 2, unidade: 'ML', via: 'Intramuscular' },
      { diaRelativo: 7, tipo: 'EXAME', tipoExameId: c.id(`exame:${ref === 'acompanhamento' ? 'Cetose subclínica' : 'Triagem demonstrativa'}`) },
      { diaRelativo: 45, tipo: 'EXAME', tipoExameId: c.id('exame:Brucelose') },
    ] }, uid));
    if (ref !== 'rascunho') await c.acao(`publicar:protocolo:${ref}`, async () => !!(await prisma.protocoloSanitario.findUniqueOrThrow({ where: { id: c.id(`protocolo:${ref}`) } })).publicadoEm, () => publicarProtocolo(c.id(`protocolo:${ref}`), uid));
  }
  for (const [ref, n, sitio, doenca, inicio] of [
    ['encerrada', 3, 'Principal', 'Mastite', c.mes(-1, 4)], ['aberta', 4, 'Principal', 'Mastite', c.dias(-3)], ['destino', 16, 'Destino', 'Doenças parasitárias', c.mes(-1, 5)],
  ] as const) await c.registro(`ocorrencia:${ref}`, id => prisma.ocorrenciaSanitaria.findFirst({ where: id ? { id } : { animalId: c.id(`animal:${n}`), inicio: dia(inicio), doencaId: c.id(`doenca:${doenca}`) } }), () => criarOcorrencia({ animalId: c.id(`animal:${n}`), propriedadeId: c.numero(`sitio:${sitio}`), doencaId: c.id(`doenca:${doenca}`), inicio, observacao: 'Ocorrência fictícia seedatev3.' }, uid));

  // Rodadas agrupam execuções individuais; mantém snapshots do planejado e do realizado.
  for (const [ref, protocolo, sitio, inicio, participantes] of [
    ['vacinacao-principal', 'vacina', 'Principal', c.mes(-1, 10), [1, 2, 5]],
    ['verminose-destino', 'verminose', 'Destino', c.mes(-1, 10), [14, 15, 16]],
    ['acompanhamento', 'acompanhamento', 'Principal', c.mes(-1, 5), [3]],
    ['futura', 'vacina', 'Destino', c.dias(7), [7, 14]],
  ] as const) {
    const nome = `seedatev3 — ${ref}`;
    await c.registro(`rodada:${ref}`, id => prisma.rodadaProtocoloSanitario.findFirst({ where: id ? { id } : { nome } }), async () => {
      await criarRodada({ chave: chave(`rodada:${ref}`), nome, protocoloId: c.id(`protocolo:${protocolo}`), propriedadeId: c.numero(`sitio:${sitio}`), inicioReferencia: inicio,
        itens: participantes.map(n => ({ animalId: c.id(`animal:${n}`), ...(ref === 'acompanhamento' ? { ocorrenciaId: c.id('ocorrencia:encerrada'), operacaoServicoId: c.id('operacao:servico-veterinario') } : {}) })),
      }, uid);
      return prisma.rodadaProtocoloSanitario.findFirstOrThrow({ where: { nome } });
    });
  }
  const tarefa = async (rodada: string, n: number, ordem: number) => prisma.tarefaSanitaria.findFirstOrThrow({ where: { execucao: { rodadaId: c.id(`rodada:${rodada}`), animalId: c.id(`animal:${n}`) }, etapa: { ordem } } });
  const aplicar = async (ref: string, n: number, sitio: string, data: string, produto: string | null, extra: Partial<AplicacaoInput> = {}) => {
    const p = produto ? await prisma.produto.findUniqueOrThrow({ where: { id: c.id(`produto:${produto}`) } }) : null;
    const partidaId = p?.rastrearPartidas && produto ? await obterPartida(c, produto) : null;
    await c.registro(`fato:aplicacao:${ref}`, id => prisma.aplicacaoProduto.findFirst({ where: id ? { id } : { animalId: c.id(`animal:${n}`), data: dia(data), nomeProdutoAplicado: p?.nome ?? 'Medicamento incluído no serviço demonstrativo' } }), () => criarAplicacao({
      chave: chave(`aplicacao:${ref}`), animalId: c.id(`animal:${n}`), propriedadeId: c.numero(`sitio:${sitio}`), data, aplicadaEm: `${data}T13:00:00.000Z`, responsavel: 'Equipe demonstrativa',
      tipoAplicacaoId: c.id(`aplicacao:${produto === 'vacina' ? 'Vacina' : produto === 'vermifugo' ? 'Vermífugo' : 'Tratamento'}`),
      origemInsumo: 'BAIXA_ESTOQUE', nomeProdutoAplicado: p?.nome ?? 'Medicamento incluído no serviço demonstrativo', produtoId: p?.id,
      dose: '2', unidadeDose: 'ML', estadoCarenciaLeite: 'INFORMADO', estadoCarenciaCarne: 'INFORMADO', carenciaLeiteHoras: produto === 'medicamento' ? 96 : 0, carenciaCarneHoras: 48,
      referenciaCarencia: 'Parâmetros exclusivamente demonstrativos.', partidaId, via: 'Intramuscular', ...extra,
    }, uid));
  };
  const vacinacao = await tarefa('vacinacao-principal', 1, 1);
  await aplicar('vacina', 1, 'Principal', c.mes(-1, 10), 'vacina', { tarefaId: vacinacao.id });
  const desvio = await tarefa('vacinacao-principal', 2, 1);
  await aplicar('desvio', 2, 'Principal', c.mes(-1, 11), 'vacina', { tarefaId: desvio.id, dose: '3', desvio: { motivo: 'Dose e data revisadas no cenário fictício para demonstrar auditoria.' } });
  const dispensada = await tarefa('vacinacao-principal', 5, 1);
  await c.acao('dispensar:tarefa', async () => !!(await prisma.tarefaSanitaria.findUniqueOrThrow({ where: { id: dispensada.id } })).dispensadaEm, () => dispensarTarefa(dispensada.id, 'Animal indisponível no manejo demonstrativo.', uid, c.numero('sitio:Principal')));
  const verminose = await tarefa('verminose-destino', 14, 1);
  await aplicar('vermifugo-destino', 14, 'Destino', c.mes(-1, 10), 'vermifugo', { tarefaId: verminose.id });
  const acompanhamento = await tarefa('acompanhamento', 3, 1);
  await aplicar('tratamento-encerrado', 3, 'Principal', c.mes(-1, 5), 'medicamento', { tarefaId: acompanhamento.id, ocorrenciaId: c.id('ocorrencia:encerrada') });
  await aplicar('carencia-ativa', 4, 'Principal', c.dias(-1), 'medicamento', { ocorrenciaId: c.id('ocorrencia:aberta') });
  await aplicar('servico', 5, 'Principal', c.mes(-1, 12), null, { origemInsumo: 'INCLUSO_SERVICO', operacaoServicoId: c.id('operacao:servico-veterinario'), partidaId: null });
  const direto = await prisma.itemOperacao.findFirstOrThrow({ where: { operacaoId: c.id('operacao:compra-direta'), produtoId: c.id('produto:direto') } });
  await aplicar('direto', 8, 'Principal', c.mes(-1, 13), 'direto', { origemInsumo: 'COMPRA_CONSUMO_DIRETO', itemCompraDiretaId: direto.id });
  await aplicar('destino-ocorrencia', 16, 'Destino', c.mes(-1, 11), 'vermifugo', { ocorrenciaId: c.id('ocorrencia:destino') });
  const servico = await prisma.aplicacaoProduto.findUniqueOrThrow({ where: { id: c.id('fato:aplicacao:servico') } });
  await c.acao('rateio:servico', async () => (await prisma.aplicacaoProduto.findUniqueOrThrow({ where: { id: servico.id } })).valorServicoAtribuido !== null, () => salvarRateio({ servicoId: c.id('operacao:servico-veterinario'), propriedadeId: c.numero('sitio:Principal'), tipo: 'APLICACAO', id: servico.id, valor: '120', motivo: 'Parcela do serviço existente; não gera nova despesa.' }, uid));

  const tarefaNumero = await tarefa('acompanhamento', 3, 2);
  const tarefaOpcao = await tarefa('verminose-destino', 14, 2);
  for (const [ref, n, sitio, tipo, data, resultado, tarefaId, ocorrenciaId] of [
    ['numero', 3, 'Principal', 'Cetose subclínica', c.mes(-1, 12), { resultadoNumero: 0.8 }, tarefaNumero.id, c.id('ocorrencia:encerrada')],
    ['texto', 3, 'Principal', 'Brucelose', c.mes(-1, 13), { resultadoTexto: 'Resultado fictício: acompanhamento encerrado.' }, null, c.id('ocorrencia:encerrada')],
    ['opcao', 14, 'Destino', 'Triagem demonstrativa', c.mes(-1, 17), { resultadoOpcao: 'Negativo' }, tarefaOpcao.id, null],
    ['pendente', 4, 'Principal', 'Hipocalcemia', c.dias(-1), {}, null, c.id('ocorrencia:aberta')],
  ] as const) await c.registro(`fato:exame:${ref}`, id => prisma.exameAnimal.findFirst({ where: id ? { id } : { animalId: c.id(`animal:${n}`), tipoExameId: c.id(`exame:${tipo}`), data: dia(data) } }), () => registrarExame({ chave: chave(`exame:${ref}`), animalId: c.id(`animal:${n}`), propriedadeId: c.numero(`sitio:${sitio}`), tipoExameId: c.id(`exame:${tipo}`), data, ...resultado, tarefaId, ocorrenciaId, responsavel: 'Laboratório demonstrativo' }, uid));
  await c.acao('encerrar:ocorrencia', async () => !!(await prisma.ocorrenciaSanitaria.findUniqueOrThrow({ where: { id: c.id('ocorrencia:encerrada') } })).fim, () => encerrarOcorrencia(c.id('ocorrencia:encerrada'), c.numero('sitio:Principal'), { fim: c.mes(-1, 15), desfecho: 'Recuperação no cenário demonstrativo.' }, uid));
}
