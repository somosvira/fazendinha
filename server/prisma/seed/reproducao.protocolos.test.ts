import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';

type Linha = Record<string, unknown> & { id: string };
const banco = vi.hoisted(() => {
  const tabelas: Record<string, Linha[]> = {};
  let sequencia = 1000;
  const id = () => `00000000-0000-4000-a000-${String(++sequencia).padStart(12, '0')}`;
  function corresponde(linha: Record<string, unknown>, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([campo, valor]) => {
      if (campo === 'OR') return (valor as Record<string, unknown>[]).some(v => corresponde(linha, v));
      if (campo === 'animalId_chaveCiclo') return corresponde(linha, valor as Record<string, unknown>);
      const atual = linha[campo];
      if (valor instanceof Date) return atual instanceof Date && atual.getTime() === valor.getTime();
      if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
        const filtro = valor as { lte?: Date; in?: unknown[] };
        if (filtro.lte) return atual instanceof Date && atual <= filtro.lte;
        if (filtro.in) return filtro.in.includes(atual);
        return atual !== null && typeof atual === 'object' && corresponde(atual as Record<string, unknown>, valor as Record<string, unknown>);
      }
      return atual === valor;
    });
  }
  const tx = new Proxy({ $executeRaw: async () => 0 } as Record<string, unknown>, { get(alvo, tabela: string) {
    if (tabela in alvo) return alvo[tabela];
    const procurar = (args: { where?: Record<string, unknown> } = {}) => (tabelas[tabela] ?? []).filter(linha => corresponde(linha, args.where ?? {}));
    const buscar = async (args: { where?: Record<string, unknown>; include?: unknown } = {}) => {
      const linha = procurar(args)[0]; if (!linha) return null;
      return tabela === 'vinculoPoliticaCiclo' && args.include ? { ...linha,
        politica: (tabelas.politicaElegibilidadeReprodutiva ?? []).find(p => p.id === linha.politicaId),
        situacaoInicial: (tabelas.situacaoInicialReprodutiva ?? []).find(i => i.id === linha.situacaoInicialId),
      } : linha;
    };
    const delegate = { findFirst: buscar, findUnique: buscar, findMany: async (args?: { where?: Record<string, unknown> }) => procurar(args), count: async (args?: { where?: Record<string, unknown> }) => procurar(args).length,
      findUniqueOrThrow: async (args: { where: Record<string, unknown> }) => { const linha = await buscar(args); if (!linha) throw new Error(`${tabela} ausente`); return linha; },
      findFirstOrThrow: async (args: { where: Record<string, unknown> }) => { const linha = await buscar(args); if (!linha) throw new Error(`${tabela} ausente`); return linha; },
      create: async ({ data }: { data: Record<string, unknown> }) => { const linha = { id: id(), status: 'VALIDO', criadoEm: new Date('2026-01-01'), ...data }; (tabelas[tabela] ??= []).push(linha); return linha; },
    };
    alvo[tabela] = delegate; return delegate;
  } });
  return { tabelas, tx, id };
});
vi.mock('../../src/db.js', () => ({ prisma: banco.tx }));
vi.mock('../../src/services/pecuaria/transacao.js', () => ({ transacaoPecuaria: (executar: (tx: Prisma.TransactionClient) => Promise<unknown>) => executar(banco.tx as unknown as Prisma.TransactionClient) }));
vi.mock('../../src/services/pecuaria/fatos.js', () => ({ conferirAnimalNoFato: async (_tx: unknown, animalId: string) => ({ id: animalId, sexo: 'F' }) }));
// Só a persistência da programação é substituída. O gate de aptidão e os serviços de origem/vínculo são reais.
vi.mock('../../src/services/pecuaria/reproducao/iatf.js', () => ({
  criarProtocolo: async (dados: Record<string, unknown>) => {
    const linha = { id: banco.id(), ...dados }; (banco.tabelas.protocolo ??= []).push(linha); return linha;
  },
  criarProgramacao: async (dados: { propriedadeId: number; nome: string; inicioPrevisto: string; animais: { animalId: string }[] }) => {
    const { conferirAptidaoParaAcaoTx } = await import('../../src/services/pecuaria/reproducao/elegibilidade.js');
    for (const animal of dados.animais) await conferirAptidaoParaAcaoTx(banco.tx as unknown as Prisma.TransactionClient, animal.animalId, dados.propriedadeId, new Date(`${dados.inicioPrevisto}T00:00:00Z`), 'PROTOCOLO');
    const programacao = { id: banco.id(), nome: dados.nome }; (banco.tabelas.programacaoProtocolo ??= []).push(programacao);
    for (const animal of dados.animais) {
      const participante = { id: banco.id(), rodadaId: programacao.id, animalId: animal.animalId, inicioEfetivo: null };
      (banco.tabelas.participacaoProtocolo ??= []).push(participante);
      (banco.tabelas.tarefaProtocolo ??= []).push({ id: banco.id(), execucaoId: participante.id, etapa: { ordem: 1 } });
    }
    return programacao;
  },
  iniciarParticipante: async (id: string, _sitio: number, inicio: string) => { banco.tabelas.participacaoProtocolo.find(p => p.id === id)!.inicioEfetivo = inicio; },
  executarTarefa: async () => undefined,
  retirarParticipante: async (id: string) => { banco.tabelas.participacaoProtocolo.find(p => p.id === id)!.canceladaEm = new Date(); },
}));
import { ContextoSeed, type Manifesto } from './contexto.js';
import { protocolosReprodutivos } from './reproducao.js';

function contexto(versao: 1 | 2 = 1) {
  const ids: Record<string, string> = { 'usuario:dono': '7', 'sitio:Principal': '3', 'material:semen': banco.id(), 'exame:Avaliação completa': banco.id() };
  const grupo = { idadeMinimaMeses: null, percentualPesoAdulto: null, pesoMinimoKg: null, eccMinimo: null, pesoAdultoReferenciaKg: null, validadePesoDias: null, precisaoPesoAceita: ['MEDIDO'], escalaEcc: null, validadeEccDias: null };
  const politica = { id: banco.id(), propriedadeId: 3, vigenteDesde: new Date('2024-01-01'), parametros: {
    versao, metodologia: 'IDEAGRI_IILB_BASE_V1', pevPrimiparasDias: 30, pevMultiparasDias: 30, aborto: 'PEV_CONFIGURADO', pevAposAbortoDias: 15,
    descarte: 'EXCLUIR', restricoes: 'EXCLUIR', perdaGestacional: 'RETOMAR_CICLO', papeisIncluidos: ['NENHUM', 'DOADORA', 'RECEPTORA'],
    ...(versao === 2 ? { criteriosAptidao: { vacas: grupo, novilhas: grupo, diasAvaliacaoPosParto: null } } : {}),
  } };
  const { criteriosAptidao: _criterios, ...parametrosV1 } = politica.parametros;
  const anterior = { ...politica, id: banco.id(), parametros: { ...parametrosV1, versao: 1 } };
  banco.tabelas.politicaElegibilidadeReprodutiva = [politica, anterior];
  for (const n of [9, 10, 11, 12, 13, 14, 58, 63, 64]) {
    const animalId = ids[`animal:${n}`] = banco.id();
    (banco.tabelas.animal ??= []).push({ id: animalId, sexo: 'F', dataEntrada: new Date('2025-01-01'), dataNascimento: new Date('2024-01-01'), partosAntesDaEntrada: 0 });
    (banco.tabelas.localizacaoAnimal ??= []).push({ id: banco.id(), animalId, propriedadeId: 3, desde: new Date('2025-01-01'), ate: null });
    if (n === 58) continue;
    const inicial = { id: banco.id(), animalId, propriedadeId: 3, data: new Date('2025-01-02'), situacao: 'VAZIA', status: 'VALIDO' };
    (banco.tabelas.situacaoInicialReprodutiva ??= []).push(inicial);
    (banco.tabelas.vinculoPoliticaCiclo ??= []).push({ id: banco.id(), animalId, propriedadeId: 3, chaveCiclo: 'INICIAL', inicioCiclo: inicial.data, situacaoInicialId: inicial.id, partoId: null, politicaId: anterior.id });
  }
  const manifesto: Manifesto = { versao: 1, banco: 'fazendinha_seedatev3', identidade: 'teste', baseline: { nome: 'base', checksum: 'a'.repeat(64) }, fuso: 'America/Sao_Paulo', dataBase: '2026-10-29', ids, etapas: [], acoes: [], criadoEm: '2026-10-29T12:00:00Z' };
  const c = new ContextoSeed(manifesto, false); vi.spyOn(c, 'salvar').mockResolvedValue(); return c;
}
beforeEach(() => { for (const tabela of Object.keys(banco.tabelas)) delete banco.tabelas[tabela]; });
describe('programações demonstrativas com o gate real de aptidão, sem banco', () => {
  it('prepara origem e política V1 para a novilha58 antes do grupo interrompido', async () => {
    const c = contexto(); await protocolosReprodutivos(c);
    expect(banco.tabelas.programacaoProtocolo.map(p => p.nome)).toEqual(['Reprodução ativo', 'Reprodução programado', 'Reprodução interrompido']);
    const inicial = banco.tabelas.situacaoInicialReprodutiva.find(i => i.animalId === c.id('animal:58'));
    expect(inicial).toMatchObject({ situacao: 'VAZIA', data: new Date('2026-07-21'), criadoPorId: 7 });
    expect(banco.tabelas.vinculoPoliticaCiclo.find(v => v.animalId === c.id('animal:58'))).toMatchObject({ situacaoInicialId: inicial!.id, chaveCiclo: 'INICIAL', criadoPorId: 7 });
    await protocolosReprodutivos(c);
    expect(banco.tabelas.programacaoProtocolo).toHaveLength(3);
    expect(banco.tabelas.situacaoInicialReprodutiva.filter(i => i.animalId === c.id('animal:58'))).toHaveLength(1);
  });
  it('preserva programação legada58 existente sem criar origem ou vínculo retroativo', async () => {
    const c = contexto(); banco.tabelas.programacaoProtocolo = [{ id: banco.id(), nome: 'Reprodução interrompido' }];
    banco.tabelas.participacaoProtocolo = [{ id: banco.id(), rodadaId: banco.tabelas.programacaoProtocolo[0].id, animalId: c.id('animal:58'), canceladaEm: new Date() }];
    await protocolosReprodutivos(c);
    expect(banco.tabelas.situacaoInicialReprodutiva.some(i => i.animalId === c.id('animal:58'))).toBe(false);
    expect(banco.tabelas.vinculoPoliticaCiclo.some(v => v.animalId === c.id('animal:58'))).toBe(false);
  });
  it('política V2 sem decisão continua recusando o novo grupo58 após preparar origem', async () => {
    const c = contexto(2);
    for (const _reenvio of [1, 2]) await expect(protocolosReprodutivos(c)).rejects.toThrow('Decisão de aptidão');
    expect(banco.tabelas.situacaoInicialReprodutiva.filter(i => i.animalId === c.id('animal:58'))).toHaveLength(1);
    expect(banco.tabelas.vinculoPoliticaCiclo.filter(v => v.animalId === c.id('animal:58'))).toHaveLength(1);
    expect(banco.tabelas.programacaoProtocolo.map(p => p.nome)).toEqual(['Reprodução ativo', 'Reprodução programado']);
    expect(banco.tabelas.decisaoElegibilidadeCiclo ?? []).toHaveLength(0);
  });
});
