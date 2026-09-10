import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { Building2, Pencil, Plus, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  atualizarConta, atualizarParceiro, criarConta, criarParceiro, obterConfiguracoesFinanceiras,
  type Conta, type ConfiguracoesFinanceiras as Config, type Parceiro,
} from "./novo-api";
import { brl, Button, type ColunaTabela, dataBR, ErrorBox, hoje, PageHeader, PaginaFinanceira, PaginaSemDados, Panel, Pill, TabelaFinanceira } from "./financeiro-ui";
import { documentoFiscalValido, emailValido } from "./validacoes-cadastros";

type Aba = "contas" | "parceiros";
type Editor = { entidade: "conta" | "parceiro"; id?: number; novo?: true } | null;
type RotaCadastro = { aba: Aba; editor: Editor };
type CampoErros = Record<string, string>;

const TIPOS_CONTA: { valor: Conta["tipo"]; nome: string }[] = [
  { valor: "BANCO", nome: "Banco" }, { valor: "CAIXA", nome: "Caixa" },
  { valor: "APLICACAO", nome: "Aplicação" }, { valor: "DINHEIRO", nome: "Dinheiro" },
];
const TIPOS_PARCEIRO = [
  ["FORNECEDOR", "Fornecedor"], ["CLIENTE", "Cliente"], ["AMBOS", "Cliente e fornecedor"],
  ["FUNCIONARIO", "Funcionário"], ["PROPRIETARIO", "Proprietário"], ["OUTRO", "Outro"],
] as const;
const NOME_TIPO_CONTA: Record<Conta["tipo"], string> = Object.fromEntries(TIPOS_CONTA.map((tipo) => [tipo.valor, tipo.nome])) as Record<Conta["tipo"], string>;
const NOME_TIPO_PARCEIRO: Record<string, string> = Object.fromEntries(TIPOS_PARCEIRO);
const CLASSE_CAMPO = "mt-1.5 block min-h-10 w-full rounded-lg border border-border bg-white px-3 py-2.5 font-normal outline-none focus:border-green-800 focus:ring-1 focus:ring-green-800";

function lerRotaCadastro(): RotaCadastro {
  if (typeof window === "undefined") return { aba: "contas", editor: null };
  const busca = new URLSearchParams(window.location.search);
  const aba: Aba = busca.get("aba") === "parceiros" || busca.has("parceiro") ? "parceiros" : "contas";
  const contaId = Number(busca.get("conta"));
  const parceiroId = Number(busca.get("parceiro"));
  if (contaId > 0) return { aba: "contas", editor: { entidade: "conta", id: contaId } };
  if (parceiroId > 0) return { aba: "parceiros", editor: { entidade: "parceiro", id: parceiroId } };
  if (busca.get("nova") === "conta") return { aba: "contas", editor: { entidade: "conta", novo: true } };
  if (busca.get("nova") === "parceiro") return { aba: "parceiros", editor: { entidade: "parceiro", novo: true } };
  return { aba, editor: null };
}

function urlCadastro(rota: RotaCadastro) {
  const busca = new URLSearchParams({ aba: rota.aba });
  if (rota.editor?.novo) busca.set("nova", rota.editor.entidade);
  else if (rota.editor?.id) busca.set(rota.editor.entidade, String(rota.editor.id));
  return `/financeiro/configuracoes?${busca.toString()}`;
}

function CampoFormulario({ id, label, erro, ajuda, children }: { id: string; label: string; erro?: string; ajuda?: string; children: ReactNode }) {
  return <div>
    <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
    {children}
    {erro ? <p id={`${id}-erro`} className="mt-1.5 text-xs font-medium text-red-700">{erro}</p>
      : ajuda ? <p id={`${id}-ajuda`} className="mt-1.5 text-xs leading-5 text-ink-3">{ajuda}</p> : null}
  </div>;
}

function SituacaoCadastro({ ativo, onChange }: { ativo: boolean; onChange: (ativo: boolean) => void }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-[#f7f5ed] p-4">
    <input type="checkbox" aria-label="Cadastro ativo" checked={ativo} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-green-800" />
    <span><strong className="block text-sm">Cadastro ativo</strong><span className="mt-1 block text-xs leading-5 text-ink-3">{ativo ? "Disponível para novas operações." : "Fora das novas operações, preservado no histórico."}</span></span>
  </label>;
}

function FormularioConta({ conta, onCancelar, onSalvo }: { conta?: Conta; onCancelar: () => void; onSalvo: (conta: Conta) => void }) {
  const [form, setForm] = useState({
    nome: conta?.nome ?? "", tipo: conta?.tipo ?? "BANCO", instituicao: conta?.instituicao ?? "",
    identificacao: conta?.identificacao ?? "", saldoAbertura: conta?.saldoAbertura ?? "0.00",
    dataSaldoAbertura: conta?.dataSaldoAbertura.slice(0, 10) ?? hoje(),
    incluirNoSaldoGeral: conta?.incluirNoSaldoGeral ?? true, ativo: conta?.ativo ?? true,
  });
  const [erros, setErros] = useState<CampoErros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoDesativacao, setConfirmandoDesativacao] = useState(false);
  const set = <K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const validar = () => {
    const proximos: CampoErros = {};
    if (form.nome.trim().length < 2) proximos.nome = "Informe um nome com pelo menos 2 caracteres.";
    if (form.nome.trim().length > 80) proximos.nome = "Use no máximo 80 caracteres.";
    if (form.instituicao.trim().length > 100) proximos.instituicao = "Use no máximo 100 caracteres.";
    if (form.identificacao.trim().length > 100) proximos.identificacao = "Use no máximo 100 caracteres.";
    if (form.saldoAbertura.trim() === "" || !Number.isFinite(Number(form.saldoAbertura))) proximos.saldoAbertura = "Informe um valor válido.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dataSaldoAbertura)) proximos.dataSaldoAbertura = "Informe a data do saldo de abertura.";
    setErros(proximos);
    return Object.keys(proximos).length === 0;
  };

  const persistir = async () => {
    setSalvando(true); setErroGeral(null); setConfirmandoDesativacao(false);
    try {
      const payload = {
        nome: form.nome.trim(), tipo: form.tipo, instituicao: form.instituicao.trim() || null,
        identificacao: form.identificacao.trim() || null, saldoAbertura: Number(form.saldoAbertura),
        dataSaldoAbertura: form.dataSaldoAbertura, incluirNoSaldoGeral: form.incluirNoSaldoGeral, ativo: form.ativo,
      };
      onSalvo(conta ? await atualizarConta(conta.id, payload) : await criarConta(payload));
    } catch (erro) { setErroGeral(erro instanceof Error ? erro.message : String(erro)); }
    finally { setSalvando(false); }
  };

  const salvar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!validar()) return;
    if (conta?.ativo && !form.ativo) setConfirmandoDesativacao(true);
    else void persistir();
  };

  return <>
    <form onSubmit={salvar} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {erroGeral && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erroGeral}</div>}
        <CampoFormulario id="conta-nome" label="Nome de exibição" erro={erros.nome}>
          <input id="conta-nome" autoFocus value={form.nome} onChange={(e) => set("nome", e.target.value)} aria-invalid={!!erros.nome} aria-describedby={erros.nome ? "conta-nome-erro" : undefined} className={CLASSE_CAMPO} />
        </CampoFormulario>
        <CampoFormulario id="conta-tipo" label="Tipo">
          <select id="conta-tipo" value={form.tipo} onChange={(e) => set("tipo", e.target.value as Conta["tipo"])} className={CLASSE_CAMPO}>{TIPOS_CONTA.map((tipo) => <option key={tipo.valor} value={tipo.valor}>{tipo.nome}</option>)}</select>
        </CampoFormulario>
        <CampoFormulario id="conta-instituicao" label="Instituição" erro={erros.instituicao}>
          <input id="conta-instituicao" value={form.instituicao} onChange={(e) => set("instituicao", e.target.value)} aria-invalid={!!erros.instituicao} aria-describedby={erros.instituicao ? "conta-instituicao-erro" : undefined} className={CLASSE_CAMPO} placeholder="Ex.: Banco do Brasil" />
        </CampoFormulario>
        <CampoFormulario id="conta-identificacao" label="Identificação da conta" erro={erros.identificacao} ajuda={form.tipo === "BANCO" ? "Informe agência, conta e dígito no formato usado pela instituição." : "Identificação livre para diferenciar este cadastro."}>
          <input id="conta-identificacao" value={form.identificacao} onChange={(e) => set("identificacao", e.target.value)} aria-invalid={!!erros.identificacao} aria-describedby={erros.identificacao ? "conta-identificacao-erro" : "conta-identificacao-ajuda"} className={CLASSE_CAMPO} placeholder={form.tipo === "BANCO" ? "Ag. 1234 · C/C 56789-0" : "Identificação interna"} />
        </CampoFormulario>
        <div className="grid gap-5 sm:grid-cols-2">
          <CampoFormulario id="conta-saldo" label="Saldo de abertura" erro={erros.saldoAbertura}>
            <input id="conta-saldo" type="number" step="0.01" value={form.saldoAbertura} onChange={(e) => set("saldoAbertura", e.target.value)} aria-invalid={!!erros.saldoAbertura} aria-describedby={erros.saldoAbertura ? "conta-saldo-erro" : undefined} className={CLASSE_CAMPO} />
          </CampoFormulario>
          <CampoFormulario id="conta-data-saldo" label="Data do saldo" erro={erros.dataSaldoAbertura}>
            <input id="conta-data-saldo" type="date" value={form.dataSaldoAbertura} onChange={(e) => set("dataSaldoAbertura", e.target.value)} aria-invalid={!!erros.dataSaldoAbertura} aria-describedby={erros.dataSaldoAbertura ? "conta-data-saldo-erro" : undefined} className={CLASSE_CAMPO} />
          </CampoFormulario>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
          <input type="checkbox" aria-label="Incluir no saldo geral" checked={form.incluirNoSaldoGeral} onChange={(e) => set("incluirNoSaldoGeral", e.target.checked)} className="mt-0.5 h-4 w-4 accent-green-800" />
          <span><strong className="block text-sm">Incluir no saldo geral</strong><span className="mt-1 block text-xs leading-5 text-ink-3">Soma o saldo atual desta conta aos indicadores consolidados.</span></span>
        </label>
        <SituacaoCadastro ativo={form.ativo} onChange={(ativo) => set("ativo", ativo)} />
        {conta && <p className="rounded-lg bg-[#eef1e9] p-3 text-xs leading-5 text-green-900">Editar este cadastro não altera nem remove seus movimentos. Correções no saldo de abertura são registradas na auditoria.</p>}
      </div>
      <SheetFooter className="shrink-0 border-t border-border bg-white p-4">
        <Button secondary onClick={onCancelar}>Cancelar</Button><Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar conta"}</Button>
      </SheetFooter>
    </form>
    <ConfirmDialog open={confirmandoDesativacao} title="Desativar conta?" message={<>A conta <strong>{form.nome || conta?.nome}</strong> deixará de aparecer em novas operações. Movimentos, transações e saldos históricos continuarão preservados.</>} confirmLabel="Desativar conta" tone="danger" onCancel={() => setConfirmandoDesativacao(false)} onConfirm={() => { void persistir(); }} />
  </>;
}

function FormularioParceiro({ parceiro, onCancelar, onSalvo }: { parceiro?: Parceiro; onCancelar: () => void; onSalvo: (parceiro: Parceiro) => void }) {
  const [form, setForm] = useState({
    nome: parceiro?.nome ?? "", documento: parceiro?.documento ?? "", tipo: parceiro?.tipo ?? "FORNECEDOR",
    telefone: parceiro?.telefone ?? "", email: parceiro?.email ?? "", ativo: parceiro?.ativo ?? true,
  });
  const [erros, setErros] = useState<CampoErros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoDesativacao, setConfirmandoDesativacao] = useState(false);
  const set = <K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const validar = () => {
    const proximos: CampoErros = {};
    if (form.nome.trim().length < 2) proximos.nome = "Informe um nome ou razão social com pelo menos 2 caracteres.";
    if (form.nome.trim().length > 120) proximos.nome = "Use no máximo 120 caracteres.";
    if (form.documento.trim() && !documentoFiscalValido(form.documento)) proximos.documento = "Informe um CPF ou CNPJ válido.";
    if (form.documento.trim().length > 30) proximos.documento = "Use no máximo 30 caracteres.";
    if (form.telefone.trim().length > 30) proximos.telefone = "Use no máximo 30 caracteres.";
    if (form.email.trim() && !emailValido(form.email.trim())) proximos.email = "Informe um e-mail válido.";
    if (form.email.trim().length > 120) proximos.email = "Use no máximo 120 caracteres.";
    setErros(proximos);
    return Object.keys(proximos).length === 0;
  };

  const persistir = async () => {
    setSalvando(true); setErroGeral(null); setConfirmandoDesativacao(false);
    try {
      const payload = {
        nome: form.nome.trim(), documento: form.documento.trim() || null, tipo: form.tipo,
        telefone: form.telefone.trim() || null, email: form.email.trim() || null, ativo: form.ativo,
      };
      onSalvo(parceiro ? await atualizarParceiro(parceiro.id, payload) : await criarParceiro(payload));
    } catch (erro) { setErroGeral(erro instanceof Error ? erro.message : String(erro)); }
    finally { setSalvando(false); }
  };

  const salvar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!validar()) return;
    if (parceiro?.ativo && !form.ativo) setConfirmandoDesativacao(true);
    else void persistir();
  };

  return <>
    <form onSubmit={salvar} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {erroGeral && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erroGeral}</div>}
        <CampoFormulario id="parceiro-nome" label="Nome ou razão social" erro={erros.nome}>
          <input id="parceiro-nome" autoFocus value={form.nome} onChange={(e) => set("nome", e.target.value)} aria-invalid={!!erros.nome} aria-describedby={erros.nome ? "parceiro-nome-erro" : undefined} className={CLASSE_CAMPO} />
        </CampoFormulario>
        <CampoFormulario id="parceiro-documento" label="CPF/CNPJ" erro={erros.documento}>
          <input id="parceiro-documento" inputMode="numeric" value={form.documento} onChange={(e) => set("documento", e.target.value)} aria-invalid={!!erros.documento} aria-describedby={erros.documento ? "parceiro-documento-erro" : undefined} className={CLASSE_CAMPO} placeholder="000.000.000-00 ou 00.000.000/0000-00" />
        </CampoFormulario>
        <CampoFormulario id="parceiro-tipo" label="Papel">
          <select id="parceiro-tipo" value={form.tipo} onChange={(e) => set("tipo", e.target.value)} className={CLASSE_CAMPO}>{TIPOS_PARCEIRO.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}</select>
        </CampoFormulario>
        <CampoFormulario id="parceiro-telefone" label="Telefone" erro={erros.telefone}>
          <input id="parceiro-telefone" type="tel" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} aria-invalid={!!erros.telefone} aria-describedby={erros.telefone ? "parceiro-telefone-erro" : undefined} className={CLASSE_CAMPO} placeholder="(00) 00000-0000" />
        </CampoFormulario>
        <CampoFormulario id="parceiro-email" label="E-mail" erro={erros.email}>
          <input id="parceiro-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!erros.email} aria-describedby={erros.email ? "parceiro-email-erro" : undefined} className={CLASSE_CAMPO} placeholder="contato@empresa.com.br" />
        </CampoFormulario>
        <SituacaoCadastro ativo={form.ativo} onChange={(ativo) => set("ativo", ativo)} />
        {parceiro && <p className="rounded-lg bg-[#eef1e9] p-3 text-xs leading-5 text-green-900">Operações, compromissos e transações já vinculados continuarão identificados por este cadastro.</p>}
      </div>
      <SheetFooter className="shrink-0 border-t border-border bg-white p-4">
        <Button secondary onClick={onCancelar}>Cancelar</Button><Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar parceiro"}</Button>
      </SheetFooter>
    </form>
    <ConfirmDialog open={confirmandoDesativacao} title="Desativar parceiro?" message={<>O parceiro <strong>{form.nome || parceiro?.nome}</strong> deixará de aparecer em novas operações. Seus vínculos e sua identificação no histórico serão mantidos.</>} confirmLabel="Desativar parceiro" tone="danger" onCancel={() => setConfirmandoDesativacao(false)} onConfirm={() => { void persistir(); }} />
  </>;
}

function ordenarCadastros<T extends { nome: string; ativo: boolean }>(itens: T[]) {
  return [...itens].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function ConfiguracoesFinanceiras() {
  const [config, setConfig] = useState<Config | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rota, setRota] = useState<RotaCadastro>(lerRotaCadastro);
  const [confirmando, setConfirmando] = useState<Conta | Parceiro | null>(null);
  const [alternando, setAlternando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try { setConfig(await obterConfiguracoesFinanceiras()); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const voltarOuAvancar = () => setRota(lerRotaCadastro());
    window.addEventListener("popstate", voltarOuAvancar);
    return () => window.removeEventListener("popstate", voltarOuAvancar);
  }, []);

  const navegar = (proxima: RotaCadastro, substituir = false) => {
    window.history[substituir ? "replaceState" : "pushState"](null, "", urlCadastro(proxima));
    setRota(proxima);
  };
  const fecharPainel = () => navegar({ aba: rota.aba, editor: null }, true);

  if (!config) return <PaginaSemDados titulo="Configurações financeiras" descricao="Cadastros que sustentam as operações. Desativar preserva todo o histórico e permite reativação." label="Carregando configurações financeiras" erro={erro} />;

  const contaSelecionada = rota.editor?.entidade === "conta" && rota.editor.id ? config.contas.find((conta) => conta.id === rota.editor!.id) : undefined;
  const parceiroSelecionado = rota.editor?.entidade === "parceiro" && rota.editor.id ? config.parceiros.find((parceiro) => parceiro.id === rota.editor!.id) : undefined;
  const painelAberto = !!rota.editor && (!!rota.editor.novo || !!contaSelecionada || !!parceiroSelecionado);

  const abrirNovo = () => navegar({ aba: rota.aba, editor: { entidade: rota.aba === "contas" ? "conta" : "parceiro", novo: true } });
  const abrirConta = (conta: Conta) => navegar({ aba: "contas", editor: { entidade: "conta", id: conta.id } });
  const abrirParceiro = (parceiro: Parceiro) => navegar({ aba: "parceiros", editor: { entidade: "parceiro", id: parceiro.id } });

  const atualizarContaLocal = (conta: Conta) => setConfig((atual) => atual ? { ...atual, contas: ordenarCadastros([...atual.contas.filter((item) => item.id !== conta.id), conta]) } : atual);
  const atualizarParceiroLocal = (parceiro: Parceiro) => setConfig((atual) => atual ? { ...atual, parceiros: ordenarCadastros([...atual.parceiros.filter((item) => item.id !== parceiro.id), parceiro]) } : atual);
  const salvoConta = (conta: Conta) => { atualizarContaLocal(conta); fecharPainel(); };
  const salvoParceiro = (parceiro: Parceiro) => { atualizarParceiroLocal(parceiro); fecharPainel(); };

  const alternarSituacao = async (item: Conta | Parceiro) => {
    setAlternando(true); setErro(null);
    try {
      if (rota.aba === "contas") atualizarContaLocal(await atualizarConta(item.id, { ativo: !item.ativo }));
      else atualizarParceiroLocal(await atualizarParceiro(item.id, { ativo: !item.ativo }));
      setConfirmando(null);
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); setConfirmando(null); }
    finally { setAlternando(false); }
  };
  const solicitarAlternancia = (item: Conta | Parceiro) => item.ativo ? setConfirmando(item) : void alternarSituacao(item);

  const acoesConta = (conta: Conta) => <div className="flex flex-wrap items-center justify-end gap-2">
    <button type="button" onClick={() => abrirConta(conta)} aria-label={`Editar conta ${conta.nome}`} title="Editar conta" className="rounded-lg border border-border p-2 text-ink-3 hover:bg-white hover:text-green-800"><Pencil size={15} /></button>
    <button type="button" onClick={() => solicitarAlternancia(conta)} className={`px-1 py-2 text-xs font-semibold ${conta.ativo ? "text-red-700" : "text-green-800"}`}>{conta.ativo ? "Desativar" : "Reativar"}</button>
  </div>;
  const acoesParceiro = (parceiro: Parceiro) => <div className="flex flex-wrap items-center justify-end gap-2">
    <button type="button" onClick={() => abrirParceiro(parceiro)} aria-label={`Editar parceiro ${parceiro.nome}`} title="Editar parceiro" className="rounded-lg border border-border p-2 text-ink-3 hover:bg-white hover:text-green-800"><Pencil size={15} /></button>
    <button type="button" onClick={() => solicitarAlternancia(parceiro)} className={`px-1 py-2 text-xs font-semibold ${parceiro.ativo ? "text-red-700" : "text-green-800"}`}>{parceiro.ativo ? "Desativar" : "Reativar"}</button>
  </div>;
  const colunasContas: ColunaTabela<Conta>[] = [
    { chave: "conta", titulo: "Conta", larguraMinima: 230, principal: true, celula: (c) => <><strong className="break-words">{c.nome}</strong><div className="mt-1 break-words text-xs text-ink-3">{[c.instituicao, c.identificacao].filter(Boolean).join(" · ") || "Sem identificação adicional"}</div></> },
    { chave: "tipo", titulo: "Tipo", larguraMinima: 110, celula: (c) => <span className="whitespace-nowrap">{NOME_TIPO_CONTA[c.tipo]}</span> },
    { chave: "abertura", titulo: "Abertura", alinhamento: "direita", larguraMinima: 135, celula: (c) => <><span className="whitespace-nowrap">{brl(c.saldoAbertura)}</span><div className="whitespace-nowrap text-xs text-ink-3">{dataBR(c.dataSaldoAbertura)}</div></> },
    { chave: "saldo", titulo: "Saldo atual", alinhamento: "direita", larguraMinima: 130, celula: (c) => <strong className="whitespace-nowrap font-semibold">{brl(c.saldoAtual)}</strong> },
    { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 90, celula: (c) => <Pill tone={c.ativo ? "green" : "neutral"}>{c.ativo ? "Ativa" : "Inativa"}</Pill> },
    { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 160, acao: true, celula: acoesConta },
  ];
  const colunasParceiros: ColunaTabela<Parceiro>[] = [
    { chave: "nome", titulo: "Nome", larguraMinima: 220, principal: true, celula: (p) => <strong className="break-words font-semibold">{p.nome}</strong> },
    { chave: "documento", titulo: "Documento", larguraMinima: 145, celula: (p) => <span className="whitespace-nowrap">{p.documento || "—"}</span> },
    { chave: "papel", titulo: "Papel", larguraMinima: 145, celula: (p) => <span className="break-words">{NOME_TIPO_PARCEIRO[p.tipo] ?? p.tipo.replaceAll("_", " ")}</span> },
    { chave: "contato", titulo: "Contato", larguraMinima: 200, celula: (p) => <span className="break-words text-ink-3">{p.telefone || p.email ? <>{p.telefone || "—"}{p.email && <span className="block">{p.email}</span>}</> : "—"}</span> },
    { chave: "situacao", titulo: "Situação", alinhamento: "direita", larguraMinima: 90, celula: (p) => <Pill tone={p.ativo ? "green" : "neutral"}>{p.ativo ? "Ativo" : "Inativo"}</Pill> },
    { chave: "acoes", titulo: "Ações", alinhamento: "direita", larguraMinima: 160, acao: true, celula: acoesParceiro },
  ];

  const itemConfirmando = confirmando;
  return <PaginaFinanceira>
    <PageHeader titulo="Configurações financeiras" descricao="Cadastros que sustentam as operações. Desativar preserva todo o histórico e permite reativação." acao={<Button onClick={abrirNovo}><Plus size={16} /> {rota.aba === "contas" ? "Nova conta" : "Novo parceiro"}</Button>} />
    <ErrorBox erro={erro} />
    <div className="mt-6 flex gap-2 overflow-x-auto border-b border-border">{([["contas", "Contas financeiras", Building2], ["parceiros", "Clientes e fornecedores", Users]] as const).map(([aba, label, Icon]) => <button key={aba} onClick={() => navegar({ aba, editor: null })} className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${rota.aba === aba ? "border-mast text-ink" : "border-transparent text-ink-3"}`}><Icon size={16} className="shrink-0" />{label}</button>)}</div>
    <Panel className="mt-5 overflow-hidden">{rota.aba === "contas"
      ? <TabelaFinanceira rotulo="Contas financeiras" itens={config.contas} colunas={colunasContas} chaveDe={(conta) => conta.id} onAbrir={abrirConta} classeLinha={(conta) => !conta.ativo ? "opacity-55" : ""} />
      : <TabelaFinanceira rotulo="Clientes e fornecedores" itens={config.parceiros} colunas={colunasParceiros} chaveDe={(parceiro) => parceiro.id} onAbrir={abrirParceiro} classeLinha={(parceiro) => !parceiro.ativo ? "opacity-55" : ""} />}
    </Panel>

    <Sheet open={painelAberto} onOpenChange={(aberto) => { if (!aberto) fecharPainel(); }}>
      <SheetContent side="right" className="!w-full gap-0 overflow-hidden p-0 sm:!max-w-xl">
        <SheetHeader className="shrink-0 border-b border-border bg-[#f4f2e9] px-6 py-5 pr-14">
          <div className="eyebrow">{rota.editor?.novo ? "Novo cadastro" : "Detalhe e edição"}</div>
          <SheetTitle>{rota.editor?.entidade === "conta" ? (contaSelecionada ? `Editar ${contaSelecionada.nome}` : "Nova conta") : (parceiroSelecionado ? `Editar ${parceiroSelecionado.nome}` : "Novo parceiro")}</SheetTitle>
          <SheetDescription>{rota.editor?.entidade === "conta" ? "Dados da conta financeira e composição do saldo geral." : "Identificação, papel e contatos do cliente ou fornecedor."}</SheetDescription>
        </SheetHeader>
        {rota.editor?.entidade === "conta" && <FormularioConta key={contaSelecionada?.id ?? "nova-conta"} conta={contaSelecionada} onCancelar={fecharPainel} onSalvo={salvoConta} />}
        {rota.editor?.entidade === "parceiro" && <FormularioParceiro key={parceiroSelecionado?.id ?? "novo-parceiro"} parceiro={parceiroSelecionado} onCancelar={fecharPainel} onSalvo={salvoParceiro} />}
      </SheetContent>
    </Sheet>

    <ConfirmDialog open={!!itemConfirmando} title={rota.aba === "contas" ? "Desativar conta?" : "Desativar parceiro?"} message={itemConfirmando && <>O cadastro <strong>{itemConfirmando.nome}</strong> deixará de aparecer em novas operações. Operações, compromissos, transações e movimentos existentes continuarão preservados e identificados.</>} confirmLabel={alternando ? "Desativando…" : "Desativar"} tone="danger" onCancel={() => { if (!alternando) setConfirmando(null); }} onConfirm={() => { if (itemConfirmando && !alternando) void alternarSituacao(itemConfirmando); }} />
  </PaginaFinanceira>;
}
