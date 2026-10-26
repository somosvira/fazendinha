import { AjudaCampo } from "../../../components/Dica";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Panel } from "../../../financeiro/financeiro-ui";
import { reqV4 } from "./api";
import { periodoPadrao } from "./periodo-consulta";
import { registro, textoPreservado } from "./folha-regras";

export type CriaRelatorio = {
  id: string; animalId: string | null; ordem: number; sexo: string; viva: boolean;
  filiacaoSnapshot: unknown;
  pesos: Array<{ id: string; data: string; pesoKg: string }>;
  colostro: Array<{
    id: string; data: string; ocorridoEm: string | null; horarioEstimado: boolean;
    quantidadeLitros: string | null; unidadeInformada: string | null;
    metodoQualidade: string | null; qualidadeBrix: string | null; qualidadeClassificacao: string | null;
    tipo: string | null; forma: string | null; responsavel: string | null; observacao: string | null;
  }>;
};
export type PartoRelatorio = {
  id: string; versao: number; matriz: { id: string; brinco: string; nome: string | null };
  data: string; ocorridoEm: string | null; horarioEstimado: boolean;
  desfecho: string | null; tipo: string; induzido: boolean | null;
  dificuldade: boolean | null; assistenciaDescricao: string | null; retencaoPlacenta: boolean | null;
  responsavel: string | null; observacao: string | null;
  lancador: { id: number; nome: string | null } | null; criadoEm: string;
  ocorrenciasRetencaoPlacenta: Array<{ id: string; inicio: string; fim: string | null }>;
  pesosMatriz: Array<{ id: string; data: string; pesoKg: string }>;
  escoresMatriz: Array<{ id: string; data: string; responsavel: string | null; resultados: Array<{ campo: string; valor: unknown }> }>;
  crias: CriaRelatorio[];
};
export type SnapshotRelatorioPartos = {
  versao: number; emitidoEm: string; propriedadeId: number;
  periodo: { inicio: string; fim: string }; totalPartos: number; partos: PartoRelatorio[];
};
export function linhasCriasPartos(snapshot: SnapshotRelatorioPartos) {
  return snapshot.partos.flatMap<{ parto: PartoRelatorio; cria: CriaRelatorio | null; contarParto: number }>(parto => parto.crias.length
    ? parto.crias.map((cria, i) => ({ parto, cria, contarParto: i === 0 ? 1 : 0 }))
    : [{ parto, cria: null, contarParto: 1 }]);
}
export function horarioRelatorio(data: string, instante: string | null, estimado: boolean): string {
  return `${data} · ${instante ? `${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(instante))} (${estimado ? "estimado" : "informado"}; São Paulo)` : "horário não informado"}`;
}
function rp(valor: boolean | null) { return valor === null ? "Não informado" : valor ? "Sim" : "Não"; }
function pesos(itens: Array<{ data: string; pesoKg: string }>) {
  return itens.length ? itens.map(p => `${p.data}: ${p.pesoKg} kg`).join("; ") : "Não informado";
}
export function csvRelatorioPartos(snapshot: SnapshotRelatorioPartos): string {
  const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const linhas: unknown[][] = [["Emissão", "Versão relatório", "Sítio", "Início inclusivo", "Fim inclusivo", "Total partos", "ID parto", "Versão parto", "Contagem parto", "Matriz", "Data/hora", "Desfecho", "Tipo", "Induzido", "Dificuldade", "Assistência", "RP", "Responsável parto", "Lançador", "Observação parto", "Pesos matriz datados", "Escores matriz datados/escala", "ID cria", "Ordem cria", "Identificação preservada cria", "Sexo", "Viva", "Peso informado no nascimento", "Pesos cria datados", "Colostro por evento"]];
  for (const { parto: p, cria: c, contarParto } of linhasCriasPartos(snapshot)) linhas.push([
    snapshot.emitidoEm, snapshot.versao, snapshot.propriedadeId, snapshot.periodo.inicio, snapshot.periodo.fim, snapshot.totalPartos,
    p.id, p.versao, contarParto, `${p.matriz.brinco} ${p.matriz.nome ?? ""}`, horarioRelatorio(p.data, p.ocorridoEm, p.horarioEstimado),
    p.desfecho, p.tipo, textoPreservado(p.induzido), textoPreservado(p.dificuldade), p.assistenciaDescricao, rp(p.retencaoPlacenta), p.responsavel,
    p.lancador?.nome ?? p.lancador?.id, p.observacao, pesos(p.pesosMatriz), JSON.stringify(p.escoresMatriz),
    c?.id, c?.ordem, c ? JSON.stringify(c.filiacaoSnapshot) : "Sem cria registrada", c?.sexo, c ? textoPreservado(c.viva) : "", c ? textoPreservado(registro(c.filiacaoSnapshot).pesoKg) : "", c ? pesos(c.pesos) : "", c ? JSON.stringify(c.colostro) : "",
  ]);
  return "\uFEFF" + linhas.map(l => l.map(escape).join(";")).join("\r\n");
}
function exportar(snapshot: SnapshotRelatorioPartos) {
  const url = URL.createObjectURL(new Blob([csvRelatorioPartos(snapshot)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `partos-${snapshot.periodo.inicio}-${snapshot.periodo.fim}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
export function RelatorioPartos({ propriedadeId, podeLancar }: { propriedadeId: number; podeLancar: boolean }) {
  const [inicio, setInicio] = useState(() => periodoPadrao("partos").inicio);
  const [fim, setFim] = useState(() => periodoPadrao("partos").fim);
  const [snapshot, setSnapshot] = useState<SnapshotRelatorioPartos | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [emissoes, setEmissoes] = useState<Array<{ id: string; criadoEm: string; versao?: number }>>([]);
  const [emissaoId, setEmissaoId] = useState<string | null>(null);
  const propriedadeAtual = useRef(propriedadeId);
  propriedadeAtual.current = propriedadeId;
  const consultaAtual = useRef(0);
  const requisicao = useRef<{ assinatura: string; chave: string } | null>(null);
  useEffect(() => {
    let ativo = true;
    consultaAtual.current++;
    setErro("");
    setEmissoes([]);
    setEmissaoId(null);
    setSnapshot(null);
    setOcupado(false);
    requisicao.current = null;
    void reqV4<Array<{ id: string; criadoEm: string; versao?: number }>>(
      `/reproducao/relatorios/emissoes?tipo=PARTOS&propriedadeId=${propriedadeId}`, undefined, "GET", propriedadeId,
    ).then(lista => { if (ativo) setEmissoes(lista); })
      .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível consultar as emissões"); });
    return () => { ativo = false; };
  }, [propriedadeId]);
  const visivel = snapshot?.propriedadeId === propriedadeId ? snapshot : null;
  const periodoAlterado = !!visivel && (inicio !== visivel.periodo.inicio || fim !== visivel.periodo.fim);
  async function consultar() {
    const sequencia = ++consultaAtual.current;
    setOcupado(true);
    setErro("");
    try {
      const filtros = new URLSearchParams({ propriedadeId: String(propriedadeId), inicio, fim });
      const resultado = await reqV4<SnapshotRelatorioPartos>(`/reproducao/relatorios/partos?${filtros}`, undefined, "GET", propriedadeId);
      if (consultaAtual.current !== sequencia || propriedadeAtual.current !== propriedadeId) return;
      setSnapshot(resultado);
      setEmissaoId(null);
    } catch (e) {
      if (consultaAtual.current === sequencia) setErro(e instanceof Error ? e.message : "Não foi possível consultar os partos");
    } finally { if (consultaAtual.current === sequencia) setOcupado(false); }
  }
  async function salvarEmissao() {
    if (!podeLancar || !visivel) return;
    const sequencia = ++consultaAtual.current;
    setOcupado(true);
    setErro("");
    try {
      const filtros = visivel.periodo;
      const assinatura = JSON.stringify({ propriedadeId, ...filtros });
      if (requisicao.current?.assinatura !== assinatura) requisicao.current = { assinatura, chave: crypto.randomUUID() };
      const emissao = await reqV4<{ id: string; criadoEm: string; versao?: number; snapshot: SnapshotRelatorioPartos }>(
        "/reproducao/relatorios/emissoes", { chave: requisicao.current.chave, propriedadeId, tipo: "PARTOS", filtros }, "POST", propriedadeId,
      );
      if (consultaAtual.current !== sequencia || propriedadeAtual.current !== propriedadeId) return;
      setSnapshot(emissao.snapshot);
      setEmissaoId(emissao.id);
      setEmissoes(anteriores => [emissao, ...anteriores.filter(e => e.id !== emissao.id)]);
      requisicao.current = null;
    } catch (e) {
      if (consultaAtual.current === sequencia) setErro(e instanceof Error ? e.message : "Não foi possível salvar a emissão");
    } finally { if (consultaAtual.current === sequencia) setOcupado(false); }
  }
  async function abrir(id: string) {
    const sequencia = ++consultaAtual.current;
    setOcupado(true);
    setErro("");
    try {
      const emissao = await reqV4<{ id: string; snapshot: SnapshotRelatorioPartos }>(
        `/reproducao/relatorios/emissoes/${id}?propriedadeId=${propriedadeId}`, undefined, "GET", propriedadeId,
      );
      if (consultaAtual.current !== sequencia || propriedadeAtual.current !== propriedadeId) return;
      setSnapshot(emissao.snapshot);
      setInicio(emissao.snapshot.periodo.inicio);
      setFim(emissao.snapshot.periodo.fim);
      setEmissaoId(emissao.id);
    } catch (e) {
      if (consultaAtual.current === sequencia) setErro(e instanceof Error ? e.message : "Não foi possível abrir a emissão");
    } finally { if (consultaAtual.current === sequencia) setOcupado(false); }
  }
  return (
    <div className="space-y-5">
      <Panel className="space-y-4 p-5 print:hidden">

      <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void consultar(); }}>
        <label className="space-y-1 text-sm">Início (inclusive)<Input type="date" required value={inicio} onChange={e => setInicio(e.target.value)} /></label>
        <label className="space-y-1 text-sm">Fim (inclusive)<Input type="date" required min={inicio} value={fim} onChange={e => setFim(e.target.value)} /></label>
        <Button disabled={ocupado} type="submit">{ocupado ? "Consultando…" : "Consultar ficha de partos"}</Button>
      </form>
      </Panel>
      <Panel className="space-y-3 p-5 print:hidden">
        <div><h2 className="font-semibold">Histórico de emissões</h2><p className="text-sm text-muted-foreground">Reabra uma emissão para consultar e exportar os dados preservados, sem recalcular os fatos atuais.</p></div>
        <label className="block text-sm">Emissões anteriores
          <select className="mt-1 block w-full rounded-md border bg-card px-3 py-2" value={emissaoId ?? ""} disabled={ocupado}
            onChange={e => { if (e.target.value) void abrir(e.target.value); }}>
            <option value="">Selecione uma emissão preservada</option>
            {emissoes.map(e => <option key={e.id} value={e.id}>{new Date(e.criadoEm).toLocaleString("pt-BR")}</option>)}
          </select>
        </label>
      </Panel>
      {erro && <p role="alert" className="text-destructive print:hidden">{erro}</p>}
      {!visivel && ocupado && <p role="status" className="text-sm text-muted-foreground print:hidden">Carregando a ficha de partos e pós-parto…</p>}
      {visivel && <>
        <Panel className="space-y-3 p-5 print:hidden">
          <div><h2 className="font-semibold">Resultado exibido</h2><p className="text-sm text-muted-foreground">Sítio {visivel.propriedadeId} · {visivel.periodo.inicio} a {visivel.periodo.fim}. Impressão e CSV usam estes dados.</p></div>
          {periodoAlterado && <p className="rounded-lg border bg-muted p-3 text-sm">As datas editadas ainda não foram consultadas. O resultado abaixo mantém o período exibido; use Consultar ficha de partos para atualizá-lo.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>Imprimir ficha</Button>
          <Button variant="outline" onClick={() => exportar(visivel)}>Exportar CSV</Button>
          {podeLancar && !emissaoId && <Button disabled={ocupado} onClick={() => void salvarEmissao()}>Salvar emissão deste período</Button>}
          <span className="text-sm text-muted-foreground">{emissaoId
            ? `Emissão preservada: ${emissaoId}. Reabrir conserva os mesmos dados.`
            : "Consulta atual. Salvar uma emissão preserva um novo corte dos dados deste período."}</span>
        </div>
        </Panel>
        <Panel className="min-w-0 overflow-x-auto p-5 print:overflow-visible print:border-0 print:p-0 print:shadow-none"><FolhaRelatorioPartos snapshot={visivel} /></Panel>
      </>}
    </div>
  );
}
export function FolhaRelatorioPartos({ snapshot, operacional = false }: { snapshot: SnapshotRelatorioPartos; operacional?: boolean }) {
  return <article className="space-y-5 text-sm print:text-xs">
    <header>
      <h2 className="text-lg font-semibold">Ficha de partos e pós-parto <AjudaCampo rotulo="Ajuda sobre a ficha de partos" texto="RP: retenção de placenta; Não informado é diferente de Não. Partos válidos do sítio na data do fato; um parto pode ter várias crias. Pesos e escores têm vínculo explícito com o parto. Quantidade desconhecida de colostro não significa zero. Complementos representam os dados consultados, inclusive quando registrados após o período."/></h2>
      <p>Sítio {snapshot.propriedadeId} · {snapshot.periodo.inicio} a {snapshot.periodo.fim} (ambas inclusive) · {snapshot.totalPartos} partos</p>
      {!operacional && <p>Emissão: {snapshot.emitidoEm} · Versão do relatório: {snapshot.versao} · Ordem: data e ID do parto crescentes.</p>}

    </header>
    {snapshot.partos.length === 0 && <p>Nenhum parto válido neste período.</p>}
    {snapshot.partos.map(p => <section key={p.id} className="rounded-md border p-3 print:rounded-none">
      <h3 className="font-semibold">Matriz {p.matriz.brinco} {p.matriz.nome} · {horarioRelatorio(p.data, p.ocorridoEm, p.horarioEstimado)}</h3>
      <p>Parto {p.id} · Versão {p.versao} · Desfecho: {p.desfecho ?? "Não informado"} · Tipo registrado: {p.tipo}</p>
      <p>Induzido: {textoPreservado(p.induzido)} · Dificuldade: {textoPreservado(p.dificuldade)} · Assistência: {p.assistenciaDescricao ?? "Não informada"}</p>
      <p>RP: {rp(p.retencaoPlacenta)} · Acompanhamentos vinculados: {p.ocorrenciasRetencaoPlacenta.length ? p.ocorrenciasRetencaoPlacenta.map(o => `${o.inicio.slice(0, 10)} a ${o.fim?.slice(0, 10) ?? "em aberto"}`).join("; ") : "Nenhum"}</p>
      <p>Responsável pelo parto: {p.responsavel ?? "Não informado"} · Lançador: {p.lancador?.nome ?? p.lancador?.id ?? "Não informado"} · Registro: {p.criadoEm}</p>
      <p>Observações: {p.observacao ?? "—"}</p>
      <p>Pesagens da matriz: {pesos(p.pesosMatriz)}</p>
      <p>Escores da matriz: {p.escoresMatriz.length ? p.escoresMatriz.map(e => `${e.data}: ${e.resultados.map(r => `${r.campo}: ${textoPreservado(r.valor)}`).join("; ")}; responsável: ${e.responsavel ?? "não informado"}`).join(" · ") : "Não informados"}</p>
      <table className="mt-3 w-full border-collapse">
        <thead className="table-header-group"><tr><th className="border p-2">Cria</th><th className="border p-2">Pesos da cria</th><th className="border p-2">Fornecimentos de colostro</th></tr></thead>
        <tbody>{p.crias.length ? p.crias.map(c => <tr key={c.id} className="break-inside-avoid">
          <td className="border p-2">{c.ordem} · {textoPreservado(registro(c.filiacaoSnapshot).brincoInformado ?? c.animalId)}<p>Sexo: {c.sexo} · {c.viva ? "Viva" : "Sem vida"}</p>{operacional && c.animalId && <a className="font-semibold underline" href={`/pecuaria/rebanho/animais/${c.animalId}#reproducao`}>Abrir ficha da cria {c.ordem}</a>}</td>
          <td className="border p-2"><p>Peso informado no nascimento: {registro(c.filiacaoSnapshot).pesoKg == null ? "Não informado" : `${textoPreservado(registro(c.filiacaoSnapshot).pesoKg)} kg`}</p><p>Pesagens vinculadas: {pesos(c.pesos)}</p></td>
          <td className="border p-2">{c.colostro.length ? c.colostro.map(f => <p key={f.id}>{horarioRelatorio(f.data, f.ocorridoEm, f.horarioEstimado)} · Quantidade: {f.quantidadeLitros == null ? "Não informada" : `${f.quantidadeLitros} L`} · Unidade informada: {f.unidadeInformada ?? "—"} · Método: {f.metodoQualidade ?? "—"} · Brix: {f.qualidadeBrix ?? "—"} · Qualidade: {f.qualidadeClassificacao ?? "—"} · Tipo: {f.tipo ?? "—"} · Forma: {f.forma ?? "—"} · Responsável: {f.responsavel ?? "—"} · Obs.: {f.observacao ?? "—"}</p>) : "Sem fornecimento registrado"}</td>
        </tr>) : <tr><td colSpan={3} className="border p-2">Sem cria registrada; o parto permanece contado.</td></tr>}</tbody>
      </table>
    </section>)}
  </article>;
}
