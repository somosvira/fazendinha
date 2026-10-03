import { useEffect, useState } from "react";
import { listarMovimentos, type MovimentoDTO } from "./api";
import { comPropriedade } from "../propriedadeScope";
import { Button, ErrorBox, hoje } from "../financeiro/financeiro-ui";
import { CampoFormulario, classeInput } from "../financeiro/PainelCadastro";
import { DatePicker } from "../components/DatePicker";
import { ROTULO_ORIGEM } from "./rotulos";
import { listarPartidasNutricionais, type PartidaNutricional } from "../pecuaria/rebanho/nutricao/api";

export function PartidasProduto({ produtoId, rastreado, onMudou, configuracao = false }: { produtoId: string; rastreado: boolean; onMudou: () => void; configuracao?: boolean }) {
  const [partidaHistorico, setPartidaHistorico] = useState<string | null>(null);
  const [movimentos, setMovimentos] = useState<MovimentoDTO[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);
  useEffect(() => { let vivo = true; if (partidaHistorico) { setHistoricoCarregando(true); listarMovimentos({ produtoId, partidaId: partidaHistorico, pagina, porPagina: 15 }).then((r) => { if (vivo) { setMovimentos(r.itens); setTotal(r.total); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setHistoricoCarregando(false); }); } return () => { vivo = false; }; }, [produtoId, partidaHistorico, pagina]);
  const [partidas, setPartidas] = useState<PartidaNutricional[]>([]);
  const [ativo, setAtivo] = useState(rastreado);
  const [confirmar, setConfirmar] = useState(false);
  const [previa, setPrevia] = useState<{ revisao: string; movimentosLegados: number; saldos: { propriedadeId: number; quantidade: string }[]; partidaTecnica: string } | null>(null);
  const [identificar, setIdentificar] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [validade, setValidade] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [chave, setChave] = useState(() => crypto.randomUUID());
  useEffect(() => { setChave(crypto.randomUUID()); }, [codigo, validade, quantidade, motivo]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => { let vivo = true; if (ativo) listarPartidasNutricionais(produtoId).then((p) => { if (vivo) { setPartidas(p); setErro(null); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [produtoId, ativo, revisao]);
  async function conferirAtivacao() {
    setErro(null); setOcupado(true);
    try {
      const r = await fetch(`/api/estoque/produtos/${produtoId}/rastreio/previa`, { headers: comPropriedade() });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Não foi possível conferir o rastreio");
      setPrevia(d); setConfirmar(true);
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  async function enviar(acao: "rastreio" | "identificar-legado") {
    if (ocupado) return; setOcupado(true); setErro(null);
    try { const r = await fetch(`/api/estoque/produtos/${produtoId}/${acao}`, { method: "POST", headers: comPropriedade({ "content-type": "application/json" }), body: JSON.stringify(acao === "rastreio" ? { revisao: previa?.revisao } : { chave, codigo, validade: validade || null, quantidade, motivo, data: hoje() }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Não foi possível atualizar lotes"); setAtivo(true); setConfirmar(false); setPrevia(null); setIdentificar(false); setRevisao((v) => v + 1); onMudou(); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); if (acao === "rastreio") { setConfirmar(false); setPrevia(null); } } finally { setOcupado(false); }
  }
  return <section className="grid gap-3 rounded-lg border border-border p-3"><h3 className="font-semibold">Controle por lote</h3><ErrorBox erro={erro} />{!ativo ? confirmar && previa ? <><p className="text-sm">A ativação associará {previa.movimentosLegados} movimento(s) ao estoque sem lote identificado. Quantidade e valor líquidos não mudam. Depois da ativação, entradas e saídas exigirão distribuição por lote. A ativação não será desfeita.</p>{previa.saldos.map((s) => <p key={s.propriedadeId} className="text-sm">Sítio #{s.propriedadeId}: saldo {s.quantidade}</p>)}<div className="flex gap-2"><Button secondary onClick={() => { setConfirmar(false); setPrevia(null); }}>Cancelar</Button><Button disabled={ocupado} onClick={() => { void enviar("rastreio"); }}>Confirmar ativação</Button></div></> : <Button secondary disabled={ocupado} onClick={() => { void conferirAtivacao(); }}>Ativar controle de lotes e validade</Button> : <>{!configuracao && <>{partidas.map((p) => <p key={p.id} className="text-sm">{p.origemRastreio === "LEGADO_NAO_IDENTIFICADO" ? "Estoque sem lote identificado" : p.codigo} · saldo {p.saldo} · validade {p.validade?.slice(0, 10) ?? "não informada"} <Button secondary onClick={() => { setPartidaHistorico(p.id); setPagina(1); }}>Ver movimentos</Button></p>)}{partidaHistorico && <section className="grid gap-2 rounded-lg border border-border p-3"><h4>Movimentos · {partidas.find((p) => p.id === partidaHistorico)?.codigo}</h4>{historicoCarregando ? <p>Carregando movimentos…</p> : movimentos.length ? movimentos.map((m) => <p key={m.id} className="text-sm">{m.data.slice(0, 10)} · {m.tipo} · {m.partidas?.find((p) => p.partidaId === partidaHistorico)?.quantidade ?? m.quantidade} no lote · total do movimento {m.quantidade} · {ROTULO_ORIGEM[m.origem]}{m.reversaoDeId ? " · estorno" : ""}</p>) : <p>Nenhum movimento neste sítio.</p>}<div className="flex gap-2"><Button secondary disabled={pagina <= 1 || historicoCarregando} onClick={() => setPagina((p) => p - 1)}>Anterior</Button><Button secondary disabled={pagina * 15 >= total || historicoCarregando} onClick={() => setPagina((p) => p + 1)}>Próxima</Button><Button secondary onClick={() => setPartidaHistorico(null)}>Fechar movimentos</Button></div></section>}{!partidas.length && <p className="text-sm">Sem lotes neste sítio.</p>}</>}{configuracao && <><p className="text-sm">Controle de lotes e validade ativo.</p><a className="text-sm underline" href={`/estoque?produtoId=${produtoId}#lotes`}>Consultar lotes no Estoque</a></>}<Button secondary onClick={() => setIdentificar((v) => !v)}>Identificar lote do estoque existente</Button>{identificar && <><p className="text-sm">Distribui o estoque sem lote identificado entre lotes identificados, sem alterar quantidade ou valor totais.</p><CampoFormulario id="legado-codigo" rotulo="Código do lote">{(p) => <input {...p} value={codigo} onChange={(e) => setCodigo(e.target.value)} className={classeInput} />}</CampoFormulario><CampoFormulario id="legado-validade" rotulo="Validade (opcional)">{(p) => <DatePicker {...p} value={validade} onChange={setValidade} />}</CampoFormulario><CampoFormulario id="legado-quantidade" rotulo="Quantidade na unidade do Produto">{(p) => <input {...p} type="number" min="0.001" step="0.001" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className={classeInput} />}</CampoFormulario><CampoFormulario id="legado-motivo" rotulo="Motivo e evidência da identificação">{(p) => <textarea {...p} minLength={5} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={classeInput} />}</CampoFormulario><Button disabled={ocupado || !codigo || !(Number(quantidade) > 0) || motivo.trim().length < 5} onClick={() => { void enviar("identificar-legado"); }}>Confirmar identificação</Button></>}</>}</section>;
}
