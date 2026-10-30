import { AjudaCampo } from "../../../components/Dica";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, ArrowRight, CalendarDays, GitBranch, HeartPulse, SlidersHorizontal } from "lucide-react";
import type { ModoVisita } from "../../../router";
import "./visitas-fluxo.css";
import "./entrada-visita.css";

export function EntradaVisita({ contexto, ocupado, podeLancar, onContinuar, onVoltar, existente = false }: { contexto: ReactNode; ocupado: boolean; podeLancar: boolean; onContinuar: (modo: ModoVisita) => void; onVoltar: () => void; existente?: boolean }) {
  const [modo,setModo]=useState<ModoVisita|null>(null);
  const passos=modo==='agenda'?['Escolher grupos da agenda','Revisar animais','Preparar atendimento']:modo==='livre'?['Filtrar animais','Revisar seleção e atividade','Preparar atendimento']:['Escolher grupos ou animais','Revisar seleção','Preparar atendimento'];
  return <section className={`visita-fluxo visita-entrada entrada-compacta ${existente ? "entrada-existente" : "entrada-nova"}`}>
    <div className="visita-breadcrumb"><span>Visitas veterinárias</span><span>/</span><span>{existente?'Adicionar grupo':'Nova visita'}</span></div>
    <header className="visita-cabecalho"><h1>{existente?'Adicionar grupo':'Nova visita'}</h1></header>
    <form id="entrada-visita" onSubmit={e=>{e.preventDefault();if(modo&&(podeLancar||existente)&&!ocupado)onContinuar(modo);}}>
      <div className="entrada-conteudo"><section className={existente?'entrada-contexto':'visita-painel'} aria-label="Dados da visita">{!existente&&<div className="visita-painel-cabecalho"><h2>Dados da visita</h2></div>}<div className={existente?'entrada-fatos':'livre-corpo livre-grid'}>{contexto}</div></section>
      <section className="entrada-percurso"><header className="entrada-escolha-cab"><div><h2 id="escolha-percurso">Como você quer escolher os animais?</h2></div><AjudaCampo rotulo="Sobre adicionar grupos" texto={`Escolher o caminho não inclui animais nem registra procedimentos. ${existente?'Os grupos já preparados continuam nesta visita. Na agenda, consulte Reprodução e Sanidade, com protocolos, etapas e retornos. Na seleção livre, use filtros salvos e ajustes manuais; a atividade é definida depois da revisão.':'Você poderá adicionar outros grupos depois.'}`}/></header>
      <RadioGroup className="entrada-opcoes" aria-labelledby="escolha-percurso" value={modo??''} onValueChange={v=>setModo(v as ModoVisita)} disabled={ocupado}>
        <label htmlFor="entrada-agenda" className="entrada-opcao"><div className="entrada-opcao-topo"><span><CalendarDays size={21}/></span><h3>Agenda do dia</h3><RadioGroupItem id="entrada-agenda" value="agenda"/></div><div className="entrada-agenda"><div><GitBranch size={17}/><div><strong>Reprodução</strong><span>Protocolos, etapas e retornos</span></div></div><div><HeartPulse size={17}/><div><strong>Sanidade</strong><span>Grupos previstos para o dia</span></div></div></div></label>
        <label htmlFor="entrada-livre" className="entrada-opcao"><div className="entrada-opcao-topo"><span><SlidersHorizontal size={21}/></span><h3>Seleção livre</h3><RadioGroupItem id="entrada-livre" value="livre"/></div><div className="entrada-filtros"><strong>Critérios da seleção</strong><div><span>Lote</span><span>Categoria</span><span>Situação reprodutiva</span></div></div></label>
      </RadioGroup></section></div>
      <div className="entrada-passos" aria-label="Próximos passos"><strong>Depois da escolha</strong><ol>{passos.map((p,i)=><li key={p}><span>{i+1}</span>{p}{i<2&&<ArrowRight size={14}/>}</li>)}</ol></div>
      <footer className="entrada-acoes"><Button type="button" variant="ghost" disabled={ocupado} onClick={onVoltar}><ArrowLeft size={16}/>{existente?'Voltar ao atendimento':'Cancelar'}</Button><Button type="submit" disabled={!modo||ocupado||(!podeLancar&&!existente)}>{ocupado?(existente?'Abrindo seleção…':'Criando visita…'):modo==='agenda'?'Continuar para a agenda':modo==='livre'?'Continuar para os filtros':'Escolha um caminho'}<ArrowRight size={16}/></Button></footer>
    </form>
  </section>;
}
