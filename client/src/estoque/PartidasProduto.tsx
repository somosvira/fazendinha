import { useEffect, useState } from "react";
import { comPropriedade, getPropriedadeAtiva } from "../propriedadeScope";
import { Button, ErrorBox, hoje } from "../financeiro/financeiro-ui";
import { CampoFormulario, classeInput } from "../financeiro/PainelCadastro";
import { DatePicker } from "../components/DatePicker";
import { listarPartidasNutricionais, type PartidaNutricional } from "../pecuaria/rebanho/nutricao/api";
import { listarPropriedades, type PropriedadeDTO } from "../api/propriedades";

export function PartidasProduto({ produtoId, propriedadeId, rastreado, onMudou, configuracao = false }: { produtoId: string; propriedadeId?: number; rastreado: boolean; onMudou: () => void; configuracao?: boolean }) {
  const sitioId = propriedadeId ?? getPropriedadeAtiva() ?? undefined;
  const [partidas, setPartidas] = useState<PartidaNutricional[]>([]);
  const [sitios, setSitios] = useState<PropriedadeDTO[]>([]);
  const [ativo, setAtivo] = useState(rastreado);
  const [previa, setPrevia] = useState<{ revisao: string; movimentosLegados: number; saldos: { propriedadeId: number; quantidade: string }[] } | null>(null);
  const [identificar, setIdentificar] = useState(false);
  const [nome, setNome] = useState("");
  const [validade, setValidade] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const saldoSemValidade = partidas.filter((p) => !p.validade).reduce((s, p) => s + Number(p.saldo), 0);
  useEffect(() => { setChave(crypto.randomUUID()); }, [nome, validade, quantidade, motivo]);
  useEffect(() => { let vivo = true; if (!ativo) listarPropriedades({ incluirInativos: true }).then((s) => { if (vivo) setSitios(s); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [ativo]);
  useEffect(() => { let vivo = true; if (ativo && sitioId) listarPartidasNutricionais(produtoId, sitioId).then((p) => { if (vivo) setPartidas(p); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [produtoId, ativo, sitioId, revisao]);
  async function solicitar(acao: "rastreio/previa" | "rastreio" | "identificar-legado") {
    if (ocupado) return; setOcupado(true); setErro(null);
    try {
      const headers = comPropriedade({ ...(acao === "rastreio/previa" ? {} : { "content-type": "application/json" }) });
      if (sitioId) headers["X-Propriedade-Id"] = String(sitioId);
      const r = await fetch(`/api/estoque/produtos/${produtoId}/${acao}`, { method: acao === "rastreio/previa" ? "GET" : "POST", headers, ...(acao === "rastreio/previa" ? {} : { body: JSON.stringify(acao === "rastreio" ? { revisao: previa?.revisao } : { chave, nome: nome.trim() || undefined, validade, quantidade, motivo, data: hoje() }) }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Não foi possível atualizar os lotes. Tente novamente.");
      if (acao === "rastreio/previa") setPrevia(d);
      else { setAtivo(true); setPrevia(null); setIdentificar(false); setRevisao((v) => v + 1); onMudou(); }
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); if (acao === "rastreio") setPrevia(null); } finally { setOcupado(false); }
  }
  return <fieldset className="grid gap-2 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-semibold">Lotes e validade</legend>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ativo || !!previa} disabled={ativo || ocupado} onChange={(e) => { if (e.target.checked) void solicitar("rastreio/previa"); else setPrevia(null); }} />Controlar lotes por validade</label>
    <p className="text-xs text-ink-3">Opcional. Entradas e saídas passam a identificar o lote do produto. Depois de ativado, o controle não pode ser desligado.</p><ErrorBox erro={erro} />
    {!ativo ? previa ? <><p className="text-sm">A ativação agrupará {previa.movimentosLegados} movimento(s) anteriores sem validade informada. Quantidade e valor totais serão preservados. Entradas e saídas passarão a identificar a validade. A ativação é permanente.</p>{previa.saldos.map((s) => <p key={s.propriedadeId} className="text-sm">{sitios.find((sitio) => sitio.id === s.propriedadeId)?.nome ?? "Sítio não localizado"}: {Number(s.quantidade).toLocaleString("pt-BR")} na unidade do Produto.</p>)}{previa.movimentosLegados === 0 && <p className="text-sm">Ainda não há movimentos. A ativação não cria lote vazio nem saldo.</p>}<div className="flex gap-2"><Button secondary disabled={ocupado} onClick={() => setPrevia(null)}>Cancelar</Button><Button disabled={ocupado} onClick={() => { void solicitar("rastreio"); }}>Confirmar ativação</Button></div></> : configuracao ? <p className="text-xs text-ink-3">Marque a opção para conferir o estoque existente antes de confirmar a ativação.</p> : <Button secondary disabled={ocupado} onClick={() => { void solicitar("rastreio/previa"); }}>Ativar controle de lotes por validade</Button>
      : <><p className="text-sm">Controle de lotes por validade ativo. O cadastro não dá entrada nem cria saldo.</p><a className="text-sm underline" href={`/estoque/produtos/${produtoId}`}>Consultar ficha no Estoque</a>
        {saldoSemValidade > 0 && sitioId && <details><summary className="cursor-pointer text-sm">Identificar estoque sem validade</summary><div className="mt-3 grid gap-3"><p className="text-sm">Há {saldoSemValidade.toLocaleString("pt-BR")} sem validade informada. Identifique apenas a quantidade cuja validade foi conferida.</p><Button secondary onClick={() => setIdentificar((v) => !v)}>Identificar validade do estoque existente</Button>{identificar && <>
          <CampoFormulario id="legado-nome" rotulo="Nome do lote (opcional)">{(p) => <input {...p} maxLength={160} value={nome} onChange={(e) => setNome(e.target.value)} className={classeInput} />}</CampoFormulario>
          <CampoFormulario id="legado-validade" rotulo="Validade informada" obrigatorio>{(p) => <DatePicker {...p} required value={validade} onChange={setValidade} />}</CampoFormulario>
          <CampoFormulario id="legado-quantidade" rotulo="Quantidade na unidade do Produto">{(p) => <input {...p} type="number" min="0.001" max={saldoSemValidade} step="0.001" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className={classeInput} />}</CampoFormulario>
          <CampoFormulario id="legado-motivo" rotulo="Motivo e evidência da identificação">{(p) => <textarea {...p} minLength={5} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={classeInput} />}</CampoFormulario>
          <Button disabled={ocupado || !validade || !(Number(quantidade) > 0) || Number(quantidade) > saldoSemValidade || motivo.trim().length < 5} onClick={() => { void solicitar("identificar-legado"); }}>Confirmar identificação</Button>
        </>}</div></details>}
        {!configuracao && <a href={`/estoque/produtos/${produtoId}`} className="text-sm underline">Consultar lotes e movimentos</a>}
      </>}
  </fieldset>;
}
