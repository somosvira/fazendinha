import { usePropriedades } from "../../../api/propriedades";
import { useEffect, useState } from "react";
import { Button, ErrorBox, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";
import { criteriosVazios, validarCriterios, enumerados } from "./EditorSelecaoVisita";
import { FiltrosSelecaoLivre } from "./FiltrosSelecaoLivre";
import { obterOpcoesSelecao, previaGrupo, type AnimalPlanner, type CriteriosSelecao, type OpcoesSelecao } from "./planner-api";
import { Paginacao } from "../ui";
import "./visitas-fluxo.css";

const vazias: OpcoesSelecao = { lotes: [], categorias: [], racas: [], protocolos: [], tiposExame: [] };
export function SelecaoAnimaisProgramacao({ propriedadeId, data, selecionados, onSelecionados, onIdentificados }: { propriedadeId: number; data: string; selecionados: string[]; onSelecionados: (ids: string[]) => void; onIdentificados: (animais: AnimalPlanner[]) => void }) {
  const {data: sitios} = usePropriedades();
  const [criterios, setCriterios] = useState(criteriosVazios);
  const [rascunho, setRascunho] = useState<CriteriosSelecao | null>(null);
  const [opcoes, setOpcoes] = useState(vazias);
  const [animais, setAnimais] = useState<AnimalPlanner[]>([]);
  const [paginaTabela, setPaginaTabela] = useState(1);
  const [pagina, setPagina] = useState(1), [total, setTotal] = useState(0);
  const [erro, setErro] = useState<string | null>(null), [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  useEffect(()=>setPaginaTabela(1),[data,propriedadeId,criterios,busca,pagina]);
  useEffect(() => { setPagina(1); }, [propriedadeId, data]);
  useEffect(() => { let vivo = true; void obterOpcoesSelecao(propriedadeId, data).then(o => { if (vivo) setOpcoes(o); }).catch(e => { if (vivo) setErro(String(e)); }); return () => { vivo = false; }; }, [propriedadeId, data]);
  useEffect(() => {
    let vivo = true; setCarregando(true); setErro(null);
    const problema = validarCriterios(criterios);
    if (problema) { setErro(problema); setCarregando(false); return; }
    const timer = window.setTimeout(() => {
      const consulta = { ...criterios, todas: [...criterios.todas, ...(busca.trim() ? [{ tipo: "VALORES" as const, campo: "BUSCA" as const, valores: [busca.trim()] }] : [])] };
      void previaGrupo(propriedadeId, data, { origem: "LIVRE", nome: "Participantes do protocolo", criterios: consulta, tipo: "INICIAR_IATF", incluidosManualmente: [] }, pagina).then(p => { if (vivo) { setAnimais(p.animais); setTotal(p.total); onIdentificados(p.animais); } }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); });
    }, 250);
    return () => { vivo = false; window.clearTimeout(timer); };
  }, [propriedadeId, data, criterios, busca, pagina, onIdentificados]);
  return <section className="grid gap-3" aria-label="Seleção de participantes">
    <div className="flex flex-wrap items-end justify-between gap-3"><label>Buscar animais<input className="block rounded-lg border p-2" type="search" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} placeholder="Brinco ou nome" /></label><Button secondary onClick={() => setRascunho(structuredClone(criterios))}>Filtros dos animais</Button><strong>{selecionados.length}/100 selecionados</strong></div>
    <ErrorBox erro={erro} />{carregando && <p role="status">Consultando animais na data de referência…</p>}
    {!carregando && !erro && <><TabelaFinanceira visualizacao="tabela" rotulo="Animais disponíveis" itens={animais.slice((paginaTabela-1)*10,paginaTabela*10)} chaveDe={a=>a.animalId} colunas={[
      {chave:"selecao",titulo:"",celula:a=><input type="checkbox" aria-label={`Selecionar ${a.brinco ?? a.nome ?? "animal"}`} checked={selecionados.includes(a.animalId)} disabled={!selecionados.includes(a.animalId)&&selecionados.length>=100} onChange={e=>onSelecionados(e.target.checked?[...selecionados,a.animalId]:selecionados.filter(id=>id!==a.animalId))}/>},
      {chave:"animal",titulo:"Animal",principal:true,celula:a=><span>{a.brinco ?? "Sem brinco"}<small className="block">{a.nome ?? "Sem nome"}</small>{a.motivos.length>0&&<small className="block">{a.motivos.join(" · ")}</small>}</span>},
      {chave:"lote",titulo:"Lote",celula:a=>a.lote?.nome??"Sem lote"},
      {chave:"categoria",titulo:"Categoria",celula:a=>a.categoria?.nome??"Não informada"},
      {chave:"situacao",titulo:"Situação reprodutiva",celula:a=>enumerados.SITUACAO?.find(o=>o.id===a.situacao)?.nome??"Não informada"},
    ]}/>{animais.length>10&&<Paginacao paginaAtual={paginaTabela} totalPaginas={Math.ceil(animais.length/10)} totalItens={animais.length} itensPorPagina={10} onPaginaChange={setPaginaTabela} rotulo="animais desta consulta" idSelect="pagina-tabela-programacao"/>}{total > 200 && <Paginacao paginaAtual={pagina} totalPaginas={Math.ceil(total / 200)} totalItens={total} itensPorPagina={200} onPaginaChange={setPagina} rotulo="animais" idSelect="pagina-selecao-programacao" />}</>}
    <p className="text-sm">A seleção é preservada ao buscar ou filtrar. Selecionar não declara aptidão clínica.</p>
    {rascunho && <PainelCadastro aberto largura="sm:max-w-5xl" titulo="Filtros dos animais" onFechar={() => setRascunho(null)} rodape={<><Button secondary onClick={() => setRascunho(null)}>Cancelar</Button><Button onClick={() => { const problema = validarCriterios(rascunho); if (problema) { setErro(problema); return; } setCriterios(rascunho); setPagina(1); setRascunho(null); }}>Aplicar filtros</Button></>}><FiltrosSelecaoLivre criterios={rascunho} onMudar={setRascunho} opcoes={opcoes} data={data} contexto="programacao" sitio={sitios.find(sitio => sitio.id === propriedadeId)?.nome ?? "Sítio selecionado"} /></PainelCadastro>}
  </section>;
}
