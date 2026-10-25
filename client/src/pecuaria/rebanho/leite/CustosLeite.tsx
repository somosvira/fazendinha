import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CabecalhoTabela, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { consultarLeite } from "./operacoes-api";
import { hojeOperacional } from "./modelo";
interface Custos { totalConhecido: string | null; cobertura: string }
interface Relatorio { consolidado: { situacao: string; custoPorLitro: string | null; custos: Custos; motivos: string[] }; porClassificacao: { finalidade: string; custos: Custos }[] }
const dinheiro = (v: string | null) => v === null ? "A apurar" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nomes: Record<string, string> = { NUTRICAO: "Nutrição", SANIDADE: "Sanidade", REPRODUCAO: "Reprodução", LEITE: "Leite", ROTINA: "Rotina", "null": "Sem classificação" };
export function CustosLeite({ periodo, podeExportar: _podeExportar = false }: { periodo?: { inicio: string; fim: string; natureza?: string }; podeExportar?: boolean }) {
  const hoje = hojeOperacional();
  const inicio = periodo?.inicio ?? new URLSearchParams(location.search).get("inicio") ?? `${hoje.slice(0, 7)}-01`;
  const fim = periodo?.fim ?? new URLSearchParams(location.search).get("fim") ?? hoje;
  const natureza = periodo?.natureza ?? "";
  const sitio = getPropriedadeAtiva();
  const [dados, setDados] = useState<Relatorio | null>(null), [erro, setErro] = useState(""), [revisao, setRevisao] = useState(0);
  useEffect(() => { let ativa = true; setDados(null); setErro(""); void consultarLeite<Relatorio>(`/custos?${new URLSearchParams({ inicio, fim, ...(natureza ? { natureza } : {}) })}`, sitio).then(r => { if (ativa) setDados(r); }).catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Não foi possível consultar os custos."); }); return () => { ativa = false; }; }, [inicio, fim, natureza, sitio, revisao]);
  const oculto = dados?.consolidado.situacao === "OCULTO";
  return <section className="leite-consulta-custos"><CabecalhoTabela titulo="Custos da produção" descricao="Custos registrados no mesmo recorte, sem rateio entre naturezas." />
    {erro ? <p role="alert">{erro} <Button variant="outline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button></p> : !dados ? <p role="status">Consultando custos…</p> : <>
      {oculto ? <p>Sem acesso a valores.</p> : <>
        <TabelaFinanceira rotulo="Custos registrados por classificação" itens={dados.porClassificacao ?? []} chaveDe={l => l.finalidade} colunas={[
          { chave: "classificacao", titulo: "Classificação", principal: true, celula: l => nomes[l.finalidade] ?? l.finalidade },
          { chave: "valor", titulo: "Custo registrado", alinhamento: "direita", celula: l => dinheiro(l.custos.totalConhecido) },
        ]} />
        <p className="leite-consulta-total">Total conhecido <strong>{dinheiro(dados.consolidado.custos.totalConhecido)}</strong> · Custo por litro <strong>{dinheiro(dados.consolidado.custoPorLitro)}</strong></p>
        {dados.consolidado.motivos.length > 0 && <p role="status">{dados.consolidado.motivos.includes("NATUREZA_SEM_VINCULO") ? "Custos sem vínculo comprovado com esta natureza: valor e custo por litro a apurar." : "Custo por litro a apurar: há pendências na produção ou nos custos do período."}</p>}
      </>}
    </>}
  </section>;
}
