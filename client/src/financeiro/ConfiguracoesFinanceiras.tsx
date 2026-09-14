import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Building2, Pencil, Plus, Power, PowerOff, Tags, Target, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { atualizarCategoria, atualizarCentroCusto, atualizarConta, atualizarParceiro, obterConfiguracoesFinanceiras, type Categoria, type CentroCusto, type Conta, type ConfiguracoesFinanceiras as Config, type Parceiro } from "./novo-api";
import { brl, Button, type ColunaTabela, dataBR, ErrorBox, PageHeader, PaginaFinanceira, PaginaSemDados, Panel, Pill, TabelaFinanceira } from "./financeiro-ui";
import { FormConta, TIPO_CONTA } from "./FormConta";
import { FormParceiro } from "./FormParceiro";
import { PAPEIS_PARCEIRO, papeisDoParceiro } from "./lib/parceiros";
import { formatarDocumento } from "./lib/validacao";
import { FormCategoria, FormCentroCusto } from "./FormCadastrosGerenciais";

type Aba = "contas" | "parceiros" | "categorias" | "centros";
type EntidadePainel = "conta" | "parceiro" | "categoria" | "centro";
type Painel = { entidade: EntidadePainel; modo: "novo" } | { entidade: EntidadePainel; modo: "editar"; id: number } | null;
type Confirmacao =
  | { tipo: "conta"; item: Conta }
  | { tipo: "parceiro"; item: Parceiro }
  | { tipo: "categoria"; item: Categoria }
  | { tipo: "centro"; item: CentroCusto }
  | null;

/* Coluna de ações: editar e desativar/reativar. Os botões param a propagação
 * para não disparar o `onAbrir` da linha (que também abre a edição). */
function AcoesLinha({ nome, ativo, onEditar, onAlternar, onSubir, onDescer, podeSubir = false, podeDescer = false }: { nome: string; ativo: boolean; onEditar: () => void; onAlternar: () => void; onSubir?: () => void; onDescer?: () => void; podeSubir?: boolean; podeDescer?: boolean }) {
  const parar = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const cls = "rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink";
  return <div className="flex items-center justify-end gap-1">
    {onSubir && <button type="button" disabled={!podeSubir} onClick={parar(onSubir)} aria-label={`Mover ${nome} para cima`} className={`${cls} disabled:cursor-not-allowed disabled:opacity-30`}><ArrowUp size={16} /></button>}
    {onDescer && <button type="button" disabled={!podeDescer} onClick={parar(onDescer)} aria-label={`Mover ${nome} para baixo`} className={`${cls} disabled:cursor-not-allowed disabled:opacity-30`}><ArrowDown size={16} /></button>}
    <button type="button" onClick={parar(onEditar)} aria-label={`Editar ${nome}`} className={cls}><Pencil size={16} /></button>
    <button type="button" onClick={parar(onAlternar)} aria-label={`${ativo ? "Desativar" : "Reativar"} ${nome}`} className={cls}>{ativo ? <PowerOff size={16} /> : <Power size={16} />}</button>
  </div>;
}

const colunasContas = (contas: Conta[], editar: (c: Conta) => void, alternar: (c: Conta) => void, mover: (c: Conta, direcao: -1 | 1) => void): ColunaTabela<Conta>[] => [
  { chave: "conta", titulo: "Conta", larguraMinima: 210, principal: true, celula: (c) => <strong className="break-words">{c.nome}</strong> },
  { chave: "tipo", titulo: "Tipo", larguraMinima: 110, celula: (c) => <span className="whitespace-nowrap">{TIPO_CONTA[c.tipo] ?? c.tipo}</span> },
  { chave: "instituicao", titulo: "Instituição", larguraMinima: 150, celula: (c) => <span className="break-words">{c.instituicao || "—"}</span> },
  { chave: "abertura", titulo: "Abertura", alinhamento: "direita", larguraMinima: 120, celula: (c) => <span className="whitespace-nowrap">{dataBR(c.dataSaldoAbertura)}</span> },
  { chave: "saldo", titulo: "Saldo atual", alinhamento: "direita", larguraMinima: 130, celula: (c) => <strong className="whitespace-nowrap font-semibold">{brl(c.saldoAtual)}</strong> },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (c) => <Pill tone={c.ativo ? "green" : "neutral"}>{c.ativo ? "Ativa" : "Inativa"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 180, acoes: true, celula: (c) => {
    const grupo = contas.filter((item) => item.ativo === c.ativo);
    const indice = grupo.findIndex((item) => item.id === c.id);
    return <AcoesLinha nome={c.nome} ativo={c.ativo} onEditar={() => editar(c)} onAlternar={() => alternar(c)} onSubir={() => mover(c, -1)} onDescer={() => mover(c, 1)} podeSubir={indice > 0} podeDescer={indice >= 0 && indice < grupo.length - 1} />;
  } },
];

const colunasParceiros = (editar: (p: Parceiro) => void, alternar: (p: Parceiro) => void): ColunaTabela<Parceiro>[] => [
  { chave: "nome", titulo: "Nome", larguraMinima: 200, principal: true, celula: (p) => <strong className="break-words font-semibold">{p.nome}</strong> },
  { chave: "documento", titulo: "Documento", larguraMinima: 150, celula: (p) => <span className="whitespace-nowrap">{formatarDocumento(p.documento) || "—"}</span> },
  { chave: "papel", titulo: "Papéis", larguraMinima: 140, celula: (p) => <span className="break-words">{papeisDoParceiro(p).map((papel) => PAPEIS_PARCEIRO[papel]).join(" · ")}</span> },
  { chave: "contato", titulo: "Contato", larguraMinima: 160, celula: (p) => <span className="break-words text-ink-3">{[p.telefone, p.email].filter(Boolean).join(" · ") || "—"}</span> },
  { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 100, celula: (p) => <Pill tone={p.ativo ? "green" : "neutral"}>{p.ativo ? "Ativo" : "Inativo"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (p) => <AcoesLinha nome={p.nome} ativo={p.ativo} onEditar={() => editar(p)} onAlternar={() => alternar(p)} /> },
];

const colunasCategorias = (editar: (c: Categoria) => void, alternar: (c: Categoria) => void): ColunaTabela<Categoria>[] => [
  { chave: "categoria", titulo: "Categoria", principal: true, larguraMinima: 210, celula: (c) => <strong>{c.nome}</strong> },
  { chave: "classificacao", titulo: "Classificação", alinhamento: "centro", larguraMinima: 130, celula: (c) => c.classificacao === "INVESTIMENTO" ? "Investimento" : c.classificacao === "CUSTEIO" ? "Custeio" : "Não classificada" },
  { chave: "referencias", titulo: "Em uso", alinhamento: "centro", larguraMinima: 100, celula: (c) => (c._count?.operacoes ?? 0) + (c._count?.produtos ?? 0) + (c._count?.itens ?? 0) },
  { chave: "situacao", titulo: "Situação", alinhamento: "centro", larguraMinima: 100, celula: (c) => <Pill tone={c.ativo ? "green" : "neutral"}>{c.ativo ? "Ativa" : "Inativa"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (c) => <AcoesLinha nome={c.nome} ativo={c.ativo} onEditar={() => editar(c)} onAlternar={() => alternar(c)} /> },
];

const colunasCentros = (editar: (c: CentroCusto) => void, alternar: (c: CentroCusto) => void): ColunaTabela<CentroCusto>[] => [
  { chave: "centro", titulo: "Centro de custo", principal: true, larguraMinima: 230, celula: (c) => <strong>{c.nome}</strong> },
  { chave: "referencias", titulo: "Em uso", alinhamento: "centro", larguraMinima: 100, celula: (c) => (c._count?.operacoes ?? 0) + (c._count?.produtos ?? 0) + (c._count?.safras ?? 0) },
  { chave: "situacao", titulo: "Situação", alinhamento: "centro", larguraMinima: 100, celula: (c) => <Pill tone={c.ativo ? "green" : "neutral"}>{c.ativo ? "Ativo" : "Inativo"}</Pill> },
  { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 110, acoes: true, celula: (c) => <AcoesLinha nome={c.nome} ativo={c.ativo} onEditar={() => editar(c)} onAlternar={() => alternar(c)} /> },
];

function mensagemDesativar(confirmacao: NonNullable<Confirmacao>) {
  if (confirmacao.tipo === "conta") return "A conta deixa de aparecer em novas operações e transferências. O extrato e todos os movimentos continuam disponíveis. Você pode reativar quando quiser.";
  if (confirmacao.tipo === "categoria") return "A categoria deixa de aparecer em novas operações e produtos. Os registros históricos continuam vinculados.";
  if (confirmacao.tipo === "centro") return "O centro de custo deixa de aparecer em novas operações, produtos e safras. Os registros históricos continuam vinculados.";
  const { nome, referencias } = confirmacao.item;
  return referencias > 0
    ? `${nome} deixa de aparecer em novas operações. ${referencias === 1 ? "O registro já ligado" : `Os ${referencias} registros já ligados`} a este cadastro (operações, compromissos e transações) ${referencias === 1 ? "continua intacto" : "continuam intactos"}.`
    : `${nome} deixa de aparecer em novas operações. Nenhum registro está ligado a este cadastro.`;
}

export function ConfiguracoesFinanceiras({ abaInicial = "contas", podeEditar = true }: { abaInicial?: Aba; podeEditar?: boolean }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [painel, setPainel] = useState<Painel>(null);
  const [confirmando, setConfirmando] = useState<Confirmacao>(null);
  const [processando, setProcessando] = useState(false);
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
  const editar = (entidade: EntidadePainel, item: { id: number }) => { if (podeEditar && !emCurso.current) setPainel({ entidade, modo: "editar", id: item.id }); };
  const alternarConta = async (c: Conta) => {
    if (emCurso.current) return;
    if (c.ativo) { setConfirmando({ tipo: "conta", item: c }); return; }
    await executar(() => atualizarConta(c.id, { ativo: true }));
  };
  const alternarParceiro = async (p: Parceiro) => {
    if (emCurso.current) return;
    if (p.ativo) { setConfirmando({ tipo: "parceiro", item: p }); return; }
    await executar(() => atualizarParceiro(p.id, { ativo: true }));
  };
  const alternarCategoria = async (c: Categoria) => {
    if (emCurso.current) return;
    if (c.ativo) { setConfirmando({ tipo: "categoria", item: c }); return; }
    await executar(() => atualizarCategoria(c.id, { ativo: true }));
  };
  const alternarCentro = async (c: CentroCusto) => {
    if (emCurso.current) return;
    if (c.ativo) { setConfirmando({ tipo: "centro", item: c }); return; }
    await executar(() => atualizarCentroCusto(c.id, { ativo: true }));
  };
  const moverConta = async (conta: Conta, direcao: -1 | 1) => {
    const grupo = config.contas.filter((item) => item.ativo === conta.ativo);
    const atual = grupo.findIndex((item) => item.id === conta.id);
    const destino = atual + direcao;
    if (atual < 0 || destino < 0 || destino >= grupo.length) return;
    const reordenadas = [...grupo];
    [reordenadas[atual], reordenadas[destino]] = [reordenadas[destino], reordenadas[atual]];
    await executar(() => Promise.all(reordenadas.map((item, ordem) => item.ordem === ordem ? Promise.resolve(item) : atualizarConta(item.id, { ordem }))));
  };
  const confirmarDesativacao = async () => {
    if (!confirmando) return;
    await executar(async () => {
      if (confirmando.tipo === "conta") await atualizarConta(confirmando.item.id, { ativo: false });
      else if (confirmando.tipo === "parceiro") await atualizarParceiro(confirmando.item.id, { ativo: false });
      else if (confirmando.tipo === "categoria") await atualizarCategoria(confirmando.item.id, { ativo: false });
      else await atualizarCentroCusto(confirmando.item.id, { ativo: false });
      setConfirmando(null);
    });
  };
  const aoSalvar = async () => { setPainel(null); await carregar(); };

  const contaSelecionada = painel?.entidade === "conta" && painel.modo === "editar" ? config.contas.find((c) => c.id === painel.id) ?? null : null;
  const parceiroSelecionado = painel?.entidade === "parceiro" && painel.modo === "editar" ? config.parceiros.find((p) => p.id === painel.id) ?? null : null;
  const categoriaSelecionada = painel?.entidade === "categoria" && painel.modo === "editar" ? config.categorias.find((c) => c.id === painel.id) ?? null : null;
  const centroSelecionado = painel?.entidade === "centro" && painel.modo === "editar" ? config.centrosCusto.find((c) => c.id === painel.id) ?? null : null;
  /* key força remount do formulário a cada abertura, zerando o estado local */
  const chavePainel = painel ? `${painel.entidade}-${painel.modo === "editar" ? painel.id : "novo"}` : "fechado";

  const categorias = config.categorias;
  const acao = aba === "categorias"
    ? <Button onClick={() => abrirNovo("categoria")}><Plus size={16} /> Nova categoria</Button>
    : <Button onClick={() => abrirNovo(aba === "contas" ? "conta" : aba === "parceiros" ? "parceiro" : "centro")}><Plus size={16} /> {aba === "contas" ? "Nova conta" : aba === "parceiros" ? "Novo parceiro" : "Novo centro de custo"}</Button>;

  return <PaginaFinanceira>
    <PageHeader titulo="Configurações financeiras" descricao="Cadastros que sustentam as operações. Desativar preserva todo o histórico e permite reativação." acao={podeEditar ? acao : undefined} />
    <ErrorBox erro={erro} />
    {!podeEditar && <p className="mt-4 rounded-lg border border-border bg-[#faf9f4] px-4 py-3 text-sm text-ink-3">Você tem acesso de consulta a estes cadastros.</p>}
    <div className="mt-6 flex gap-2 overflow-x-auto border-b border-border">{([["contas", "Contas financeiras", Building2], ["parceiros", "Clientes e fornecedores", Users], ["categorias", "Categorias", Tags], ["centros", "Centros de custo", Target]] as const).map(([k, label, Icon]) => <button key={k} onClick={() => trocarAba(k)} className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${aba === k ? "border-mast text-ink" : "border-transparent text-ink-3"}`}><Icon size={16} className="shrink-0" />{label}</button>)}</div>
    <fieldset disabled={processando || !podeEditar} aria-busy={processando} className="min-w-0">
      {aba === "contas" && <Panel className="mt-5 overflow-hidden"><TabelaFinanceira rotulo="Contas financeiras" itens={config.contas} colunas={colunasContas(config.contas, (c) => editar("conta", c), alternarConta, moverConta)} chaveDe={(c) => c.id} onAbrir={(c) => editar("conta", c)} classeLinha={(c) => !c.ativo ? "opacity-55" : ""} /></Panel>}
      {aba === "parceiros" && <Panel className="mt-5 overflow-hidden"><TabelaFinanceira rotulo="Clientes e fornecedores" itens={config.parceiros} colunas={colunasParceiros((p) => editar("parceiro", p), alternarParceiro)} chaveDe={(p) => p.id} onAbrir={(p) => editar("parceiro", p)} classeLinha={(p) => !p.ativo ? "opacity-55" : ""} /></Panel>}
      {aba === "categorias" && <Panel className="mt-5 overflow-hidden"><div className="border-b border-border p-5"><h2 className="font-serif text-2xl">Categorias</h2><p className="mt-1 text-xs text-ink-3">Identificam cada item comprado ou vendido.</p></div><TabelaFinanceira rotulo="Categorias financeiras" itens={categorias} colunas={colunasCategorias((c) => editar("categoria", c), alternarCategoria)} chaveDe={(c) => c.id} onAbrir={(c) => editar("categoria", c)} classeLinha={(c) => !c.ativo ? "opacity-55" : ""} /></Panel>}
      {aba === "centros" && <Panel className="mt-5 overflow-hidden"><TabelaFinanceira rotulo="Centros de custo" itens={config.centrosCusto} colunas={colunasCentros((c) => editar("centro", c), alternarCentro)} chaveDe={(c) => c.id} onAbrir={(c) => editar("centro", c)} classeLinha={(c) => !c.ativo ? "opacity-55" : ""} /></Panel>}
    </fieldset>

    {painel?.entidade === "conta" && <FormConta key={chavePainel} aberto conta={contaSelecionada} ordemInicial={config.contas.reduce((maior, conta) => Math.max(maior, conta.ordem ?? 0), -1) + 1} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painel?.entidade === "parceiro" && <FormParceiro key={chavePainel} aberto parceiro={parceiroSelecionado} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
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
