// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { DashboardCompromissos } from "./DashboardCompromissos";
import { getHojeISO } from "../lib/hoje";
import type { Compromisso } from "./novo-api";
import { uid } from "../lib/uid.fixture";
afterEach(cleanup);

it("apresenta o próximo vencimento fora dos sete dias sem alterar o grupo e abre seus detalhes", () => {
  const data = new Date(`${getHojeISO()}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + 10);
  const item: Compromisso = { id: uid(1), seq: 1, tipo: "PAGAR", status: "PENDENTE", saldoPendente: "100", valorOriginal: "100", valorLiquidado: "0", dataVencimento: data.toISOString().slice(0, 10), numeroParcela: 1, totalParcelas: 1, vencido: false, parceiro: null, operacao: { id: uid(10), numero: 10, descricao: "Manutenção do trator", tipo: "SERVICO" } };
  render(<DashboardCompromissos itens={[item]} href="/financeiro/compromissos" onLiquidar={vi.fn()} />);
  expect(screen.getByRole("tab", { name: "Próximos 7 dias (0)" })).toBeTruthy();
  expect(screen.getByText(/fora dos próximos 7 dias/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Manutenção do trator/ }));
  expect(screen.getByRole("dialog", { name: "Detalhes do compromisso" })).toBeTruthy();
});
