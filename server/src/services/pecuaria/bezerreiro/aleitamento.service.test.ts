import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ tx: null as unknown as Prisma.TransactionClient, participantes: vi.fn(), perfil: vi.fn(), config: vi.fn(), lock: vi.fn(), origens: vi.fn(), baixa: vi.fn(), referencia: vi.fn(), valores: vi.fn(), estorno: vi.fn(), periodo: vi.fn(), animal: vi.fn(), auditar: vi.fn(), travarAnimais: vi.fn(), ingrediente: vi.fn(), registrar: vi.fn(), valorizacao: vi.fn() }));
vi.mock('../../../db.js', () => ({ prisma: { $transaction: (executar: (tx: Prisma.TransactionClient) => unknown) => executar(f.tx) } }));
vi.mock('../transacao.js', () => ({ transacaoPecuaria: (executar: (tx: Prisma.TransactionClient) => unknown) => executar(f.tx) }));
vi.mock('../../financeiro/regras.js', () => ({ exigirPeriodoAberto: f.periodo }));
vi.mock('../fatos.js', () => ({ conferirAnimalNoFato: f.animal }));
vi.mock('../rebanho/regras.js', async original => ({ ...await original<typeof import('../rebanho/regras.js')>(), auditar: f.auditar, travarAnimais: f.travarAnimais, hojeFazendaDate: () => new Date('2026-10-28T00:00:00Z') }));
vi.mock('../leite/nutricao.js', () => ({ origensNutricionaisLeiteTx: f.origens, baixarLeiteNutricionalTx: f.baixa, ingredienteLeiteProducaoTx: f.ingrediente, registrarFornecimentoNutricionalTx: f.registrar, estornarLeiteNutricionalTx: vi.fn(), consultarFornecimentosNutricionaisTx: vi.fn(), previaLeiteNutricionalTx: vi.fn() }));
vi.mock('../leite/referencias.js', () => ({ aplicarReferenciaProvisoriaTx: f.referencia }));
vi.mock('../../estoque/leite.js', () => ({ estornarBaixaLeiteTx: f.estorno, valoresMovimentosLeiteTx: f.valores }));
vi.mock('./gestao.js', async original => ({ ...await original<typeof import('./gestao.js')>(), configuracaoTx: f.config, obterPerfilTx: f.perfil, participantesNaDataTx: f.participantes, travarPerfil: f.lock }));
vi.mock('../../estoque/valorizacao.js', () => ({ travarValorizacaoTx: f.valorizacao, planejarSaidaTx: vi.fn(), registrarSaidaValorizadaTx: vi.fn() }));
import { confirmarConsumo } from '../nutricao/consumo.js';
import { confirmarOferta, consultarPrevisao, consultarOfertas, estornarOferta } from './aleitamento.js';
import { consultaSchema, confirmarOfertaSchema } from './schemas.js';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const data = new Date('2026-10-28T00:00:00Z');
const coleira = { id: id(4), nome: 'Vermelha', cor: '#ff0000' };
const ofertas = [{ id: id(10), identidadeId: id(11), ordem: 0, percentual: D(50), horarioPrevisto: null }, { id: id(12), identidadeId: id(13), ordem: 1, percentual: D(50), horarioPrevisto: null }];
function participante(n: number, litros = '4', percentuais = ['50', '50']) {
  return { id: id(20 + n), animalId: id(n), localizacaoComprovada: true, animal: { brinco: `00${n}`, nome: `Cria ${n}` }, fases: [{ faseVersao: { id: id(30 + n), publicada: true, litrosDia: D(litros), coleiraId: coleira.id, coleiraSnapshot: coleira, coleira: { ...coleira, nome: 'Nome alterado no catálogo' }, ofertas: ofertas.map((o, i) => ({ ...o, id: id(40 + n * 10 + i), percentual: D(percentuais[i]) })) } }] };
}
function modelo() { return { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() }; }
function mocks() { return { $executeRaw: vi.fn(), requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() }, ofertaBezerreiro: modelo(), grupoOfertaBezerreiro: modelo(), ofertaProgramadaBezerreiro: modelo(), itemFechamentoConsumo: modelo(), fornecimentoNutricionalLeite: modelo(), lote: modelo(), centroCusto: modelo(), vigenciaDietaLote: modelo(), localizacaoAnimal: modelo(), entradaProducaoLeite: modelo(), fechamentoConsumo: modelo() }; }
let m: ReturnType<typeof mocks>;
beforeEach(() => {
  vi.clearAllMocks(); m = mocks(); f.tx = m as unknown as Prisma.TransactionClient;
  const requisicoes = new Map<string, unknown>();
  m.requisicaoPecuaria.findUnique.mockImplementation(async ({ where }) => requisicoes.get(where.chave) ?? null);
  m.requisicaoPecuaria.create.mockImplementation(async ({ data }) => { requisicoes.set(data.chave, data); return data; });
  f.ingrediente.mockImplementation(async (_tx, produtoId) => produtoId === id(73));
  f.participantes.mockResolvedValue([participante(1)]);
  f.perfil.mockResolvedValue({ id: id(5), ativo: true, lote: { ativo: true } }); f.config.mockResolvedValue(null);
  f.origens.mockResolvedValue([{ entradaId: id(70), produtoId: id(71), produtoNome: 'Leite comercial', natureza: 'COMERCIAL', data: '2026-10-27', ordem: 0, quantidade: D(20) }, { entradaId: id(72), produtoId: id(73), produtoNome: 'Leite não comercial', natureza: 'NAO_COMERCIAL', data: '2026-10-28', ordem: 1, quantidade: D(20) }]);
  f.baixa.mockImplementation(async (_tx, v) => ({ movimentos: [{ movimentoId: id(80), entradaId: id(72), natureza: 'NAO_COMERCIAL', quantidadeLitros: v.quantidade }], custoProducao: D('2.50') }));
  m.fornecimentoNutricionalLeite.findMany.mockResolvedValue([]);
  m.ofertaBezerreiro.findMany.mockResolvedValue([]); m.ofertaBezerreiro.count.mockResolvedValue(0);
  let seq = 100;
  m.ofertaBezerreiro.create.mockImplementation(async ({ data }) => ({ id: id(seq++), versao: 1, status: 'CONFIRMADO', ...data }));
  m.grupoOfertaBezerreiro.create.mockImplementation(async ({ data }) => ({ id: id(seq++), ...data }));
  m.itemFechamentoConsumo.create.mockImplementation(async ({ data }) => ({ id: id(seq++), ...data }));
  m.fornecimentoNutricionalLeite.create.mockImplementation(async ({ data }) => ({ id: id(seq++), ...data }));
  m.ofertaProgramadaBezerreiro.findFirst.mockImplementation(async ({ where }) => ({ id: where.id, identidadeId: where.id === ofertas[0].id ? ofertas[0].identidadeId : ofertas[1].identidadeId }));
});
async function confirmar(n: number, extra = {}) { const previa = await consultarPrevisao(1, consultaSchema.parse({ data: '2026-10-28', perfilId: id(5) })); return { ...confirmarOfertaSchema.parse({ contextoToken: previa.contextoToken, chave: id(200 + n), perfilId: id(5), data: '2026-10-28', ofertaProgramadaId: ofertas[0].id, responsavel: 'Tratador', grupos: [{ coleiraId: coleira.id, quantidadeLitros: '2' }], ...extra }), propriedadeId: 1 }; }

describe('alimentação coletiva do bezerreiro', () => {
  it('confirma duas ofertas legítimas no mesmo horário sem fabricar dias ou fechamentos', async () => {
    const ocorridoEm = '2026-10-28T09:00:00Z';
    await confirmarOferta(await confirmar(1, { ocorridoEm }), 7);
    await confirmarOferta(await confirmar(2, { ocorridoEm, ofertaProgramadaId: ofertas[1].id }), 7);
    expect(m.ofertaBezerreiro.create).toHaveBeenCalledTimes(2); expect(f.baixa).toHaveBeenCalledTimes(2);
    for (const [args] of m.itemFechamentoConsumo.create.mock.calls) {
      expect(args.data).toMatchObject({ modoEstoque: 'BAIXA_ESTOQUE', situacaoCusto: 'CONHECIDO' });
      expect(args.data.fechamentoId).toBeUndefined(); expect(args.data.movimentoEstoqueId).toBeUndefined();
    }
    const parcelas = m.fornecimentoNutricionalLeite.create.mock.calls.flatMap(([args]) => args.data.parcelas.create);
    expect(parcelas.every(p => p.dias === null && p.baseQuantidade === 'ATRIBUIDA' && p.criterioAtribuicao === 'ATRIBUIDA_POR_OFERTA')).toBe(true);
    expect(parcelas.reduce((n, p) => n.plus(p.quantidadeLitros), D(0)).toFixed(3)).toBe('4.000');
    expect(f.baixa).toHaveBeenCalledWith(f.tx, expect.objectContaining({ produtoId: id(73) }));
  });
  it.each([
    { ocorridoEm: undefined, horarioEstimado: false, esperado: null },
    { ocorridoEm: null, horarioEstimado: false, esperado: null },
    { ocorridoEm: '2026-10-28T01:30:00-03:00', horarioEstimado: false, esperado: new Date('2026-10-28T04:30:00Z') },
    { ocorridoEm: '2026-10-28T06:00:00-03:00', horarioEstimado: true, esperado: new Date('2026-10-28T09:00:00Z') },
  ])('projeta somente os campos da oferta com o normalizador real: $ocorridoEm, estimado=$horarioEstimado', async horario => {
    const entrada = await confirmar(1, { ocorridoEm: horario.ocorridoEm, horarioEstimado: horario.horarioEstimado });
    await confirmarOferta(entrada, 7);
    const payload = m.ofertaBezerreiro.create.mock.calls[0][0].data;
    expect(Object.keys(payload).sort()).toEqual([
      'perfilId', 'propriedadeId', 'data', 'ocorridoEm', 'horarioEstimado', 'ofertaProgramadaId',
      'configuracaoId', 'configuracaoSnapshot', 'chave', 'hash', 'responsavel', 'observacao', 'criadoPorId',
    ].sort());
    expect(payload).toMatchObject({ data, ocorridoEm: horario.esperado, horarioEstimado: horario.horarioEstimado });
    const original = await confirmarOferta(entrada, 7);
    expect(original).toMatchObject({ status: 'CONFIRMADO' });
    expect(m.ofertaBezerreiro.create).toHaveBeenCalledOnce(); expect(f.baixa).toHaveBeenCalledOnce();
  });
  it('valida o dia civil real e não fabrica instante quando o horário estimado está ausente', async () => {
    await expect(confirmarOferta(await confirmar(1, { ocorridoEm: '2026-10-28T01:00:00Z' }), 7)).rejects.toMatchObject({ code: 'VALIDACAO', campo: 'ocorridoEm' });
    await expect(confirmarOferta(await confirmar(2, { ocorridoEm: null, horarioEstimado: true }), 7)).rejects.toMatchObject({ code: 'VALIDACAO', campo: 'horarioEstimado' });
    expect(m.ofertaBezerreiro.create).not.toHaveBeenCalled(); expect(f.baixa).not.toHaveBeenCalled();
  });
  it('usa programação da oferta para atribuir litros entre fases de mesma coleira', async () => {
    f.participantes.mockResolvedValue([participante(1, '4', ['25', '75']), participante(2, '4', ['75', '25'])]);
    await confirmarOferta(await confirmar(1, { grupos: [{ coleiraId: coleira.id, quantidadeLitros: '4' }] }), 7);
    const p = m.fornecimentoNutricionalLeite.create.mock.calls[0][0].data.parcelas.create;
    expect(p.map((v: { animalId: string; quantidadeLitros: Prisma.Decimal }) => [v.animalId, v.quantidadeLitros.toFixed(3)])).toEqual(expect.arrayContaining([[id(1), '1.000'], [id(2), '3.000']]));
    expect(m.grupoOfertaBezerreiro.create.mock.calls[0][0].data.participantesSnapshot[0]).toMatchObject({ animalId: id(1), coleira, criterioAtribuicao: 'QUANTIDADE_PROGRAMADA_OFERTA' });
  });
  it('volume real sem dose usa participantes comprovados, justificativa e critério explícito', async () => {
    f.participantes.mockResolvedValue([participante(1, '0'), participante(2, '0')]);
    await confirmarOferta(await confirmar(1, { ofertaProgramadaId: null, grupos: [{ coleiraId: coleira.id, quantidadeLitros: '1', justificativa: 'Oferta excepcional confirmada no manejo' }] }), 7);
    const p = m.fornecimentoNutricionalLeite.create.mock.calls[0][0].data.parcelas.create;
    expect(p.map((v: { quantidadeLitros: Prisma.Decimal }) => v.quantidadeLitros.toFixed(3))).toEqual(['0.500', '0.500']);
    expect(p[0].programacaoSnapshot[0]).toMatchObject({ criterioAtribuicao: 'CONTAGEM_PARTICIPANTES', pesoAtribuicao: '1' });
  });
  it('não grava oferta sem quantidade positiva e não aceita coleira null repetida', async () => {
    await expect(confirmarOferta(await confirmar(1, { grupos: [{ quantidadeLitros: '0' }] }), 7)).rejects.toThrow('volume positivo');
    await expect(confirmarOferta(await confirmar(2, { grupos: [{ quantidadeLitros: '1' }, { coleiraId: null, quantidadeLitros: '2' }] }), 7)).rejects.toThrow('Coleira repetida');
    expect(m.ofertaBezerreiro.create).not.toHaveBeenCalled();
  });
  it('seleção explícita vazia não consome automaticamente outras origens', async () => {
    await expect(confirmarOferta(await confirmar(1, { grupos: [{ coleiraId: coleira.id, quantidadeLitros: '2', entradaIds: [] }] }), 7)).rejects.toThrow('Nenhuma origem');
    expect(f.baixa).not.toHaveBeenCalled();
  });
  it('respeita o período fechado antes de qualquer baixa', async () => {
    f.periodo.mockRejectedValueOnce(new Error('Período financeiro fechado'));
    await expect(confirmarOferta(await confirmar(1), 7)).rejects.toThrow('fechado');
    expect(f.baixa).not.toHaveBeenCalled(); expect(m.ofertaBezerreiro.create).not.toHaveBeenCalled();
  });
  it('reenvio idêntico não repete baixa e outra carga com a mesma chave conflita', async () => {
    const entrada = await confirmar(1);
    const a = await confirmarOferta(entrada, 7), b = await confirmarOferta(entrada, 7);
    expect(a).toEqual(b); expect(f.baixa).toHaveBeenCalledTimes(1);
    await expect(confirmarOferta({ ...entrada, observacao: 'Dados alterados' }, 7)).rejects.toMatchObject({ code: 'CONFLITO' });
  });
  it('recusa a troca A→B de dose igual antes de criar oferta ou baixar estoque', async () => {
    const entrada = await confirmar(1);
    f.participantes.mockResolvedValue([participante(2)]);
    await expect(confirmarOferta(entrada, 7)).rejects.toMatchObject({ code: 'CONFLITO', campo: 'contextoToken' });
    expect(m.ofertaBezerreiro.create).not.toHaveBeenCalled(); expect(f.baixa).not.toHaveBeenCalled();
  });
  it.each(['fase', 'dose', 'permanencia', 'programacao', 'data', 'perfil'])('invalida contexto alterado: %s', async alteracao => {
    const entrada = await confirmar(1);
    const p = participante(1);
    if (alteracao === 'fase') p.fases[0].faseVersao.id = id(800);
    if (alteracao === 'dose') p.fases[0].faseVersao.litrosDia = D(5);
    if (alteracao === 'permanencia') p.id = id(801);
    if (alteracao === 'programacao') p.fases[0].faseVersao.ofertas[0].percentual = D(40);
    f.participantes.mockResolvedValue([p]);
    await expect(confirmarOferta({ ...entrada, ...(alteracao === 'data' ? { data: '2026-10-27' } : {}), ...(alteracao === 'perfil' ? { perfilId: id(802) } : {}) }, 7)).rejects.toMatchObject({ code: 'CONFLITO' });
    expect(f.baixa).not.toHaveBeenCalled(); expect(m.ofertaBezerreiro.create).not.toHaveBeenCalled();
  });
  it('token independe do filtro e da ordem de retorno, mas conserva a identidade dos participantes', async () => {
    f.participantes.mockResolvedValue([participante(1), participante(2)]);
    const a = await consultarPrevisao(1, consultaSchema.parse({ data: '2026-10-28', perfilId: id(5) }));
    f.participantes.mockResolvedValue([participante(2), participante(1)]);
    const b = await consultarPrevisao(1, consultaSchema.parse({ data: '2026-10-28', perfilId: id(5), animalId: id(1), pagina: 2 }));
    expect(a.contextoToken).toBe(b.contextoToken); expect(b.grupos[0].participantes).toHaveLength(1);
  });
  it('recupera replay concluído antes de consultar contexto novo', async () => {
    const entrada = await confirmar(1); const original = await confirmarOferta(entrada, 7);
    const leituras = f.participantes.mock.calls.length; f.participantes.mockResolvedValue([participante(2)]);
    expect(await confirmarOferta(entrada, 7)).toEqual(original);
    expect(f.participantes).toHaveBeenCalledTimes(leituras); expect(f.baixa).toHaveBeenCalledOnce();
  });
  it('rejeita cliente antigo sem contexto explícito', async () => {
    const entrada = await confirmar(1); delete (entrada as { contextoToken?: string }).contextoToken;
    await expect(confirmarOferta(entrada, 7)).rejects.toMatchObject({ code: 'VALIDACAO' }); expect(f.baixa).not.toHaveBeenCalled();
  });
  describe('conciliação cruzada com Nutrição', () => {
    const diaAnterior = new Date('2026-10-27T00:00:00Z');
    function preparar() {
      type Fato = { id: string; status: string; itemId: string; data: Date; parcelas: { animalId: string; quantidadeLitros: Prisma.Decimal }[] };
      type Fechamento = { id: string; status: string; inicio: Date; fim: Date; loteId: string };
      const fatos: Fato[] = [], itens = new Map<string, { grupoOfertaId?: string; fechamentoId?: string }>(), grupos = new Map<string, { id: string; ofertaId: string }>(), ofertas = new Map<string, { id: string; status: string }>(), fechamentos = new Map<string, Fechamento>();
      let seq = 300;
      m.lote.findFirst.mockResolvedValue({ id: id(6), nome: 'Bezerreiro', centroCustoId: id(7) });
      m.centroCusto.findFirst.mockResolvedValue({ id: id(7) });
      m.localizacaoAnimal.findMany.mockResolvedValue([{ animalId: id(1), loteId: id(6), desde: diaAnterior, ate: null }]);
      m.entradaProducaoLeite.findMany.mockResolvedValue([]);
      m.vigenciaDietaLote.findFirst.mockResolvedValue({ id: id(8), dieta: { nome: 'Dieta', publicadaEm: data, itens: [
        { produtoId: id(73), unidade: 'L', quantidadeCabecaDia: D(4), materiaSecaPercentualSnapshot: null, produto: { nome: 'Leite', rastrearPartidas: false } },
        { produtoId: id(74), unidade: 'KG', quantidadeCabecaDia: D(1), materiaSecaPercentualSnapshot: null, produto: { nome: 'Ração', rastrearPartidas: false } },
      ] } });
      m.ofertaBezerreiro.create.mockImplementation(async ({ data }) => {const v = { id: id(seq++), versao: 1, status: 'CONFIRMADO', ...data }; ofertas.set(v.id, v); return v;});
      m.grupoOfertaBezerreiro.create.mockImplementation(async ({ data }) => {const v = { id: id(seq++), ...data }; grupos.set(v.id, v); return v;});
      m.itemFechamentoConsumo.create.mockImplementation(async ({ data }) => {const v = { id: id(seq++), ...data }; itens.set(v.id, v); return v;});
      m.fechamentoConsumo.create.mockImplementation(async ({ data }) => {const v = { id: id(seq++), status: 'CONFIRMADO', ...data }; fechamentos.set(v.id, v); return v;});
      const registrar = (data: Omit<Fato, 'id' | 'status'>) => {const v = { id: id(seq++), status: 'CONFIRMADO', ...data }; fatos.push(v); return v;};
      m.fornecimentoNutricionalLeite.create.mockImplementation(async ({ data }) => registrar({...data, parcelas: data.parcelas.create}));
      f.registrar.mockImplementation(async (_tx, v) => registrar({...v, quantidadeLitros: v.quantidade, parcelas: v.participacoes.map((p: {animalId:string}) => ({ animalId: p.animalId, quantidadeLitros: v.quantidade }))}));
      m.fornecimentoNutricionalLeite.findMany.mockImplementation(async ({ where }) => fatos.flatMap(fato => {
        const item = itens.get(fato.itemId)!, grupo = item.grupoOfertaId ? grupos.get(item.grupoOfertaId) : undefined, fechamento = item.fechamentoId ? fechamentos.get(item.fechamentoId) : undefined;
        const porOferta = !!where.ItemFechamentoConsumo.grupoOferta;
        if ((porOferta && (!grupo || ofertas.get(grupo.ofertaId)?.status !== 'CONFIRMADO')) || (!porOferta && (!fechamento || fechamento.status !== 'CONFIRMADO')) || fato.status !== 'CONFIRMADO') return [];
        if (porOferta && (fato.data < where.data.gte || fato.data > where.data.lte)) return [];
        if (!porOferta && fechamento && (fechamento.inicio > where.ItemFechamentoConsumo.fechamento.is.inicio.lte || fechamento.fim < where.ItemFechamentoConsumo.fechamento.is.fim.gte)) return [];
        if (!fato.parcelas.some((p: {animalId:string}) => where.parcelas.some.animalId.in.includes(p.animalId))) return [];
        return [{...fato, ItemFechamentoConsumo:{...item,grupoOferta:grupo?{...grupo,oferta:ofertas.get(grupo.ofertaId)}:null,fechamento}}];
      }));
      return { fatos, ofertas, fechamentos };
    }
    function fechamento(leite = 4) { return { chave: id(901), propriedadeId: 1, loteId: id(6), inicio: '2026-10-28', fim: '2026-10-28', itens: [
      { produtoId: id(73), quantidadeConfirmada: leite, motivoAjuste: leite === 0 ? 'Leite já confirmado nas ofertas do Bezerreiro' : undefined, modoEstoque: 'BAIXA_ESTOQUE' as const, origensLeite: [id(72)] },
      { produtoId: id(74), quantidadeConfirmada: 1, modoEstoque: 'SEM_BAIXA_JUSTIFICADA' as const, justificativaSemBaixa: 'Alimento próprio conferido' },
    ] }; }
    it('oferta → fechamento: recusa parcela leiteira antes de criar; zero justificado conserva os demais ingredientes', async () => {
      preparar(); await confirmarOferta(await confirmar(1), 7);
      await expect(confirmarConsumo(fechamento(), 7)).rejects.toMatchObject({ code: 'CONFLITO' });
      expect(m.fechamentoConsumo.create).not.toHaveBeenCalled(); expect(f.baixa).toHaveBeenCalledOnce();
      const resultado = await confirmarConsumo(fechamento(0), 7);
      expect(resultado.itens).toHaveLength(2); expect(resultado.itens[0].quantidadeConfirmada.toFixed(3)).toBe('0.000');
      expect(resultado.itens[1].quantidadeConfirmada.toFixed(3)).toBe('1.000'); expect(f.baixa).toHaveBeenCalledOnce();
      expect(await confirmarConsumo(fechamento(0), 7)).toEqual(JSON.parse(JSON.stringify(resultado)));
      expect(m.fechamentoConsumo.create).toHaveBeenCalledOnce();
    });
    it('fechamento → oferta: bloqueia sobreposição e permite somente consumo adicional declarado e justificado', async () => {
      preparar(); await confirmarConsumo(fechamento(), 7);
      const entrada = await confirmar(1);
      await expect(confirmarOferta(entrada, 7)).rejects.toMatchObject({ code: 'CONFLITO' });
      expect(m.ofertaBezerreiro.create).not.toHaveBeenCalled(); expect(f.baixa).toHaveBeenCalledOnce();
      await expect(confirmarOferta({...entrada, grupos: entrada.grupos.map(g=>({...g,consumoAdicional:true}))},7)).rejects.toMatchObject({code:'VALIDACAO'});
      await confirmarOferta({...entrada, grupos: entrada.grupos.map(g=>({...g,consumoAdicional:true,justificativa:'Novo consumo adicional conferido'}))},7);
      expect(f.baixa).toHaveBeenCalledTimes(2);
      expect(m.grupoOfertaBezerreiro.create.mock.calls[0][0].data.participantesSnapshot[0].consumoAdicional).toBe(true);
    });
    it('período parcialmente coberto recusa todo o leite sobreposto; outro animal permanece operável', async () => {
      preparar(); await confirmarOferta(await confirmar(1), 7);
      await expect(confirmarConsumo({...fechamento(), inicio:'2026-10-27'},7)).rejects.toMatchObject({code:'CONFLITO'});
      m.localizacaoAnimal.findMany.mockResolvedValue([{animalId:id(2),loteId:id(9),desde:diaAnterior,ate:null}]);
      await confirmarConsumo(fechamento(),7); expect(f.baixa).toHaveBeenCalledTimes(2);
    });
    it('oferta estornada não bloqueia o fechamento e fechamento estornado não bloqueia a oferta', async () => {
      const estado=preparar(); const oferta=await confirmarOferta(await confirmar(1),7);
      estado.ofertas.get(oferta.id)!.status='ESTORNADO';
      const consumido=await confirmarConsumo(fechamento(),7); estado.fechamentos.get(consumido.id)!.status='ESTORNADO';
      await confirmarOferta(await confirmar(2),7); expect(f.baixa).toHaveBeenCalledTimes(3);
    });
    it('ambas as entradas adquirem o lock comum antes dos animais e da valorização', async () => {
      preparar(); await confirmarOferta(await confirmar(1),7);
      await confirmarConsumo(fechamento(0),7);
      const locks=m.$executeRaw.mock.calls.map((args,i)=>({args,i})).filter(v=>v.args.some(arg=>typeof arg==='string'&&arg==='pec-alimentacao-leite:1'));
      expect(locks).toHaveLength(2);
      expect(m.$executeRaw.mock.invocationCallOrder[locks[0].i]).toBeLessThan(f.travarAnimais.mock.invocationCallOrder[0]);
      expect(m.$executeRaw.mock.invocationCallOrder[locks[1].i]).toBeLessThan(f.valorizacao.mock.invocationCallOrder[0]);
    });
  });
  it('prévia diária rejeita período e calcula o recorte animal pelas parcelas atribuídas', async () => {
    await expect(consultarPrevisao(1, consultaSchema.parse({ de: '2026-10-01' }))).rejects.toThrow('previsão é diária');
    f.participantes.mockResolvedValue([participante(1), participante(2)]);
    m.ofertaBezerreiro.findMany.mockResolvedValue([{ id: id(90), data, grupos: [{ coleiraId: coleira.id, quantidadeLitros: D(4), itemConsumo: { FornecimentoNutricionalLeite: { parcelas: [{ animalId: id(1), quantidadeLitros: D(1) }, { animalId: id(2), quantidadeLitros: D(3) }] } } }] }]);
    const r = await consultarPrevisao(2, consultaSchema.parse({ data: '2026-10-28', animalId: id(1), perfilId: id(5) }));
    expect(r.totalPrevistoLitros).toBe('4.000'); expect(r.totalFornecidoLitros).toBe('1.000'); expect(r.grupos[0].nome).toBe('Vermelha');
    expect(f.participantes).toHaveBeenLastCalledWith(f.tx, 2, data, id(5));
  });
  it('estorno reconsulta estado depois do lock e não repete inversos', async () => {
    m.ofertaBezerreiro.findFirst.mockResolvedValueOnce({ perfilId: id(5) }).mockResolvedValueOnce({ status: 'ESTORNADO', versao: 2 });
    await expect(estornarOferta(id(90), { chave: id(222), propriedadeId: 1, versaoEsperada: 1, motivo: 'Correção conferida' }, 7)).rejects.toThrow('já alterada ou estornada');
    expect(f.estorno).not.toHaveBeenCalled();
  });
  it('consulta sem valores não busca custos nem devolve referência comercial', async () => {
    m.ofertaBezerreiro.findMany.mockResolvedValue([{ id: id(90), data, grupos: [{ id: id(91), coleiraId: coleira.id, coleira, participantesSnapshot: [{ animalId: id(1), coleira }], quantidadeLitros: D(2), quantidadePrevistaLitros: D(2), itemConsumo: { FornecimentoNutricionalLeite: { id: id(92), movimentos: [{ movimentoId: id(93) }], referencias: [{ valorTotal: D(100) }], parcelas: [] } } }] }]);
    const r = await consultarOfertas(1, consultaSchema.parse({}), false);
    expect(r.itens[0].grupos[0]).toMatchObject({ custoProducao: null, referencia: null }); expect(f.valores).not.toHaveBeenCalled();
  });
});
