import { FormEvent, useState } from "react";
import { ApiError, atualizarParceiro, criarParceiro, type Parceiro, type ParceiroPatch, type TipoParceiro } from "./novo-api";
import { Button, ErrorBox } from "./financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "./PainelCadastro";
import { formatarDocumento, somenteDigitos, validarDocumento, validarParceiro, type ErrosCampo } from "./lib/validacao";

export const TIPO_PARCEIRO: Record<TipoParceiro, string> = {
  FORNECEDOR: "Fornecedor", CLIENTE: "Cliente", AMBOS: "Cliente e fornecedor", FUNCIONARIO: "Funcionário", PROPRIETARIO: "Proprietário", OUTRO: "Outro",
};

/* `parceiro === null` é criação. Documento vai ao servidor só em dígitos. */
export function FormParceiro({ parceiro, aberto, onSalvo, onFechar }: { parceiro: Parceiro | null; aberto: boolean; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const [nome, setNome] = useState(parceiro?.nome ?? "");
  const [documento, setDocumento] = useState(formatarDocumento(parceiro?.documento));
  const [tipo, setTipo] = useState<TipoParceiro>(parceiro?.tipo ?? "FORNECEDOR");
  const [telefone, setTelefone] = useState(parceiro?.telefone ?? "");
  const [email, setEmail] = useState(parceiro?.email ?? "");
  const [erros, setErros] = useState<ErrosCampo>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    const validacao = validarParceiro({ nome, documento, email });
    setErros(validacao); setErroGeral(null);
    if (Object.keys(validacao).length) return;
    const texto = (v: string) => (v.trim() === "" ? null : v.trim());
    const doc = somenteDigitos(documento) || null;
    setSalvando(true);
    try {
      if (!parceiro) {
        await criarParceiro({ nome: nome.trim(), documento: doc, tipo, telefone: texto(telefone), email: texto(email) });
      } else {
        const patch: ParceiroPatch = {};
        if (nome.trim() !== parceiro.nome) patch.nome = nome.trim();
        if (doc !== parceiro.documento) patch.documento = doc;
        if (tipo !== parceiro.tipo) patch.tipo = tipo;
        if (texto(telefone) !== parceiro.telefone) patch.telefone = texto(telefone);
        if (texto(email) !== parceiro.email) patch.email = texto(email);
        if (Object.keys(patch).length) await atualizarParceiro(parceiro.id, patch);
      }
      await onSalvo();
    } catch (e) {
      if (e instanceof ApiError && e.campo) setErros({ [e.campo]: e.message });
      else setErroGeral(e instanceof Error ? e.message : String(e));
    } finally { setSalvando(false); }
  };

  const formId = "form-parceiro";
  return <PainelCadastro aberto={aberto} eyebrow="Cliente ou fornecedor" titulo={parceiro ? `Editar ${parceiro.nome}` : "Novo parceiro"} onFechar={onFechar}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : parceiro ? "Salvar parceiro" : "Criar parceiro"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4">
      <ErrorBox erro={erroGeral} />
      <CampoFormulario id="parceiro-nome" rotulo="Nome / razão social" erro={erros.nome}>{(p) => <input {...p} required value={nome} onChange={(e) => setNome(e.target.value)} className={classeInput} />}</CampoFormulario>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="parceiro-documento" rotulo="CPF/CNPJ" erro={erros.documento}>{(p) => <input {...p} inputMode="numeric" value={documento} onChange={(e) => setDocumento(e.target.value)} onBlur={() => { if (!validarDocumento(documento)) setDocumento(formatarDocumento(documento)); }} placeholder="Opcional" className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="parceiro-tipo" rotulo="Papel">{(p) => <select {...p} value={tipo} onChange={(e) => setTipo(e.target.value as TipoParceiro)} className={classeInput}>{(Object.keys(TIPO_PARCEIRO) as TipoParceiro[]).map((t) => <option key={t} value={t}>{TIPO_PARCEIRO[t]}</option>)}</select>}</CampoFormulario>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="parceiro-telefone" rotulo="Telefone" erro={erros.telefone}>{(p) => <input {...p} type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Opcional" className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="parceiro-email" rotulo="E-mail" erro={erros.email}>{(p) => <input {...p} type="text" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Opcional" className={classeInput} />}</CampoFormulario>
      </div>
    </form>
  </PainelCadastro>;
}
