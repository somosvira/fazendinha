// Cadastro de lote — sítio é fixado na criação (o servidor não aceita
// trocar de sítio via PATCH); editar só muda nome/observação/ativo.
// Mesmo padrão de client/src/financeiro/FormCadastrosGerenciais.tsx.

import { FormEvent, useRef, useState } from "react";
import { criarLote, editarLote, RebanhoApiError } from "../api";
import type { Lote, Propriedade } from "../types";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";

type Erros = Record<string, string>;

export function FormLote({ lote, propriedades, propriedadeInicialId, onSalvo, onFechar }: {
  lote: Lote | null;
  /** sítios ativos para o select — só usado na criação. */
  propriedades: Propriedade[];
  /** pré-seleciona o sítio ativo no seletor global, quando houver. */
  propriedadeInicialId?: number | null;
  onSalvo: () => Promise<void> | void;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(lote?.nome ?? "");
  const [propriedadeId, setPropriedadeId] = useState<string>(
    lote ? String(lote.propriedadeId) : propriedadeInicialId != null ? String(propriedadeInicialId) : "",
  );
  const [observacao, setObservacao] = useState(lote?.observacao ?? "");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    const novosErros: Erros = {};
    if (nome.trim().length < 2) novosErros.nome = "Informe um nome com pelo menos 2 caracteres";
    if (!lote && !propriedadeId) novosErros.propriedadeId = "Selecione o sítio";
    setErros(novosErros); setErroGeral(null);
    if (Object.keys(novosErros).length) return;
    emCurso.current = true; setSalvando(true);
    try {
      if (!lote) await criarLote({ nome: nome.trim(), propriedadeId: Number(propriedadeId), observacao: observacao.trim() || null });
      else await editarLote(lote.id, { nome: nome.trim(), observacao: observacao.trim() || null });
      await onSalvo();
    } catch (erro) {
      if (erro instanceof RebanhoApiError && erro.campo) setErros({ [erro.campo]: erro.message });
      else setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-lote";
  return <PainelCadastro aberto eyebrow="Lote" titulo={lote ? `Editar ${lote.nome}` : "Novo lote"} onFechar={() => { if (!emCurso.current) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : lote ? "Salvar lote" : "Criar lote"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erroGeral} />
      <CampoFormulario id="lote-nome" rotulo="Nome do lote" obrigatorio erro={erros.nome}>{(p) => <input {...p} required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Lote 1 — Recria" className={classeInput} />}</CampoFormulario>
      {lote
        ? <CampoFormulario id="lote-sitio" rotulo="Sítio" ajuda="O sítio de um lote não pode ser alterado depois de criado.">{(p) => <input {...p} disabled value={lote.propriedade.nome} className={classeInput} />}</CampoFormulario>
        : <CampoFormulario id="lote-sitio" rotulo="Sítio" obrigatorio erro={erros.propriedadeId}>{(p) => <select {...p} required value={propriedadeId} onChange={(e) => setPropriedadeId(e.target.value)} className={classeInput}>
            <option value="">Selecione</option>
            {propriedades.map((prop) => <option key={prop.id} value={prop.id}>{prop.apelido || prop.nome}</option>)}
          </select>}</CampoFormulario>}
      <CampoFormulario id="lote-observacao" rotulo="Observação" erro={erros.observacao}>{(p) => <textarea {...p} maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={classeInput} />}</CampoFormulario>
    </form>
  </PainelCadastro>;
}
