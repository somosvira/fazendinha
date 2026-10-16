// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import { CorrigirFato } from "./CorrigirFato";
import { obterReproducao, reqV4 } from "./api";
vi.mock("./api", () => ({ obterReproducao: vi.fn(), reqV4: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); setPropriedadeAtiva(null); });
it("desvincula parto somente por escolha explícita e conserva período físico da lactação", async () => {
  vi.mocked(obterReproducao).mockResolvedValue({
    lactacoes: [{id:"l",animalId:"a",propriedadeId:1,inicio:"2026-10-13",encerradaEm:null,partoId:"p"}],
    animais: [],
    tentativas: [],
    avaliacoes: [],
    restricoes: [],
    partos: [
      {
        id: "p",
        animalId: "a",
        data: "2026-10-13",
        tipo: "NORMAL",
        status: "VALIDO",
      },
    ],
  });
  vi.mocked(reqV4).mockResolvedValue({});
  render(
    <CorrigirFato
      tipo="lactacao"
      id="l"
      animalId="a"
      propriedadeId={1}
      partoInicial="p"
      onFechar={vi.fn()}
      onSalvo={vi.fn()}
    />,
  );
  await screen.findByRole("option", { name: "2026-10-13 · NORMAL" });
  expect(
    (screen.getByLabelText("Parto vinculado") as HTMLSelectElement).value,
  ).toBe("p");
  fireEvent.change(screen.getByLabelText("Parto vinculado"), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByLabelText("Motivo da correção"), {
    target: { value: "Parto duplicado; lactação real permanece" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar correção" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalled());
  expect(vi.mocked(reqV4).mock.calls[0]).toMatchObject([
    "/reproducao/lactacoes/l/correcao",
    {
      propriedadeId: 1,
      partoId: null,
      motivo: "Parto duplicado; lactação real permanece",
    }, "POST", 1,
  ]);
});

it("complementa parto com CAS e não apaga campos intactos no retry", async()=>{
  vi.mocked(obterReproducao).mockResolvedValue({animais:[],tentativas:[],avaliacoes:[],restricoes:[],partos:[{id:"p",animalId:"a",data:"2026-10-13",tipo:"NORMAL",status:"VALIDO",versao:4,responsavel:"Maria",retencaoPlacenta:null}]});
  vi.mocked(reqV4).mockReset().mockRejectedValueOnce(new Error("Versão em conferência")).mockResolvedValueOnce({});
  render(<CorrigirFato tipo="parto" id="p" animalId="a" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()}/>);
  await waitFor(()=>expect((screen.getByLabelText("Responsável pelo parto (opcional)") as HTMLInputElement).value).toBe("Maria"));
  fireEvent.change(screen.getByLabelText("Retenção de placenta"),{target:{value:"NAO"}});
  fireEvent.change(screen.getByLabelText("Motivo da correção"),{target:{value:"Avaliação posterior do pós-parto"}});
  fireEvent.click(screen.getByRole("button",{name:"Salvar correção"}));
  await screen.findByText("Versão em conferência");
  const corpo=vi.mocked(reqV4).mock.calls[0][1];
  expect(corpo).toMatchObject({versaoEsperada:4,retencaoPlacenta:false,chave:expect.any(String)});
  expect(corpo).not.toHaveProperty("responsavel");expect(corpo).not.toHaveProperty("tipo");
  fireEvent.click(screen.getByRole("button",{name:"Salvar correção"}));
  await waitFor(()=>expect(reqV4).toHaveBeenCalledTimes(2));
  expect(vi.mocked(reqV4).mock.calls[1][1]).toEqual(corpo);
});

it("substitui escore explicitamente mantendo escala declarada e histórico do exame",async()=>{
  vi.mocked(obterReproducao).mockResolvedValue({animais:[],tentativas:[],avaliacoes:[],restricoes:[],partos:[{id:"p",animalId:"a",data:"2026-10-13",tipo:"NORMAL",status:"VALIDO",versao:5,examesPosParto:[{id:"e",data:"2026-10-14",status:"VALIDO",resultados:[{campo:"ESCORE",valor:3},{campo:"ESCALA_MIN",valor:1},{campo:"ESCALA_MAX",valor:5}]}]}]});
  vi.mocked(reqV4).mockReset().mockResolvedValue({});
  render(<CorrigirFato tipo="parto" id="p" animalId="a" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()}/>);
  await screen.findByRole("option",{name:"Substituir escore de 2026-10-14"});
  fireEvent.change(screen.getByLabelText("Revisão do escore corporal"),{target:{value:"SUBSTITUIR:e"}});
  expect((screen.getByLabelText("Mínimo da escala") as HTMLInputElement).value).toBe("1");
  fireEvent.change(screen.getByLabelText("Valor do escore"),{target:{value:"3.5"}});
  fireEvent.change(screen.getByLabelText("Motivo da correção"),{target:{value:"Conferência da leitura original"}});
  fireEvent.click(screen.getByRole("button",{name:"Salvar correção"}));
  await waitFor(()=>expect(reqV4).toHaveBeenCalled());
  expect(vi.mocked(reqV4).mock.calls[0][1]).toMatchObject({versaoEsperada:5,escoreMatriz:{acao:"SUBSTITUIR",exameId:"e",data:"2026-10-14",valor:3.5,escalaMin:1,escalaMax:5,motivo:"Conferência da leitura original"}});
});


it("carrega correção e complementos pelo sítio do fato com outro sítio ativo", async () => {
  setPropriedadeAtiva(99);
  vi.mocked(obterReproducao).mockResolvedValue({ animais: [], tentativas: [], avaliacoes: [], restricoes: [],
    partos: [{ id: "p", animalId: "a", data: "2026-10-13", tipo: "NORMAL", status: "VALIDO", versao: 4 }] });
  vi.mocked(reqV4).mockImplementation(async path => path.startsWith("/sanidade/ocorrencias?")
    ? [{ id: "rp7", inicio: "2026-10-13", doenca: { nome: "Retenção no sítio do parto" } }]
    : path === "/animais/a" ? { historicoPesagens: [{ id: "peso7", data: "2026-10-13", pesoKg: "450" }] } : {});
  render(<CorrigirFato tipo="parto" id="p" animalId="a" propriedadeId={7} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await waitFor(() => expect(obterReproducao).toHaveBeenCalledWith("a", 7));
  fireEvent.change(screen.getByLabelText("Retenção de placenta"), { target: { value: "SIM" } });
  fireEvent.change(screen.getByLabelText("Ocorrência sanitária de retenção"), { target: { value: "VINCULAR" } });
  await screen.findByRole("option", { name: /Retenção no sítio do parto/ });
  fireEvent.change(screen.getByLabelText("Ocorrência existente"), { target: { value: "rp7" } });
  fireEvent.change(screen.getByLabelText("Peso da matriz"), { target: { value: "VINCULAR" } });
  await screen.findByRole("option", { name: "2026-10-13 · 450 kg" });
  fireEvent.change(screen.getByLabelText("Pesagem existente"), { target: { value: "peso7" } });
  expect(reqV4).toHaveBeenCalledWith("/sanidade/ocorrencias?animalId=a", undefined, "GET", 7);
  expect(reqV4).toHaveBeenCalledWith("/animais/a", undefined, "GET", 7);
  fireEvent.change(screen.getByLabelText("Motivo da correção"), { target: { value: "Conferência dos complementos do parto" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar correção" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/partos/p/correcao", expect.objectContaining({
    propriedadeId: 7, pesoMatriz: { acao: "VINCULAR", pesagemId: "peso7" },
    ocorrenciaRetencao: { acao: "VINCULAR", ocorrenciaId: "rp7" },
  }), "POST", 7));
});
