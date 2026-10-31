// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RebanhoApiError } from '../api';
import { consultarBezerreiro } from './api';
import { EstadoConsulta, ModalBezerreiro, PaginacaoBezerreiro, RecuperacaoConflito, useComando, useRecuperacaoConflito } from './ui';
vi.mock('./api', async () => ({...await vi.importActual<typeof import('./api')>('./api'), consultarBezerreiro: vi.fn()}));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
function pendente<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: Error) => void;
  const promessa = new Promise<T>((resolve, reject) => {resolver = resolve; rejeitar = reject;});
  return {promessa, resolver, rejeitar};
}
describe('Comando do Bezerreiro', () => {
  it('preserva erro tipado e repete a chave somente para a mesma carga após falha', async () => {
    const erro = new RebanhoApiError('Versão desatualizada', 409, 'VERSAO_CONFLITANTE', 'versaoEsperada');
    vi.mocked(consultarBezerreiro).mockRejectedValue(erro);
    const salvar = vi.fn();
    const {result} = renderHook(() => useComando(1, salvar, 'origem:abc'));
    await act(() => result.current.salvar('/destinacoes', {versaoEsperada: 1, quantidade: '4'}));
    expect(result.current.erroTipado).toBe(erro);
    expect(result.current.conflito).toBe(true);
    expect(result.current.erro).toBe('Versão desatualizada');
    await act(() => result.current.salvar('/destinacoes', {versaoEsperada: 1, quantidade: '4'}));
    const primeira = vi.mocked(consultarBezerreiro).mock.calls[0][2];
    expect(vi.mocked(consultarBezerreiro).mock.calls[1][2]).toEqual(primeira);
    await act(() => result.current.salvar('/destinacoes', {versaoEsperada: 2, quantidade: '4'}));
    expect(vi.mocked(consultarBezerreiro).mock.calls[2][2]).not.toEqual(primeira);
    expect(salvar).not.toHaveBeenCalled();
  });
  it('falha de rede mantém a mesma chave sem classificar como conflito', async () => {
    vi.mocked(consultarBezerreiro).mockRejectedValue(new TypeError('Falha de rede'));
    const {result} = renderHook(() => useComando(1, vi.fn()));
    await act(() => result.current.salvar('/ofertas', {litros: '4'}));
    await act(() => result.current.salvar('/ofertas', {litros: '4'}));
    expect(result.current.conflito).toBe(false);
    expect(vi.mocked(consultarBezerreiro).mock.calls[0][2]).toEqual(vi.mocked(consultarBezerreiro).mock.calls[1][2]);
  });
  it.each(['sitio', 'recurso', 'data'])('descarta resposta atrasada após mudança de %s e permite comando no novo alvo', async tipo => {
    const antigo = pendente<unknown>();
    vi.mocked(consultarBezerreiro).mockReturnValueOnce(antigo.promessa).mockResolvedValue({});
    const salvar = vi.fn();
    const {result, rerender} = renderHook(({sitio, alvo}) => useComando(sitio, salvar, alvo), {initialProps: {sitio: 1, alvo: 'origem:abc:2026-10-28'}});
    let requisicao!: Promise<void>;
    act(() => {requisicao = result.current.salvar('/destinacoes', {quantidade: '4'});});
    rerender({sitio: tipo === 'sitio' ? 2 : 1, alvo: tipo === 'recurso' ? 'origem:def:2026-10-28' : tipo === 'data' ? 'origem:abc:2026-10-29' : 'origem:abc:2026-10-28'});
    expect(result.current.ocupado).toBe(false);
    await act(() => result.current.salvar('/destinacoes', {quantidade: '4'}));
    expect(salvar).toHaveBeenCalledTimes(1);
    await act(async () => {antigo.rejeitar(new RebanhoApiError('Conflito antigo', 409)); await requisicao;});
    expect(result.current.erro).toBe('');
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(vi.mocked(consultarBezerreiro).mock.calls[0][2]).not.toEqual(vi.mocked(consultarBezerreiro).mock.calls[1][2]);
  });
  it('não dispara callback após desmontagem', async () => {
    const carga = pendente<unknown>(), salvar = vi.fn();
    vi.mocked(consultarBezerreiro).mockReturnValue(carga.promessa);
    const {result, unmount} = renderHook(() => useComando(1, salvar));
    let requisicao!: Promise<void>;
    act(() => {requisicao = result.current.salvar('/ofertas', {});});
    unmount();
    await act(async () => {carga.resolver({}); await requisicao;});
    expect(salvar).not.toHaveBeenCalled();
  });
});
describe('Recuperação explícita de contexto', () => {
  it('carrega sem submeter e exige conferência; nova carga revoga a conferência', async () => {
    const carregar = vi.fn().mockResolvedValue({versao: 2});
    const {result} = renderHook(() => useRecuperacaoConflito('1:origem:abc', carregar));
    act(() => result.current.conferir());
    expect(result.current.conferido).toBe(false);
    await act(() => result.current.atualizar());
    expect(result.current.atual).toEqual({versao: 2});
    expect(result.current.conferido).toBe(false);
    expect(consultarBezerreiro).not.toHaveBeenCalled();
    act(() => result.current.conferir());
    expect(result.current.conferido).toBe(true);
    await act(() => result.current.atualizar());
    expect(result.current.conferido).toBe(false);
  });
  it('ignora leituras fora de ordem e de outro sítio/recurso, inclusive após voltar ao alvo', async () => {
    const a = pendente<{versao: number}>(), b = pendente<{versao: number}>();
    const carregar = vi.fn().mockReturnValueOnce(a.promessa).mockReturnValueOnce(b.promessa).mockResolvedValue({versao: 4});
    const {result, rerender} = renderHook(({id}) => useRecuperacaoConflito(id, carregar), {initialProps: {id: '1:abc'}});
    let primeira!: Promise<void>, segunda!: Promise<void>;
    act(() => {primeira = result.current.atualizar(); segunda = result.current.atualizar();});
    await act(async () => {b.resolver({versao: 3}); await segunda;});
    expect(result.current.atual).toEqual({versao: 3});
    rerender({id: '2:def'});
    expect(result.current.atual).toBeNull();
    rerender({id: '1:abc'});
    await act(async () => {a.resolver({versao: 2}); await primeira;});
    expect(result.current.atual).toBeNull();
    await act(() => result.current.atualizar());
    act(() => result.current.invalidar());
    expect(result.current.atual).toBeNull();
    expect(result.current.conferido).toBe(false);
  });
  it('apresenta diferenças e só oferece conferência após leitura, sem botão submit', () => {
    const atualizar = vi.fn(), conferir = vi.fn();
    const {rerender} = render(<RecuperacaoConflito conflito carregando={false} erro="" atualizado={false} conferido={false} aoAtualizar={atualizar} aoConferir={conferir}/>);
    fireEvent.click(screen.getByRole('button', {name: 'Atualizar contexto'}));
    expect(atualizar).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', {name: 'Conferi as alterações'})).toBeNull();
    rerender(<RecuperacaoConflito conflito carregando={false} erro="" atualizado conferido={false} aoAtualizar={atualizar} aoConferir={conferir}><p>Versão 1 → 2; saldo 6 → 4 L</p></RecuperacaoConflito>);
    expect(screen.getByText('Versão 1 → 2; saldo 6 → 4 L')).toBeTruthy();
    const botao = screen.getByRole('button', {name: 'Conferi as alterações'});
    expect(botao.getAttribute('type')).toBe('button');
    fireEvent.click(botao);
    expect(conferir).toHaveBeenCalledOnce();
  });
  it('mantém Escape e cancelamento do modal compartilhado sem gravar', () => {
    const fechar = vi.fn();
    render(<ModalBezerreiro titulo="Recuperar registro" aoFechar={fechar} form="teste"><input defaultValue="Rascunho preservado"/></ModalBezerreiro>);
    fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape'});
    expect(fechar).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', {name: 'Cancelar'}));
    expect(fechar).toHaveBeenCalledTimes(2);
    expect(consultarBezerreiro).not.toHaveBeenCalled();
  });
});

describe('Ações auxiliares dentro de formulário válido', () => {
  it('Anterior e Próxima mudam a página sem enviar o formulário', () => {
    const enviar = vi.fn(), mudar = vi.fn();
    render(<form aria-label="Destinação" onSubmit={e => {e.preventDefault(); enviar();}}>
      <input aria-label="Responsável" required defaultValue="Operadora"/>
      <input aria-label="Conferi os volumes" type="checkbox" required defaultChecked/>
      <PaginacaoBezerreiro pagina={2} total={60} mudar={mudar}/>
      <button type="submit">Salvar destinação</button>
    </form>);
    expect((screen.getByRole('form', {name: 'Destinação'}) as HTMLFormElement).checkValidity()).toBe(true);
    fireEvent.click(screen.getByRole('button', {name: 'Anterior'}));
    expect(mudar).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole('button', {name: 'Próxima'}));
    expect(mudar).toHaveBeenLastCalledWith(3);
    expect(mudar).toHaveBeenCalledTimes(2);
    expect(enviar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Salvar destinação'}));
    expect(enviar).toHaveBeenCalledOnce();
  });
  it('Tentar novamente recarrega a consulta sem enviar o formulário', () => {
    const enviar = vi.fn(), tentar = vi.fn();
    render(<form onSubmit={e => {e.preventDefault(); enviar();}}><input required defaultValue="Rascunho"/>
      <EstadoConsulta erro="Falha ao carregar" carregando={false} tentar={tentar}><p>Registros</p></EstadoConsulta>
    </form>);
    fireEvent.click(screen.getByRole('button', {name: 'Tentar novamente'}));
    expect(tentar).toHaveBeenCalledOnce();
    expect(enviar).not.toHaveBeenCalled();
  });
});
