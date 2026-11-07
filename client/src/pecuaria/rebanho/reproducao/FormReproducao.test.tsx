import { previaImpactosTeste } from "../sanidade/impactos.fixture";
import { consultarBezerreiro } from "../bezerreiro/api";
import { alterarControle } from "@/lib/controles.fixture";
// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { listarAnimais, listarGenitores, listarLotes, listarMaterialGenetico } from "../api";
import { listarServicos, reqSanidade } from "../sanidade/api";
import { FormReproducao } from "./FormReproducao";
import {
  reqV4,
  registrarAvaliacao,
  registrarParto,
  type PainelReprodutivo,
} from "./api";
vi.mock("../api", () => ({
  listarAnimais: vi.fn().mockResolvedValue({ itens: [] }),
  listarGenitores: vi.fn().mockResolvedValue([]),
  listarLotes: vi.fn().mockResolvedValue([]),
  listarMaterialGenetico: vi.fn().mockResolvedValue([]),
}));
vi.mock("../bezerreiro/api",()=>({consultarBezerreiro:vi.fn()}));
vi.mock("../nutricao/api",()=>({listarPartidasNutricionais:vi.fn().mockResolvedValue([])}));
vi.mock("../sanidade/api", () => ({
  reqSanidade: vi.fn(),
  listarServicos: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../../propriedadeScope", () => ({ getPropriedadeAtiva: vi.fn(() => 1) }));
vi.mock("./api", () => ({
  registrarAvaliacao: vi.fn(),
  registrarParto: vi.fn(),
  registrarTentativa: vi.fn(),
  reqV4: vi.fn(),
}));
const painel: PainelReprodutivo = {
  animais: [
    {
      animalId: "a",
      brinco: "100",
      nome: "Matriz",
      situacao: "GESTANTE",
      partos: 1,
      tentativasCiclo: 1,
      gestacao: { id: "g", status: "VALIDO" },
      restricoes: [],
    },
  ],
  // O sítio atual pode consultar o resumo clínico após transferência, sem histórico externo.
  gestacoes: [],
  tentativas: [],
  avaliacoes: [],
  partos: [],
  restricoes: [],
};
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(listarLotes).mockResolvedValue([]); vi.mocked(consultarBezerreiro).mockResolvedValue({perfis:[]}); vi.mocked(getPropriedadeAtiva).mockReturnValue(1); vi.mocked(reqV4).mockResolvedValue([{ id:"tipo", nome:"Exame reprodutivo", padraoReprodutivo:true, tipoResultado:"MULTIPLO", campos:[], ativo:true }]); });
describe("registros reprodutivos", () => {
  it("bloqueia negativo com gestação e preserva os dados/chave no retry de avaliação", async () => {
    vi.mocked(registrarAvaliacao).mockRejectedValueOnce(
      new Error("Período em revisão"),
    );
    const salvo = vi.fn();
    render(
      <FormReproducao
        acao="avaliacao"
        painel={painel}
        animalInicial="a"
        onFechar={vi.fn()}
        onSalvo={salvo}
      />,
    );
    await esperarOpcao("Exame reprodutivo · v1");
    await alterarControle(screen.getByLabelText("Atendimento"), { target: { value: "REALIZADO" } });
    await alterarControle(screen.getByLabelText("Conclusão sobre a gestação"), { target: { value: "NEGATIVO" } });
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await screen.findByText(/Registre a perda gestacional/);
    expect(registrarAvaliacao).not.toHaveBeenCalled();
    await alterarControle(screen.getByLabelText("Finalidade do exame"), { target: { value: "RECONFIRMACAO" } });
    await alterarControle(screen.getByLabelText("Conclusão sobre a gestação"), { target: { value: "POSITIVO" } });
    await alterarControle(screen.getByLabelText("Sexo fetal (se observado)"), { target: { value: "F" } });
    await alterarControle(screen.getByLabelText("Motivo / observação"), {
      target: { value: "Reavaliação pelo veterinário" },
    });
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await screen.findByText("Período em revisão");
    expect(
      (screen.getByLabelText("Motivo / observação") as HTMLInputElement).value,
    ).toBe("Reavaliação pelo veterinário");
    expect(salvo).not.toHaveBeenCalled();
    const primeira = vi.mocked(registrarAvaliacao).mock.calls[0][0];
    expect(primeira.gestacaoId).toBe("g");
    expect(primeira.sexoFetal).toBe("F");
    expect(primeira.finalidade).toBe("RECONFIRMACAO");
    vi.mocked(registrarAvaliacao).mockResolvedValueOnce({
      id: "e",
      animalId: "a",
      data: "2026-10-13",
    });
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await waitFor(() => expect(salvo).toHaveBeenCalled());
    expect(vi.mocked(registrarAvaliacao).mock.calls[1][0].chave).toBe(
      primeira.chave,
    );
  });
  it("envia finalidade Reprodução na cria", async () => {
    vi.mocked(registrarParto).mockResolvedValue({ id: "p", animalId: "a", data: "2026-10-13" });
    render(<FormReproducao acao="parto" painel={painel} animalInicial="a" onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await alterarControle(screen.getByLabelText("Finalidade"), { target: { value: "REPRODUCAO" } });
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await waitFor(() => expect(registrarParto).toHaveBeenCalledTimes(1));
    expect(vi.mocked(registrarParto).mock.calls[0][0].crias).toEqual([{ viva: true, sexo: "F", aptidao: "REPRODUCAO" }]);
  });

  it("envia cria viva sem brinco para cadastro provisório e aborto sem cria", async () => {
    vi.mocked(registrarParto).mockResolvedValue({
      id: "p",
      animalId: "a",
      data: "2026-10-13",
    });
    const { unmount } = render(
      <FormReproducao
        acao="parto"
        painel={painel}
        animalInicial="a"
        onFechar={vi.fn()}
        onSalvo={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.queryByText("Consultando sugestão de Bezerreiro…")).toBeNull());
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await waitFor(() => expect(registrarParto).toHaveBeenCalledTimes(1));
    expect(vi.mocked(registrarParto).mock.calls[0][0].gestacaoId).toBe("g");
    expect(vi.mocked(registrarParto).mock.calls[0][0].crias).toEqual([
      { viva: true, sexo: "F", aptidao: "LEITE" },
    ]);
    unmount();
    render(
      <FormReproducao
        acao="parto"
        painel={painel}
        animalInicial="a"
        onFechar={vi.fn()}
        onSalvo={vi.fn()}
      />,
    );
    await alterarControle(screen.getByLabelText("Desfecho"), {
      target: { value: "ABORTO" },
    });
    await alterarControle(screen.getByLabelText(/^Explicação do aborto/), {
      target: { value: "Aborto observado no manejo" },
    });
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await waitFor(() => expect(registrarParto).toHaveBeenCalledTimes(2));
    expect(vi.mocked(registrarParto).mock.calls[1][0]).toMatchObject({
      desfecho: "ABORTO",
      crias: [],
    });
  });
});

it.each(["", "abc", "     "])("novo aborto exige explicação mesmo no submit programático: '%s'", async observacao => {
  render(<FormReproducao acao="parto" painel={painel} animalInicial="a" onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await alterarControle(screen.getByLabelText("Desfecho"), { target: { value: "ABORTO" } });
  const explicacao = screen.getByLabelText(/^Explicação do aborto/);
  expect(explicacao).toHaveProperty("required", true);
  expect(explicacao).toHaveProperty("minLength", 5);
  await alterarControle(explicacao, { target: { value: observacao } });
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await screen.findByText("Informe a explicação do aborto com pelo menos 5 caracteres.");
  expect(registrarParto).not.toHaveBeenCalled();
});

it("perda no mesmo dia permite negativo, preservando fronteira inclusiva para reconfirmação histórica", async () => {
  const p = {...painel, gestacoes: [{id:"g",animalId:"a",status:"VALIDO",confirmadaEm:"2026-10-01",encerradaEm:"2026-10-13"}], animais: painel.animais.map(a=>({...a,gestacao:null}))};
  vi.mocked(registrarAvaliacao).mockResolvedValue({id:"av",animalId:"a",data:"2026-10-13"});
  render(<FormReproducao acao="avaliacao" painel={p} animalInicial="a" dataInicial="2026-10-13" onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await esperarOpcao("Exame reprodutivo · v1");
  await alterarControle(screen.getByLabelText("Atendimento"), { target: { value: "REALIZADO" } });
  await alterarControle(screen.getByLabelText("Conclusão sobre a gestação"),{target:{value:"NEGATIVO"}});
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await waitFor(()=>expect(registrarAvaliacao).toHaveBeenCalled());
  expect(vi.mocked(registrarAvaliacao).mock.calls[0][0].gestacaoId).toBeUndefined();
});
it("execução usa o tipo e a finalidade planejados e mantém o formato ao confirmar", async () => {
  vi.mocked(reqV4).mockResolvedValue([
    { id: "padrao", nome: "Padrão", ativo: true, padraoReprodutivo: true, tipoResultado: "MULTIPLO", campos: [] },
    { id: "custom", nome: "Ultrassom", ativo: true, versaoFormato: 3, formatoExameHash: "d".repeat(64), tipoResultado: "MULTIPLO", campos: [{ codigo: "MEDIDA", rotulo: "Medida", tipo: "NUMERO", unidade: "mm", obrigatorio: true }] },
  ]);
  const registrar = vi.fn().mockResolvedValue(undefined);
  render(<FormReproducao acao="avaliacao" painel={painel} animalInicial="a" tipoExameInicial="custom" finalidadeInicial="RECONFIRMACAO" onFechar={vi.fn()} onSalvo={vi.fn()} onRegistrar={registrar} />);
  await esperarOpcao("Ultrassom · v3");
  expect(screen.getByLabelText("Tipo de exame").textContent).toContain("Ultrassom · v3");
  await alterarControle(screen.getByLabelText("Atendimento"), { target: { value: "REALIZADO" } });
  expect(screen.getByLabelText("Finalidade do exame").textContent).toContain("Reconfirmação");
  await alterarControle(screen.getByLabelText("Conclusão sobre a gestação"), { target: { value: "POSITIVO" } });
  await alterarControle(screen.getByLabelText(/Medida · mm/), { target: { value: "0" } });
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await waitFor(() => expect(registrar).toHaveBeenCalled());
  expect(registrar.mock.calls[0][0]).toMatchObject({ tipoExameId: "custom", finalidade: "RECONFIRMACAO", formatoExameHash: "d".repeat(64), resultado: "RECONFIRMACAO", resultados: [{ campo: "MEDIDA", valor: "0" }] });
});

it("preserva desconhecidos e envia complementos reais com chave estável no reenvio", async () => {
  vi.mocked(registrarParto).mockRejectedValueOnce(new Error("Conferir registro"));
  render(<FormReproducao acao="parto" painel={painel} animalInicial="a" dataInicial="2026-10-13" onFechar={vi.fn()} onSalvo={vi.fn()}/>);
  await alterarControle(screen.getByLabelText("Hora (opcional)"),{target:{value:"05:40"}});
  fireEvent.click(screen.getByLabelText("Horário estimado"));
  await alterarControle(screen.getByLabelText(/Responsável pelo parto/),{target:{value:"Maria"}});
  await alterarControle(screen.getByLabelText("Peso ao nascer (kg)"),{target:{value:"39"}});
  fireEvent.click(screen.getByRole("button",{name:"Pós-parto"}));
  await alterarControle(screen.getByLabelText("Retenção de placenta"),{target:{value:"NAO"}});
  await alterarControle(screen.getByLabelText("Peso da matriz"),{target:{value:"REGISTRAR"}});
  await alterarControle(screen.getByLabelText("Data real da pesagem"),{target:{value:"2026-10-15"}});
  await alterarControle(screen.getByLabelText("Peso da matriz (kg)"),{target:{value:"520"}});
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await screen.findByText("Conferir registro");
  const primeiro=vi.mocked(registrarParto).mock.calls[0][0];
  expect(primeiro).toMatchObject({desfecho:"NASCIMENTO",induzido:null,dificuldade:null,horarioEstimado:true,responsavel:"Maria",retencaoPlacenta:false,pesoMatriz:{acao:"REGISTRAR",data:"2026-10-15",pesoKg:520},crias:[{pesoKg:39}]});
  expect(primeiro.tipo).toBeUndefined();
  expect(primeiro.ocorridoEm).toBe("2026-10-13T08:40:00.000Z");
  vi.mocked(registrarParto).mockResolvedValueOnce({id:"p",animalId:"a",data:"2026-10-13"});
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await waitFor(()=>expect(registrarParto).toHaveBeenCalledTimes(2));
  expect(vi.mocked(registrarParto).mock.calls[1][0]).toEqual(primeiro);
});


it.each([null, 99])("prepara avaliação no sítio explícito mesmo com sítio ativo %s", async ativa => {
  vi.mocked(getPropriedadeAtiva).mockReturnValue(ativa);
  const registrar = vi.fn().mockResolvedValue(undefined);
  render(<FormReproducao acao="avaliacao" painel={painel} animalInicial="a" propriedadeId={7}
    onRegistrar={registrar} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await esperarOpcao("Exame reprodutivo · v1");
  await alterarControle(screen.getByLabelText("Atendimento"), { target: { value: "NAO_REALIZADO" } });
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await waitFor(() => expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ propriedadeId: 7, resultado: "NAO_AVALIADO" })));
  expect(reqV4).toHaveBeenCalledWith("/reproducao/tipos-exame?incluirInativos=true", undefined, "GET", 7);
  expect(listarAnimais).toHaveBeenCalledWith({ sexo: "M", pageSize: 200 }, 7);
  expect(listarGenitores).toHaveBeenCalledWith({ sexo: "M" }, 7);
  expect(listarLotes).toHaveBeenCalledWith(undefined, 7);
  expect(listarMaterialGenetico).toHaveBeenCalledWith({}, 7);
  expect(listarServicos).toHaveBeenCalledWith(7);
});


it("consulta complementos pós-parto no sítio explícito com outro sítio ativo", async () => {
  vi.mocked(getPropriedadeAtiva).mockReturnValue(99);
  vi.mocked(reqV4).mockImplementation(async path => path === "/sanidade/doencas" ? [{ id: "rp", nome: "Retenção de placenta" }]
    : path === "/animais/a" ? { historicoPesagens: [{ id: "peso7", data: "2026-10-13", pesoKg: "450" }] } : []);
  render(<FormReproducao acao="parto" painel={painel} animalInicial="a" propriedadeId={7} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Pós-parto" }));
  await alterarControle(screen.getByLabelText("Retenção de placenta"), { target: { value: "SIM" } });
  await alterarControle(screen.getByLabelText("Ocorrência sanitária de retenção"), { target: { value: "CRIAR" } });
  await esperarOpcao("Retenção de placenta");
  await alterarControle(screen.getByLabelText("Peso da matriz"), { target: { value: "VINCULAR" } });
  await esperarOpcao("2026-10-13 · 450 kg");
  expect(reqV4).toHaveBeenCalledWith("/sanidade/doencas", undefined, "GET", 7);
  expect(reqV4).toHaveBeenCalledWith("/animais/a", undefined, "GET", 7);
});

it("atribui Serviço sem perder centavos e mantém contratação independente da origem do material", async () => {
  localStorage.setItem("rionovo:usuario", JSON.stringify({ dono: true, areas: [], flags: [] }));
  vi.mocked(listarServicos).mockResolvedValue([{ id: "s", numero: 10, descricao: "Veterinário" }] as never);
  const registrar = vi.fn().mockResolvedValue(undefined);
  const props = { acao: "tentativa" as const, painel, animalInicial: "a", onFechar: vi.fn(), onSalvo: vi.fn(), onRegistrar: registrar };
  const {unmount} = render(<FormReproducao {...props} />);
  await alterarControle(screen.getByLabelText("Origem do material"), {target:{value:"SERVICO"}});
  await esperarOpcao("#10 Veterinário");
  await alterarControle(screen.getByLabelText("Serviço financeiro"), {target:{value:"s"}});
  await alterarControle(screen.getByLabelText("Valor atribuído ao Serviço (R$)"), {target:{value:"123.45"}});
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await waitFor(()=>expect(registrar).toHaveBeenCalledTimes(1));
  expect(registrar.mock.calls[0][0]).toMatchObject({operacaoServicoId:"s",valorServicoAtribuido:"123.45"});
  await alterarControle(screen.getByLabelText("Origem do material"), {target:{value:"DOCUMENTADA"}});
  await alterarControle(screen.getByLabelText("Motivo / observação"), {target:{value:"Origem documentada para teste"}});
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await waitFor(()=>expect(registrar).toHaveBeenCalledTimes(2));
  expect(registrar.mock.calls[1][0]).toMatchObject({origem:"DOCUMENTADA",operacaoServicoId:"s",valorServicoAtribuido:"123.45"});
  unmount();
  localStorage.setItem("rionovo:usuario", JSON.stringify({dono:false,areas:["pecuaria"],flags:["lancar"]}));
  render(<FormReproducao {...props}/>);
  await alterarControle(screen.getByLabelText("Origem do material"), {target:{value:"SERVICO"}});
  expect(screen.queryByLabelText("Valor atribuído ao Serviço (R$)")).toBeNull();
  localStorage.removeItem("rionovo:usuario");
});


it("registra material do estoque e Serviço no mesmo envio sem mudar a origem",async()=>{
 localStorage.setItem("rionovo:usuario",JSON.stringify({dono:true,areas:[],flags:[]}));
 vi.mocked(listarMaterialGenetico).mockResolvedValue([{id:"material-1",tipo:"SEMEN",produto:{id:"produto-1",nome:"Sêmen comprovado",unidade:"UN",rastrearPartidas:false},saldo:3}] as never);
 vi.mocked(listarServicos).mockResolvedValue([{id:"servico-1",numero:20,descricao:"Inseminador"}] as never);
 const registrar=vi.fn().mockResolvedValue(undefined);
 render(<FormReproducao acao="tentativa" painel={painel} animalInicial="a" dataInicial="2026-10-13" onFechar={vi.fn()} onSalvo={vi.fn()} onRegistrar={registrar}/>);
 await alterarControle(screen.getByLabelText("Origem do material"),{target:{value:"ESTOQUE"}});
 await esperarOpcao(/Sêmen comprovado/);
 await alterarControle(screen.getByLabelText("Material genético"),{target:{value:"material-1"}});
 await esperarOpcao("#20 Inseminador");
 await alterarControle(screen.getByLabelText("Serviço financeiro"),{target:{value:"servico-1"}});
 await alterarControle(screen.getByLabelText("Valor atribuído ao Serviço (R$)"),{target:{value:"20.00"}});
 fireEvent.submit(document.getElementById("form-reproducao")!);
 await waitFor(()=>expect(registrar).toHaveBeenCalledTimes(1));
 expect(registrar.mock.calls[0][0]).toMatchObject({origem:"ESTOQUE",materialId:"material-1",quantidade:1,operacaoServicoId:"servico-1",valorServicoAtribuido:"20.00"});
 localStorage.removeItem("rionovo:usuario");
});

it("inicia o fato no dia local mesmo depois da virada UTC", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // 22h de 17/out no fuso do usuário, já 18/out em UTC.
  vi.setSystemTime(new Date("2026-10-18T01:00:00Z"));
  const local = new Date();
  const esperado = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
  try {
    render(<FormReproducao acao="tentativa" painel={painel} animalInicial="a" onFechar={() => {}} onSalvo={() => {}} />);
    expect((screen.getByLabelText("Data do fato") as HTMLInputElement).value).toBe(esperado.split("-").reverse().join("/"));
  } finally { cleanup(); vi.useRealTimers(); }
});

async function esperarOpcao(nome: string | RegExp) {
  await waitFor(() => expect(Array.from(document.querySelectorAll("option")).some(o => typeof nome === "string" ? o.textContent === nome : nome.test(o.textContent ?? ""))).toBe(true));
}

describe("classe comprovada no histórico inicial", () => {
  function abrir() {
    render(<FormReproducao acao="situacao" painel={painel} animalInicial="a" dataInicial="2026-10-13" onFechar={vi.fn()} onSalvo={vi.fn()} />);
  }
  it("inicia não determinada apesar do contador de partos e não envia classe presumida", async () => {
    abrir();
    expect(screen.getByLabelText("Classe na data do registro").textContent).toContain("Não determinada");
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/situacoes-iniciais", expect.not.objectContaining({ classeReprodutiva: expect.anything() }), "POST", 1));
  });
  it("exige evidência para a classe e envia a declaração explícita sem liberar o animal", async () => {
    abrir();
    await alterarControle(screen.getByLabelText("Classe na data do registro"), { target: { value: "NOVILHA" } });
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await screen.findByText("Descreva a evidência da classe reprodutiva com pelo menos 5 caracteres.");
    expect(reqV4).not.toHaveBeenCalled();
    await alterarControle(screen.getByLabelText("Evidência ou referência"), { target: { value: "Nuliparidade conferida na origem" } });
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/situacoes-iniciais", expect.objectContaining({ classeReprodutiva: "NOVILHA", observacao: "Nuliparidade conferida na origem", situacao: "VAZIA" }), "POST", 1));
  });
  it("preserva evidência e classe no erro e reutiliza chave somente para o mesmo conteúdo", async () => {
    abrir();
    await alterarControle(screen.getByLabelText("Classe na data do registro"), { target: { value: "VACA" } });
    await alterarControle(screen.getByLabelText("Evidência ou referência"), { target: { value: "Parto confirmado no cadastro original" } });
    vi.mocked(reqV4).mockRejectedValueOnce(new Error("Conflito de histórico"));
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await screen.findByText("Conflito de histórico");
    const primeira = vi.mocked(reqV4).mock.calls[0][1];
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await waitFor(() => expect(reqV4).toHaveBeenCalledTimes(2));
    expect(vi.mocked(reqV4).mock.calls[1][1]).toEqual(primeira);
  });
});

 it("aguarda catálogo de lotes antes de salvar a sugestão já recebida do Bezerreiro",async()=>{
  const lote={id:"bez",nome:"Bezerreiro",propriedadeId:7,propriedade:{id:7,nome:"Sede"},ativo:true,observacao:null,animaisAtivos:0};
  let liberar!:(lotes:typeof lote[])=>void;
  vi.mocked(listarLotes).mockReturnValue(new Promise(r=>{liberar=r;}));
  vi.mocked(consultarBezerreiro).mockResolvedValue({perfis:[{id:"perfil",ativo:true,loteId:"bez",lote}]});
  vi.mocked(registrarParto).mockResolvedValue({id:"p",animalId:"a",data:"2026-10-13"});
  render(<FormReproducao acao="parto" painel={painel} animalInicial="a" propriedadeId={7} onFechar={vi.fn()} onSalvo={vi.fn()}/>);
  await waitFor(()=>expect(consultarBezerreiro).toHaveBeenCalledWith("/configuracoes",7));
  fireEvent.submit(document.getElementById("form-reproducao")!);expect(registrarParto).not.toHaveBeenCalled();
  await act(async()=>liberar([lote]));
  await waitFor(()=>expect(screen.getByLabelText("Lote da cria").textContent).toContain("Bezerreiro"));
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await waitFor(()=>expect(registrarParto).toHaveBeenCalledTimes(1));
  expect(vi.mocked(registrarParto).mock.calls[0][0].crias).toEqual([expect.objectContaining({loteId:"bez"})]);
 });

it.each([null,"INDICAR","NAO_INDICAR"] as const)("DG individual preserva decisão %s sem iniciar outro protocolo",async decisao=>{
 const p={...painel,animais:painel.animais.map(a=>({...a,situacao:"VAZIA",gestacao:null}))};
 vi.mocked(registrarAvaliacao).mockResolvedValue({id:"dg",animalId:"a",data:"2026-10-13"});
 render(<FormReproducao acao="avaliacao" painel={p} animalInicial="a" dataInicial="2026-10-13" onFechar={vi.fn()} onSalvo={vi.fn()}/>);
 await esperarOpcao("Exame reprodutivo · v1");
 await alterarControle(screen.getByLabelText("Atendimento"),{target:{value:"REALIZADO"}});
 await alterarControle(screen.getByLabelText("Conclusão sobre a gestação"),{target:{value:"NEGATIVO"}});
 if(decisao)await alterarControle(screen.getByLabelText("Indicação para nova IATF"),{target:{value:decisao}});
 fireEvent.submit(document.getElementById("form-reproducao")!);
 await waitFor(()=>expect(registrarAvaliacao).toHaveBeenCalledTimes(1));
 expect(vi.mocked(registrarAvaliacao).mock.calls[0][0].decisaoIatf).toBe(decisao??undefined);
 expect(vi.mocked(registrarAvaliacao).mock.calls[0][0].conduta).toBe(decisao==="INDICAR"?"IATF":undefined);
 expect(vi.mocked(reqV4).mock.calls.some(([path,body])=>path.includes("programacoes")&&!!body)).toBe(false);
});

it("tentativa individual mantém quantidade histórica visível na seção excepcional",async()=>{
 render(<FormReproducao acao="tentativa" painel={painel} animalInicial="a" tentativaInicial={{tipo:"IA",materialId:"material",quantidade:2}} onFechar={vi.fn()} onSalvo={vi.fn()}/>);
 await screen.findByText(/1 dose por inseminação/);
 expect(screen.getByLabelText("Quantidade efetivamente utilizada")).toHaveProperty("value","2");
 expect(screen.getByRole("button", {name:"Quantidade excepcional ou registro histórico"}).getAttribute("aria-expanded")).toBe("true");
});

it("DG individual oferece preparação somente depois de salvar e mantém recibo ao falhar navegação", async () => {
 const p={...painel,animais:painel.animais.map(a=>({...a,situacao:"VAZIA",gestacao:null}))};
 const preparar=vi.fn().mockImplementationOnce(()=>{throw new Error("Falha ao abrir");});
 vi.mocked(registrarAvaliacao).mockResolvedValue({id:"dg",animalId:"a",data:"2026-10-13"});
 render(<FormReproducao acao="avaliacao" painel={p} animalInicial="a" dataInicial="2026-10-13" onFechar={vi.fn()} onSalvo={vi.fn()} onPrepararIatf={preparar}/>);
 await esperarOpcao("Exame reprodutivo · v1");
 await alterarControle(screen.getByLabelText("Atendimento"),{target:{value:"REALIZADO"}});
 await alterarControle(screen.getByLabelText("Conclusão sobre a gestação"),{target:{value:"NEGATIVO"}});
 await alterarControle(screen.getByLabelText("Indicação para nova IATF"),{target:{value:"INDICAR"}});
 expect(screen.queryByRole("button",{name:"Preparar próxima IATF"})).toBeNull();
 fireEvent.submit(document.getElementById("form-reproducao")!);
 fireEvent.click(await screen.findByRole("button",{name:"Preparar próxima IATF"}));
 expect(preparar).toHaveBeenCalledWith(["a"]);
 expect(screen.getByText(/Diagnóstico já salvo/)).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Preparar próxima IATF"}));
 expect(registrarAvaliacao).toHaveBeenCalledTimes(1);
});

it("avaliação contextual parcial confere efeitos antes de gravar e preserva chave, revisão e cuidado não selecionado", async () => {
  const salvo = vi.fn();
  const previa = {
    exame: {
      tipoExameId: "tipo",
      data: "2026-10-13",
      resultado: "NAO_AVALIADO",
      gestacaoCriada: false,
    },
    itens: [
      {
        codigo: "UTERO",
        rotulo: "Útero",
        tipo: "UTERO",
        campo: "OBS_UTERO",
        contextos: ["NOVILHA"],
        estado: "CONCLUSIVO",
      },
    ],
    condutas: [],
    necessidades: [
      {
        id: "d",
        finalidade: "DIAGNOSTICO",
        previstaPara: null,
        conclusaoCompativel: null,
        acao: "PRESERVAR",
      },
    ],
    necessidadesGeradas: [],
    revisao: "f".repeat(64),
  };
  vi.mocked(reqV4).mockImplementation(async (path) => {
    if (path.startsWith("/reproducao/tipos-exame"))
      return [
        {
          id: "tipo",
          nome: "Exame reprodutivo",
          padraoReprodutivo: true,
          tipoResultado: "MULTIPLO",
          formatoExameHash: "a".repeat(64),
          campos: [
            { codigo: "OBS_UTERO", rotulo: "Achado uterino", tipo: "TEXTO" },
          ],
          ativo: true,
        },
      ];
    if (path.startsWith("/reproducao/avaliacoes/contexto/catalogo"))
      return {
        catalogo: {
          id: "catalogo",
          versao: 1,
          tipoExameId: "tipo",
          itens: [
            {
              codigo: "UTERO",
              rotulo: "Útero",
              tipo: "UTERO",
              campo: "OBS_UTERO",
              contextos: ["NOVILHA"],
            },
          ],
          condutas: [],
        },
        sugeridos: ["UTERO"],
      };
    if (path.startsWith("/reproducao/acompanhamento?"))
      return {
        itens: [
          {
            id: "d",
            finalidade: "DIAGNOSTICO",
            tentativaId: null,
            gestacaoId: "g",
            previstaPara: null,
          },
        ],
        total: 1,
        pagina: 1,
        porPagina: 10,
      };
    if (path === "/reproducao/avaliacoes/contexto/previa") return previa;
    return [];
  });
  vi.mocked(registrarAvaliacao).mockResolvedValue({
    id: "avaliacao-contextual",
    animalId: "a",
    data: "2026-10-13",
  });
  render(
    <FormReproducao
      acao="avaliacao"
      painel={painel}
      animalInicial="a"
      dataInicial="2026-10-13"
      demandaInicial={{ id: "d", tentativaId: null, gestacaoId: "g" }}
      onFechar={vi.fn()}
      onSalvo={salvo}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /Usar catálogo do sítio/ }),
  );
  await alterarControle(
    screen.getByRole("combobox", { name: "Estado de Útero" }),
    { target: { value: "CONCLUSIVO" } },
  );
  fireEvent.change(screen.getByLabelText(/Achado uterino/), {
    target: { value: "Observação estruturada" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Conferir efeitos" }));
  await screen.findByRole("button", { name: "Confirmar avaliação conferida" });
  expect(registrarAvaliacao).not.toHaveBeenCalled();
  expect(screen.getByText(/Permanece pendente/)).toBeTruthy();
  const entrada = vi
    .mocked(reqV4)
    .mock.calls.find(
      ([path]) => path === "/reproducao/avaliacoes/contexto/previa",
    )?.[1];
  expect(entrada).toEqual(
    expect.objectContaining({
      resultado: "NAO_AVALIADO",
      realizadoSemDG: true,
      resultados: [{ campo: "OBS_UTERO", valor: "Observação estruturada" }],
      avaliacaoContextual: {
        catalogoId: "catalogo",
        itens: [{ codigo: "UTERO", estado: "CONCLUSIVO" }],
        condutas: [],
      },
    }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar avaliação conferida" }),
  );
  await waitFor(() => expect(registrarAvaliacao).toHaveBeenCalledTimes(1));
  expect(vi.mocked(registrarAvaliacao).mock.calls[0][0]).toEqual({
    ...entrada,
    revisaoContextual: previa.revisao,
  });
  expect(salvo).toHaveBeenCalledTimes(1);
});

it("parto com ocorrência nova de RP confere os impactos e envia a confirmação na mesma ação CRIAR", async () => {
  vi.mocked(reqV4).mockImplementation(async path => path === "/sanidade/doencas" ? [{ id: "rp", nome: "Retenção de placenta" }] : []);
  vi.mocked(reqSanidade).mockImplementation(async (_path, init) => previaImpactosTeste(JSON.parse(String(init?.body))));
  vi.mocked(registrarParto).mockResolvedValue({ id: "p", animalId: "a", data: "2026-10-13" });
  render(<FormReproducao acao="parto" painel={painel} animalInicial="a" propriedadeId={7} dataInicial="2026-10-13" onFechar={vi.fn()} onSalvo={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Pós-parto" }));
  await alterarControle(screen.getByLabelText("Retenção de placenta"), { target: { value: "SIM" } });
  await alterarControle(screen.getByLabelText("Ocorrência sanitária de retenção"), { target: { value: "CRIAR" } }); await esperarOpcao("Retenção de placenta");
  await alterarControle(screen.getByLabelText("Doença da ocorrência"), { target: { value: "rp" } });
  await alterarControle(screen.getByLabelText("Início real da ocorrência"), { target: { value: "2026-10-14" } });
  fireEvent.submit(document.getElementById("form-reproducao")!); await screen.findByText("Preparo autorizado · v2"); expect(registrarParto).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Motivo da confirmação"), { target: { value: "Impacto da RP conferido" } }); fireEvent.click(screen.getByLabelText(/Conferi as participações/)); fireEvent.click(screen.getByRole("button", { name: "Confirmar dados e impactos" }));
  await waitFor(() => expect(registrarParto).toHaveBeenCalledWith(expect.objectContaining({ propriedadeId: 7, ocorrenciaRetencao: { acao: "CRIAR", doencaId: "rp", inicio: "2026-10-14", impacto: { revisao: "a".repeat(64), motivo: "Impacto da RP conferido" } } })));
  expect(reqSanidade).toHaveBeenCalledWith("/impactos-protocolares/previa", expect.objectContaining({ body: JSON.stringify({ origem: "OCORRENCIA", animalId: "a", propriedadeId: 7, data: "2026-10-14", doencaId: "rp" }) }), 7);
});
