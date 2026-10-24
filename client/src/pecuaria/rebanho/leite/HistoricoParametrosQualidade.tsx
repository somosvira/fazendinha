import { Button } from "@/components/ui/button";
import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useEffect, useState } from "react";
import { consultarLeite } from "./operacoes-api";
import { DatasQualidade } from "./DatasQualidade";
import type { FormatoQualidade } from "./qualidade-types";
interface Linha {
  amostraId: string; dataAmostra: string; registradoEm: string; dataResultadoLaboratorial: string | null; dataRecebimentoLaudo: string | null;
  sujeito: { tipo: "ANIMAL"; animalId: string } | { tipo: "COLETIVO"; origem: string };
  animal: { brinco: string; nome: string | null } | null;
  rotulo: string; valor: string | number | boolean; unidade: string | null;
  formato: { id: string; nome: string; versao: number }; serie: string; versaoAmostra: number;
}
interface Consulta { itens: Linha[]; total: number; pagina: number; tamanho: number }
export function HistoricoParametrosQualidade({ sitio, formatos, data, revisao }: {
  sitio: number | null; formatos: FormatoQualidade[]; data: string; revisao: number;
}) {
  const [campo, setCampo] = useState("");
  const [inicio, setInicio] = useState(`${data.slice(0, 7)}-01`);
  const [fim, setFim] = useState(data);
  const [sujeito, setSujeito] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Consulta | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const campos = [...new Map(formatos.flatMap(f => f.campos).map(c => [c.codigo, c])).values()];
  useEffect(() => {
    let ativa = true;
    setDados(null); setErro("");
    if (!campo || !inicio || !fim) { setCarregando(false); return; }
    if (inicio > fim) { setErro("O início deve ser anterior ou igual ao fim."); setCarregando(false); return; }
    setCarregando(true);
    const query = new URLSearchParams({ campo, inicio, fim, pagina: String(pagina), tamanho: "20", ...(sujeito ? { sujeito } : {}) });
    void consultarLeite<Consulta>(`/qualidade/parametros?${query}`, sitio)
      .then(r => { if (ativa) setDados(r); })
      .catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Não foi possível consultar. Tente novamente."); })
      .finally(() => { if (ativa) setCarregando(false); });
    return () => { ativa = false; };
  }, [sitio, campo, inicio, fim, sujeito, pagina, revisao]);
  return <section aria-label="Histórico por parâmetro">
    <h2>Histórico por parâmetro</h2>
    <p>Consulte CPP, gordura, proteína, NU, extrato seco e lactose conforme os campos cadastrados no laudo. Unidades e métodos não são presumidos.</p>
    <div className="leite-form-inline">
      <label>Parâmetro do laudo<select value={campo} onChange={e => { setCampo(e.target.value); setPagina(1); }}>
        <option value="">Selecione um parâmetro</option>
        {campos.map(c => <option key={c.codigo} value={c.codigo}>{c.rotulo ?? c.codigo} ({c.codigo})</option>)}
      </select></label>
      <label>Amostras desde<input type="date" value={inicio} onChange={e => { setInicio(e.target.value); setPagina(1); }} /></label>
      <label>Amostras até<input type="date" value={fim} onChange={e => { setFim(e.target.value); setPagina(1); }} /></label>
      <label>Tipo de amostra<select value={sujeito} onChange={e => { setSujeito(e.target.value); setPagina(1); }}>
        <option value="">Individuais e coletivas</option><option value="ANIMAL">Individual</option><option value="COLETIVO">Coletiva</option>
      </select></label>
    </div>
    {!campo && <p>Selecione um campo do formato para consultar seus resultados vigentes.</p>}
    {carregando && <p role="status">Consultando histórico do parâmetro…</p>}
    {erro && <p role="alert">{erro}</p>}
    {dados && <>
      <p>{dados.total} resultado(s). Cada origem e versão de formato conserva sua própria série; não calculamos médias ou preço automaticamente.</p>
      {!dados.itens.length ? <p>Nenhum resultado informado para este parâmetro no período.</p> : <div className="leite-tabela-scroll" tabIndex={0} aria-label="Resultados por parâmetro, com rolagem horizontal">
        <Table semContainer><TableCaption>Resultados pela data da amostra</TableCaption><TableHeader><TableRow><TableHead>Amostra e origem</TableHead><TableHead>Resultado</TableHead><TableHead>Formato</TableHead><TableHead>Registro do resultado</TableHead></TableRow></TableHeader>
          <TableBody>{dados.itens.map(r => <TableRow key={r.amostraId}>
            <TableCell>{r.dataAmostra.split("-").reverse().join("/")}<small>{r.sujeito.tipo === "COLETIVO" ? r.sujeito.origem : `${r.animal?.brinco ?? "Sem brinco"} · ${r.animal?.nome ?? "Sem nome"}`}</small></TableCell>
            <TableCell>{typeof r.valor === "boolean" ? r.valor ? "Sim" : "Não" : r.valor} {r.unidade ?? "(unidade não informada)"}</TableCell>
            <TableCell>{r.formato.nome} · versão {r.formato.versao}<small>Amostra versão {r.versaoAmostra}</small></TableCell>
            <TableCell>{new Date(r.registradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}<DatasQualidade dataResultadoLaboratorial={r.dataResultadoLaboratorial} dataRecebimentoLaudo={r.dataRecebimentoLaudo} /></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>}
      <div className="leite-form-inline"><Button type="button" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Resultados anteriores</Button><span>Página {pagina}</span><Button type="button" disabled={pagina * dados.tamanho >= dados.total} onClick={() => setPagina(p => p + 1)}>Próximos resultados</Button></div>
    </>}
  </section>;
}
