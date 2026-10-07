import { useEffect, useRef, useState } from "react";
import { DatePicker } from "../../../components/DatePicker";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { reqSanidade, listarServicos, SanidadeApiError, type ServicoSanitario } from "./api";
import type { TipoExame } from "./CadastrosSanitarios";
import { FormAplicacaoServico, type TarefaAplicacao } from "./FormAplicacaoServico";
import { ConferenciaExecucao, type PreviaExecucao } from "./PreviaExecucao";
import type { TarefaRodada } from "./rodadas-api";
import { dataSanitaria } from "./rotulos";
import { buscarFichaAnimal } from "../api";
import type { AnimalFicha } from "../types";

export function ExecutarEtapa({ tarefas, onFechar, onSalvo }: { tarefas: TarefaRodada[]; onFechar: () => void; onSalvo: () => void }) {
  const primeira = tarefas[0];
  const invalido = !primeira || tarefas.length > 100 || tarefas.some((t) => t.etapaId !== primeira.etapaId || t.parametros.tipo !== primeira.parametros.tipo) || new Set(tarefas.map((t) => t.execucao.animalId)).size !== tarefas.length;
  if (invalido) return <PainelCadastro aberto titulo="Executar etapa" onFechar={onFechar} rodape={<Button secondary onClick={onFechar}>Fechar</Button>}><ErrorBox erro="Selecione até 100 tarefas de animais distintos, da mesma etapa e sítio." /></PainelCadastro>;
  if (primeira.parametros.tipo === "EXAME") return <ExecutarExames tarefas={tarefas} onFechar={onFechar} onSalvo={onSalvo} />;
  const planejadas: TarefaAplicacao[] = tarefas.map((t) => ({ id: t.id, animalId: t.execucao.animalId, produtoId: t.parametros.produtoId ?? "", tipoAplicacaoId: t.parametros.tipoAplicacaoId ?? "", dose: t.parametros.dose ?? "", unidade: t.parametros.unidade ?? "ML", via: t.parametros.via, previstaPara: t.previstaPara, protocoloNome: t.execucao.protocolo.nome, protocoloVersao: t.execucao.protocolo.versao }));
  return <FormAplicacaoServico animalId={primeira.execucao.animalId} propriedadeId={primeira.propriedadeAtualId ?? primeira.execucao.propriedadeId} tarefa={planejadas[0]} tarefas={planejadas} animais={tarefas.length > 1 ? tarefas.map((t) => ({ id: t.execucao.animalId, brinco: t.execucao.animal?.brinco ?? t.execucao.animalId, propriedadeId: t.propriedadeAtualId ?? t.execucao.propriedadeId })) : undefined} onFechar={onFechar} onSalvo={onSalvo} />;
}

function ExecutarExames({ tarefas, onFechar, onSalvo }: { tarefas: TarefaRodada[]; onFechar: () => void; onSalvo: () => void }) {
  const primeira = tarefas[0];
  const propriedadeId = primeira.propriedadeAtualId ?? primeira.execucao.propriedadeId;
  const [fichas, setFichas] = useState<Record<string, AnimalFicha>>({});
  const [data, setData] = useState(primeira.previstaPara.slice(0, 10));
  const [tipoId, setTipoId] = useState(primeira.parametros.tipoExameId ?? "");
  const [responsavel, setResponsavel] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [servicos, setServicos] = useState<ServicoSanitario[]>([]);
  const [tipos, setTipos] = useState<TipoExame[]>([]);
  const [desvio, setDesvio] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [individual, setIndividual] = useState<Record<string, { data?: string; tipoExameId?: string; motivo?: string; resultado?: string }>>({});
  const [previa, setPrevia] = useState<PreviaExecucao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [campoErro, setCampoErro] = useState("");
  const formulario = useRef<HTMLFormElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const chave = useRef(crypto.randomUUID());
  const trava = useRef(false);
  useEffect(() => { let vivo = true; setFichas({}); Promise.all(tarefas.map((t) => buscarFichaAnimal(t.execucao.animalId))).then((v) => { if (vivo) setFichas(Object.fromEntries(v.map((a) => [a.id, a]))); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [tarefas]);
  const dataPrimeira = desvio ? individual[primeira.id]?.data || data : primeira.previstaPara.slice(0, 10);
  const localPrimeira = fichas[primeira.execucao.animalId]?.historicoLocalizacoes.find((l) => l.desde.slice(0, 10) <= dataPrimeira && (!l.ate || l.ate.slice(0, 10) > dataPrimeira));
  const sitioServicos = localPrimeira?.propriedade?.id ?? propriedadeId;
  useEffect(() => { let vivo = true; setServicos([]); setServicoId(""); Promise.all([reqSanidade<TipoExame[]>("/tipos-exame"), listarServicos(sitioServicos)]).then(([t, s]) => { if (vivo) { setTipos(t); setServicos(s); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [sitioServicos]);
  useEffect(() => { const campo = formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]'); if (!campo) return; let p = campo.parentElement; while (p) { if (p instanceof HTMLDetailsElement) p.open = true; p = p.parentElement; } campo.focus(); campo.scrollIntoView?.({ block: "center" }); }, [campoErro, erro]);
  function editar() { chave.current = crypto.randomUUID(); setPrevia(null); setErro(null); setCampoErro(""); }
  const falhaCampo = (nome: string) => campoErro === nome || campoErro.replace(/^itens\.\d+\./, "") === nome;
  const atributosCampo = (nome: string) => ({ "aria-invalid": falhaCampo(nome) || undefined, "aria-describedby": falhaCampo(nome) ? `execucao-erro-${nome}` : undefined });
  const avisoCampo = (nome: string) => falhaCampo(nome) ? <p id={`execucao-erro-${nome}`} role="alert" className="text-sm text-red-700">{erro}</p> : null;
  async function enviar() {
    if (trava.current) return;
    const itens = tarefas.map((t) => {
      const i = individual[t.id];
      const tipoExameId = desvio ? i?.tipoExameId || tipoId : t.parametros.tipoExameId ?? "";
      const formato = tipos.find((v) => v.id === tipoExameId);
      const resultado = i?.resultado ?? "";
      return { tipo: "EXAME" as const, tarefaId: t.id, animalId: t.execucao.animalId, propriedadeId, data: desvio ? i?.data || data : t.previstaPara.slice(0, 10), tipoExameId, responsavel: responsavel.trim() || undefined, operacaoServicoId: servicoId || undefined, ...(resultado === "" ? {} : formato?.tipoResultado === "NUMERO" ? { resultadoNumero: Number(resultado) } : formato?.tipoResultado === "OPCAO" ? { resultadoOpcao: resultado } : { resultadoTexto: resultado }), ...(desvio ? { desvio: { motivo: (i?.motivo || motivo).trim() } } : {}) };
    });
    if (itens.some((i) => !i.data || i.data > hoje())) { setCampoErro("data"); setErro("A coleta realizada deve ter uma data até hoje. Registre desvio para alterar a data planejada."); return; }
    for (const item of itens) { const f = fichas[item.animalId]; const local = f?.historicoLocalizacoes.find((l) => l.desde.slice(0, 10) <= item.data && (!l.ate || l.ate.slice(0, 10) > item.data || f.baixa?.data.slice(0, 10) === item.data && l.ate.slice(0, 10) === item.data)); if (!local?.propriedade) { setErro(`${f?.brinco ?? "Animal"}: confira o sítio histórico na data realizada.`); return; } item.propriedadeId = local.propriedade.id; }
    const sitioExecucao = itens[0].propriedadeId;
    if (itens.some((i) => i.propriedadeId !== sitioExecucao)) { setErro("As coletas precisam ocorrer no mesmo sítio nas datas realizadas."); return; }
    if (itens.some((i) => i.desvio && i.desvio.motivo.length < 5)) { setCampoErro("desvio.motivo"); setErro("Explique o desvio de cada animal com 5 a 500 caracteres."); return; }
    trava.current = true; setOcupado(true); setErro(null);
    try {
      const payload = { propriedadeId: sitioExecucao, itens };
      if (!previa) setPrevia(await reqSanidade<PreviaExecucao>("/tarefas/execucao/previa", { method: "POST", body: JSON.stringify(payload) }));
      else if (previa.itens.some((i) => i.motivoObrigatorio && !i.motivo)) setErro("Registre o motivo e confira uma nova prévia.");
      else { await reqSanidade("/tarefas/execucao/confirmacao", { method: "POST", body: JSON.stringify({ ...payload, chave: chave.current, fingerprint: previa.fingerprint }) }); onSalvo(); }
    } catch (e: unknown) { setCampoErro(e instanceof SanidadeApiError ? e.campo ?? "" : ""); setErro(e instanceof Error ? e.message : String(e)); }
    finally { trava.current = false; setOcupado(false); }
  }
  const alterarIndividual = (id: string, patch: typeof individual[string]) => { editar(); setIndividual((v) => ({ ...v, [id]: { ...v[id], ...patch } })); };
  return <PainelCadastro aberto titulo={tarefas.length > 1 ? "Executar exames da etapa" : "Executar exame da etapa"} onFechar={() => { if (!ocupado) onFechar(); }} rodape={<><ErrorBox erro={erro} /><Button secondary disabled={ocupado} onClick={onFechar}>Cancelar</Button><Button type="submit" form="execucao-exame" disabled={ocupado || Object.keys(fichas).length !== tarefas.length}>{ocupado ? "Aguarde…" : previa ? "Confirmar execução" : "Conferir execução"}</Button></>}>
    <form ref={formulario} id="execucao-exame" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void enviar(); }}><p>{primeira.execucao.protocolo.nome} · v{primeira.execucao.protocolo.versao} · Exame</p><p>Animal, versão e natureza da etapa permanecem fixos.</p><fieldset disabled={ocupado} className="grid gap-4"><Button secondary onClick={() => { editar(); setDesvio((v) => !v); setIndividual({}); setData(primeira.previstaPara.slice(0, 10)); setTipoId(primeira.parametros.tipoExameId ?? ""); setMotivo(""); }}>{desvio ? "Voltar ao planejamento" : "Registrar desvio"}</Button><label>Data realizada<DatePicker {...atributosCampo("data")} required max={hoje()} disabled={!desvio} value={data} onChange={(v) => { editar(); setData(v); }} />{avisoCampo("data")}</label><label>Tipo de exame<select {...atributosCampo("tipoExameId")} required disabled={!desvio} className={classeInput} value={tipoId} onChange={(e) => { editar(); setTipoId(e.target.value); setIndividual({}); }}><option value="">Selecione</option>{tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>{avisoCampo("tipoExameId")}</label>{desvio && <label>Motivo comum do desvio<textarea {...atributosCampo("desvio.motivo")} required minLength={5} maxLength={500} className={classeInput} value={motivo} onChange={(e) => { editar(); setMotivo(e.target.value); }} />{avisoCampo("desvio.motivo")}</label>}<label>Responsável<input {...atributosCampo("responsavel")} maxLength={160} className={classeInput} value={responsavel} onChange={(e) => { editar(); setResponsavel(e.target.value); }} />{avisoCampo("responsavel")}</label><label>Serviço associado<select {...atributosCampo("operacaoServicoId")} className={classeInput} value={servicoId} onChange={(e) => { editar(); setServicoId(e.target.value); }}><option value="">Sem serviço</option>{servicos.map((s) => <option key={s.id} value={s.id}>#{s.numero} · {s.descricao}</option>)}</select>{avisoCampo("operacaoServicoId")}</label>
      {tarefas.map((t) => { const i = individual[t.id]; const formato = tipos.find((v) => v.id === (i?.tipoExameId || tipoId)); return <section key={t.id} className="grid gap-3 rounded-lg border border-border p-3"><strong>{t.execucao.animal?.brinco ?? t.execucao.animalId}</strong><p>Planejado: {dataSanitaria(t.previstaPara)} · {t.parametros.tipoExameNomeSnapshot ?? tipos.find((v) => v.id === t.parametros.tipoExameId)?.nome ?? "Exame"}</p>{desvio && tarefas.length > 1 && <details><summary>Ajustes individuais</summary><label>Data individual<DatePicker max={hoje()} value={i?.data ?? data} onChange={(v) => alterarIndividual(t.id, { data: v })} /></label><label>Tipo individual<select className={classeInput} value={i?.tipoExameId ?? tipoId} onChange={(e) => alterarIndividual(t.id, { tipoExameId: e.target.value, resultado: "" })}>{tipos.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></label><label>Motivo individual<textarea maxLength={500} className={classeInput} value={i?.motivo ?? ""} onChange={(e) => alterarIndividual(t.id, { motivo: e.target.value })} placeholder="Usar motivo comum" /></label></details>}<label>Resultado (opcional){formato?.unidade ? ` · ${formato.unidade}` : ""}{formato?.tipoResultado === "OPCAO" ? <select className={classeInput} value={i?.resultado ?? ""} onChange={(e) => alterarIndividual(t.id, { resultado: e.target.value })}><option value="">Aguardando resultado</option>{formato.opcoes?.map((v) => <option key={v}>{v}</option>)}</select> : <input type={formato?.tipoResultado === "NUMERO" ? "number" : "text"} step="any" maxLength={1000} className={classeInput} value={i?.resultado ?? ""} onChange={(e) => alterarIndividual(t.id, { resultado: e.target.value })} />}</label></section>; })}</fieldset>{previa && <ConferenciaExecucao previa={previa} animais={tarefas.map((t) => ({ id: t.execucao.animalId, brinco: t.execucao.animal?.brinco ?? t.execucao.animalId }))} />}</form>
  </PainelCadastro>;
}
