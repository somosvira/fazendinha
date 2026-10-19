import { afterEach, describe, expect, it, vi } from "vitest";
import { executarComGuardaNavegacao, registrarGuardaNavegacao } from "./navegacaoGuardada";

afterEach(() => { vi.restoreAllMocks(); });

describe("guarda de navegação local", () => {
  it("mantém sítio e tela quando a gravação rejeita a saída", async () => {
    const estado = { sitio: 1, tela: "visita" };
    const cancelar = registrarGuardaNavegacao(async () => false);
    const resultado = executarComGuardaNavegacao(() => { estado.sitio = 2; estado.tela = "estoque"; });
    expect(resultado).toBeInstanceOf(Promise);
    await expect(resultado).resolves.toBe(false);
    expect(estado).toEqual({ sitio: 1, tela: "visita" });
    cancelar();
  });

  it("aguarda a gravação antes de executar a navegação", async () => {
    let concluir!: (ok: boolean) => void;
    const guarda = vi.fn(() => new Promise<boolean>(resolver => { concluir = resolver; }));
    const acao = vi.fn();
    const cancelar = registrarGuardaNavegacao(guarda);
    const resultado = executarComGuardaNavegacao(acao);
    await Promise.resolve();
    expect(acao).not.toHaveBeenCalled();
    concluir(true);
    await expect(resultado).resolves.toBe(true);
    expect(acao).toHaveBeenCalledOnce();
    expect(guarda).toHaveBeenCalledOnce();
    cancelar();
  });

  it("aplica somente o destino mais recente enquanto a mesma gravação aguarda", async () => {
    let concluir!: (ok: boolean) => void;
    const guarda = vi.fn(() => new Promise<boolean>(resolver => { concluir = resolver; }));
    const primeira = vi.fn(), segunda = vi.fn();
    const cancelar = registrarGuardaNavegacao(guarda);
    const resultadoAntigo = executarComGuardaNavegacao(primeira);
    await Promise.resolve();
    const resultadoAtual = executarComGuardaNavegacao(segunda);
    concluir(true);
    await expect(resultadoAntigo).resolves.toBe(true);
    await expect(resultadoAtual).resolves.toBe(true);
    expect(primeira).not.toHaveBeenCalled();
    expect(segunda).toHaveBeenCalledOnce();
    cancelar();
  });

  it("remove a guarda quando a tela proprietária desmonta durante a espera", async () => {
    let concluir!: (ok: boolean) => void;
    const guarda = vi.fn(() => new Promise<boolean>(resolver => { concluir = resolver; }));
    const acao = vi.fn();
    const cancelar = registrarGuardaNavegacao(guarda);
    const resultado = executarComGuardaNavegacao(acao);
    await Promise.resolve();
    cancelar();
    concluir(true);
    await expect(resultado).resolves.toBe(false);
    expect(acao).not.toHaveBeenCalled();
    const semGuarda = vi.fn();
    expect(executarComGuardaNavegacao(semGuarda)).toBeUndefined();
    expect(semGuarda).toHaveBeenCalledOnce();
  });
});
