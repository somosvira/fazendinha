// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./fila", () => ({
  garantirProcessamento: vi.fn(),
}));

function definirNavigatorOnline(valor: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value: valor, configurable: true });
}

describe("iniciarRetomadaAutomatica — seed do estado online no boot", () => {
  beforeEach(() => vi.resetModules());

  it("onlineManager reflete navigator.onLine mesmo sem nenhum evento novo (boot já offline)", async () => {
    definirNavigatorOnline(false);
    const { onlineManager } = await import("@tanstack/react-query");
    const { iniciarRetomadaAutomatica } = await import("./resume");
    iniciarRetomadaAutomatica();
    expect(onlineManager.isOnline()).toBe(false);
  });

  it("onlineManager reflete navigator.onLine=true no boot normal", async () => {
    definirNavigatorOnline(true);
    const { onlineManager } = await import("@tanstack/react-query");
    const { iniciarRetomadaAutomatica } = await import("./resume");
    iniciarRetomadaAutomatica();
    expect(onlineManager.isOnline()).toBe(true);
  });

  it("continua atualizando via evento online/offline depois do boot", async () => {
    definirNavigatorOnline(true);
    const { onlineManager } = await import("@tanstack/react-query");
    const { iniciarRetomadaAutomatica } = await import("./resume");
    iniciarRetomadaAutomatica();
    window.dispatchEvent(new Event("offline"));
    expect(onlineManager.isOnline()).toBe(false);
    window.dispatchEvent(new Event("online"));
    expect(onlineManager.isOnline()).toBe(true);
  });
});
