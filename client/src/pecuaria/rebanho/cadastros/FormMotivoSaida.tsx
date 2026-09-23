// Cadastro de motivo de saída — nome livre + tipo (enum TipoSaidaAnimal, rótulo PT-BR).

import { FormEvent, useRef, useState } from "react";
import { criarMotivoSaida, editarMotivoSaida, RebanhoApiError } from "../api";
import type { MotivoSaida, TipoSaida } from "../types";
import { ROTULO_TIPO_SAIDA } from "../lib/rotulos";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";

type Erros = Record<string, string>;

export function FormMotivoSaida({ motivo, onSalvo, onFechar }: { motivo: MotivoSaida | null; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const [nome, setNome] = useState(motivo?.nome ?? "");
  const [tipo, setTipo] = useState<TipoSaida>(motivo?.tipo ?? "VENDA");
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
      if (!motivo) await criarMotivoSaida({ nome: nome.trim(), tipo });
      else await editarMotivoSaida(motivo.id, { nome: nome.trim(), tipo });
      await onSalvo();
    } catch (erro) {
      if (erro instanceof RebanhoApiError && erro.campo) setErros({ [erro.campo]: erro.message });
      else setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-motivo-saida";
  return <PainelCadastro aberto eyebrow="Motivo de saída" titulo={motivo ? `Editar ${motivo.nome}` : "Novo motivo de saída"} onFechar={() => { if (!emCurso.current) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : motivo ? "Salvar motivo" : "Criar motivo"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erroGeral} />
      <CampoFormulario id="motivo-nome" rotulo="Nome do motivo" obrigatorio erro={erros.nome}>{(p) => <input {...p} required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Venda para abate" className={classeInput} />}</CampoFormulario>
      <CampoFormulario id="motivo-tipo" rotulo="Tipo de saída" obrigatorio>{(p) => <select {...p} value={tipo} onChange={(e) => setTipo(e.target.value as TipoSaida)} className={classeInput}>
          {(Object.keys(ROTULO_TIPO_SAIDA) as TipoSaida[]).map((t) => <option key={t} value={t}>{ROTULO_TIPO_SAIDA[t]}</option>)}
        </select>}</CampoFormulario>
    </form>
  </PainelCadastro>;
}
