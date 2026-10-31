import { useEffect, useState } from "react";
import { dataRelativaFato } from "../lib/historicoAnimal";

function hojeSaoPaulo() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const valor = (tipo: string) => Number(partes.find(p => p.type === tipo)?.value);
  return new Date(valor("year"), valor("month") - 1, valor("day"));
}
export function TempoDesdeFato({ data }: { data: string }) {
  const [hoje, setHoje] = useState(hojeSaoPaulo);
  useEffect(() => {
    const atualizar = () => setHoje(hojeSaoPaulo());
    const timer = window.setInterval(atualizar, 30_000);
    window.addEventListener("focus", atualizar);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", atualizar); };
  }, []);
  return <>{dataRelativaFato(data, hoje)}</>;
}
