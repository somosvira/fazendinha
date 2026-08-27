// @vitest-environment jsdom
// useSalvarOffline: online espera a confirmação real (onSuccess/onError do
// mutate) antes de chamar onSalvo — erro fica disponível pra mostrar dentro
// do próprio modal (onErroInline). Offline não tem como esperar por tempo
// indeterminado, então chama onSalvo na hora — um erro que chegue bem depois
// (quando a fila sincronizar) vai pro onErroTardio (toast), já que o modal
// já não existe mais nesse momento.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSalvarOffline } from "./useSalvarOffline";
import { onlineManager } from "./resume";

afterEach(() => onlineManager.setOnline(true));

describe("useSalvarOffline", () => {
  it("offline: chama onSalvo na hora, sem esperar o mutate resolver", () => {
    onlineManager.setOnline(false);
    const { result } = renderHook(() => useSalvarOffline());
    const mutate = vi.fn();
    const onSalvo = vi.fn();

    act(() => {
      result.current.salvar(mutate, { x: 1 }, { onSalvo, onErroInline: vi.fn(), onErroTardio: vi.fn() });
    });

    expect(onSalvo).toHaveBeenCalledTimes(1);
    expect(result.current.salvando).toBe(false);
    expect(mutate).toHaveBeenCalledWith({ x: 1 }, expect.objectContaining({ onError: expect.any(Function) }));
  });

  it("online: fica 'salvando' e só chama onSalvo quando o mutate confirma sucesso", () => {
    let opts: any;
    const mutate = vi.fn((_input, o) => { opts = o; });
    const onSalvo = vi.fn();
    const { result } = renderHook(() => useSalvarOffline());

    act(() => {
      result.current.salvar(mutate, { x: 1 }, { onSalvo, onErroInline: vi.fn(), onErroTardio: vi.fn() });
    });
    expect(result.current.salvando).toBe(true);
    expect(onSalvo).not.toHaveBeenCalled();

    act(() => { opts.onSuccess({ id: "1" }); });
    expect(result.current.salvando).toBe(false);
    expect(onSalvo).toHaveBeenCalledTimes(1);
  });

  it("online: erro chama onErroInline (não onErroTardio) e mantém salvando false pra permitir corrigir", () => {
    let opts: any;
    const mutate = vi.fn((_input, o) => { opts = o; });
    const onErroInline = vi.fn();
    const onErroTardio = vi.fn();
    const { result } = renderHook(() => useSalvarOffline());

    act(() => {
      result.current.salvar(mutate, { x: 1 }, { onSalvo: vi.fn(), onErroInline, onErroTardio });
    });
    act(() => { opts.onError(new Error("peso inválido")); });

    expect(onErroInline).toHaveBeenCalledWith("peso inválido");
    expect(onErroTardio).not.toHaveBeenCalled();
    expect(result.current.salvando).toBe(false);
  });
});
