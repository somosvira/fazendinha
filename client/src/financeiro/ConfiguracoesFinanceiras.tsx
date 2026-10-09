import { SecaoFinanceira } from "./SecaoFinanceira";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ListaCadastroFinanceiro } from "./ListaCadastroFinanceiro";
import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Package, Plus, Tags, Target, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { atualizarCategoria, atualizarCentroCusto, atualizarConta, atualizarParceiro, atualizarProduto, obterConfiguracoesFinanceiras, type Categoria, type CentroCusto, type Conta, type ConfiguracoesFinanceiras as Config, type Parceiro, type Produto } from "./novo-api";
import { AcoesLinha, brl, Button, type ColunaTabela, dataBR, ErrorBox, PageHeader, PaginaFinanceira, PaginaSemDados, Panel, Pill, SelectFiltro, TabelaFinanceira } from "./financeiro-ui";
import { FormConta, TIPO_CONTA } from "./FormConta";
import { FormParceiro } from "./FormParceiro";
import { PAPEIS_PARCEIRO, papeisDoParceiro } from "./lib/parceiros";
import { formatarDocumento } from "./lib/validacao";
import { FormCategoria, FormCentroCusto } from "./FormCadastrosGerenciais";
import { rotuloUnidade } from "../lib/unidades";
import { FormProduto } from "./FormProduto";

type Aba = "contas" | "parceiros" | "produtos" | "categorias" | "centros";
type EntidadePainel = "conta" | "parceiro" | "produto" | "categoria" | "centro";
type Painel = { entidade: EntidadePainel; modo: "novo" } | { entidade: EntidadePainel; modo: "editar"; id: string } | null;
type Confirmacao =
  | { tipo: "conta"; item: Conta }
  | { tipo: "parceiro"; item: Parceiro }
  | { tipo: "produto"; item: Produto }
  | { tipo: "categoria"; item: Categoria }
  | { tipo: "centro"; item: CentroCusto }
  | null;

const colunasContas = (editar: (c: Conta) => void, alternar: (c: Conta) => void): ColunaTabela<Conta>[] => [
  { chave: "conta", titulo: "Conta", larguraMinima: 210, principal: true, celula: (c) => <strong className="break-words">{c.nome}</strong> },
  { chave: "tipo", titulo: "Tipo", larguraMinima: 110, celula: (c) => <span className="whitespace-nowrap">{TIPO_CONTA[c.tipo] ?? c.tipo}</span> },
  { chave: "instituicao", titulo: "Instituição", larguraMinima: 150, celula: (c) => <span className="break-words">{c.instituicao || "—"}</span> },
  { chave: "abertura", titulo: "Abertura", alinhamento: "direita", larguraMinima: 120, celula: (c) => <span className="whitespace-nowrap">{dataBR(c.dataSaldoAbertura)}</span> },
  { chave: "saldo", titulo: "Saldo atual", alinhamento: "direita", larguraMinima: 130, celula: (c) => <strong data-fin-tom={Number(c.saldoAtual) < 0 ? "saida" : "entrada"} className="fin-valor whitespace-nowrap font-semibold tabular-nums">{brl(c.saldoAtual)}</strong> },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (c) => <Pill tone={c.ativo ? "green" : "neutral"}>{c.ativo ? "Ativa" : "Inativa"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (c) => <AcoesLinha nome={c.nome} ativo={c.ativo} onEditar={() => editar(c)} onAlternar={() => alternar(c)} /> },
];

const colunasParceiros = (editar: (p: Parceiro) => void, alternar: (p: Parceiro) => void): ColunaTabela<Parceiro>[] => [
  { chave: "nome", titulo: "Nome", larguraMinima: 200, principal: true, celula: (p) => <strong className="break-words font-semibold">{p.nome}</strong> },
  { chave: "documento", titulo: "Documento", larguraMinima: 150, celula: (p) => <span className="whitespace-nowrap">{formatarDocumento(p.documento) || "—"}</span> },
  { chave: "papel", titulo: "Papéis", larguraMinima: 140, celula: (p) => <span className="break-words">{papeisDoParceiro(p).map((papel) => PAPEIS_PARCEIRO[papel]).join(" · ")}</span> },
  { chave: "contato", titulo: "Contato", larguraMinima: 160, celula: (p) => <span className="break-words text-ink-3">{[p.telefone, p.email].filter(Boolean).join(" · ") || "—"}</span> },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (p) => <Pill tone={p.ativo ? "green" : "neutral"}>{p.ativo ? "Ativo" : "Inativo"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (p) => <AcoesLinha nome={p.nome} ativo={p.ativo} onEditar={() => editar(p)} onAlternar={() => alternar(p)} /> },
];

const colunasProdutos = (editar: (p: Produto) => void, alternar: (p: Produto) => void, podeEditar: boolean): ColunaTabela<Produto>[] => [
  { chave: "nome", titulo: "Produto", larguraMinima: 200, principal: true, celula: (p) => <strong className="break-words font-semibold">{p.nome}</strong> },
  { chave: "categoria", titulo: "Categoria", larguraMinima: 130, celula: (p) => p.categoriaNome ?? "Sem categoria" },
  { chave: "uso", titulo: "Tipos de uso", larguraMinima: 130, celula: (p) => [p.usoGenetico && "Genético", p.usoSanitario && "Sanitário", p.usoNutricional && "Nutricional"].filter(Boolean).join(" · ") || "Geral" },
  { chave: "unidade", titulo: "Unidade", larguraMinima: 80, celula: (p) => rotuloUnidade(p.unidade) },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (p) => <Pill tone={p.ativo !== false ? "green" : "neutral"}>{p.ativo !== false ? "Ativo" : "Inativo"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 140, acoes: true, celula: (p) => <div className="flex items-center justify-end gap-2"><a href={`/estoque/produtos/${p.id}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap text-sm underline">Ver no estoque</a>{podeEditar && <AcoesLinha nome={p.nome} ativo={p.ativo !== false} onEditar={() => editar(p)} onAlternar={() => alternar(p)} />}</div> },
];

const colunasCategorias = (editar: (c: Categoria) => void, alternar: (c: Categoria) => void): ColunaTabela<Categoria>[] => [
  { chave: "categoria", titulo: "Categoria", principal: true, larguraMinima: 210, celula: (c) => <strong>{c.nome}</strong> },
  { chave: "classificacao", titulo: "Classificação", alinhamento: "centro", larguraMinima: 130, celula: (c) => <Pill tone={c.classificacao === "INVESTIMENTO" ? "blue" : c.classificacao === "CUSTEIO" ? "brown" : "neutral"}>{c.classificacao === "INVESTIMENTO" ? "Investimento" : c.classificacao === "CUSTEIO" ? "Custeio" : "Não classificada"}</Pill> },
  { chave: "referencias", titulo: "Vínculos", alinhamento: "centro", larguraMinima: 100, celula: (c) => (c._count?.operacoes ?? 0) + (c._count?.produtos ?? 0) + (c._count?.itens ?? 0) },
  { chave: "situacao", titulo: "Situação", alinhamento: "centro", larguraMinima: 100, celula: (c) => <Pill tone={c.ativo ? "green" : "neutral"}>{c.ativo ? "Ativa" : "Inativa"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (c) => <AcoesLinha nome={c.nome} ativo={c.ativo} onEditar={() => editar(c)} onAlternar={() => alternar(c)} /> },
];

const colunasCentros = (editar: (c: CentroCusto) => void, alternar: (c: CentroCusto) => void): ColunaTabela<CentroCusto>[] => [
  { chave: "centro", titulo: "Centro de custo", principal: true, larguraMinima: 230, celula: (c) => <strong>{c.nome}</strong> },
  { chave: "referencias", titulo: "Vínculos", alinhamento: "centro", larguraMinima: 100, celula: (c) => (c._count?.operacoes ?? 0) + (c._count?.produtos ?? 0) },
  { chave: "situacao", titulo: "Situação", alinhamento: "centro", larguraMinima: 100, celula: (c) => <Pill tone={c.ativo ? "green" : "neutral"}>{c.ativo ? "Ativo" : "Inativo"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (c) => <AcoesLinha nome={c.nome} ativo={c.ativo} onEditar={() => editar(c)} onAlternar={() => alternar(c)} /> },
];

function mensagemDesativar(confirmacao: NonNullable<Confirmacao>) {
  if (confirmacao.tipo === "conta") return "A conta deixa de aparecer em novas operações e transferências. O extrato e todos os movimentos continuam disponíveis. Você pode reativar quando quiser.";
  if (confirmacao.tipo === "categoria") return "A categoria deixa de aparecer em novas operações e produtos. Os registros históricos continuam vinculados.";
  if (confirmacao.tipo === "centro") return "O centro de custo deixa de aparecer em novas operações e produtos. Os registros históricos continuam vinculados.";
  if (confirmacao.tipo === "produto") return "O produto deixa de aparecer em novas operações. Operações, movimentos e saldos históricos continuam vinculados e o produto pode ser reativado.";
  const { nome, referencias } = confirmacao.item;
  return referencias > 0
    ? `${nome} deixa de aparecer em novas operações. ${referencias === 1 ? "O registro já ligado" : `Os ${referencias} registros já ligados`} a este cadastro (operações, compromissos e transações) ${referencias === 1 ? "continua intacto" : "continuam intactos"}.`
    : `${nome} deixa de aparecer em novas operações. Nenhum registro está ligado a este cadastro.`;
}

export function ConfiguracoesFinanceiras({ abaInicial = "contas", podeEditar = true }: { abaInicial?: Aba; podeEditar?: boolean }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>(() => { const alvo = new URLSearchParams(window.location.search).get("aba"); return alvo === "parceiros" || alvo === "produtos" ? alvo : abaInicial; });
  const [painel, setPainel] = useState<Painel>(null);
  const [confirmando, setConfirmando] = useState<Confirmacao>(null);
  const [processando, setProcessando] = useState(false);
  const [filtroPapel, setFiltroPapel] = useState("");
  const [filtroFornecedor, setFiltroFornecedor] = useState("");
  const [filtroCentro, setFiltroCentro] = useState("");
  const [filtroUso, setFiltroUso] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("TODOS");
  const emCurso = useRef(false);
  const executar = async (acao: () => Promise<unknown>) => {
    if (emCurso.current) return;
    emCurso.current = true; setProcessando(true); setErro(null);
    try { await acao(); await carregar(); }
    catch (e) { setConfirmando(null); setErro(e instanceof Error ? e.message : String(e)); }
    finally { emCurso.current = false; setProcessando(false); }
  };
  const carregar = useCallback(() => obterConfiguracoesFinanceiras().then(setConfig).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  if (!config) return <PaginaSemDados titulo="Configurações financeiras" descricao="Cadastros que sustentam as operações. Desativar preserva todo o histórico e permite reativação." label="Carregando configurações financeiras" erro={erro} />;

  const trocarAba = (nova: Aba) => { setAba(nova); setPainel(null); setConfirmando(null); };
  const abrirNovo = (entidade: EntidadePainel) => { if (podeEditar && !emCurso.current) setPainel({ entidade, modo: "novo" }); };
  const editar = (entidade: EntidadePainel, item: { id: string }) => { if ((podeEditar || entidade === "produto") && !emCurso.current) setPainel({ entidade, modo: "editar", id: item.id }); };
  const alternarConta = async (c: Conta) => {
    if (!podeEditar || emCurso.current) return;
    if (c.ativo) { setConfirmando({ tipo: "conta", item: c }); return; }
    await executar(() => atualizarConta(c.id, { ativo: true }));
  };
  const alternarParceiro = async (p: Parceiro) => {
    if (!podeEditar || emCurso.current) return;
    if (p.ativo) { setConfirmando({ tipo: "parceiro", item: p }); return; }
    await executar(() => atualizarParceiro(p.id, { ativo: true }));
  };
  const alternarCategoria = async (c: Categoria) => {
    if (!podeEditar || emCurso.current) return;
    if (c.ativo) { setConfirmando({ tipo: "categoria", item: c }); return; }
    await executar(() => atualizarCategoria(c.id, { ativo: true }));
  };
  const alternarCentro = async (c: CentroCusto) => {
    if (!podeEditar || emCurso.current) return;
    if (c.ativo) { setConfirmando({ tipo: "centro", item: c }); return; }
    await executar(() => atualizarCentroCusto(c.id, { ativo: true }));
  };
  const alternarProduto = async (p: Produto) => {
    if (!podeEditar || emCurso.current) return;
    if (p.ativo !== false) { setConfirmando({ tipo: "produto", item: p }); return; }
    await executar(() => atualizarProduto(p.id, { ativo: true }));
  };
  const confirmarDesativacao = async () => {
    if (!confirmando) return;
    await executar(async () => {
      if (confirmando.tipo === "conta") await atualizarConta(confirmando.item.id, { ativo: false });
      else if (confirmando.tipo === "parceiro") await atualizarParceiro(confirmando.item.id, { ativo: false });
      else if (confirmando.tipo === "categoria") await atualizarCategoria(confirmando.item.id, { ativo: false });
      else if (confirmando.tipo === "centro") await atualizarCentroCusto(confirmando.item.id, { ativo: false });
      else await atualizarProduto(confirmando.item.id, { ativo: false });
      setConfirmando(null);
    });
  };
  const aoSalvar = async () => { setPainel(null); await carregar(); };

  const contaSelecionada = painel?.entidade === "conta" && painel.modo === "editar" ? config.contas.find((c) => c.id === painel.id) ?? null : null;
  const parceiroSelecionado = painel?.entidade === "parceiro" && painel.modo === "editar" ? config.parceiros.find((p) => p.id === painel.id) ?? null : null;
  const produtosCadastro = config.produtosCadastro ?? config.produtos;
  const produtoSelecionado = painel?.entidade === "produto" && painel.modo === "editar" ? produtosCadastro.find((p) => p.id === painel.id) ?? null : null;
  const categoriaSelecionada = painel?.entidade === "categoria" && painel.modo === "editar" ? config.categorias.find((c) => c.id === painel.id) ?? null : null;
  const centroSelecionado = painel?.entidade === "centro" && painel.modo === "editar" ? config.centrosCusto.find((c) => c.id === painel.id) ?? null : null;
  /* key força remount do formulário a cada abertura, zerando o estado local */
  const chavePainel = painel ? `${painel.entidade}-${painel.modo === "editar" ? painel.id : "novo"}` : "fechado";

  const categorias = config.categorias;
  const produtosFiltrados = produtosCadastro.filter((produto) => {
    const fornecedorOk = filtroFornecedor === "SEM" ? !produto.fornecedores?.length : !filtroFornecedor || produto.fornecedores?.some((f) => f.id === filtroFornecedor);
    const centroOk = filtroCentro === "SEM" ? !produto.centrosCusto?.length : !filtroCentro || produto.centrosCusto?.some((c) => c.id === filtroCentro);
    const situacaoOk = filtroSituacao === "TODOS" || (filtroSituacao === "ATIVOS" ? produto.ativo !== false : produto.ativo === false);
    const usoOk = !filtroUso || (filtroUso === "SEM" ? !produto.usoGenetico && !produto.usoSanitario && !produto.usoNutricional
      : !!produto[filtroUso as "usoGenetico" | "usoSanitario" | "usoNutricional"]);
    return fornecedorOk && centroOk && situacaoOk && usoOk;
  });
  const acao = aba === "categorias"
    ? <Button onClick={() => abrirNovo("categoria")}><Plus size={16} /> Nova categoria</Button>
    : <Button onClick={() => abrirNovo(aba === "contas" ? "conta" : aba === "parceiros" ? "parceiro" : aba === "produtos" ? "produto" : "centro")}><Plus size={16} /> {aba === "contas" ? "Nova conta" : aba === "parceiros" ? "Novo parceiro" : aba === "produtos" ? "Novo produto" : "Novo centro de custo"}</Button>;

  return <PaginaFinanceira colorida>
    <PageHeader eyebrow="" titulo="Configurações financeiras" descricao="Cadastros que sustentam as operações. Desativar preserva todo o histórico e permite reativação." acao={podeEditar ? acao : undefined} />
    <ErrorBox erro={erro} />
    {!podeEditar && <p className="mt-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-ink-3">Você tem acesso de consulta a estes cadastros.</p>}
    <Tabs value={aba} onValueChange={v => trocarAba(v as Aba)} className="mt-3 min-w-0">
      <TabsList aria-label="Cadastros financeiros" className="fin-abas grid h-auto group-data-[orientation=horizontal]/tabs:h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-5">{([["contas", "Contas financeiras", Building2], ["parceiros", "Clientes e fornecedores", Users], ["produtos", "Produtos", Package], ["categorias", "Categorias", Tags], ["centros", "Centros de custo", Target]] as const).map(([k, label, Icon]) => <TabsTrigger key={k} value={k} onClick={() => trocarAba(k)} className="min-h-10 whitespace-normal px-3 text-left"><Icon size={16} />{label}</TabsTrigger>)}</TabsList>
      <TabsContent value={aba}>
    <fieldset disabled={processando} aria-busy={processando} className="min-w-0">
      {aba === "contas" && <ListaCadastroFinanceiro key="contas" rotulo="Contas financeiras" itens={config.contas} colunas={colunasContas((c) => editar("conta", c), alternarConta).filter(coluna => podeEditar || !coluna.acoes)} onAbrir={podeEditar ? item => editar("conta", item) : undefined} />}
      {aba === "parceiros" && <ListaCadastroFinanceiro key="parceiros" rotulo="Clientes e fornecedores" itens={config.parceiros.filter(p => !filtroPapel || papeisDoParceiro(p).includes(filtroPapel as keyof typeof PAPEIS_PARCEIRO))} colunas={colunasParceiros((p) => editar("parceiro", p), alternarParceiro).filter(coluna => podeEditar || !coluna.acoes)} onAbrir={podeEditar ? item => editar("parceiro", item) : undefined} termosDe={p => `${p.nome} ${p.documento ?? ""} ${p.email ?? ""} ${p.telefone ?? ""}`} filtros={<label className="text-sm font-medium">Papel<SelectFiltro rotulo="Papel do parceiro" valor={filtroPapel} onChange={setFiltroPapel} opcoes={[{ valor: "", texto: "Todos os papéis" }, ...Object.entries(PAPEIS_PARCEIRO).map(([valor, texto]) => ({ valor, texto }))]} className="mt-1" /></label>} />}
      {aba === "produtos" && <ListaCadastroFinanceiro key="produtos" rotulo="Produtos" rotuloBusca="Buscar produto" mostrarSituacao={false} itens={produtosFiltrados} colunas={colunasProdutos((p) => editar("produto", p), alternarProduto, podeEditar)} onAbrir={p => editar("produto", p)} filtros={<div className="w-full"><SecaoFinanceira titulo="Filtros de produtos" abrirNoDesktop detalhe={`${[filtroFornecedor, filtroCentro, filtroUso, filtroSituacao === "TODOS" ? "" : filtroSituacao].filter(Boolean).length} ativos`}><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><SelectFiltro rotulo="Filtrar por fornecedor" valor={filtroFornecedor} onChange={setFiltroFornecedor} opcoes={[{ valor: "", texto: "Todos os fornecedores" }, { valor: "SEM", texto: "Sem fornecedor" }, ...config.parceiros.filter((p) => papeisDoParceiro(p).includes("FORNECEDOR")).map((p) => ({ valor: String(p.id), texto: p.nome }))]} /><SelectFiltro rotulo="Filtrar por centro de custo" valor={filtroCentro} onChange={setFiltroCentro} opcoes={[{ valor: "", texto: "Todos os centros" }, { valor: "SEM", texto: "Sem centro" }, ...config.centrosCusto.filter((c) => c.ativo).map((c) => ({ valor: String(c.id), texto: c.nome }))]} /><SelectFiltro rotulo="Filtrar por uso" valor={filtroUso} onChange={setFiltroUso} opcoes={[{ valor: "", texto: "Todos os usos" }, { valor: "usoGenetico", texto: "Uso genético" }, { valor: "usoSanitario", texto: "Uso sanitário" }, { valor: "usoNutricional", texto: "Uso nutricional" }, { valor: "SEM", texto: "Sem uso específico" }]} /><SelectFiltro rotulo="Filtrar por situação" valor={filtroSituacao} onChange={setFiltroSituacao} opcoes={[{ valor: "TODOS", texto: "Ativos e inativos" }, { valor: "ATIVOS", texto: "Ativos" }, { valor: "INATIVOS", texto: "Inativos" }]} /></div>{(filtroFornecedor || filtroCentro || filtroUso || filtroSituacao !== "TODOS") && <Button secondary className="mt-3" onClick={() => { setFiltroFornecedor(""); setFiltroCentro(""); setFiltroUso(""); setFiltroSituacao("TODOS"); }}>Limpar filtros de produtos</Button>}</SecaoFinanceira></div>} />}
      {aba === "categorias" && <ListaCadastroFinanceiro key="categorias" rotulo="Categorias financeiras" itens={categorias} colunas={colunasCategorias((c) => editar("categoria", c), alternarCategoria).filter(coluna => podeEditar || !coluna.acoes)} onAbrir={podeEditar ? item => editar("categoria", item) : undefined} />}
      {aba === "centros" && <ListaCadastroFinanceiro key="centros" rotulo="Centros de custo" itens={config.centrosCusto} colunas={colunasCentros((c) => editar("centro", c), alternarCentro).filter(coluna => podeEditar || !coluna.acoes)} onAbrir={podeEditar ? item => editar("centro", item) : undefined} />}
    </fieldset>
      </TabsContent>
    </Tabs>

    {painel?.entidade === "conta" && <FormConta key={chavePainel} aberto conta={contaSelecionada} ordemInicial={config.contas.reduce((maior, conta) => Math.max(maior, conta.ordem ?? 0), -1) + 1} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painel?.entidade === "parceiro" && <FormParceiro key={chavePainel} aberto parceiro={parceiroSelecionado} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painel?.entidade === "produto" && <FormProduto key={chavePainel} somenteLeitura={!podeEditar} produto={produtoSelecionado} parceiros={config.parceiros} categorias={categorias} centros={config.centrosCusto} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painel?.entidade === "categoria" && <FormCategoria key={chavePainel} categoria={categoriaSelecionada} ordemInicial={categorias.reduce((maior, categoria) => Math.max(maior, categoria.ordem), -1) + 1} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painel?.entidade === "centro" && <FormCentroCusto key={chavePainel} centro={centroSelecionado} ordemInicial={config.centrosCusto.reduce((maior, centro) => Math.max(maior, centro.ordem), -1) + 1} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}

    <ConfirmDialog
      open={confirmando !== null}
      title={confirmando ? `Desativar ${confirmando.item.nome}?` : ""}
      message={confirmando ? mensagemDesativar(confirmando) : ""}
      confirmLabel="Desativar"
      cancelLabel={confirmando?.tipo === "conta" || confirmando?.tipo === "categoria" ? "Manter ativa" : "Manter ativo"}
      tone="danger"
      processando={processando}
      onConfirm={() => { void confirmarDesativacao(); }}
      onCancel={() => setConfirmando(null)}
    />
  </PaginaFinanceira>;
}
