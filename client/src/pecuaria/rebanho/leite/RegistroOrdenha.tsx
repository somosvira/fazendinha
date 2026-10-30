import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, ArrowLeft, Milk, Droplets, ShieldCheck, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/DatePicker";
import { CabecalhoTabela, TabelaFinanceira } from "@/financeiro/financeiro-ui";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { classeInput } from "@/financeiro/PainelCadastro";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { getUsuario } from "../../../lib/auth";
import { contextoParcelas, salvarParcelas, confirmarParcelas } from "./parcelas-api";
import type { ContextoParcelas, NaturezaParcela } from "./parcelas-types";
import { aplicarParcelasSalvas, carenciasSessao, nomesNatureza, novaParcela, possuiContexto, prepararParcelas, reconciliarParcelas, selecionarParcelasAlteradas, type RascunhoParcela } from "./registro-parcelas-modelo";
import { dataValida, formatarLitros, hojeOperacional } from "./modelo";
import "./registro-ordenha.css";

interface Rascunho { data: string; posicao: string; parcelas: RascunhoParcela[]; alterado: boolean; registroId?: string; contextoData: string; conflitos?: string[] }
export function chaveRascunhoOrdenha(sitio: number, registro: string) { return `terrano:leite:registro:${getUsuario()?.id ?? "transicao"}:${sitio}:${registro}`; }
export function lerRascunhoOrdenha(chave: string): Rascunho | null {
  try {
    const r: unknown = JSON.parse(sessionStorage.getItem(chave) ?? "null");
    if (!r || typeof r !== "object" || !("data" in r) || !("parcelas" in r)) return null;
    const d = r as Rascunho;
    if (!dataValida(d.data) || typeof d.posicao !== "string" || !Array.isArray(d.parcelas) || !d.parcelas.every(p => p && typeof p.chave === "string" && typeof p.litros === "string" && typeof p.regua === "string" && typeof p.responsavel === "string" && typeof p.justificativa === "string" && Array.isArray(p.animais) && p.animais.every(id => typeof id === "string") && ["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO"].includes(p.natureza))) return null;
    return d;
  } catch { return null; }
}
function guardar(chave: string, rascunho: Rascunho) { try { sessionStorage.setItem(chave, JSON.stringify(rascunho)); } catch { /* Formulário permanece em memória. */ } }

export function RegistroOrdenha({ sitio, podeLancar, registroId, rascunhoId, aoVoltar, aoOcupadoChange }: { sitio: number; podeLancar: boolean; registroId: string; rascunhoId: string; aoVoltar: () => void; aoOcupadoChange?: (ocupado: boolean) => void }) {
  const chave = chaveRascunhoOrdenha(sitio, registroId || rascunhoId);
  const [rascunho, setRascunho] = useState<Rascunho>(() => lerRascunhoOrdenha(chave) ?? { data: new URLSearchParams(location.search).get("dataOperacional") || hojeOperacional(), posicao: new URLSearchParams(location.search).get("ordenha") ?? "", parcelas: [], alterado: false, registroId: registroId || undefined, contextoData: "" });
  const [contexto, setContexto] = useState<ContextoParcelas | null>(null);
  const [erro, setErro] = useState("");
  const [erroContexto, setErroContexto] = useState("");
  const [revisao, setRevisao] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { aoOcupadoChange?.(ocupado); return () => aoOcupadoChange?.(false); }, [ocupado, aoOcupadoChange]);
  const salvandoRef = useRef(false);
  const campoDataRef = useRef<HTMLLabelElement>(null);
  const validarData = () => campoDataRef.current?.querySelector("input")?.reportValidity() ?? false;
  const [origens, setOrigens] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [conferido, setConferido] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoDTO[] | null>(null);
  const [erroProdutos, setErroProdutos] = useState("");
  const [revisaoProdutos, setRevisaoProdutos] = useState(0);
  const [mensagem, setMensagem] = useState("");
  const [substituindoRascunho, setSubstituindoRascunho] = useState(false);
  useEffect(() => { guardar(chave, rascunho); }, [chave, rascunho]);
  useEffect(() => {
    if (!rascunho.alterado) return;
    const proteger = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", proteger);
    return () => window.removeEventListener("beforeunload", proteger);
  }, [rascunho.alterado]);
  useEffect(() => {
    let ativo = true;
    setContexto(null); setErroContexto("");
    void contextoParcelas(sitio, rascunho.data).then(d => {
      if (!ativo) return;
      setContexto(d);
      setRascunho(r => {
        const idEsperado = r.registroId || registroId;
        const sessao = idEsperado ? d.sessoes.find(s => s.id === idEsperado) : d.sessoes.find(s => s.posicaoId === r.posicao) ?? d.sessoes[0];
        if (idEsperado && !sessao) return { ...r, conflitos: ["A ordenha consultada não foi encontrada no servidor nesta data. Seu rascunho foi preservado; volte à consulta para conferir o registro."] };
        const salvas = d.medicoes.filter(m => m.sessaoId === sessao?.id);
        const reconciliadas = reconciliarParcelas(r.parcelas, salvas, r.alterado);
        if (r.alterado) return { ...r, ...reconciliadas, posicao: r.posicao || sessao?.posicaoId || "" };
        const comerciais = d.origensAutomaticas.filter(a => carenciasSessao(d, sessao?.posicaoId ?? "").some(c => c.animalId === a.animalId && c.estado === "SEM_RESTRICAO_REGISTRADA")).map(a => a.animalId);
        return { ...r, ...reconciliadas, registroId: idEsperado || (salvas.length ? sessao?.id ?? undefined : undefined), posicao: sessao?.posicaoId ?? "", parcelas: salvas.length || idEsperado ? reconciliadas.parcelas : [novaParcela("COMERCIAL", comerciais)], contextoData: r.data };
      });
    }).catch(e => { if (ativo) setErroContexto(e instanceof Error ? e.message : "Não foi possível consultar a ordenha."); });
    return () => { ativo = false; };
  }, [sitio, rascunho.data, revisao, registroId]);
  useEffect(() => {
    if (!confirmando) return;
    let ativo = true;
    setErroProdutos(""); setProdutos(null);
    void listarProdutos({ ativo: true }, sitio).then(p => { if (ativo) setProdutos(p.filter(v => v.ativo !== false && v.unidade === "L" && !v.rastrearPartidas)); }).catch(() => { if (ativo) setErroProdutos("Não foi possível carregar os produtos. Tente novamente."); });
    return () => { ativo = false; };
  }, [confirmando, sitio, revisaoProdutos]);
  const confirmada = rascunho.parcelas.length > 0 && rascunho.parcelas.every(p => !!p.entradaId);
  const emConflito = !!rascunho.conflitos?.length;
  const registroDisponivel = contexto?.sessoes.some(s => s.id === (rascunho.registroId || registroId));
  const travado = ocupado || !podeLancar;
  function usarVersaoServidor() {
    if (!registroDisponivel || ocupado) return;
    setSubstituindoRascunho(false);
    setContexto(null);
    setErro(""); setMensagem(""); setOrigens(null); setConfirmando(false);
    setRascunho(r => ({ ...r, parcelas: [], alterado: false, conflitos: [] }));
    setRevisao(r => r + 1);
  }
  function mudarParcela(chaveParcela: string, patch: Partial<RascunhoParcela>, altera = true) {
    setRascunho(r => ({ ...r, alterado: altera || r.alterado, parcelas: r.parcelas.map(p => p.chave === chaveParcela ? { ...p, ...patch } : p) }));
    setMensagem("");
  }
  function adicionar(natureza: NaturezaParcela, direta = false) {
    if (!contexto) return;
    const ids = direta ? [] : natureza === "COLOSTRO" ? contexto.contexto?.origensColostro.map(a => a.animalId) ?? [] : natureza === "NAO_COMERCIAL" ? carenciasSessao(contexto, rascunho.posicao).filter(a => a.estado !== "SEM_RESTRICAO_REGISTRADA").map(a => a.animalId) : contexto.origensAutomaticas.filter(a => carenciasSessao(contexto, rascunho.posicao).some(c => c.animalId === a.animalId && c.estado === "SEM_RESTRICAO_REGISTRADA")).map(a => a.animalId);
    setRascunho(r => ({ ...r, alterado: true, parcelas: [...r.parcelas, novaParcela(natureza, ids, direta)] }));
  }
  async function salvar(confirmar = false) {
    if (!contexto || salvandoRef.current || !validarData()) return;
    salvandoRef.current = true;
    setErro(""); setOcupado(true);
    try {
      if (emConflito) throw new Error("Confira as alterações do servidor antes de salvar ou confirmar. Seus campos continuam preservados.");
      const preparadas = prepararParcelas(rascunho.parcelas, contexto, rascunho.posicao, confirmar);
      const inputs = selecionarParcelasAlteradas(preparadas, contexto.medicoes);
      if (!rascunho.posicao || !contexto.sessoes.some(s => s.posicaoId === rascunho.posicao)) throw new Error("Selecione uma ordenha vigente nesta data.");
      if (contexto.configuracao.fonteProducao !== "GERAL") throw new Error("A fonte vigente nesta data é individual. Confira a configuração de produção.");
      let parcelas = rascunho.parcelas;
      if (inputs.length) {
        const resposta = await salvarParcelas(sitio, rascunho.data, rascunho.posicao, inputs);
        parcelas = aplicarParcelasSalvas(parcelas, inputs, resposta.parcelas);
        setContexto(c => {
          if (!c) return c;
          const salvas = new Map(resposta.parcelas.map(p => [p.id, p]));
          return { ...c, sessoes: c.sessoes.map(s => s.posicaoId === rascunho.posicao ? { ...s, id: resposta.sessaoId } : s), medicoes: [...c.medicoes.filter(p => !salvas.has(p.id)), ...resposta.parcelas] };
        });
        setRascunho(r => ({ ...r, parcelas, registroId: resposta.sessaoId, alterado: false, contextoData: r.data }));
      } else setRascunho(r => ({ ...r, alterado: false, contextoData: r.data }));
      if (confirmar) {
        const pendentes = parcelas.filter(p => !p.entradaId && !p.classificacaoPendente && Number(p.litros.replace(",", ".")) > 0);
        if (!pendentes.length) throw new Error("Não há parcelas positivas pendentes de entrada no estoque.");
        if (pendentes.some(p => !produtos?.some(v => v.id === p.produto) || p.motivo.trim().length < 5)) throw new Error("Escolha o produto e informe o motivo da natureza de cada parcela.");
        const resultado = await confirmarParcelas(sitio, pendentes.map(p => ({ medicaoId: p.id!, versaoEsperada: p.versao, produtoId: p.produto, motivoNatureza: p.motivo })));
        setRascunho(r => ({ ...r, parcelas: r.parcelas.map(p => ({ ...p, entradaId: resultado.entradas.find(e => e.medicaoId === p.id)?.id ?? p.entradaId })), alterado: false }));
        setConfirmando(false); setMensagem("Parcelas confirmadas no estoque.");
      } else setMensagem("Ordenha salva. A entrada no estoque permanece pendente.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar. Seu formulário foi preservado."); }
    finally { salvandoRef.current = false; setOcupado(false); }
  }
  function abrirConfirmacao() {
    if (!contexto || !validarData()) return;
    setErro("");
    if (emConflito) { setErro("Confira as alterações do servidor antes de confirmar. Seus campos continuam preservados."); return; }
    try { prepararParcelas(rascunho.parcelas, contexto, rascunho.posicao, true); setConferido(false); setConfirmando(true); }
    catch (e) { setErro(e instanceof Error ? e.message : "Confira as parcelas."); }
  }
  const parcelaOrigens = rascunho.parcelas.find(p => p.chave === origens);
  const animaisAtuais = contexto ? [...new Map([...contexto.animais, ...contexto.origensAutomaticas, ...(contexto.contexto?.origensColostro ?? [])].map(a => [a.animalId, a])).values()] : [];
  const idsAtuais = new Set(animaisAtuais.map(a => a.animalId));
  const animais: { animalId: string; brinco: string; nome: string | null; ausente?: boolean }[] = [...animaisAtuais, ...[...new Set(rascunho.parcelas.flatMap(p => p.animais))].filter(id => !idsAtuais.has(id)).map(id => ({ animalId: id, brinco: id, nome: null, ausente: true }))];
  const soma = rascunho.parcelas.filter(p => p.litros.trim());
  return <div className="leite-page leite-registro">
    <CabecalhoTabela titulo={confirmada ? "Consultar ordenha" : "Registrar ordenha"} acao={<Button variant="outline" disabled={ocupado} onClick={aoVoltar}><ArrowLeft size={16} aria-hidden />Voltar à consulta</Button>} />
    <div className="leite-registro-corpo">
      <div className="leite-registro-campos">
        <label ref={campoDataRef}>Data da ordenha<DatePicker required aria-label="Data da ordenha" max={hojeOperacional()} disabled={travado || !!rascunho.registroId} value={rascunho.data} onChange={data => { if (dataValida(data)) setRascunho(r => ({ ...r, data, alterado: true })); }} /></label>
        <label>Ordenha<SelectCampo aria-label="Ordenha" disabled={travado || !!rascunho.registroId || !contexto} value={rascunho.posicao} onValueChange={posicao => setRascunho(r => ({ ...r, posicao, alterado: true }))}><option value="">Selecione</option>{contexto?.sessoes.map(s => <option key={s.posicaoId} value={s.posicaoId}>{s.nome}</option>)}</SelectCampo></label>
      </div>
      {erroContexto ? <div role="alert">{erroContexto}<Button variant="outline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button></div> : !contexto ? <p role="status">Consultando contexto da ordenha…</p> : <>
        {emConflito && <section role="alert"><h3>Alterações no servidor</h3>{rascunho.conflitos?.map(c => <p key={c}>{c}</p>)}<div className="leite-registro-linha"><Button variant="outline" disabled={ocupado} onClick={() => setRevisao(r => r + 1)}>Reconsultar versões</Button>{registroDisponivel && <Button variant="outline" disabled={ocupado} onClick={() => setSubstituindoRascunho(true)}>Usar versão do servidor</Button>}</div></section>}
        {rascunho.parcelas.some(p => p.classificacaoPendente) && <section><h3>Classificação pendente</h3>{rascunho.parcelas.filter(p => p.classificacaoPendente).map(p => <p key={p.chave}>{formatarLitros(Number(p.litros))} · Natureza histórica não comprovada. Consulte a regularização em Estoque.</p>)}</section>}
        {rascunho.contextoData && rascunho.contextoData !== rascunho.data && <p role="status">Data alterada. Confira as origens preservadas e justifique as parcelas sem contexto compatível.</p>}
        <div className="leite-registro-layout"><div className="leite-registro-parcelas">
        {(["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO"] as const).map(natureza => {
          const grupo = rascunho.parcelas.filter(p => !p.classificacaoPendente && p.natureza === natureza);
          const sugestao = natureza === "NAO_COMERCIAL" ? carenciasSessao(contexto, rascunho.posicao).some(a => a.estado !== "SEM_RESTRICAO_REGISTRADA") : natureza === "COLOSTRO" && !!contexto.contexto?.origensColostro.length;
          if (!grupo.length) return (sugestao || natureza === "COMERCIAL") && !travado ? <div className="leite-registro-sugestao" key={natureza}>{natureza !== "COMERCIAL" && <span>{natureza === "COLOSTRO" ? "Há partos compatíveis com o critério de colostro." : "Há animais com carência ou contexto sanitário pendente."}</span>}<Button variant="outline" onClick={() => adicionar(natureza)}>Incluir {nomesNatureza[natureza]}</Button></div> : null;
          return <section className="leite-registro-natureza" key={natureza} aria-label={`Parcelas de ${nomesNatureza[natureza]}`}><div className="leite-registro-linha"><h3>{natureza === "COMERCIAL" ? <Milk size={20} aria-hidden/> : natureza === "COLOSTRO" ? <Droplets size={20} aria-hidden/> : <ShieldCheck size={20} aria-hidden/>}{nomesNatureza[natureza]}</h3>{!travado && <Button variant="outline" onClick={() => adicionar(natureza, natureza !== "COMERCIAL" && !sugestao)}><Plus size={16} aria-hidden />Incluir outra origem</Button>}</div>
            {grupo.map((p, indice) => {
              const leitura = travado || !!p.entradaId;
              const direta = natureza !== "COMERCIAL" && (p.direta || !possuiContexto(p, contexto, rascunho.posicao));
              const tanques = [...new Map([...contexto.tanques, ...contexto.medicoes.flatMap(m => m.tanque ? [m.tanque] : [])].map(t => [t.id, t])).values()];
              return <fieldset key={p.chave} className="leite-registro-parcela" disabled={ocupado}><legend>Origem {indice + 1}{p.entradaId ? " · Confirmada" : ""}</legend>
                {p.direta && <p>Registro direto com justificativa</p>}
                <div className="leite-registro-campos">
                  <label>Tanque ou recipiente<SelectCampo aria-label={`Tanque ou recipiente · ${nomesNatureza[natureza]} ${indice + 1}`} disabled={leitura} value={p.tanqueId} onValueChange={tanqueId => mudarParcela(p.chave, { tanqueId })}><option value="">Outro recipiente segregado</option>{tanques.filter(t => t.ativo || t.id === p.tanqueId).map(t => <option key={t.id} value={t.id}>{t.nome} · v{t.versao} · {formatarLitros(t.capacidadeLitros)}</option>)}</SelectCampo></label>
                  {!p.tanqueId && <label>Identificação do recipiente<input className={classeInput} disabled={leitura} maxLength={160} value={p.recipiente} onChange={e => mudarParcela(p.chave, { recipiente: e.target.value })} /></label>}
                  <label>Régua (mm) · opcional<input className={classeInput} disabled={leitura} inputMode="decimal" value={p.regua} onChange={e => mudarParcela(p.chave, { regua: e.target.value })} /></label>
                  <label className="ordenha-campo-volume">Litros informados manualmente<input className={classeInput} disabled={leitura} inputMode="decimal" value={p.litros} onChange={e => mudarParcela(p.chave, { litros: e.target.value })} /></label>
                  <label>Responsável<input className={classeInput} disabled={leitura} maxLength={160} value={p.responsavel} onChange={e => mudarParcela(p.chave, { responsavel: e.target.value })} /></label>
                </div>
                <div className="leite-registro-linha"><span>{p.animais.length} animais identificados</span><Button type="button" variant="outline" onClick={() => setOrigens(p.chave)}>{leitura ? "Consultar animais" : "Conferir animais"}</Button>{!leitura && !p.id && <Button type="button" variant="ghost" aria-label={`Remover origem ${indice + 1} de ${nomesNatureza[natureza]}`} onClick={() => setRascunho(r => ({ ...r, alterado: true, parcelas: r.parcelas.filter(a => a.chave !== p.chave) }))}><Trash2 size={16} aria-hidden />Remover</Button>}</div>
                {direta && <label>Justificativa do registro direto<textarea className={classeInput} disabled={leitura} required minLength={5} maxLength={1000} value={p.justificativa} onChange={e => mudarParcela(p.chave, { justificativa: e.target.value, direta: true })} /></label>}
                {p.id && !p.entradaId && <label>Motivo da correção<input className={classeInput} disabled={leitura} minLength={5} value={p.motivo} onChange={e => mudarParcela(p.chave, { motivo: e.target.value })} /></label>}
              </fieldset>;
            })}</section>;
        })}
        {!travado && <div className="leite-registro-linha"><span>Registrar diretamente com justificativa</span><Button variant="outline" onClick={() => adicionar("NAO_COMERCIAL", true)}>Descarte</Button><Button variant="outline" onClick={() => adicionar("COLOSTRO", true)}>Colostro</Button></div>}
        </div><aside className="leite-registro-conferencia" aria-label="Conferência da ordenha"><h3><ClipboardCheck size={20} aria-hidden/>Conferência</h3>
          <div className="leite-registro-linha leite-registro-total"><span>Total informado</span><strong>{soma.length ? formatarLitros(soma.reduce((v, p) => v + (Number(p.litros.replace(",", ".")) || 0), 0)) : "Não informado"}</strong></div>
          <dl>{(["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO"] as const).map(n => {
            const parcelas = soma.filter(p => !p.classificacaoPendente && p.natureza === n);
            const volumes = parcelas.map(p => Number(p.litros.replace(",", ".")));
            return <div key={n}><dt>{nomesNatureza[n]}</dt><dd>{volumes.length && volumes.every(v => Number.isFinite(v) && v >= 0) ? formatarLitros(volumes.reduce((a, b) => a + b, 0)) : "Não informado"}</dd></div>;
          })}</dl>
          <p>Salvar a medição não movimenta o estoque. Confira as origens, a segregação e os produtos antes de confirmar a entrada.</p>
        </aside></div>
        {mensagem && <p role="status">{mensagem}</p>}{erro && <p role="alert" className="leite-erro">{erro}</p>}
        {!confirmada && podeLancar && <div className="leite-registro-rodape"><Button variant="outline" disabled={ocupado || emConflito} onClick={() => void salvar()}>Salvar ordenha</Button><Button disabled={ocupado || emConflito} onClick={abrirConfirmacao}>Conferir entrada no estoque</Button></div>}
      </>}
    </div>
    <Dialog open={substituindoRascunho} onOpenChange={setSubstituindoRascunho}><DialogContent aria-describedby={undefined}><DialogHeader><DialogTitle>Usar versão do servidor?</DialogTitle></DialogHeader><p>Os campos locais deste registro serão substituídos pelos dados atuais do servidor. Nenhuma alteração será salva automaticamente.</p><DialogFooter><Button variant="outline" onClick={() => setSubstituindoRascunho(false)}>Cancelar</Button><Button onClick={usarVersaoServidor}>Usar versão do servidor</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!parcelaOrigens} onOpenChange={v => { if (!v) setOrigens(null); }}><DialogContent className="leite-registro-dialog" aria-describedby={undefined}><DialogHeader><DialogTitle>Animais de origem · {parcelaOrigens ? nomesNatureza[parcelaOrigens.natureza] : ""}</DialogTitle></DialogHeader>{parcelaOrigens && <div className="leite-registro-origens">
      {animais.map(a => {
        const carencia = contexto && carenciasSessao(contexto, rascunho.posicao).find(c => c.animalId === a.animalId);
        const bloqueado = a.ausente || (parcelaOrigens.natureza === "COMERCIAL" && (!carencia || carencia.estado !== "SEM_RESTRICAO_REGISTRADA"));
        return <label key={a.animalId}><input type="checkbox" disabled={travado || !!parcelaOrigens.entradaId || (!!bloqueado && !parcelaOrigens.animais.includes(a.animalId))} checked={parcelaOrigens.animais.includes(a.animalId)} onChange={e => { if (e.target.checked && bloqueado) return; mudarParcela(parcelaOrigens.chave, { animais: e.target.checked ? [...parcelaOrigens.animais, a.animalId] : parcelaOrigens.animais.filter(id => id !== a.animalId) }); }} /><span>{a.brinco}{a.nome ? ` · ${a.nome}` : ""}{a.ausente ? " · Origem fora do contexto atual; apenas remoção" : carencia && carencia.estado !== "SEM_RESTRICAO_REGISTRADA" ? " · Carência / revisão sanitária" : ""}</span></label>;
      })}
      {!animais.length && <p>Nenhum animal identificado no contexto desta data.</p>}
      {parcelaOrigens.natureza === "COLOSTRO" && !parcelaOrigens.direta && contexto?.contexto?.criterioColostro?.tipo === "PRIMEIRA_ORDENHA" && <label><input type="checkbox" disabled={travado || !!parcelaOrigens.entradaId} checked={parcelaOrigens.primeira ?? false} onChange={e => mudarParcela(parcelaOrigens.chave, { primeira: e.target.checked })} />Declaro que esta parcela é a primeira ordenha dos animais selecionados após o parto.</label>}
      {parcelaOrigens.direta && <p>Declaração direta: {parcelaOrigens.justificativa || "Justificativa ainda não informada"}. Nenhum parto ou evento sanitário é criado.</p>}
    </div>}<DialogFooter><Button onClick={() => setOrigens(null)}>Concluir conferência</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={confirmando} onOpenChange={v => { if (!ocupado) setConfirmando(v); }}><DialogContent className="leite-registro-dialog" aria-describedby={undefined}><DialogHeader><DialogTitle>Confirmar parcelas no estoque</DialogTitle></DialogHeader><div className="leite-registro-confirmacao">
      <TabelaFinanceira rotulo="Parcelas a confirmar" itens={rascunho.parcelas.filter(p => !p.entradaId && !p.classificacaoPendente && p.litros.trim())} chaveDe={p => p.chave} colunas={[{ chave: "natureza", titulo: "Natureza", principal: true, celula: p => nomesNatureza[p.natureza] }, { chave: "origem", titulo: "Origem física", celula: p => contexto?.tanques.find(t => t.id === p.tanqueId)?.nome ?? p.recipiente }, { chave: "litros", titulo: "Litros", alinhamento: "direita", celula: p => formatarLitros(Number(p.litros.replace(",", "."))) }]} />
      {rascunho.parcelas.filter(p => !p.entradaId && !p.classificacaoPendente && Number(p.litros.replace(",", ".")) > 0).map((p, i) => <div key={p.chave} className="leite-registro-campos"><label>Produto · {nomesNatureza[p.natureza]} {i + 1}<SelectCampo aria-label={`Produto da parcela ${i + 1}`} disabled={ocupado || !produtos} value={p.produto} onValueChange={produto => mudarParcela(p.chave, { produto }, false)}><option value="">Selecione</option>{produtos?.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}</SelectCampo></label><label>Motivo da natureza<input className={classeInput} disabled={ocupado} minLength={5} value={p.motivo} onChange={e => mudarParcela(p.chave, { motivo: e.target.value }, false)} /></label></div>)}
      {!produtos && !erroProdutos && <p role="status">Carregando produtos…</p>}{erroProdutos && <div role="alert">{erroProdutos}<Button variant="outline" onClick={() => setRevisaoProdutos(r => r + 1)}>Tentar novamente</Button></div>}{produtos?.length === 0 && <p>Nenhum produto ativo em litros sem rastreamento de partidas. Confira o cadastro de produtos.</p>}
      <label className="leite-registro-check"><input type="checkbox" checked={conferido} disabled={ocupado} onChange={e => setConferido(e.target.checked)} />Conferi a segregação física, os animais, os produtos e a natureza de cada parcela.</label>
      {erro && <p role="alert" className="leite-erro">{erro}</p>}
    </div><DialogFooter><Button variant="outline" disabled={ocupado} onClick={() => setConfirmando(false)}>Cancelar</Button><Button disabled={ocupado || !conferido || !produtos?.length} onClick={() => void salvar(true)}>{ocupado ? "Confirmando…" : "Confirmar parcelas"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
