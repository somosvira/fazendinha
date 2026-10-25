import { describe, expect, it } from 'vitest';
import { calendario, intervalo } from './catalogo.js';
describe('calendário leiteiro integrado',()=>{
  it('cobre o mês anterior inteiro, incluindo fevereiro bissexto',()=>{
    const c=calendario('2024-03-01');
    const dias=intervalo(c.inicio,c.fimAnterior);
    expect(dias).toHaveLength(29);expect(dias[0]).toBe('2024-02-01');expect(dias.at(-1)).toBe('2024-02-29');
    expect(c.confirmacaoIndividual<c.inicio).toBe(true);
  });
  it('não gera fatos futuros no mês em curso',()=>{
    const c=calendario('2026-10-03');
    expect(intervalo(c.inicioAtual,c.hoje)).toEqual(['2026-10-01','2026-10-02','2026-10-03']);
    expect(c.controle<=c.hoje).toBe(true);
  });
});

// Simula somente as fronteiras dos serviços; nenhuma conexão ou fixture persistente é criada.
import { beforeEach, vi } from 'vitest';
import { Contexto, BANCO } from '../contexto.js';
import { key, ref } from './catalogo.js';
const estado = vi.hoisted(() => ({
  eventos: [] as Array<{ tipo: string; data: string; litros?: number }>,
  medicoes: new Map<string, string>(), recibos: new Map<string, { id?: string; retiradaId?: string; sessaoId?: string; parcelas?: Array<{ id: string }> }>(),
  consumos: [] as Array<{ propriedadeId: number; fim: string; itens: Array<{ produtoId: string; quantidadeConfirmada?: number }> }>,
  ultimoFechamento: '', interromperParcela: false,
}));
vi.mock('../../../src/db.js', () => ({ prisma: {
  usuario: { findUniqueOrThrow: vi.fn() },
  requisicaoPecuaria: {
    findUnique: vi.fn(async ({ where }: { where: { chave: string } }) => {
      const resultadoIds = estado.recibos.get(where.chave); return resultadoIds ? { resultadoIds, propriedadeId: 1, usuarioId: 1 } : null;
    }),
    findUniqueOrThrow: vi.fn(async ({ where }: { where: { chave: string } }) => ({ resultadoIds: estado.recibos.get(where.chave) })),
  },
  operacaoComercialLeite: { findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, versao: 1 })) },
  medicaoGeralLeite: { findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, versao: 1 })) },
  dieta: { findFirst: vi.fn(async () => null), findUniqueOrThrow: vi.fn(async () => ({ publicadaEm: new Date() })) },
  vigenciaDietaLote: { findFirst: vi.fn(async () => null) },
  fechamentoConsumo: {
    findFirst: vi.fn(async () => null), findFirstOrThrow: vi.fn(async () => ({ id: estado.ultimoFechamento })),
    findUniqueOrThrow: vi.fn(async () => ({ status: 'CONFIRMADO' })),
  },
} }));
vi.mock('../../../src/services/estoque/produtos.js', () => ({ criarProduto: vi.fn() }));
vi.mock('../../../src/services/pecuaria/leite/configuracoes.js', () => ({ criarConfiguracao: vi.fn(async ({ chave }: { chave: string }) => ({ id: chave })) }));
vi.mock('../../../src/services/pecuaria/leite/producao.js', () => ({
  consultarFolha: vi.fn(async () => ({ versao: 0, animais: [{ animalId: key('animal'), lactacaoId: key('lactacao'), excluidoEm: null }] })),
  salvarFolha: vi.fn(async ({ chave }: { chave: string }) => ({ id: chave })),
}));
vi.mock('../../../src/services/pecuaria/leite/tanques.js', () => ({
  registrarTanque: vi.fn(),
  consultarOrdenhasGerais: vi.fn(async () => ({
    contexto: { origensColostro: [], carencias: [0, 1, 2].map(i => ({ posicaoId: key(`posicao:${i}`), animais: [{ animalId: key('animal'), estado: 'SEM_RESTRICAO_REGISTRADA' }] })) },
    origensAutomaticas: [{ animalId: key('animal') }],
  })),
  salvarParcelasOrdenha: vi.fn(async (input: { chave: string; dataOperacional: string; parcelas: Array<{ litros: number }> }) => {
    estado.medicoes.set(input.chave, input.dataOperacional);
    const resultado = { sessaoId: key('sessao'), parcelas: [{ id: input.chave }] };
    estado.recibos.set(input.chave, resultado);
    if (estado.interromperParcela) { estado.interromperParcela = false; throw new Error('Resposta perdida após commit SQL.'); }
    return resultado;
  }),
}));
vi.mock('../../../src/services/pecuaria/leite/estoque.js', () => ({
  confirmarSessaoProducaoLeite: vi.fn(), venderLeite: vi.fn(),
  confirmarProducaoGeral: vi.fn(async (input: { chave: string; medicaoId: string }) => {
    const data = estado.medicoes.get(input.medicaoId)!;
    estado.eventos.push({ tipo: 'entrada', data }); return { id: input.chave };
  }),
}));
vi.mock('../../../src/services/pecuaria/leite/comercial.operacoes.js', () => ({
  abrirOperacaoLeite: vi.fn(async (input: { chave: string }) => {
    const resultado = { id: input.chave }; estado.recibos.set(input.chave, resultado); return resultado;
  }),
  retirarOperacaoLeite: vi.fn(async (id: string, input: { chave: string; data: string; quantidadeLitros: number }) => {
    // A mesma garantia operacional que rejeitava a ordem anterior da seed.
    if (estado.eventos.some(e => e.data > input.data)) throw new Error('Saída retroativa após produção posterior.');
    estado.eventos.push({ tipo: 'coleta', data: input.data, litros: input.quantidadeLitros });
    const resultado = { id, retiradaId: input.chave }; estado.recibos.set(input.chave, resultado); return resultado;
  }), fecharOperacaoLeite: vi.fn(),
}));
vi.mock('../../../src/services/pecuaria/leite/comercial.js', () => ({ registrarEntregaLeite: vi.fn(), registrarDemonstrativoLeite: vi.fn() }));
vi.mock('../../../src/services/financeiro/operacoes.js', () => ({ liquidarCompromisso: vi.fn() }));
vi.mock('../../../src/services/pecuaria/nutricao/dietas.js', () => ({
  criarDieta: vi.fn(async ({ nome }: { nome: string }) => ({ id: key(nome) })), publicarDieta: vi.fn(),
  atribuirDieta: vi.fn(async ({ loteId }: { loteId: string }) => ({ id: key(loteId) })),
}));
vi.mock('../../../src/services/pecuaria/nutricao/consumo.js', () => ({
  previaConsumo: vi.fn(async () => ({ itens: ['racao', 'mineral', 'silagem'].map(r => ({ produtoId: key(r), quantidadePrevista: 10 })) })),
  confirmarConsumo: vi.fn(async (input: { chave: string; propriedadeId: number; fim: string; itens: Array<{ produtoId: string; quantidadeConfirmada?: number }> }) => {
    if (estado.consumos.some(c => c.propriedadeId === input.propriedadeId && c.fim > input.fim)) throw new Error('Consumo retroativo no mesmo sítio.');
    estado.consumos.push(input); estado.ultimoFechamento = input.chave;
  }),
  estornarFechamento: vi.fn(async () => { estado.eventos.push({ tipo: 'estorno', data: estado.consumos.at(-1)!.fim }); }),
}));
import { producaoGeral } from './producao.js';
import { salvarParcelasOrdenha } from '../../../src/services/pecuaria/leite/tanques.js';
import { quantidadeColetaDia, registrarRetiradaDia } from './comercial.js';
import { nutricaoGeral } from '../nutricao.js';
function contexto(dataBase: string) {
  const c = new Contexto({ versao: 1, banco: BANCO, identidade: 'unitario', baseline: { nome: 'base', checksum: 'a'.repeat(64) }, fuso: 'America/Sao_Paulo', dataBase, ids: { 'usuario:dono': '1', 'sitio:Principal': '1', 'sitio:Arrendado': '2', 'sitio:Test': '3' }, etapas: [], acoes: [], criadoEm: '2026-10-24T12:00:00.000Z' }, false);
  for (const nome of ['produto:comercial', 'tanque:principal']) c.manifesto.ids[ref(nome)] = key(nome);
  c.manifesto.ids['parceiro:cliente'] = key('cliente'); c.manifesto.ids['centro:Pecuária'] = key('centro');
  for (const r of ['racao', 'mineral', 'silagem']) {
    c.manifesto.ids[`produto:${r}`] = key(r); c.manifesto.ids[`partida:${r}`] = key(`partida:${r}`);
    for (const s of ['Principal', 'Arrendado', 'Test']) c.manifesto.ids[`partida:${s}:${r}`] = key(`partida:${r}`);
  }
  for (const lote of ['Lactantes', 'Novilhas', 'Novilhas arrendado', 'Receptoras arrendado', 'Matrizes test']) c.manifesto.ids[`lote:${lote}`] = key(lote);
  vi.spyOn(c, 'salvar').mockResolvedValue(); return c;
}
beforeEach(() => {
  vi.clearAllMocks();
  estado.eventos.length = 0; estado.consumos.length = 0; estado.medicoes.clear(); estado.recibos.clear(); estado.ultimoFechamento = ''; estado.interromperParcela = false;
});
describe('ordem dos fatos da seed', () => {
  it('recupera o ID da parcela pelo recibo real após perder a resposta do commit, sem repetir a escrita', async () => {
    const c = contexto('2026-10-01'), medicao = 'medicao:2026-10-01:0:principal';
    estado.interromperParcela = true;
    await expect(producaoGeral(c, 'atual')).rejects.toThrow('Resposta perdida após commit SQL');
    expect(c.manifesto.ids[ref(medicao)]).toBeUndefined();
    expect(estado.recibos.get(key(medicao))).toEqual({ sessaoId: key('sessao'), parcelas: [{ id: key(medicao) }] });
    await producaoGeral(c, 'atual');
    expect(c.id(ref(medicao))).toBe(key(medicao));
    expect(vi.mocked(salvarParcelasOrdenha).mock.calls.filter(([input]) => input.chave === key(medicao))).toHaveLength(1);
    expect(estado.eventos.filter(e => e.tipo === 'coleta')).toHaveLength(1);
  });

  it('intercala as coletas com as três entradas diárias do mês anterior', async () => {
    const c = contexto('2024-03-03'); await producaoGeral(c, 'anterior');
    const coletas = estado.eventos.filter(e => e.tipo === 'coleta'); expect(coletas).toHaveLength(29);
    expect(estado.eventos.slice(0, 8).map(e => `${e.tipo}:${e.data}`)).toEqual([
      'entrada:2024-02-01', 'entrada:2024-02-01', 'entrada:2024-02-01', 'coleta:2024-02-01',
      'entrada:2024-02-02', 'entrada:2024-02-02', 'entrada:2024-02-02', 'coleta:2024-02-02',
    ]);
    expect(coletas.every(e => e.litros === 900)).toBe(true);
    const total = estado.eventos.length; await registrarRetiradaDia(c, 'anterior', '2024-02-01');
    expect(estado.eventos).toHaveLength(total); expect(c.id(ref('comercial:anterior:retirada-id:0'))).toBe(key('comercial:anterior:retirada:2024-02-01'));
  });
  it('hoje coleta apenas o volume suportado pela manhã confirmada e preserva a tarde pendente', async () => {
    const c = contexto('2026-10-03'); await producaoGeral(c, 'atual');
    expect(estado.eventos.filter(e => e.data === c.dataBase)).toEqual([
      { tipo: 'entrada', data: '2026-10-03' }, { tipo: 'coleta', data: '2026-10-03', litros: 300 },
    ]);
    expect(quantidadeColetaDia(c.dataBase, c.dataBase)).toBeLessThan(420);
    expect(c.manifesto.ids[ref('medicao:2026-10-03:1:principal')]).toBeDefined();
    expect(c.manifesto.ids[ref('entrada:medicao:2026-10-03:1:principal')]).toBeUndefined();
  });
  it('registra e estorna todos os ingredientes antes dos fechamentos, ordenando períodos entre lotes', async () => {
    const c = contexto('2026-10-24'); await nutricaoGeral(c);
    expect(estado.consumos).toHaveLength(11);
    expect(estado.consumos[0].itens.map(i => i.quantidadeConfirmada)).toEqual([10, 0, 0]);
    expect(estado.eventos[0]).toEqual({ tipo: 'estorno', data: c.dias(-79) });
    expect(estado.consumos.slice(1, 6).every(i => i.fim === '2026-09-30')).toBe(true);
    expect(estado.consumos.slice(6).every(i => i.fim === '2026-10-23')).toBe(true);
  });
});
