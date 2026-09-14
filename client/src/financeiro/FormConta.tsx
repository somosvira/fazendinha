import { FormEvent, useRef, useState } from "react";
import { newEntityId } from "@fazendinha/shared";
import { ApiError, atualizarConta, criarConta, type Conta, type ContaPatch, type TipoConta, type TipoBancario } from "./novo-api";
import { CamposCadastro } from "./CamposCadastro";
import { Button, ErrorBox, hoje } from "./financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "./PainelCadastro";
import { formatarValorMonetario, validarConta, valorMonetario, type ErrosCampo } from "./lib/validacao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const TIPO_CONTA: Record<TipoConta, string> = { BANCO: "Conta bancária", CAIXA: "Caixa físico", APLICACAO: "Aplicação financeira" };
const CAMPOS_CAIXA = [["local", "Local", 120, "Ex.: Cofre do escritório"], ["responsavel", "Responsável", 120, "Ex.: Maria Oliveira"]] as const;

/* `conta === null` é criação. No PATCH só vão os campos que mudaram; saldo e
 * data de abertura nunca vão quando a conta já tem movimentos (o servidor
 * também recusa — aqui é só para a UI não oferecer o que não pode). */
export function FormConta({ conta, aberto, ordemInicial = 0, onSalvo, onFechar }: { conta: Conta | null; aberto: boolean; ordemInicial?: number; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const aberturaEditavel = !conta?.temMovimentos;
  const [nome, setNome] = useState(conta?.nome ?? "");
  const [tipo, setTipo] = useState<TipoConta>(conta?.tipo ?? "BANCO");
  const [instituicao, setInstituicao] = useState(conta?.instituicao ?? "");
  const [identificacao, setIdentificacao] = useState(conta?.identificacao ?? "");
  const [saldoAbertura, setSaldoAbertura] = useState(formatarValorMonetario(conta?.saldoAbertura ?? "0"));
  const [dataSaldoAbertura, setDataSaldoAbertura] = useState(conta?.dataSaldoAbertura.slice(0, 10) ?? hoje());
  const [incluirNoSaldoGeral, setIncluirNoSaldoGeral] = useState(conta?.incluirNoSaldoGeral ?? true);
  const [erros, setErros] = useState<ErrosCampo>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const [novoId] = useState(() => newEntityId());
  const [tipoBancario, setTipoBancario] = useState<TipoBancario | "">(conta?.tipoBancario ?? "");
  const [extras, setExtras] = useState({ agencia: conta?.agencia ?? "", numeroConta: conta?.numeroConta ?? "", digito: conta?.digito ?? "", titular: conta?.titular ?? "", local: conta?.local ?? "", responsavel: conta?.responsavel ?? "", observacoes: conta?.observacoes ?? "" });

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    const validacao = validarConta({ nome, saldoAbertura, dataSaldoAbertura, tipo, instituicao, agencia: extras.agencia, numeroConta: extras.numeroConta, titular: extras.titular }, { aberturaEditavel });
    setErros(validacao); setErroGeral(null);
    if (Object.keys(validacao).length) return;
    const texto = (v: string) => (v.trim() === "" ? null : v.trim());
    emCurso.current = true; setSalvando(true);
    const adicionais = { ...Object.fromEntries(Object.entries(extras).map(([k, v]) => [k, texto(v)])), tipoBancario: tipoBancario || null };
    try {
      if (!conta) {
        await criarConta({ id: novoId, ...adicionais, nome: nome.trim(), tipo, instituicao: texto(instituicao), identificacao: texto(identificacao), saldoAbertura: valorMonetario(saldoAbertura), dataSaldoAbertura, incluirNoSaldoGeral, ordem: ordemInicial });
      } else {
        const patch: ContaPatch = {};
        Object.assign(patch, Object.fromEntries(Object.entries(adicionais).filter(([k, v]) => v !== (conta[k as keyof Conta] ?? null))));
        if (nome.trim() !== conta.nome) patch.nome = nome.trim();
        if (tipo !== conta.tipo) patch.tipo = tipo;
        if (texto(instituicao) !== conta.instituicao) patch.instituicao = texto(instituicao);
        if (texto(identificacao) !== conta.identificacao) patch.identificacao = texto(identificacao);
        if (incluirNoSaldoGeral !== conta.incluirNoSaldoGeral) patch.incluirNoSaldoGeral = incluirNoSaldoGeral;
        if (aberturaEditavel) {
          if (valorMonetario(saldoAbertura) !== Number(conta.saldoAbertura)) patch.saldoAbertura = valorMonetario(saldoAbertura);
          if (dataSaldoAbertura !== conta.dataSaldoAbertura.slice(0, 10)) patch.dataSaldoAbertura = dataSaldoAbertura;
        }
        if (Object.keys(patch).length) await atualizarConta(conta.id, patch);
      }
      await onSalvo();
    } catch (e) {
      if (e instanceof ApiError && e.campo) setErros({ [e.campo]: e.message });
      else setErroGeral(e instanceof Error ? e.message : String(e));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-conta";
  return <PainelCadastro aberto={aberto} eyebrow="Conta financeira" titulo={conta ? `Editar ${conta.nome}` : "Nova conta"} onFechar={() => { if (!emCurso.current) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : conta ? "Salvar conta" : "Criar conta"}</Button></>}>
    <form id={formId} onSubmit={submeter} noValidate className="grid gap-4">
      <p className="text-sm text-ink-3">* Campos obrigatórios</p>
      <ErrorBox erro={erroGeral} />
      <CampoFormulario id="conta-nome" rotulo="Nome de exibição" obrigatorio erro={erros.nome}>{(p) => <input {...p} required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} className={classeInput} />}</CampoFormulario>
      <CampoFormulario id="conta-tipo" rotulo="Tipo" obrigatorio>{(p) => <Select value={tipo} onValueChange={(v) => setTipo(v as TipoConta)}><SelectTrigger id={p.id} aria-label={p["aria-label"]} aria-invalid={p["aria-invalid"]} aria-describedby={p["aria-describedby"]} className={`${classeInput} flex`}><SelectValue /></SelectTrigger><SelectContent className="z-[1200]">{(Object.keys(TIPO_CONTA) as TipoConta[]).map((t) => <SelectItem key={t} value={t}>{TIPO_CONTA[t]}</SelectItem>)}</SelectContent></Select>}</CampoFormulario>
      {tipo !== "CAIXA" && <CampoFormulario id="conta-instituicao" rotulo="Instituição" obrigatorio erro={erros.instituicao}>{(p) => <input {...p} required maxLength={100} value={instituicao} onChange={(e) => setInstituicao(e.target.value)} placeholder="Ex.: Sicoob, Banco do Brasil" className={classeInput} />}</CampoFormulario>}
      {tipo === "BANCO" && <>
        <CampoFormulario id="conta-tipo-bancario" rotulo="Tipo bancário">{(p) => <Select value={tipoBancario || "NAO_INFORMADO"} onValueChange={(v) => setTipoBancario(v === "NAO_INFORMADO" ? "" : v as TipoBancario)}><SelectTrigger id={p.id} aria-label={p["aria-label"]} className={`${classeInput} flex`}><SelectValue /></SelectTrigger><SelectContent className="z-[1200]"><SelectItem value="NAO_INFORMADO">Não informado</SelectItem><SelectItem value="CORRENTE">Conta corrente</SelectItem><SelectItem value="POUPANCA">Poupança</SelectItem><SelectItem value="PAGAMENTO">Conta de pagamento</SelectItem></SelectContent></Select>}</CampoFormulario>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoFormulario id="conta-agencia" rotulo="Agência" obrigatorio erro={erros.agencia}>{(p) => <input {...p} required maxLength={20} value={extras.agencia} onChange={(e) => setExtras((s) => ({ ...s, agencia: e.target.value }))} className={classeInput} />}</CampoFormulario>
          <CampoFormulario id="conta-numeroConta" rotulo="Número da conta" obrigatorio erro={erros.numeroConta}>{(p) => <input {...p} required maxLength={30} value={extras.numeroConta} onChange={(e) => setExtras((s) => ({ ...s, numeroConta: e.target.value }))} className={classeInput} />}</CampoFormulario>
          <CampoFormulario id="conta-digito" rotulo="Dígito" erro={erros.digito}>{(p) => <input {...p} maxLength={5} value={extras.digito} onChange={(e) => setExtras((s) => ({ ...s, digito: e.target.value }))} className={classeInput} />}</CampoFormulario>
          <CampoFormulario id="conta-titular" rotulo="Titular" obrigatorio erro={erros.titular}>{(p) => <input {...p} required maxLength={120} value={extras.titular} onChange={(e) => setExtras((s) => ({ ...s, titular: e.target.value.replace(/\d/g, "") }))} className={classeInput} />}</CampoFormulario>
        </div>
      </>}
      {tipo === "CAIXA" && <CamposCadastro prefixo="conta" campos={CAMPOS_CAIXA} valores={extras} onChange={(k, v) => setExtras((s) => ({ ...s, [k]: v }))} erros={erros} />}
      <CampoFormulario id="conta-identificacao" rotulo="Identificação da conta" erro={erros.identificacao} ajuda="Agência, número da conta ou qualquer referência que ajude a reconhecer a conta.">{(p) => <input {...p} value={identificacao} onChange={(e) => setIdentificacao(e.target.value)} placeholder="Ex.: Ag. 1234 · C/C 56789-0" className={classeInput} />}</CampoFormulario>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="conta-saldo" rotulo="Saldo de abertura" obrigatorio erro={erros.saldoAbertura}>{(p) => <div className={`mt-1.5 flex overflow-hidden rounded-lg border bg-white transition focus-within:border-[#6f7d68] focus-within:ring-2 focus-within:ring-[#6f7d68]/15 ${erros.saldoAbertura ? "border-red-700" : "border-border"} ${!aberturaEditavel ? "bg-surface-2 text-ink-3" : ""}`}><span aria-hidden="true" className="inline-flex shrink-0 items-center pl-3 text-sm font-normal text-ink-3">R$</span><input {...p} data-slot="input" required inputMode="decimal" disabled={!aberturaEditavel} value={saldoAbertura} onChange={(e) => { const v = e.target.value; if (/^-?[\d.]*,?\d{0,2}$/.test(v)) setSaldoAbertura(v); }} onFocus={() => setSaldoAbertura((atual) => atual.replace(/\./g, ""))} onBlur={() => setSaldoAbertura(formatarValorMonetario(saldoAbertura))} className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2.5 font-normal outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none disabled:cursor-not-allowed" /></div>}</CampoFormulario>
        <CampoFormulario id="conta-data" rotulo="Data do saldo de abertura" obrigatorio erro={erros.dataSaldoAbertura}>{(p) => <input {...p} required type="date" disabled={!aberturaEditavel} value={dataSaldoAbertura} onChange={(e) => setDataSaldoAbertura(e.target.value)} className={classeInput} />}</CampoFormulario>
      </div>
      {!aberturaEditavel && <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-ink-2">Esta conta já possui movimentos; saldo e data de abertura não podem mais ser alterados.</p>}
      <label className="flex items-start gap-3 text-sm font-medium"><input type="checkbox" aria-label="Incluir no saldo geral" checked={incluirNoSaldoGeral} onChange={(e) => setIncluirNoSaldoGeral(e.target.checked)} className="mt-1" /><span>Incluir no saldo geral<span className="block text-xs font-normal text-ink-3">Contas fora do saldo geral continuam com extrato próprio.</span></span></label>
      <CampoFormulario id="conta-observacoes" rotulo="Observação / finalidade" erro={erros.observacoes}>{(p) => <textarea {...p} maxLength={1000} value={extras.observacoes} onChange={(e) => setExtras((s) => ({ ...s, observacoes: e.target.value }))} className={classeInput} />}</CampoFormulario>
    </form>
  </PainelCadastro>;
}
