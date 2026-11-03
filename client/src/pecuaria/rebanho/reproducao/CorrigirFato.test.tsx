// @vitest-environment jsdom
import { alterarControle } from "@/lib/controles.fixture";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import { lactacaoSecagem } from "./PesoSecagem.fixture";
import { CorrigirFato } from "./CorrigirFato";
import { obterReproducao, reqV4, type FatoReprodutivo } from "./api";
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
  await esperarOpcao("2026-10-13 · NORMAL");
  expect(
    (screen.getByLabelText("Parto vinculado") as HTMLSelectElement).value,
  ).toBe("p");
  await alterarControle(screen.getByLabelText("Parto vinculado"), {
    target: { value: "" },
  });
  await alterarControle(screen.getByLabelText("Motivo da correção"), {
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
  await alterarControle(screen.getByLabelText("Retenção de placenta"),{target:{value:"NAO"}});
  await alterarControle(screen.getByLabelText("Motivo da correção"),{target:{value:"Avaliação posterior do pós-parto"}});
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
  await esperarOpcao("Substituir escore de 2026-10-14");
  await alterarControle(screen.getByLabelText("Revisão do escore corporal"),{target:{value:"SUBSTITUIR:e"}});
  expect((screen.getByLabelText("Mínimo da escala") as HTMLInputElement).value).toBe("1");
  await alterarControle(screen.getByLabelText("Valor do escore"),{target:{value:"3.5"}});
  await alterarControle(screen.getByLabelText("Motivo da correção"),{target:{value:"Conferência da leitura original"}});
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
  await alterarControle(screen.getByLabelText("Retenção de placenta"), { target: { value: "SIM" } });
  await alterarControle(screen.getByLabelText("Ocorrência sanitária de retenção"), { target: { value: "VINCULAR" } });
  await esperarOpcao(/Retenção no sítio do parto/);
  await alterarControle(screen.getByLabelText("Ocorrência existente"), { target: { value: "rp7" } });
  await alterarControle(screen.getByLabelText("Peso da matriz"), { target: { value: "VINCULAR" } });
  await esperarOpcao("2026-10-13 · 450 kg");
  await alterarControle(screen.getByLabelText("Pesagem existente"), { target: { value: "peso7" } });
  expect(reqV4).toHaveBeenCalledWith("/sanidade/ocorrencias?animalId=a", undefined, "GET", 7);
  expect(reqV4).toHaveBeenCalledWith("/animais/a", undefined, "GET", 7);
  await alterarControle(screen.getByLabelText("Motivo da correção"), { target: { value: "Conferência dos complementos do parto" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar correção" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/partos/p/correcao", expect.objectContaining({
    propriedadeId: 7, pesoMatriz: { acao: "VINCULAR", pesagemId: "peso7" },
    ocorrenciaRetencao: { acao: "VINCULAR", ocorrenciaId: "rp7" },
  }), "POST", 7));
});

async function abrirCorrecaoAborto(alteracoes: Partial<FatoReprodutivo> = {}) {
  vi.mocked(obterReproducao).mockResolvedValue({ animais: [], tentativas: [], avaliacoes: [], restricoes: [],
    partos: [{ id: "p", animalId: "a", data: "2026-10-13", tipo: "ABORTO", status: "VALIDO", versao: 4, observacao: null, ...alteracoes }] });
  vi.mocked(reqV4).mockReset().mockResolvedValue({});
  render(<CorrigirFato tipo="parto" id="p" animalId="a" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar correção" })).toHaveProperty("disabled", false));
  await alterarControle(screen.getByLabelText("Motivo da correção"), { target: { value: "Conferência do registro histórico" } });
}

it("corrige outro campo do aborto legado sem inventar observação nem reenviar campos intactos", async () => {
  await abrirCorrecaoAborto();
  await alterarControle(screen.getByLabelText("Desfecho"), { target: { value: "ABORTO" } });
  await alterarControle(screen.getByLabelText("Responsável pelo parto (opcional)"), { target: { value: "Maria" } });
  expect(screen.getByLabelText("Observação")).toHaveProperty("required", false);
  fireEvent.click(screen.getByRole("button", { name: "Salvar correção" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalled());
  expect(vi.mocked(reqV4).mock.calls[0][1]).toMatchObject({ responsavel: "Maria", versaoEsperada: 4 });
  expect(vi.mocked(reqV4).mock.calls[0][1]).not.toHaveProperty("observacao");
  expect(vi.mocked(reqV4).mock.calls[0][1]).not.toHaveProperty("desfecho");
});

it.each([
  { tipo: "NORMAL", anterior: null, observacao: "" },
  { tipo: "NORMAL", anterior: null, observacao: "abc" },
  { tipo: "ABORTO", anterior: null, observacao: "abc" },
  { tipo: "ABORTO", anterior: "Explicação comprovada", observacao: "" },
])("exige explicação ao converter $tipo ou alterar a observação para '$observacao'", async ({ tipo, anterior, observacao }) => {
  await abrirCorrecaoAborto({ tipo, observacao: anterior });
  await alterarControle(screen.getByLabelText("Desfecho"), { target: { value: "ABORTO" } });
  await alterarControle(screen.getByLabelText("Observação"), { target: { value: observacao } });
  fireEvent.submit(document.getElementById("corrigir-fato-v4")!);
  await screen.findByText("Informe a explicação do aborto com pelo menos 5 caracteres.");
  expect(reqV4).not.toHaveBeenCalled();
});

async function esperarOpcao(nome: string | RegExp) {
    await waitFor(() => expect(Array.from(document.querySelectorAll("option")).some(o => typeof nome === "string" ? o.textContent === nome : nome.test(o.textContent ?? ""))).toBe(true));
}

it("reabertura exige ciência explícita de revogação e conserva o peso no histórico", async () => {
  vi.mocked(obterReproducao).mockResolvedValue({ animais: [], tentativas: [], avaliacoes: [], restricoes: [], partos: [], lactacoes: [lactacaoSecagem] });
  vi.mocked(reqV4).mockReset().mockResolvedValue({});
  render(<CorrigirFato tipo="lactacao" id="l1" animalId="a1" propriedadeId={7} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await waitFor(() => expect(screen.getByLabelText("Encerramento (opcional)")).toHaveProperty("value", "2026-10-29"));
  fireEvent.change(screen.getByLabelText("Encerramento (opcional)"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Motivo da correção"), { target: { value: "Encerramento lançado indevidamente" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar correção" }));
  expect(await screen.findByText("Confirme a revogação do vínculo de peso ao reabrir a lactação.")).toBeTruthy();
  expect(reqV4).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("switch", { name: /revogação do vínculo/ }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar correção" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/lactacoes/l1/correcao", expect.objectContaining({ encerradaEm: null, motivo: "Encerramento lançado indevidamente", versaoEsperada: 3 }), "POST", 7));
});
it("trocar data do encerramento exige revisão do peso na mesma correção", async () => {
  vi.mocked(obterReproducao).mockResolvedValue({ animais: [], tentativas: [], avaliacoes: [], restricoes: [], partos: [], lactacoes: [lactacaoSecagem] });
  vi.mocked(reqV4).mockReset().mockResolvedValue({});
  render(<CorrigirFato tipo="lactacao" id="l1" animalId="a1" propriedadeId={7} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await waitFor(() => expect(screen.getByLabelText("Encerramento (opcional)")).toHaveProperty("value", "2026-10-29"));
  fireEvent.change(screen.getByLabelText("Encerramento (opcional)"), { target: { value: "2026-10-28" } });
  fireEvent.change(screen.getByLabelText("Motivo da correção"), { target: { value: "Conferência da data real da secagem" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar correção" }));
  expect(await screen.findByText("Revise explicitamente o vínculo de peso ao alterar a data do encerramento.")).toBeTruthy();
  expect(reqV4).not.toHaveBeenCalled();
  await alterarControle(screen.getByLabelText("Revisão do peso do encerramento"), { target: { value: "DESVINCULAR" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar correção" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/lactacoes/l1/correcao", expect.objectContaining({ encerradaEm: "2026-10-28", pesoSecagem: { acao: "DESVINCULAR", vinculoId: "v1", motivo: "Conferência da data real da secagem" } }), "POST", 7));
});
