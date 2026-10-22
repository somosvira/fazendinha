import { useEffect, useId, useState } from "react";
import { Slider } from "radix-ui";
import { Input } from "@/components/ui/input";
import { CampoFiltro, GrupoCamposFiltro } from "./PainelFiltros";
import { brl } from "./financeiro-ui";
import { valorMonetario } from "./lib/validacao";

const numeroValido = (texto: string) => {
  if (!texto.trim()) return null;
  const valor = valorMonetario(texto);
  return Number.isFinite(valor) && valor >= 0 ? valor : null;
};
const formatarLimite = (valor: number) => valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** O controle só edita os valores recebidos; o consumidor continua aplicando o rascunho. */
export function FiltroFaixaValor({ minimo, maximo, limiteSugerido, onMinimoChange, onMaximoChange, rotulo = "Valor da operação" }: {
  minimo: string; maximo: string; limiteSugerido: number; rotulo?: string;
  onMinimoChange: (valor: string) => void; onMaximoChange: (valor: string) => void;
}) {
  const tituloId = useId();
  const menor = numeroValido(minimo);
  const maior = numeroValido(maximo);
  const base = Number.isFinite(limiteSugerido) ? Math.max(1, limiteSugerido) : 1;
  const [limiteEscala, setLimiteEscala] = useState(() => Math.ceil(Math.max(base, menor ?? 0, maior ?? 0) * 100) / 100);
  // A escala pode crescer com a digitação, mas não encolhe durante um arraste.
  useEffect(() => { setLimiteEscala(atual => Math.max(atual, Math.ceil(Math.max(base, menor ?? 0, maior ?? 0) * 100) / 100)); }, [base, menor, maior]);
  const invalido = (!!minimo.trim() && menor == null) || (!!maximo.trim() && maior == null) || (menor != null && maior != null && menor > maior);
  const valorMinimo = Math.min(menor ?? 0, limiteEscala);
  const valorMaximo = Math.max(valorMinimo, Math.min(maior ?? limiteEscala, limiteEscala));
  const resumo = invalido ? "Confira os limites" : menor == null && maior == null ? "Todos os valores" : menor == null ? `Até ${brl(maior)}` : maior == null ? `A partir de ${brl(menor)}` : `${brl(menor)} a ${brl(maior)}`;
  return <div className="filtro-faixa-valor" role="group" aria-labelledby={tituloId}>
    <div className="filtro-faixa-cabecalho"><span id={tituloId}>{rotulo}</span><span className="filtro-faixa-resumo">{resumo}</span></div>
    <Slider.Root className="filtro-faixa-slider" value={[valorMinimo, valorMaximo]} min={0} max={limiteEscala} step={0.01} minStepsBetweenThumbs={0} preserveThumbOrder disabled={invalido} onValueChange={([de, ate]) => {
      if (de !== valorMinimo) onMinimoChange(de <= 0 ? "" : formatarLimite(de));
      if (ate !== valorMaximo) onMaximoChange(ate >= limiteEscala ? "" : formatarLimite(ate));
    }}>
      <Slider.Track className="filtro-faixa-trilho"><Slider.Range className="filtro-faixa-selecao" /></Slider.Track>
      <Slider.Thumb className="filtro-faixa-controle" aria-disabled={invalido || undefined} aria-label="Ajustar valor mínimo" aria-valuetext={menor == null ? "Sem mínimo" : brl(menor)} />
      <Slider.Thumb className="filtro-faixa-controle" aria-disabled={invalido || undefined} aria-label="Ajustar valor máximo" aria-valuetext={maior == null ? "Sem máximo" : brl(maior)} />
    </Slider.Root>
    <div className="filtro-faixa-escala" aria-hidden><span>{brl(0)}</span><span>{brl(limiteEscala)} ou mais</span></div>
    <GrupoCamposFiltro>
      <CampoFiltro rotulo="Mínimo (R$)"><Input aria-label="Valor mínimo" inputMode="decimal" placeholder="Sem mínimo" value={minimo} onChange={e => onMinimoChange(e.target.value)} /></CampoFiltro>
      <CampoFiltro rotulo="Máximo (R$)"><Input aria-label="Valor máximo" inputMode="decimal" placeholder="Sem máximo" value={maximo} onChange={e => onMaximoChange(e.target.value)} /></CampoFiltro>
    </GrupoCamposFiltro>
  </div>;
}
