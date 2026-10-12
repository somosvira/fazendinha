import { navegarPara } from "../../../router";
import { ListaAnimais } from "./ListaAnimais";

/** Compartilha consulta, filtros e seleção com Animais; a gravação permanece no painel existente. */
export function PesagemManejo({ podeLancar = true }: { podeLancar?: boolean }) {
  return <ListaAnimais variante="pesagem" podeLancar={podeLancar} onAbrirAnimal={(id) => navegarPara(`/pecuaria/rebanho/animais/${id}`)} onNovoAnimal={() => navegarPara("/pecuaria/rebanho/animais/novo")} />;
}
