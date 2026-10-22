import { useEffect, useState } from "react";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { consultarLeite } from "./operacoes-api";
import { formatarLitros, hojeOperacional } from "./modelo";
import { RitmoLeite, type DiaRitmoLeite } from "./RitmoLeite";
import type { EvidenciaFinalidadeLeite } from "./types";
const finalidadeNome = (f: EvidenciaFinalidadeLeite | undefined) => f?.estado === "COMPROVADA" ? "Leite comprovada na data" : "Finalidade histórica a conciliar";
interface Linha { finalidade: EvidenciaFinalidadeLeite; data: string; animalId: string; brinco: string; nome: string | null; ordenha: string; natureza: string; estado: string; litros: number | null; confirmada: boolean }
interface Consulta {
  itens: Linha[]; total: number; tamanho: number; pagina: number; mesEmAndamento: boolean;
  periodo: { inicio: string; fim: string }; coberturaCompleta: boolean;
  totais: { litros: number | null; pendentes: number }; ritmo: DiaRitmoLeite[];
  porNatureza: { id: string; litros: number | null }[];
}
const dataUrl = () => {
  const valor = new URLSearchParams(location.search).get("producaoData");
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return hojeOperacional();
  const data = new Date(`${valor}T00:00:00Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor ? valor : hojeOperacional();
};
const naturezaNome = (n: string) => n === "A_CLASSIFICAR" ? "A classificar" : n === "NAO_COMERCIAL" ? "Não comercial" : n === "COLOSTRO" ? "Colostro" : n === "COMERCIAL" ? "Comercial" : n;
export function ConsultasProducaoLeite({ podeExportar = false }: { podeExportar?: boolean }) {
  const [visao, setVisao] = useState(() => new URLSearchParams(location.search).get("producaoVisao") === "dia" ? "dia" : "mes");
  const [data, setData] = useState(dataUrl);
  const [natureza, setNatureza] = useState(() => new URLSearchParams(location.search).get("natureza") ?? "");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Consulta | null>(null), [erro, setErro] = useState(""), [carregando, setCarregando] = useState(false), [exportando, setExportando] = useState(false);
  useEffect(() => {
    const atualizar = () => {
      const parametros = new URLSearchParams(location.search);
      setVisao(parametros.get("producaoVisao") === "dia" ? "dia" : "mes");
      setData(dataUrl()); setNatureza(parametros.get("natureza") ?? ""); setPagina(1);
    };
    window.addEventListener("popstate", atualizar);
    return () => window.removeEventListener("popstate", atualizar);
  }, []);
  const sitio = getPropriedadeAtiva();
  const inicio = visao === "dia" ? data : `${data.slice(0, 7)}-01`;
  const fim = visao === "dia" ? data : new Date(Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const query = new URLSearchParams({ inicio, fim, ...(natureza ? { natureza } : {}), pagina: String(pagina), tamanho: "30" }).toString();
  useEffect(() => {
    let ativa = true;
    setDados(null); setErro(""); setCarregando(true);
    const url = new URL(location.href);
    url.searchParams.set("producaoVisao", visao); url.searchParams.set("producaoData", data);
    if (natureza) url.searchParams.set("natureza", natureza); else url.searchParams.delete("natureza");
    history.replaceState(null, "", url);
    void consultarLeite<Consulta>(`/consultas-producao?${query}`, sitio).then(r => { if (ativa) setDados(r); }).catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Falha na consulta"); }).finally(() => { if (ativa) setCarregando(false); });
    return () => { ativa = false; };
  }, [query, sitio, visao, data, natureza]);
  async function exportar() {
    setExportando(true); setErro("");
    try {
      const r = await consultarLeite<Consulta>(`/consultas-producao/exportacao?${query}`, sitio);
      const celula = (v: unknown) => { const texto = v === null ? "Não informado" : String(v); return `"${(/^\s*[=+@-]/.test(texto) ? "'" : "") + texto.replace(/"/g, '""')}"`; };
      const csv = [["Data produção", "Brinco", "Nome", "Ordenha", "Natureza", "Estado", "Litros medidos", "Confirmada no estoque", "Finalidade na produção", "Data da finalidade", "Regra da finalidade"], ...r.itens.map(l => [l.data, l.brinco, l.nome, l.ordenha, naturezaNome(l.natureza), l.estado, l.litros, l.confirmada ? "Sim" : "Não", finalidadeNome(l.finalidade), l.finalidade?.dataOperacional ?? l.data, l.finalidade?.regra ?? null])].map(l => l.map(celula).join(";")).join("\r\n");
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `producao-${inicio}-${fim}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha na exportação"); } finally { setExportando(false); }
  }
  return <section className="leite-operacoes">
    <h2 className="leite-titulo-secao">Produção por dia e mês</h2>
    <p>Litros medidos na data da ordenha. Coleta, venda e recebimento possuem suas próprias datas.</p>
    <div className="leite-form-inline">
      <label>Consultar produção por<select value={visao} onChange={e => { setVisao(e.target.value); setPagina(1); }}><option value="dia">Dia</option><option value="mes">Mês</option></select></label>
      <label>{visao === "dia" ? "Dia de produção" : "Mês de produção"}<input required type={visao === "dia" ? "date" : "month"} value={visao === "dia" ? data : data.slice(0, 7)} onChange={e => { if (e.target.value) { setData(visao === "dia" ? e.target.value : `${e.target.value}-01`); setPagina(1); } }} /></label>
      <label>Natureza da produção<select value={natureza} onChange={e => { setNatureza(e.target.value); setPagina(1); }}><option value="">Todas</option>{["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO", "A_CLASSIFICAR"].map(n => <option key={n} value={n}>{naturezaNome(n)}</option>)}</select></label>
    </div>
    {carregando && <p role="status">Consultando produção…</p>}{erro && <p role="alert">{erro}</p>}
    {dados && <>
      <h2>{formatarLitros(dados.totais.litros)} medidos no período</h2>
      {dados.mesEmAndamento && <p>Mês em andamento: o total pode mudar com novas ordenhas.</p>}
      {!dados.coberturaCompleta && <p role="status">Produção parcial: há dias sem folha, sem participação ou medições pendentes. O volume conhecido não representa uma produção completa.</p>}
      <p>Finalidade histórica a conciliar mantém os litros registrados e não comprova elegibilidade na data.</p>
      <p>A classificar inclui medições sem natureza confirmada; esses litros continuam na produção.</p>
      {podeExportar && <button type="button" disabled={exportando} onClick={() => void exportar()}>{exportando ? "Exportando…" : "Exportar produção do período"}</button>}
      <RitmoLeite dias={dados.ritmo} />
      <div className="leite-tabela-scroll" tabIndex={0} aria-label="Produção por animal e ordenha, com rolagem horizontal"><table className="leite-consulta-cartoes"><caption>Produção por animal e ordenha</caption><thead><tr><th>Dia</th><th>Animal</th><th>Ordenha</th><th>Litros medidos</th><th>Natureza</th><th>Finalidade na produção</th><th>Medição</th></tr></thead><tbody>{dados.itens.map((l, i) => <tr key={`${l.data}-${l.animalId}-${i}`}><td data-rotulo="Dia">{l.data.split("-").reverse().join("/")}</td><td data-rotulo="Animal">{l.brinco}{l.nome ? ` · ${l.nome}` : ""}</td><td data-rotulo="Ordenha">{l.ordenha}</td><td data-rotulo="Litros medidos">{formatarLitros(l.litros)}</td><td data-rotulo="Natureza">{naturezaNome(l.natureza)}</td><td data-rotulo="Finalidade na produção">{finalidadeNome(l.finalidade)}</td><td data-rotulo="Medição">{l.estado === "MEDIDO" ? "Medida" : l.estado === "NAO_ORDENHADO" ? "Não ordenhado" : "Pendente"}</td></tr>)}</tbody></table></div>
      {!dados.itens.length && <p>Nenhuma medição no recorte selecionado.</p>}
      <div className="leite-form-inline"><button type="button" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Produção anterior</button><span>Página {pagina}</span><button type="button" disabled={pagina * dados.tamanho >= dados.total} onClick={() => setPagina(p => p + 1)}>Próxima produção</button></div>
    </>}
  </section>;
}
