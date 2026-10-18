import { useEffect, useState } from "react";
import { Pill } from "../../../financeiro/financeiro-ui";
import type { CarenciaAnimal } from "../sanidade/api";

/** Evidências atuais; ausência de registro não significa ausência de doença. */
export function SinaisClinicosAnimal({ situacao, carencia }: { situacao: string | null; carencia: CarenciaAnimal | null }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const atualizar = () => setAgora(Date.now());
    const timer = window.setInterval(atualizar, 60_000);
    window.addEventListener("focus", atualizar);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", atualizar); };
  }, []);
  const rotulos: Record<string, string> = { GESTANTE: "Gestante", VAZIA: "Vazia", DESCONHECIDA: "Reprodução a conferir" };
  const destinos = carencia ? (["leite", "carne"] as const).filter(d => {
    const prazo = carencia[d];
    return prazo.estado === "CONHECIDO" && !prazo.prazoZero && new Date(prazo.ate).getTime() > agora;
  }) : [];
  const revisar = carencia && (carencia.revisaoLeitePendente || carencia.revisaoAdministracaoPendente || carencia.leite.estado === "NAO_INFORMADO" || carencia.carne.estado === "NAO_INFORMADO");
  return <>
    {situacao && <Pill tone={situacao === "GESTANTE" ? "green" : situacao === "VAZIA" ? "neutral" : "amber"}>{rotulos[situacao] ?? "Reprodução a conferir"}</Pill>}
    {destinos.length > 0 && <Pill tone="red">Carência: {destinos.map(d => d === "carne" ? "abate" : "leite").join(" e ")}</Pill>}
    {revisar && <Pill tone="amber">Carência a conferir</Pill>}
  </>;
}
