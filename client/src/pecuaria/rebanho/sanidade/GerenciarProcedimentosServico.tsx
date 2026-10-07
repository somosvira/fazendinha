import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ErrorBox, Paginacao, brl } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { confirmarProcedimentosServico, listarProcedimentosServico, linkProcedimentoServico, type ConsultaProcedimentosServico, type ProcedimentoServico } from "../../../financeiro/novo-api";
import { getUsuario } from "../../../lib/auth";
import { podeAcessarArea } from "../../../estoque/navegacao";
import { dataHoraSanitaria, dataSanitaria, origemSanitaria } from "./rotulos";
import { SanidadeApiError } from "./api";

export function podeGerenciarProcedimentosServico() {
  const usuario = getUsuario();
  return podeAcessarArea("pecuaria") && podeAcessarArea("financeiro") && (!usuario || usuario.dono || usuario.flags.includes("lancar"));
}
type Escolha = { item: ProcedimentoServico; valor?: string | null };
const chaveItem = (i: Pick<ProcedimentoServico, "id" | "tipo">) => `${i.tipo}:${i.id}`;
const rotuloTipo = { APLICACAO: "Aplicação", EXAME: "Exame", PROTOCOLO: "Protocolo" };
export const dataProcedimentoServico = (item: Pick<ProcedimentoServico, "tipo" | "dataHora">) => item.tipo === "APLICACAO" ? dataHoraSanitaria(item.dataHora) : dataSanitaria(item.dataHora);
export const origemProcedimentoServico = (item: Pick<ProcedimentoServico, "tipo" | "origem">) => item.tipo === "APLICACAO" ? origemSanitaria(item.origem) : item.tipo === "EXAME" ? "Coleta de exame" : "Execução do protocolo";
function LinhaProcedimento({ item, escolha, podeLancar, podeValores, salvando, erro, onSelecionar, onValor }: {
  item: ProcedimentoServico; escolha?: Escolha; podeLancar: boolean; podeValores: boolean; salvando: boolean; erro: string | null;
  onSelecionar: (valor: boolean) => void; onValor: (valor: string | null) => void;
}) {
  return <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
    <label className="flex items-start gap-3"><input type="checkbox" aria-label={`Selecionar ${item.nome} · ${item.animal.brinco}`} disabled={!podeLancar || !item.podeEditar || salvando} checked={!!escolha} onChange={(e) => onSelecionar(e.target.checked)} /><span><strong>{rotuloTipo[item.tipo]} · {item.nome}</strong><br />{item.animal.brinco}{item.animal.nome ? ` · ${item.animal.nome}` : ""} · {dataProcedimentoServico(item)}<br />{item.propriedade?.nome ?? "Sítio não registrado"} · {origemProcedimentoServico(item)}{["ANULADO", "CANCELADO", "PENDENTE"].includes(item.status) && ` · ${item.status === "ANULADO" ? "Anulado" : item.status === "CANCELADO" ? "Cancelado" : "Pendente"}`}</span></label>
    <div className="flex flex-wrap gap-3"><a className="underline" href={linkProcedimentoServico(item, window.location.pathname + window.location.search)}>Ver procedimento</a><a className="underline" href={`/pecuaria/rebanho/animais/${encodeURIComponent(item.animalId)}`}>Ver animal</a>{podeValores && <span>{item.valor == null ? "Sem valor individual" : brl(item.valor)}</span>}</div>
    {escolha && podeValores && <label className="block">Valor individual (R$)<input aria-label="Valor individual (R$)" type="number" step="0.01" min="0" className={classeInput} aria-invalid={!!erro} disabled={salvando} value={escolha.valor === undefined ? item.valor ?? "" : escolha.valor ?? ""} onChange={(e) => onValor(e.target.value === "" ? null : e.target.value)} /><span className="text-xs text-ink-3">Apagar o valor mantém o procedimento vinculado. Zero é um valor informado.</span></label>}
    {erro && <p role="alert" className="text-sm text-[var(--neg)]">{erro}</p>}
  </div>;
}
export function GerenciarProcedimentosServico({ servicoId, propriedadeId, onFechar, onSalvo }: { servicoId: string; propriedadeId: number; onFechar: () => void; onSalvo?: () => Promise<void> | void }) {
  const [dados, setDados] = useState<ConsultaProcedimentosServico | null>(null);
  const [grupo, setGrupo] = useState<"VINCULADOS" | "ELEGIVEIS">("VINCULADOS");
  const [busca, setBusca] = useState(""); const [tipo, setTipo] = useState("");
  const [inicio, setInicio] = useState(""); const [fim, setFim] = useState(""); const [pagina, setPagina] = useState(1);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({}); const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null); const [loading, setLoading] = useState(false); const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<{ quantidade: number; itens: Escolha[]; aviso?: string } | null>(null);
  const [campoErro, setCampoErro] = useState<string | null>(null);
  const leitura = useRef(0); const envio = useRef<{ conteudo: string; chave: string } | null>(null); const emCurso = useRef(false);
  const usuario = getUsuario(); const podeValores = podeAcessarArea("financeiro") && (!usuario || usuario.dono || usuario.flags.includes("verValores"));
  const podeLancar = podeGerenciarProcedimentosServico();
  const contexto = useRef({ servicoId, propriedadeId });
  if (contexto.current.servicoId !== servicoId || contexto.current.propriedadeId !== propriedadeId) contexto.current = { servicoId, propriedadeId };
  const carregar = useCallback(async (signal?: AbortSignal) => {
    const atual = ++leitura.current; setLoading(true); setErro(null);
    try { const novo = await listarProcedimentosServico(servicoId, propriedadeId, { grupo, animalBusca: busca, tipo, inicio, fim, pagina, limite: 20 }, signal); if (atual === leitura.current) setDados(novo); }
    catch (e) { if (atual !== leitura.current || signal?.aborted) return; throw e; }
    finally { if (atual === leitura.current) setLoading(false); }
  }, [servicoId, propriedadeId, grupo, busca, tipo, inicio, fim, pagina]);
  useEffect(() => { const controller = new AbortController(); void carregar(controller.signal).catch((e: unknown) => setErro(e instanceof Error ? e.message : String(e))); return () => { controller.abort(); leitura.current++; }; }, [carregar]);
  useEffect(() => { setEscolhas({}); setResultado(null); setMotivo(""); envio.current = null; }, [servicoId, propriedadeId]);
  function selecionar(item: ProcedimentoServico, selecionado: boolean) {
    setEscolhas((antes) => { const novo = { ...antes }; if (selecionado) novo[chaveItem(item)] = { item }; else delete novo[chaveItem(item)]; return novo; });
  }
  async function salvar() {
    if (emCurso.current || !Object.keys(escolhas).length || motivo.trim().length < 5) return;
    emCurso.current = true; setSalvando(true); setErro(null); setCampoErro(null);
    const vigente = contexto.current; const selecionados = Object.values(escolhas);
    const itens = Object.values(escolhas).map((e) => ({ id: e.item.id, tipo: e.item.tipo, ...(e.valor !== undefined ? { valor: e.valor } : {}) }));
    const conteudo = JSON.stringify({ servicoId, propriedadeId, motivo: motivo.trim(), itens });
    if (envio.current?.conteudo !== conteudo) envio.current = { conteudo, chave: crypto.randomUUID() };
    try {
      const salvo = await confirmarProcedimentosServico(servicoId, { propriedadeId, chaveIdempotencia: envio.current.chave, motivo: motivo.trim(), itens });
      if (contexto.current !== vigente) return;
      for (const escolha of selecionados) { const confirmado = salvo.itens?.find((i) => chaveItem(i) === chaveItem(escolha.item)); if (confirmado) escolha.valor = confirmado.valor; }
      setEscolhas({}); setMotivo(""); envio.current = null; setResultado({ quantidade: salvo.quantidade, itens: selecionados });
      try { await onSalvo?.(); await carregar(); }
      catch { if (contexto.current === vigente) setResultado({ quantidade: salvo.quantidade, itens: selecionados, aviso: "Salvo. A consulta não atualizou; feche e abra novamente para conferir." }); }
    } catch (e) { if (contexto.current === vigente) { setErro(e instanceof Error ? e.message : String(e)); setCampoErro(e instanceof SanidadeApiError ? e.campo ?? null : null); } }
    finally { if (contexto.current === vigente) { emCurso.current = false; setSalvando(false); } }
  }
  return <PainelCadastro aberto titulo="Gerenciar procedimentos" onFechar={() => { if (!salvando) onFechar(); }} rodape={resultado ? <Button onClick={onFechar}>Fechar</Button> : <div className="w-full space-y-2"><ErrorBox erro={erro} /><Button type="submit" form="procedimentos-servico" disabled={salvando || !podeLancar || !Object.keys(escolhas).length || motivo.trim().length < 5}>{salvando ? "Salvando…" : "Confirmar procedimentos"}</Button></div>}>
    {resultado ? <div role="status" className="space-y-3 rounded-xl border border-border bg-surface p-4"><h3 className="font-semibold">Procedimentos salvos</h3><p>{resultado.quantidade} procedimento(s) confirmado(s) no Serviço #{dados?.servico.numero}.</p>{resultado.itens.map((escolha) => <p key={chaveItem(escolha.item)}>{escolha.item.animal.brinco} · {escolha.item.nome}{podeValores && ` · ${((escolha.valor === undefined ? escolha.item.valor : escolha.valor) == null) ? "Sem valor individual" : brl(escolha.valor === undefined ? escolha.item.valor : escolha.valor)}`}</p>)}{resultado.aviso && <p>{resultado.aviso}</p>}</div> : <form id="procedimentos-servico" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
      <ErrorBox erro={erro} /><p className="text-sm">Associe procedimentos já realizados ao atendimento. O vínculo preserva a origem do medicamento e o estoque. Valores individuais são opcionais e não criam outra despesa.</p>
      {dados && <div className="rounded-lg bg-surface p-3 text-sm"><strong>Serviço #{dados.servico.numero} · {dados.servico.descricao ?? "Atendimento"}</strong><p>{dados.servico.propriedade?.nome ?? "Sítio não informado"}{dados.servico.data && ` · ${dataSanitaria(dados.servico.data)}`}</p>{podeValores && dados.servico.valorConfirmado != null && <p className="mt-1">Confirmado {brl(dados.servico.valorConfirmado)} · atribuído {brl(dados.servico.totalAtribuido ?? "0")} · disponível {brl(dados.servico.disponivel ?? "0")}</p>}</div>}
      <fieldset disabled={salvando} className="space-y-3"><legend className="sr-only">Filtrar procedimentos</legend><div className="flex flex-wrap gap-2">{(["VINCULADOS", "ELEGIVEIS"] as const).map((g) => <Button key={g} type="button" secondary={grupo !== g} onClick={() => { setGrupo(g); setPagina(1); }}>{g === "VINCULADOS" ? "Vinculados" : "Adicionar realizados"}</Button>)}</div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Animal<input className={classeInput} placeholder="Brinco ou nome" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} /></label><label className="text-sm">Tipo<select className={classeInput} value={tipo} onChange={(e) => { setTipo(e.target.value); setPagina(1); }}><option value="">Todos</option>{Object.entries(rotuloTipo).map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}</select></label><label className="text-sm">Início<input type="date" className={classeInput} value={inicio} onChange={(e) => { setInicio(e.target.value); setPagina(1); }} /></label><label className="text-sm">Fim<input type="date" className={classeInput} value={fim} onChange={(e) => { setFim(e.target.value); setPagina(1); }} /></label></div>
      </fieldset>
      {loading ? <p role="status">Carregando procedimentos…</p> : dados?.itens.length ? <div className="space-y-3">{dados.itens.map((item) => {
        const escolha = escolhas[chaveItem(item)]; const indice = Object.keys(escolhas).indexOf(chaveItem(item));
        const erroItem = escolha && (campoErro === "itens" || campoErro?.startsWith(`itens.${indice}.`)) ? erro : null;
        return <LinhaProcedimento key={chaveItem(item)} item={item} escolha={escolha} podeLancar={podeLancar} podeValores={podeValores} salvando={salvando} erro={erroItem} onSelecionar={(valor) => selecionar(item, valor)} onValor={(valor) => { if (escolha) setEscolhas((antes) => ({ ...antes, [chaveItem(item)]: { ...escolha, valor } })); }} />;
      })}</div> : <p className="text-sm">{grupo === "VINCULADOS" ? "Nenhum procedimento vinculado. Use Adicionar realizados para associar o atendimento." : "Nenhum procedimento disponível nos filtros deste sítio."}</p>}
      {dados && <Paginacao pagina={pagina} totalPaginas={dados.paginas} total={dados.total} porPagina={dados.limite} rotulo="Paginação de procedimentos" substantivo="procedimentos" idSelect="pagina-procedimentos-servico" onPagina={setPagina} />}
      {!!Object.keys(escolhas).length && <fieldset disabled={salvando}><p className="mb-2 text-sm">{Object.keys(escolhas).length} procedimento(s) selecionado(s).{podeValores && " Não atribua valores ao protocolo e aos procedimentos dele ao mesmo tempo."}</p><label className="text-sm">Motivo<textarea required minLength={5} maxLength={500} className={classeInput} aria-invalid={campoErro === "motivo"} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>{campoErro === "motivo" && <p role="alert" className="text-sm text-[var(--neg)]">{erro}</p>}</fieldset>}
    </form>}
  </PainelCadastro>;
}
