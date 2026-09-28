// Sheet "Movimentar" — POST /pecuaria/rebanho/animais/movimentar. Serve tanto
// um animal (linha da lista, detalhe) quanto uma seleção em massa (lista).
// Mostra a lista dos animais que serão movidos, com a localização atual de
// cada um, e permite tirar algum antes de confirmar.

import { type FormEvent, useRef, useState } from "react";
import { X } from "lucide-react";
import { movimentarAnimais, RebanhoApiError } from "../api";
import type { AnimalResumo, CatalogoLote, Propriedade } from "../types";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";

/** "está em: <lote> (<sítio>)" quando há lote, senão "está em: <sítio>, sem lote". */
function localizacaoAtual(animal: AnimalResumo): string {
  const sitio = animal.propriedade?.nome ?? "Sem sítio";
  return animal.lote ? `está em: ${animal.lote.nome} (${sitio})` : `está em: ${sitio}, sem lote`;
}

export function FormMovimentar({ animais, propriedades, lotes, propriedadeInicial, loteInicial, destinoFixo, onSalvo, onFechar }: {
  animais: AnimalResumo[];
  propriedades: Propriedade[];
  lotes: CatalogoLote[];
  propriedadeInicial?: number | null;
  loteInicial?: string | null;
  /** quando setado, o destino não é editável (ex.: "Trazer animais" de dentro da página do lote) — mostra só um resumo. */
  destinoFixo?: { propriedadeId: number; loteId: string | null; rotulo: string };
  onSalvo: (resultado: { movimentacaoId: string; movidos: number }) => Promise<void> | void;
  onFechar: () => void;
}) {
  const [lista, setLista] = useState<AnimalResumo[]>(animais);
  const [propriedadeId, setPropriedadeId] = useState<string>(propriedadeInicial != null ? String(propriedadeInicial) : "");
  const [loteId, setLoteId] = useState<string>(loteInicial ?? "");
  const [data, setData] = useState(hoje());
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [erroData, setErroData] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);

  const lotesDoSitio = lotes.filter((lote) => String(lote.propriedadeId) === propriedadeId);

  const tirar = (id: string) => setLista((atual) => atual.filter((a) => a.id !== id));

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (emCurso.current) return;
    if (!lista.length) return;
    if (!destinoFixo && !propriedadeId) { setErro("Selecione o sítio de destino."); return; }
    setErro(null);
    emCurso.current = true; setSalvando(true); setErroGeral(null); setErroData(undefined);
    try {
      const resultado = await movimentarAnimais({
        animalIds: lista.map((a) => a.id),
        propriedadeId: destinoFixo ? destinoFixo.propriedadeId : Number(propriedadeId),
        loteId: destinoFixo ? destinoFixo.loteId : loteId || null,
        data,
        motivo: motivo.trim() || null,
      });
      await onSalvo(resultado);
    } catch (falha) {
      if (falha instanceof RebanhoApiError && falha.campo === "data") setErroData(falha.message);
      else if (falha instanceof RebanhoApiError) setErroGeral(falha.message);
      else setErroGeral(falha instanceof Error ? falha.message : String(falha));
    } finally { emCurso.current = false; setSalvando(false); }
  };

  const titulo = lista.length === 1 ? "Movimentar animal" : `Movimentar ${lista.length} animais`;
  const formId = "form-movimentar-animais";
  return <PainelCadastro aberto titulo={titulo} onFechar={() => { if (!salvando) onFechar(); }}
    rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form={formId} disabled={salvando || !lista.length}>{salvando ? "Salvando…" : "Movimentar"}</Button></>}>
    <form id={formId} onSubmit={submeter} noValidate className="grid gap-4">
      <ErrorBox erro={erroGeral ?? erro} />

      <div>
        <div className="text-sm font-medium">Animais que serão movidos ({lista.length})</div>
        <ul className="mt-1.5 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
          {lista.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="break-words"><strong>{a.brinco}</strong>{a.nome ? ` · ${a.nome}` : ""}</div>
              <div className="mt-0.5 break-words text-xs text-ink-3">{localizacaoAtual(a)}</div>
            </div>
            <button type="button" aria-label={`Tirar ${a.brinco}`} onClick={() => tirar(a.id)} className="shrink-0 rounded-lg p-1.5 text-ink-2 hover:bg-white hover:text-red-700"><X size={14} /></button>
          </li>)}
        </ul>
        {!lista.length && <p role="alert" className="mt-1.5 text-xs text-red-700">Nenhum animal selecionado — tire menos animais ou cancele para escolher outros.</p>}
      </div>

      {destinoFixo
        ? <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">Destino</div>
            <div className="mt-1 font-medium">{destinoFixo.rotulo}</div>
          </div>
        : <>
          <CampoFormulario id="movimentar-propriedade" rotulo="Sítio de destino" obrigatorio>{(p) => <select {...p} required value={propriedadeId} onChange={(e) => { setPropriedadeId(e.target.value); setLoteId(""); }} className={classeInput}><option value="">Selecione</option>{propriedades.map((prop) => <option key={prop.id} value={prop.id}>{prop.apelido ?? prop.nome}</option>)}</select>}</CampoFormulario>
          <CampoFormulario id="movimentar-lote" rotulo="Lote" ajuda={!propriedadeId ? "Selecione o sítio para escolher o lote." : undefined}>{(p) => <select {...p} disabled={!propriedadeId} value={loteId} onChange={(e) => setLoteId(e.target.value)} className={classeInput}><option value="">Sem lote</option>{lotesDoSitio.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}</select>}</CampoFormulario>
        </>}
      <CampoFormulario id="movimentar-data" rotulo="Data" obrigatorio erro={erroData}>{(p) => <DatePicker {...p} required max={hoje()} value={data} onChange={setData} className="mt-1.5" />}</CampoFormulario>
      <CampoFormulario id="movimentar-motivo" rotulo="Motivo">{(p) => <input {...p} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: reagrupamento de lote" className={classeInput} />}</CampoFormulario>
    </form>
  </PainelCadastro>;
}
