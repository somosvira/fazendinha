import { BookOpen, Plus } from "lucide-react";
import { PainelCadastro } from "@/financeiro/PainelCadastro";
import { BarraConsulta, SituacoesConsulta } from "@/financeiro/BarraConsulta";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ErrorBox, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "../../../components/VisualizacaoConsulta";
import { quantidadeNutricional, un } from "./quantidades";
import type { Dieta } from "./api";

import { navegarPara } from "../../../router";
import { listarDietas, publicarDieta } from "./api";
import { useConsulta } from "./consulta";
import { rotaOperacaoNutricional, useFiltrosNutricionais } from "./navegacao";
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
  const visualizacao = useVisualizacaoConsulta("receitasVisualizacao", "nutricao", "tabela");
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
  // Cartão e tabela oferecem as mesmas ações: o nome abre a composição; ficam a secundária e a principal.
  const acoesReceita = (d: Dieta) => podeLancar && <>
    <Button secondary onClick={() => abrir(d.publicadaEm ? "versao" : "editar", d.id)}>{d.publicadaEm ? "Nova versão" : "Editar rascunho"}</Button>
    {d.publicadaEm ? <LinkNutricional className="nutricao-botao" href={rotaOperacaoNutricional("atribuir", undefined, undefined, d.id)}>Atribuir a lote</LinkNutricional> : <Button onClick={() => abrir("publicar", d.id)}>Publicar</Button>}
  </>;
  const nomeReceita = (d: Dieta) => <button type="button" className="nutricao-receita-nome" onClick={() => abrir("detalhe", d.id)}>{d.nome}</button>;
  const receitas = consulta.dados?.filter((d) => d.nome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")) && (!situacao || (situacao === "publicadas") === !!d.publicadaEm)) ?? [];
  return <div className="nutricao-receitas nutricao-conteudo"><EstadoConsulta erro={consulta.erro} carregando={consulta.carregando} recarregar={consulta.carregar} estrutura="cartoes" label="Carregando receitas de dieta…" />
    {url.form && !consulta.carregando && !consulta.erro && url.form !== "nova" && !dieta && <p role="alert">Receita não encontrada. <Button secondary onClick={() => abrir()}>Voltar às receitas</Button></p>}
    {consulta.dados && <><BarraConsulta acao={podeLancar ? <Button onClick={() => abrir("nova")}><Plus size={18} aria-hidden />Nova receita</Button> : undefined}><BuscaLista rotulo="Buscar receita" valor={busca} onChange={valor => atualizar({ buscaReceita: valor })} placeholder="Buscar receita pelo nome" /><SituacoesConsulta rotulo="Situação" valor={situacao} onChange={valor=>atualizar({situacaoReceita:valor})} opcoes={[{valor:"",texto:"Todas"},{valor:"publicadas",texto:"Publicadas"},{valor:"rascunhos",texto:"Rascunhos"}]} /><AlternarVisualizacaoConsulta {...visualizacao} rotulo="Visualização das receitas" /></BarraConsulta>
      {!receitas.length ? <Panel className="nutricao-vazio">{consulta.dados.length ? "Nenhuma receita corresponde aos filtros." : "Nenhuma receita cadastrada."}</Panel> : visualizacao.modo === "tabela" ? <TabelaFinanceira rotulo="Receitas de dieta" itens={receitas} chaveDe={(d) => d.id} colunas={[
        { chave: "receita", titulo: "Receita", principal: true, larguraFlexivel: true, celula: (d) => nomeReceita(d) },
        { chave: "versao", titulo: "Versão", larguraMinima: 80, celula: (d) => `v${d.versao}` },
        { chave: "situacao", titulo: "Situação", celula: (d) => <Pill tone={d.publicadaEm ? "green" : "amber"}>{d.publicadaEm ? "Publicada" : "Rascunho"}</Pill> },
        { chave: "ingredientes", titulo: "Ingredientes", alinhamento: "direita", celula: (d) => d.itens.length },
        { chave: "total", titulo: "Total por cabeça/dia", alinhamento: "direita", celula: (d) => totalPorCabeca(d) },
        { chave: "uso", titulo: "Uso vigente", larguraMinima: 200, celula: (d) => d.lotesEmUso?.length ? <span className="grid gap-1">{d.lotesEmUso.map((l) => <LinkNutricional key={l.id} href={rotaNutricao({ loteId: l.id })}>{l.nome} · {l.propriedade.nome}</LinkNutricional>)}</span> : "Sem uso vigente" },
        { chave: "acoes", titulo: "Ações", acoes: true, celula: (d) => <div className="flex flex-col items-stretch gap-2">{acoesReceita(d)}</div> },
      ]} /> : <div className="nutricao-receitas-grid">{receitas.map((d) => <Panel key={d.id} className={`nutricao-receita-card ${!d.publicadaEm ? "nutricao-receita-rascunho" : ""}`}>
        <header className="receita-identidade-nova">
          <div><h3>{nomeReceita(d)}</h3><p>v{d.versao} · {d.itens.length} {d.itens.length === 1 ? "ingrediente" : "ingredientes"} · {totalPorCabeca(d)} por cabeça/dia</p></div>
          <Pill tone={d.publicadaEm ? "green" : "amber"}>{d.publicadaEm ? "Publicada" : "Rascunho"}</Pill>
        </header>
        <ComposicaoCompacta dieta={d} />
        <p className="receita-uso-compacto">{d.lotesEmUso?.length ? <>Em uso: {d.lotesEmUso.map((l, i) => <span key={l.id}>{i > 0 && ", "}<LinkNutricional href={rotaNutricao({ loteId: l.id })}>{l.nome} · {l.propriedade.nome}</LinkNutricional></span>)}</> : "Sem lote usando esta receita."}</p>
        {podeLancar && <footer className="receita-acoes-novas">{acoesReceita(d)}</footer>}
      </Panel>)}</div>}

    </>}
  </div>;
}
/** Soma por unidade: receitas podem misturar KG, L e outras unidades sem somá-las entre si. */
function totalPorCabeca(d: Dieta) {
  const totais = new Map<string, number>();
  for (const item of d.itens) totais.set(item.unidade, (totais.get(item.unidade) ?? 0) + Number(item.quantidadeCabecaDia));
  return totais.size ? [...totais].map(([unidade, total]) => `${quantidadeNutricional(String(total))} ${un(unidade)}`).join(" + ") : "—";
}

/** Composição no cartão: uma barra por unidade com a participação de cada ingrediente e a lista ao lado. */
function ComposicaoCompacta({ dieta }: { dieta: Dieta }) {
  const grupos = new Map<string, Dieta["itens"]>();
  for (const item of dieta.itens) grupos.set(item.unidade, [...(grupos.get(item.unidade) ?? []), item]);
  return <div className="receita-compacta">{[...grupos].map(([unidade, itens]) => {
    const total = itens.reduce((s, i) => s + Number(i.quantidadeCabecaDia), 0);
    return <div key={un(unidade)} className="receita-compacta-grupo">
      <div className="receita-compacta-barra" aria-hidden>{itens.map((i, n) => <span key={i.produtoId} className={`receita-cor-${n % 3}`} style={{ width: `${total > 0 ? Number(i.quantidadeCabecaDia) / total * 100 : 0}%` }} />)}</div>
      <ul aria-label={`Ingredientes em ${un(unidade)} por cabeça/dia, com matéria seca`}>{itens.map((i, n) => <li key={i.produtoId}><i className={`receita-cor-${n % 3}`} aria-hidden /><span>{i.produto?.nome ?? "Produto indisponível"}</span><strong>{quantidadeNutricional(i.quantidadeCabecaDia)} {un(unidade)}</strong><small title="Matéria seca">{i.materiaSecaPercentualSnapshot == null ? "MS —" : `${quantidadeNutricional(i.materiaSecaPercentualSnapshot)}%`}</small></li>)}</ul>
    </div>;
  })}{!dieta.itens.length && <p className="nutricao-secundario">Nenhum ingrediente nesta receita.</p>}</div>;
}
