import { useCallback, useEffect, useState } from "react";
import { Button, ErrorBox, Panel, Pill } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { navegarPara } from "../../../router";
import { listarDietas, publicarDieta } from "./api";
import { useConsulta } from "./consulta";
import { useFiltrosNutricionais } from "./navegacao";
import { EstadoConsulta, LinkNutricional, rotaNutricao } from "./componentes";
import { FormReceitaDieta } from "./FormReceitaDieta";
import "./nutricao.css";

function estadoReceita() { const p = new URLSearchParams(window.location.search); return { form: p.get("formReceita"), id: p.get("receitaId") }; }
/** Configurações e Nutrição compartilham o mesmo catálogo e os mesmos formulários. */
export function ReceitasDieta({ podeLancar }: { podeLancar: boolean }) {
  const consulta = useConsulta(useCallback(listarDietas, []));
  const [url, setUrl] = useState(estadoReceita);
  const { params, atualizar } = useFiltrosNutricionais();
  const busca = params.get("buscaReceita") ?? "";
  const situacao = params.get("situacaoReceita") ?? "";
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { const restaurar = () => { setUrl(estadoReceita()); setErro(null); }; window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar); }, []);
  function abrir(form?: string, id?: string) {
    const alvo = new URL(window.location.href); ["formReceita", "receitaId"].forEach((k) => alvo.searchParams.delete(k));
    if (form) alvo.searchParams.set("formReceita", form); if (id) alvo.searchParams.set("receitaId", id);
    navegarPara(alvo.pathname + alvo.search);
  }
  const dieta = consulta.dados?.find((d) => d.id === url.id);
  async function confirmarPublicacao(id: string) {
    if (ocupado) return;
    setOcupado(true); setErro(null);
    try { await publicarDieta(id); abrir(); await consulta.carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); }
  }
  if (podeLancar && (url.form === "nova" || (dieta && (url.form === "editar" && !dieta.publicadaEm || url.form === "versao")))) return <FormReceitaDieta key={`${url.form}:${url.id}`} dieta={dieta} editar={url.form === "editar"} onVoltar={() => abrir()} onSalvo={() => { abrir(); void consulta.carregar(); }} />;
  if (dieta && (url.form === "detalhe" || url.form === "publicar" && podeLancar && !dieta.publicadaEm)) return <Panel className="nutricao-conteudo"><div className="nutricao-card-cabecalho"><div><h2 className="h3">{url.form === "publicar" ? "Publicar receita" : dieta.nome}</h2><p>{dieta.nome} · versão {dieta.versao}</p></div><Pill tone={dieta.publicadaEm ? "green" : "amber"}>{dieta.publicadaEm ? "Publicada" : "Rascunho"}</Pill></div><div className="nutricao-card-corpo"><ErrorBox erro={erro} /><h3 className="h3">Composição por cabeça/dia</h3><div className="nutricao-tabela-scroll"><table className="nutricao-tabela"><thead><tr><th>Ingrediente</th><th>Quantidade diária</th><th>Matéria seca</th></tr></thead><tbody>{dieta.itens.map((i) => <tr key={i.produtoId}><td>{i.produto?.nome}</td><td>{i.quantidadeCabecaDia} {i.unidade}</td><td>{i.materiaSecaPercentualSnapshot == null ? "Não informada" : `${i.materiaSecaPercentualSnapshot}%`}</td></tr>)}</tbody></table></div>{url.form === "publicar" && <p className="nutricao-aviso">Após a publicação, esta versão será preservada e poderá ser atribuída aos lotes. Para alterar a composição, crie uma nova versão.</p>}</div><div className="nutricao-form-rodape"><Button secondary disabled={ocupado} onClick={() => abrir()}>{url.form === "publicar" ? "Cancelar" : "Voltar às receitas"}</Button>{url.form === "publicar" && <Button disabled={ocupado} onClick={() => void confirmarPublicacao(dieta.id)}>{ocupado ? "Publicando…" : "Confirmar publicação"}</Button>}</div></Panel>;
  const receitas = consulta.dados?.filter((d) => d.nome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")) && (!situacao || (situacao === "publicadas") === !!d.publicadaEm)) ?? [];
  return <div className="nutricao-receitas nutricao-conteudo"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="h3">Receitas de dieta</h2><p className="nutricao-nota">Versões publicadas e rascunhos em um catálogo compartilhado.</p></div>{podeLancar && <Button onClick={() => abrir("nova")}>Nova receita</Button>}</div><EstadoConsulta erro={consulta.erro} carregando={consulta.carregando} recarregar={consulta.carregar} />
    {url.form && !consulta.carregando && !consulta.erro && url.form !== "nova" && !dieta && <p role="alert">Receita não encontrada. <Button secondary onClick={() => abrir()}>Voltar às receitas</Button></p>}
    {consulta.dados && <><div className="nutricao-filtros"><label>Buscar receita<input type="search" className={classeInput} value={busca} onChange={(e) => atualizar({ buscaReceita: e.target.value })} placeholder="Nome da receita" /></label><label>Situação<select className={classeInput} value={situacao} onChange={(e) => atualizar({ situacaoReceita: e.target.value })}><option value="">Todas</option><option value="publicadas">Publicadas</option><option value="rascunhos">Rascunhos</option></select></label></div>
      {!receitas.length ? <Panel className="nutricao-vazio">{consulta.dados.length ? "Nenhuma receita corresponde aos filtros." : "Nenhuma receita cadastrada."}</Panel> : <div className="nutricao-receitas-grid">{receitas.map((d) => <Panel key={d.id} className="nutricao-receita-card"><div className="nutricao-card-corpo"><div className="flex items-start justify-between gap-3"><span className="nutricao-versao">VERSÃO {d.versao}</span><Pill tone={d.publicadaEm ? "green" : "amber"}>{d.publicadaEm ? "Publicada" : "Rascunho"}</Pill></div><h3 className="font-serif text-xl mt-3">{d.nome}</h3><p className="nutricao-nota">{d.itens.length} ingredientes · composição por cabeça/dia</p><ul className="nutricao-ingredientes">{d.itens.map((i) => <li key={i.produtoId}><strong>{i.produto?.nome}</strong><span>{i.quantidadeCabecaDia} {i.unidade}<small>MS {i.materiaSecaPercentualSnapshot == null ? "não informada" : `${i.materiaSecaPercentualSnapshot}%`}</small></span></li>)}</ul><div className="nutricao-uso-receita"><p className="nutricao-nota">{d.lotesEmUso?.length ? `Em uso em ${d.lotesEmUso.length} lote(s)` : "Sem uso vigente neste contexto"}</p>{d.lotesEmUso?.map((l) => <LinkNutricional key={l.id} href={rotaNutricao({ loteId: l.id })}>{l.nome} · {l.propriedade.nome}</LinkNutricional>)}</div></div>
        <div className="nutricao-receita-rodape"><button className="nutricao-link" type="button" onClick={() => abrir("detalhe", d.id)}>Ver composição</button>{podeLancar && <><button className="nutricao-link" type="button" onClick={() => abrir(d.publicadaEm ? "versao" : "editar", d.id)}>{d.publicadaEm ? "Criar nova versão a partir desta" : "Editar rascunho"}</button>{!d.publicadaEm && <Button secondary onClick={() => abrir("publicar", d.id)}>Publicar</Button>}</>}</div>
      </Panel>)}</div>}
    </>}
  </div>;
}
