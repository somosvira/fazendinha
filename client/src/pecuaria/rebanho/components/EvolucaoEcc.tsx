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
        return <div key={escala} className="mt-3"><p>Escala {min}–{max}</p>{pontos.length > 1 ? <div className="h-48" role="img" aria-label={`Evolução de ECC na escala ${min} a ${max}; valores na tabela abaixo`}><ResponsiveContainer width="100%" height="100%"><LineChart data={pontos}><CartesianGrid vertical={false}/><XAxis dataKey="data" tickFormatter={formatarDataBR}/><YAxis domain={[min,max]}/><Tooltip labelFormatter={v => formatarDataBR(String(v))}/><Line dataKey="valor" name="ECC" stroke="var(--color-primary, #326861)" strokeWidth={2} connectNulls={false}/></LineChart></ResponsiveContainer></div> : <p>Um registro nesta escala; a curva exige duas avaliações.</p>}</div>; })}
      <div className="overflow-x-auto"><table className="consulta-tabela"><caption className="sr-only">Histórico de ECC</caption><thead><tr><th>Data</th><th>ECC</th><th>Escala</th><th>Responsável</th></tr></thead><tbody>{[...historico].reverse().map(e => <tr key={e.id}><td>{formatarDataBR(e.data)}</td><td>{e.valor?.toLocaleString("pt-BR") ?? "Não informado"}</td><td>{e.escalaMin != null && e.escalaMax != null ? `${e.escalaMin}–${e.escalaMax}` : "Não informada"}</td><td>{e.responsavel ?? "Não informado"}</td></tr>)}</tbody></table></div>
    </>}
  </CardFicha>;
}
