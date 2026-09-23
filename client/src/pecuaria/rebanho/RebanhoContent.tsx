// Entrypoint do módulo Rebanho. A aba "pec-rebanho" é única — as cinco telas
// abaixo vivem todas sob o mesmo path canônico /pecuaria/rebanho e a navegação
// entre elas é só pushState + popstate (mesmo padrão de OperacoesFinanceiras),
// sem depender de react-router. App.tsx preserva a sub-rota via
// isSubrotaRebanho ao trocar de aba.

import { useEffect, useState } from "react";
import {
  isCadastrosRebanho,
  isListaAnimaisRebanho,
  isNovoAnimalRebanho,
  navegarPara,
  parseAnimalId,
} from "../../router";
import { VisaoGeral } from "./telas/VisaoGeral";
import { ListaAnimais } from "./telas/ListaAnimais";
import { NovoAnimal } from "./telas/NovoAnimal";
import { DetalheAnimal } from "./telas/DetalheAnimal";
import { Cadastros } from "./telas/Cadastros";

type Tela =
  | { tipo: "visao-geral" }
  | { tipo: "animais" }
  | { tipo: "novo-animal" }
  | { tipo: "detalhe-animal"; id: string }
  | { tipo: "cadastros" };

function telaDaUrl(pathname: string): Tela {
  const animalId = parseAnimalId(pathname);
  if (animalId) return { tipo: "detalhe-animal", id: animalId };
  if (isNovoAnimalRebanho(pathname)) return { tipo: "novo-animal" };
  if (isListaAnimaisRebanho(pathname)) return { tipo: "animais" };
  if (isCadastrosRebanho(pathname)) return { tipo: "cadastros" };
  return { tipo: "visao-geral" };
}

const URL_ANIMAIS = "/pecuaria/rebanho/animais";
const URL_NOVO_ANIMAL = "/pecuaria/rebanho/animais/novo";

export function RebanhoContent() {
  const [tela, setTela] = useState<Tela>(() => telaDaUrl(window.location.pathname));

  useEffect(() => {
    const aoNavegar = () => setTela(telaDaUrl(window.location.pathname));
    window.addEventListener("popstate", aoNavegar);
    return () => window.removeEventListener("popstate", aoNavegar);
  }, []);

  if (tela.tipo === "animais") {
    return <ListaAnimais
      onAbrirAnimal={(id) => navegarPara(`${URL_ANIMAIS}/${id}`)}
      onNovoAnimal={() => navegarPara(URL_NOVO_ANIMAL)}
    />;
  }
  if (tela.tipo === "novo-animal") {
    return <NovoAnimal onVoltar={() => navegarPara(URL_ANIMAIS)} />;
  }
  if (tela.tipo === "detalhe-animal") {
    return <DetalheAnimal id={tela.id} onVoltar={() => navegarPara(URL_ANIMAIS)} />;
  }
  if (tela.tipo === "cadastros") {
    return <Cadastros />;
  }
  return <VisaoGeral />;
}
