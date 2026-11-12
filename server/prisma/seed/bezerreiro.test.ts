import { beforeEach, expect, it, vi } from 'vitest';
import type { Contexto } from './contexto.js';
const mocks = vi.hoisted(() => ({
  sobreposicoes: [] as { fechamentoId: string; animalIds: string[] }[],
  confirmar: vi.fn(), sobrepostos: vi.fn(),
}));
vi.mock('../../src/db.js', () => ({ prisma: {
  $transaction: async (fn: (tx: unknown) => unknown) => fn({}),
  faseBezerreiroVersao: { findFirstOrThrow: async () => ({ id: 'fase', ofertas: [{ id: 'manha' }, { id: 'tarde' }] }) },
  partoAnimal: { findUniqueOrThrow: async () => ({ data: new Date('2026-11-01'), animalId: 'matriz' }) },
  criaParto: { findMany: async () => [] }, participacaoBezerreiro: { findMany: async () => [] },
  ofertaBezerreiro: { findFirst: async () => null },
} }));
vi.mock('../../src/services/pecuaria/bezerreiro/gestao.js', () => ({ salvarConfiguracao: vi.fn(), registrarPerfil: vi.fn(), mudarFase: vi.fn() }));
vi.mock('../../src/services/pecuaria/bezerreiro/colostro.js', () => ({ registrarRetiradaColostro: vi.fn(), confirmarRetiradaColostro: vi.fn(), destinarColostro: vi.fn() }));
vi.mock('../../src/services/pecuaria/bezerreiro/alimentacao-compartilhada.js', () => ({ fechamentosSobrepostosTx: mocks.sobrepostos }));
vi.mock('../../src/services/pecuaria/rebanho/regras.js', () => ({ hojeFazendaDate: () => new Date('2026-11-03T00:00:00Z') }));
vi.mock('./rebanho.js', () => ({ AVISO: 'Dados sintéticos' }));
vi.mock('./leite/producao.js', () => ({ posicoes: [{}, {}, { posicaoId: 'posicao' }] }));
vi.mock('../../src/services/pecuaria/bezerreiro/aleitamento.js', () => ({
  consultarPrevisao: async () => ({ contextoToken: 'a'.repeat(64), grupos: [
    { coleiraId: 'azul', participantes: [{ animalId: 'cria-a', litrosDia: '6' }] },
    { coleiraId: 'amarela', participantes: [{ animalId: 'cria-b', litrosDia: '3' }] },
  ] }),
  confirmarOferta: mocks.confirmar,
}));
import { bezerreiro } from './bezerreiro.js';
function contexto() {
  const feitas = new Set<string>();
  return { usuarioId: 7, sitioIds: { principal: 1 }, id: (nome: string) => nome,
    registro: async () => ({ id: '00000000-0000-4000-a000-000000000001' }),
    acao: async (nome: string, concluida: () => Promise<boolean>, executar: () => Promise<unknown>) => {
      if (!nome.startsWith('bezerreiro:oferta:') || feitas.has(nome)) return;
      if (!await concluida()) await executar(); feitas.add(nome);
    },
  } as unknown as Contexto;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.sobreposicoes = [];
  mocks.sobrepostos.mockImplementation(async () => mocks.sobreposicoes);
  mocks.confirmar.mockImplementation(async (input) => {
    for (const grupo of input.grupos) if (mocks.sobreposicoes.some(f => f.animalIds.includes(grupo.coleiraId === 'azul' ? 'cria-a' : 'cria-b')) && !grupo.consumoAdicional)
      throw new Error('Há leite registrado em fechamento de Nutrição para estes animais nesta data.');
  });
});
it('seed nova declara consumo adicional somente para o grupo com fechamento sobreposto', async () => {
  mocks.sobreposicoes = [{ fechamentoId: 'fechamento-seed', animalIds: ['cria-a'] }];
  await bezerreiro(contexto());
  expect(mocks.confirmar).toHaveBeenCalledTimes(2);
  for (const [input, usuario] of mocks.confirmar.mock.calls) {
    expect(usuario).toBe(7);
    expect(input.grupos[0]).toMatchObject({ consumoAdicional: true, justificativa: expect.stringContaining('fechamento-seed') });
    expect(input.grupos[1].consumoAdicional).not.toBe(true);
  }
});
it('sem sobreposição não declara adicional e mantém o desvio da tarde e a retomada', async () => {
  const c = contexto(); await bezerreiro(c); await bezerreiro(c);
  expect(mocks.confirmar).toHaveBeenCalledTimes(2);
  expect(mocks.confirmar.mock.calls[0][0].grupos[0]).toMatchObject({ quantidadeLitros: '3.000' });
  const tarde = mocks.confirmar.mock.calls[1][0].grupos[0];
  expect(tarde).toMatchObject({ quantidadeLitros: '2.400', justificativa: expect.stringContaining('abaixo do previsto') });
  expect(tarde.consumoAdicional).not.toBe(true);
});
