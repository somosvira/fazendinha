import { useState } from "react";
import { SubTabs, type SubTab } from "@/components/SubTabs";
import { AcasalamentoPlanosTab } from "./AcasalamentoPlanosTab";
import { IndicadoresGeneticosSection } from "./IndicadoresGeneticosSection";
import { MedidasAcasalamentoSection } from "./MedidasAcasalamentoSection";
import { RebMain } from "@/components/rb/RebPrimitives";

type Sub = "planos" | "indicadores" | "medidas";

export function AcasalamentoHub({ onAbrirFicha }: { onAbrirFicha?: (animalId: string) => void }) {
  const [sub, setSub] = useState<Sub>("planos");
  const tabs: SubTab<Sub>[] = [
    { id: "planos", label: "Planos" },
    { id: "indicadores", label: "Indicadores genéticos" },
    { id: "medidas", label: "Medidas e combinações" },
  ];

  if (sub === "planos") return (
    <>
      <div className="mx-auto w-full max-w-[1520px] px-[clamp(24px,4vw,56px)] pt-7 min-[1700px]:px-[clamp(40px,5vw,96px)]">
        <SubTabs tabs={tabs} active={sub} onSelect={setSub} />
      </div>
      <AcasalamentoPlanosTab onAbrirFicha={onAbrirFicha} />
    </>
  );

  return (
    <RebMain>
      <SubTabs tabs={tabs} active={sub} onSelect={setSub} />
      <div className="mt-6">{sub === "indicadores" ? <IndicadoresGeneticosSection /> : <MedidasAcasalamentoSection />}</div>
    </RebMain>
  );
}
