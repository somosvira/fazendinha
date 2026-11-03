import { beforeEach, describe, expect, it, vi } from 'vitest';
const estado = vi.hoisted(() => ({
  produtos: new Map<string, { id: string; nome: string; unidade: string; rastrearPartidas: boolean; perfilSanitario?: unknown }>(),
  criarProduto: vi.fn(), criarAplicacao: vi.fn(),
}));
vi.mock('../../src/db.js', () => ({ prisma: {
  produto: {
    findFirst: vi.fn(async ({ where }: { where: { id?: string; nome?: string } }) => [...estado.produtos.values()].find(p => where.id ? p.id === where.id : p.nome === where.nome) ?? null),
    findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => estado.produtos.get(where.id) ?? { id: where.id, nome: 'Material demonstrativo', unidade: 'UN', rastrearPartidas: true }),
  },
  partidaProduto: { findFirst: vi.fn(async ({ where }: { where: { id?: string } }) => ({ id: where.id ?? 'partida-demonstrativa' })) },
  tarefaProtocolo: { findFirstOrThrow: vi.fn(async () => ({ id: 'tarefa-demonstrativa' })) },
} }));
vi.mock('../../src/services/estoque/produtos.js', () => ({ criarProduto: estado.criarProduto }));
vi.mock('../../src/services/pecuaria/sanidade/aplicacoes.js', () => ({ criarAplicacao: estado.criarAplicacao, anularAplicacao: vi.fn() }));
vi.mock('./financeiro.js', () => ({ operacao: vi.fn() }));
import { estoque, PRODUTOS } from './estoque.js';
import { sanidade } from './sanidade.js';
import { BANCO, chave, ContextoSeed } from './contexto.js';

function contexto() {
  const ids: Record<string, string> = { 'usuario:dono': '7', 'centro:Pecuária': chave('centro'), 'parceiro:fornecedor': chave('fornecedor') };
  for (const [, , , categoria] of PRODUTOS) ids[`categoria:${categoria}`] = chave(categoria);
  for (const [i, sitio] of ['Principal', 'Arrendado', 'Test'].entries()) {
    ids[`sitio:${sitio}`] = String(i + 1); ids[`conta:Banco ${sitio}`] = chave(sitio);
    for (const ref of ['semen', 'embriao']) ids[`produto:${ref}`] = chave(ref);
  }
  const c = new ContextoSeed({ versao: 1, banco: BANCO, identidade: 'unitario', baseline: { nome: 'base', checksum: 'a'.repeat(64) }, fuso: 'America/Sao_Paulo', dataBase: '2026-10-24', ids, etapas: [], acoes: [], criadoEm: '2026-10-24T12:00:00.000Z' }, false);
  vi.spyOn(c, 'salvar').mockResolvedValue();
  return c;
}
beforeEach(() => {
  vi.clearAllMocks(); estado.produtos.clear();
  estado.criarProduto.mockImplementation(async (input: { nome: string; unidade: string; rastrearPartidas: boolean; perfilSanitario?: unknown }) => {
    const registro = { ...input, id: chave(input.nome) }; estado.produtos.set(registro.id, registro); return registro;
  });
  estado.criarAplicacao.mockResolvedValue({ id: 'aplicacao-historica' });
});
describe('catálogo sanitário novo e snapshot histórico da seed', () => {
  it('prepara novos produtos pelo schema normal com ambos os prazos explícitos', async () => {
    await estoque(contexto());
    const produtos = estado.criarProduto.mock.calls.map(([input]) => input);
    const sanitarios = produtos.filter(p => p.usoSanitario);
    expect(sanitarios).toHaveLength(10);
    for (const p of sanitarios) {
      expect(p.perfilSanitario.carenciaLeiteHoras).toBeTypeOf('number');
      expect(p.perfilSanitario.carenciaCarneHoras).toBeTypeOf('number');
    }
    expect(produtos.find(p => p.nome.includes('histórico de aplicação incompleto'))).toMatchObject({
      perfilSanitario: { carenciaLeiteHoras: 96, carenciaCarneHoras: 48 },
    });
  });
  it('preserva por ID o cadastro legado com prazo null e não reescreve o nome', async () => {
    const c = contexto(); const id = chave('produto-legado');
    c.manifesto.ids['produto:medicamento-desconhecido'] = id;
    const legado = { id, nome: 'Medicamento sintético carência desconhecida', unidade: 'ML', rastrearPartidas: true, perfilSanitario: { carenciaLeiteHoras: null, carenciaCarneHoras: 48 } };
    estado.produtos.set(id, legado);
    await estoque(c);
    expect(estado.produtos.get(id)).toEqual({ id, nome: 'Medicamento sintético carência desconhecida', unidade: 'ML', rastrearPartidas: true, perfilSanitario: { carenciaLeiteHoras: null, carenciaCarneHoras: 48 } });
    expect(estado.criarProduto.mock.calls.some(([input]) => input.nome.includes('histórico de aplicação incompleto'))).toBe(false);
    expect(c.id('produto:medicamento-desconhecido')).toBe(id);
  });
  it('envia snapshot NAO_INFORMADO/null para aplicação 13 apesar do catálogo ter 96 horas', async () => {
    const c = contexto(); const id = chave('medicamento');
    estado.produtos.set(id, { id, nome: 'Medicamento sintético com carência', unidade: 'ML', rastrearPartidas: true, perfilSanitario: { carenciaLeiteHoras: 96, carenciaCarneHoras: 48 } });
    vi.spyOn(c, 'id').mockImplementation(ref => ref === 'produto:medicamento' ? id : ref);
    vi.spyOn(c, 'numero').mockReturnValue(7);
    vi.spyOn(c, 'acao').mockResolvedValue();
    vi.spyOn(c, 'registro').mockImplementation(async (ref, _buscar, criar) => ref === 'fato:aplicacao:carencia-13' ? criar() : { id: ref });
    await sanidade(c);
    expect(estado.criarAplicacao).toHaveBeenCalledOnce();
    expect(estado.criarAplicacao.mock.calls[0][0]).toMatchObject({
      produtoId: id, animalId: 'animal:13', estadoCarenciaLeite: 'NAO_INFORMADO', carenciaLeiteHoras: null,
      justificativaCarenciaLeite: 'Prazo não documentado; leite bloqueado até revisão técnica.',
    });
    expect(estado.produtos.get(id)?.perfilSanitario).toEqual({ carenciaLeiteHoras: 96, carenciaCarneHoras: 48 });
  });
});
