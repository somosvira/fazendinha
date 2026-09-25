// Cadastro de motivo de baixa — nome livre + classe (enum ClasseMotivoBaixa, rótulo PT-BR).

import { FormEvent, useRef, useState } from "react";
import { criarMotivoBaixa, editarMotivoBaixa, RebanhoApiError } from "../api";
import type { ClasseMotivoBaixa, MotivoBaixa } from "../types";
import { ROTULO_CLASSE_MOTIVO } from "../lib/rotulos";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";

type Erros = Record<string, string>;

/** Texto de apoio sob o select de classe: as duas classes de descarte servem para os mesmos
 *  tipos de baixa (venda, abate, doação); só a classe de morte é exclusiva do tipo Morte. */
function ajudaClasse(classe: ClasseMotivoBaixa): string {
  return classe === "MORTE" ? "Serve para baixa por morte." : "Serve para venda, abate e doação.";
}

export function FormMotivoBaixa({ motivo, onSalvo, onFechar }: { motivo: MotivoBaixa | null; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const [nome, setNome] = useState(motivo?.nome ?? "");
  const [classe, setClasse] = useState<ClasseMotivoBaixa>(motivo?.classe ?? "DESCARTE_VOLUNTARIO");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    if (nome.trim().length < 2) { setErros({ nome: "Informe um nome com pelo menos 2 caracteres" }); return; }
    setErros({}); setErroGeral(null);
    emCurso.current = true; setSalvando(true);
    try {
      if (!motivo) await criarMotivoBaixa({ nome: nome.trim(), classe });
      else await editarMotivoBaixa(motivo.id, { nome: nome.trim(), classe });
      await onSalvo();
    } catch (erro) {
      if (erro instanceof RebanhoApiError && erro.campo) setErros({ [erro.campo]: erro.message });
      else setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-motivo-baixa";
  return <PainelCadastro aberto titulo={motivo ? `Editar ${motivo.nome}` : "Novo motivo de baixa"} onFechar={() => { if (!emCurso.current) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : motivo ? "Salvar motivo" : "Criar motivo"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erroGeral} />
      <CampoFormulario id="motivo-nome" rotulo="Nome do motivo" obrigatorio erro={erros.nome}>{(p) => <input {...p} required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Venda para abate" className={classeInput} />}</CampoFormulario>
      <CampoFormulario id="motivo-classe" rotulo="Classe" obrigatorio ajuda={ajudaClasse(classe)}>{(p) => <select {...p} value={classe} onChange={(e) => setClasse(e.target.value as ClasseMotivoBaixa)} className={classeInput}>
          {(Object.keys(ROTULO_CLASSE_MOTIVO) as ClasseMotivoBaixa[]).map((c) => <option key={c} value={c}>{ROTULO_CLASSE_MOTIVO[c]}</option>)}
        </select>}</CampoFormulario>
    </form>
  </PainelCadastro>;
}
