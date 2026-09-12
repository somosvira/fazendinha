import { FormEvent, useRef, useState } from "react";
import { ApiError, atualizarConta, criarConta, type Conta, type ContaPatch, type TipoConta, type TipoBancario } from "./novo-api";
import { CamposCadastro } from "./CamposCadastro";
import { Button, ErrorBox, hoje } from "./financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "./PainelCadastro";
import { validarConta, type ErrosCampo } from "./lib/validacao";

export const TIPO_CONTA: Record<TipoConta, string> = { BANCO: "Conta bancária", CAIXA: "Caixa físico", APLICACAO: "Aplicação financeira" };
const CAMPOS_BANCO = [["agencia", "Agência", 20], ["numeroConta", "Número da conta", 30], ["digito", "Dígito", 5], ["titular", "Titular", 120]] as const;
const CAMPOS_CAIXA = [["local", "Local", 120], ["responsavel", "Responsável", 120]] as const;

/* `conta === null` é criação. No PATCH só vão os campos que mudaram; saldo e
 * data de abertura nunca vão quando a conta já tem movimentos (o servidor
 * também recusa — aqui é só para a UI não oferecer o que não pode). */
export function FormConta({ conta, aberto, onSalvo, onFechar }: { conta: Conta | null; aberto: boolean; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const aberturaEditavel = !conta?.temMovimentos;
  const [nome, setNome] = useState(conta?.nome ?? "");
  const [tipo, setTipo] = useState<TipoConta>(conta?.tipo ?? "BANCO");
  const [instituicao, setInstituicao] = useState(conta?.instituicao ?? "");
  const [identificacao, setIdentificacao] = useState(conta?.identificacao ?? "");
  const [saldoAbertura, setSaldoAbertura] = useState(conta ? String(Number(conta.saldoAbertura)) : "0");
  const [dataSaldoAbertura, setDataSaldoAbertura] = useState(conta?.dataSaldoAbertura.slice(0, 10) ?? hoje());
  const [incluirNoSaldoGeral, setIncluirNoSaldoGeral] = useState(conta?.incluirNoSaldoGeral ?? true);
  const [erros, setErros] = useState<ErrosCampo>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const [tipoBancario, setTipoBancario] = useState<TipoBancario | "">(conta?.tipoBancario ?? "");
  const [extras, setExtras] = useState({ agencia: conta?.agencia ?? "", numeroConta: conta?.numeroConta ?? "", digito: conta?.digito ?? "", titular: conta?.titular ?? "", local: conta?.local ?? "", responsavel: conta?.responsavel ?? "", observacoes: conta?.observacoes ?? "" });
  const [ordem, setOrdem] = useState(String(conta?.ordem ?? 0));

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    const validacao = validarConta({ nome, saldoAbertura, dataSaldoAbertura }, { aberturaEditavel });
    if (tipo !== "CAIXA" && !instituicao.trim()) validacao.instituicao = "Informe a instituição financeira";
    if (!/^\d{1,4}$/.test(ordem)) validacao.ordem = "Informe uma ordem de 0 a 9999";
    setErros(validacao); setErroGeral(null);
    if (Object.keys(validacao).length) return;
    const texto = (v: string) => (v.trim() === "" ? null : v.trim());
    emCurso.current = true; setSalvando(true);
    const adicionais = { ...Object.fromEntries(Object.entries(extras).map(([k, v]) => [k, texto(v)])), tipoBancario: tipoBancario || null, ordem: Number(ordem) };
    try {
      if (!conta) {
        await criarConta({ ...adicionais, nome: nome.trim(), tipo, instituicao: texto(instituicao), identificacao: texto(identificacao), saldoAbertura: Number(saldoAbertura), dataSaldoAbertura, incluirNoSaldoGeral });
      } else {
        const patch: ContaPatch = {};
        Object.assign(patch, Object.fromEntries(Object.entries(adicionais).filter(([k, v]) => v !== (conta[k as keyof Conta] ?? (k === "ordem" ? 0 : null)))));
        if (nome.trim() !== conta.nome) patch.nome = nome.trim();
        if (tipo !== conta.tipo) patch.tipo = tipo;
        if (texto(instituicao) !== conta.instituicao) patch.instituicao = texto(instituicao);
        if (texto(identificacao) !== conta.identificacao) patch.identificacao = texto(identificacao);
        if (incluirNoSaldoGeral !== conta.incluirNoSaldoGeral) patch.incluirNoSaldoGeral = incluirNoSaldoGeral;
        if (aberturaEditavel) {
          if (Number(saldoAbertura) !== Number(conta.saldoAbertura)) patch.saldoAbertura = Number(saldoAbertura);
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
      <CampoFormulario id="conta-tipo" rotulo="Tipo" obrigatorio>{(p) => <select {...p} required value={tipo} onChange={(e) => setTipo(e.target.value as TipoConta)} className={classeInput}>{(Object.keys(TIPO_CONTA) as TipoConta[]).map((t) => <option key={t} value={t}>{TIPO_CONTA[t]}</option>)}</select>}</CampoFormulario>
      {tipo !== "CAIXA" && <CampoFormulario id="conta-instituicao" rotulo="Instituição" obrigatorio erro={erros.instituicao}>{(p) => <input {...p} required maxLength={100} value={instituicao} onChange={(e) => setInstituicao(e.target.value)} placeholder="Ex.: Sicoob, Banco do Brasil" className={classeInput} />}</CampoFormulario>}
      {tipo === "BANCO" && <>
        <CampoFormulario id="conta-tipo-bancario" rotulo="Tipo bancário">{(p) => <select {...p} value={tipoBancario} onChange={(e) => setTipoBancario(e.target.value as TipoBancario | "")} className={classeInput}><option value="">Não informado</option><option value="CORRENTE">Conta corrente</option><option value="POUPANCA">Poupança</option><option value="PAGAMENTO">Conta de pagamento</option></select>}</CampoFormulario>
        <CamposCadastro prefixo="conta" campos={CAMPOS_BANCO} valores={extras} onChange={(k, v) => setExtras((s) => ({ ...s, [k]: v }))} erros={erros} />
      </>}
      {tipo === "CAIXA" && <CamposCadastro prefixo="conta" campos={CAMPOS_CAIXA} valores={extras} onChange={(k, v) => setExtras((s) => ({ ...s, [k]: v }))} erros={erros} />}
      <CampoFormulario id="conta-identificacao" rotulo="Identificação da conta" erro={erros.identificacao} ajuda="Agência, número da conta ou qualquer referência que ajude a reconhecer a conta.">{(p) => <input {...p} value={identificacao} onChange={(e) => setIdentificacao(e.target.value)} placeholder="Ex.: Ag. 1234 · C/C 56789-0" className={classeInput} />}</CampoFormulario>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="conta-saldo" rotulo="Saldo de abertura" obrigatorio erro={erros.saldoAbertura}>{(p) => <input {...p} required type="number" step="0.01" disabled={!aberturaEditavel} value={saldoAbertura} onChange={(e) => setSaldoAbertura(e.target.value)} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="conta-data" rotulo="Data do saldo de abertura" obrigatorio erro={erros.dataSaldoAbertura}>{(p) => <input {...p} required type="date" disabled={!aberturaEditavel} value={dataSaldoAbertura} onChange={(e) => setDataSaldoAbertura(e.target.value)} className={classeInput} />}</CampoFormulario>
      </div>
      {!aberturaEditavel && <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-ink-2">Esta conta já possui movimentos; saldo e data de abertura não podem mais ser alterados.</p>}
      <label className="flex items-start gap-3 text-sm font-medium"><input type="checkbox" aria-label="Incluir no saldo geral" checked={incluirNoSaldoGeral} onChange={(e) => setIncluirNoSaldoGeral(e.target.checked)} className="mt-1" /><span>Incluir no saldo geral<span className="block text-xs font-normal text-ink-3">Contas fora do saldo geral continuam com extrato próprio.</span></span></label>
      <CampoFormulario id="conta-ordem" rotulo="Ordem de exibição" erro={erros.ordem}>{(p) => <input {...p} type="number" min="0" max="9999" step="1" value={ordem} onChange={(e) => setOrdem(e.target.value)} className={classeInput} />}</CampoFormulario>
      <CampoFormulario id="conta-observacoes" rotulo="Observação / finalidade" erro={erros.observacoes}>{(p) => <textarea {...p} maxLength={1000} value={extras.observacoes} onChange={(e) => setExtras((s) => ({ ...s, observacoes: e.target.value }))} className={classeInput} />}</CampoFormulario>
    </form>
  </PainelCadastro>;
}
