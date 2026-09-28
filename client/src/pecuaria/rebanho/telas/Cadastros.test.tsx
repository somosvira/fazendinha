// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Cadastros } from "./Cadastros";
import {
  criarCategoria, criarMotivoBaixa, criarRaca, editarGenitor, editarMotivoBaixa, editarRaca, listarAuditoriaCadastro, listarCategorias,
  listarGenitores, listarMaterialGenetico, listarMotivosBaixa, listarRacas, obterCatalogos, reordenarCategorias, restaurarPadroesCategorias, simularCategorias,
} from "../api";
import type { CategoriaDTO, GenitorDTO, MaterialGeneticoDTO, MotivoBaixa, Raca } from "../types";

/* Mantém RebanhoApiError real (os forms usam instanceof) e substitui só as chamadas. */
vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  listarRacas: vi.fn(),
  criarRaca: vi.fn(),
  editarRaca: vi.fn(),
  listarMotivosBaixa: vi.fn(),
  criarMotivoBaixa: vi.fn(),
  editarMotivoBaixa: vi.fn(),
  listarCategorias: vi.fn(),
  criarCategoria: vi.fn(),
  editarCategoria: vi.fn(),
  reordenarCategorias: vi.fn(),
  simularCategorias: vi.fn(),
  restaurarPadroesCategorias: vi.fn(),
  listarAuditoriaCadastro: vi.fn(),
  listarGenitores: vi.fn(),
  editarGenitor: vi.fn(),
  listarMaterialGenetico: vi.fn(),
  obterCatalogos: vi.fn(),
}));

const racasMock: Raca[] = [
  { id: "r1", nome: "Holandesa", sigla: "HOL", base: true, ativo: true, animaisAtivos: 5 },
  { id: "r2", nome: "Gir", sigla: "GIR", base: false, ativo: false, animaisAtivos: 0 },
];

const motivosMock: MotivoBaixa[] = [
  { id: "m1", nome: "Morte por doença", classe: "MORTE", ativo: true, baixasValendo: 3 },
  { id: "m2", nome: "Baixa produção", classe: "DESCARTE_VOLUNTARIO", ativo: true, baixasValendo: 8 },
  { id: "m3", nome: "Problema locomotor", classe: "DESCARTE_INVOLUNTARIO", ativo: false, baixasValendo: 0 },
];

const categoriasMock: CategoriaDTO[] = [
  { id: "c-vaca", nome: "Vaca", sexo: "F", automatica: true, ativo: true, ordem: 10, idadeMinMeses: null, idadeMaxMeses: null, partos: "COM", ideagriId: 7, padrao: true, regra: "com parto", animaisAtivos: 5, manuaisAbertas: 0 },
  { id: "c-crescimento-f", nome: "Em crescimento", sexo: "F", automatica: true, ativo: true, ordem: 20, idadeMinMeses: null, idadeMaxMeses: 12, partos: "SEM", ideagriId: 5, padrao: true, regra: "menos de 12 meses · sem parto", animaisAtivos: 2, manuaisAbertas: 0 },
  { id: "c-reprodutor", nome: "Reprodutor", sexo: "M", automatica: false, ativo: false, ordem: 50, idadeMinMeses: null, idadeMaxMeses: null, partos: "QUALQUER", ideagriId: 2, padrao: true, regra: "só manual", animaisAtivos: 0, manuaisAbertas: 0 },
];

/* A tabela responsiva renderiza tabela E cartões; no jsdom os dois existem,
 * então pegamos sempre a primeira ocorrência (mesma convenção de
 * ConfiguracoesFinanceiras.test.tsx). */
const primeiro = (role: string, name: string | RegExp) => screen.getAllByRole(role, { name })[0];

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(listarRacas).mockResolvedValue(racasMock);
  vi.mocked(listarMotivosBaixa).mockResolvedValue([]);
  vi.mocked(listarCategorias).mockResolvedValue({ itens: categoriasMock, semCategoria: 0 });
  vi.mocked(simularCategorias).mockResolvedValue({ afetados: 0, mudancas: [], semCategoria: 0 });
  vi.mocked(editarRaca).mockImplementation((id, patch) => Promise.resolve({ ...racasMock.find((r) => r.id === id)!, ...patch }));
  vi.mocked(listarAuditoriaCadastro).mockResolvedValue({ itens: [], total: 0 });
  vi.mocked(listarGenitores).mockResolvedValue([]);
  vi.mocked(listarMaterialGenetico).mockResolvedValue([]);
  vi.mocked(obterCatalogos).mockResolvedValue({ racas: [], motivosBaixa: [], propriedades: [], lotes: [] });
});
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

async function montarCategorias() {
  render(<Cadastros />);
  await screen.findAllByText("Vaca");
}

async function montarRacas() {
  render(<Cadastros />);
  await screen.findAllByText("Vaca");
  fireEvent.click(screen.getByRole("button", { name: "Raças" }));
  await screen.findAllByText("Holandesa");
}

async function montarMotivos() {
  vi.mocked(listarMotivosBaixa).mockResolvedValue(motivosMock);
  render(<Cadastros />);
  await screen.findAllByText("Vaca");
  fireEvent.click(screen.getByRole("button", { name: "Motivos de baixa" }));
  await screen.findAllByText("Morte por doença");
}

describe("Cadastros do rebanho — permissão de leitura (K7)", () => {
  it("usuário só de leitura mantém os filtros de cada aba utilizáveis, com a tabela desabilitada", async () => {
    const { container } = render(<Cadastros podeLancar={false} />);
    await screen.findAllByText("Vaca");

    const filtroCategorias = screen.getByRole("checkbox", { name: "Mostrar inativas" }) as HTMLInputElement;
    expect(filtroCategorias.disabled).toBe(false);
    fireEvent.click(filtroCategorias);
    await waitFor(() => expect(within(screen.getByRole("table", { name: "Categorias" })).getByText("Reprodutor")).toBeTruthy());

    const fieldsetEscrita = container.querySelector("fieldset");
    expect(fieldsetEscrita).not.toBeNull();
    expect((fieldsetEscrita as HTMLFieldSetElement).disabled).toBe(true);

    expect(screen.queryByRole("button", { name: /Nova categoria/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Restaurar padrões" })).toBeNull();
  });
});

describe("Cadastros do rebanho — categorias", () => {
  it("lista categorias ativas na ordem, com regra e selo Padrão; inativas só aparecem com o filtro", async () => {
    await montarCategorias();
    const tabela = screen.getByRole("table", { name: "Categorias" });
    expect(within(tabela).getByText("Vaca")).toBeTruthy();
    expect(within(tabela).getByText("Em crescimento")).toBeTruthy();
    expect(within(tabela).getByText(/com parto/)).toBeTruthy();
    expect(within(tabela).getAllByText("Padrão").length).toBeGreaterThan(0);
    expect(within(tabela).queryByText("Reprodutor")).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar inativas" }));
    await waitFor(() => expect(within(screen.getByRole("table", { name: "Categorias" })).getByText("Reprodutor")).toBeTruthy());
  });

  it("mostra quantas categorias têm troca manual forçada", async () => {
    vi.mocked(listarCategorias).mockResolvedValue({
      itens: categoriasMock.map((c) => (c.id === "c-vaca" ? { ...c, manuaisAbertas: 4 } : c)),
      semCategoria: 0,
    });
    await montarCategorias();
    const linhaVaca = within(screen.getByRole("table", { name: "Categorias" })).getByText("Vaca").closest("tr")!;
    expect(within(linhaVaca).getByText("4")).toBeTruthy();
  });

  it("avisa quando há animais ativos sem categoria", async () => {
    vi.mocked(listarCategorias).mockResolvedValue({ itens: categoriasMock, semCategoria: 3 });
    await montarCategorias();
    expect(screen.getByText(/3 animais ativos sem categoria — nenhuma regra casou/)).toBeTruthy();
  });

  it("editar abre o formulário com as idades e o critério de partos atuais", async () => {
    await montarCategorias();
    fireEvent.click(primeiro("button", "Editar Em crescimento"));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Idade mínima (meses)") as HTMLInputElement).value).toBe("");
    expect((within(painel).getByLabelText("Idade máxima (meses)") as HTMLInputElement).value).toBe("12");
    expect((within(painel).getByLabelText("Partos") as HTMLSelectElement).value).toBe("SEM");
  });

  it("idade sem limite aparece como \"Sem mínimo\" / \"Sem máximo\"", async () => {
    await montarCategorias();
    fireEvent.click(primeiro("button", "Editar Vaca"));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByPlaceholderText("Sem mínimo")).toBeTruthy();
    expect(within(painel).getByPlaceholderText("Sem máximo")).toBeTruthy();
  });

  it("partos só aparece para fêmea; categoria de macho é criada com partos QUALQUER", async () => {
    vi.mocked(criarCategoria).mockResolvedValue({ id: "boi", nome: "Boi" });
    await montarCategorias();
    fireEvent.click(screen.getByRole("button", { name: /Nova categoria/ }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Partos"), { target: { value: "COM" } });
    fireEvent.change(within(painel).getByLabelText("Sexo"), { target: { value: "M" } });
    expect(within(painel).queryByLabelText("Partos")).toBeNull();
    fireEvent.change(within(painel).getByLabelText("Nome da categoria"), { target: { value: "Boi" } });
    fireEvent.change(within(painel).getByLabelText("Idade mínima (meses)"), { target: { value: "24" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar categoria" }));
    await waitFor(() => expect(criarCategoria).toHaveBeenCalledWith({ nome: "Boi", sexo: "M", automatica: true, idadeMinMeses: 24, idadeMaxMeses: null, partos: "QUALQUER" }));
  });

  it("criar categoria sem impacto aplica direto, sem diálogo de confirmação", async () => {
    vi.mocked(criarCategoria).mockResolvedValue({ id: "nova", nome: "Nova" });
    await montarCategorias();
    fireEvent.click(screen.getByRole("button", { name: /Nova categoria/ }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Nome da categoria"), { target: { value: "Nova" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar categoria" }));
    await waitFor(() => expect(criarCategoria).toHaveBeenCalledWith({ nome: "Nova", sexo: "F", automatica: true, idadeMinMeses: null, idadeMaxMeses: null, partos: "QUALQUER" }));
    expect(screen.queryByRole("dialog", { name: "Aplicar esta mudança?" })).toBeNull();
    await waitFor(() => expect(listarCategorias).toHaveBeenCalledTimes(2));
  });

  it("criar categoria com impacto mostra a lista de mudanças e só aplica ao confirmar", async () => {
    vi.mocked(simularCategorias).mockResolvedValue({
      afetados: 8,
      mudancas: [{ de: { id: "c-crescimento-f", nome: "Em crescimento" }, para: { id: "nova", nome: "Nova" }, total: 8 }],
      semCategoria: 0,
    });
    vi.mocked(criarCategoria).mockResolvedValue({ id: "nova", nome: "Nova" });
    await montarCategorias();
    fireEvent.click(screen.getByRole("button", { name: /Nova categoria/ }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Nome da categoria"), { target: { value: "Nova" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar categoria" }));

    const confirmacao = await screen.findByRole("dialog", { name: "Aplicar esta mudança?" });
    expect(within(confirmacao).getByText(/8 animais: Em crescimento → Nova/)).toBeTruthy();
    expect(criarCategoria).not.toHaveBeenCalled();
    fireEvent.click(within(confirmacao).getByRole("button", { name: "Aplicar mudança" }));
    await waitFor(() => expect(criarCategoria).toHaveBeenCalled());
  });

  it("subir/descer move a categoria e chama reordenarCategorias com a nova ordem", async () => {
    vi.mocked(reordenarCategorias).mockResolvedValue({ ok: true });
    await montarCategorias();
    fireEvent.click(primeiro("button", "Mover Vaca para baixo"));
    await waitFor(() => expect(reordenarCategorias).toHaveBeenCalledWith(["c-crescimento-f", "c-vaca"]));
  });

  it("restaurar padrões simula primeiro e só aplica depois de confirmado", async () => {
    vi.mocked(restaurarPadroesCategorias).mockImplementation((opts) => Promise.resolve(
      opts?.simular
        ? { afetados: 2, mudancas: [{ de: { id: "x", nome: "Antiga" }, para: { id: "c-vaca", nome: "Vaca" }, total: 2 }], semCategoria: 0 }
        : { afetados: 0, mudancas: [], semCategoria: 0 },
    ));
    await montarCategorias();
    fireEvent.click(screen.getByRole("button", { name: "Restaurar padrões" }));
    const confirmacao = await screen.findByRole("dialog", { name: "Aplicar esta mudança?" });
    expect(within(confirmacao).getByText(/2 animais: Antiga → Vaca/)).toBeTruthy();
    expect(restaurarPadroesCategorias).toHaveBeenCalledWith({ simular: true });
    fireEvent.click(within(confirmacao).getByRole("button", { name: "Aplicar mudança" }));
    await waitFor(() => expect(restaurarPadroesCategorias).toHaveBeenCalledWith({ simular: false }));
  });
});

describe("Cadastros do rebanho — raças", () => {
  it("lista raças com sigla, tipo e situação", async () => {
    await montarRacas();
    const tabela = screen.getByRole("table", { name: "Raças" });
    const linha1 = within(tabela).getByText("Holandesa").closest("tr")!;
    expect(within(linha1).getByText("HOL")).toBeTruthy();
    expect(within(linha1).getByText("Base")).toBeTruthy();
    const linha2 = within(tabela).getByText("Gir").closest("tr")!;
    expect(within(linha2).getByText("Composta")).toBeTruthy();
    expect(within(linha2).getByText("Inativa")).toBeTruthy();
  });

  it("mostra quantos animais ativos usam cada raça", async () => {
    await montarRacas();
    const tabela = screen.getByRole("table", { name: "Raças" });
    expect(within(within(tabela).getByText("Holandesa").closest("tr")!).getByText("5")).toBeTruthy();
    expect(within(within(tabela).getByText("Gir").closest("tr")!).getByText("0")).toBeTruthy();
  });

  it("cria raça com sigla em maiúsculas e base marcada por padrão", async () => {
    vi.mocked(criarRaca).mockResolvedValue(racasMock[0]);
    await montarRacas();
    fireEvent.click(screen.getByRole("button", { name: /Nova raça/ }));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText(/Raça base/) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(within(painel).getByLabelText("Nome da raça"), { target: { value: "Girolando" } });
    fireEvent.change(within(painel).getByLabelText("Sigla"), { target: { value: "gir" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar raça" }));
    await waitFor(() => expect(criarRaca).toHaveBeenCalledWith({ nome: "Girolando", sigla: "GIR", base: true }));
  });

  it("editar carrega os valores atuais da raça", async () => {
    await montarRacas();
    fireEvent.click(primeiro("button", "Editar Holandesa"));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Sigla") as HTMLInputElement).value).toBe("HOL");
    fireEvent.click(within(painel).getByLabelText(/Raça base/));
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar raça" }));
    await waitFor(() => expect(editarRaca).toHaveBeenCalledWith("r1", { nome: "Holandesa", sigla: "HOL", base: false }));
  });

  it("desativar pede confirmação e reativar não", async () => {
    await montarRacas();
    fireEvent.click(primeiro("button", "Reativar Gir"));
    await waitFor(() => expect(editarRaca).toHaveBeenCalledWith("r2", { ativo: true }));

    fireEvent.click(primeiro("button", "Desativar Holandesa"));
    expect(await screen.findByRole("heading", { name: "Desativar Holandesa?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(editarRaca).toHaveBeenCalledWith("r1", { ativo: false }));
  });
});

describe("Cadastros do rebanho — motivos de baixa", () => {
  it("lista motivos com a classe traduzida, ordenados por classe (voluntário, involuntário, morte) e depois nome", async () => {
    await montarMotivos();
    const tabela = screen.getByRole("table", { name: "Motivos de baixa" });
    const linhas = within(tabela).getAllByRole("row").slice(1); // pula o cabeçalho
    expect(linhas.map((linha) => within(linha).getByText(/Baixa produção|Problema locomotor|Morte por doença/).textContent)).toEqual([
      "Baixa produção", "Problema locomotor", "Morte por doença",
    ]);
    const linhaVoluntario = within(tabela).getByText("Baixa produção").closest("tr")!;
    expect(within(linhaVoluntario).getByText("Descarte voluntário")).toBeTruthy();
    const linhaMorte = within(tabela).getByText("Morte por doença").closest("tr")!;
    expect(within(linhaMorte).getByText("Morte")).toBeTruthy();
    expect(within(within(tabela).getByText("Problema locomotor").closest("tr")!).getByText("Inativo")).toBeTruthy();
  });

  it("mostra quantas baixas em vigor usam cada motivo", async () => {
    await montarMotivos();
    const tabela = screen.getByRole("table", { name: "Motivos de baixa" });
    expect(within(within(tabela).getByText("Baixa produção").closest("tr")!).getByText("8")).toBeTruthy();
    expect(within(within(tabela).getByText("Morte por doença").closest("tr")!).getByText("3")).toBeTruthy();
  });

  it("cria motivo de baixa enviando nome e classe", async () => {
    vi.mocked(criarMotivoBaixa).mockResolvedValue(motivosMock[0]);
    await montarMotivos();
    fireEvent.click(screen.getByRole("button", { name: /Novo motivo de baixa/ }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Nome do motivo"), { target: { value: "Idade avançada" } });
    fireEvent.change(within(painel).getByLabelText("Classe"), { target: { value: "DESCARTE_INVOLUNTARIO" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar motivo" }));
    await waitFor(() => expect(criarMotivoBaixa).toHaveBeenCalledWith({ nome: "Idade avançada", classe: "DESCARTE_INVOLUNTARIO" }));
  });

  it("editar carrega o nome e a classe atuais do motivo", async () => {
    await montarMotivos();
    fireEvent.click(primeiro("button", "Editar Morte por doença"));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Classe") as HTMLSelectElement).value).toBe("MORTE");
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar motivo" }));
    await waitFor(() => expect(editarMotivoBaixa).toHaveBeenCalledWith("m1", { nome: "Morte por doença", classe: "MORTE" }));
  });

  it("desativar pede confirmação e reativar não", async () => {
    await montarMotivos();
    fireEvent.click(primeiro("button", "Reativar Problema locomotor"));
    await waitFor(() => expect(editarMotivoBaixa).toHaveBeenCalledWith("m3", { ativo: true }));

    fireEvent.click(primeiro("button", "Desativar Baixa produção"));
    expect(await screen.findByRole("heading", { name: "Desativar Baixa produção?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(editarMotivoBaixa).toHaveBeenCalledWith("m2", { ativo: false }));
  });
});

describe("Cadastros do rebanho — histórico de alterações", () => {
  it("busca o histórico da entidade certa em cada sub-aba", async () => {
    await montarCategorias();
    await waitFor(() => expect(listarAuditoriaCadastro).toHaveBeenCalledWith("CategoriaAnimal", { entidadeId: undefined, page: 1, pageSize: 10 }));

    fireEvent.click(screen.getByRole("button", { name: "Raças" }));
    await screen.findAllByText("Holandesa");
    await waitFor(() => expect(listarAuditoriaCadastro).toHaveBeenCalledWith("Raca", { entidadeId: undefined, page: 1, pageSize: 10 }));

    vi.mocked(listarMotivosBaixa).mockResolvedValue(motivosMock);
    fireEvent.click(screen.getByRole("button", { name: "Motivos de baixa" }));
    await screen.findAllByText("Morte por doença");
    await waitFor(() => expect(listarAuditoriaCadastro).toHaveBeenCalledWith("MotivoBaixa", { entidadeId: undefined, page: 1, pageSize: 10 }));
  });

  it("mostra as entradas do histórico, expande as alterações e pagina com Carregar mais", async () => {
    vi.mocked(listarAuditoriaCadastro).mockResolvedValueOnce({
      itens: [{
        em: "2026-03-10T14:32:00.000Z",
        acao: "EDITAR",
        entidade: "CategoriaAnimal",
        usuarioNome: "Ana",
        resumo: 'Categoria "Vaca" editada',
        entidadeId: "c-vaca",
        alteracoes: [{ campo: "idadeMinMeses", rotulo: "Idade mínima (meses)", antes: "12", depois: "24" }],
      }],
      total: 2,
    });
    await montarCategorias();

    const entrada = await screen.findByRole("button", { name: /Categoria "Vaca" editada/ });
    expect(within(entrada).getByText(/Ana/)).toBeTruthy();
    expect(within(entrada).getByText(/10\/03\/2026/)).toBeTruthy();
    expect(within(entrada).getByText(/\d{2}:\d{2}/)).toBeTruthy();
    expect(screen.queryByText("Idade mínima (meses)")).toBeNull();

    fireEvent.click(entrada);
    expect(screen.getByText("Idade mínima (meses)")).toBeTruthy();
    const linha = screen.getByText("Idade mínima (meses)").closest("tr")!;
    expect(within(linha).getByText("12")).toBeTruthy();
    expect(within(linha).getByText("24")).toBeTruthy();

    vi.mocked(listarAuditoriaCadastro).mockResolvedValueOnce({
      itens: [{ em: "2026-03-09T10:00:00.000Z", acao: "EDITAR", entidade: "CategoriaAnimal", usuarioNome: null, resumo: "Categoria \"Em crescimento\" editada", entidadeId: "c-crescimento-f", alteracoes: [] }],
      total: 2,
    });
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await waitFor(() => expect(listarAuditoriaCadastro).toHaveBeenLastCalledWith("CategoriaAnimal", { entidadeId: undefined, page: 2, pageSize: 10 }));
    expect(await screen.findByText('Categoria "Em crescimento" editada')).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();
  });

  it("sem alterações registradas mostra o estado vazio", async () => {
    await montarCategorias();
    expect(await screen.findByText("Nenhuma alteração registrada.")).toBeTruthy();
  });
});

describe("Cadastros do rebanho — genitores externos", () => {
  const genitoresMock: GenitorDTO[] = [
    { id: "g1", sexo: "F", nome: "Vaca Externa A", codigo: "VA1", fornecedor: "Fazenda Vizinha", observacao: null, ativo: true, composicao: [], composicaoRotulo: "1/2 HO", filhos: 2 },
    { id: "g2", sexo: "M", nome: "Touro Externo B", codigo: null, fornecedor: null, observacao: null, ativo: false, composicao: [], composicaoRotulo: "", filhos: 0 },
  ];

  async function montarGenitores() {
    vi.mocked(listarGenitores).mockResolvedValue(genitoresMock.filter((g) => g.ativo));
    render(<Cadastros />);
    await screen.findAllByText("Vaca");
    fireEvent.click(screen.getByRole("button", { name: "Genitores externos" }));
    await screen.findAllByText("Vaca Externa A");
  }

  it("lista os genitores externos ativos, com composição e filhos", async () => {
    await montarGenitores();
    const tabela = primeiro("table", "Genitores externos");
    expect(within(tabela).getByText("Vaca Externa A")).toBeTruthy();
    expect(within(tabela).getByText("1/2 HO")).toBeTruthy();
    expect(within(tabela).getByText("2")).toBeTruthy();
    expect(within(tabela).queryByText("Touro Externo B")).toBeNull();
  });

  it("Mostrar inativos traz o genitor inativo, e desativar chama editarGenitor", async () => {
    await montarGenitores();
    vi.mocked(listarGenitores).mockResolvedValue(genitoresMock);
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar inativos" }));
    await waitFor(() => expect(within(primeiro("table", "Genitores externos")).getByText("Touro Externo B")).toBeTruthy());

    vi.mocked(editarGenitor).mockResolvedValue({ ...genitoresMock[0], ativo: false });
    fireEvent.click(within(primeiro("table", "Genitores externos")).getAllByRole("button", { name: /Desativar Vaca Externa A/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(editarGenitor).toHaveBeenCalledWith("g1", { ativo: false }));
  });
});

describe("Cadastros do rebanho — material genético", () => {
  const materiaisMock: MaterialGeneticoDTO[] = [
    {
      id: "mg1", tipo: "SEMEN", tipoSemen: "SEXADO_FEMEA",
      touro: { tipo: "ANIMAL", id: "a1", nome: "Zeus", brinco: "001" },
      doadora: null, observacao: null,
      produto: { id: "p1", nome: "Sêmen Zeus (sexado fêmea)", unidade: "DOSE", ativo: true, categoriaNome: "Genética" },
      saldo: 12,
    },
    {
      id: "mg2", tipo: "EMBRIAO", tipoSemen: null,
      touro: { tipo: "EXTERNO", id: "e1", nome: "Touro X", codigo: "TX1" },
      doadora: { tipo: "ANIMAL", id: "a2", nome: "Estrela", brinco: "002" },
      observacao: null,
      produto: { id: "p2", nome: "Embrião Touro X × Estrela", unidade: "UN", ativo: true, categoriaNome: "Genética" },
      saldo: null,
    },
  ];

  async function montarMaterialGenetico() {
    vi.mocked(listarMaterialGenetico).mockResolvedValue(materiaisMock);
    render(<Cadastros />);
    await screen.findAllByText("Vaca");
    fireEvent.click(screen.getByRole("button", { name: "Material genético" }));
    await screen.findAllByText("Sêmen Zeus (sexado fêmea)");
  }

  it("lista sêmen e embrião com touro/doadora e saldo formatado", async () => {
    await montarMaterialGenetico();
    const tabela = primeiro("table", "Material genético");
    expect(within(tabela).getByText("Sêmen Zeus (sexado fêmea)")).toBeTruthy();
    expect(within(tabela).getByText("001 Zeus")).toBeTruthy();
    expect(within(tabela).getByText("12 doses")).toBeTruthy();
    expect(within(tabela).getByText("Embrião Touro X × Estrela")).toBeTruthy();
    expect(within(tabela).getByText("002 Estrela")).toBeTruthy();
    expect(within(tabela).getByText("Sem estoque")).toBeTruthy();
  });

  it("deep-link do estoque abre a sub-aba e o material correto", async () => {
    vi.mocked(listarMaterialGenetico).mockResolvedValue(materiaisMock);
    window.history.replaceState(null, "", "/pecuaria/rebanho/cadastros?aba=material-genetico&material=mg1");
    render(<Cadastros />);
    expect((await screen.findAllByText("Editar Sêmen Zeus (sexado fêmea)")).length).toBeGreaterThan(0);
  });
});
