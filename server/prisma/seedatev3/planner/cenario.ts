import assert from 'node:assert/strict';
import { prisma } from '../../../src/db.js';
import { cadastrar } from '../../../src/services/pecuaria/rebanho/animais.js';
import { cadastrarAnimalSchema } from '../../../src/services/pecuaria/rebanho/schemas.js';
import { criarLote } from '../../../src/services/pecuaria/rebanho/lotes.js';
import { criarMaterialGenetico } from '../../../src/services/pecuaria/rebanho/materialGenetico.js';
import { criarProduto } from '../../../src/services/estoque/produtos.js';
import { produtoSchema } from '../../../src/services/estoque/produtos.schemas.js';
import { registrarMovimento } from '../../../src/services/estoque/estoque.js';
import * as iatf from '../../../src/services/pecuaria/reproducao/iatf.js';
import { criarTentativa, criarAvaliacao, criarParto, criarSituacaoInicial, criarRestricao } from '../../../src/services/pecuaria/reproducao/registros.js';
import { registrarLactacaoHistorica } from '../../../src/services/pecuaria/reproducao/lactacoes.js';
import { registrarColostro } from '../../../src/services/pecuaria/reproducao/colostro.js';
import { partoSchema, protocoloSchema, programacaoSchema, avaliacaoSchema } from '../../../src/services/pecuaria/reproducao/schemas.js';
import * as sanitario from '../../../src/services/pecuaria/sanidade/protocolos.js';
import { criarRodada } from '../../../src/services/pecuaria/sanidade/rodadas.js';
import { criarAplicacao } from '../../../src/services/pecuaria/sanidade/aplicacoes.js';
import { registrarExame } from '../../../src/services/pecuaria/sanidade/exames.js';
import { criarVisita, imprimirVisita } from '../../../src/services/pecuaria/reproducao/visitas.js';
import { criarSelecao, criarSelecaoSchema } from '../../../src/services/pecuaria/reproducao/selecoes.js';
import { consultarPlanner, previaGrupoPlanner, incluirGrupoPlanner } from '../../../src/services/pecuaria/reproducao/planner.js';
import { chave, dia, type Contexto } from '../contexto.js';

const prefixo = 'planner-v1:';
const ref = (s: string) => `${prefixo}${s}`;
const key = (s: string) => chave(ref(s));
const faixa = (de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, i) => de + i);
const aviso = 'Cenário fictício PLANNER. Produtos, volumes e intervalos apenas para testar software; não são prescrição.';
const brinco = (n: number) => `PLN-${String(n).padStart(3, '0')}`;
const animal = (c: Contexto, n: number) => c.id(ref(`animal:${n}`));
const sitio = (c: Contexto, n = 1) => c.numero(`sitio:${n > 192 ? 'Destino' : 'Principal'}`);
const uid = (c: Contexto) => c.numero('usuario:dono');

// As ações têm chave própria no banco e no manifesto: queda entre commit e gravação
// local é recuperada. Uma ação já concluída nunca restaura alterações feitas na UI.
async function acao(c: Contexto, nome: string, executar: () => Promise<unknown>) {
  await c.acao(ref(nome), async () => !!await prisma.requisicaoPecuaria.findUnique({ where: { chave: key(nome) } }), executar);
}
async function rebanho(c: Contexto) {
  for (const [nome, propriedadeId] of [
    ['Diagnóstico coletivo', sitio(c)], ['IATF em andamento', sitio(c)], ['Individuais e histórico', sitio(c)],
    ['Maternidade', sitio(c)], ['Secas e histórico desconhecido', sitio(c)], ['Novilhas', sitio(c)], ['Cria', sitio(c)],
    ['Sanidade destino', sitio(c, 200)],
  ] as const) await c.registro(ref(`lote:${nome}`), id => prisma.lote.findFirst({ where: id ? { id } : { nome: `PLANNER · ${nome}`, propriedadeId } }), () => criarLote({ nome: `PLANNER · ${nome}`, propriedadeId, centroCustoId: c.id('centro:Pecuária'), observacao: aviso }, uid(c)));
  for (const n of faixa(1, 200)) {
    const lote = n <= 120 ? 'Diagnóstico coletivo' : n <= 145 ? 'IATF em andamento' : n <= 160 ? 'Individuais e histórico' : n <= 170 ? 'Maternidade' : n <= 180 ? 'Secas e histórico desconhecido' : n <= 192 ? 'Novilhas' : 'Sanidade destino';
    await c.registro(ref(`animal:${n}`), id => prisma.animal.findFirst({ where: id ? { id } : { brinco: brinco(n) } }), () => cadastrar(cadastrarAnimalSchema.parse({
      brinco: brinco(n), nome: `PLANNER ${String(n).padStart(3, '0')}`, sexo: n > 192 ? 'M' : 'F',
      dataNascimento: c.dias(n <= 180 ? -1800 - n : -700 - n), dataEntrada: c.dias(-600),
      origem: 'COMPRADO', partosAntesDaEntrada: n <= 180 ? 2 : 0,
      propriedadeId: sitio(c, n), loteId: c.id(ref(`lote:${lote}`)), aptidao: n > 192 ? 'CORTE' : 'LEITE',
      papelReprodutivo: 'NENHUM', composicao: [{ racaId: c.id(n % 3 === 0 ? 'raca:GO' : 'raca:HO'), fracao64: 64 }], observacao: aviso,
    }), uid(c), { nascimentoHistorico: true }));
    if (n <= 192) await acao(c, `inicial:${n}`, () => criarSituacaoInicial({ chave: key(`inicial:${n}`), animalId: animal(c, n), propriedadeId: sitio(c, n), data: c.dias(-500), situacao: 'VAZIA', observacao: aviso }, uid(c)));
    if (n <= 160 || (n >= 171 && n <= 174)) await acao(c, `lactacao:${n}`, () => registrarLactacaoHistorica({
      chave: key(`lactacao:${n}`), animalId: animal(c, n), propriedadeId: sitio(c, n), inicio: c.dias(-80 - n % 121),
      ...(n >= 171 ? { encerradaEm: c.dias(-20) } : {}), motivo: 'Intervalo histórico fictício para DEL e secagem do cenário PLANNER.',
    }, uid(c)));
    if (n % 25 === 0) process.stdout.write(`[planner] ${n}/200 animais preparados\n`);
  }
}
async function catalogos(c: Contexto) {
  await c.registro(ref('produto:sanitario'), id => prisma.produto.findFirst({ where: id ? { id } : { nome: 'PLANNER · Insumo sanitário fictício' } }), () => criarProduto(produtoSchema.parse({
    nome: 'PLANNER · Insumo sanitário fictício', unidade: 'ML', categoriaId: c.id('categoria:Medicamentos veterinários'),
    usoSanitario: true, rastrearPartidas: false, centroCustoIds: [c.id('centro:Pecuária')], fornecedorIds: [],
    perfilSanitario: { carenciaLeiteHoras: 0, carenciaCarneHoras: 0, viaPadrao: 'Via demonstrativa', referenciaTecnica: aviso },
  }), uid(c)));
  for (const [tipo, nome] of [['SEMEN', 'Sêmen fictício'], ['EMBRIAO', 'Embrião fictício']] as const) {
    const r = tipo === 'SEMEN' ? 'semen' : 'embriao';
    await c.registro(ref(`material:${r}`), id => prisma.materialGenetico.findFirst({ where: id ? { id } : { produto: { nome: `PLANNER · ${nome}` } } }), () => criarMaterialGenetico({
      tipo, touro: { tipo: 'EXTERNO', id: c.id('genitor:touro') },
      ...(tipo === 'SEMEN' ? { tipoSemen: 'CONVENCIONAL' as const } : { doadora: { tipo: 'EXTERNO' as const, id: c.id('genitor:matriz') } }),
      produto: { nome: `PLANNER · ${nome}`, categoriaId: c.id('categoria:Sêmen e embriões'), centroCustoIds: [c.id('centro:Pecuária')], fornecedorIds: [] }, observacao: aviso,
    }, uid(c)));
    const material = await prisma.materialGenetico.findUniqueOrThrow({ where: { id: c.id(ref(`material:${r}`)) } });
    c.manifesto.ids[ref(`produto:${r}`)] = material.produtoId; await c.salvar();
  }
  // Ajustes somente dos produtos exclusivos do cenário. Sem alterar saldo alheio.
  for (const r of ['sanitario', 'semen', 'embriao']) for (const propriedadeId of [sitio(c), sitio(c, 200)]) {
    const observacao = `PLANNER · estoque inicial ${r} · sítio ${propriedadeId}`;
    await c.registro(ref(`estoque:${r}:${propriedadeId}`), id => prisma.movimentoEstoque.findFirst({ where: id ? { id } : { produtoId: c.id(ref(`produto:${r}`)), propriedadeId, observacao } }), () => registrarMovimento({
      produtoId: c.id(ref(`produto:${r}`)), propriedadeId, centroCustoId: c.id('centro:Pecuária'), tipo: 'AJUSTE', quantidade: r === 'sanitario' ? 5000 : 500, custoUnitario: 1,
      data: c.dias(-500), observacao, usuarioId: uid(c),
    }));
  }
  const tentativa = { tipo: 'IA' as const, materialId: c.id(ref('material:semen')), quantidade: 1 };
  const protocolos = [
    { id: 'diagnostico', nome: 'Diagnóstico em grupo', etapas: [
      { nome: 'Preparação demonstrativa', tipo: 'MANEJO', intervalo: 0, unidade: 'DIAS' },
      { nome: 'Inseminação', tipo: 'TENTATIVA', intervalo: 10, unidade: 'DIAS', planoTentativa: tentativa },
      { nome: 'Diagnóstico de gestação', tipo: 'AVALIACAO', intervalo: 40, unidade: 'DIAS', planoAvaliacao: { tipo: 'DIAGNOSTICO' } },
    ] },
    { id: 'completo', nome: 'IATF com aplicação e retirada', etapas: [
      { nome: 'Aplicação demonstrativa', tipo: 'APLICACAO', intervalo: 0, unidade: 'DIAS', planoAplicacao: { produtoId: c.id(ref('produto:sanitario')), dose: '2', unidadeDose: 'ML', via: 'Via demonstrativa' } },
      { nome: 'Retirada', tipo: 'RETIRADA', intervalo: 7, unidade: 'DIAS' },
      { nome: 'Inseminação', tipo: 'TENTATIVA', intervalo: 10, unidade: 'DIAS', planoTentativa: tentativa },
      { nome: 'Diagnóstico', tipo: 'AVALIACAO', intervalo: 40, unidade: 'DIAS', planoAvaliacao: { tipo: 'DIAGNOSTICO' } },
    ] },
    { id: 'horas', nome: 'IATF com horário pendente', etapas: [
      { nome: 'Manejo inicial', tipo: 'MANEJO', intervalo: 0, unidade: 'DIAS' },
      { nome: 'Retirada após 48h', tipo: 'RETIRADA', intervalo: 48, unidade: 'HORAS' },
      { nome: 'Inseminação após 240h', tipo: 'TENTATIVA', intervalo: 240, unidade: 'HORAS', planoTentativa: tentativa },
    ] },
  ];
  for (const p of protocolos) await c.registro(ref(`protocolo:${p.id}`), id => prisma.protocolo.findFirst({ where: id ? { id } : { nome: `PLANNER · ${p.nome}` } }), () => iatf.criarProtocolo(protocoloSchema.parse({ nome: `PLANNER · ${p.nome}`, descricao: aviso, versao: 1, publicado: true, etapas: p.etapas }), uid(c)));
  for (const r of ['sanitario', 'triagem']) {
    await c.registro(ref(`protocolo:${r}`), id => prisma.protocolo.findFirst({ where: id ? { id } : { nome: `PLANNER · ${r === 'sanitario' ? 'Sanitário coletivo' : 'Triagem individual'}` } }), () => sanitario.criarProtocolo({
      nome: `PLANNER · ${r === 'sanitario' ? 'Sanitário coletivo' : 'Triagem individual'}`, descricao: aviso,
      etapas: [ ...(r === 'sanitario' ? [{ diaRelativo: 0, tipo: 'APLICACAO' as const, produtoId: c.id(ref('produto:sanitario')), tipoAplicacaoId: c.id('aplicacao:Tratamento'), dose: 2, unidade: 'ML', via: 'Via demonstrativa' }] : []),
        { diaRelativo: r === 'sanitario' ? 7 : 0, tipo: 'EXAME', tipoExameId: c.id('exame:Triagem demonstrativa') } ],
    }, uid(c)));
    await c.acao(ref(`publicar:${r}`), async () => !!(await prisma.protocolo.findUniqueOrThrow({ where: { id: c.id(ref(`protocolo:${r}`)) } })).publicado, () => sanitario.publicarProtocolo(c.id(ref(`protocolo:${r}`)), uid(c)));
  }
}
async function programar(c: Contexto, nome: string, protocolo: string, numeros: number[], inicio: number, iniciar = true) {
  const titulo = `PLANNER · ${nome}`;
  await c.registro(ref(`programacao:${nome}`), id => prisma.programacaoProtocolo.findFirst({ where: id ? { id } : { nome: titulo } }), () => iatf.criarProgramacao(programacaoSchema.parse({
    chave: key(`programacao:${nome}`), propriedadeId: sitio(c), protocoloId: c.id(ref(`protocolo:${protocolo}`)), nome: titulo, inicioPrevisto: c.dias(inicio),
    animais: numeros.slice(0, 100).map(n => ({ animalId: animal(c, n) })),
  }), uid(c)));
  const id = c.id(ref(`programacao:${nome}`));
  if (numeros.length > 100) await acao(c, `adicionar:${nome}`, () => iatf.adicionarParticipantes(id, { chave: key(`adicionar:${nome}`), propriedadeId: sitio(c), animais: numeros.slice(100).map(n => ({ animalId: animal(c, n), inicioPrevisto: c.dias(inicio) })) }, uid(c)));
  if (iniciar) for (const p of await prisma.participanteIatf.findMany({ where: { programacaoId: id } })) await c.acao(ref(`iniciar:${p.id}`), async () => !!(await prisma.participanteIatf.findUniqueOrThrow({ where: { id: p.id } })).inicioEfetivo, () => iatf.iniciarParticipante(p.id, sitio(c), c.dias(inicio), uid(c)));
  return id;
}
async function executarIatf(c: Contexto, programacaoId: string, ateEtapa: number) {
  for (const p of await prisma.participanteIatf.findMany({ where: { programacaoId } })) {
    const tarefas = await prisma.tarefaIatf.findMany({ where: { participanteId: p.id, etapa: { lte: ateEtapa } }, orderBy: { etapa: 'asc' } });
    for (const t of tarefas) {
      let dados: Record<string, unknown> = { observacao: aviso };
      if (t.tipo === 'APLICACAO') dados = {
        produtoId: c.id(ref('produto:sanitario')), nomeProdutoAplicado: 'PLANNER · Insumo sanitário fictício', origemInsumo: 'BAIXA_ESTOQUE',
        tipoAplicacaoId: c.id('aplicacao:Tratamento'), dose: '2', unidadeDose: 'ML', via: 'Via demonstrativa',
        estadoCarenciaLeite: 'INFORMADO', estadoCarenciaCarne: 'INFORMADO', carenciaLeiteHoras: 0, carenciaCarneHoras: 0,
        referenciaCarencia: aviso, responsavel: 'Equipe PLANNER',
      };
      if (t.tipo === 'TENTATIVA') dados = { tipo: 'IA', materialId: c.id(ref('material:semen')), origem: 'DOCUMENTADA', quantidade: 1, justificativaSemOrigem: 'Histórico fictício anterior à carga PLANNER; sem baixa retroativa de estoque.', observacao: aviso };
      if (t.tipo === 'AVALIACAO') {
        const tentativa = await prisma.tentativaReprodutiva.findFirstOrThrow({ where: { animalId: p.animalId, data: { lte: t.previstaEm } }, orderBy: { data: 'desc' } });
        const n = Number((await prisma.animal.findUniqueOrThrow({ where: { id: p.animalId } })).brinco!.split('-')[1]);
        dados = { resultado: n % 2 === 0 ? 'POSITIVO' : 'NEGATIVO', tentativaId: tentativa.id, observacao: aviso,
          ...(n % 2 ? { conduta: 'AGUARDAR', retornoEm: c.dias(n % 3 === 0 ? -2 : n % 3 === 1 ? 0 : 5) } : {}) };
      }
      await acao(c, `executar:${t.id}`, () => iatf.executarTarefa(t.id, { chave: key(`executar:${t.id}`), propriedadeId: sitio(c), realizadaEm: t.previstaEm.toISOString().slice(0, 10), dados }, uid(c)));
    }
  }
}
async function reproducao(c: Contexto) {
  const diagnostico = await programar(c, '120 animais para diagnóstico hoje', 'diagnostico', faixa(1, 120), -40);
  await executarIatf(c, diagnostico, 1);
  await programar(c, 'Início coletivo hoje', 'completo', faixa(121, 140), 0);
  const horas = await programar(c, 'Sem horário conhecido', 'horas', faixa(141, 145), -1);
  await executarIatf(c, horas, 0);
  for (const n of faixa(146, 150)) await programar(c, `Individual ${brinco(n)}`, 'completo', [n], -(n - 146));
  const historico = await programar(c, 'Histórico com todas as etapas realizadas', 'diagnostico', faixa(151, 160), -100);
  await executarIatf(c, historico, 2);
  // Também demonstra IA efetiva com baixa de estoque no mês atual (sem atingir período fechado).
  await acao(c, 'tentativa:estoque:180', () => criarTentativa({ chave: key('tentativa:estoque:180'), animalId: animal(c, 180), propriedadeId: sitio(c), data: c.dias(-1), tipo: 'IA', materialId: c.id(ref('material:semen')), origem: 'ESTOQUE', quantidade: 1, observacao: aviso }, uid(c)));
  // Reconfirmação e sexagem não abrem uma segunda gestação.
  for (const [n, resultado] of [[152, 'RECONFIRMACAO'], [154, 'SEXAGEM']] as const) {
    const gestacao = await prisma.gestacaoAnimal.findFirstOrThrow({ where: { animalId: animal(c, n), encerradaEm: null } });
    await acao(c, `avaliacao:${n}`, () => criarAvaliacao(avaliacaoSchema.parse({ chave: key(`avaliacao:${n}`), animalId: animal(c, n), propriedadeId: sitio(c), data: c.dias(-5), gestacaoId: gestacao.id, resultado, ...(resultado === 'SEXAGEM' ? { sexoFetal: 'F' } : {}), observacao: aviso }), uid(c)));
  }
  for (const n of [177, 178]) await acao(c, `restricao:${n}`, () => criarRestricao({ chave: key(`restricao:${n}`), animalId: animal(c, n), propriedadeId: sitio(c), data: c.dias(-3), tipo: n === 177 ? 'DESCARTE' : 'TEMPORARIA', acoes: ['IA', 'TE', 'COBERTURA', 'IATF'], motivo: 'Restrição fictícia PLANNER para testar seleção e disponibilidade.', ...(n === 178 ? { ate: c.dias(10) } : {}) }, uid(c)));
}
async function partos(c: Contexto) {
  for (const n of faixa(161, 170)) {
    const r = n === 170 ? 'embriao' : 'semen';
    await acao(c, `tentativa:parto:${n}`, () => criarTentativa({ chave: key(`tentativa:parto:${n}`), animalId: animal(c, n), propriedadeId: sitio(c), data: c.dias(-300 + n - 161), tipo: n === 170 ? 'TE' : 'IA', materialId: c.id(ref(`material:${r}`)), origem: 'DOCUMENTADA', quantidade: 1, justificativaSemOrigem: 'Histórico fictício PLANNER sem consumo retroativo de estoque.', observacao: aviso }, uid(c)));
    const tentativa = await prisma.tentativaReprodutiva.findFirstOrThrow({ where: { animalId: animal(c, n) }, orderBy: { data: 'asc' } });
    await acao(c, `prenhez:parto:${n}`, () => criarAvaliacao({ chave: key(`prenhez:parto:${n}`), animalId: animal(c, n), propriedadeId: sitio(c), data: c.dias(-260 + n - 161), resultado: 'POSITIVO', tentativaId: tentativa.id, observacao: aviso }, uid(c)));
    const gestacao = await prisma.gestacaoAnimal.findFirstOrThrow({ where: { animalId: animal(c, n) } });
    const data = c.dias(n - 171), aborto = n === 169, rp = n === 162 || n === 165;
    await acao(c, `parto:${n}`, () => criarParto(partoSchema.parse({
      chave: key(`parto:${n}`), animalId: animal(c, n), propriedadeId: sitio(c), data, gestacaoId: gestacao.id,
      desfecho: aborto ? 'ABORTO' : 'NASCIMENTO', iniciarLactacao: !aborto,
      dificuldade: n === 163, induzido: false, retencaoPlacenta: rp, responsavel: 'Equipe PLANNER', observacao: aviso,
      ...(n === 163 ? { assistenciaDescricao: 'Assistência fictícia para testar o registro detalhado de parto.' } : {}),
      ...(rp ? { ocorrenciaRetencao: { acao: 'CRIAR', doencaId: c.id('doenca:Retenção de placenta'), inicio: data, observacao: aviso } } : {}),
      pesoMatriz: { acao: 'REGISTRAR', data, pesoKg: 480 + n % 10 * 5 },
      escoreMatriz: { acao: 'REGISTRAR', data, valor: 3, escalaMin: 1, escalaMax: 5, escalaDescricao: 'Escala fictícia 1 a 5' },
      crias: aborto ? [] : Array.from({ length: n === 164 ? 2 : 1 }, (_, i) => ({ viva: n !== 168, sexo: i % 2 === 0 ? 'F' : 'M', aptidao: 'LEITE', brinco: n === 168 ? null : `PLN-CR-${n}-${i + 1}`, nome: `PLANNER cria ${n}.${i + 1}`, loteId: c.id(ref('lote:Cria')), pesoKg: 32 + n % 6 })),
    }), uid(c)));
    const parto = await prisma.partoAnimal.findFirstOrThrow({ where: { animalId: animal(c, n), data: dia(data) } });
    for (const cria of await prisma.criaParto.findMany({ where: { partoId: parto.id, viva: true } })) {
      await acao(c, `colostro:${cria.id}`, () => registrarColostro({ chave: key(`colostro:${cria.id}`), propriedadeId: sitio(c), criaId: cria.id, data, quantidade: 3, unidade: 'L', metodoQualidade: 'REFRATOMETRO_BRIX', qualidadeBrix: 23, tipo: 'FRESCO', forma: 'MAMADEIRA', responsavel: 'Equipe PLANNER', observacao: aviso }, uid(c)));
    }
  }
}
async function sanidade(c: Contexto) {
  for (const [nome, numeros, inicio] of [
    ['Sanitário inicia hoje', faixa(1, 20), 0], ['Sanitário exame hoje', faixa(21, 40), -7],
    ['Sanitário histórico realizado', faixa(171, 176), -90], ['Sanitário atrasado', faixa(181, 186), -3],
    ['Sanitário futuro', faixa(187, 192), 5], ['Sanitário outro sítio', faixa(193, 200), 0],
  ] as const) {
    const propriedadeId = sitio(c, numeros[0]);
    await c.registro(ref(`rodada:${nome}`), id => prisma.programacaoProtocolo.findFirst({ where: id ? { id } : { nome: `PLANNER · ${nome}` } }), async () => {
      await criarRodada({ chave: key(`rodada:${nome}`), nome: `PLANNER · ${nome}`, protocoloId: c.id(ref('protocolo:sanitario')), propriedadeId, inicioReferencia: c.dias(inicio), itens: numeros.map(n => ({ animalId: animal(c, n) })) }, uid(c));
      return prisma.programacaoProtocolo.findFirstOrThrow({ where: { nome: `PLANNER · ${nome}`, propriedadeId } });
    });
    if (inicio !== -7 && inicio !== -90) continue;
    for (const n of numeros) {
      const tarefas = await prisma.tarefaProtocolo.findMany({ where: { execucao: { rodadaId: c.id(ref(`rodada:${nome}`)), animalId: animal(c, n) } }, include: { etapa: true }, orderBy: { previstaPara: 'asc' } });
      for (const t of tarefas) {
        if (t.etapa.tipo === 'EXAME' && inicio !== -90) continue;
        const data = t.previstaPara.toISOString().slice(0, 10);
        if (t.etapa.tipo === 'APLICACAO') await acao(c, `sanitario:${t.id}`, () => criarAplicacao({ chave: key(`sanitario:${t.id}`), animalId: animal(c, n), propriedadeId, data, tarefaId: t.id,
          produtoId: c.id(ref('produto:sanitario')), nomeProdutoAplicado: 'PLANNER · Insumo sanitário fictício', origemInsumo: 'BAIXA_ESTOQUE', tipoAplicacaoId: c.id('aplicacao:Tratamento'), dose: '2', unidadeDose: 'ML', via: 'Via demonstrativa', estadoCarenciaLeite: 'INFORMADO', estadoCarenciaCarne: 'INFORMADO', carenciaLeiteHoras: 0, carenciaCarneHoras: 0, referenciaCarencia: aviso, responsavel: 'Equipe PLANNER' }, uid(c)));
        else await acao(c, `sanitario:${t.id}`, () => registrarExame({ chave: key(`sanitario:${t.id}`), animalId: animal(c, n), propriedadeId, data, tarefaId: t.id, tipoExameId: c.id('exame:Triagem demonstrativa'), resultadoOpcao: 'Negativo', responsavel: 'Equipe PLANNER' }, uid(c)));
      }
    }
  }
  for (const n of faixa(146, 150)) await acao(c, `sanitario:individual:${n}`, () => sanitario.iniciarExecucao({ chave: key(`sanitario:individual:${n}`), protocoloId: c.id(ref('protocolo:triagem')), animalId: animal(c, n), propriedadeId: sitio(c), inicio: c.dias(n - 148) }, uid(c)));
}
async function selecoes(c: Contexto) {
  const lotes = ['Diagnóstico coletivo', 'IATF em andamento', 'Individuais e histórico', 'Maternidade', 'Secas e histórico desconhecido', 'Novilhas'].map(n => c.id(ref(`lote:${n}`)));
  for (const [nome, condicao] of [
    ['DEL entre 40 e 200', { tipo: 'FAIXA', campo: 'DEL', min: 40, max: 200 }],
    ['Pós-parto até 15 dias', { tipo: 'FAIXA', campo: 'DIAS_POS_PARTO', min: 0, max: 15 }],
    ['Lactação sem histórico', { tipo: 'DESCONHECIDO', campo: 'DEL' }],
    ['Secas', { tipo: 'VALORES', campo: 'SITUACAO_PRODUTIVA', valores: ['SECA'] }],
    ['Retenção de placenta informada', { tipo: 'VALORES', campo: 'RP', valores: ['SIM'] }],
    ['Descarte reprodutivo', { tipo: 'VALORES', campo: 'DESCARTE', valores: ['SIM'] }],
  ] as const) await c.registro(ref(`selecao:${nome}`), id => prisma.selecaoVisita.findFirst({ where: id ? { id } : { nome: `PLANNER · ${nome}`, propriedadeId: sitio(c) } }), () => criarSelecao(criarSelecaoSchema.parse({ propriedadeId: sitio(c), nome: `PLANNER · ${nome}`, criterios: { versao: 1, todas: [{ tipo: 'VALORES', campo: 'LOTE', valores: lotes }, condicao], qualquer: [], ordenacao: [{ campo: 'BRINCO', direcao: 'ASC' }], politicaDesconhecidos: 'EXCLUIR' } }), uid(c)));
}
async function visitas(c: Contexto) {
  for (const [nome, deslocamento] of [['Planejar atendimento', 0], ['Ficha de campo preparada', -1]] as const) await c.registro(ref(`visita:${nome}`), id => prisma.visitaVeterinaria.findFirst({ where: id ? { id } : { nome: `PLANNER · ${nome}`, propriedadeId: sitio(c), data: dia(c.dias(deslocamento)) } }), () => criarVisita({ nome: `PLANNER · ${nome}`, propriedadeId: sitio(c), data: c.dias(deslocamento), responsavel: 'Equipe PLANNER' }, uid(c)));
  await acao(c, 'visita:grupo', async () => {
    const data = c.dias(-1), visitaId = c.id(ref('visita:Ficha de campo preparada'));
    const planner = await consultarPlanner({ propriedadeId: sitio(c), data, pagina: 1, tamanhoPagina: 200 });
    const grupo = planner.grupos.find(g => g.turma?.id === c.id(ref('programacao:120 animais para diagnóstico hoje')));
    if (!grupo) throw new Error('Grupo de diagnóstico não encontrado no planner.');
    const previa = await previaGrupoPlanner({ propriedadeId: sitio(c), data, grupo: grupo.grupo, pagina: 1, tamanhoPagina: 200 });
    await incluirGrupoPlanner(visitaId, { propriedadeId: sitio(c), chave: key('visita:grupo'), grupo: grupo.grupo, fingerprint: previa.fingerprint, excluidos: previa.animais.slice(10).map(a => a.animalId) }, uid(c));
  });
  const visitaId = c.id(ref('visita:Ficha de campo preparada'));
  await c.acao(ref('visita:imprimir'), async () => !!await prisma.impressaoVisita.findFirst({ where: { visitaId } }), () => imprimirVisita(visitaId, sitio(c), uid(c)));
}
async function etapasDoDia(c: Contexto) {
  const ia = await programar(c, 'Novilhas para inseminar hoje', 'completo', faixa(181, 184), -10);
  await executarIatf(c, ia, 1);
  const retirada = await programar(c, 'Novilhas para retirada hoje', 'completo', faixa(185, 188), -7);
  await executarIatf(c, retirada, 0);
  await programar(c, 'Novilhas aguardando início futuro', 'completo', faixa(189, 192), 5, false);
}
export async function prepararPlanner(c: Contexto) {
  for (const [nome, executar] of [['rebanho', rebanho], ['catalogos', catalogos], ['reproducao', reproducao], ['partos', partos], ['sanidade', sanidade], ['etapas-do-dia', etapasDoDia], ['selecoes', selecoes], ['visitas', visitas]] as const) await c.etapa(ref(nome), () => executar(c));
}
export async function verificarPlanner(c: Contexto) {
  const ids = faixa(1, 200).map(n => animal(c, n));
  assert.equal(await prisma.animal.count({ where: { id: { in: ids } } }), 200, 'Animais do complemento ausentes.');
  assert.equal(await prisma.participacaoProtocolo.count({ where: { rodadaId: c.id(ref('programacao:120 animais para diagnóstico hoje')) } }), 120);
  assert.equal(await prisma.partoAnimal.count({ where: { animalId: { in: faixa(161, 170).map(n => animal(c, n)) } } }), 10);
  // Verifica existência estrutural; NÃO exige que tarefas continuem pendentes após testes manuais.
  const historico = await prisma.tarefaProtocolo.count({ where: { execucao: { rodadaId: c.id(ref('programacao:Histórico com todas as etapas realizadas')) }, realizadaEm: { not: null } } });
  assert.ok(historico >= 30, 'Histórico reprodutivo incompleto.');
  const planner = await consultarPlanner({ propriedadeId: sitio(c), data: c.dias(0), pagina: 1, tamanhoPagina: 200 });
  const partos = await prisma.partoAnimal.findMany({ where: { animalId: { in: faixa(161, 170).map(n => animal(c, n)) } }, select: { id: true } });
  const crias = await prisma.criaParto.findMany({ where: { partoId: { in: partos.map(p => p.id) } } });
  const novos = crias.filter(cria => cria.animalId != null).length;
  assert.equal(novos, 9, 'Crias vivas do complemento ausentes.');
  // TE: mãe genética externa, receptora conservada no parto. Não confundir as duas.
  const partoTe = await prisma.partoAnimal.findFirstOrThrow({ where: { animalId: animal(c, 170) } });
  const criaTe = crias.find(cria => cria.partoId === partoTe.id && cria.animalId);
  assert.ok(criaTe?.animalId);
  const bezerroTe = await prisma.animal.findUniqueOrThrow({ where: { id: criaTe.animalId } });
  assert.equal(bezerroTe.maeExternaId, c.id('genitor:matriz'));
  const protocolos = Object.entries(c.manifesto.ids).filter(([nome]) => nome.startsWith(ref('protocolo:'))).map(([, id]) => id);
  const participacoes = await prisma.participacaoProtocolo.findMany({ where: { protocoloId: { in: protocolos }, animalId: { in: ids } }, select: { id: true } });
  const escopo = { execucaoId: { in: participacoes.map(p => p.id) } };
  const programacoes = await prisma.programacaoProtocolo.count({ where: { protocoloId: { in: protocolos } } });
  const tarefas = await prisma.tarefaProtocolo.count({ where: escopo });
  const realizadas = await prisma.tarefaProtocolo.count({ where: { ...escopo, realizadaEm: { not: null } } });
  const individuais = await prisma.participacaoProtocolo.count({ where: { id: { in: participacoes.map(p => p.id) }, rodadaId: null } });
  const movimentos = await prisma.movimentoEstoque.count({ where: { produtoId: { in: ['sanitario', 'semen', 'embriao'].map(r => c.id(ref(`produto:${r}`))) } } });
  const colostros = await prisma.fornecimentoColostro.count({ where: { criaId: { in: crias.map(cria => cria.id) } } });
  process.stdout.write(`[planner] ${ids.length} animais + ${novos} crias; 10 partos. Data-base: ${c.dias(0)}.\n`);
  process.stdout.write(`[planner] ${JSON.stringify({ protocolos: protocolos.length, programacoes, participacoes: participacoes.length, individuaisSemRodada: individuais, tarefas, realizadas, movimentosProdutosProprios: movimentos, colostros })}\n`);
  process.stdout.write(`[planner] Planner do sítio Principal: ${planner.totalGrupos} grupos (inclui dados anteriores e escolhas salvas).\n`);
  process.stdout.write(`[planner] Visita para testar: /pecuaria/visitas/${c.id(ref('visita:Planejar atendimento'))}\n`);
}
