// Sheet "Movimentar" — POST /pecuaria/rebanho/animais/movimentar. Serve tanto
// um animal (linha da lista, detalhe) quanto uma seleção em massa (lista).

import { type FormEvent, useRef, useState } from "react";
import { movimentarAnimais, RebanhoApiError } from "../api";
import type { CatalogoLote, Propriedade } from "../types";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";

export function FormMovimentar({ animalIds, propriedades, lotes, propriedadeInicial, loteInicial, onSalvo, onFechar }: {
  animalIds: string[];
  propriedades: Propriedade[];
  lotes: CatalogoLote[];
  propriedadeInicial?: number | null;
  loteInicial?: string | null;
  onSalvo: () => Promise<void> | void;
  onFechar: () => void;
}) {
  const [propriedadeId, setPropriedadeId] = useState<string>(propriedadeInicial != null ? String(propriedadeInicial) : "");
  const [loteId, setLoteId] = useState<string>(loteInicial ?? "");
  const [data, setData] = useState(hoje());
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  const lotesDoSitio = lotes.filter((lote) => String(lote.propriedadeId) === propriedadeId);

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    if (!propriedadeId) { setErro("Selecione o sítio de destino."); return; }
    setErro(null);
    emCurso.current = true; setSalvando(true); setErroGeral(null);
    try {
      await movimentarAnimais({ animalIds, propriedadeId: Number(propriedadeId), loteId: loteId || null, data, motivo: motivo.trim() || null });
      await onSalvo();
    } catch (falha) {
      if (falha instanceof RebanhoApiError) setErroGeral(falha.message);
      else setErroGeral(falha instanceof Error ? falha.message : String(falha));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const titulo = animalIds.length === 1 ? "Movimentar animal" : `Movimentar ${animalIds.length} animais`;
  const formId = "form-movimentar-animais";
  return <PainelCadastro aberto eyebrow="Localização" titulo={titulo} onFechar={() => { if (!salvando) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando}>{salvando ? "Salvando…" : "Movimentar"}</Button></>}>
    <form id={formId} onSubmit={submeter} noValidate className="grid gap-4">
      <ErrorBox erro={erroGeral ?? erro} />
      <CampoFormulario id="movimentar-propriedade" rotulo="Sítio de destino" obrigatorio>{(p) => <select {...p} required value={propriedadeId} onChange={(e) => { setPropriedadeId(e.target.value); setLoteId(""); }} className={classeInput}><option value="">Selecione</option>{propriedades.map((prop) => <option key={prop.id} value={prop.id}>{prop.apelido ?? prop.nome}</option>)}</select>}</CampoFormulario>
      <CampoFormulario id="movimentar-lote" rotulo="Lote" ajuda={!propriedadeId ? "Selecione o sítio para escolher o lote." : undefined}>{(p) => <select {...p} disabled={!propriedadeId} value={loteId} onChange={(e) => setLoteId(e.target.value)} className={classeInput}><option value="">Sem lote</option>{lotesDoSitio.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}</select>}</CampoFormulario>
      <CampoFormulario id="movimentar-data" rotulo="Data" obrigatorio>{(p) => <input {...p} required type="date" max={hoje()} value={data} onChange={(e) => setData(e.target.value)} className={classeInput} />}</CampoFormulario>
      <CampoFormulario id="movimentar-motivo" rotulo="Motivo">{(p) => <input {...p} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: reagrupamento de lote" className={classeInput} />}</CampoFormulario>
    </form>
  </PainelCadastro>;
}
