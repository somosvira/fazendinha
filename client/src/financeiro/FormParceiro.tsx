import { FormEvent, useRef, useState } from "react";
import { newEntityId } from "@fazendinha/shared";
import { ApiError, atualizarParceiro, criarParceiro, type Parceiro, type ParceiroPatch, type PapelParceiro } from "./novo-api";
import { CamposCadastro } from "./CamposCadastro";
import { PAPEIS_PARCEIRO, papeisDoParceiro, FORMAS_PAGAMENTO } from "./lib/parceiros";
import { Button, ErrorBox } from "./financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "./PainelCadastro";
import { formatarDocumento, somenteDigitos, validarDocumento, validarParceiro, type ErrosCampo } from "./lib/validacao";

const ENDERECO = [["cep", "CEP", 9], ["logradouro", "Logradouro", 160], ["numero", "Número", 20], ["complemento", "Complemento", 100], ["bairro", "Bairro", 100], ["cidade", "Cidade", 100], ["uf", "UF", 2], ["referencia", "Referência", 240]] as const;

/* `parceiro === null` é criação. Documento vai ao servidor só em dígitos. */
export function FormParceiro({ parceiro, aberto, onSalvo, onFechar }: { parceiro: Parceiro | null; aberto: boolean; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const [nome, setNome] = useState(parceiro?.nome ?? "");
  const [documento, setDocumento] = useState(formatarDocumento(parceiro?.documento));
  const [papeis, setPapeis] = useState<PapelParceiro[]>(parceiro ? papeisDoParceiro(parceiro) : ["FORNECEDOR"]);
  const [telefone, setTelefone] = useState(parceiro?.telefone ?? "");
  const [email, setEmail] = useState(parceiro?.email ?? "");
  const [erros, setErros] = useState<ErrosCampo>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const [novoId] = useState(() => newEntityId());
  const [extras, setExtras] = useState({ nomeFantasia: parceiro?.nomeFantasia ?? "", pessoaContato: parceiro?.pessoaContato ?? "", cep: parceiro?.cep ?? "", logradouro: parceiro?.logradouro ?? "", numero: parceiro?.numero ?? "", complemento: parceiro?.complemento ?? "", bairro: parceiro?.bairro ?? "", cidade: parceiro?.cidade ?? "", uf: parceiro?.uf ?? "", referencia: parceiro?.referencia ?? "", observacoes: parceiro?.observacoes ?? "" });
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState(parceiro?.telefoneWhatsapp ?? false);
  const [formaPreferida, setFormaPreferida] = useState(parceiro?.formaPagamentoPreferida ?? "");
  const [condicaoPreferida, setCondicaoPreferida] = useState<"" | "A_VISTA" | "A_PRAZO">(parceiro?.condicaoPagamentoPreferida ?? "");
  const [prazos, setPrazos] = useState(parceiro?.prazosPagamento?.join("/") ?? "");

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    const validacao = validarParceiro({ nome, documento, email });
    if (!papeis.length) validacao.papeis = "Selecione pelo menos um papel";
    const dias = condicaoPreferida === "A_PRAZO" ? prazos.split("/").map((v) => Number(v.trim())) : [];
    if (condicaoPreferida === "A_PRAZO" && (!dias.length || dias.length > 24 || dias.some((d, i) => !Number.isInteger(d) || d < 1 || d > 3650 || (i > 0 && d <= dias[i - 1])))) validacao.prazosPagamento = "Informe prazos crescentes em dias, como 30/60";
    if (extras.cep && somenteDigitos(extras.cep).length !== 8) validacao.cep = "Informe um CEP com 8 dígitos";
    setErros(validacao); setErroGeral(null);
    if (Object.keys(validacao).length) return;
    const texto = (v: string) => (v.trim() === "" ? null : v.trim());
    const doc = somenteDigitos(documento) || null;
    emCurso.current = true; setSalvando(true);
    const dados = { ...Object.fromEntries(Object.entries(extras).map(([k, v]) => [k, texto(v)])), cep: somenteDigitos(extras.cep) || null, uf: texto(extras.uf)?.toUpperCase() ?? null, nome: nome.trim(), documento: doc, papeis, telefone: texto(telefone), email: texto(email), telefoneWhatsapp, formaPagamentoPreferida: formaPreferida || null, condicaoPagamentoPreferida: condicaoPreferida || null, prazosPagamento: dias };
    try {
      if (!parceiro) {
        await criarParceiro({ id: novoId, ...dados });
      } else {
        const anterior = { ...parceiro, papeis: papeisDoParceiro(parceiro), telefoneWhatsapp: parceiro.telefoneWhatsapp ?? false, prazosPagamento: parceiro.prazosPagamento ?? [] };
        const patch: ParceiroPatch = Object.fromEntries(Object.entries(dados).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(anterior[k as keyof typeof anterior] ?? null)));
        if (Object.keys(patch).length) await atualizarParceiro(parceiro.id, patch);
      }
      await onSalvo();
    } catch (e) {
      if (e instanceof ApiError && e.campo) setErros({ [e.campo]: e.message });
      else setErroGeral(e instanceof Error ? e.message : String(e));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-parceiro";
  return <PainelCadastro aberto={aberto} eyebrow="Parceiro financeiro" titulo={parceiro ? `Editar ${parceiro.nome}` : "Novo parceiro"} onFechar={() => { if (!emCurso.current) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : parceiro ? "Salvar parceiro" : "Criar parceiro"}</Button></>}>
    <form id={formId} onSubmit={submeter} noValidate className="grid gap-4">
      <p className="text-sm text-ink-3">* Campos obrigatórios</p>
      <ErrorBox erro={erroGeral} />
      <CampoFormulario id="parceiro-nome" rotulo="Nome / razão social" obrigatorio erro={erros.nome}>{(p) => <input {...p} required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} className={classeInput} />}</CampoFormulario>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="parceiro-documento" rotulo="CPF/CNPJ" erro={erros.documento} ajuda="Opcional. Informe somente quando estiver disponível; não consultamos a situação cadastral.">{(p) => <input {...p} inputMode="numeric" value={documento} onChange={(e) => setDocumento(e.target.value)} onBlur={() => { if (!validarDocumento(documento)) setDocumento(formatarDocumento(documento)); }} placeholder="Opcional" className={classeInput} />}</CampoFormulario>
        {(somenteDigitos(documento).length === 14 || extras.nomeFantasia) && <CampoFormulario id="parceiro-fantasia" rotulo="Nome fantasia" erro={erros.nomeFantasia}>{(p) => <input {...p} maxLength={120} value={extras.nomeFantasia} onChange={(e) => setExtras((s) => ({ ...s, nomeFantasia: e.target.value }))} className={classeInput} />}</CampoFormulario>}
      </div>
      <fieldset aria-describedby={erros.papeis ? "papeis-erro" : "papeis-ajuda"}><legend className="mb-2 text-sm font-medium">Papéis do parceiro *</legend><div className="grid gap-3 sm:grid-cols-2">{(Object.keys(PAPEIS_PARCEIRO) as PapelParceiro[]).map((papel) => <label key={papel} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={papeis.includes(papel)} onChange={(e) => setPapeis((atual) => e.target.checked ? [...atual, papel] : atual.filter((p) => p !== papel))} />{PAPEIS_PARCEIRO[papel]}</label>)}</div>{erros.papeis ? <p id="papeis-erro" role="alert" className="mt-2 text-sm text-red-700">{erros.papeis}</p> : <p id="papeis-ajuda" className="mt-2 text-xs text-ink-3">Para um cliente, somente o nome e o papel Cliente são necessários. Contatos e documento podem ser completados depois.</p>}</fieldset>
      <CampoFormulario id="parceiro-contato" rotulo="Pessoa de contato" erro={erros.pessoaContato}>{(p) => <input {...p} maxLength={120} value={extras.pessoaContato} onChange={(e) => setExtras((s) => ({ ...s, pessoaContato: e.target.value }))} className={classeInput} />}</CampoFormulario>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="parceiro-telefone" rotulo="Telefone" erro={erros.telefone}>{(p) => <input {...p} type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Opcional" className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="parceiro-email" rotulo="E-mail" erro={erros.email}>{(p) => <input {...p} type="text" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Opcional" className={classeInput} />}</CampoFormulario>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={telefoneWhatsapp} onChange={(e) => setTelefoneWhatsapp(e.target.checked)} />Este telefone possui WhatsApp</label>
      <details open={ENDERECO.some(([campo]) => Boolean(erros[campo])) || undefined} className="border-t border-border pt-4"><summary className="mb-4 cursor-pointer font-medium">Endereço</summary><CamposCadastro prefixo="parceiro" campos={ENDERECO} valores={extras} onChange={(k, v) => setExtras((s) => ({ ...s, [k]: v }))} erros={erros} /></details>
      <fieldset className="grid gap-4 border-t border-border pt-4"><legend className="font-medium">Preferências de pagamento</legend>
        <p className="text-sm text-ink-3">Sugestões opcionais. Você pode escolher outras condições em cada operação.</p>
        <CampoFormulario id="parceiro-condicao" rotulo="Condição sugerida" erro={erros.condicaoPagamentoPreferida}>{(p) => <select {...p} value={condicaoPreferida} onChange={(e) => setCondicaoPreferida(e.target.value as typeof condicaoPreferida)} className={classeInput}><option value="">Sem preferência</option><option value="A_VISTA">À vista</option><option value="A_PRAZO">A prazo</option></select>}</CampoFormulario>
        {condicaoPreferida === "A_PRAZO" && <CampoFormulario id="parceiro-prazos" rotulo="Prazos em dias" erro={erros.prazosPagamento} ajuda="Ex.: 30/60 para duas parcelas após a data da operação.">{(p) => <input {...p} value={prazos} onChange={(e) => setPrazos(e.target.value)} placeholder="30/60" className={classeInput} />}</CampoFormulario>}
        <CampoFormulario id="parceiro-forma" rotulo="Forma de pagamento sugerida" erro={erros.formaPagamentoPreferida}>{(p) => <select {...p} value={formaPreferida} onChange={(e) => setFormaPreferida(e.target.value)} className={classeInput}><option value="">Sem preferência</option>{Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</CampoFormulario>
      </fieldset>
      <CampoFormulario id="parceiro-observacoes" rotulo="Observações" erro={erros.observacoes}>{(p) => <textarea {...p} maxLength={1000} value={extras.observacoes} onChange={(e) => setExtras((s) => ({ ...s, observacoes: e.target.value }))} className={classeInput} />}</CampoFormulario>
    </form>
  </PainelCadastro>;
}
