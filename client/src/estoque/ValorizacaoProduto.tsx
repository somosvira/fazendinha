import { useEffect, useRef, useState } from "react";
import { abrirValorEstoque, consultarValorizacao, type DiagnosticoValorizacao } from "./api";
import { Button, brl, ErrorBox } from "../financeiro/financeiro-ui";
import { classeInput } from "../financeiro/PainelCadastro";
const hoje = () => new Date().toISOString().slice(0,10);
export function ValorizacaoProduto({ produtoId, propriedadeId, podeEditar, onSalvo }: { produtoId: string; propriedadeId: number; podeEditar: boolean; onSalvo: () => void }) {
  const [data, setData] = useState(hoje);
  const [dados, setDados] = useState<DiagnosticoValorizacao | null>(null);
  const [grupo, setGrupo] = useState("");
  const [origens, setOrigens] = useState([{ id: crypto.randomUUID(), quantidade: "", valor: "", disponivelDesde: hoje(), referencia: "" }]);
  const [valor, setValor] = useState("");
  const [referencia, setReferencia] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const chave = useRef(crypto.randomUUID());
  useEffect(() => { let vivo = true; setDados(null); setErro(null); setGrupo("");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { setErro("Informe uma data de corte válida"); return; }
    consultarValorizacao(produtoId, propriedadeId, data).then(d => { if (vivo) setDados(d); }).catch(e => { if (vivo) setErro(String(e.message)); });
    return () => { vivo = false; };
  }, [produtoId, propriedadeId, data, revisao]);
  const pendentes = dados?.grupos.filter(g => g.estadoValor === "DESCONHECIDO" && Number(g.quantidade) > 0) ?? [];
  const selecionado = pendentes.find(g => (g.partidaId ?? "sem-rastreio") === grupo);
  async function confirmar() {
    if (!dados || !selecionado || ocupado) return;
    setOcupado(true); setErro(null);
    try {
      await abrirValorEstoque(produtoId, { chave: chave.current, propriedadeId, data, revisao: dados.revisao, motivo, evidencia,
        bases: selecionado.metodo === "FIFO_AQUISICAO_V1" ? origens.map(({ id: _id, ...o }) => ({ ...o, partidaId: null })) : [{ partidaId: selecionado.partidaId, quantidade: selecionado.quantidade, valor, disponivelDesde: data, referencia }] });
      chave.current = crypto.randomUUID(); setValor(""); setMotivo(""); setEvidencia(""); setReferencia(""); setRevisao(v => v+1); onSalvo();
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  return <section className="mt-4 rounded-lg border border-border p-4" aria-label="Valorização do estoque">
    <h3 className="font-semibold">Valor do saldo e abertura documentada</h3>
    <p className="mt-2 text-sm text-ink-3">Custos anteriores são preservados. Saldo sem valor comprovado exige evidência; zero comprovado pode ser informado explicitamente.</p>
    <label className="mt-3 block text-sm">Data de corte<input className={classeInput} type="date" max={hoje()} value={data} disabled={ocupado} onChange={e => setData(e.target.value)} /></label>
    <ErrorBox erro={erro} />
    {!dados && !erro && <p role="status" className="text-sm">Conferindo a valorização…</p>}
    {dados && <ul className="my-3 space-y-2 text-sm">{dados.grupos.map(g => <li key={g.partidaId ?? "sem-rastreio"}>{g.grupoNome} · validade {g.validade ?? "não informada"} · saldo {g.quantidade} · {g.estadoValor === "CONHECIDO" ? brl(g.valor) : "Valor desconhecido — abertura necessária"} · {g.metodo === "MEDIA_SALDO_V1" ? "Média do saldo do grupo" : "Aquisições mais antigas"}</li>)}</ul>}
    {dados && !dados.retroatividade.permitido && <p role="status" className="text-sm">{dados.retroatividade.motivo}</p>}
    {podeEditar && pendentes.length > 0 && <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void confirmar(); }}>
      <label className="text-sm">Saldo a regularizar<select required className={classeInput} value={grupo} disabled={ocupado} onChange={e => { setGrupo(e.target.value); const g=pendentes.find(g => (g.partidaId ?? "sem-rastreio") === e.target.value); setOrigens([{id:crypto.randomUUID(),quantidade:g?.quantidade ?? "",valor:"",disponivelDesde:data,referencia:""}]); chave.current=crypto.randomUUID(); }}><option value="">Selecione</option>{pendentes.map((g) => <option key={g.partidaId ?? "sem-rastreio"} value={g.partidaId ?? "sem-rastreio"}>{g.grupoNome} · validade {g.validade ?? "não informada"} · {g.quantidade} disponíveis</option>)}</select></label>
      {selecionado?.metodo !== "FIFO_AQUISICAO_V1" && <><label className="text-sm">Valor total comprovado (R$)<input required className={classeInput} type="number" min="0" step="0.01" value={valor} disabled={ocupado} onChange={e => setValor(e.target.value)} /></label>
      <label className="text-sm">Referência da aquisição ou inventário<input required minLength={2} maxLength={200} className={classeInput} value={referencia} disabled={ocupado} onChange={e => setReferencia(e.target.value)} /></label></>}
      {selecionado?.metodo === "FIFO_AQUISICAO_V1" && <fieldset className="grid gap-3"><legend>Origens comprovadas do saldo</legend>
        <p className="text-sm text-ink-3">Informe aquisições conhecidas em linhas separadas. Se a evidência for apenas um inventário inicial, identifique essa abertura na referência. A soma deve corresponder a {selecionado.quantidade} disponíveis.</p>
        {origens.map((o,i) => <fieldset key={o.id} className="grid gap-2 rounded border border-border p-3"><legend>Origem {i+1}</legend>
          <label className="text-sm">Quantidade da origem<input required className={classeInput} type="number" min="0.001" step="0.001" value={o.quantidade} disabled={ocupado} onChange={e => setOrigens(v=>v.map(x=>x.id===o.id?{...x,quantidade:e.target.value}:x))} /></label>
          <label className="text-sm">Valor total da origem (R$)<input required className={classeInput} type="number" min="0" step="0.01" value={o.valor} disabled={ocupado} onChange={e => setOrigens(v=>v.map(x=>x.id===o.id?{...x,valor:e.target.value}:x))} /></label>
          <label className="text-sm">Data original da aquisição ou inventário<input required className={classeInput} type="date" max={data} value={o.disponivelDesde} disabled={ocupado} onChange={e => setOrigens(v=>v.map(x=>x.id===o.id?{...x,disponivelDesde:e.target.value}:x))} /></label>
          <label className="text-sm">Referência da origem<input required minLength={2} maxLength={200} className={classeInput} value={o.referencia} disabled={ocupado} onChange={e => setOrigens(v=>v.map(x=>x.id===o.id?{...x,referencia:e.target.value}:x))} /></label>
          {origens.length>1 && <Button type="button" secondary disabled={ocupado} onClick={()=>setOrigens(v=>v.filter(x=>x.id!==o.id))}>Remover origem {i+1}</Button>}
        </fieldset>)}
        <Button type="button" secondary disabled={ocupado || origens.length>=100} onClick={()=>setOrigens(v=>[...v,{id:crypto.randomUUID(),quantidade:"",valor:"",disponivelDesde:data,referencia:""}])}>Acrescentar origem comprovada</Button>
        {origens.reduce((s,o)=>s+Math.round(Number(o.quantidade||0)*1000),0)!==Math.round(Number(selecionado.quantidade)*1000) && <p role="status" className="text-sm">Confira as quantidades: as origens precisam fechar o saldo físico.</p>}
      </fieldset>}
      <label className="text-sm">Evidência do valor<textarea required minLength={5} maxLength={2000} className={classeInput} value={evidencia} disabled={ocupado} onChange={e => setEvidencia(e.target.value)} /></label>
      <label className="text-sm">Explicação da abertura<textarea required minLength={5} maxLength={500} className={classeInput} value={motivo} disabled={ocupado} onChange={e => setMotivo(e.target.value)} /></label>
      <p className="text-sm text-ink-3">A abertura documenta o valor disponível. Não altera quantidade, compras, pagamentos ou custos antigos. Em produto sem rastreio, as origens serão consumidas pela data e ordem comprovadas.</p>
      <Button type="submit" carregando={ocupado} disabled={ocupado || !selecionado || !dados?.retroatividade.permitido}>Confirmar abertura documentada</Button>
    </form>}
  </section>;
}
