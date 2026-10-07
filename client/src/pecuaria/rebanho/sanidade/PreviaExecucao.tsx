import { dataSanitaria, unidadeSanitaria } from "./rotulos";
type ExibicaoExecucao = { planejado: Record<string, string | null>; realizado: Record<string, string | null> };
export type PreviaExecucao = {
  fingerprint: string; temDesvios: boolean;
  itens: Array<{ tarefaId: string; animalId: string; tipo: string; referencia: string; planejado: Record<string, unknown>; realizado: Record<string, unknown>; exibicao?: ExibicaoExecucao; diferencas: Array<{ campo: string; planejado: unknown; realizado: unknown }>; motivo: string | null; motivoObrigatorio: boolean; carencia: { estadoLeite: string; estadoCarne: string; leiteHoras: number | null; carneHoras: number | null } | null }>;
  consumos: Array<{ produtoId: string; produtoNome?: string | null; partidaId: string | null; partidaNome?: string | null; partidaValidade?: string | null; itemCompraDiretaId: string | null; unidade: string; quantidade: string }>;
};
const rotulos: Record<string, string> = { data: "Data", produtoId: "Produto", dose: "Dose", unidadeDose: "Unidade", via: "Via", tipoAplicacaoId: "Tipo de aplicação", tipoExameId: "Tipo de exame" };
const identificacaoIndisponivel = "Identificação não disponível no registro original";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function valorComparacaoExecucao(campo: string, valor: unknown, nome?: unknown): string {
  const exibido = nome ?? valor;
  if (exibido == null || exibido === "") return "Não informado";
  if (uuid.test(String(exibido)) || campo.endsWith("Id") && nome == null) return identificacaoIndisponivel;
  if (campo === "data") return dataSanitaria(String(exibido));
  if (campo === "unidadeDose") return unidadeSanitaria(String(exibido));
  return String(exibido);
}
function carenciaRevisada(estado: string, horas: number | null): string {
  if (estado === "NAO_APLICAVEL") return "Não se aplica — confirmado";
  if (estado === "INFORMADO" && horas != null) return `${horas} h`;
  return "Não informado";
}
export function ConferenciaExecucao({ previa, animais }: { previa: PreviaExecucao; animais: Array<{ id: string; brinco: string }> }) {
  return <section className="grid gap-3" aria-label="Conferência da execução">
    <h3 className="font-semibold">Planejado e realizado</h3>
    {previa.itens.map((i) => <section key={i.tarefaId} className="rounded-lg border border-border p-3">
      <strong>{animais.find((a) => a.id === i.animalId)?.brinco ?? "Animal não identificado"}</strong>
      {i.referencia === "LEGADO_SEM_SNAPSHOT" && <p>Planejamento antigo sem todos os parâmetros congelados.</p>}
      {i.diferencas.length ? <ul className="list-inside list-disc">{i.diferencas.map((d) => <li key={d.campo}>{rotulos[d.campo] ?? d.campo}: {valorComparacaoExecucao(d.campo, d.planejado, i.exibicao?.planejado[d.campo])} → {valorComparacaoExecucao(d.campo, d.realizado, i.exibicao?.realizado[d.campo])}</li>)}</ul> : <p>Realização conforme o planejamento.</p>}
      {i.motivoObrigatorio && <p>Motivo: {i.motivo ?? "Informe o motivo do desvio antes de confirmar."}</p>}
      {i.carencia && <p>Carência revisada: leite {carenciaRevisada(i.carencia.estadoLeite, i.carencia.leiteHoras)} · carne {carenciaRevisada(i.carencia.estadoCarne, i.carencia.carneHoras)}</p>}
    </section>)}
    <h3 className="font-semibold">Consumo total · Previsto para confirmação</h3>
    {previa.consumos.length ? previa.consumos.map((c, n) => <p key={n}>{c.quantidade} {unidadeSanitaria(c.unidade)} · {valorComparacaoExecucao("produtoId", c.produtoId, c.produtoNome)} · {c.partidaId ? <>lote {valorComparacaoExecucao("partidaId", c.partidaId, c.partidaNome)} · validade {c.partidaValidade ? dataSanitaria(c.partidaValidade) : "não informada"}</> : c.itemCompraDiretaId ? "compra direta" : "estoque"}</p>) : <p>Sem consumo de estoque.</p>}
    <p className="text-sm text-ink-3">A confirmação salva o conjunto inteiro. Revise origem, lote, hora, responsável e carência antes de confirmar.</p>
  </section>;
}
