// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SeletorClinico } from "./SeletorClinico";
import { obterOpcoesClinicas } from "./clinica-api";
vi.mock("./clinica-api", () => ({ obterOpcoesClinicas: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("consulta sob demanda, pagina10 no servidor e devolve escolha completa", async () => {
  vi.mocked(obterOpcoesClinicas).mockImplementation(async (_t, _s, _o, pagina) => ({ itens: Array.from({ length: pagina === 1 ? 10 : 1 }, (_, i) => ({ id: String((pagina - 1) * 10 + i + 1), nome: `Material ${(pagina - 1) * 10 + i + 1}` })), total: 11, pagina, porPagina: 10 }));
  const mudar = vi.fn();
  render(<SeletorClinico tarefaId="t" propriedadeId={7} opcao="MATERIAL" tipoTentativa="TE" rotulo="material" valor="" onChange={mudar} />);
  expect(obterOpcoesClinicas).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Selecionar material" }));
  await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(10));
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  fireEvent.click(await screen.findByRole("button", { name: "Usar Material 11" }));
  expect(mudar).toHaveBeenCalledWith("11", { id: "11", nome: "Material 11" });
  expect(obterOpcoesClinicas).toHaveBeenLastCalledWith("t", 7, "MATERIAL", 2, "", undefined, undefined, "TE", undefined);
});

it("hidrata a referência e seus metadados sem disparar alteração do operador",async()=>{
 const escolha={id:"planejado",nome:"Material planejado"};
 vi.mocked(obterOpcoesClinicas).mockResolvedValue({itens:[escolha],total:1,pagina:1,porPagina:10});
 const mudar=vi.fn(),hidratar=vi.fn();
 render(<SeletorClinico tarefaId="t" propriedadeId={7} opcao="MATERIAL" rotulo="material" valor="planejado" onChange={mudar} onHidratar={hidratar}/>);
 await screen.findByText("material: Material planejado");expect(hidratar).toHaveBeenCalledWith(escolha);expect(mudar).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"Limpar material"}));expect(mudar).toHaveBeenCalledWith("");
});
