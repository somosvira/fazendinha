// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Iatf } from './Iatf';
import { reqV4 } from './api';
import { setPropriedadeAtiva } from '../../../propriedadeScope';

vi.mock("../protocolos/cadastros-api", () => ({ listarCadastrosProtocolos: vi.fn().mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 }) }));
vi.mock('./api', () => ({ reqV4: vi.fn() }));
vi.mock('../../../estoque/api', () => ({ listarProdutos: vi.fn().mockResolvedValue([]) }));
vi.mock('../api', () => ({ listarMaterialGenetico: vi.fn().mockResolvedValue([]) }));
vi.mock('../protocolos/ProcedimentosProtocolo', () => ({ ProcedimentosProtocolo: ({ propriedadeId, contexto }: { propriedadeId: number; contexto: { programacaoId?: string } }) => <p data-testid="custos-programacao">{propriedadeId} · {contexto.programacaoId}</p> }));
vi.mock('../protocolos/api', async original => {
  const api = await original<typeof import('../protocolos/api')>();
  const contagens = { total: 1, atendidos: 0, pendentes: 1 };
  return { ...api,
    obterCabecalhoProtocolo: vi.fn().mockResolvedValue({ id: 'programa', modo: 'COLETIVO', tipo: 'REPRODUTIVO', nome: 'Turma QA', propriedadeId: 7, inicioReferencia: '2026-10-01', precisaoTemporal: 'DIA', protocolo: { id: 'p', nome: 'Protocolo QA', versao: 1 }, contagens }),
    obterEtapasProtocolo: vi.fn().mockResolvedValue({ itens: [{ id: 'etapa', nome: 'Manejo', diaRelativo: 0, unidadeIntervalo: 'DIAS', previstaPara: '2026-10-01', precisaoTemporal: 'DIA', contagens }], total: 1, pagina: 1, porPagina: 10 }),
    obterTarefasProtocolo: vi.fn().mockResolvedValue({ itens: [{ id: 'tarefa', participacaoId: 'participacao', animal: { id: 'animal', brinco: 'QA', nome: null }, propriedadeId: 7, situacao: 'SEM_REGISTRO', previstaPara: '2026-10-01', precisaoTemporal: 'DIA', realizadaEm: null, acoes: { atender: true, regularizar: true }, tarefaOrigem: { id: 'tarefa', tipo: 'MANEJO', previstaEm: '2026-10-01', precisaoTemporal: 'DIA', historicoRegularizacao: [] } }], total: 1, pagina: 1, porPagina: 10 }),
    reqProtocolo: vi.fn().mockImplementation(async (path: string) => path.startsWith("/programacoes?") ? { itens: [{ id: "programa", nome: "Turma QA", status: "ABERTA", inicioReferencia: "2026-10-01", precisaoTemporal: "DIA", participantesTotal: 1, protocolo: { id: "p", nome: "Protocolo QA", versao: 1 }, contagens }], total: 1, pagina: 1, porPagina: 10 } : { exigeCiencia: false, modoLegado: false, itens: [], total: 0, pagina: 1, porPagina: 10 }),
  };
});
vi.mock('./RegularizarOrigem', () => ({ RegularizarOrigem: ({ propriedadeId }: { propriedadeId: number }) => <p data-testid="regularizacao-sitio">{propriedadeId}</p>, consumoMantidoUltimaAnulacao: () => false }));
const referencia = { id: 'ref', nome: 'Referência QA', familia: 'IATF', versaoReferencia: '1',
  fonte: { titulo: 'Fonte fictícia', url: 'https://example.test', pagina: 1, data: '2026-01-01', consultadaEm: '2026-01-01' },
  objetivo: 'Conferir destino explícito', populacaoIndicada: 'Fixture', camposACompletar: [], observacoes: [] };
const programa = { id: 'programa', nome: 'Turma QA', inicioPrevisto: '2026-10-01T00:00:00Z', precisaoTemporal: 'DIA', status: 'ABERTA',
  protocolo: { nome: 'Protocolo QA', versao: 1 }, participantes: [{ id: 'participacao', animalId: 'animal', inicioPrevisto: '2026-10-01T00:00:00Z', inicioEfetivo: null, tarefas: [{ id: 'tarefa', tipo: 'MANEJO', regularizacaoPendente: true, previstaEm: '2026-10-01T00:00:00Z', historicoRegularizacao: [] }] }] };
beforeEach(() => {
  vi.clearAllMocks(); setPropriedadeAtiva(99);
  vi.mocked(reqV4).mockImplementation(async (path, body) => {
    if (path === '/reproducao/biblioteca') return [referencia];
    if (path.startsWith('/reproducao/biblioteca/')) return { id: 'copia' };
    if (path.startsWith('/reproducao/programacoes/programa')) return programa;
    if (path.startsWith('/reproducao/programacoes')) return [programa];
    return body ? {} : [];
  });
});
afterEach(() => { cleanup(); setPropriedadeAtiva(null); });

it('cópia na montagem Iatf usa o sítio explícito mesmo com outro ativo', async () => {
  render(<Iatf propriedadeId={7} modo="cadastros" podeLancar />);
  await screen.findByText('Referência QA');
  fireEvent.click(screen.getByText('Biblioteca de referências reprodutivas'));
  fireEvent.change(screen.getByLabelText('Nome do novo rascunho'), { target: { value: 'Cópia no sítio explícito' } });
  fireEvent.change(screen.getByLabelText('Versão do novo rascunho'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Copiar como rascunho' }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith('/reproducao/biblioteca/ref/copiar', expect.objectContaining({ propriedadeId: 7 }), 'POST', 7));
});

it.each([99, null])('custos da programação inteira conservam sítio explícito com ativo %s', async ativo => {
  setPropriedadeAtiva(ativo);
  render(<Iatf propriedadeId={7} podeLancar />);
  fireEvent.click((await screen.findAllByRole('link', { name: /Turma QA/ }))[0]);
  expect(await screen.findByTestId('custos-programacao')).toHaveProperty('textContent', '7 · programa');
  expect(screen.queryByTestId('custos-participacao')).toBeNull();
});

it('regularização usa o mesmo sítio explícito dos custos e do programa', async () => {
  render(<Iatf propriedadeId={7} podeLancar />);
  fireEvent.click((await screen.findAllByRole('link', { name: /Turma QA/ }))[0]);
  expect(await screen.findByTestId('regularizacao-sitio')).toHaveProperty('textContent', '7');
});

it('atendimento comum recebe o sítio explícito da programação', async () => {
  render(<Iatf propriedadeId={7} podeLancar />);
  fireEvent.click((await screen.findAllByRole('link', { name: /Turma QA/ }))[0]);
  fireEvent.click(await screen.findByRole('button', { name: 'Atender' }));
  expect(await screen.findByRole('heading', { name: /Registrar manejo protocolar/i })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Executar Manejo' })).toBeNull();
});
