import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { consultarHistoricoExame, type HistoricoExame as DadosHistorico } from "./api";
import { dataHoraSanitaria, resultadoExameSanitario } from "./rotulos";
import { fmtMoneyExact } from "../../../components/charts";
import type { ExameResultado } from "./ResultadoExame";
function valorServico(valor: unknown): string {
  if (!valor || typeof valor !== "object") return "Não registrado";
  const dado = valor as Record<string, unknown>;
  const vinculo = dado.servicoId ?? dado.operacaoServicoId;
  const custo = dado.valor ?? dado.valorServicoAtribuido;
  return `${vinculo ? "Serviço vinculado" : "Sem Serviço"}${custo == null ? "" : ` · ${fmtMoneyExact(Number(custo))}`}`;
}
const eventoServico = (acao: string) => acao === "PROCEDIMENTO_SERVICO" || acao === "RATEIO_SERVICO";
const tituloEvento = (acao: string) => acao === "REGISTRO" ? "Coleta registrada" : acao === "ANULACAO" ? "Exame anulado" : acao === "PROCEDIMENTO_SERVICO" ? "Vínculo ao Serviço atualizado" : acao === "RATEIO_SERVICO" ? "Valor atribuído ao Serviço atualizado" : "Resultado atualizado";
function valorHistorico(valor: unknown, formato: ExameResultado["formatoSnapshot"]): string {
  if (!valor || typeof valor !== "object") return "Não registrado";
  const dado = valor as Record<string, unknown>;
  if (!("resultadoNumero" in dado) && !("resultadoTexto" in dado) && !("resultadoOpcao" in dado)) return dado.status === "ANULADO" ? "Anulado — resultado não registrado nesta alteração" : "Não registrado";
  const texto = (chave: string) => dado[chave] == null ? null : String(dado[chave]);
  return `${resultadoExameSanitario({ formatoSnapshot: formato, resultadoNumero: texto("resultadoNumero"), resultadoTexto: texto("resultadoTexto"), resultadoOpcao: texto("resultadoOpcao") })}${dado.status === "ANULADO" ? " · Anulado" : ""}`;
}
export function HistoricoExame({ exameId, propriedadeId, formato }: { exameId: string; propriedadeId?: number; formato: ExameResultado["formatoSnapshot"] }) {
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<DadosHistorico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => { let vivo = true; setDados(null); setErro(null); consultarHistoricoExame(exameId, propriedadeId, pagina, 20).then((v) => { if (vivo) setDados(v); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [exameId, propriedadeId, pagina, retry]);
  return <section className="space-y-3"><h3 className="font-semibold">Histórico de alterações</h3>{erro ? <><ErrorBox erro={erro} /><Button secondary onClick={() => setRetry((v) => v + 1)}>Tentar novamente</Button></> : !dados ? <p>Carregando histórico…</p> : <>{dados.itens.map((a) => <article key={a.id} className="space-y-2 rounded-lg border border-border p-3"><p>{dataHoraSanitaria(a.criadoEm)} · {a.autor?.nome ?? "Autor não registrado"}</p><p>Motivo: {a.motivo ?? "Não registrado"}</p><p>{tituloEvento(a.acao)}</p><p>Antes: {eventoServico(a.acao) ? valorServico(a.antes) : valorHistorico(a.antes, formato)}</p><p>Depois: {eventoServico(a.acao) ? valorServico(a.depois) : valorHistorico(a.depois, formato)}</p></article>)}{!dados.itens.length && <p>Nenhuma alteração registrada.</p>}<div className="flex gap-3 items-center"><Button secondary disabled={pagina === 1} onClick={() => setPagina((v) => v - 1)}>Anterior</Button><span>Página {pagina}</span><Button secondary disabled={pagina * dados.tamanho >= dados.total} onClick={() => setPagina((v) => v + 1)}>Próxima</Button></div></>}</section>;
}
