// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { listarAnimais, listarGenitores, listarLotes, listarMaterialGenetico } from "../api";
import { listarServicos } from "../sanidade/api";
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
vi.mock("../nutricao/api",()=>({listarPartidasNutricionais:vi.fn().mockResolvedValue([])}));
vi.mock("../sanidade/api", () => ({
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
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getPropriedadeAtiva).mockReturnValue(1); vi.mocked(reqV4).mockResolvedValue([{ id:"tipo", nome:"Exame reprodutivo", padraoReprodutivo:true, tipoResultado:"MULTIPLO", campos:[], ativo:true }]); });
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
    await screen.findByRole("option", { name: "Exame reprodutivo · v1" });
    fireEvent.change(screen.getByLabelText("Atendimento"), { target: { value: "REALIZADO" } });
    fireEvent.change(screen.getByLabelText("Conclusão sobre a gestação"), { target: { value: "NEGATIVO" } });
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await screen.findByText(/Registre a perda gestacional/);
    expect(registrarAvaliacao).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Finalidade do exame"), { target: { value: "RECONFIRMACAO" } });
    fireEvent.change(screen.getByLabelText("Conclusão sobre a gestação"), { target: { value: "POSITIVO" } });
    fireEvent.change(screen.getByLabelText("Sexo fetal (se observado)"), { target: { value: "F" } });
    fireEvent.change(screen.getByLabelText("Motivo / observação"), {
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
    fireEvent.change(screen.getByLabelText("Finalidade"), { target: { value: "REPRODUCAO" } });
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
    fireEvent.change(screen.getByLabelText("Desfecho"), {
      target: { value: "ABORTO" },
    });
    fireEvent.change(screen.getByLabelText(/^Explicação do aborto/), {
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
  fireEvent.change(screen.getByLabelText("Desfecho"), { target: { value: "ABORTO" } });
  const explicacao = screen.getByLabelText(/^Explicação do aborto/);
  expect(explicacao).toHaveProperty("required", true);
  expect(explicacao).toHaveProperty("minLength", 5);
  fireEvent.change(explicacao, { target: { value: observacao } });
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await screen.findByText("Informe a explicação do aborto com pelo menos 5 caracteres.");
  expect(registrarParto).not.toHaveBeenCalled();
});

it("perda no mesmo dia permite negativo, preservando fronteira inclusiva para reconfirmação histórica", async () => {
  const p = {...painel, gestacoes: [{id:"g",animalId:"a",status:"VALIDO",confirmadaEm:"2026-10-01",encerradaEm:"2026-10-13"}], animais: painel.animais.map(a=>({...a,gestacao:null}))};
  vi.mocked(registrarAvaliacao).mockResolvedValue({id:"av",animalId:"a",data:"2026-10-13"});
  render(<FormReproducao acao="avaliacao" painel={p} animalInicial="a" dataInicial="2026-10-13" onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await screen.findByRole("option", { name: "Exame reprodutivo · v1" });
  fireEvent.change(screen.getByLabelText("Atendimento"), { target: { value: "REALIZADO" } });
  fireEvent.change(screen.getByLabelText("Conclusão sobre a gestação"),{target:{value:"NEGATIVO"}});
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
  await screen.findByRole("option", { name: "Ultrassom · v3" });
  expect((screen.getByLabelText("Tipo de exame") as HTMLSelectElement).value).toBe("custom");
  fireEvent.change(screen.getByLabelText("Atendimento"), { target: { value: "REALIZADO" } });
  expect((screen.getByLabelText("Finalidade do exame") as HTMLSelectElement).value).toBe("RECONFIRMACAO");
  fireEvent.change(screen.getByLabelText("Conclusão sobre a gestação"), { target: { value: "POSITIVO" } });
  fireEvent.change(screen.getByLabelText(/Medida · mm/), { target: { value: "0" } });
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await waitFor(() => expect(registrar).toHaveBeenCalled());
  expect(registrar.mock.calls[0][0]).toMatchObject({ tipoExameId: "custom", finalidade: "RECONFIRMACAO", formatoExameHash: "d".repeat(64), resultado: "RECONFIRMACAO", resultados: [{ campo: "MEDIDA", valor: "0" }] });
});

it("preserva desconhecidos e envia complementos reais com chave estável no reenvio", async () => {
  vi.mocked(registrarParto).mockRejectedValueOnce(new Error("Conferir registro"));
  render(<FormReproducao acao="parto" painel={painel} animalInicial="a" dataInicial="2026-10-13" onFechar={vi.fn()} onSalvo={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText("Hora (opcional)"),{target:{value:"05:40"}});
  fireEvent.click(screen.getByLabelText("Horário estimado"));
  fireEvent.change(screen.getByLabelText(/Responsável pelo parto/),{target:{value:"Maria"}});
  fireEvent.change(screen.getByLabelText("Peso ao nascer (kg)"),{target:{value:"39"}});
  fireEvent.click(screen.getByRole("button",{name:"Pós-parto"}));
  fireEvent.change(screen.getByLabelText("Retenção de placenta"),{target:{value:"NAO"}});
  fireEvent.change(screen.getByLabelText("Peso da matriz"),{target:{value:"REGISTRAR"}});
  fireEvent.change(screen.getByLabelText("Data real da pesagem"),{target:{value:"2026-10-15"}});
  fireEvent.change(screen.getByLabelText("Peso da matriz (kg)"),{target:{value:"520"}});
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
  await screen.findByRole("option", { name: "Exame reprodutivo · v1" });
  fireEvent.change(screen.getByLabelText("Atendimento"), { target: { value: "NAO_REALIZADO" } });
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
  fireEvent.change(screen.getByLabelText("Retenção de placenta"), { target: { value: "SIM" } });
  fireEvent.change(screen.getByLabelText("Ocorrência sanitária de retenção"), { target: { value: "CRIAR" } });
  await screen.findByRole("option", { name: "Retenção de placenta" });
  fireEvent.change(screen.getByLabelText("Peso da matriz"), { target: { value: "VINCULAR" } });
  await screen.findByRole("option", { name: "2026-10-13 · 450 kg" });
  expect(reqV4).toHaveBeenCalledWith("/sanidade/doencas", undefined, "GET", 7);
  expect(reqV4).toHaveBeenCalledWith("/animais/a", undefined, "GET", 7);
});

it("atribui Serviço sem perder centavos e mantém contratação independente da origem do material", async () => {
  localStorage.setItem("rionovo:usuario", JSON.stringify({ dono: true, areas: [], flags: [] }));
  vi.mocked(listarServicos).mockResolvedValue([{ id: "s", numero: 10, descricao: "Veterinário" }] as never);
  const registrar = vi.fn().mockResolvedValue(undefined);
  const props = { acao: "tentativa" as const, painel, animalInicial: "a", onFechar: vi.fn(), onSalvo: vi.fn(), onRegistrar: registrar };
  const {unmount} = render(<FormReproducao {...props} />);
  fireEvent.change(screen.getByLabelText("Origem do material"), {target:{value:"SERVICO"}});
  await screen.findByRole("option", {name:"#10 Veterinário"});
  fireEvent.change(screen.getByLabelText("Serviço financeiro"), {target:{value:"s"}});
  fireEvent.change(screen.getByLabelText("Valor atribuído ao Serviço (R$)"), {target:{value:"123.45"}});
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await waitFor(()=>expect(registrar).toHaveBeenCalledTimes(1));
  expect(registrar.mock.calls[0][0]).toMatchObject({operacaoServicoId:"s",valorServicoAtribuido:"123.45"});
  fireEvent.change(screen.getByLabelText("Origem do material"), {target:{value:"DOCUMENTADA"}});
  fireEvent.change(screen.getByLabelText("Motivo / observação"), {target:{value:"Origem documentada para teste"}});
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await waitFor(()=>expect(registrar).toHaveBeenCalledTimes(2));
  expect(registrar.mock.calls[1][0]).toMatchObject({origem:"DOCUMENTADA",operacaoServicoId:"s",valorServicoAtribuido:"123.45"});
  unmount();
  localStorage.setItem("rionovo:usuario", JSON.stringify({dono:false,areas:["pecuaria"],flags:["lancar"]}));
  render(<FormReproducao {...props}/>);
  fireEvent.change(screen.getByLabelText("Origem do material"), {target:{value:"SERVICO"}});
  expect(screen.queryByLabelText("Valor atribuído ao Serviço (R$)")).toBeNull();
  localStorage.removeItem("rionovo:usuario");
});


it("registra material do estoque e Serviço no mesmo envio sem mudar a origem",async()=>{
 localStorage.setItem("rionovo:usuario",JSON.stringify({dono:true,areas:[],flags:[]}));
 vi.mocked(listarMaterialGenetico).mockResolvedValue([{id:"material-1",tipo:"SEMEN",produto:{id:"produto-1",nome:"Sêmen comprovado",unidade:"UN",rastrearPartidas:false},saldo:3}] as never);
 vi.mocked(listarServicos).mockResolvedValue([{id:"servico-1",numero:20,descricao:"Inseminador"}] as never);
 const registrar=vi.fn().mockResolvedValue(undefined);
 render(<FormReproducao acao="tentativa" painel={painel} animalInicial="a" dataInicial="2026-10-13" onFechar={vi.fn()} onSalvo={vi.fn()} onRegistrar={registrar}/>);
 fireEvent.change(screen.getByLabelText("Origem do material"),{target:{value:"ESTOQUE"}});
 await screen.findByRole("option",{name:/Sêmen comprovado/});
 fireEvent.change(screen.getByLabelText("Material genético"),{target:{value:"material-1"}});
 await screen.findByRole("option",{name:"#20 Inseminador"});
 fireEvent.change(screen.getByLabelText("Serviço financeiro"),{target:{value:"servico-1"}});
 fireEvent.change(screen.getByLabelText("Valor atribuído ao Serviço (R$)"),{target:{value:"20.00"}});
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
    expect((screen.getByLabelText("Data do fato") as HTMLInputElement).value).toBe(esperado);
  } finally { cleanup(); vi.useRealTimers(); }
});
