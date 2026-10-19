// Composição do efetivo atual e baixas no período, sem inferir séries históricas.
// As listas preservam os valores e filtros independentemente dos gráficos.

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, ChevronRight, Heart, MapPin, Plus, RotateCcw } from "lucide-react";
import { obterPainelRebanho } from "../api";
import type { PainelGeral, TipoBaixa } from "../types";
import { formatarDataBR, rotuloClasseMotivo, rotuloTipoBaixa } from "../lib/rotulos";
import { navegarPara } from "../../../router";
import { Button, Empty, emDias, ErrorBox, PageHeader, PaginaFinanceira, Panel } from "../../../financeiro/financeiro-ui";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { NavRebanho } from "./NavRebanho";
import { linkFichaAnimal, linkNovoAnimal } from "../lib/navegacao";
import { CORES_REBANHO, percentualRebanho } from "../components/GraficosRebanho";
import "./visao-geral.css";

const URL_ANIMAIS = "/pecuaria/rebanho/animais";

const ROTULO_EVENTO: Record<string, string> = { CADASTRO: "Cadastro", BAIXA: "Baixa", ESTORNO: "Estorno de baixa" };
const ICONE_EVENTO = { CADASTRO: ArrowUpRight, BAIXA: ArrowDownRight, ESTORNO: RotateCcw };

const PERIODOS_BAIXAS = [
  { valor: 30, rotulo: "30 dias" },
  { valor: 365, rotulo: "12 meses" },
] as const;

function periodoBaixasDaUrl(): 30 | 365 {
  return new URLSearchParams(window.location.search).get("periodoBaixas") === "365" ? 365 : 30;
}

/** Monta a URL de Animais com os filtros equivalentes — usado pelos cartões e
 *  pelas barras clicáveis. Valores `undefined`/vazios não entram na query. */
function filtrosAnimais(params: Record<string, string | number | boolean | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== "") usp.set(chave, String(valor));
  }
  const query = usp.toString();
  return `${URL_ANIMAIS}${query ? `?${query}` : ""}`;
}

function BarraProporcional({ valor, total, cor }: { valor: number; total: number; cor: string }) {
  const pct = total > 0 ? Math.min(100, valor / total * 100) : 0;
  return <div aria-hidden="true" className="pec-distribuicao-trilho"><div style={{ width: `${pct}%`, backgroundColor: cor }} /></div>;
}

/** Cartão/barra inteiros clicáveis — mesmo tratamento visual dos itens de "Últimos
 *  cadastros e baixas" (botão de largura total, sem sublinhado). */
function LinhaClicavel({ href, className = "", children, disabled = false, ariaLabel }: { href: string; className?: string; children: React.ReactNode; disabled?: boolean; ariaLabel?: string }) {
  return <button type="button" disabled={disabled} aria-label={ariaLabel} onClick={() => navegarPara(href)} className={`pec-painel-link block w-full text-left hover:bg-surface-2 ${className}`}>{children}</button>;
}

export function VisaoGeral({ podeLancar = true }: { podeLancar?: boolean }) {
  const [painel, setPainel] = useState<PainelGeral | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [periodoBaixas, setPeriodoBaixas] = useState<30 | 365>(periodoBaixasDaUrl);
  const [carregandoBaixas, setCarregandoBaixas] = useState(false);
  // O shell remonta a área ao trocar o sítio; não inferir Consolidado pela
  // quantidade de sítios retornados (um consolidado também pode ter só um).
  const [consolidado] = useState(() => getPropriedadeAtiva() === null);

  useEffect(() => {
    const restaurar = () => setPeriodoBaixas(periodoBaixasDaUrl());
    window.addEventListener("popstate", restaurar);
    return () => window.removeEventListener("popstate", restaurar);
  }, []);

  const selecionarPeriodoBaixas = (periodo: 30 | 365) => {
    setPeriodoBaixas(periodo);
    const url = new URL(window.location.href);
    if (periodo === 365) url.searchParams.set("periodoBaixas", "365");
    else url.searchParams.delete("periodoBaixas");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  };

  useEffect(() => {
    let vigente = true;
    const primeiraCarga = painel === null;
    if (primeiraCarga) setCarregando(true); else setCarregandoBaixas(true);
    setErro(null);
    obterPainelRebanho({ periodoDias: periodoBaixas })
      .then((dados) => { if (vigente) setPainel(dados); })
      .catch((e) => { if (vigente) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vigente) { setCarregando(false); setCarregandoBaixas(false); } });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoBaixas]);


  const categorias = (painel?.porCategoria ?? []).map((c, indice, todas) => ({
    ...c,
    nome: todas.filter((outra) => outra.categoria === c.categoria).length > 1 && c.sexo
      ? `${c.categoria} · ${c.sexo === "F" ? "fêmeas" : "machos"}` : c.categoria,
    cor: CORES_REBANHO[indice % CORES_REBANHO.length],
  }));
  const dadosBaixas = (painel?.baixasPorTipo ?? []).map((b, indice) => ({ nome: rotuloTipoBaixa(b.tipo), qtd: b.qtd, cor: CORES_REBANHO[indice % CORES_REBANHO.length] }));

  const voluntario = painel?.baixasPorClasse.find((c) => c.classe === "DESCARTE_VOLUNTARIO")?.qtd ?? 0;
  const involuntario = painel?.baixasPorClasse.find((c) => c.classe === "DESCARTE_INVOLUNTARIO")?.qtd ?? 0;
  const totalDescarteClassificado = voluntario + involuntario;
  const pctVoluntario = totalDescarteClassificado > 0 ? Math.round((voluntario / totalDescarteClassificado) * 100) : null;
  const totalBaixas = dadosBaixas.reduce((soma, b) => soma + b.qtd, 0);
  const motivosDetalhados = (painel?.baixasPorClasse ?? []).filter(item => item.classe !== "MORTE");

  const hrefTipoBaixa = (tipo: TipoBaixa) => filtrosAnimais({ situacao: "BAIXADO", tipoBaixa: tipo, baixaDe: emDias(-(painel?.periodoDias ?? 30)) });

  return <PaginaFinanceira><div className="pec-painel-rebanho">
    <PageHeader titulo="Rebanho" descricao="Acompanhe o efetivo, a distribuição por sítio e as movimentações recentes." acao={podeLancar ? <Button onClick={() => navegarPara(linkNovoAnimal())}><Plus size={16} /> Novo animal</Button> : undefined} />
    <NavRebanho ativa="visao-geral" />
    <ErrorBox erro={erro} />
    {carregando && <div className="rebanho-carregamento" role="status">Carregando rebanho…</div>}
    {painel && <>
      <div className="pec-panorama-grid"><div className="pec-panorama-principal">
        <Panel className="min-w-0 overflow-hidden">
          <div className="pec-grafico-cabecalho"><div><h2 className="font-serif text-xl">Composição do rebanho</h2></div><button type="button" className="pec-consulta-ativos" onClick={() => navegarPara(filtrosAnimais({ situacao: "ATIVO" }))}><ChartNoAxesCombined aria-hidden="true" size={18} /> Ver animais <ChevronRight aria-hidden="true" size={14} /></button></div>
          {categorias.length && painel.ativos > 0 ? <div className="pec-composicao-corpo">
            <div className="pec-efetivo"><strong>{painel.ativos.toLocaleString("pt-BR")}</strong><span>animais ativos</span><span className="pec-efetivo-femeas">{painel.femeasAtivas.toLocaleString("pt-BR")} fêmeas ativas</span></div>
            <div className="pec-composicao-barra" role="img" aria-label={`Composição por categoria de ${painel.ativos} animais ativos. Valores na lista abaixo.`}>{categorias.map(c => <span key={`${c.categoriaId ?? "sem-categoria"}-${c.sexo ?? "todos"}`} style={{ flexGrow: c.qtd, backgroundColor: c.cor }} />)}</div>
            <div className="pec-legenda-categorias">{categorias.map((c) => <LinhaClicavel key={`${c.categoriaId ?? "sem-categoria"}-${c.sexo ?? "todos"}`} href={filtrosAnimais(c.categoriaId ? { categoriaId: c.categoriaId, sexo: c.sexo ?? undefined } : { semCategoria: true, sexo: c.sexo ?? undefined })} className="pec-categoria-linha">
              <span aria-hidden="true" className="pec-legenda-ponto" style={{ backgroundColor: c.cor }} /><span className="min-w-0 flex-1"><span className="block font-medium">{c.nome}</span></span><strong>{c.qtd}</strong><span className="pec-participacao">{percentualRebanho(c.qtd, painel.ativos)}</span><ChevronRight aria-hidden="true" size={14} />
            </LinhaClicavel>)}</div>
          </div> : <Empty>Nenhum animal ativo.</Empty>}
          <div className="pec-composicao-contexto">
            {painel.femeasAtivas > 0 ? <button type="button" className="pec-receptoras-link" aria-label={`Consultar ${painel.receptorasAtivas} ${painel.receptorasAtivas === 1 ? "receptora" : "receptoras"} de ${painel.femeasAtivas} fêmeas ativas`} onClick={() => navegarPara(filtrosAnimais({ situacao: "ATIVO", sexo: "F", papelReprodutivo: "RECEPTORA" }))}><Heart size={16} aria-hidden="true" /><span><strong>Receptoras</strong><span>{painel.receptorasAtivas} de {painel.femeasAtivas} fêmeas ativas</span></span><strong>{painel.receptorasPct.toLocaleString("pt-BR")}%</strong><ChevronRight size={14} aria-hidden="true" /></button> : <p>Sem fêmeas ativas para calcular a proporção de receptoras.</p>}
          </div>
        </Panel>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div><h2 className="font-serif text-xl">Baixas no período</h2><p className="mt-1 text-sm text-ink-3">{totalBaixas} {totalBaixas === 1 ? "baixa" : "baixas"} · últimos {painel.periodoDias} dias{carregandoBaixas ? " · atualizando…" : ""}</p></div>
          <div role="group" aria-label="Período das baixas" className="inline-flex overflow-hidden rounded-lg border border-border bg-white p-0.5">
            {PERIODOS_BAIXAS.map(({ valor, rotulo }) => <button
              key={valor}
              type="button"
              aria-pressed={periodoBaixas === valor}
              disabled={carregandoBaixas}
              onClick={() => selecionarPeriodoBaixas(valor)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${periodoBaixas === valor ? "bg-mast text-white" : "text-ink-2 hover:bg-surface-2"}`}
            >{rotulo}</button>)}
          </div>
        </div>
        <div className="pec-baixas-corpo" aria-busy={carregandoBaixas}>
          {totalBaixas > 0 ? <>
            <ul className="pec-baixas-legenda" aria-label="Baixas por tipo">{painel.baixasPorTipo.map((item, indice) => <li key={item.tipo}><LinhaClicavel disabled={carregandoBaixas} ariaLabel={`${rotuloTipoBaixa(item.tipo)}: ${item.qtd} ${item.qtd === 1 ? "baixa" : "baixas"}`} href={hrefTipoBaixa(item.tipo)} className="pec-baixa-tipo"><span aria-hidden="true" className="pec-legenda-ponto" style={{ backgroundColor: dadosBaixas[indice].cor }} /><span>{rotuloTipoBaixa(item.tipo)}</span><BarraProporcional valor={item.qtd} total={totalBaixas} cor={dadosBaixas[indice].cor} /><strong>{item.qtd}</strong><ChevronRight aria-hidden="true" size={14} /></LinhaClicavel></li>)}</ul>
            {motivosDetalhados.length > 0 && <section className="pec-baixas-motivos-secao" aria-labelledby="motivos-baixas-titulo"><h3 id="motivos-baixas-titulo">Motivos dos descartes</h3><ul className="pec-baixas-motivos">{motivosDetalhados.map(item => <li key={item.classe}><span>{item.classe === "SEM_MOTIVO" ? "Sem motivo informado" : rotuloClasseMotivo(item.classe)}</span><strong>{item.qtd}</strong></li>)}</ul>{pctVoluntario !== null && <p className="pec-baixas-classificacao"><strong>{pctVoluntario}% de descarte voluntário</strong><span>{voluntario} de {totalDescarteClassificado} descartes classificados; exclui mortes e baixas sem classificação.</span></p>}</section>}
            <div className="pec-baixas-rodape"><button type="button" disabled={carregandoBaixas} className="pec-consulta-ativos" onClick={() => navegarPara(filtrosAnimais({ situacao: "BAIXADO", baixaDe: emDias(-painel.periodoDias) }))}>Ver animais baixados <ChevronRight aria-hidden="true" size={14} /></button></div>
          </> : <Empty>Nenhuma baixa no período.</Empty>}
        </div>
      </Panel>

      </div><div className="pec-panorama-contexto">
        {consolidado && <Panel className="min-w-0 overflow-hidden">
          <div className="pec-grafico-cabecalho"><div><h2 className="font-serif text-xl">Por sítio</h2></div><MapPin aria-hidden="true" size={20} /></div>
          {painel.porSitio.length ? <div className="pec-sitios-corpo">
            {painel.porSitio.map((s, indice) => <LinhaClicavel key={s.propriedadeId ?? "sem-sitio"} href={filtrosAnimais({ propriedadeId: s.propriedadeId ?? undefined })} className="pec-sitio-linha">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 break-words font-medium">{s.nome}</span><strong>{s.qtd} <span className="pec-participacao">animais</span></strong></div>
              <BarraProporcional valor={s.qtd} total={painel.ativos} cor={CORES_REBANHO[indice % CORES_REBANHO.length]} />
              <div className="pec-sitio-rodape"><span>{percentualRebanho(s.qtd, painel.ativos)} do efetivo</span><ChevronRight aria-hidden="true" size={14} /></div>
            </LinhaClicavel>)}

          </div> : <Empty>Nenhum animal ativo.</Empty>}
        </Panel>}
      <Panel className="overflow-hidden">
        <div className="pec-eventos-cabecalho flex items-center justify-between gap-3 border-b border-border p-5"><div><h2 className="font-serif text-xl">Atividade recente</h2></div></div>
        {painel.ultimosEventos.length ? <ol className="pec-eventos">{painel.ultimosEventos.slice(0, 4).map((evento, indice) => {
          const Icone = ICONE_EVENTO[evento.tipo];
          return <li key={`${evento.animalId}-${indice}`}><button type="button" onClick={() => navegarPara(linkFichaAnimal(evento.animalId))} className="pec-painel-link pec-evento-linha"><span aria-hidden="true" className={`pec-evento-icone pec-evento-${evento.tipo.toLowerCase()}`}><Icone size={18} /></span><span className="min-w-0 flex-1"><strong className="block break-words">{evento.brinco}</strong><span className="pec-participacao">{ROTULO_EVENTO[evento.tipo]}</span></span><span className="shrink-0 text-xs text-ink-3">{formatarDataBR(evento.data)}</span><ChevronRight aria-hidden="true" size={14} /></button></li>;
        })}</ol> : <Empty>Nenhum evento recente.</Empty>}
      </Panel>
      </div></div>
    </>}
  </div></PaginaFinanceira>;
}
