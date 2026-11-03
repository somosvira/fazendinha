import { useEffect, useState, type ReactNode } from "react";
import { RebModal } from "@/components/rb/RebModal";
import { Button } from "@/components/ui/button";
import { buscarAuditoriaAnimal } from "../api";
import { getPropriedadeAtiva } from "@/propriedadeScope";
import type { EntradaAuditoria, ResultadoAuditoriaAnimal } from "../types";

export function CamposAuditoria({ entrada }: { entrada: EntradaAuditoria }) {
  return <div className="overflow-x-auto"><table className="w-full table-fixed text-center text-sm consulta-tabela"><thead><tr>{["Campo", "Antes", "Depois"].map(t => <th key={t} scope="col" className="p-3 text-center">{t}</th>)}</tr></thead><tbody>{entrada.alteracoes.map(a => <tr key={a.campo}><th scope="row" className="break-words p-3 text-center font-medium">{a.rotulo}</th><td className="break-words p-3 text-center">{a.antes ?? (entrada.anteriorEstado === "NAO_INFORMADO" ? "Não informado" : "—")}</td><td className="break-words p-3 text-center">{a.depois ?? "—"}</td></tr>)}{!entrada.alteracoes.length && <tr><td colSpan={3} className="p-4 text-center text-ink-3">Sem detalhes de campos disponíveis nesta consulta.</td></tr>}</tbody></table></div>;
}
export function DadosAuditoria({ entrada }: { entrada: EntradaAuditoria }) {
  return <article className="space-y-3 border-b border-border py-4 last:border-0"><dl className="grid grid-cols-1 gap-3 text-center text-sm sm:grid-cols-3"><div><dt className="text-ink-3">Responsável</dt><dd>{entrada.usuarioNome ?? "Não informado"}</dd></div><div><dt className="text-ink-3">Data e hora de registro</dt><dd>{new Date(entrada.em).toLocaleString("pt-BR")}</dd></div><div><dt className="text-ink-3">Ação</dt><dd>{entrada.acaoRotulo ?? entrada.acao}</dd></div></dl>{entrada.anteriorEstado === "NAO_INFORMADO" && <p className="text-center text-sm text-ink-3">Dados anteriores não informados.</p>}<CamposAuditoria entrada={entrada} /></article>;
}

/** Consulta por identidade, nunca limitada à página da listagem do histórico. */
export function AuditoriaFatoAnimal({ animalId, entidade, entidadeId, resumo, onClose }: { animalId: string; entidade: string; entidadeId: string; resumo?: ReactNode; onClose: () => void }) {
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<ResultadoAuditoriaAnimal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const propriedadeId = getPropriedadeAtiva();
  useEffect(() => {
    let vigente = true;
    setResultado(null); setErro(null);
    buscarAuditoriaAnimal(animalId, { entidade, entidadeId, page: pagina, pageSize: 20 })
      .then(r => { if (vigente) setResultado(r); })
      .catch((e: unknown) => { if (vigente) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vigente = false; };
  }, [animalId, entidade, entidadeId, propriedadeId, pagina, tentativa]);
  return <RebModal title="Auditoria do registro" onClose={onClose} className="w-[min(900px,calc(100vw-32px))]">
    {resumo && <div className="mb-3 text-center text-sm">{resumo}</div>}
    {erro ? <div className="space-y-3"><p role="alert">{erro}</p><Button variant="outline" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</Button></div> : !resultado ? <p role="status">Consultando auditoria…</p> : <>
      {resultado.itens.map((entrada, i) => <DadosAuditoria key={entrada.id ?? `${entrada.em}-${i}`} entrada={entrada} />)}
      {!resultado.total && <p className="py-4 text-center text-sm">Nenhum registro de auditoria disponível para este fato.</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>{resultado.total} registros · Página {pagina} de {Math.max(1, Math.ceil(resultado.total / 20))}</span><div className="flex gap-2"><Button variant="outline" disabled={pagina <= 1} onClick={() => setPagina(v => v - 1)}>Anterior</Button><Button variant="outline" disabled={pagina * 20 >= resultado.total} onClick={() => setPagina(v => v + 1)}>Próxima</Button></div></div>
    </>}
  </RebModal>;
}
