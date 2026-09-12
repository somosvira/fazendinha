import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Pencil, Plus, Power, PowerOff, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { atualizarConta, atualizarParceiro, obterConfiguracoesFinanceiras, type Conta, type ConfiguracoesFinanceiras as Config, type Parceiro } from "./novo-api";
import { brl, Button, type ColunaTabela, dataBR, ErrorBox, PageHeader, PaginaFinanceira, PaginaSemDados, Panel, Pill, TabelaFinanceira } from "./financeiro-ui";
import { FormConta, TIPO_CONTA } from "./FormConta";
import { FormParceiro } from "./FormParceiro";
import { PAPEIS_PARCEIRO, papeisDoParceiro } from "./lib/parceiros";
import { formatarDocumento } from "./lib/validacao";

type Aba = "contas" | "parceiros";
type Painel = { modo: "novo" } | { modo: "editar"; id: number } | null;
type Confirmacao = { tipo: "conta"; item: Conta } | { tipo: "parceiro"; item: Parceiro } | null;

/* Coluna de ações: editar e desativar/reativar. Os botões param a propagação
 * para não disparar o `onAbrir` da linha (que também abre a edição). */
function AcoesLinha({ nome, ativo, onEditar, onAlternar }: { nome: string; ativo: boolean; onEditar: () => void; onAlternar: () => void }) {
  const parar = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const cls = "rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink";
  return <div className="flex items-center justify-end gap-1">
    <button type="button" onClick={parar(onEditar)} aria-label={`Editar ${nome}`} className={cls}><Pencil size={16} /></button>
    <button type="button" onClick={parar(onAlternar)} aria-label={`${ativo ? "Desativar" : "Reativar"} ${nome}`} className={cls}>{ativo ? <PowerOff size={16} /> : <Power size={16} />}</button>
  </div>;
}

const colunasContas = (editar: (c: Conta) => void, alternar: (c: Conta) => void): ColunaTabela<Conta>[] => [
  { chave: "conta", titulo: "Conta", larguraMinima: 230, principal: true, celula: (c) => <><strong className="break-words">{c.nome}</strong><div className="mt-1 break-words text-xs text-ink-3">{c.instituicao || c.identificacao || "Sem identificação adicional"}</div></> },
  { chave: "tipo", titulo: "Tipo", larguraMinima: 110, celula: (c) => <span className="whitespace-nowrap">{TIPO_CONTA[c.tipo] ?? c.tipo}</span> },
  { chave: "abertura", titulo: "Abertura", alinhamento: "direita", larguraMinima: 130, celula: (c) => <><span className="whitespace-nowrap">{brl(c.saldoAbertura)}</span><div className="whitespace-nowrap text-xs text-ink-3">{dataBR(c.dataSaldoAbertura)}</div></> },
  { chave: "saldo", titulo: "Saldo atual", alinhamento: "direita", larguraMinima: 130, celula: (c) => <strong className="whitespace-nowrap font-semibold">{brl(c.saldoAtual)}</strong> },
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

function mensagemDesativar(confirmacao: NonNullable<Confirmacao>) {
  if (confirmacao.tipo === "conta") return "A conta deixa de aparecer em novas operações e transferências. O extrato e todos os movimentos continuam disponíveis. Você pode reativar quando quiser.";
  const { nome, referencias } = confirmacao.item;
  return referencias > 0
    ? `${nome} deixa de aparecer em novas operações. ${referencias === 1 ? "O registro já ligado" : `Os ${referencias} registros já ligados`} a este cadastro (operações, compromissos e transações) ${referencias === 1 ? "continua intacto" : "continuam intactos"}.`
    : `${nome} deixa de aparecer em novas operações. Nenhum registro está ligado a este cadastro.`;
}

export function ConfiguracoesFinanceiras() {
  const [config, setConfig] = useState<Config | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("contas");
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
  const editar = (item: { id: number }) => { if (!emCurso.current) setPainel({ modo: "editar", id: item.id }); };
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
  const confirmarDesativacao = async () => {
    if (!confirmando) return;
    await executar(async () => {
      if (confirmando.tipo === "conta") await atualizarConta(confirmando.item.id, { ativo: false });
      else await atualizarParceiro(confirmando.item.id, { ativo: false });
      setConfirmando(null);
    });
  };
  const aoSalvar = async () => { setPainel(null); await carregar(); };

  const contaSelecionada = painel?.modo === "editar" ? config.contas.find((c) => c.id === painel.id) ?? null : null;
  const parceiroSelecionado = painel?.modo === "editar" ? config.parceiros.find((p) => p.id === painel.id) ?? null : null;
  /* key força remount do formulário a cada abertura, zerando o estado local */
  const chavePainel = painel ? `${aba}-${painel.modo === "editar" ? painel.id : "novo"}` : "fechado";

  return <PaginaFinanceira>
    <PageHeader titulo="Configurações financeiras" descricao="Cadastros que sustentam as operações. Desativar preserva todo o histórico e permite reativação." acao={<Button onClick={() => setPainel({ modo: "novo" })}><Plus size={16} /> {aba === "contas" ? "Nova conta" : "Novo parceiro"}</Button>} />
    <ErrorBox erro={erro} />
    <div className="mt-6 flex gap-2 overflow-x-auto border-b border-border">{([["contas", "Contas financeiras", Building2], ["parceiros", "Clientes e fornecedores", Users]] as const).map(([k, label, Icon]) => <button key={k} onClick={() => trocarAba(k)} className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${aba === k ? "border-mast text-ink" : "border-transparent text-ink-3"}`}><Icon size={16} className="shrink-0" />{label}</button>)}</div>
    <fieldset disabled={processando} aria-busy={processando} className="min-w-0"><Panel className="mt-5 overflow-hidden">{aba === "contas"
      ? <TabelaFinanceira rotulo="Contas financeiras" itens={config.contas} colunas={colunasContas(editar, alternarConta)} chaveDe={(c) => c.id} onAbrir={editar} classeLinha={(c) => !c.ativo ? "opacity-55" : ""} />
      : <TabelaFinanceira rotulo="Clientes e fornecedores" itens={config.parceiros} colunas={colunasParceiros(editar, alternarParceiro)} chaveDe={(p) => p.id} onAbrir={editar} classeLinha={(p) => !p.ativo ? "opacity-55" : ""} />}</Panel></fieldset>

    {painel && aba === "contas" && <FormConta key={chavePainel} aberto conta={contaSelecionada} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}
    {painel && aba === "parceiros" && <FormParceiro key={chavePainel} aberto parceiro={parceiroSelecionado} onSalvo={aoSalvar} onFechar={() => setPainel(null)} />}

    <ConfirmDialog
      open={confirmando !== null}
      title={confirmando ? `Desativar ${confirmando.item.nome}?` : ""}
      message={confirmando ? mensagemDesativar(confirmando) : ""}
      confirmLabel="Desativar"
      cancelLabel={confirmando?.tipo === "conta" ? "Manter ativa" : "Manter ativo"}
      tone="danger"
      processando={processando}
      onConfirm={() => { void confirmarDesativacao(); }}
      onCancel={() => setConfirmando(null)}
    />
  </PaginaFinanceira>;
}
