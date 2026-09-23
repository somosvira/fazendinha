// Cadastro de raça — sigla sempre maiúscula (2-3 letras); "base" decide se ela
// entra no cálculo de composição racial (raças compostas, como Girolando, não
// participam — elas já SÃO a combinação de raças base).

import { FormEvent, useRef, useState } from "react";
import { criarRaca, editarRaca, RebanhoApiError } from "../api";
import type { Raca } from "../types";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";

type Erros = Record<string, string>;

export function FormRaca({ raca, onSalvo, onFechar }: { raca: Raca | null; onSalvo: () => Promise<void> | void; onFechar: () => void }) {
  const [nome, setNome] = useState(raca?.nome ?? "");
  const [sigla, setSigla] = useState(raca?.sigla ?? "");
  const [base, setBase] = useState(raca?.base ?? true);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    const novosErros: Erros = {};
    if (nome.trim().length < 2) novosErros.nome = "Informe um nome com pelo menos 2 caracteres";
    if (!/^[A-Z]{2,3}$/.test(sigla.trim().toUpperCase())) novosErros.sigla = "Sigla deve ter 2 ou 3 letras maiúsculas";
    setErros(novosErros); setErroGeral(null);
    if (Object.keys(novosErros).length) return;
    emCurso.current = true; setSalvando(true);
    try {
      if (!raca) await criarRaca({ nome: nome.trim(), sigla: sigla.trim().toUpperCase(), base });
      else await editarRaca(raca.id, { nome: nome.trim(), sigla: sigla.trim().toUpperCase(), base });
      await onSalvo();
    } catch (erro) {
      if (erro instanceof RebanhoApiError && erro.campo) setErros({ [erro.campo]: erro.message });
      else setErroGeral(erro instanceof Error ? erro.message : String(erro));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-raca";
  return <PainelCadastro aberto eyebrow="Raça" titulo={raca ? `Editar ${raca.nome}` : "Nova raça"} onFechar={() => { if (!emCurso.current) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : raca ? "Salvar raça" : "Criar raça"}</Button></>}>
    <form id={formId} onSubmit={submeter} className="grid gap-4" noValidate>
      <ErrorBox erro={erroGeral} />
      <CampoFormulario id="raca-nome" rotulo="Nome da raça" obrigatorio erro={erros.nome}>{(p) => <input {...p} required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Girolando" className={classeInput} />}</CampoFormulario>
      <CampoFormulario id="raca-sigla" rotulo="Sigla" obrigatorio erro={erros.sigla} ajuda="2 ou 3 letras, usada na composição racial (ex.: GIR, HOL).">{(p) => <input {...p} required maxLength={3} value={sigla} onChange={(e) => setSigla(e.target.value.toUpperCase())} placeholder="Ex.: GIR" className={`${classeInput} uppercase`} />}</CampoFormulario>
      <label className="flex items-start gap-3 text-sm font-medium">
        <input type="checkbox" aria-label="Raça base — entra no cálculo de composição" checked={base} onChange={(e) => setBase(e.target.checked)} className="mt-1" />
        <span>Raça base — entra no cálculo de composição<span className="block text-xs font-normal text-ink-3">Desmarque para raças compostas, como Girolando: elas já são o resultado da mistura de raças base e não entram como fração na composição de um animal.</span></span>
      </label>
    </form>
  </PainelCadastro>;
}
