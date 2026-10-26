import { AjudaCampo } from "@/components/Dica";
import { TabelaFinanceira, Paginacao } from "../../../financeiro/financeiro-ui";
import { DialogConsultaLeite } from "./DialogConsultaLeite";
import { Button } from "@/components/ui/button";
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
  const [tentativa, setTentativa] = useState(0);
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
  }, [sitio, campo, inicio, fim, sujeito, pagina, revisao, tentativa]);
  return <section aria-label="Histórico por parâmetro">
    <h2>Histórico por parâmetro <AjudaCampo rotulo="Sobre os parâmetros de qualidade" texto={"Consulte CPP, gordura, proteína, NU, extrato seco e lactose conforme os campos cadastrados no laudo. Unidades e métodos não são presumidos."} /></h2>

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
    {erro && <p role="alert">{erro} <Button variant="outline" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</Button></p>}
    {dados && <>
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
