import { prepararImportacaoQa } from './importacao.js';
import assert from 'node:assert/strict';
import { prisma } from '../../../src/db.js';
import { criarPropriedade } from '../../../src/services/propriedade.js';
import { hashSenha } from '../../../src/services/auth/hash.js';
import { ABAS_IDS } from '../../../src/services/auth/papeis.js';
import { cadastrar } from '../../../src/services/pecuaria/rebanho/animais.js';
import { cadastrarAnimalSchema } from '../../../src/services/pecuaria/rebanho/schemas.js';
import { criarLote } from '../../../src/services/pecuaria/rebanho/lotes.js';
import { criarMaterialGenetico } from '../../../src/services/pecuaria/rebanho/materialGenetico.js';
import { registrarPesagensColetivas } from '../../../src/services/pecuaria/manejo/manejo.js';
import { criarProduto } from '../../../src/services/estoque/produtos.js';
import { produtoSchema } from '../../../src/services/estoque/produtos.schemas.js';
import { ativarRastreio } from '../../../src/services/estoque/partidas.js';
import { registrarMovimento } from '../../../src/services/estoque/estoque.js';
import { criarOperacao } from '../../../src/services/financeiro/operacoes.js';
import { operacaoSchema } from '../../../src/services/financeiro/schemas.js';
import { auditar } from '../../../src/services/financeiro/regras.js';
import { criarTipoExame } from '../../../src/services/pecuaria/sanidade/exames.js';
import { criarDoenca, criarOcorrencia } from '../../../src/services/pecuaria/sanidade/ocorrencias.js';
import * as iatf from '../../../src/services/pecuaria/reproducao/iatf.js';
import * as registros from '../../../src/services/pecuaria/reproducao/registros.js';
import { protocoloSchema, programacaoSchema, partoSchema } from '../../../src/services/pecuaria/reproducao/schemas.js';
import { criarPoliticaElegibilidade, decidirElegibilidadeCiclo, vincularPoliticaCiclo } from '../../../src/services/pecuaria/reproducao/elegibilidade.js';
import { parametrosElegibilidadeSchema } from '../../../src/services/pecuaria/reproducao/elegibilidade.schemas.js';
import { registrarLactacaoHistorica } from '../../../src/services/pecuaria/reproducao/lactacoes.js';
import { registrarColostro } from '../../../src/services/pecuaria/reproducao/colostro.js';
import { criarVisita, adicionarAtividade, imprimirVisita, encerrarVisita, salvarRascunho } from '../../../src/services/pecuaria/reproducao/visitas.js';
import { criarSelecao, criarSelecaoSchema } from '../../../src/services/pecuaria/reproducao/selecoes.js';
import * as sanitario from '../../../src/services/pecuaria/sanidade/protocolos.js';
import { criarRodada } from '../../../src/services/pecuaria/sanidade/rodadas.js';
import { atividadeSchema } from '../../../src/services/pecuaria/reproducao/schemas.js';
import { Prisma } from '@prisma/client';
import { auditar as auditarPecuaria } from '../../../src/services/pecuaria/rebanho/regras.js';
import { SENHA } from '../catalogos.js';
import { chave, dia, type Contexto } from '../contexto.js';

// Somente pré-condições: o roteiro executa os atos sob teste na interface.
const ref = (s: string) => `qa-v4-v1:${s}`;
const key = (s: string) => chave(ref(s));
const nome = (s: string) => `QA V4 · ${s}`;
const faixa = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const uid = (c: Contexto) => c.numero('usuario:dono');
const sitio = (c: Contexto, s = 'A') => c.numero(ref(`sitio:${s}`));
const animal = (c: Contexto, n: number) => c.id(ref(`animal:${n}`));
const brinco = (n: number) => `QA4-${String(n).padStart(3, '0')}`;
const aviso = 'Fixture fictícia QA V4 para teste de software. Produtos e protocolos não são recomendações clínicas.';
export const cenarios = [
  'IA e primeiro diagnóstico', 'TE com genética externa', 'Prenhez de origem desconhecida', 'Negativo e inconclusivo',
  'Descarte ainda em lactação', 'Serviço sem baixa fictícia', 'Validação de estoque', 'Cobertura observada',
  'Gestante para gemelar', 'Gestante para aborto', 'Gestante para natimorto', 'Gestante para perda',
  'Correção de gestação', 'Correção de parto', 'Transferência entre sítios', 'Correção de tarefa 1',
  'Correção de tarefa 2', 'Correção de tarefa 3', 'Cancelamento sem uso', 'Cancelamento com uso',
  'Carência desconhecida', 'Alerta sanitário', 'Bloqueio sanitário', 'IATF sem participação',
  'IATF com uma participação', 'IATF com duas participações', 'IATF retirada antes de iniciar', 'DEL zero',
  'Seca comprovada', 'Sem histórico de lactação', 'Peso 500 após referência anterior', 'Apta há 30 dias',
  'Apta há 10 dias', 'Apta sem data conhecida', 'Prenha sem política vigente', 'Sítio sem política vigente',
  'Sítio sem configuração', 'Liberação no meio da janela', 'Pesagem ausente', 'Prenhez pendente de DG',
  'Parto RP sim e colostro', 'Parto RP não', 'Parto RP desconhecida', 'Parto aborto histórico',
  'Parto natimorto histórico', 'Cria provisória e TE', 'Reserva independente 1', 'Reserva independente 2',
] as const;

async function acao(c: Contexto, id: string, executar: () => Promise<unknown>) {
  await c.acao(ref(id), async () => !!await prisma.requisicaoPecuaria.findUnique({ where: { chave: key(id) } }), executar);
}
async function catalogos(c: Contexto) {
  for (const s of ['A', 'B', 'C']) await c.registro(ref(`sitio:${s}`), id => prisma.propriedade.findFirst({ where: id ? { id: Number(id) } : { nome: nome(`Homologação ${s}`) } }),
    () => criarPropriedade({ nome: nome(`Homologação ${s}`), principal: false, cidade: 'Demonstração', uf: 'MG', ordem: 90 + s.charCodeAt(0) }));
  for (const [perfil, areas, flags] of [
    ['consulta', ['pecuaria'], ['verValores', 'exportar']], ['operador', ['pecuaria'], ['lancar']], ['financeiro', ['financeiro'], ['lancar', 'verValores']],
  ] as const) {
    const email = `qa.v4.${perfil}@example.test`;
    await c.registro(ref(`usuario:${perfil}`), id => prisma.usuario.findFirst({ where: id ? { id: Number(id) } : { email } }), () => prisma.usuario.create({ data: {
      email, nome: nome(perfil), senhaHash: hashSenha(SENHA), papel: perfil === 'consulta' ? 'consulta' : 'operador',
      status: 'ATIVO', dono: false, areas: [...areas], abas: [...ABAS_IDS], flags: [...flags],
    } }));
  }
  for (const r of ['semen', 'embriao', 'sem-saldo']) {
    await c.registro(ref(`material:${r}`), id => prisma.materialGenetico.findFirst({ where: id ? { id } : { produto: { nome: nome(r) } } }), () => criarMaterialGenetico({
      tipo: r === 'embriao' ? 'EMBRIAO' : 'SEMEN', touro: { tipo: 'EXTERNO', id: c.id('genitor:touro') },
      ...(r === 'embriao' ? { doadora: { tipo: 'EXTERNO' as const, id: c.id('genitor:matriz') } } : { tipoSemen: 'CONVENCIONAL' as const }),
      produto: { nome: nome(r), categoriaId: c.id('categoria:Sêmen e embriões'), centroCustoIds: [c.id('centro:Pecuária')], fornecedorIds: [] }, observacao: aviso,
    }, uid(c)));
    const material = await prisma.materialGenetico.findUniqueOrThrow({ where: { id: c.id(ref(`material:${r}`)) } });
    c.manifesto.ids[ref(`produto:${r}`)] = material.produtoId; await c.salvar();
    await c.acao(ref(`rastreio:${r}`), async () => (await prisma.produto.findUniqueOrThrow({ where: { id: material.produtoId } })).rastrearPartidas, () => ativarRastreio(material.produtoId, uid(c)));
  }
  await c.registro(ref('produto:sanitario'), id => prisma.produto.findFirst({ where: id ? { id } : { nome: nome('Insumo sanitário') } }), () => criarProduto(produtoSchema.parse({
    nome: nome('Insumo sanitário'), unidade: 'ML', categoriaId: c.id('categoria:Medicamentos veterinários'), usoSanitario: true,
    rastrearPartidas: true, centroCustoIds: [c.id('centro:Pecuária')], fornecedorIds: [],
    perfilSanitario: { carenciaLeiteHoras: 48, carenciaCarneHoras: 72, viaPadrao: 'Demonstrativa', referenciaTecnica: aviso },
  }), uid(c)));
  for (const r of ['semen', 'embriao', 'sanitario']) {
    const observacao = nome(`Saldo inicial ${r}`), quantidade = r === 'sanitario' ? 1000 : 100;
    await c.registro(ref(`estoque:${r}`), id => prisma.movimentoEstoque.findFirst({ where: id ? { id } : { produtoId: c.id(ref(`produto:${r}`)), observacao } }), () => registrarMovimento({
      produtoId: c.id(ref(`produto:${r}`)), propriedadeId: sitio(c), centroCustoId: c.id('centro:Pecuária'),
      tipo: 'AJUSTE', quantidade, custoUnitario: r === 'embriao' ? 350 : r === 'semen' ? 80 : 2, data: c.dias(-60), observacao, usuarioId: uid(c),
      partidas: [
        { codigo: `QA-${r}-VALIDO`, nome: nome(`${r} válido`), validade: c.dias(365), quantidade: quantidade - 20 },
        { codigo: `QA-${r}-VENCIDO`, nome: nome(`${r} vencido`), validade: c.dias(-30), quantidade: 10 },
        { codigo: `QA-${r}-INCERTO`, nome: nome(`${r} validade desconhecida`), validade: null, quantidade: 10, cienciaValidadeDesconhecida: true },
      ],
    }));
    for (const [grupo, validade] of [['valido', c.dias(365)], ['vencido', c.dias(-30)], ['incerto', null]] as const)
      await c.registro(ref(`partida:${r}:${grupo}`), id => prisma.partidaProduto.findFirst({ where: id ? { id } : { produtoId: c.id(ref(`produto:${r}`)), validade: validade ? dia(validade) : null, lotePrincipalId: null } }), async () => { throw new Error('Partida criada não encontrada.'); });
  }
  await c.registro(ref('servico'), id => prisma.operacao.findFirst({ where: id ? { id } : { descricao: nome('Serviço veterinário para atribuição') } }), () => criarOperacao({
    ...operacaoSchema.parse({ tipo: 'SERVICO', data: c.dias(0), descricao: nome('Serviço veterinário para atribuição'), parceiroId: c.id('parceiro:veterinario'),
      categoriaId: c.id('categoria:Serviços veterinários'), centroCustoId: c.id('centro:Pecuária'), valorTotal: 1000,
      financeiro: { condicao: 'A_PRAZO', parcelas: [{ valor: 1000, dataVencimento: c.dias(30) }] },
    }), chave: key('servico'), propriedadeId: sitio(c), usuarioId: uid(c),
  }));
  for (const s of ['A', 'B']) await acao(c, `politica:${s}`, () => criarPoliticaElegibilidade({ chave: key(`politica:${s}`), propriedadeId: sitio(c, s), vigenteDesde: c.dias(s === 'A' ? -600 : 1),
    parametros: parametrosElegibilidadeSchema.parse({ versao: 1, metodologia: 'IDEAGRI_IILB_BASE_V1', pevPrimiparasDias: 60, pevMultiparasDias: 45,
      aborto: 'LIBERACAO_EXPLICITA', pevAposAbortoDias: null, descarte: 'EXCLUIR', restricoes: 'EXCLUIR', perdaGestacional: 'EXIGE_LIBERACAO', papeisIncluidos: ['NENHUM', 'DOADORA', 'RECEPTORA'] }),
  }, uid(c)));
  for (const r of ['mutavel', 'publicado']) await c.registro(ref(`exame:${r}`), id => prisma.tipoExame.findFirst({ where: id ? { id } : { nome: nome(`Exame reprodutivo ${r}`) } }), () => criarTipoExame({
    nome: nome(`Exame reprodutivo ${r}`), tipoResultado: 'MULTIPLO', campos: [
      { codigo: 'CONCLUSAO_GESTACIONAL', rotulo: 'Conclusão', tipo: 'OPCAO', obrigatorio: false, opcoes: ['POSITIVO', 'NEGATIVO', 'INCONCLUSIVO'] },
      { codigo: 'SEXO_FETAL', rotulo: 'Sexo fetal', tipo: 'OPCAO', obrigatorio: false, opcoes: ['M', 'F'] },
      { codigo: 'MEDIDA', rotulo: 'Medida demonstrativa', tipo: 'NUMERO', obrigatorio: false, unidade: 'mm' },
      { codigo: 'ACHADO', rotulo: 'Achado observado', tipo: 'BOOLEANO', obrigatorio: false },
    ],
  }, uid(c), 'REPRODUTIVO'));
  for (const [r, efeito] of [['alerta', 'ALERTAR'], ['bloqueio', 'BLOQUEAR']] as const) {
    await c.registro(ref(`doenca:${r}`), id => prisma.doenca.findFirst({ where: id ? { id } : { nome: nome(`Condição fictícia ${r}`) } }), () => criarDoenca(nome(`Condição fictícia ${r}`), null, uid(c)));
    for (const acao of ['IA', 'IATF'] as const) await c.registro(ref(`regra:${r}:${acao}`), id => prisma.regraSanitariaReprodutiva.findFirst({ where: id ? { id } : { propriedadeId: sitio(c), doencaId: c.id(ref(`doenca:${r}`)), acao } }), () => registros.configurarRegraSanitaria({ propriedadeId: sitio(c), doencaId: c.id(ref(`doenca:${r}`)), acao, efeito, motivo: aviso, ativo: true }, uid(c)));
  }
  const tentativa = { tipo: 'IA', materialId: c.id(ref('material:semen')), quantidade: 1 };
  for (const r of ['dias', 'alternativo', 'horas', 'diagnostico', 'rascunho']) await c.registro(ref(`protocolo:${r}`), id => prisma.protocolo.findFirst({ where: id ? { id } : { nome: nome(`Protocolo ${r}`) } }), () => iatf.criarProtocolo(protocoloSchema.parse({
    nome: nome(`Protocolo ${r}`), descricao: aviso, versao: 1, publicado: r !== 'rascunho',
    etapas: r === 'diagnostico' ? [
      { nome: 'Manejo inicial', tipo: 'MANEJO', intervalo: 0, unidade: 'DIAS' },
      { nome: 'Inseminação', tipo: 'TENTATIVA', intervalo: 10, unidade: 'DIAS', planoTentativa: tentativa },
      { nome: 'Diagnóstico coletivo', tipo: 'AVALIACAO', intervalo: 40, unidade: 'DIAS', planoAvaliacao: { tipo: 'DIAGNOSTICO', tipoExameId: c.id(ref('exame:publicado')) } },
    ] : [
      { nome: 'Manejo inicial', tipo: 'MANEJO', intervalo: 0, unidade: 'DIAS' },
      { nome: 'Retirada', tipo: 'RETIRADA', intervalo: r === 'horas' ? 48 : 7, unidade: r === 'horas' ? 'HORAS' : 'DIAS' },
      { nome: 'Inseminação', tipo: 'TENTATIVA', intervalo: 10, unidade: 'DIAS', planoTentativa: tentativa },
      { nome: 'Diagnóstico', tipo: 'AVALIACAO', intervalo: 40, unidade: 'DIAS', planoAvaliacao: { tipo: 'DIAGNOSTICO' } },
    ],
  }), uid(c)));
}
async function rebanho(c: Contexto) {
  for (const [s, lote] of [['A', 'Casos independentes'], ['A', '209 fêmeas e 4 machos'], ['B', 'Política futura'], ['C', 'Sem configuração']] as const)
    await c.registro(ref(`lote:${lote}`), id => prisma.lote.findFirst({ where: id ? { id } : { nome: nome(lote), propriedadeId: sitio(c, s) } }), () => criarLote({ nome: nome(lote), propriedadeId: sitio(c, s), centroCustoId: c.id('centro:Pecuária'), observacao: aviso }, uid(c)));
  for (const n of [...faixa(1, 48), ...faixa(101, 313)]) {
    const s = n === 35 || n === 36 ? 'B' : n === 37 ? 'C' : 'A';
    const lote = s === 'B' ? 'Política futura' : s === 'C' ? 'Sem configuração' : n > 100 ? '209 fêmeas e 4 machos' : 'Casos independentes';
    await c.registro(ref(`animal:${n}`), id => prisma.animal.findFirst({ where: id ? { id } : { brinco: brinco(n) } }), () => cadastrar(cadastrarAnimalSchema.parse({
      brinco: brinco(n), nome: nome(n <= 48 ? cenarios[n - 1]! : `Grupo ${n - 100}`), sexo: n >= 310 ? 'M' : 'F',
      dataNascimento: c.dias(-1800 - n), dataEntrada: c.dias(-600), origem: 'COMPRADO', partosAntesDaEntrada: n >= 310 || (n >= 31 && n <= 40) ? 0 : 2,
      propriedadeId: sitio(c, s), loteId: c.id(ref(`lote:${lote}`)), aptidao: 'LEITE',
      ...(n === 30 ? {} : { papelReprodutivo: n === 2 || n === 46 ? 'RECEPTORA' : 'NENHUM' }),
      composicao: [{ racaId: c.id(n % 2 ? 'raca:HO' : 'raca:GO'), fracao64: 64 }], observacao: aviso,
    }), uid(c), { nascimentoHistorico: true }));
    if (n < 310) await acao(c, `inicial:${n}`, () => registros.criarSituacaoInicial({ chave: key(`inicial:${n}`), animalId: animal(c, n), propriedadeId: sitio(c, s),
      data: c.dias(-500), situacao: [32, 33, 34].includes(n) ? 'APTA' : 'VAZIA',
      ...([32, 33].includes(n) ? { aptaDesde: c.dias(n === 32 ? -30 : -10) } : {}), observacao: aviso,
    }, uid(c)));
    if (n % 50 === 0) process.stdout.write(`[qa-v4] preparado ${brinco(n)}\n`);
  }
}
async function tentativa(c: Contexto, n: number, data: number, s = 'A') {
  const te = n === 2 || n === 46;
  await acao(c, `tentativa:${n}`, () => registros.criarTentativa({ chave: key(`tentativa:${n}`), animalId: animal(c, n), propriedadeId: sitio(c, s), data: c.dias(data),
    tipo: te ? 'TE' : 'IA', materialId: c.id(ref(`material:${te ? 'embriao' : 'semen'}`)), origem: 'DOCUMENTADA', quantidade: 1,
    justificativaSemOrigem: 'Histórico fictício QA anterior à carga, sem consumo retroativo.', observacao: aviso,
  }, uid(c)));
  return prisma.tentativaReprodutiva.findFirstOrThrow({ where: { animalId: animal(c, n) }, orderBy: { data: 'asc' } });
}
async function historico(c: Contexto) {
  for (const n of [...faixa(9, 20), 35, ...faixa(41, 46)]) {
    const s = n === 35 ? 'B' : 'A', t = await tentativa(c, n, -300, s);
    await acao(c, `gestacao:${n}`, () => registros.criarAvaliacao({ chave: key(`gestacao:${n}`), animalId: animal(c, n), propriedadeId: sitio(c, s), data: c.dias(-260), resultado: 'POSITIVO', tentativaId: t.id, observacao: aviso }, uid(c)));
  }
  await tentativa(c, 40, -30);
  for (const n of [1, 5, 28, 29]) await acao(c, `lactacao:${n}`, () => registrarLactacaoHistorica({ chave: key(`lactacao:${n}`), animalId: animal(c, n), propriedadeId: sitio(c),
    inicio: c.dias(n === 28 ? 0 : -100), ...(n === 29 ? { encerradaEm: c.dias(-5) } : {}), motivo: aviso,
  }, uid(c)));
  for (const n of [22, 23]) {
    const r = n === 22 ? 'alerta' : 'bloqueio';
    await c.registro(ref(`ocorrencia:${n}`), id => prisma.ocorrenciaSanitaria.findFirst({ where: id ? { id } : { animalId: animal(c, n), doencaId: c.id(ref(`doenca:${r}`)) } }), () => criarOcorrencia({ animalId: animal(c, n), propriedadeId: sitio(c), doencaId: c.id(ref(`doenca:${r}`)), inicio: c.dias(-2), observacao: aviso }, uid(c)));
  }
  await acao(c, 'peso:31', () => registrarPesagensColetivas({ chave: key('peso:31'), propriedadeId: sitio(c), data: c.dias(-1), tipo: 'ROTINA', origem: 'MANUAL', itens: [{ animalId: animal(c, 31), pesoKg: 500, observacao: aviso }] }, uid(c)));
  const vinculo = await prisma.vinculoPoliticaCiclo.findFirstOrThrow({ where: { animalId: animal(c, 38) } });
  await acao(c, 'liberacao:38', () => decidirElegibilidadeCiclo({ chave: key('liberacao:38'), propriedadeId: sitio(c), vinculoCicloId: vinculo.id, data: c.dias(-10), tipo: 'LIBERAR', aptaDesde: c.dias(-10), motivo: aviso }, uid(c)));
  for (const n of faixa(41, 46)) {
    const gestacao = await prisma.gestacaoAnimal.findFirstOrThrow({ where: { animalId: animal(c, n) } }), data = c.dias(-3);
    await acao(c, `parto:${n}`, () => registros.criarParto(partoSchema.parse({ chave: key(`parto:${n}`), animalId: animal(c, n), propriedadeId: sitio(c), data,
      gestacaoId: gestacao.id, desfecho: n === 44 ? 'ABORTO' : 'NASCIMENTO', iniciarLactacao: n !== 44,
      retencaoPlacenta: n === 41 ? true : n === 42 ? false : null, responsavel: 'Equipe QA', observacao: aviso,
      ...(n === 41 ? { ocorrenciaRetencao: { acao: 'CRIAR', doencaId: c.id('doenca:Retenção de placenta'), inicio: data, observacao: aviso },
        pesoMatriz: { acao: 'REGISTRAR', data, pesoKg: 510 }, escoreMatriz: { acao: 'REGISTRAR', data, valor: 3, escalaMin: 1, escalaMax: 5, escalaDescricao: 'Demonstração' } } : {}),
      crias: n === 44 ? [] : [{ viva: n !== 45, sexo: 'F', aptidao: 'LEITE', brinco: null, nome: nome(`Cria provisória ${n}`), loteId: c.id(ref('lote:Casos independentes')), pesoKg: 35 }],
    }), uid(c)));
    if (n === 41) {
      const parto = await prisma.partoAnimal.findFirstOrThrow({ where: { animalId: animal(c, n) } });
      const cria = await prisma.criaParto.findFirstOrThrow({ where: { partoId: parto.id } });
      for (const i of [1, 2]) await acao(c, `colostro:${i}`, () => registrarColostro({ chave: key(`colostro:${i}`), propriedadeId: sitio(c), criaId: cria.id, data, quantidade: i === 1 ? 3 : 2,
        unidade: 'L', metodoQualidade: 'REFRATOMETRO_BRIX', qualidadeBrix: 23, tipo: 'FRESCO', forma: 'MAMADEIRA', observacao: aviso }, uid(c)));
    }
  }
}
async function programar(c: Contexto, rotulo: string, protocolo: string, numeros: number[], iniciar: boolean, inicio = 0) {
  await c.registro(ref(`programacao:${rotulo}`), id => prisma.programacaoProtocolo.findFirst({ where: id ? { id } : { nome: nome(rotulo) } }), () => iatf.criarProgramacao(programacaoSchema.parse({
    chave: key(`programacao:${rotulo}`), propriedadeId: sitio(c), protocoloId: c.id(ref(`protocolo:${protocolo}`)), nome: nome(rotulo), inicioPrevisto: c.dias(inicio), animais: numeros.slice(0, 100).map(n => ({ animalId: animal(c, n) })),
  }), uid(c)));
  const id = c.id(ref(`programacao:${rotulo}`));
  if (numeros.length > 100) await acao(c, `adicionar:${rotulo}`, () => iatf.adicionarParticipantes(id, { chave: key(`adicionar:${rotulo}`), propriedadeId: sitio(c), animais: numeros.slice(100).map(n => ({ animalId: animal(c, n), inicioPrevisto: c.dias(inicio) })) }, uid(c)));
  const participantes = await prisma.participanteIatf.findMany({ where: { programacaoId: id } });
  if (iniciar) for (const p of participantes) await c.acao(ref(`inicio:${p.id}`), async () => !!(await prisma.participanteIatf.findUniqueOrThrow({ where: { id: p.id } })).inicioEfetivo, () => iatf.iniciarParticipante(p.id, sitio(c), c.dias(inicio), uid(c)));
  return participantes;
}
async function agenda(c: Contexto) {
  const diagnosticos = await programar(c, '120 diagnósticos pendentes', 'diagnostico', faixa(101, 220), true, -40);
  for (const p of diagnosticos) for (const tarefa of await prisma.tarefaIatf.findMany({ where: { participanteId: p.id, etapa: { lt: 2 } }, orderBy: { etapa: 'asc' } })) {
    await acao(c, `executar:${tarefa.id}`, () => iatf.executarTarefa(tarefa.id, { chave: key(`executar:${tarefa.id}`), propriedadeId: sitio(c), realizadaEm: tarefa.previstaEm.toISOString().slice(0, 10),
      dados: tarefa.tipo === 'TENTATIVA' ? { tipo: 'IA', materialId: c.id(ref('material:semen')), origem: 'DOCUMENTADA', quantidade: 1, justificativaSemOrigem: aviso, observacao: aviso } : { observacao: aviso },
    }, uid(c)));
  }
  await programar(c, 'Uma participação a iniciar', 'dias', [25, 26], false);
  await programar(c, 'Segunda participação a iniciar', 'alternativo', [26], false);
  const retirados = await programar(c, 'Participação retirada', 'dias', [27], false);
  for (const p of retirados) await c.acao(ref(`retirada:${p.id}`), async () => !!(await prisma.participanteIatf.findUniqueOrThrow({ where: { id: p.id } })).encerradoEm, () => iatf.retirarParticipante(p.id, sitio(c), aviso, uid(c)));
  await programar(c, 'Horário não conhecido', 'horas', [47], true);
  for (const titulo of ['Entrada vazia', 'Atendimento coletivo', 'Concorrência e correções']) await c.registro(ref(`visita:${titulo}`), id => prisma.visitaVeterinaria.findFirst({ where: id ? { id } : { nome: nome(titulo) } }), () => criarVisita({ chave: key(`visita:${titulo}`), propriedadeId: sitio(c), nome: nome(titulo), data: c.dias(0), responsavel: 'Equipe QA' }, uid(c)));
  // Não existe comando público de fechamento. Fixture administrativa auditada,
  // restrita ao sítio próprio e a um mês anterior, sem afetar outros ambientes.
  const data = dia(c.mes(-1, 1));
  await c.registro(ref('periodo:fechado'), id => prisma.periodoFinanceiro.findFirst({ where: id ? { id } : { propriedadeId: sitio(c), ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 } }), () => prisma.$transaction(async tx => {
    const periodo = await tx.periodoFinanceiro.create({ data: { propriedadeId: sitio(c), ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1, status: 'FECHADO', fechadoEm: new Date(), fechadoPorId: uid(c), observacao: aviso } });
    await auditar(tx, { entidade: 'PeriodoFinanceiro', entidadeId: periodo.id, acao: 'FECHAR_PERIODO_QA', usuarioId: uid(c), depois: periodo });
    return periodo;
  }));
}
async function interfaceQa(c: Contexto) {
  for (const versao of [1, 2]) await c.registro(ref(`selecao:${versao}`), id => prisma.selecaoVisita.findFirst({ where: id ? { id } : { nome: nome(`Filtro V${versao}`), propriedadeId: sitio(c) } }), () => criarSelecao(criarSelecaoSchema.parse({
    propriedadeId: sitio(c), nome: nome(`Filtro V${versao}`), criterios: { versao, todas: versao === 1 ? [{ tipo: 'FAIXA', campo: 'DEL', min: 0, max: 150 }] : [{ tipo: 'FAIXA', campo: 'PESO_KG', min: 450 }],
      qualquer: [], ordenacao: [{ campo: 'BRINCO', direcao: 'ASC' }], politicaDesconhecidos: 'EXCLUIR' },
  }), uid(c)));
  await c.registro(ref('protocolo:sanitario'), id => prisma.protocolo.findFirst({ where: id ? { id } : { nome: nome('Sanitário demonstrativo') } }), () => sanitario.criarProtocolo({
    nome: nome('Sanitário demonstrativo'), descricao: aviso, etapas: [
      { diaRelativo: 0, tipo: 'APLICACAO', produtoId: c.id(ref('produto:sanitario')), tipoAplicacaoId: c.id('aplicacao:Tratamento'), dose: 2, unidade: 'ML', via: 'Demonstrativa' },
      { diaRelativo: 7, tipo: 'EXAME', tipoExameId: c.id('exame:Triagem demonstrativa') },
    ],
  }, uid(c)));
  await c.acao(ref('publicar:sanitario'), async () => !!(await prisma.protocolo.findUniqueOrThrow({ where: { id: c.id(ref('protocolo:sanitario')) } })).publicado, () => sanitario.publicarProtocolo(c.id(ref('protocolo:sanitario')), uid(c)));
  await c.registro(ref('programacao:sanitario'), id => prisma.programacaoProtocolo.findFirst({ where: id ? { id } : { nome: nome('Sanidade coletiva') } }), async () => {
    await criarRodada({ chave: key('rodada:sanitario'), nome: nome('Sanidade coletiva'), protocoloId: c.id(ref('protocolo:sanitario')), propriedadeId: sitio(c), inicioReferencia: c.dias(0), itens: [21, 22, 23, 101, 102].map(n => ({ animalId: animal(c, n) })) }, uid(c));
    return prisma.programacaoProtocolo.findFirstOrThrow({ where: { nome: nome('Sanidade coletiva') } });
  });
  for (const titulo of ['Ficha preparada', 'Visita encerrada', 'Compatibilidade anterior']) {
    await c.registro(ref(`visita:${titulo}`), id => prisma.visitaVeterinaria.findFirst({ where: id ? { id } : { nome: nome(titulo) } }), () => criarVisita({ chave: key(`visita:${titulo}`), propriedadeId: sitio(c), nome: nome(titulo), data: c.dias(0), responsavel: 'Equipe QA' }, uid(c)));
    const visitaId = c.id(ref(`visita:${titulo}`));
    await c.registro(ref(`atividade:${titulo}`), id => prisma.atividadeVisita.findFirst({ where: id ? { id } : { visitaId, nome: nome(titulo) } }), () => adicionarAtividade(visitaId, atividadeSchema.parse({
      propriedadeId: sitio(c), tipo: titulo === 'Compatibilidade anterior' ? 'INICIAR_IATF' : 'AVALIACAO_REPRODUTIVA', nome: nome(titulo),
      contexto: titulo === 'Compatibilidade anterior' ? { protocoloId: c.id(ref('protocolo:dias')) } : {}, participantes: (titulo === 'Compatibilidade anterior' ? [27] : [28, 29, 30, 41, 42, 43]).map(n => ({ animalId: animal(c, n) })),
    }), uid(c)));
    if (titulo === 'Compatibilidade anterior') {
      const atividadeId = c.id(ref(`atividade:${titulo}`)), participante = await prisma.participanteVisita.findFirstOrThrow({ where: { atividadeId } });
      const cancelado = await prisma.participanteIatf.findFirstOrThrow({ where: { programacaoId: c.id(ref('programacao:Participação retirada')) } });
      await c.acao(ref('rascunho:cancelado'), async () => (await prisma.participanteVisita.findUniqueOrThrow({ where: { id: participante.id } })).versaoRascunho > 0,
        () => salvarRascunho(visitaId, participante.id, sitio(c), { participanteIatfId: cancelado.id, inicioEfetivo: c.dias(0) }, uid(c), 0));
      // Emula formato persistido anterior; exclusivamente nesta atividade fictícia.
      await c.acao(ref('contexto:legado'), async () => JSON.stringify((await prisma.atividadeVisita.findUniqueOrThrow({ where: { id: atividadeId } })).contexto) === '{}', () => prisma.$transaction(async tx => {
        const antes = await tx.atividadeVisita.findUniqueOrThrow({ where: { id: atividadeId } });
        const depois = await tx.atividadeVisita.update({ where: { id: atividadeId }, data: { contexto: {} } });
        await auditarPecuaria(tx, { entidade: 'AtividadeVisita', entidadeId: atividadeId, propriedadeId: sitio(c), acao: 'FIXTURE_LEGADA_QA', usuarioId: uid(c), antes, depois });
      }));
    } else {
      await c.registro(ref(`impressao:${titulo}`), id => prisma.impressaoVisita.findFirst({ where: id ? { id } : { visitaId } }), () => imprimirVisita(visitaId, sitio(c), uid(c)));
      if (titulo === 'Visita encerrada') await c.acao(ref('visita:encerrar'), async () => !!(await prisma.visitaVeterinaria.findUniqueOrThrow({ where: { id: visitaId } })).encerradaEm, () => encerrarVisita(visitaId, sitio(c), uid(c)));
    }
  }
  const visitaId = c.id(ref('visita:Compatibilidade anterior'));
  await c.registro(ref('impressao:legada'), id => prisma.impressaoVisita.findFirst({ where: id ? { id } : { visitaId } }), () => prisma.$transaction(async tx => {
    // Não altera uma emissão real: cria uma fixture que reproduz campos antigos.
    const atividadeId = c.id(ref('atividade:Compatibilidade anterior'));
    const p = await tx.participanteVisita.findFirstOrThrow({ where: { atividadeId } });
    const snapshot: Prisma.InputJsonObject = { id: visitaId, nome: nome('Compatibilidade anterior'), data: c.dias(0), propriedadeId: sitio(c), versao: 1,
      atividades: [{ id: atividadeId, tipo: 'INICIAR_IATF', nome: nome('Atividade antiga'), contexto: {}, participantes: [{ id: p.id, animalId: p.animalId, ordem: 1, snapshot: { brinco: brinco(27), nome: nome('Histórico incompleto') } }] }] };
    const impressao = await tx.impressaoVisita.create({ data: { visitaId, versao: 1, snapshot, criadoPorId: uid(c) } });
    await auditarPecuaria(tx, { entidade: 'ImpressaoVisita', entidadeId: impressao.id, propriedadeId: sitio(c), acao: 'FIXTURE_LEGADA_QA', usuarioId: uid(c), depois: impressao });
    return impressao;
  }));
}
export async function prepararQa(c: Contexto) {
  await c.etapa('qa-catalogos', () => catalogos(c));
  await c.etapa('qa-rebanho', () => rebanho(c));
  await c.etapa('qa-vinculos', async () => {
    for (const n of [...faixa(1, 48), ...faixa(101, 309)]) {
      const inicial = await prisma.situacaoInicialReprodutiva.findFirstOrThrow({ where: { animalId: animal(c, n) } });
      const propriedadeId = inicial.propriedadeId;
      if (propriedadeId == null) throw new Error('Fixture de ciclo sem sítio.');
      await acao(c, `vinculo:${n}`, () => vincularPoliticaCiclo({ chave: key(`vinculo:${n}`), propriedadeId, animalId: inicial.animalId, situacaoInicialId: inicial.id }, uid(c)));
    }
  });
  await c.etapa('qa-historico', () => historico(c));
  await c.etapa('qa-agenda', () => agenda(c));
  await c.etapa('qa-interface', () => interfaceQa(c));
  await c.etapa('qa-importacao', () => prepararImportacaoQa(c));
  await c.etapa('qa-ambiguidade', async () => {
    await programar(c, 'Outra participação compatível', 'dias', [26], false);
  });
}
export async function verificarQa(c: Contexto) {
  const ids = [...faixa(1, 48), ...faixa(101, 313)].map(n => animal(c, n));
  assert.equal(await prisma.animal.count({ where: { id: { in: ids } } }), 261, 'Animais QA ausentes; não recrie dados testados.');
  assert.equal(await prisma.animal.count({ where: { id: { in: faixa(101, 309).map(n => animal(c, n)) }, sexo: 'F' } }), 209);
  assert.equal(await prisma.animal.count({ where: { id: { in: faixa(310, 313).map(n => animal(c, n)) }, sexo: 'M' } }), 4);
  for (const s of ['A', 'B', 'C']) await prisma.propriedade.findUniqueOrThrow({ where: { id: sitio(c, s) } });
  for (const perfil of ['consulta', 'operador', 'financeiro']) await prisma.usuario.findUniqueOrThrow({ where: { id: c.numero(ref(`usuario:${perfil}`)) } });
  assert.equal(await prisma.programacaoProtocolo.count({ where: { id: { in: Object.entries(c.manifesto.ids).filter(([k]) => k.startsWith(ref('programacao:'))).map(([, v]) => v) } } }), 7);
  assert.ok(await prisma.participanteIatf.count({ where: { programacaoId: c.id(ref('programacao:120 diagnósticos pendentes')) } }) >= 120, 'Participações originais ausentes.');
  for (const r of ['semen', 'embriao', 'sanitario']) for (const grupo of ['valido', 'vencido', 'incerto'])
    await prisma.partidaProduto.findUniqueOrThrow({ where: { id: c.id(ref(`partida:${r}:${grupo}`)) } });
  assert.ok(await prisma.partoAnimal.count({ where: { animalId: { in: faixa(41, 46).map(n => animal(c, n)) } } }) >= 6, 'Histórico de partos ausente.');
  const parto = await prisma.partoAnimal.findFirstOrThrow({ where: { animalId: animal(c, 41) } });
  assert.ok(await prisma.fornecimentoColostro.count({ where: { cria: { partoId: parto.id } } }) >= 2, 'Fornecimentos preparados ausentes.');
  for (const n of [801, 802, 803]) await prisma.animal.findUniqueOrThrow({ where: { id: c.id(ref(`importacao:${n}`)) } });
  const politicas = await prisma.politicaElegibilidadeReprodutiva.findMany({ where: { propriedadeId: { in: ['A', 'B', 'C'].map(s => sitio(c, s)) } } });
  console.log(`[qa-v4] Data-base ${c.manifesto.dataBase}; 261 animais operacionais + 3 para importação + crias, 120 participantes no grupo de DG; ${politicas.length} políticas cadastradas.`);
  console.log(`[qa-v4] Sítios: A=${sitio(c)}, B=${sitio(c, 'B')}, C=${sitio(c, 'C')}. Manifesto: server/.seedatev3/qa-v4/manifesto.json`);
  console.log(`[qa-v4] Visita /pecuaria/visitas/${c.id(ref('visita:Entrada vazia'))}`);
  console.log('[qa-v4] Verificação de integridade da preparação. Não aprova o roteiro nem restaura fatos alterados pela homologação.');
}
