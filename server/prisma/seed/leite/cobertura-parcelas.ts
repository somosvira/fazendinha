import { z } from 'zod';
import { prisma } from '../../../src/db.js';
import { criarParto } from '../../../src/services/pecuaria/reproducao/registros.js';
import { partoSchema } from '../../../src/services/pecuaria/reproducao/schemas.js';
import { registrarLactacaoHistorica } from '../../../src/services/pecuaria/reproducao/lactacoes.js';
import { criarConfiguracao } from '../../../src/services/pecuaria/leite/configuracoes.js';
import { salvarParcelasOrdenha } from '../../../src/services/pecuaria/leite/tanques.js';
import { salvarParcelasOrdenhaSchema, type ParcelaOrdenhaInput } from '../../../src/services/pecuaria/leite/tanques.schemas.js';
import { confirmarProducaoGeral, anularEntradaProducaoLeite } from '../../../src/services/pecuaria/leite/estoque.js';
import { dia, type Contexto } from '../contexto.js';
import { AVISO, key, ref } from './catalogo.js';
import { guardar, id, sitio, uid } from './base.js';
import { posicoes } from './producao.js';

export const COBERTURA_PARCELAS = {
  partoHistorico: { animal: 35, sitio: 'Arrendado', parto: -680, fimLactacao: -665, configuracao: -690, parcela: -679 },
  direta: { litros: 3, recipiente: 'V5 · Origem desconhecida segregada' },
  zero: { litros: 0, recipiente: 'V5 · Zero explícito segregado' },
  correcao: { litrosOriginais: 9, litrosCorrigidos: 8, recipiente: 'V5 · Parcela regularizada' },
  inclusao: { litros: 2, recipiente: 'V5 · Inclusão posterior segregada' },
} as const;
const reciboParcela = z.object({ sessaoId: z.string().uuid(), parcelas: z.array(z.object({ id: z.string().uuid() })).length(1) });

/** Cada sítio tem sua própria conferência de contexto no recibo de idempotência. */
async function executarNoSitio(c: Contexto, nome: string, propriedadeId: number, executar: () => Promise<unknown>, recuperar: (r: unknown) => unknown = r => r) {
  await c.acao(ref(nome), async () => false, async () => {
    const anterior = await prisma.requisicaoPecuaria.findUnique({ where: { chave: key(nome) } });
    if (anterior && (anterior.propriedadeId !== propriedadeId || anterior.usuarioId !== uid(c))) throw new Error(`Recibo de outro sítio ou autor: ${nome}.`);
    const resultado = anterior ? recuperar(anterior.resultadoIds) : await executar();
    if (resultado && typeof resultado === 'object' && 'id' in resultado && typeof resultado.id === 'string') await guardar(c, nome, resultado.id);
  });
}
async function salvar(c: Contexto, nome: string, propriedadeId: number, data: string, parcela: ParcelaOrdenhaInput) {
  await executarNoSitio(c, nome, propriedadeId, async () => {
    const salvo = await salvarParcelasOrdenha(salvarParcelasOrdenhaSchema.parse({ chave: key(nome), propriedadeId, dataOperacional: data, posicaoId: posicoes[1].posicaoId, parcelas: [parcela] }), uid(c));
    return salvo.parcelas[0];
  }, r => reciboParcela.parse(r).parcelas[0]);
}
function direta(recipiente: string, litros: number): ParcelaOrdenhaInput {
  return { recipiente, versaoEsperada: 0, litros, natureza: 'NAO_COMERCIAL', animaisOrigem: [], responsavel: 'Equipe demonstrativa', observacao: AVISO,
    declaracaoDireta: { justificativa: 'Origem individual não identificada; leite segregado e não comercial, sem presumir diagnóstico, carência ou parto.' } };
}

async function primeiraOrdenhaHistorica(c: Contexto) {
  const p = COBERTURA_PARCELAS.partoHistorico, propriedadeId = c.numero(`sitio:${p.sitio}`), animalId = c.id(`animal:${p.animal}`);
  const data = c.dias(p.parto), parcelaEm = c.dias(p.parcela), nomeParto = 'cobertura:parto-historico-arrendado', nomeLactacao = 'cobertura:lactacao-historica-arrendado';
  const local = await prisma.localizacaoAnimal.findMany({ where: { animalId, desde: { lte: dia(data) }, OR: [{ ate: null }, { ate: { gt: dia(data) } }] } });
  if (local.length !== 1 || local[0].propriedadeId !== propriedadeId) throw new Error('Matriz35 não possui localização única comprovada no Arrendado na data do parto histórico.');
  const nomeConfiguracao = 'cobertura:configuracao-primeira-ordenha';
  const configuracaoPreparada = await prisma.requisicaoPecuaria.findUnique({ where: { chave: key(nomeConfiguracao) } });
  if (configuracaoPreparada && (configuracaoPreparada.propriedadeId !== propriedadeId || configuracaoPreparada.usuarioId !== uid(c))) throw new Error('Configuração histórica pertence a outro sítio ou autor; pacote interrompido.');
  if (!configuracaoPreparada && await prisma.configuracaoOrdenha.count({ where: { propriedadeId } })) throw new Error('Arrendado já possui configuração de leite; pacote histórico interrompido antes de registrar fatos.');
  await executarNoSitio(c, nomeParto, propriedadeId, () => criarParto(partoSchema.parse({ chave: key(nomeParto), animalId, propriedadeId, data,
    tipo: 'NATIMORTO', desfecho: 'NASCIMENTO', iniciarLactacao: false, retencaoPlacenta: false,
    crias: [{ viva: false, sexo: 'F', aptidao: 'LEITE', pesoKg: 30 }], observacao: `${AVISO} Parto histórico natimorto durante a recria no Arrendado; sem inclusão de animal ativo.`,
  }), uid(c)));
  await executarNoSitio(c, nomeLactacao, propriedadeId, () => registrarLactacaoHistorica({ chave: key(nomeLactacao), animalId, propriedadeId,
    inicio: data, encerradaEm: c.dias(p.fimLactacao), partoId: id(c, nomeParto), motivo: 'Intervalo histórico conhecido e encerrado, separado da lactação atual no Principal.' }, uid(c)));
  await executarNoSitio(c, nomeConfiguracao, propriedadeId, async () => {
    if (await prisma.configuracaoOrdenha.count({ where: { propriedadeId } })) throw new Error('Arrendado já possui configuração de leite; não inserir vigência histórica por cima de outra rotina.');
    return criarConfiguracao({ chave: key(nomeConfiguracao), propriedadeId, vigenteDesde: c.dias(p.configuracao), fonteProducao: 'GERAL', intervaloIndividualQuantidade: 1, intervaloIndividualUnidade: 'MESES', criterioColostro: { tipo: 'PRIMEIRA_ORDENHA' }, ordenhas: posicoes }, uid(c));
  });
  await salvar(c, 'cobertura:primeira-ordenha-historica', propriedadeId, parcelaEm, {
    recipiente: 'V5 · Primeira ordenha histórica Arrendado', versaoEsperada: 0, litros: 3, natureza: 'COLOSTRO', animaisOrigem: [animalId],
    primeiraOrdenhaColostro: true, responsavel: 'Equipe demonstrativa', observacao: `${AVISO} Registro histórico apenas zootécnico, sem entrada de estoque e sem rotina leiteira atual no Arrendado.`,
  });
}

/** Pacote posterior: não altera medições/configurações já preparadas por outras etapas. */
export async function coberturaParcelas(c: Contexto) {
  await primeiraOrdenhaHistorica(c);
  const propriedadeId = sitio(c), data = c.dataBase, contexto = { propriedadeId, usuarioId: uid(c) };
  await salvar(c, 'cobertura:direta-desconhecida', propriedadeId, data, direta(COBERTURA_PARCELAS.direta.recipiente, COBERTURA_PARCELAS.direta.litros));
  await salvar(c, 'cobertura:zero-explicito', propriedadeId, data, direta(COBERTURA_PARCELAS.zero.recipiente, COBERTURA_PARCELAS.zero.litros));
  const nomeParcela = 'cobertura:parcela-regularizada', nomeEntrada = 'cobertura:entrada-original', nomeCorrecao = 'cobertura:parcela-corrigida';
  await salvar(c, nomeParcela, propriedadeId, data, direta(COBERTURA_PARCELAS.correcao.recipiente, COBERTURA_PARCELAS.correcao.litrosOriginais));
  await executarNoSitio(c, nomeEntrada, propriedadeId, () => confirmarProducaoGeral({ chave: key(nomeEntrada), medicaoId: id(c, nomeParcela), versaoEsperada: 1, produtoId: id(c, 'produto:nao-comercial'), motivoNatureza: AVISO }, contexto));
  await executarNoSitio(c, 'cobertura:anular-entrada-original', propriedadeId, () => anularEntradaProducaoLeite({ entradaId: id(c, nomeEntrada), motivo: 'Volume conferido novamente antes de qualquer consumo; preservada a entrada original e sua reversão.' }, contexto));
  await salvar(c, nomeCorrecao, propriedadeId, data, { ...direta(COBERTURA_PARCELAS.correcao.recipiente, COBERTURA_PARCELAS.correcao.litrosCorrigidos), id: id(c, nomeParcela), versaoEsperada: 1, motivoCorrecao: 'Recontagem demonstrativa após regularização da entrada original, sem apagar seu histórico.' });
  await executarNoSitio(c, 'cobertura:entrada-corrigida', propriedadeId, () => confirmarProducaoGeral({ chave: key('cobertura:entrada-corrigida'), medicaoId: id(c, nomeParcela), versaoEsperada: 2, produtoId: id(c, 'produto:nao-comercial'), motivoNatureza: AVISO }, contexto));
  // Mesma ordenha recebe outra identidade física depois da confirmação e da correção.
  await salvar(c, 'cobertura:inclusao-posterior', propriedadeId, data, direta(COBERTURA_PARCELAS.inclusao.recipiente, COBERTURA_PARCELAS.inclusao.litros));
}

function exigirCobertura(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(`Conferência das parcelas complementares: ${mensagem}.`);
}
/** Só consulta os fatos; não aprova roteiros nem restaura simulações. */
export async function verificarCoberturaParcelas(c: Contexto) {
  const p = COBERTURA_PARCELAS.partoHistorico, propriedadeArrendado = c.numero(`sitio:${p.sitio}`), animalId = c.id(`animal:${p.animal}`);
  const parto = await prisma.partoAnimal.findUniqueOrThrow({ where: { id: id(c, 'cobertura:parto-historico-arrendado') } });
  const crias = await prisma.criaParto.findMany({ where: { partoId: parto.id } });
  const lactacao = await prisma.lactacaoAnimal.findUniqueOrThrow({ where: { id: id(c, 'cobertura:lactacao-historica-arrendado') } });
  const configuracao = await prisma.configuracaoOrdenha.findUniqueOrThrow({ where: { id: id(c, 'cobertura:configuracao-primeira-ordenha') } });
  exigirCobertura(parto.animalId === animalId && parto.propriedadeId === propriedadeArrendado && parto.status === 'VALIDO' && parto.tipo === 'NATIMORTO' && parto.data.getTime() === dia(c.dias(p.parto)).getTime(), 'parto histórico da matriz35 no sítio/data comprovados');
  exigirCobertura(crias.length === 1 && crias.every(a => !a.viva && a.animalId === null), 'natimorto histórico não deve criar animal ativo');
  exigirCobertura(lactacao.animalId === animalId && lactacao.propriedadeId === propriedadeArrendado && lactacao.partoId === parto.id && lactacao.inicio.getTime() === parto.data.getTime() && lactacao.encerradaEm?.getTime() === dia(c.dias(p.fimLactacao)).getTime(), 'lactação histórica fechada e vinculada ao parto');
  exigirCobertura(configuracao.propriedadeId === propriedadeArrendado && configuracao.vigenteDesde.getTime() === dia(c.dias(p.configuracao)).getTime() && z.object({ tipo: z.literal('PRIMEIRA_ORDENHA') }).safeParse(configuracao.criterioColostro).success, 'vigência histórica de primeira ordenha');
  const nomes = ['cobertura:primeira-ordenha-historica', 'cobertura:direta-desconhecida', 'cobertura:zero-explicito', 'cobertura:parcela-regularizada', 'cobertura:inclusao-posterior'];
  const parcelas = await prisma.medicaoGeralLeite.findMany({ where: { id: { in: nomes.map(n => id(c, n)) } }, include: { sessao: { include: { dia: true } }, entradasEstoque: { include: { movimento: true } } } });
  exigirCobertura(parcelas.length === nomes.length, 'cinco parcelas próprias preservadas');
  const buscar = (nome: string) => { const parcela = parcelas.find(m => m.id === id(c, nome)); exigirCobertura(parcela, `parcela ${nome} ausente`); return parcela; };
  const historica = buscar(nomes[0]), direta = buscar(nomes[1]), zero = buscar(nomes[2]), corrigida = buscar(nomes[3]), inclusao = buscar(nomes[4]);
  exigirCobertura(historica.sessao.dia.propriedadeId === propriedadeArrendado && historica.sessao.dia.dataOperacional.getTime() === dia(c.dias(p.parcela)).getTime() && historica.sessao.dia.configuracaoId === configuracao.id && historica.natureza === 'COLOSTRO' && historica.primeiraOrdenhaColostro === true && historica.litros.eq(3) && z.array(z.string()).parse(historica.animaisOrigem).includes(animalId) && historica.entradasEstoque.length === 0, 'primeira ordenha histórica sem estoque');
  const provaHistorica = z.object({ configuracaoId: z.string(), criterio: z.object({ tipo: z.literal('PRIMEIRA_ORDENHA') }), partos: z.array(z.object({ id: z.string(), animalId: z.string(), versao: z.number() })).length(1) }).safeParse(historica.criterioColostroSnapshot);
  exigirCobertura(provaHistorica.success && provaHistorica.data.configuracaoId === configuracao.id && provaHistorica.data.partos[0].id === parto.id && provaHistorica.data.partos[0].animalId === animalId && provaHistorica.data.partos[0].versao === parto.versao, 'snapshot de primeira ordenha conserva a evidência versionada do parto');
  exigirCobertura([direta, zero, corrigida, inclusao].every(m => m.sessao.dia.propriedadeId === sitio(c) && m.sessao.dia.dataOperacional.getTime() === dia(c.dataBase).getTime() && m.natureza === 'NAO_COMERCIAL' && z.array(z.string()).parse(m.animaisOrigem).length === 0 && z.object({ justificativa: z.string().min(5) }).safeParse(m.declaracaoDireta).success), 'declarações diretas preservam origem desconhecida sem diagnóstico fabricado');
  exigirCobertura(direta.litros.eq(3) && zero.litros.eq(0) && inclusao.litros.eq(2) && [direta, zero, inclusao].every(m => m.entradasEstoque.length === 0), 'volumes diretos, zero e inclusão permanecem salvos sem entrada');
  exigirCobertura(corrigida.id === id(c, 'cobertura:parcela-corrigida') && corrigida.versao === 2 && corrigida.litros.eq(8), 'correção da mesma parcela para versão2/8L');
  const original = corrigida.entradasEstoque.find(e => e.id === id(c, 'cobertura:entrada-original'));
  const atual = corrigida.entradasEstoque.find(e => e.id === id(c, 'cobertura:entrada-corrigida'));
  exigirCobertura(original?.status === 'ANULADA' && original.movimento.status === 'REVERTIDO' && original.movimento.quantidade.eq(9) && atual?.status === 'CONFIRMADA' && atual.movimento.quantidade.eq(8), 'entrada original9L anulada e nova entrada8L confirmada');
  const inverso = await prisma.movimentoEstoque.findUniqueOrThrow({ where: { id: id(c, 'cobertura:anular-entrada-original') } });
  exigirCobertura(inverso.reversaoDeId === original.movimentoId && inverso.quantidade.eq(9) && inverso.data.getTime() === original.movimento.data.getTime() && inverso.propriedadeId === sitio(c), 'reversão mantém a origem e a data civil da entrada');
  exigirCobertura(inclusao.sessaoId === corrigida.sessaoId && inclusao.criadoEm >= atual.criadoEm, 'inclusão posterior na mesma sessão já confirmada');
  return { primeiraOrdenhaHistorica: { propriedadeId: propriedadeArrendado, data: c.dias(p.parcela), partoId: parto.id, lactacaoId: lactacao.id, parcelaId: historica.id, entradaEstoque: false },
    diretaOrigemDesconhecida: direta.id, zeroExplicito: zero.id, correcaoRegularizada: { parcelaId: corrigida.id, entradaAnulada: original.id, entradaConfirmada: atual.id, litros: 8 }, inclusaoPosterior: inclusao.id };
}
