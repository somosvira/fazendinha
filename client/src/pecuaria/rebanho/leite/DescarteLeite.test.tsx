import { selecionarCampoLeite } from "./select-campo-teste";
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { DescarteLeite } from "./DescarteLeite";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { listarProdutos } from "../../../estoque/api";
vi.mock("./operacoes-api", () => ({
  consultarLeite: vi.fn(),
  registrarLeite: vi.fn(),
}));
vi.mock("../../../estoque/api", () => ({ listarProdutos: vi.fn() }));
vi.mock("../../../propriedadeScope", () => ({
  getPropriedadeAtiva: () => null,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("descarta uma quantidade explícita da origem sem atribuir destinatário ou repetir saída", async () => {
  vi.mocked(listarProdutos).mockResolvedValue([
    {
      id: "leite",
      nome: "Leite",
      unidade: "L",
      ativo: true,
      rastrearPartidas: false,
    },
  ]);
  vi.mocked(consultarLeite).mockImplementation(async (p) =>
    p.startsWith("/destinos/origens")
      ? {
          itens: [
            {
              entradaId: "origem",
              data: "2026-10-19",
              nomeOrdenha: "Tarde",
              quantidadeDisponivelLitros: 10,
            },
          ],
        }
      : { propriedadeId: 2, itens: [], total: 0, tamanho: 20 },
  );
  render(<DescarteLeite podeLancar />);
  fireEvent.click(screen.getByRole("button", { name: "Registrar descarte" }));
  await selecionarCampoLeite("Produto para descarte", "leite");
  await selecionarCampoLeite("Origem descartada", "origem");
  fireEvent.change(screen.getByLabelText("Litros descartados"), {
    target: { value: "3,5" },
  });
  fireEvent.change(screen.getByLabelText("Motivo do descarte"), {
    target: { value: "Derramamento conferido no manejo" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar descarte físico" }),
  );
  await waitFor(() =>
    expect(registrarLeite).toHaveBeenCalledWith(
      "/descartes",
      2,
      expect.objectContaining({
        entradaId: "origem",
        quantidadeLitros: 3.5,
        quantidadeDisponivelEsperadaLitros: 10,
      }),
    ),
  );
  expect(vi.mocked(registrarLeite).mock.calls[0][2]).not.toHaveProperty(
    "parcelas",
  );
});

it("registra Casa com responsável e origem comercial sem criar descarte físico",async()=>{
 vi.mocked(listarProdutos).mockResolvedValue([{id:"leite",nome:"Leite",unidade:"L",ativo:true,rastrearPartidas:false}]);
 vi.mocked(consultarLeite).mockImplementation(async p=>p.startsWith("/destinos/origens")?{itens:[{entradaId:"origem",data:"2026-10-19",nomeOrdenha:"Tarde",natureza:"COMERCIAL",quantidadeDisponivelLitros:10}]}:{propriedadeId:2,itens:[],total:0,tamanho:20});
 render(<DescarteLeite podeLancar modo="retirada"/>);fireEvent.click(screen.getByRole("button",{name:"Registrar retirada interna"}));
 await selecionarCampoLeite("Produto de leite","leite");await selecionarCampoLeite("Origem do leite","origem");
 fireEvent.change(screen.getByLabelText("Responsável"),{target:{value:"Maria"}});fireEvent.change(screen.getByLabelText("Volume (L)"),{target:{value:"2,125"}});fireEvent.change(screen.getByLabelText("Motivo da saída"),{target:{value:"Retirada para a casa"}});
 fireEvent.click(screen.getByRole("button",{name:"Confirmar retirada interna"}));await waitFor(()=>expect(registrarLeite).toHaveBeenCalledWith("/retiradas-internas",2,expect.objectContaining({destino:"CASA",responsavel:"Maria",quantidadeLitros:2.125,entradaId:"origem"})));
 expect(vi.mocked(registrarLeite).mock.calls.some(c=>c[0]==="/descartes")).toBe(false);
});
