import { useEffect, useState } from "react";
import { comPropriedade } from "../propriedadeScope";
import { navegarPara } from "../router";
import { podeAcessarArea } from "../estoque/navegacao";
import { dataBR } from "./financeiro-ui";

type Vinculo = { tipo: "APLICACAO" | "EXAME" | "PROTOCOLO"; id: string; propriedadeId: number; animalId: string; animalBrinco: string; data: string; nome: string; situacao: string; quantidadeDestinada: string | null; rateioServico: string | null };
type Dados = { fatos: Vinculo[]; itensDiretos: Array<{ id: string; descricao: string; unidade: string; quantidadeComprada: string; quantidadeDestinada: string; quantidadeDisponivel: string }> };

export function VinculosPecuaria({ operacaoId, compacto = false }: { operacaoId: string; compacto?: boolean }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    if (!podeAcessarArea("pecuaria")) return;
    const controle = new AbortController(); setDados(null); setErro(null);
    fetch(`/api/financeiro/operacoes/${operacaoId}/vinculos-pecuaria`, { headers: comPropriedade(), signal: controle.signal })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Erro ao consultar vínculos"); return d as Dados; })
      .then(setDados).catch((e: unknown) => { if (!controle.signal.aborted) setErro(e instanceof Error ? e.message : String(e)); });
    return () => controle.abort();
  }, [operacaoId, revisao]);
  if (!podeAcessarArea("pecuaria")) return null;
  return <section className={compacto ? "min-w-0 rounded-xl border border-border bg-card p-4" : "border-t border-border p-6"} aria-label="Vínculos com a Pecuária">
    <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Procedimentos vinculados</h2>
    <p className="mt-1 text-xs text-ink-3">Esta é a origem financeira dos procedimentos, sem nova despesa. O custo do medicamento e o rateio do Serviço são separados.</p>
    {erro && <p className="mt-3 text-sm text-red-800">{erro} <button type="button" className="underline" onClick={() => setRevisao((v) => v + 1)}>Tentar novamente</button></p>}
    {!dados && !erro && <p className="mt-3 text-sm">Carregando vínculos…</p>}
    {dados && <>
      {dados.itensDiretos.map((i) => <p key={i.id} className="mt-3 rounded-lg bg-surface-2 p-3 text-sm"><strong>{i.descricao}</strong> · comprado {i.quantidadeComprada} {i.unidade} · destinado {i.quantidadeDestinada} {i.unidade} · disponível {i.quantidadeDisponivel} {i.unidade}</p>)}
      {dados.fatos.length === 0 ? <p className="mt-3 text-sm text-ink-3">Nenhum procedimento vinculado.</p> : <div className="mt-3 grid gap-2">{dados.fatos.map((f) => {
        const tipo = f.tipo === "APLICACAO" ? "aplicacao" : f.tipo === "EXAME" ? "exame" : "execucao";
        const param = `aba=${f.tipo === "APLICACAO" ? "aplicacoes" : f.tipo === "EXAME" ? "exames" : "agenda"}&detalheTipo=${tipo}&detalheId=${encodeURIComponent(f.id)}`;
        const href = `/pecuaria/rebanho/sanidade?${param}&animalId=${encodeURIComponent(f.animalId)}&propriedadeId=${f.propriedadeId}`;
        return <a key={`${f.tipo}-${f.id}`} href={href} onClick={(e) => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navegarPara(href); } }} className="rounded-lg border border-border p-3 text-sm hover:bg-surface-2"><strong>{f.tipo === "APLICACAO" ? "Aplicação" : f.tipo === "EXAME" ? "Exame" : "Protocolo"}: {f.nome}</strong> · animal {f.animalBrinco} · {dataBR(f.data)} · {f.situacao}{f.quantidadeDestinada && ` · destinado ${f.quantidadeDestinada}`}{f.rateioServico && ` · rateio R$ ${f.rateioServico}`}</a>;
      })}</div>}
    </>}
  </section>;
}
