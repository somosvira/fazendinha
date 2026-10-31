import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FonteCusto } from '../custos/custos.calc.js';

const f = vi.hoisted(() => ({ tx: {} as Record<string, unknown>, fontes: vi.fn(), colostros: vi.fn(), valores: vi.fn() }));
vi.mock('../../../db.js', () => ({ prisma: { $transaction: (executar: (tx: unknown) => unknown) => executar(f.tx) } }));
vi.mock('../custos/custos.js', () => ({ carregarFontesCustoTx: f.fontes }));
vi.mock('./colostro.js', () => ({ consultarCustosColostroTx: f.colostros, brixOrigem: vi.fn() }));
vi.mock('../../estoque/leite.js', () => ({ valoresMovimentosLeiteTx: f.valores }));

import { consultarCustosBezerreiro } from './consultas.js';
import { consultaSchema } from './schemas.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const data = new Date('2026-10-20T00:00:00Z');
const filtro = consultaSchema.parse({ de: '2026-10-01', ate: '2026-10-28' });
const participacao = (animalId = id(1)) => ({ animalId, desde: data, ate: null, animal: { brinco: animalId, nome: null } });
function fonte(opcoes: Partial<FonteCusto> = {}): FonteCusto {
  return { id: id(2), tipo: 'NUTRICAO', animalId: id(1), propriedadeId: 7, data: '2026-10-20', descricao: 'Ingrediente real',
    estadoFato: 'CONFIRMADO', participacaoId: null, origemMaterial: 'NUTRICAO', movimentoEstoqueId: id(3),
    operacaoServicoId: null, valorMaterial: '10.00', valorServico: null, classificacao: null, componenteId: id(4), ...opcoes };
}
const sanidade: FonteCusto['classificacao'] = { finalidade: 'SANIDADE', materialNaoAplicavel: false,
  servicoNaoAplicavel: true, coberturaServico: 'PROCEDIMENTO', valorMaterialDocumentado: null };
function banco() {
  return { participacaoBezerreiro: { findMany: vi.fn() }, ofertaBezerreiro: { findMany: vi.fn() }, participacaoConsumoAnimal: { findMany: vi.fn() } };
}
let tx: ReturnType<typeof banco>;
beforeEach(() => {
  vi.clearAllMocks(); tx = banco(); f.tx = tx;
  tx.participacaoBezerreiro.findMany.mockResolvedValue([participacao()]);
  tx.ofertaBezerreiro.findMany.mockResolvedValue([]);
  tx.participacaoConsumoAnimal.findMany.mockResolvedValue([]);
  f.fontes.mockResolvedValue([]); f.colostros.mockResolvedValue([]); f.valores.mockResolvedValue(new Map());
});

describe('custos do bezerreiro: identidade e categorias exclusivas', () => {
  it('conta R$10 de Nutrição classificada SANIDADE uma única vez na sanidade', async () => {
    f.fontes.mockResolvedValue([fonte({ classificacao: sanidade })]);
    const r = await consultarCustosBezerreiro(7, filtro, true);
    expect(r.alimentacao.custoConhecido).toBe('0.00');
    expect(r.sanidade.custoConhecido).toBe('10.00');
    expect(r.totalConhecido).toBe('10.00');
    expect(r.porAnimal[0]).toMatchObject({ custoAlimentarAtribuido: '0.00', custoSanitario: '10.00' });
  });

  it('conserva ingredientes distintos da mesma participação e deduplica somente o mesmo componente', async () => {
    const primeiro = fonte({ valorMaterial: '7.11' });
    const segundo = fonte({ componenteId: id(5), movimentoEstoqueId: id(6), valorMaterial: '2.22' });
    f.fontes.mockResolvedValue([primeiro, segundo, primeiro]);
    const r = await consultarCustosBezerreiro(7, filtro, true);
    expect(r.alimentacao.custoConhecido).toBe('9.33');
    expect(r.totalConhecido).toBe('9.33');
    expect(r.alimentacao.pendencias).toBe(0);
  });

  it('preserva material e serviço da mesma fonte sanitária como componentes distintos', async () => {
    const aplicacao = fonte({ tipo: 'APLICACAO', classificacao: { ...sanidade!, servicoNaoAplicavel: false },
      operacaoServicoId: id(8), valorMaterial: '10.01', valorServico: '3.02' });
    f.fontes.mockResolvedValue([aplicacao, aplicacao]);
    const r = await consultarCustosBezerreiro(7, filtro, true);
    expect(r.sanidade.custoConhecido).toBe('13.03');
    expect(r.totalConhecido).toBe('13.03');
  });

  it('mantém custos desconhecidos pendentes uma única vez na categoria correspondente', async () => {
    f.fontes.mockResolvedValue([fonte({ valorMaterial: null, classificacao: sanidade }),
      fonte({ componenteId: id(5), valorMaterial: '0.01' }), fonte({ componenteId: id(6), valorMaterial: null })]);
    f.colostros.mockResolvedValue([{ animalId: id(1), data: '2026-10-20', valorTotal: null }]);
    const r = await consultarCustosBezerreiro(7, filtro, true);
    expect(r.alimentacao).toMatchObject({ custoConhecido: '0.01', pendencias: 2, custoCompleto: null });
    expect(r.sanidade).toEqual({ custoConhecido: '0.00', pendencias: 1 });
    expect(r.totalConhecido).toBe('0.01');
    expect(r.porAnimal[0].pendencias).toBe(3);
    expect(r.custoCompleto).toBeNull();
  });

  it('conserva centavos do leite atribuído e deixa R07 fora do custo real', async () => {
    tx.participacaoBezerreiro.findMany.mockResolvedValue([participacao(), participacao(id(9))]);
    tx.ofertaBezerreiro.findMany.mockResolvedValue([{ grupos: [{ itemConsumo: { FornecimentoNutricionalLeite: {
      movimentos: [{ movimentoId: id(10) }], parcelas: [{ animalId: id(1), quantidadeLitros: D(1) }, { animalId: id(9), quantidadeLitros: D(1) }],
      referencias: [{ valorTotal: D('900.01') }],
    } } }] }]);
    f.valores.mockResolvedValue(new Map([[id(10), { valorTotal: D('0.03') }]]));
    const r = await consultarCustosBezerreiro(7, filtro, true);
    expect(r.alimentacao).toMatchObject({ quantidadeLitros: '2.000', custoConhecido: '0.03', referenciaR07: '900.01' });
    expect(r.porAnimal.map(a => a.custoAlimentarAtribuido).sort()).toEqual(['0.01', '0.02']);
    expect(r.porAnimal.reduce((s, a) => s.plus(a.custoAlimentarAtribuido!), D(0)).toFixed(2)).toBe(r.totalConhecido);
    expect(tx.ofertaBezerreiro.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'CONFIRMADO' }) }));
  });

  it('não expõe valores no agregado ou por animal sem verValores', async () => {
    f.fontes.mockResolvedValue([fonte({ valorMaterial: '9876.54' }), fonte({ componenteId: id(5), valorMaterial: '4321.09', classificacao: sanidade })]);
    const r = await consultarCustosBezerreiro(7, filtro, false);
    expect(r).toMatchObject({ totalConhecido: null, custoCompleto: null, cobertura: 'OCULTO',
      alimentacao: { custoConhecido: null, custoCompleto: null, referenciaR07: null }, sanidade: { custoConhecido: null } });
    expect(r.porAnimal[0]).toMatchObject({ custoAlimentarAtribuido: null, custoSanitario: null, referenciaR07: null });
    expect(JSON.stringify(r)).not.toContain('9876.54');
    expect(JSON.stringify(r)).not.toContain('4321.09');
  });

  it('respeita período do fato e permanência sem incluir fonte após saída ou de outro animal', async () => {
    tx.participacaoBezerreiro.findMany.mockResolvedValue([{ ...participacao(), ate: new Date('2026-10-22T00:00:00Z') }]);
    f.fontes.mockResolvedValue([fonte(), fonte({ componenteId: id(5), data: '2026-10-22', valorMaterial: '100.00' }),
      fonte({ componenteId: id(6), animalId: id(9), valorMaterial: '1000.00' }), fonte({ componenteId: id(7), data: '2026-10-19', valorMaterial: '50.00' })]);
    const r = await consultarCustosBezerreiro(7, filtro, true);
    expect(r.totalConhecido).toBe('10.00');
  });

  it('inclui custo já atribuído aos dias comprovados de permanência mesmo com fechamento posterior à saída', async () => {
    tx.participacaoBezerreiro.findMany.mockResolvedValue([{ ...participacao(), ate: new Date('2026-10-22T00:00:00Z') }]);
    f.fontes.mockResolvedValue([fonte({ data: '2026-10-28', periodoConsumo: { inicio: '2026-10-20', fim: '2026-10-28' } })]);
    tx.participacaoConsumoAnimal.findMany.mockResolvedValue([{ id: id(2), animalId: id(1), dias: 2,
      SegmentoConsumoAnimal: [{ desde: data, ate: new Date('2026-10-22T00:00:00Z') }] }]);
    const r = await consultarCustosBezerreiro(7, consultaSchema.parse({ de: '2026-10-20', ate: '2026-10-21' }), true);
    expect(r.alimentacao).toMatchObject({ custoConhecido: '10.00', pendencias: 0 });
    expect(r.totalConhecido).toBe('10.00');
    expect(tx.participacaoConsumoAnimal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: { in: [id(2)] }, fechamento: { propriedadeId: 7, status: 'CONFIRMADO' },
    } }));
  });

  it.each([false, true])('registra pendência explícita sem rateio quando só parte dos dias pertence ao recorte (SANIDADE=%s)', async sanitária => {
    tx.participacaoBezerreiro.findMany.mockResolvedValue([{ ...participacao(), ate: new Date('2026-10-22T00:00:00Z') }]);
    f.fontes.mockResolvedValue([fonte({ data: '2026-10-28', periodoConsumo: { inicio: '2026-10-20', fim: '2026-10-28' },
      valorMaterial: '90.00', classificacao: sanitária ? sanidade : null })]);
    tx.participacaoConsumoAnimal.findMany.mockResolvedValue([{ id: id(2), animalId: id(1), dias: 4,
      SegmentoConsumoAnimal: [{ desde: data, ate: new Date('2026-10-24T00:00:00Z') }] }]);
    const r = await consultarCustosBezerreiro(7, filtro, true);
    expect(r.totalConhecido).toBe('0.00');
    expect(r.alimentacao.pendencias).toBe(sanitária ? 0 : 1);
    expect(r.sanidade.pendencias).toBe(sanitária ? 1 : 0);
    expect(r.cobertura).toBe('PARCIAL'); expect(r.custoCompleto).toBeNull();
    expect(r.lacunas.join(' ')).toContain('sem dias comprovados');
    expect(JSON.stringify(r)).not.toContain('90.00');
  });

  it('não omite silenciosamente fechamento legado sem prova dos dias de permanência', async () => {
    tx.participacaoBezerreiro.findMany.mockResolvedValue([{ ...participacao(), ate: new Date('2026-10-22T00:00:00Z') }]);
    f.fontes.mockResolvedValue([fonte({ data: '2026-10-28', periodoConsumo: { inicio: '2026-10-01', fim: '2026-10-28' } })]);
    const r = await consultarCustosBezerreiro(7, filtro, false);
    expect(r.alimentacao.pendencias).toBe(1); expect(r.porAnimal[0].pendencias).toBe(1);
    expect(r.totalConhecido).toBeNull(); expect(r.cobertura).toBe('OCULTO');
    expect(r.lacunas.join(' ')).toContain('valor do recorte permanece pendente');
  });

  it('exclui custo comprovadamente fora da permanência mesmo quando o período do fechamento se sobrepõe', async () => {
    tx.participacaoBezerreiro.findMany.mockResolvedValue([{ ...participacao(), ate: new Date('2026-10-22T00:00:00Z') }]);
    f.fontes.mockResolvedValue([fonte({ data: '2026-10-28', periodoConsumo: { inicio: '2026-10-20', fim: '2026-10-28' } })]);
    tx.participacaoConsumoAnimal.findMany.mockResolvedValue([{ id: id(2), animalId: id(1), dias: 2,
      SegmentoConsumoAnimal: [{ desde: new Date('2026-10-24T00:00:00Z'), ate: new Date('2026-10-26T00:00:00Z') }] }]);
    const r = await consultarCustosBezerreiro(7, filtro, true);
    expect(r.totalConhecido).toBe('0.00'); expect(r.alimentacao.pendencias).toBe(0);
  });

  it('conserva ingredientes e centavos já atribuídos em permanências descontínuas comprovadas', async () => {
    tx.participacaoBezerreiro.findMany.mockResolvedValue([{ ...participacao(), ate: new Date('2026-10-22T00:00:00Z') },
      { ...participacao(), desde: new Date('2026-10-25T00:00:00Z'), ate: new Date('2026-10-27T00:00:00Z') }]);
    const primeiro = fonte({ data: '2026-10-28', periodoConsumo: { inicio: '2026-10-20', fim: '2026-10-28' }, valorMaterial: '7.11' });
    f.fontes.mockResolvedValue([primeiro, { ...primeiro, componenteId: id(5), valorMaterial: '2.22' }, primeiro]);
    tx.participacaoConsumoAnimal.findMany.mockResolvedValue([{ id: id(2), animalId: id(1), dias: 4, SegmentoConsumoAnimal: [
      { desde: data, ate: new Date('2026-10-22T00:00:00Z') }, { desde: new Date('2026-10-25T00:00:00Z'), ate: new Date('2026-10-27T00:00:00Z') },
    ] }]);
    const r = await consultarCustosBezerreiro(7, filtro, true);
    expect(r.totalConhecido).toBe('9.33'); expect(r.alimentacao.pendencias).toBe(0);
    expect(tx.participacaoConsumoAnimal.findMany.mock.calls[0][0].where.id.in).toEqual([id(2)]);
  });

  it.each([false, true])('permanência 1–9, saída 10 e fechamento 1–20: preserva custo ou pendência conforme prova (segmentos=%s)', async comSegmentos => {
    const entrada = new Date('2026-10-01T00:00:00Z'), saida = new Date('2026-10-10T00:00:00Z');
    tx.participacaoBezerreiro.findMany.mockResolvedValue([{ ...participacao(), desde: entrada, ate: saida }]);
    f.fontes.mockResolvedValue([fonte({ data: '2026-10-20', periodoConsumo: { inicio: '2026-10-01', fim: '2026-10-20' }, valorMaterial: '45.67' })]);
    tx.participacaoConsumoAnimal.findMany.mockResolvedValue([{ id: id(2), animalId: id(1), dias: 9,
      SegmentoConsumoAnimal: comSegmentos ? [{ desde: entrada, ate: saida }] : [] }]);
    const r = await consultarCustosBezerreiro(7, filtro, true);
    expect(r.totalConhecido).toBe(comSegmentos ? '45.67' : '0.00');
    expect(r.alimentacao.pendencias).toBe(comSegmentos ? 0 : 1);
    if (!comSegmentos) expect(r.lacunas.join(' ')).toContain('valor do recorte permanece pendente');
  });
});
