// Sheet "Mudar destino" — POST /pecuaria/rebanho/animais/:id/destino.

import { type FormEvent, useRef, useState } from "react";
import { mudarDestinoAnimal, RebanhoApiError } from "../api";
import type { AnimalFicha, Aptidao, PapelReprodutivo } from "../types";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";

export function FormDestino({ animal, onSalvo, onFechar }: {
  animal: AnimalFicha;
  onSalvo: (atualizado: AnimalFicha) => Promise<void> | void;
  onFechar: () => void;
}) {
  const [aptidao, setAptidao] = useState<Aptidao>(animal.aptidao ?? "LEITE");
  const [papelReprodutivo, setPapelReprodutivo] = useState<PapelReprodutivo>(animal.papelReprodutivo ?? "NENHUM");
  const [data, setData] = useState(hoje());
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [erroData, setErroData] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    emCurso.current = true; setSalvando(true); setErroGeral(null); setErroData(undefined);
    try {
      const atualizado = await mudarDestinoAnimal(animal.id, { aptidao, papelReprodutivo, data });
      await onSalvo(atualizado);
    } catch (falha) {
      if (falha instanceof RebanhoApiError && falha.campo === "data") setErroData(falha.message);
      else setErroGeral(falha instanceof RebanhoApiError ? falha.message : falha instanceof Error ? falha.message : String(falha));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-destino-animal";
  return <PainelCadastro aberto titulo={`Mudar destino de ${animal.brinco}`} onFechar={() => { if (!salvando) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : "Salvar destino"}</Button></>}>
    <form id={formId} onSubmit={submeter} noValidate className="grid gap-4">
      <ErrorBox erro={erroGeral} />
      <CampoFormulario id="destino-aptidao" rotulo="Aptidão" obrigatorio>{(p) => <select {...p} required value={aptidao} onChange={(e) => setAptidao(e.target.value as Aptidao)} className={classeInput}><option value="LEITE">Leite</option><option value="CORTE">Corte</option></select>}</CampoFormulario>
      {animal.sexo === "F" && <CampoFormulario id="destino-papel" rotulo="Papel reprodutivo">{(p) => <select {...p} value={papelReprodutivo} onChange={(e) => setPapelReprodutivo(e.target.value as PapelReprodutivo)} className={classeInput}><option value="NENHUM">Nenhum</option><option value="RECEPTORA">Receptora</option><option value="DOADORA">Doadora</option></select>}</CampoFormulario>}
      <CampoFormulario id="destino-data" rotulo="Data da mudança" obrigatorio erro={erroData}>{(p) => <input {...p} required type="date" max={hoje()} value={data} onChange={(e) => setData(e.target.value)} className={classeInput} />}</CampoFormulario>
    </form>
  </PainelCadastro>;
}
