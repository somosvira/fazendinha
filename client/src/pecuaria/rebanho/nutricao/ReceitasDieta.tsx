import { BookOpen, Plus, Leaf, Layers } from "lucide-react";
import { PainelCadastro } from "@/financeiro/PainelCadastro";
import { BarraConsulta, SituacoesConsulta } from "@/financeiro/BarraConsulta";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ErrorBox, Panel, Pill } from "../../../financeiro/financeiro-ui";

import { navegarPara } from "../../../router";
import { listarDietas, publicarDieta } from "./api";
import { useConsulta } from "./consulta";
import { useFiltrosNutricionais } from "./navegacao";
import { EstadoConsulta, LinkNutricional, rotaNutricao } from "./componentes";
import { FormReceitaDieta } from "./FormReceitaDieta";
import "./nutricao.css";

import { ComposicaoReceita } from "./ComposicaoReceita";
import { BuscaLista } from "../../../components/BuscaLista";

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
  const enviando = useRef(false);
  useEffect(() => { const restaurar = () => { setUrl(estadoReceita()); setErro(null); }; window.addEventListener("popstate", restaurar); return () => window.removeEventListener("popstate", restaurar); }, []);
  function abrir(form?: string, id?: string) {
    const alvo = new URL(window.location.href); ["formReceita", "receitaId"].forEach((k) => alvo.searchParams.delete(k));
    if (form) alvo.searchParams.set("formReceita", form); if (id) alvo.searchParams.set("receitaId", id);
    navegarPara(alvo.pathname + alvo.search);
  }
  const dieta = consulta.dados?.find((d) => d.id === url.id);
  async function confirmarPublicacao(id: string) {
    if (enviando.current || !podeLancar) return;
    enviando.current = true; setOcupado(true); setErro(null);
    try { await publicarDieta(id); abrir(); await consulta.carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { enviando.current = false; setOcupado(false); }
  }
  if (podeLancar && (url.form === "nova" || (dieta && (url.form === "editar" && !dieta.publicadaEm || url.form === "versao")))) return <FormReceitaDieta key={`${url.form}:${url.id}`} dieta={dieta} editar={url.form === "editar"} onVoltar={() => abrir()} onSalvo={() => { abrir(); void consulta.carregar(); }} />;
  if (dieta && (url.form === "detalhe" || url.form === "publicar" && podeLancar && !dieta.publicadaEm)) return <PainelCadastro aberto titulo={url.form === "publicar" ? "Publicar receita" : dieta.nome} icon={BookOpen} onFechar={() => abrir()} bloqueado={ocupado} largura="sm:max-w-4xl" rodape={<><Button secondary disabled={ocupado} onClick={() => abrir()}>{url.form === "publicar" ? "Cancelar" : "Voltar às receitas"}</Button>{url.form === "publicar" && <Button disabled={ocupado} onClick={() => void confirmarPublicacao(dieta.id)}>{ocupado ? "Publicando…" : "Confirmar publicação"}</Button>}</>}><div className="nutricao-conteudo"><div className="nutricao-card-cabecalho"><p>{url.form === "publicar" ? `${dieta.nome} · ` : ""}Versão {dieta.versao}</p><Pill tone={dieta.publicadaEm ? "green" : "amber"}>{dieta.publicadaEm ? "Publicada" : "Rascunho"}</Pill></div><div className="nutricao-card-corpo"><ErrorBox erro={erro} /><ComposicaoReceita dieta={dieta} />{url.form === "publicar" && <p className="nutricao-aviso">Após a publicação, esta versão será preservada e poderá ser atribuída aos lotes. Para alterar a composição, crie uma nova versão.</p>}</div></div></PainelCadastro>;
  const receitas = consulta.dados?.filter((d) => d.nome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")) && (!situacao || (situacao === "publicadas") === !!d.publicadaEm)) ?? [];
  return <div className="nutricao-receitas nutricao-conteudo"><EstadoConsulta erro={consulta.erro} carregando={consulta.carregando} recarregar={consulta.carregar} estrutura="cartoes" label="Carregando receitas de dieta…" />
    {url.form && !consulta.carregando && !consulta.erro && url.form !== "nova" && !dieta && <p role="alert">Receita não encontrada. <Button secondary onClick={() => abrir()}>Voltar às receitas</Button></p>}
    {consulta.dados && <><BarraConsulta acao={podeLancar ? <Button onClick={() => abrir("nova")}><Plus size={18} aria-hidden />Nova receita</Button> : undefined}><BuscaLista rotulo="Buscar receita" valor={busca} onChange={valor => atualizar({ buscaReceita: valor })} placeholder="Buscar receita pelo nome" /><SituacoesConsulta rotulo="Situação" valor={situacao} onChange={valor=>atualizar({situacaoReceita:valor})} opcoes={[{valor:"",texto:"Todas"},{valor:"publicadas",texto:"Publicadas"},{valor:"rascunhos",texto:"Rascunhos"}]} /></BarraConsulta>
      {!receitas.length ? <Panel className="nutricao-vazio">{consulta.dados.length ? "Nenhuma receita corresponde aos filtros." : "Nenhuma receita cadastrada."}</Panel> : <div className="nutricao-receitas-grid">{receitas.map((d) => <Panel key={d.id} className={`nutricao-receita-card ${!d.publicadaEm ? "nutricao-receita-rascunho" : ""}`}>
        <header className="receita-identidade-nova">
          <span className="receita-emblema" aria-hidden="true"><BookOpen size={24} /></span>
          <div><h3>{d.nome}</h3><p>Versão {d.versao}</p></div>
          <Pill tone={d.publicadaEm ? "green" : "amber"}>{d.publicadaEm ? "Publicada" : "Rascunho"}</Pill>
        </header>
        <div className="receita-dados-operacionais"><span><Leaf size={18} aria-hidden="true" /><strong>{d.itens.length}</strong> {d.itens.length === 1 ? "ingrediente" : "ingredientes"}</span><span><Layers size={18} aria-hidden="true" /><strong>{d.lotesEmUso?.length ?? 0}</strong> {(d.lotesEmUso?.length ?? 0) === 1 ? "lote em uso" : "lotes em uso"}</span></div>
        <div className="receita-composicao-direta"><ComposicaoReceita dieta={d} /></div>
        <div className="nutricao-uso-receita receita-uso-direto"><h4>Uso vigente</h4>{d.lotesEmUso?.length ? d.lotesEmUso.map((l) => <LinkNutricional key={l.id} href={rotaNutricao({ loteId: l.id })}>{l.nome} · {l.propriedade.nome}</LinkNutricional>) : <p>Sem uso vigente neste contexto</p>}</div>
        {podeLancar && <footer className="receita-acoes-novas"><Button secondary className="nutricao-receita-acao" onClick={() => abrir(d.publicadaEm ? "versao" : "editar", d.id)}>{d.publicadaEm ? "Criar nova versão a partir desta" : "Editar rascunho"}</Button>{!d.publicadaEm && <Button className="nutricao-receita-acao" onClick={() => abrir("publicar", d.id)}>Publicar</Button>}</footer>}
      </Panel>)}</div>}

    </>}
  </div>;
}
