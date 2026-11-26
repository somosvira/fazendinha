import "./rebanho-layout.css";
import { ParticipantesAlertas } from "./alertas/ParticipantesAlertas";
import { CentralAlertas } from "./alertas/CentralAlertas";
// Entrypoint do módulo Rebanho. A aba "pec-rebanho" é única — as cinco telas
// abaixo vivem todas sob o mesmo path canônico /pecuaria/rebanho e a navegação
// entre elas é só pushState + popstate (mesmo padrão de OperacoesFinanceiras),
// sem depender de react-router. App.tsx preserva a sub-rota via
// isSubrotaRebanho ao trocar de aba.

import { useEffect, useRef, useState } from "react";
import {
  isCadastrosRebanho,
  isListaAnimaisRebanho,
  isListaLotesRebanho,
  isNovoAnimalRebanho,
  navegarPara,
  parseAnimalId,
  parseLoteId,
} from "../../router";
import { VisaoGeral } from "./telas/VisaoGeral";
import { ListaAnimais } from "./telas/ListaAnimais";
import { NovoAnimal } from "./telas/NovoAnimal";
import { DetalheAnimal } from "./telas/DetalheAnimal";
import { ListaLotes } from "./telas/ListaLotes";
import { DetalheLote } from "./telas/DetalheLote";
import { Cadastros } from "./telas/Cadastros";
import { Sanidade } from "./sanidade/Sanidade";
import { Nutricao } from "./nutricao/Nutricao";
import { abrirNovoAnimal, fecharNovoAnimal, linkFichaAnimal, linkFichaLote, retornoRebanhoDaUrl, rotuloRetornoRebanho } from "./lib/navegacao";

type Tela =
  | { tipo: "visao-geral" }
  | { tipo: "animais" }
  | { tipo: "novo-animal" }
  | { tipo: "detalhe-animal"; id: string }
  | { tipo: "lotes" }
  | { tipo: "detalhe-lote"; id: string }
  | { tipo: "cadastros" };
type TelaV3 = Tela | { tipo: "sanidade" | "nutricao" | "alertas" };

function telaDaUrl(pathname: string): TelaV3 {
  if (pathname.startsWith("/pecuaria/rebanho/alertas")) return { tipo: "alertas" };
  if (pathname === "/pecuaria/rebanho/sanidade") return { tipo: "sanidade" };
  if (pathname === "/pecuaria/rebanho/nutricao") return { tipo: "nutricao" };
  const animalId = parseAnimalId(pathname);
  if (animalId) return { tipo: "detalhe-animal", id: animalId };
  if (isNovoAnimalRebanho(pathname)) return { tipo: "novo-animal" };
  if (isListaAnimaisRebanho(pathname)) return { tipo: "animais" };
  const loteId = parseLoteId(pathname);
  if (loteId) return { tipo: "detalhe-lote", id: loteId };
  if (isListaLotesRebanho(pathname)) return { tipo: "lotes" };
  if (isCadastrosRebanho(pathname)) return { tipo: "cadastros" };
  return { tipo: "visao-geral" };
}

const URL_ANIMAIS = "/pecuaria/rebanho/animais";
const URL_LOTES = "/pecuaria/rebanho/lotes";

/** `podeLancar`: sem a flag `lancar` o módulo é só consulta — as telas escondem toda ação de escrita. */
function TelasRebanho({ podeLancar = true }: { podeLancar?: boolean }) {
  const [tela, setTela] = useState<TelaV3>(() => telaDaUrl(window.location.pathname));
  const anterior = useRef<TelaV3 | null>(null);

  useEffect(() => {
    const aoNavegar = () => setTela(atual => { const proxima = telaDaUrl(window.location.pathname); if (proxima.tipo === "novo-animal" && atual.tipo !== "novo-animal") anterior.current = window.history.state?.cadastroAnimalOrigem ? atual : null; return proxima; });
    window.addEventListener("popstate", aoNavegar);
    return () => window.removeEventListener("popstate", aoNavegar);
  }, []);

  if (tela.tipo === "animais" || tela.tipo === "novo-animal" && anterior.current?.tipo === "animais") {
    return <>
      <ListaAnimais podeLancar={podeLancar} onAbrirAnimal={(id) => navegarPara(linkFichaAnimal(id))} onNovoAnimal={abrirNovoAnimal} />
      {tela.tipo === "novo-animal" && <NovoAnimal podeLancar={podeLancar} onVoltar={fecharNovoAnimal} />}
    </>;
  }
  if (tela.tipo === "novo-animal" || tela.tipo === "visao-geral") {
    return <>
      {(tela.tipo === "visao-geral" || anterior.current?.tipo === "visao-geral") && <VisaoGeral podeLancar={podeLancar} />}
      {tela.tipo === "novo-animal" && <NovoAnimal podeLancar={podeLancar} onVoltar={fecharNovoAnimal} />}
    </>;
  }
  if (tela.tipo === "detalhe-animal") {
    return <DetalheAnimal id={tela.id} podeLancar={podeLancar} rotuloVoltar={rotuloRetornoRebanho(retornoRebanhoDaUrl(URL_ANIMAIS))} onVoltar={() => navegarPara(retornoRebanhoDaUrl(URL_ANIMAIS))} />;
  }
  if (tela.tipo === "lotes") {
    return <ListaLotes podeLancar={podeLancar} onAbrirLote={(id) => navegarPara(linkFichaLote(id))} />;
  }
  if (tela.tipo === "detalhe-lote") {
    return <DetalheLote id={tela.id} podeLancar={podeLancar} rotuloVoltar={rotuloRetornoRebanho(retornoRebanhoDaUrl(URL_LOTES))} onVoltar={() => navegarPara(retornoRebanhoDaUrl(URL_LOTES))} />;
  }
  if (tela.tipo === "cadastros") {
    return <Cadastros podeLancar={podeLancar} />;
  }
  if (tela.tipo === "alertas") return window.location.pathname.endsWith("/participantes") ? <ParticipantesAlertas /> : <CentralAlertas />;
  if (tela.tipo === "sanidade") return <Sanidade podeLancar={podeLancar} />;
  if (tela.tipo === "nutricao") return <Nutricao podeLancar={podeLancar} />;
  return <VisaoGeral podeLancar={podeLancar} />;
}

export function RebanhoContent(props: { podeLancar?: boolean }) {
  return <div className="rebanho-content"><TelasRebanho {...props} /></div>;
}
