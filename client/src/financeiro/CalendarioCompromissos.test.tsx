// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { CalendarioCompromissos } from "./CalendarioCompromissos";
import type { Compromisso } from "./novo-api";
import { diasDoCalendario, deslocarMes } from "./lib/calendario";
import { uid } from "../lib/uid.fixture";

afterEach(cleanup);
const itens: Compromisso[] = [
  { id: uid(1), seq: 1, tipo: "PAGAR", status: "PARCIAL", saldoPendente: "50", valorOriginal: "100", valorLiquidado: "50", dataVencimento: "2026-09-01T00:00:00Z", numeroParcela: 1, totalParcelas: 2, vencido: true, parceiro: null, operacao: { id: uid(10), numero: 10, descricao: "Veterinário", tipo: "SERVICO" } },
  { id: uid(2), seq: 2, tipo: "RECEBER", status: "PENDENTE", saldoPendente: "200", valorOriginal: "200", valorLiquidado: "0", dataVencimento: "2026-09-01", numeroParcela: 1, totalParcelas: 1, vencido: false, parceiro: null, operacao: { id: uid(11), numero: 11, descricao: "Venda de leite", tipo: "VENDA" } },
];
function Calendario({ mesInicial = "2026-09", onLiquidar = vi.fn() }: { mesInicial?: string; onLiquidar?: (compromisso: Compromisso) => void }) {
  const [mes, setMes] = useState(mesInicial);
  return <CalendarioCompromissos itens={itens} mes={mes} onChangeMes={setMes} onLiquidar={onLiquidar} />;
}

describe("calendário de compromissos", () => {
  it("agrupa no dia financeiro correto e permite liquidar pelo detalhe sem duplicar a parcela", () => {
    const liquidar = vi.fn();
    const { container } = render(<Calendario onLiquidar={liquidar} />);
    const dia = within(container.querySelector('[data-dia="2026-09-01"]') as HTMLElement);
    expect(dia.getAllByRole("button")).toHaveLength(2);
    fireEvent.click(dia.getByRole("button", { name: /\(1\/2\) Veterinário, a pagar/ }));
    const modal = within(screen.getByRole("dialog"));
    expect(modal.getByRole("heading", { name: "(1/2) Veterinário" })).toBeTruthy();
    expect(modal.getByRole("link", { name: "OP-0010" }).getAttribute("href")).toBe(`/financeiro/operacoes/${uid(10)}`);
    fireEvent.click(modal.getByRole("button", { name: "Registrar pagamento" }));
    expect(liquidar).toHaveBeenCalledWith(itens[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("navega entre meses e apresenta meses vazios", () => {
    render(<Calendario />);
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(screen.getByRole("heading", { name: "outubro de 2026" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Nenhum compromisso neste mês");
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(screen.getByRole("button", { name: /Venda de leite, a receber/ })).toBeTruthy();
  });

  it("calcula semanas completas inclusive na virada do ano e em fevereiro bissexto", () => {
    const fevereiro = diasDoCalendario("2024-02");
    expect(fevereiro.some(d => d.data === "2024-02-29")).toBe(true);
    expect(fevereiro).toHaveLength(35);
    expect(diasDoCalendario("2026-08")).toHaveLength(42);
    expect(deslocarMes("2026-12", 1)).toBe("2027-01");
    expect(deslocarMes("2026-01", -1)).toBe("2025-12");
  });
});
