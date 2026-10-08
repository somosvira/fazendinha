import { useEffect, useState } from "react";
import { Button, ErrorBox, PageHeader, PaginaFinanceira } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { listarLotes } from "../api";
import type { Lote } from "../types";
import { NutricaoLote } from "./NutricaoLote";
import { ReceitasDieta } from "./ReceitasDieta";
import { ConsultaFechamento } from "./ConsultaFechamento";
import "./nutricao.css";

type Aba = "lotes" | "receitas" | "fechamentos";
function estadoUrl() {
  const params = new URLSearchParams(window.location.search);
  const aba = params.get("aba");
  return {
    aba: aba === "receitas" || aba === "fechamentos" ? aba : "lotes" as Aba,
    loteId: params.get("loteId") ?? "",
    fechamentoId: params.get("fechamentoId"),
  };
}

export function Nutricao({ podeLancar }: { podeLancar: boolean }) {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [url, setUrl] = useState(estadoUrl);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    const restaurar = () => setUrl(estadoUrl());
    window.addEventListener("popstate", restaurar);
    return () => window.removeEventListener("popstate", restaurar);
  }, []);
  useEffect(() => {
    let vivo = true; setCarregando(true);
    listarLotes().then((ls) => { if (vivo) { setLotes(ls); setErro(null); } })
      .catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [revisao]);
  function navegar(aba: Aba, loteId = url.loteId) {
    const destino = new URL(window.location.href);
    destino.searchParams.set("aba", aba);
    destino.searchParams.delete("fechamentoId");
    if (loteId) destino.searchParams.set("loteId", loteId);
    else destino.searchParams.delete("loteId");
    window.history.pushState(null, "", destino);
    setUrl(estadoUrl());
  }
  const lote = lotes.find((l) => l.id === url.loteId);
  return <PaginaFinanceira><div className="nutricao-pagina">
    <PageHeader eyebrow="Pecuária" titulo="Nutrição" descricao="Receitas, dietas dos lotes e fechamento do consumo."
      acao={<a className="nutricao-link" href="/configuracoes/pecuaria/nutricao/receitas">Gerenciar receitas</a>} />
    <div role="tablist" aria-label="Nutrição" className="nutricao-abas">
      {(["lotes", "receitas", "fechamentos"] as const).map((aba) => <button type="button" key={aba} role="tab" aria-selected={url.aba === aba} onClick={() => navegar(aba)}>{aba === "lotes" ? "Dietas dos lotes" : aba === "receitas" ? "Receitas" : "Fechamentos"}</button>)}
    </div>
    {url.fechamentoId ? <ConsultaFechamento id={url.fechamentoId} onVoltar={() => navegar("fechamentos")} /> : <>
      {url.aba !== "receitas" && <><ErrorBox erro={erro} />
        {erro && <Button secondary onClick={() => setRevisao((v) => v + 1)}>Tentar novamente</Button>}
        {carregando ? <p className="mt-5" role="status">Carregando lotes…</p> : <label className="mt-5 block max-w-lg text-sm">Lote<select className={classeInput} value={url.loteId} onChange={(e) => navegar(url.aba, e.target.value)}><option value="">Selecione um lote</option>{lotes.map((l) => <option key={l.id} value={l.id}>{l.nome} · {l.propriedade.nome}</option>)}</select></label>}
      </>}
      {url.aba === "receitas" ? <><ReceitasDieta podeLancar={podeLancar} /><a className="nutricao-link mt-5 inline-block" href="/configuracoes/pecuaria/nutricao/receitas">Abrir em Configurações</a></> : lote ? <NutricaoLote key={lote.id} loteId={lote.id} propriedadeId={lote.propriedadeId} podeLancar={podeLancar && lote.ativo} vista={url.aba} /> : !carregando && <p className="mt-5 text-sm text-ink-3">Selecione um lote para atribuir dietas e conferir consumo. Sem lotes? <a className="underline" href="/pecuaria/rebanho/lotes">Cadastre em Rebanho → Lotes.</a></p>}
    </>}
  </div></PaginaFinanceira>;
}
