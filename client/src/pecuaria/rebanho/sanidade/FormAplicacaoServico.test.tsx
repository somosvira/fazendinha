// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormAplicacaoServico } from "./FormAplicacaoServico";
import { listarComprasDiretas, listarServicos, reqSanidade } from "./api";
import { listarProdutos } from "../../../estoque/api";
import { listarPartidasNutricionais } from "../nutricao/api";
import { buscarFichaAnimal } from "../api";
import { getPropriedadeAtiva, setPropriedadeAtiva } from "../../../propriedadeScope";

vi.mock("./api", () => ({
  listarServicos: vi.fn().mockResolvedValue([{ id: "servico", numero: 12, descricao: "Atendimento" }]),
  listarTiposAplicacao: vi.fn().mockResolvedValue([{ id: "tipo", nome: "Tratamento personalizado", ativo: true }, { id: "inativo", nome: "Inativo", ativo: false }]),
  listarComprasDiretas: vi.fn().mockResolvedValue([]), reqSanidade: vi.fn().mockResolvedValue([]), registrarAplicacao: vi.fn(),
}));
vi.mock("../../../estoque/api", () => ({ listarProdutos: vi.fn().mockResolvedValue([{ id: "produto", nome: "Medicamento teste", unidade: "ML", usoSanitario: true, rastrearPartidas: false, perfilSanitario: { carenciaLeiteHoras: 0, carenciaCarneHoras: 48 } }]) }));
vi.mock("../nutricao/api", () => ({ listarPartidasNutricionais: vi.fn().mockResolvedValue([]) }));
vi.mock("../api", () => ({ buscarFichaAnimal: vi.fn().mockResolvedValue({ sexo: "F", aptidao: "LEITE" }) }));
vi.mock("../../../components/DatePicker", () => ({ DatePicker: ({ value, onChange, ...p }: { value: string; onChange: (v: string) => void }) => <input {...p} type="date" value={value} onChange={(e) => onChange(e.target.value)} /> }));
afterEach(() => { cleanup(); setPropriedadeAtiva(null); });
beforeEach(() => { vi.clearAllMocks(); vi.mocked(reqSanidade).mockResolvedValue([]); });

function preencher() {
  fireEvent.change(screen.getByLabelText(/Tipo de aplicação/), { target: { value: "tipo" } });
  fireEvent.change(screen.getByLabelText(/Medicamento do estoque/), { target: { value: "produto" } });
  fireEvent.change(screen.getByLabelText(/^Quantidade aplicada$/), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: "2026-09-10" } });
  fireEvent.change(screen.getByLabelText(/Hora/), { target: { value: "10:00" } });
}
function submeter() { fireEvent.submit(document.getElementById("form-aplicacao-sanitaria")!); }
function cargaAplicacao() { return JSON.parse(vi.mocked(reqSanidade).mock.calls.find(([path]) => path === "/aplicacoes/coletivas")![1]!.body as string); }

describe("aplicação sanitária V3", () => {
  it("envia o sítio histórico A no envelope e no fato com o sítio atual B ativo", async () => {
    setPropriedadeAtiva(2);
    vi.mocked(buscarFichaAnimal).mockResolvedValueOnce({ sexo: "F", aptidao: "LEITE", historicoLocalizacoes: [
      { desde: "2026-09-20", ate: null, propriedade: { id: 2, nome: "Sítio B" } },
      { desde: "2026-09-01", ate: "2026-09-20", propriedade: { id: 1, nome: "Sítio A" } },
    ] } as Awaited<ReturnType<typeof buscarFichaAnimal>>);
    const medicamento = { id: "produto", nome: "Medicamento teste", unidade: "ML", usoSanitario: true, rastrearPartidas: true } as Awaited<ReturnType<typeof listarProdutos>>[number];
    vi.mocked(listarProdutos).mockResolvedValueOnce([medicamento]).mockResolvedValueOnce([medicamento]);
    vi.mocked(listarPartidasNutricionais).mockResolvedValueOnce([{ id: "lote-a", codigo: "Lote do sítio A", saldo: "20", validade: "2026-10-31" } as Awaited<ReturnType<typeof listarPartidasNutricionais>>[number]]);
    render(<FormAplicacaoServico animalId="animal" propriedadeId={2} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado");
    fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: "2026-09-10" } });
    await waitFor(() => expect(listarServicos).toHaveBeenLastCalledWith(1));
    await waitFor(() => expect(listarComprasDiretas).toHaveBeenLastCalledWith(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Registrar aplicação" })).toHaveProperty("disabled", false));
    preencher();
    await screen.findByText(/Lote do sítio A · saldo/);
    expect(listarPartidasNutricionais).toHaveBeenLastCalledWith("produto", 1);
    fireEvent.change(screen.getByLabelText(/Lote do Produto/), { target: { value: "lote-a" } }); submeter();
    await waitFor(() => expect(cargaAplicacao()).toMatchObject({ propriedadeId: 1, itens: [{ propriedadeId: 1, partidaId: "lote-a", data: "2026-09-10" }] }));
    expect(getPropriedadeAtiva()).toBe(2);
  });
  it("identifica animais de outro sítio e recusa o conjunto antes de enviar", async () => {
    render(<FormAplicacaoServico animalId="a" propriedadeId={1} animais={[{ id: "a", brinco: "RN01", propriedadeId: 1 }, { id: "b", brinco: "RN02", propriedadeId: 2 }, { id: "c", brinco: "RT01", propriedadeId: null }]} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado"); preencher(); submeter();
    expect(document.getElementById("san-data-erro")?.textContent).toContain("RN02, RT01");
    expect(document.activeElement).toBe(screen.getByLabelText(/^Data/));
    expect(screen.getByLabelText(/^Quantidade aplicada$/)).toHaveProperty("value", "10");
    expect(vi.mocked(reqSanidade).mock.calls.some(([path]) => path === "/aplicacoes/coletivas")).toBe(false);
  });
  it.each([false, true])("retry após timeout mantém chave e edição cria outra (coletiva: %s)", async (coletiva) => {
    const onSalvo = vi.fn();
    vi.mocked(reqSanidade).mockImplementation(async (path) => { if (path === "/aplicacoes/coletivas") throw new Error("Tempo de resposta excedido. Tente novamente."); return []; });
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} animais={coletiva ? [{ id: "a", brinco: "RN01", propriedadeId: 1 }] : undefined} onFechar={vi.fn()} onSalvo={onSalvo} />);
    await screen.findByText("Tratamento personalizado"); preencher(); submeter();
    if (coletiva) submeter();
    const envios = () => vi.mocked(reqSanidade).mock.calls.filter(([path]) => path === "/aplicacoes/coletivas").map(([, init]) => JSON.parse(init!.body as string));
    const botao = () => screen.getByRole("button", { name: coletiva ? "Confirmar todas as aplicações" : "Registrar aplicação" });
    await waitFor(() => expect(botao()).toHaveProperty("disabled", false));
    expect(envios()).toHaveLength(1);
    expect(screen.getAllByText(/Tempo de resposta excedido/).length).toBeGreaterThan(0);
    submeter();
    await waitFor(() => expect(envios()).toHaveLength(2));
    await waitFor(() => expect(botao()).toHaveProperty("disabled", false));
    expect(envios()[1]).toEqual(envios()[0]);
    fireEvent.change(screen.getByLabelText(coletiva ? /Quantidade aplicada em RN01/ : /^Quantidade aplicada$/), { target: { value: "7" } });
    submeter();
    await waitFor(() => expect(envios()).toHaveLength(3));
    await waitFor(() => expect(botao()).toHaveProperty("disabled", false));
    expect(envios()[2].chave).not.toBe(envios()[0].chave);
    expect(envios()[2].itens[0].dose).toBe("7");
    expect(screen.getByLabelText(/Medicamento do estoque/)).toHaveProperty("value", "produto");
    expect(onSalvo).not.toHaveBeenCalled();
  });
  it("aplica estoque sem Serviço com prazo zero informado e confirmação idempotente", async () => {
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado");
    expect(screen.queryByText("Inativo")).toBeNull();
    fireEvent.change(screen.getByLabelText(/Tipo de aplicação/), { target: { value: "tipo" } });
    fireEvent.change(screen.getByLabelText(/Medicamento do estoque/), { target: { value: "produto" } });
    fireEvent.change(screen.getByLabelText(/Quantidade aplicada/), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText(/Hora/), { target: { value: "10:00" } });
    expect((screen.getByLabelText(/Serviço de atendimento/) as HTMLSelectElement).required).toBe(false);
    fireEvent.submit(document.getElementById("form-aplicacao-sanitaria")!);
    await waitFor(() => expect(reqSanidade).toHaveBeenCalledWith("/aplicacoes/coletivas", expect.any(Object)));
    const call = vi.mocked(reqSanidade).mock.calls.find(([path]) => path === "/aplicacoes/coletivas")!;
    const payload = JSON.parse(call[1]!.body as string);
    expect(payload.chave).toMatch(/^[a-f0-9-]{36}$/);
    expect(payload.itens[0]).toMatchObject({ origemInsumo: "BAIXA_ESTOQUE", dose: "10", unidadeDose: "ML", estadoCarenciaLeite: "INFORMADO", carenciaLeiteHoras: 0 });
    expect(payload.itens[0].operacaoServicoId).toBeUndefined();
    expect(payload.itens[0].nomeProdutoAplicado).toBe("Medicamento teste");
    expect(screen.queryByLabelText(/Medicamento utilizado/)).toBeNull();
  });
  it("medicamento incluído em Serviço aceita nome livre e Produto opcional", async () => {
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado");
    fireEvent.change(screen.getByLabelText(/Origem do medicamento/), { target: { value: "INCLUSO_SERVICO" } });
    expect((screen.getByLabelText(/Produto cadastrado/) as HTMLSelectElement).required).toBe(false);
    expect((screen.getByLabelText(/Serviço que incluiu/) as HTMLSelectElement).required).toBe(true);
    expect((screen.getByLabelText(/Medicamento utilizado/) as HTMLInputElement).readOnly).toBe(false);
    expect(screen.queryByLabelText(/Partida do Produto/)).toBeNull();
  });
  it("valida os campos no formulário, indica o erro e foca o primeiro", async () => {
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado");
    expect(document.getElementById("form-aplicacao-sanitaria")).toHaveProperty("noValidate", true);
    submeter();
    expect(document.activeElement).toBe(screen.getByLabelText(/^Hora/));
    expect(screen.getByLabelText(/Tipo de aplicação/).getAttribute("aria-describedby")).toBe("san-tipo-erro");
    expect(screen.getByLabelText(/Medicamento do estoque/).getAttribute("aria-invalid")).toBe("true");
    expect(vi.mocked(reqSanidade).mock.calls.some(([path]) => path === "/aplicacoes/coletivas")).toBe(false);
  });
  it("salva medicamento livre incluído no Serviço e preserva dose", async () => {
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado"); preencher();
    fireEvent.change(screen.getByLabelText(/Origem do medicamento/), { target: { value: "INCLUSO_SERVICO" } });
    fireEvent.change(screen.getByLabelText(/Medicamento utilizado/), { target: { value: "  Medicação do veterinário  " } });
    fireEvent.change(screen.getByLabelText(/Serviço que incluiu/), { target: { value: "servico" } });
    submeter();
    await waitFor(() => expect(cargaAplicacao().itens[0]).toMatchObject({ nomeProdutoAplicado: "Medicação do veterinário", operacaoServicoId: "servico", dose: "10", estadoCarenciaLeite: "NAO_INFORMADO" }));
    expect(cargaAplicacao().itens[0].produtoId).toBeUndefined();
  });
  it("origem não localizada exige nome e motivo, sem reutilizar o Produto anterior", async () => {
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado"); preencher();
    fireEvent.change(screen.getByLabelText(/Origem do medicamento/), { target: { value: "SEM_ORIGEM_JUSTIFICADA" } });
    submeter();
    expect(screen.getByLabelText(/Medicamento utilizado/)).toHaveProperty("value", "");
    expect(document.getElementById("san-justificativa")?.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(screen.getByLabelText(/Medicamento utilizado/), { target: { value: "Dose recebida" } });
    fireEvent.change(screen.getByLabelText(/Justificativa da origem/), { target: { value: "Comprovante ainda não encontrado" } });
    submeter();
    await waitFor(() => expect(cargaAplicacao().itens[0]).toMatchObject({ nomeProdutoAplicado: "Dose recebida", justificativaSemOrigem: "Comprovante ainda não encontrado" }));
    expect(cargaAplicacao().itens[0].produtoId).toBeUndefined();
    expect(cargaAplicacao().itens[0].operacaoServicoId).toBeUndefined();
  });
  it("rejeita quantidade com subprecisão na linha coletiva e preserva revisão", async () => {
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} animais={[{ id: "a", brinco: "RN01", propriedadeId: 1 }]} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado"); preencher(); submeter();
    fireEvent.change(screen.getByLabelText(/Quantidade aplicada em RN01/), { target: { value: "0.0001" } }); submeter();
    expect(document.activeElement).toBe(screen.getByLabelText(/Quantidade aplicada em RN01/));
    expect(document.getElementById("san-dose-a-erro")?.textContent).toContain("três casas decimais");
    expect(vi.mocked(reqSanidade).mock.calls.some(([path]) => path === "/aplicacoes/coletivas")).toBe(false);
  });
  it("executa tarefa com o nome preenchido pelo Produto sem campo duplicado", async () => {
    vi.mocked(reqSanidade).mockImplementation(async (path) => path === "/tarefas/execucao/previa" ? { fingerprint: "a".repeat(64), itens: [{ tarefaId: "tarefa", animalId: "animal", referencia: "SNAPSHOT_PLANEJADO", diferencas: [], motivoObrigatorio: false, carencia: null }], consumos: [], temDesvios: false } : []);
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} tarefa={{ id: "tarefa", produtoId: "produto", tipoAplicacaoId: "tipo", dose: "5", unidade: "ML" }} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado");
    fireEvent.change(screen.getByLabelText(/Hora/), { target: { value: "10:00" } });
    submeter();
    await screen.findByText("Realização conforme o planejamento.");
    expect(screen.getByLabelText(/^Quantidade aplicada$/)).toHaveProperty("disabled", true);
    submeter();
    await waitFor(() => expect(reqSanidade).toHaveBeenCalledWith("/tarefas/execucao/confirmacao", expect.any(Object)));
    const envio = vi.mocked(reqSanidade).mock.calls.find(([path]) => path === "/tarefas/execucao/confirmacao")!;
    expect(JSON.parse(envio[1]!.body as string)).toMatchObject({ fingerprint: "a".repeat(64), itens: [{ tipo: "APLICACAO", tarefaId: "tarefa", nomeProdutoAplicado: "Medicamento teste" }] });
  });
  it("alterna origens limpando nome e perfil e libera nome livre apenas sem Produto", async () => {
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado"); preencher();
    fireEvent.change(screen.getByLabelText(/Origem do medicamento/), { target: { value: "INCLUSO_SERVICO" } });
    expect(screen.getByLabelText(/Medicamento utilizado/)).toHaveProperty("value", "");
    expect(screen.getByLabelText(/^Leite$/)).toHaveProperty("value", "NAO_INFORMADO");
    fireEvent.change(screen.getByLabelText(/Produto cadastrado/), { target: { value: "produto" } });
    expect(screen.queryByLabelText(/Medicamento utilizado/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Produto cadastrado/), { target: { value: "" } });
    expect(screen.getByLabelText(/Medicamento utilizado/)).toHaveProperty("value", "");
  });
  it("compra direta deriva o nome do item e apaga vínculo ao trocar origem", async () => {
    vi.mocked(listarComprasDiretas).mockResolvedValueOnce([{ id: "compra", produtoId: "produto", disponivel: "50", unidade: "ML", produto: { nome: "Medicamento comprado" }, operacao: { numero: 3, data: "2026-09-01" } }]);
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado"); preencher();
    fireEvent.change(screen.getByLabelText(/Origem do medicamento/), { target: { value: "COMPRA_CONSUMO_DIRETO" } });
    fireEvent.change(screen.getByLabelText(/Item confirmado/), { target: { value: "compra" } });
    expect(screen.queryByLabelText(/Medicamento utilizado/)).toBeNull(); submeter();
    await waitFor(() => expect(cargaAplicacao().itens[0]).toMatchObject({ nomeProdutoAplicado: "Medicamento comprado", itemCompraDiretaId: "compra" }));
    fireEvent.change(screen.getByLabelText(/Origem do medicamento/), { target: { value: "SEM_ORIGEM_JUSTIFICADA" } });
    expect(screen.getByLabelText(/Medicamento utilizado/)).toHaveProperty("value", "");
  });
  it("erro de saldo da API fica na quantidade, preserva os dados e permite corrigir", async () => {
    vi.mocked(reqSanidade).mockImplementation(async (path) => { if (path === "/aplicacoes/coletivas") throw Object.assign(new Error("Saldo de estoque insuficiente neste sítio"), { campo: "itens.0.dose", code: "VALIDACAO" }); return []; });
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado"); preencher(); submeter();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/^Quantidade aplicada$/)));
    expect(document.getElementById("san-dose-erro")?.textContent).toContain("Saldo de estoque insuficiente");
    expect(screen.getByLabelText(/^Quantidade aplicada$/)).toHaveProperty("value", "10");
    expect(screen.getByLabelText(/Medicamento do estoque/)).toHaveProperty("value", "produto");
  });
  it("erro coletivo abre carência e mantém quantidades revisadas enquanto dados comuns são corrigidos", async () => {
    vi.mocked(reqSanidade).mockImplementation(async (path) => { if (path === "/aplicacoes/coletivas") throw Object.assign(new Error("Informe o prazo em horas inteiras"), { campo: "itens.1.carenciaLeiteHoras" }); return []; });
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} animais={[{ id: "a", brinco: "RN01", propriedadeId: 1 }, { id: "b", brinco: "RN02", propriedadeId: 1 }]} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado"); preencher(); submeter();
    fireEvent.change(screen.getByLabelText(/Quantidade aplicada em RN02/), { target: { value: "7" } });
    const prazo = document.getElementById("san-prazo-0")!;
    prazo.closest("details")!.open = false; submeter();
    await waitFor(() => expect(document.activeElement).toBe(prazo));
    expect(prazo.closest("details")).toHaveProperty("open", true);
    expect(document.getElementById("san-prazo-0-erro")?.textContent).toContain("RN02");
    expect(prazo).not.toHaveProperty("disabled", true);
    fireEvent.click(screen.getByText("Voltar aos dados comuns")); submeter();
    expect(screen.getByLabelText(/Quantidade aplicada em RN02/)).toHaveProperty("value", "7");
  });
  it("erro do lote coletivo aponta ao seletor comum sem apagar a revisão", async () => {
    vi.mocked(listarProdutos).mockResolvedValueOnce([{ id: "produto", nome: "Medicamento teste", unidade: "ML", usoSanitario: true, rastrearPartidas: true } as Awaited<ReturnType<typeof listarProdutos>>[number]]);
    vi.mocked(listarPartidasNutricionais).mockResolvedValueOnce([{ id: "lote", codigo: "A", saldo: "20", validade: "2026-10-31" } as Awaited<ReturnType<typeof listarPartidasNutricionais>>[number]]);
    vi.mocked(reqSanidade).mockImplementation(async (path) => { if (path === "/aplicacoes/coletivas") throw Object.assign(new Error("Saldo do lote insuficiente neste sítio"), { campo: "itens.0.partidaId" }); return []; });
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} animais={[{ id: "a", brinco: "RN01", propriedadeId: 1 }]} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado"); preencher(); await screen.findByText(/A · saldo/);
    fireEvent.change(screen.getByLabelText(/Lote do Produto/), { target: { value: "lote" } }); submeter(); submeter();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/Lote do Produto/)));
    expect(screen.getByLabelText(/Quantidade aplicada em RN01/)).toHaveProperty("value", "10");
    expect(screen.getByLabelText(/Lote do Produto/)).toHaveProperty("value", "lote");
  });
});
it("devolve a aplicação criada para atualizar a ficha e abrir o fato salvo", async () => {
  vi.mocked(reqSanidade).mockImplementation(async (path) => path === "/aplicacoes/coletivas" ? { aplicacoes: ["aplicacao-criada"] } : []);
  const onSalvo = vi.fn();
  render(<FormAplicacaoServico animalId="animal" propriedadeId={1} onFechar={vi.fn()} onSalvo={onSalvo} />);
  await screen.findByText("Tratamento personalizado"); preencher(); submeter();
  await waitFor(() => expect(onSalvo).toHaveBeenCalledWith("aplicacao-criada", 1));
});
