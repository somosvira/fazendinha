import { useEffect, useState } from "react";
import "./detalhe-sanitario.css";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { Button } from "../../../components/ui/button";
import { nomeCampoExame } from "./CamposExame";
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
  const formatoPreservado = dado.formatoSnapshot && typeof dado.formatoSnapshot === "object" ? dado.formatoSnapshot as ExameResultado["formatoSnapshot"] : formato;
  if (formatoPreservado.tipoResultado === "MULTIPLO") {
    if (!Array.isArray(dado.resultados)) return dado.status === "ANULADO" ? "Anulado — resultado não registrado nesta alteração" : "Não registrado";
    const resultados = dado.resultados.flatMap(item => {
      if (!item || typeof item !== "object" || typeof item.campo !== "string" || !("valor" in item)) return [];
      const campo = formatoPreservado.campos?.find(c => c.codigo === item.campo) ?? { codigo: item.campo };
      const valor = typeof item.valor === "boolean" ? item.valor ? "Sim" : "Não" : item.valor !== null && typeof item.valor === "object" ? JSON.stringify(item.valor) : item.valor == null ? "Não informado" : String(item.valor);
      return [`${nomeCampoExame(campo)}: ${valor}`];
    });
    return `${resultados.length ? resultados.join(" · ") : "Aguardando resultado"}${dado.status === "ANULADO" ? " · Anulado" : ""}`;
  }
  if (!("resultadoNumero" in dado) && !("resultadoTexto" in dado) && !("resultadoOpcao" in dado)) return dado.status === "ANULADO" ? "Anulado — resultado não registrado nesta alteração" : "Não registrado";
  const texto = (chave: string) => dado[chave] == null ? null : String(dado[chave]);
  return `${resultadoExameSanitario({ formatoSnapshot: formatoPreservado, resultadoNumero: texto("resultadoNumero"), resultadoTexto: texto("resultadoTexto"), resultadoOpcao: texto("resultadoOpcao") })}${dado.status === "ANULADO" ? " · Anulado" : ""}`;
}
export function HistoricoExame({ exameId, propriedadeId, formato }: { exameId: string; propriedadeId?: number; formato: ExameResultado["formatoSnapshot"] }) {
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<DadosHistorico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => { let vivo = true; setDados(null); setErro(null); consultarHistoricoExame(exameId, propriedadeId, pagina, 20).then((v) => { if (vivo) setDados(v); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [exameId, propriedadeId, pagina, retry]);
  return <section className="sanitario-historico"><h3>Histórico de alterações</h3>
    {erro ? <><ErrorBox erro={erro} /><Button variant="outline" onClick={() => setRetry((v) => v + 1)}>Tentar novamente</Button></> : !dados ? <p role="status">Carregando histórico…</p> : <>
      {dados.itens.map(a => <article key={a.id} className="sanitario-historico-evento">
        <header><h4>{tituloEvento(a.acao)}</h4><p>{a.autor?.nome ?? "Autor não registrado"} · {dataHoraSanitaria(a.criadoEm)}</p></header>
        <dl className="sanitario-dados"><div><dt>Antes</dt><dd>{eventoServico(a.acao) ? valorServico(a.antes) : valorHistorico(a.antes, formato)}</dd></div><div><dt>Depois</dt><dd>{eventoServico(a.acao) ? valorServico(a.depois) : valorHistorico(a.depois, formato)}</dd></div></dl>
        <p className="sanitario-historico-motivo"><strong>Motivo:</strong> {a.motivo ?? "Não registrado"}</p>
      </article>)}
      {!dados.itens.length && <p>Nenhuma alteração registrada.</p>}
      <nav aria-label="Páginas do histórico de alterações" className="sanitario-historico-paginacao">
        {dados.total > dados.tamanho && <Button variant="outline" disabled={pagina === 1} onClick={() => setPagina(v => v - 1)}>Anterior</Button>}
        <span>{dados.total > dados.tamanho ? `Página ${pagina} · ` : ""}{dados.total} {dados.total === 1 ? "alteração" : "alterações"}</span>
        {dados.total > dados.tamanho && <Button variant="outline" disabled={pagina * dados.tamanho >= dados.total} onClick={() => setPagina(v => v + 1)}>Próxima</Button>}
      </nav>
    </>}
  </section>;
}
