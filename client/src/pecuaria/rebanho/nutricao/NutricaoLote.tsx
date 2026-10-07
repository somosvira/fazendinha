import { useState } from "react";
import { Button } from "../../../financeiro/financeiro-ui";
import { AtribuicoesNutricionais } from "./AtribuicoesNutricionais";
import { ConsumosNutricionais } from "./ConsumosNutricionais";

/** A ficha usa versões já publicadas. A criação de dietas fica no cadastro global. */
export function NutricaoLote({ loteId, propriedadeId, podeLancar, vista }: { loteId?: string; propriedadeId?: number; podeLancar: boolean; vista?: "lotes" | "receitas" | "fechamentos" }) {
  const [aba, setAba] = useState<"atribuicoes" | "consumos">(vista === "fechamentos" ? "consumos" : "atribuicoes");
  return <section className="mt-5">
    {!vista && <div className="flex flex-wrap gap-2"><Button secondary={aba !== "atribuicoes"} onClick={() => setAba("atribuicoes")}>Dietas e atribuições</Button><Button secondary={aba !== "consumos"} onClick={() => setAba("consumos")}>Consumos do lote</Button><a className="self-center text-sm underline" href="/pecuaria/rebanho/nutricao?aba=dietas">Consultar cadastro de dietas</a></div>}
    {aba === "atribuicoes" ? <AtribuicoesNutricionais loteId={loteId} propriedadeId={propriedadeId} podeLancar={podeLancar} /> : <ConsumosNutricionais loteId={loteId} propriedadeId={propriedadeId} podeLancar={podeLancar} />}
  </section>;
}
