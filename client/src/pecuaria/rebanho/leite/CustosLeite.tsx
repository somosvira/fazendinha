import { ConsultaOperacional } from "@/components/ConsultaOperacional";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CabecalhoTabela, Pill } from "../../../financeiro/financeiro-ui";
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
  return <section className="leite-consulta-custos"><CabecalhoTabela titulo="Custos da produção" rotuloAjuda="Sobre custos da produção" />
    {erro ? <p role="alert">{erro} <Button variant="outline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button></p> : !dados ? <p role="status">Consultando custos…</p> : <>
      {oculto ? <p>Sem acesso a valores.</p> : <>
        <ConsultaOperacional rotulo="Custos registrados por classificação" itens={dados.porClassificacao ?? []} chaveDe={l => l.finalidade} colunas={[
          { chave: "classificacao", titulo: "Classificação", principal: true, celula: l => nomes[l.finalidade] ?? l.finalidade },
          { chave: "valor", titulo: "Custo registrado", alinhamento: "direita", celula: l => dinheiro(l.custos.totalConhecido) },
        ]} />
        <dl className="leite-custos-resumo">
          <div><dt>Total conhecido</dt><dd>{dinheiro(dados.consolidado.custos.totalConhecido)}</dd></div>
          <div><dt>Custo por litro</dt><dd>{dados.consolidado.custoPorLitro === null ? <Pill tone="amber">A apurar</Pill> : dinheiro(dados.consolidado.custoPorLitro)}</dd></div>
        </dl>
        {dados.consolidado.motivos.includes("NATUREZA_SEM_VINCULO") && <p role="status">Custos sem vínculo comprovado com esta natureza: valor e custo por litro a apurar.</p>}
      </>}
    </>}
  </section>;
}
