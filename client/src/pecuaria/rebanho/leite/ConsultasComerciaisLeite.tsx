import { useEffect, useState } from "react";
import { consultarLeite } from "./operacoes-api";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { formatarLitros, hojeOperacional } from "./modelo";
import type { AmostraQualidade } from "./qualidade-types";
interface Linha { id: string; comercialId: string; data?: string; inicio: string; fim: string; parceiroNome: string; quantidadeLitros?: string; referencia: string; situacao?: string; produtoNome?: string; fechamento?: { volumeReconhecido: string; precoUnitario: string | null; valorTotal: string | null; amostras: { amostraId: string; versaoAmostra: number; snapshot: AmostraQualidade }[] } | null }
interface Lista { itens: Linha[]; total: number; porPagina: number }
const dataPt = (v: string) => v.split("-").reverse().join("/");
const moeda = (v: string) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function ConsultasComerciaisLeite({ tipo }: { tipo: "coletas" | "vendas" }) {
  const inicial = () => new URLSearchParams(location.search);
  const [de, setDe] = useState(() => inicial().get(`${tipo}De`) ?? `${hojeOperacional().slice(0, 7)}-01`);
  const [ate, setAte] = useState(() => inicial().get(`${tipo}Ate`) ?? hojeOperacional());
  const [comprador, setComprador] = useState(() => inicial().get(`${tipo}Comprador`) ?? "");
  const [pagina, setPagina] = useState(1), [dados, setDados] = useState<Lista | null>(null), [erro, setErro] = useState(""), [carregando, setCarregando] = useState(false);
  const [parceiros, setParceiros] = useState<{ id: string; nome: string }[]>([]);
  const sitio = getPropriedadeAtiva();
  useEffect(() => {
    let ativa = true;
    void consultarLeite<{ parceiros: { id: string; nome: string }[] }>("/comercial/operacoes/cadastros", sitio).then(r => { if (ativa) setParceiros(r.parceiros); }).catch(() => { if (ativa) setParceiros([]); });
    return () => { ativa = false; };
  }, [sitio]);
  useEffect(() => {
    const atualizar = () => { const p = new URLSearchParams(location.search); setDe(p.get(`${tipo}De`) ?? `${hojeOperacional().slice(0, 7)}-01`); setAte(p.get(`${tipo}Ate`) ?? hojeOperacional()); setComprador(p.get(`${tipo}Comprador`) ?? ""); setPagina(1); };
    window.addEventListener("popstate", atualizar); return () => window.removeEventListener("popstate", atualizar);
  }, [tipo]);
  useEffect(() => {
    let ativa = true; setDados(null); setErro(""); setCarregando(false);
    if (!de || !ate || de > ate) { setErro("Informe início e fim válidos."); return; }
    setCarregando(true);
    const url = new URL(location.href); url.searchParams.set(`${tipo}De`, de); url.searchParams.set(`${tipo}Ate`, ate);
    if (comprador) url.searchParams.set(`${tipo}Comprador`, comprador); else url.searchParams.delete(`${tipo}Comprador`);
    history.replaceState(null, "", url);
    const q = new URLSearchParams({ de, ate, pagina: String(pagina), ...(comprador ? { parceiroId: comprador } : {}) });
    void consultarLeite<Lista>(`/comercial/consultas/${tipo}?${q}`, sitio).then(r => { if (ativa) setDados(r); }).catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Falha na consulta"); }).finally(() => { if (ativa) setCarregando(false); });
    return () => { ativa = false; };
  }, [tipo, sitio, de, ate, comprador, pagina]);
  return <section className="leite-operacoes" aria-label={tipo === "coletas" ? "Consulta de coletas" : "Consulta de vendas"}>
    <h2 className="leite-titulo-secao">{tipo === "coletas" ? "Coletas de leite" : "Vendas de leite"}</h2>
    <p>{tipo === "coletas" ? "Retiradas pela data real da coleta, inclusive com preço pendente. Não exige fechamento ou recebimento." : "Acordos fechados por comprador e período comercial. Recebimentos posteriores permanecem no Financeiro."}</p>
    <div className="leite-form-inline"><label>{tipo === "coletas" ? "Coletas desde" : "Período comercial desde"}<input type="date" value={de} onChange={e => { setDe(e.target.value); setPagina(1); }} /></label><label>Até<input type="date" value={ate} onChange={e => { setAte(e.target.value); setPagina(1); }} /></label><label>Comprador<select value={comprador} onChange={e => { setComprador(e.target.value); setPagina(1); }}><option value="">Todos os compradores</option>{parceiros.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label></div>
    {carregando && <p role="status">Consultando {tipo}…</p>}{erro && <p role="alert">{erro}</p>}
    {dados && <>{!dados.itens.length && <p>Nenhum registro neste recorte.</p>}
      <div className="leite-tabela-scroll" tabIndex={0} aria-label={`Tabela de ${tipo}, com rolagem horizontal`}><table className="leite-consulta-cartoes"><caption>{tipo === "coletas" ? "Coletas pela data real" : "Vendas pelo período comercial"}</caption><thead><tr><th>{tipo === "coletas" ? "Data da coleta" : "Período"}</th><th>Comprador</th><th>Litros</th><th>Situação</th><th>Detalhe</th></tr></thead><tbody>{dados.itens.map(r => <tr key={r.id}><td data-rotulo={tipo === "coletas" ? "Data da coleta" : "Período"}>{tipo === "coletas" ? r.data ? dataPt(r.data) : "Data não informada" : `${dataPt(r.inicio)} a ${dataPt(r.fim)}`}</td><td data-rotulo="Comprador">{r.parceiroNome}</td><td data-rotulo="Litros">{formatarLitros(r.quantidadeLitros !== undefined ? Number(r.quantidadeLitros) : r.fechamento ? Number(r.fechamento.volumeReconhecido) : null)}</td><td data-rotulo="Situação">{tipo === "coletas" ? r.situacao === "PRECO_PENDENTE" ? "Preço pendente" : "Operação fechada" : r.fechamento?.valorTotal !== null && r.fechamento?.valorTotal !== undefined ? moeda(r.fechamento.valorTotal) : "Valores sem acesso"}</td><td data-rotulo="Detalhe"><a href={`/pecuaria/leite?leiteSecao=operacoes&operacaoLeiteId=${r.comercialId}&operacoesDe=${r.inicio}&operacoesAte=${r.fim}`}>Abrir operação e coletas</a>{r.fechamento?.amostras.map(a => <p key={a.amostraId}>{a.snapshot.formatoSnapshot.nome} · {dataPt(a.snapshot.data)} · amostra versão {a.versaoAmostra} · {a.snapshot.laudos.length} laudo(s)</p>)}</td></tr>)}</tbody></table></div>
      <div className="leite-form-inline"><button type="button" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Página anterior</button><span>Página {pagina}</span><button type="button" disabled={pagina * dados.porPagina >= dados.total} onClick={() => setPagina(p => p + 1)}>Próxima página</button></div>
    </>}
  </section>;
}
