import { useEffect, useState } from "react";
import { Button, ErrorBox, PageHeader, PaginaFinanceira } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { NavRebanho } from "../telas/NavRebanho";
import { listarLotes } from "../api";
import type { Lote } from "../types";
import { NutricaoLote } from "./NutricaoLote";
import { ConsultaFechamento } from "./ConsultaFechamento";
export function Nutricao({ podeLancar }: { podeLancar: boolean }) {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [aba, setAba] = useState<"lotes" | "receitas" | "fechamentos">(() => new URLSearchParams(window.location.search).get("aba") === "fechamentos" ? "fechamentos" : "lotes");
  const [id, setId] = useState(() => new URLSearchParams(window.location.search).get("loteId") ?? "");
  const [fechamentoId, setFechamentoId] = useState(() => new URLSearchParams(window.location.search).get("fechamentoId"));
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => { let vivo = true; setCarregando(true); listarLotes().then((ls) => { if (vivo) { setLotes(ls); setErro(null); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); }); return () => { vivo = false; }; }, [revisao]);
  const lote = lotes.find((l) => l.id === id);
  if (fechamentoId) return <PaginaFinanceira><PageHeader eyebrow="Pecuária" titulo="Nutrição" descricao="Consumo conferido e atribuição por permanência." /><NavRebanho ativa="nutricao" /><ConsultaFechamento id={fechamentoId} onVoltar={() => { const url = new URL(window.location.href); url.searchParams.delete("fechamentoId"); url.searchParams.set("aba", "fechamentos"); window.history.replaceState(null, "", url); setFechamentoId(null); setAba("fechamentos"); }} /></PaginaFinanceira>;
  return <PaginaFinanceira><PageHeader eyebrow="Pecuária" titulo="Nutrição" descricao="Receitas, vigências e fechamentos por permanência dos animais nos lotes." /><NavRebanho ativa="nutricao" /><div role="tablist" aria-label="Nutrição" className="mt-5 flex flex-wrap gap-2">{(["lotes", "receitas", "fechamentos"] as const).map((v) => <button type="button" key={v} role="tab" aria-selected={aba === v} className={`rounded-lg border border-border px-4 py-2 text-sm ${aba === v ? "bg-green-100 font-semibold" : "bg-white"}`} onClick={() => setAba(v)}>{v === "lotes" ? "Lotes" : v === "receitas" ? "Receitas" : "Fechamentos"}</button>)}</div><ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao((v) => v + 1)}>Tentar novamente</Button>}{aba !== "receitas" && (carregando ? <p className="mt-5">Carregando lotes…</p> : <label className="mt-5 block max-w-lg text-sm">Lote<select className={classeInput} value={id} onChange={(e) => setId(e.target.value)}><option value="">Selecione um lote</option>{lotes.map((l) => <option key={l.id} value={l.id}>{l.nome} · {l.propriedade.nome}</option>)}</select></label>)}{aba === "receitas" ? <NutricaoLote key="receitas" vista="receitas" podeLancar={podeLancar} /> : lote ? <NutricaoLote key={lote.id} loteId={lote.id} propriedadeId={lote.propriedadeId} podeLancar={podeLancar && lote.ativo} vista={aba} /> : !carregando && <p className="mt-5 text-sm text-ink-3">Selecione um lote para consultar receitas, atribuir dietas e conferir consumo. Sem lotes? Cadastre em Rebanho → Lotes.</p>}</PaginaFinanceira>;
}
