import { useEffect, useState } from "react";
import { Pill } from "../../../financeiro/financeiro-ui";
import type { AnimalFicha } from "../types";
import type { CarenciaAnimal } from "../sanidade/api";

/** Evidências atuais; ausência de registro não significa ausência de doença. */
export function SinaisClinicosAnimal({ situacao, carencia, situacaoProdutiva }: { situacao: string | null; carencia: CarenciaAnimal | null; situacaoProdutiva?: NonNullable<AnimalFicha["contextoProdutivo"]>["situacaoProdutiva"] | null }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const atualizar = () => setAgora(Date.now());
    const timer = window.setInterval(atualizar, 60_000);
    window.addEventListener("focus", atualizar);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", atualizar); };
  }, []);
  const rotulos: Record<string, string> = { GESTANTE: "Gestante", VAZIA: "Vazia" };
  const destinos = carencia ? (["leite", "carne"] as const).filter(d => {
    const prazo = carencia[d];
    return prazo.estado === "CONHECIDO" && !prazo.prazoZero && new Date(prazo.ate).getTime() > agora;
  }) : [];
  return <>
    {situacao && rotulos[situacao] && <Pill tone={situacao === "GESTANTE" ? "green" : situacao === "VAZIA" ? "neutral" : "amber"}>{rotulos[situacao]}</Pill>}
    {situacaoProdutiva === "SECA" && <Pill tone="neutral">Seca</Pill>}
    {destinos.length > 0 && <Pill tone="red">Em carência</Pill>}
  </>;
}
