// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CirculoMarcosReprodutivos, type MarcoReprodutivo } from "./CirculoMarcosReprodutivos";

afterEach(cleanup);
const marcos: MarcoReprodutivo[] = [
  { id: "PARTO", rotulo: "Parto", data: "2026-07-01", estado: "REALIZADO" },
  { id: "FIM_PEV", rotulo: "Fim do PEV", data: "2026-08-30", estado: "REALIZADO" },
  { id: "LIBERACAO", rotulo: "Liberação", data: "2026-09-05", estado: "REALIZADO" },
  { id: "PRIMEIRO_SERVICO", rotulo: "Primeiro serviço", data: "2026-09-10", estado: "REALIZADO" },
  { id: "DG_POSITIVO", rotulo: "DG positivo", data: null, estado: "PENDENTE" },
];
describe("Marcos reprodutivos factuais", () => {
  it("espera de DG conserva a tentativa sem apresentar progresso como chance de prenhez", () => {
    render(<CirculoMarcosReprodutivos estado="Aguardando DG" marcos={marcos} eventos={[
      { id: "ia", data: "2026-09-10", titulo: "Primeiro serviço", detalhe: "IA · tentativa 1" },
      { id: "dg", data: null, titulo: "Diagnóstico ainda não registrado", pendente: true },
    ]} />);
    expect(screen.getByRole("status").textContent).toBe("Aguardando DG");
    expect(screen.getByRole("img").textContent).toContain("DG positivo: Pendente, data não informada");
    expect(screen.getByText("4 de 5 marcos registrados")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("list", { name: "Eventos do ciclo" }).textContent).toContain("Data não informada · Diagnóstico ainda não registrado");
  });
  it("liberada sem serviço distingue zero dias de intervalo desconhecido", () => {
    render(<CirculoMarcosReprodutivos estado="Liberada, aguardando serviço" marcos={marcos.slice(0, 3)} eventos={[]}
      intervalos={[{ rotulo: "Espera desde a liberação", dias: 0 }, { rotulo: "Parto ao serviço", dias: null }]}
      pendencias={["Primeiro serviço ainda não registrado"]} />);
    expect(screen.getByText("0 dias")).toBeTruthy();
    expect(screen.getByText("Não aferido")).toBeTruthy();
    expect(screen.getByLabelText("Lacunas e pendências do ciclo").textContent).toContain("Primeiro serviço ainda não registrado");
    expect(screen.getByRole("img").textContent).toContain("Primeiro serviço: Não informado");
  });
  it("histórico incompleto e PEV futuro não inventam marcos realizados", () => {
    render(<CirculoMarcosReprodutivos estado="Histórico incompleto" marcos={[
      { id: "FIM_PEV", rotulo: "Fim do PEV", data: "2027-01-10", estado: "PREVISTO" },
    ]} eventos={[]} />);
    expect(screen.getByText("0 de 5 marcos registrados")).toBeTruthy();
    expect(screen.getByRole("img").textContent).toContain("Fim do PEV: Previsto em 10/01/2027");
    expect(screen.getByRole("img").textContent).toContain("Parto: Não informado, data não informada");
  });
  it("perda posterior mantém o DG positivo e as duas tentativas no mesmo percurso", () => {
    render(<CirculoMarcosReprodutivos estado="Perda registrada · novo serviço aguardando DG" marcos={marcos.map(m => m.id === "DG_POSITIVO" ? { ...m, data: "2026-10-12", estado: "REALIZADO" } : m)} eventos={[
      { id: "ia1", data: "2026-09-10", titulo: "Tentativa 1" },
      { id: "dg", data: "2026-10-12", titulo: "DG positivo" },
      { id: "perda", data: "2026-10-20", titulo: "Perda gestacional", detalhe: "Perda registrada; causa desconhecida." },
      { id: "ia2", data: "2026-11-03", titulo: "Tentativa 2" },
    ]} />);
    const eventos = within(screen.getByRole("list", { name: "Eventos do ciclo" })).getAllByRole("listitem");
    expect(eventos.map(e => e.textContent)).toEqual([
      "10/09/2026 · Tentativa 1", "12/10/2026 · DG positivo",
      "20/10/2026 · Perda gestacionalPerda registrada; causa desconhecida.", "03/11/2026 · Tentativa 2",
    ]);
    expect(screen.getByRole("status").textContent).toContain("Perda registrada");
    expect(screen.getByText("5 de 5 marcos registrados")).toBeTruthy();
  });
  it("liberação antes do PEV conserva datas e ordem factual enviadas pelo servidor", () => {
    render(<CirculoMarcosReprodutivos estado="Serviço antecipado registrado" marcos={marcos.map(m => m.id === "LIBERACAO" ? { ...m, data: "2026-08-20" } : m)} eventos={[
      { id: "lib", data: "2026-08-20", titulo: "Liberação individual" },
      { id: "ia", data: "2026-08-25", titulo: "Primeiro serviço", detalhe: "Anterior ao fim do PEV." },
      { id: "pev", data: "2026-08-30", titulo: "Fim do PEV" },
    ]} />);
    const eventos = within(screen.getByRole("list", { name: "Eventos do ciclo" })).getAllByRole("listitem");
    expect(eventos[0].textContent).toContain("20/08/2026 · Liberação individual");
    expect(eventos[2].textContent).toContain("30/08/2026 · Fim do PEV");
    expect(screen.getByRole("img").textContent).toContain("Liberação: Registrado em 20/08/2026");
  });
});
