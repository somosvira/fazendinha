// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./fila", () => ({
  garantirProcessamento: vi.fn(),
}));

function definirNavigatorOnline(valor: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value: valor, configurable: true });
}

function respostaHealth(ok: boolean) {
  return Promise.resolve(new Response(null, { status: ok ? 200 : 503 }));
}

describe("iniciarRetomadaAutomatica — seed do estado online no boot", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it("semeia com navigator.onLine antes da sonda responder (boot já offline)", async () => {
    definirNavigatorOnline(false);
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { onlineManager } = await import("@tanstack/react-query");
    const { iniciarRetomadaAutomatica } = await import("./resume");
    iniciarRetomadaAutomatica();
    expect(onlineManager.isOnline()).toBe(false);
  });

  it("corrige pra offline quando navigator.onLine mentiu (diz online, sonda falha)", async () => {
    definirNavigatorOnline(true);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));
    const { onlineManager } = await import("@tanstack/react-query");
    const { iniciarRetomadaAutomatica } = await import("./resume");
    iniciarRetomadaAutomatica();
    expect(onlineManager.isOnline()).toBe(true); // ainda não corrigiu, sonda é async
    await vi.waitFor(() => expect(onlineManager.isOnline()).toBe(false));
  });

  it("confirma online quando a sonda responde ok", async () => {
    definirNavigatorOnline(true);
    vi.stubGlobal("fetch", vi.fn(() => respostaHealth(true)));
    const { onlineManager } = await import("@tanstack/react-query");
    const { iniciarRetomadaAutomatica } = await import("./resume");
    iniciarRetomadaAutomatica();
    await vi.waitFor(() => expect(onlineManager.isOnline()).toBe(true));
  });

  it("evento online dispara nova sonda em vez de confiar direto", async () => {
    definirNavigatorOnline(false);
    const fetchMock = vi.fn(() => respostaHealth(true));
    vi.stubGlobal("fetch", fetchMock);
    const { onlineManager } = await import("@tanstack/react-query");
    const { iniciarRetomadaAutomatica } = await import("./resume");
    iniciarRetomadaAutomatica();
    await vi.waitFor(() => expect(onlineManager.isOnline()).toBe(false));

    fetchMock.mockClear();
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(onlineManager.isOnline()).toBe(true));
  });

  it("evento offline confia direto, sem sondar", async () => {
    definirNavigatorOnline(true);
    vi.stubGlobal("fetch", vi.fn(() => respostaHealth(true)));
    const { onlineManager } = await import("@tanstack/react-query");
    const { iniciarRetomadaAutomatica } = await import("./resume");
    iniciarRetomadaAutomatica();
    await vi.waitFor(() => expect(onlineManager.isOnline()).toBe(true));
    window.dispatchEvent(new Event("offline"));
    expect(onlineManager.isOnline()).toBe(false);
  });
});
