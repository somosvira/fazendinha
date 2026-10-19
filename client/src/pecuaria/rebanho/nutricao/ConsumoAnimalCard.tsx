import { CalendarDays, Clock3, ExternalLink } from "lucide-react";
import { SecaoRecolhivel } from "../components/SecaoRecolhivel";
import "./nutricao-animal.css";
import { Pill } from "../../../financeiro/financeiro-ui";
import { fmtMoneyExact } from "../../../components/charts";
import { formatarDataBR } from "../lib/rotulos";
import type { ConsumoAnimal } from "./api";

const quantidade = (valor: string | number) => Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 6 });

export function ConsumoAnimalCard({ consumo: i, verValores }: { consumo: ConsumoAnimal; verValores: boolean }) {
  return <article className="consumo-animal-card" aria-label={`Consumo de ${formatarDataBR(i.inicio)} a ${formatarDataBR(i.fim)}`}>
    <SecaoRecolhivel titulo={<span>{i.dieta.nome} · versão {i.dieta.versao}</span>} resumo={`Lote ${i.lote.nome}`} acoes={<><Pill tone={i.status === "CONFIRMADO" ? "green" : "amber"}>{i.status === "CONFIRMADO" ? "Confirmado" : "Estornado"}</Pill><a className="consumo-animal-link" href={`/pecuaria/rebanho/nutricao?fechamentoId=${encodeURIComponent(i.id)}`}><ExternalLink size={17} aria-hidden />Abrir fechamento do lote</a></>}>
    <dl className="consumo-animal-periodo"><div><CalendarDays size={24} aria-hidden /><div><dt className="text-xs text-ink-3">Período do fechamento</dt><dd className="mt-1 font-medium">{formatarDataBR(i.inicio)} – {formatarDataBR(i.fim)}</dd></div></div><div><Clock3 size={24} aria-hidden /><div><dt className="text-xs text-ink-3">Dias atribuídos</dt><dd className="mt-1 font-medium">{i.dias} dias</dd></div></div></dl>
    {i.status !== "CONFIRMADO" && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">Estornado — fora do consumo atual. Preservado para consulta do histórico.</p>}
    <div className="consumo-animal-tabela overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Produtos atribuídos por permanência no lote</caption><thead><tr className="border-b border-border text-ink-3"><th className="px-2 py-2 font-medium">Produto</th><th className="px-2 py-2 text-right font-medium">Quantidade atribuída</th><th className="px-2 py-2 text-right font-medium">Média por dia</th>{verValores && <th className="px-2 py-2 text-right font-medium">Custo conhecido</th>}</tr></thead><tbody>{i.itens.map(item => <tr key={item.produtoId} className="border-b border-border"><th scope="row" className="px-2 py-3 font-medium">{item.nome}</th><td className="whitespace-nowrap px-2 py-3 text-right">{quantidade(item.quantidadeAtribuida)} {item.unidade}</td><td className="whitespace-nowrap px-2 py-3 text-right">≈ {quantidade(item.quantidadePorDia)} {item.unidade}/dia</td>{verValores && <td className="whitespace-nowrap px-2 py-3 text-right">{item.custoConhecido == null ? "Não apurado" : fmtMoneyExact(Number(item.custoConhecido))}</td>}</tr>)}</tbody></table></div>
    {verValores && <div className="mt-4 flex flex-wrap gap-4"><p>Custo conhecido: <strong>{i.custoConhecido == null ? "não apurado" : fmtMoneyExact(Number(i.custoConhecido))}</strong>{!i.coberturaCustoCompleta && " · cobertura incompleta"}</p>{i.custoConhecidoPorDia != null && <p>≈ {fmtMoneyExact(Number(i.custoConhecidoPorDia))}/animal-dia, sobre o custo conhecido</p>}</div>}
    </SecaoRecolhivel>
  </article>;
}
