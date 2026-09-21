import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), compromissos: vi.fn(), leitura: vi.fn() }));
vi.mock("../services/financeiro/dashboard.js", () => ({ obterDashboard: mocks.dashboard }));
vi.mock("../services/financeiro/operacoes.js", () => ({ listarCompromissos: mocks.compromissos }));
vi.mock("../services/propriedade.js", () => ({ resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: vi.fn() }));
import { financeiroRouter } from "./financeiro.js";
const app = new Hono().route("/", financeiroRouter);
beforeEach(() => { vi.clearAllMocks(); mocks.dashboard.mockResolvedValue({}); mocks.compromissos.mockResolvedValue([]); mocks.leitura.mockResolvedValue(8); });
it.each(["dashboard", "compromissos"])("%s passa período inclusivo e escopo autorizado ao serviço", async route => {
  const response = await app.request(`/financeiro/${route}?inicio=2026-09-12&fim=2026-09-15`);
  expect(response.status).toBe(200);
  if (route === "dashboard") expect(mocks.dashboard).toHaveBeenCalledWith(8, new Date("2026-09-12T00:00:00Z"), new Date("2026-09-15T23:59:59.999Z"));
  else expect(mocks.compromissos).toHaveBeenCalledWith(8, { inicio: new Date("2026-09-12T00:00:00Z"), fim: new Date("2026-09-15T23:59:59.999Z") });
});
it.each(["inicio=2026-09-15&fim=2026-09-12", "inicio=2026-02-30&fim=2026-03-01", "inicio=inválido&fim=2026-09-15", "inicio=2026-09-12"])("recusa intervalo inválido: %s", async query => {
  const response = await app.request(`/financeiro/dashboard?${query}`);
  expect(response.status).toBe(422);
  expect(mocks.dashboard).not.toHaveBeenCalled();
});
