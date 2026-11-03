import { SelectCampo } from "@/financeiro/SelectCampo";
import { DatePicker } from "@/components/DatePicker";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { pontosSerieQualidade } from "./visuais-leite";
import { AjudaCampo } from "@/components/Dica";
import { TabelaFinanceira, Paginacao } from "../../../financeiro/financeiro-ui";
import { DialogConsultaLeite } from "./DialogConsultaLeite";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { consultarLeite } from "./operacoes-api";
import { DatasQualidade } from "./DatasQualidade";
import type { FormatoQualidade } from "./qualidade-types";
interface Linha {
  tipo?: string;
  amostraId: string; dataAmostra: string; registradoEm: string; dataResultadoLaboratorial: string | null; dataRecebimentoLaudo: string | null;
  sujeito: { tipo: "ANIMAL"; animalId: string } | { tipo: "COLETIVO"; origem: string };
  animal: { brinco: string; nome: string | null } | null;
  rotulo: string; valor: string | number | boolean; unidade: string | null;
  formato: { id: string; nome: string; versao: number }; serie: string; versaoAmostra: number;
}
interface Consulta { serieItens?: Linha[]; serieCompleta?: boolean; itens: Linha[]; total: number; pagina: number; tamanho: number }
export function HistoricoParametrosQualidade({ sitio, formatos, data, revisao }: {
  sitio: number | null; formatos: FormatoQualidade[]; data: string; revisao: number;
}) {
  const [serieEscolhida, setSerieEscolhida] = useState("");
  const [campo, setCampo] = useState("");
  const [inicio, setInicio] = useState(`${data.slice(0, 7)}-01`);
  const [fim, setFim] = useState(data);
  const [sujeito, setSujeito] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Consulta | null>(null);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const campos = [...new Map(formatos.flatMap(f => f.campos).map(c => [c.codigo, c])).values()];
  useEffect(() => {
    let ativa = true;
    setDados(null); setErro("");
    if (!campo || !inicio || !fim) { setCarregando(false); return; }
    if (inicio > fim) { setErro("O início deve ser anterior ou igual ao fim."); setCarregando(false); return; }
    setCarregando(true);
    const query = new URLSearchParams({ campo, inicio, fim, pagina: String(pagina), tamanho: "20", incluirSerie: "true", ...(sujeito ? { sujeito } : {}) });
    void consultarLeite<Consulta>(`/qualidade/parametros?${query}`, sitio)
      .then(r => { if (ativa) setDados(r); })
      .catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Não foi possível consultar. Tente novamente."); })
      .finally(() => { if (ativa) setCarregando(false); });
    return () => { ativa = false; };
  }, [sitio, campo, inicio, fim, sujeito, pagina, revisao, tentativa]);
  const series = [...new Map((dados?.serieItens ?? []).map(r=>[r.serie,r])).values()];
  const serie = series.find(r=>r.serie===serieEscolhida) ?? series[0];
  const pontos = serie ? pontosSerieQualidade(dados?.serieItens??[],serie.serie) : [];
  return <section aria-label="Histórico por parâmetro">
    <h2>Histórico por parâmetro <AjudaCampo rotulo="Sobre os parâmetros de qualidade" texto={"Consulte CPP, gordura, proteína, NU, extrato seco e lactose conforme os campos cadastrados no laudo. Unidades e métodos não são presumidos."} /></h2>

    <div className="leite-form-inline">
      <label>Parâmetro do laudo<SelectCampo aria-label="Parâmetro do laudo" value={campo} onValueChange={v => { setCampo(v); setPagina(1); setSerieEscolhida(""); }}>
        <option value="">Selecione um parâmetro</option>
        {campos.map(c => <option key={c.codigo} value={c.codigo}>{c.rotulo ?? c.codigo} ({c.codigo})</option>)}
      </SelectCampo></label>
      <label>Amostras desde<DatePicker aria-label="Amostras desde" value={inicio} onChange={v => { setInicio(v); setPagina(1); }} /></label>
      <label>Amostras até<DatePicker aria-label="Amostras até" value={fim} onChange={v => { setFim(v); setPagina(1); }} /></label>
      <label>Tipo de amostra<SelectCampo aria-label="Tipo de amostra" value={sujeito} onValueChange={v => { setSujeito(v); setPagina(1); setSerieEscolhida(""); }}>
        <option value="">Individuais e coletivas</option><option value="ANIMAL">Individual</option><option value="COLETIVO">Coletiva</option>
      </SelectCampo></label>
    </div>
    {!campo && <p>Selecione um campo do formato para consultar seus resultados vigentes.</p>}
    {carregando && <p role="status">Consultando histórico do parâmetro…</p>}
    {erro && <p role="alert">{erro} <Button variant="outline" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</Button></p>}
    {dados && <>
      {dados.serieCompleta === false && <div role="status" className="p-4">Refine o período ou o tipo de amostra para visualizar a evolução. A tabela continua disponível com todos os resultados paginados.</div>}
      {dados.serieCompleta && series.length > 0 && <figure className="leite-parametro-grafico">
        <figcaption><h3>Evolução de {serie?.rotulo}<AjudaCampo rotulo="Sobre o gráfico do parâmetro" texto="Todos os resultados vigentes do recorte da mesma identidade de série: origem, formato preservado e unidade. Sem médias, conversões, limites clínicos ou preço presumidos."/></h3><label>Série comparável<SelectCampo aria-label="Série comparável" value={serie?.serie??""} onValueChange={setSerieEscolhida}>{series.map(r=><option key={r.serie} value={r.serie}>{r.sujeito.tipo === "COLETIVO" ? r.sujeito.origem : r.animal?.brinco??"Sem brinco"} · {r.formato.nome} v{r.formato.versao} · {r.unidade??"Unidade não informada"}</option>)}</SelectCampo></label></figcaption>
        {pontos.length > 0 ? <><div className="leite-parametro-area" role="img" aria-label={`${pontos.length} resultados de ${serie?.rotulo}, unidade ${serie?.unidade??"não informada"}, no recorte completo. Valores na tabela de resultados.`}><ResponsiveContainer width="100%" height="100%"><LineChart data={pontos} margin={{top:15,right:25,bottom:10,left:15}}><CartesianGrid vertical={false} stroke="var(--border)"/><XAxis dataKey="dataAmostra" tickFormatter={v=>String(v).split("-").reverse().slice(0,2).join("/")} tick={{fontSize:11}} minTickGap={32}/><YAxis domain={['auto','auto']} tick={{fontSize:11}} tickFormatter={v=>Number(v).toLocaleString('pt-BR')}/><Tooltip labelFormatter={v=>String(v).split("-").reverse().join("/")} formatter={v=>[`${Number(v).toLocaleString('pt-BR',{maximumFractionDigits:12})} ${serie?.unidade??''}`,serie?.rotulo??'Resultado']}/><Line type="linear" dataKey="valor" stroke="var(--primary)" strokeWidth={2} dot={{r:4}} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div><span className="text-xs text-muted-foreground">{pontos.length} {pontos.length===1?'amostra · sem tendência comparativa':'amostras na série'}</span></> : <p>Este parâmetro não tem valores numéricos comparáveis. Consulte os resultados abaixo.</p>}
      </figure>}

      <p>{dados.total} resultado(s). <AjudaCampo rotulo="Sobre as séries de resultados" texto="Cada origem e versão de formato conserva sua própria série; não calculamos médias ou preço automaticamente." /></p>
      {!dados.itens.length ? <p>Nenhum resultado informado para este parâmetro no período.</p> : <TabelaFinanceira compacta rotulo="Resultados pela data da amostra" itens={dados.itens} chaveDe={r => `${r.amostraId}:${r.serie ?? campo}`} colunas={[
        { chave: "data", titulo: "Amostra", principal: true, celula: r => r.dataAmostra.split("-").reverse().join("/") },
        { chave: "origem", titulo: "Origem", celula: r => r.sujeito.tipo === "COLETIVO" ? r.sujeito.origem : r.animal?.brinco ?? "Sem brinco" },
        { chave: "resultado", titulo: "Resultado", celula: r => <>{typeof r.valor === "boolean" ? r.valor ? "Sim" : "Não" : r.valor} {r.unidade ?? "(unidade não informada)"}</> },
        { chave: "formato", titulo: "Formato", celula: r => r.formato.nome },
        { chave: "detalhes", titulo: "Ações", acoes: true, celula: r => <DialogConsultaLeite titulo="Ver resultado"><p>{r.formato.nome} · versão {r.formato.versao}</p><p>Amostra versão {r.versaoAmostra}</p><p>Registro no sistema: {new Date(r.registradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p><DatasQualidade dataResultadoLaboratorial={r.dataResultadoLaboratorial} dataRecebimentoLaudo={r.dataRecebimentoLaudo} /></DialogConsultaLeite> },
      ]} />}
      <Paginacao pagina={pagina} totalPaginas={Math.max(1, Math.ceil(dados.total / dados.tamanho))} total={dados.total} porPagina={dados.tamanho} rotulo="Paginação dos resultados" substantivo="resultados" idSelect="pagina-resultados-leite" onPagina={setPagina} />
    </>}
  </section>;
}
