// Sheet "Registrar pesagem" / "Editar pesagem" — POST /animais/:id/pesagens
// (criar) e PATCH /pesagens/:id (editar); `pesagem` presente = edição.

import { type FormEvent, useRef, useState } from "react";
import { editarPesagem, registrarPesagemAnimal, RebanhoApiError } from "../api";
import type { OrigemPesagem, Pesagem, TipoPesagem } from "../types";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";

const ROTULO_TIPO_PESAGEM: Record<TipoPesagem, string> = {
  NASCIMENTO: "Nascimento", ENTRADA: "Entrada", DESMAMA: "Desmama", ROTINA: "Rotina", SAIDA: "Saída",
};

export function FormPesagem({ animalId, pesagem = null, onSalvo, onFechar }: {
  animalId: string;
  pesagem?: Pesagem | null;
  onSalvo: () => Promise<void> | void;
  onFechar: () => void;
}) {
  const [data, setData] = useState(pesagem?.data.slice(0, 10) ?? hoje());
  const [pesoKg, setPesoKg] = useState(pesagem ? String(pesagem.pesoKg) : "");
  const [tipo, setTipo] = useState<TipoPesagem>(pesagem?.tipo ?? "ROTINA");
  const [origem, setOrigem] = useState<OrigemPesagem>(pesagem?.origem ?? "MANUAL");
  const [observacao, setObservacao] = useState(pesagem?.observacao ?? "");
  const [erros, setErros] = useState<{ data?: string; pesoKg?: string }>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    const novosErros: { data?: string; pesoKg?: string } = {};
    if (!data) novosErros.data = "Informe a data da pesagem";
    if (!(Number(pesoKg) > 0)) novosErros.pesoKg = "Informe um peso maior que zero";
    setErros(novosErros);
    if (Object.keys(novosErros).length) return;
    emCurso.current = true; setSalvando(true); setErroGeral(null);
    try {
      if (pesagem) await editarPesagem(pesagem.id, { data, pesoKg: Number(pesoKg), tipo, origem, observacao: observacao.trim() || null });
      else await registrarPesagemAnimal(animalId, { data, pesoKg: Number(pesoKg), tipo, origem, observacao: observacao.trim() || null });
      await onSalvo();
    } catch (falha) {
      if (falha instanceof RebanhoApiError && falha.campo) setErros({ [falha.campo]: falha.message });
      else setErroGeral(falha instanceof Error ? falha.message : String(falha));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const formId = "form-pesagem-animal";
  return <PainelCadastro aberto titulo={pesagem ? "Editar pesagem" : "Registrar pesagem"} onFechar={() => { if (!salvando) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : pesagem ? "Salvar pesagem" : "Registrar pesagem"}</Button></>}>
    <form id={formId} onSubmit={submeter} noValidate className="grid gap-4">
      <ErrorBox erro={erroGeral} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="pesagem-data" rotulo="Data" obrigatorio erro={erros.data}>{(p) => <input {...p} required type="date" max={hoje()} value={data} onChange={(e) => setData(e.target.value)} className={classeInput} />}</CampoFormulario>
        <CampoFormulario id="pesagem-peso" rotulo="Peso (kg)" obrigatorio erro={erros.pesoKg}>{(p) => <input {...p} required type="number" min="0.01" step="0.01" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} className={classeInput} />}</CampoFormulario>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoFormulario id="pesagem-tipo" rotulo="Tipo" obrigatorio>{(p) => <select {...p} value={tipo} onChange={(e) => setTipo(e.target.value as TipoPesagem)} className={classeInput}>{Object.entries(ROTULO_TIPO_PESAGEM).map(([chave, nome]) => <option key={chave} value={chave}>{nome}</option>)}</select>}</CampoFormulario>
        <CampoFormulario id="pesagem-origem" rotulo="Origem">{(p) => <select {...p} value={origem} onChange={(e) => setOrigem(e.target.value as OrigemPesagem)} className={classeInput}><option value="MANUAL">Manual</option><option value="BALANCA">Balança</option></select>}</CampoFormulario>
      </div>
      <CampoFormulario id="pesagem-observacao" rotulo="Observação">{(p) => <textarea {...p} maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={classeInput} />}</CampoFormulario>
    </form>
  </PainelCadastro>;
}
