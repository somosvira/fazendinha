import { ConsultaOperacional } from "@/components/ConsultaOperacional";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Activity } from "lucide-react";
import { CardFicha } from "../ui";
import type { AnimalFicha } from "../types";
import { formatarDataBR } from "../lib/rotulos";
export function EvolucaoEcc({ historico = [] }: { historico?: AnimalFicha["historicoEcc"] }) {
  const escalas = [...new Set(historico.filter(e => e.escalaMin !== null && e.escalaMax !== null).map(e => `${e.escalaMin}:${e.escalaMax}`))];
  return <CardFicha titulo="Condição corporal (ECC)" icon={Activity}>
    <p className="text-sm text-muted-foreground">Acompanhamento por data e escala. ECC não determina aptidão nem gera avisos nesta etapa.</p>
    {!historico.length ? <p>Nenhum ECC registrado.</p> : <>
      {escalas.map(escala => { const [min, max] = escala.split(":").map(Number); const pontos = historico.filter(e => e.valor !== null && e.escalaMin === min && e.escalaMax === max);
        return <div key={escala} className="mt-3"><p>Escala {min}–{max}</p>{pontos.length > 1 ? <div className="h-48" role="img" aria-label={`Evolução de ECC na escala ${min} a ${max}; valores no histórico abaixo`}><ResponsiveContainer width="100%" height="100%"><LineChart data={pontos}><CartesianGrid vertical={false}/><XAxis dataKey="data" tickFormatter={formatarDataBR}/><YAxis domain={[min,max]}/><Tooltip labelFormatter={v => formatarDataBR(String(v))}/><Line dataKey="valor" name="ECC" stroke="var(--color-primary, #326861)" strokeWidth={2} connectNulls={false}/></LineChart></ResponsiveContainer></div> : <p>Um registro nesta escala; a curva exige duas avaliações.</p>}</div>; })}
      <ConsultaOperacional rotulo="Histórico de ECC" itens={[...historico].reverse()} chaveDe={e => e.id} colunas={[
        { chave: "data", titulo: "Data", principal: true, celula: e => formatarDataBR(e.data) },
        { chave: "ecc", titulo: "ECC", celula: e => e.valor?.toLocaleString("pt-BR") ?? "Não informado" },
        { chave: "escala", titulo: "Escala", celula: e => e.escalaMin != null && e.escalaMax != null ? `${e.escalaMin}–${e.escalaMax}` : "Não informada" },
        { chave: "responsavel", titulo: "Responsável", celula: e => e.responsavel ?? "Não informado" },
      ]} />
    </>}
  </CardFicha>;
}
