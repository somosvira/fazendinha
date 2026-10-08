import { NutricaoLote } from "./NutricaoLote";
import "./nutricao.css";

/** A manutenção central e a operação usam os mesmos rascunhos e versões. */
export function ReceitasDieta({ podeLancar }: { podeLancar: boolean }) {
  return <div className="nutricao-receitas"><NutricaoLote vista="receitas" podeLancar={podeLancar} /></div>;
}
