// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resumirAlertas, type ConsultaAlertas } from "./api";
import { useResumoAlertasAnimal } from "./useResumoAlertasAnimal";

vi.mock("./api", () => ({ resumirAlertas: vi.fn() }));
const consultar = vi.mocked(resumirAlertas);
const resposta = (cuidados = 17, estado: ConsultaAlertas["cobertura"]["estado"] = "ATUALIZADA"): ConsultaAlertas => ({
  itens: [], total: cuidados, pagina: 1, tamanho: 1,
  totaisGerais: { cuidados: 100, animais: 30, necessidades: 120 },
  totaisFiltrados: { cuidados, animais: 1, necessidades: cuidados },
  tiposDisponiveis: [], cobertura: { estado, diaCoberto: null, ultimaConclusao: null, erro: null },
});
function pendente<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>(resolve => { resolver = resolve; });
  return { promessa, resolver };
}
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe("contagem confirmada de alertas do animal", () => {
  it("usa o total filtrado do servidor, independentemente dos itens da página", async () => {
    consultar.mockResolvedValue(resposta());
    const { result } = renderHook(() => useResumoAlertasAnimal("animal-1", 2));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(17));
    expect(consultar).toHaveBeenCalledWith({ animalId: "animal-1", propriedadeId: 2, disposicao: "ATENCAO", tamanho: 1 }, expect.any(AbortSignal));
  });

  it.each(["NAO_AVALIADO", "DESATUALIZADA", "FALHA"] as const)("não anuncia quantidade com cobertura %s", async estado => {
    consultar.mockResolvedValue(resposta(17, estado));
    const { result } = renderHook(() => useResumoAlertasAnimal("animal-1", 2));
    await act(async () => {});
    expect(result.current).toBeNull();
  });

  it("mantém ausência, carregamento e falha sem um zero aparente", async () => {
    const requisicao = pendente<ConsultaAlertas>();
    consultar.mockReturnValueOnce(requisicao.promessa).mockRejectedValueOnce(new Error("Sem conexão")).mockResolvedValueOnce(resposta(0));
    const { result, rerender } = renderHook(({ revisao }) => useResumoAlertasAnimal("animal-1", 2, revisao), { initialProps: { revisao: 0 } });
    expect(result.current).toBeNull();
    await act(async () => { requisicao.resolver(resposta(0)); });
    expect(result.current).toBeNull();
    rerender({ revisao: 1 });
    await act(async () => {});
    expect(result.current).toBeNull();
    rerender({ revisao: 2 });
    await act(async () => {});
    expect(result.current).toBeNull();
  });

  it("aborta e ignora respostas anteriores ao mudar animal ou sítio", async () => {
    const anterior = pendente<ConsultaAlertas>();
    const atual = pendente<ConsultaAlertas>();
    consultar.mockReturnValueOnce(anterior.promessa).mockReturnValueOnce(atual.promessa).mockResolvedValueOnce(resposta(5));
    const { result, rerender } = renderHook(({ animal, sitio }) => useResumoAlertasAnimal(animal, sitio), { initialProps: { animal: "a1", sitio: 1 } });
    const sinal = consultar.mock.calls[0][1];
    rerender({ animal: "a2", sitio: 2 });
    expect(sinal?.aborted).toBe(true);
    await act(async () => { atual.resolver(resposta(3)); });
    expect(result.current).toBe(3);
    await act(async () => { anterior.resolver(resposta(99)); });
    expect(result.current).toBe(3);
    rerender({ animal: "a2", sitio: 3 });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(5));
    expect(consultar.mock.calls[2][0]).toMatchObject({ animalId: "a2", propriedadeId: 3 });
  });

  it("refaz a consulta por revisão e aviso de mudança, ocultando o total anterior", async () => {
    const depois = pendente<ConsultaAlertas>();
    consultar.mockResolvedValueOnce(resposta(3)).mockResolvedValueOnce(resposta(2)).mockReturnValueOnce(depois.promessa);
    const { result, rerender, unmount } = renderHook(({ revisao }) => useResumoAlertasAnimal("a1", 1, revisao), { initialProps: { revisao: 0 } });
    await waitFor(() => expect(result.current).toBe(3));
    rerender({ revisao: 1 });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(2));
    act(() => { window.dispatchEvent(new Event("pecuaria:alertas-atualizados")); });
    expect(result.current).toBeNull();
    expect(consultar).toHaveBeenCalledTimes(3);
    const sinal = consultar.mock.calls[2][1];
    unmount();
    expect(sinal?.aborted).toBe(true);
    await act(async () => { depois.resolver(resposta(9)); });
    act(() => { window.dispatchEvent(new Event("pecuaria:alertas-atualizados")); });
    expect(consultar).toHaveBeenCalledTimes(3);
  });

  it("aguarda a identificação da ficha para consultar", () => {
    renderHook(() => useResumoAlertasAnimal(undefined, 1));
    expect(consultar).not.toHaveBeenCalled();
  });
});
