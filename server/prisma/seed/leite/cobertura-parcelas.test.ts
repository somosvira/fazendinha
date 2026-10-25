import { beforeEach, describe, expect, it, vi } from 'vitest';
const estado = vi.hoisted(() => ({ eventos: [] as Array<{ tipo: string; input: Record<string, unknown> }>, recibos: new Map<string, { propriedadeId: number; usuarioId: number; resultadoIds: unknown }>(),
  configExistente: 0, localizacao: 2, falharDepoisDoCommit: false,
}));
vi.mock('../../../src/db.js', () => ({ prisma: {
  requisicaoPecuaria: { findUnique: vi.fn(async ({ where }: { where: { chave: string } }) => estado.recibos.get(where.chave) ?? null) },
  localizacaoAnimal: { findMany: vi.fn(async (input: Record<string, unknown>) => { estado.eventos.push({ tipo: 'localizacao', input }); return [{ propriedadeId: estado.localizacao }]; }) },
  configuracaoOrdenha: { count: vi.fn(async () => estado.configExistente) },
} }));
async function fato(tipo: string, input: { chave: string; propriedadeId: number }, usuarioId: number | null) {
  estado.eventos.push({ tipo, input }); const resultado = { id: input.chave };
  estado.recibos.set(input.chave, { propriedadeId: input.propriedadeId, usuarioId: usuarioId!, resultadoIds: resultado }); return resultado;
}
vi.mock('../../../src/services/pecuaria/reproducao/registros.js', () => ({ criarParto: vi.fn((input, usuarioId) => fato('parto', input, usuarioId)) }));
vi.mock('../../../src/services/pecuaria/reproducao/lactacoes.js', () => ({ registrarLactacaoHistorica: vi.fn((input, usuarioId) => fato('lactacao', input, usuarioId)) }));
vi.mock('../../../src/services/pecuaria/leite/configuracoes.js', () => ({ criarConfiguracao: vi.fn((input, usuarioId) => fato('configuracao', input, usuarioId)) }));
vi.mock('./producao.js', () => ({ posicoes: [{ posicaoId: '00000000-0000-4000-a000-000000000001' }, { posicaoId: '00000000-0000-4000-a000-000000000002' }] }));
vi.mock('../../../src/services/pecuaria/leite/tanques.js', () => ({ salvarParcelasOrdenha: vi.fn(async (input, usuarioId) => {
  estado.eventos.push({ tipo: input.parcelas[0].id ? 'correcao' : 'parcela', input });
  const resultado = { sessaoId: '00000000-0000-4000-a000-000000000009', parcelas: [{ id: input.parcelas[0].id ?? input.chave }] };
  estado.recibos.set(input.chave, { propriedadeId: input.propriedadeId, usuarioId, resultadoIds: resultado });
  if (estado.falharDepoisDoCommit) { estado.falharDepoisDoCommit = false; throw new Error('Resposta perdida após commit'); }
  return resultado;
}) }));
vi.mock('../../../src/services/pecuaria/leite/estoque.js', () => ({
  confirmarProducaoGeral: vi.fn((input, contexto) => fato('entrada', { ...input, propriedadeId: contexto.propriedadeId }, contexto.usuarioId)),
  anularEntradaProducaoLeite: vi.fn(async (input) => { estado.eventos.push({ tipo: 'anulacao', input }); return { id: '00000000-0000-4000-a000-000000000008' }; }),
}));
import { ContextoSeed, BANCO } from '../contexto.js';
import { coberturaParcelas } from './cobertura-parcelas.js';
import { key, ref } from './catalogo.js';
function contexto() {
  const c = new ContextoSeed({ versao: 1, banco: BANCO, identidade: 'unitario', baseline: { nome: 'base', checksum: 'a'.repeat(64) }, fuso: 'America/Sao_Paulo', dataBase: '2026-10-24', ids: {
    'usuario:dono': '1', 'sitio:Principal': '1', 'sitio:Arrendado': '2', 'animal:35': key('animal35'), [ref('produto:nao-comercial')]: key('produto'),
  }, etapas: [], acoes: [], criadoEm: '2026-10-24T12:00:00Z' }, false);
  vi.spyOn(c, 'salvar').mockResolvedValue(); return c;
}
beforeEach(() => { vi.clearAllMocks(); estado.eventos.length = 0; estado.recibos.clear(); estado.configExistente = 0; estado.localizacao = 2; estado.falharDepoisDoCommit = false; });
describe('cobertura complementar sem reescrever etapas existentes', () => {
  it('vincula história no Arrendado e regulariza antes de corrigir/reconfirmar a parcela atual', async () => {
    const c = contexto(); await coberturaParcelas(c);
    expect(estado.eventos.filter(e => e.tipo === 'configuracao').map(e => e.input)).toEqual([expect.objectContaining({ propriedadeId: 2, criterioColostro: { tipo: 'PRIMEIRA_ORDENHA' } })]);
    expect(estado.eventos.find(e => e.tipo === 'parto')?.input).toMatchObject({ animalId: c.id('animal:35'), propriedadeId: 2, iniciarLactacao: false, crias: [{ viva: false }] });
    expect(estado.eventos.find(e => e.tipo === 'lactacao')?.input).toMatchObject({ inicio: c.dias(-680), encerradaEm: c.dias(-665), partoId: c.id(ref('cobertura:parto-historico-arrendado')) });
    const parcelas = estado.eventos.filter(e => e.tipo === 'parcela').map(e => e.input);
    expect(parcelas).toContainEqual(expect.objectContaining({ propriedadeId: 2, dataOperacional: c.dias(-679), parcelas: [expect.objectContaining({ natureza: 'COLOSTRO', primeiraOrdenhaColostro: true, animaisOrigem: [c.id('animal:35')] })] }));
    expect(parcelas).toContainEqual(expect.objectContaining({ propriedadeId: 1, dataOperacional: c.dataBase, parcelas: [expect.objectContaining({ litros: 0, animaisOrigem: [], declaracaoDireta: expect.any(Object) })] }));
    const etapas = estado.eventos.filter(e => ['entrada', 'anulacao', 'correcao'].includes(e.tipo));
    expect(etapas.map(e => e.tipo)).toEqual(['entrada', 'anulacao', 'correcao', 'entrada']);
    expect(etapas[0].input).toMatchObject({ versaoEsperada: 1 }); expect(etapas[3].input).toMatchObject({ versaoEsperada: 2 });
    expect(etapas[2].input).toMatchObject({ parcelas: [expect.objectContaining({ id: c.id(ref('cobertura:parcela-regularizada')), versaoEsperada: 1, litros: 8 })] });
    expect(estado.eventos.at(-1)?.input).toMatchObject({ parcelas: [expect.objectContaining({ recipiente: 'V5 · Inclusão posterior segregada' })] });
    const antes = estado.eventos.filter(e => e.tipo !== 'localizacao').length; await coberturaParcelas(c);
    expect(estado.eventos.filter(e => e.tipo !== 'localizacao')).toHaveLength(antes);
  });
  it('recupera a parcela histórica após perder a resposta do commit', async () => {
    const c = contexto(); estado.falharDepoisDoCommit = true;
    await expect(coberturaParcelas(c)).rejects.toThrow('Resposta perdida');
    expect(c.manifesto.ids[ref('cobertura:primeira-ordenha-historica')]).toBeUndefined();
    await coberturaParcelas(c);
    expect(c.id(ref('cobertura:primeira-ordenha-historica'))).toBe(key('cobertura:primeira-ordenha-historica'));
    expect(estado.eventos.filter(e => e.tipo === 'parcela' && e.input.propriedadeId === 2)).toHaveLength(1);
  });
  it('interrompe diante de localização divergente ou configuração preexistente', async () => {
    estado.localizacao = 1; await expect(coberturaParcelas(contexto())).rejects.toThrow('localização única');
    expect(estado.eventos.filter(e => e.tipo !== 'localizacao')).toHaveLength(0);
    estado.localizacao = 2; estado.configExistente = 1; await expect(coberturaParcelas(contexto())).rejects.toThrow('já possui configuração');
    expect(estado.eventos.some(e => e.tipo === 'configuracao')).toBe(false);
  });
});
