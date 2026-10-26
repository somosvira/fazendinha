import { SelectCampo } from "../../../financeiro/SelectCampo";
import { useEffect, useId, useState, type ReactNode } from "react";
import { listarPropriedades, type PropriedadeDTO } from "../../../api/propriedades";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { navegarPara } from "../../../router";

/** Consulta por sítio sem alterar a seleção global; o servidor continua autorizando cada request. */
export function ConsultaPorSitio({ children }: { children: (sitioId: number) => ReactNode }) {
  const global = getPropriedadeAtiva();
  return global != null ? children(global) : <SelecionarSitio>{children}</SelecionarSitio>;
}
function SelecionarSitio({ children }: { children: (sitioId: number) => ReactNode }) {
  const descricaoId = useId();
  const [sitios, setSitios] = useState<PropriedadeDTO[]>([]);
  const [selecionado, setSelecionado] = useState(() => new URLSearchParams(window.location.search).get("sitio") ?? "");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let ativo = true;
    setCarregando(true); setErro(null);
    void listarPropriedades().then(lista => { if (ativo) setSitios(lista); })
      .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar os sítios."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [revisao]);
  useEffect(() => {
    const sync = () => setSelecionado(new URLSearchParams(window.location.search).get("sitio") ?? "");
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const sitio = sitios.find(s => String(s.id) === selecionado) ?? (!selecionado && sitios.length === 1 ? sitios[0] : null);
  return <div className="space-y-5">
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex flex-wrap items-center gap-3 text-sm font-medium">Sítio da consulta
        <SelectCampo aria-label="Sítio da consulta" aria-describedby={descricaoId} className="min-h-10 max-w-full rounded-lg border border-border bg-card px-3 text-sm sm:w-56" value={sitio ? String(sitio.id) : ""} disabled={carregando || !!erro}
          onValueChange={valor => { const url = new URL(window.location.href); valor ? url.searchParams.set("sitio", valor) : url.searchParams.delete("sitio"); navegarPara(url.pathname + url.search + url.hash); }}>
          <option value="">Escolha um sítio</option>
          {sitios.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </SelectCampo>
      </label>
      <p id={descricaoId} className="sr-only">Seleção local · a visão geral continua em Consolidado.</p>
      </div>
      {carregando && <p role="status">Carregando sítios…</p>}
      <ErrorBox erro={erro}/>
      {erro && <Button secondary onClick={() => setRevisao(v => v + 1)}>Tentar novamente</Button>}
      {!carregando && !erro && !sitios.length && <p>Nenhum sítio disponível para consulta.</p>}
      {!carregando && !erro && selecionado && !sitio && sitios.length > 0 && <p role="status" className="text-sm text-muted-foreground">O sítio do endereço não está disponível. Escolha um sítio para consultar.</p>}
    </div>
    {!carregando && !erro && sitio && <div key={sitio.id}>{children(sitio.id)}</div>}
  </div>;
}
