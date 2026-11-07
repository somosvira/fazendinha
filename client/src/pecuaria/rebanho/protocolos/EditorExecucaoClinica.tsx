import { PreviaAvaliacaoContextual } from "../reproducao/PreviaAvaliacaoContextual";
import { AjudaCampo } from "../../../components/Dica";
import { Stethoscope } from "lucide-react";
import { CamposTentativaClinica, CamposAvaliacaoClinica, type TarefaClinica } from "./CamposClinicos";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { ModalPolitica } from "../reproducao/ModalPolitica";
import { Button, ErrorBox, PageHeader } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
import { usePreviaInicioExecucao } from "./PreviaInicioExecucao";
import { CampoDataIatf, dataHoraISO, horarioIatf } from "../reproducao/CampoDataIatf";
import { CamposResultadoExame, nomeCampoExame } from "../sanidade/CamposExame";
import { valorComparacaoExecucao } from "../sanidade/PreviaExecucao";
import { reqProtocolo, ProtocoloApiError, type TarefaOperacional } from "./api";
import { dadosClinicosIniciais, montarItemClinico, animaisIndicadosParaIatf } from "./clinica-form";
import { SeletorClinico } from "./SeletorClinico";
import type { DadosClinicos, EntradaClinica, PreviaClinica, ReciboClinico, EscolhaClinica } from "./clinica-api";
import { SelectCampo } from "@/financeiro/SelectCampo";

export function EditorExecucaoClinica({ tarefas, reprodutivo, onFechar, onSalvo, onPrepararIatf }: { tarefas: TarefaOperacional[]; reprodutivo: boolean; podeEditarValores?: boolean; onFechar: () => void; onSalvo: () => void; onPrepararIatf?: (animaisIds: string[]) => void }) {
  const primeira = tarefas[0];
  if (!primeira) return <PainelCadastro icon={Stethoscope} aberto titulo="Registrar atendimento" onFechar={onFechar} rodape={<Button secondary onClick={onFechar}>Fechar</Button>}><ErrorBox erro="Selecione de um a cem animais distintos, elegíveis, da mesma ação e sítio." /></PainelCadastro>;
  const identidade = tarefas.map(t => `${t.id}:${t.propriedadeId}:${t.etapaId}`).join("|");
  return <EditorClinico key={identidade} tarefas={tarefas} reprodutivo={reprodutivo} onFechar={onFechar} onSalvo={onSalvo} onPrepararIatf={onPrepararIatf} primeira={primeira} />;
}
function EditorClinico({ tarefas, primeira, reprodutivo, onFechar, onSalvo, onPrepararIatf }: { tarefas: TarefaOperacional[]; primeira: TarefaOperacional; reprodutivo: boolean; onFechar: () => void; onSalvo: () => void; onPrepararIatf?: (animaisIds: string[]) => void }) {
  const [alterado, setAlterado] = useState(false);
  const [individualId, setIndividualId] = useState<string | null>(null);
  const [comum, setComum] = useState<DadosClinicos>(() => dadosClinicosIniciais(primeira));
  const [excecoes, setExcecoes] = useState<Record<string, Partial<DadosClinicos>>>({});
  const [pagina, setPagina] = useState(1), [erro, setErro] = useState<string | null>(null), [ocupado, setOcupado] = useState(false);
  const [previa, setPrevia] = useState<PreviaClinica | null>(null), [entrada, setEntrada] = useState<EntradaClinica | null>(null), [recibo, setRecibo] = useState<ReciboClinico | null>(null);
  const chave = useRef(crypto.randomUUID()), trava = useRef(false), vivo = useRef(true), geracao = useRef(0);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; geracao.current++; }; }, []);
  const tipo = primeira?.tarefaOrigem.tipo;
  const invalido = !primeira || tarefas.length > 100 || new Set(tarefas.map(t => t.animal.id)).size !== tarefas.length || new Set(tarefas.map(t => t.id)).size !== tarefas.length || tarefas.some(t => t.propriedadeId !== primeira.propriedadeId || t.etapaId !== primeira.etapaId || t.tarefaOrigem.tipo !== tipo || !t.acoes.atender && !(tipo === "AVALIACAO" && (t as TarefaClinica).acoes.reavaliar)) || !["EXAME", "TENTATIVA", "AVALIACAO"].includes(tipo ?? "");
  const invalidar = () => { setAlterado(true); geracao.current++; setPrevia(null); setEntrada(null); chave.current = crypto.randomUUID(); };
  const mudarComum = (patch: Partial<DadosClinicos>) => { invalidar(); if (patch.momento !== undefined) setExcecoes(es => Object.fromEntries(Object.entries(es).map(([id, d]) => [id, { ...d, cienciaRecalendarioLegado: false }]))); setComum(d => ({ ...d, ...patch })); };
  const mudarAnimal = (id: string, patch: Partial<DadosClinicos>) => { invalidar(); setExcecoes(es => ({ ...es, [id]: { ...es[id], ...patch, ...(patch.momento !== undefined ? { cienciaRecalendarioLegado: false } : {}) } })); };
  const hidratarFormato = (escolha: EscolhaClinica) => {
    if (!escolha.tipoResultado) return;
    const formato = {...escolha, tipoResultado: escolha.tipoResultado};
    setComum(atual => atual.tipoExameId !== escolha.id || JSON.stringify(atual.formato) === JSON.stringify(formato) ? atual : {...atual, formato});
  };
  const dadosAnimal = (t: TarefaOperacional): DadosClinicos => ({ ...dadosClinicosIniciais(t), ...comum, ...excecoes[t.id] });
  async function conferir() {
    if (trava.current || invalido || !primeira) return;
    trava.current = true; setOcupado(true); setErro(null); const atual = geracao.current;
    try {
      const preenchidas = tipo === "AVALIACAO" ? tarefas.filter(t => !!dadosAnimal(t).resultado) : tarefas;
      if (!preenchidas.length) throw new Error(`Informe o resultado da avaliação de ${primeira.animal.brinco}. Os animais sem resultado permanecem pendentes.`);
      if (preenchidas.some(t => (t as TarefaClinica).acoes.reavaliar && !dadosAnimal(t).demandaAcompanhamentoId)) throw new Error("Vincule cada reavaliação ao acompanhamento pendente antes de conferir.");
      const execucao: EntradaClinica = { versao: 1, propriedadeId: primeira.propriedadeId, itens: preenchidas.map(t => montarItemClinico(t, dadosAnimal(t))) };
      const p = await reqProtocolo<PreviaClinica>("/execucoes/previa", primeira.propriedadeId, execucao);
      if (vivo.current && geracao.current === atual) { setEntrada(execucao); setPrevia(p); }
    } catch (e) { if (vivo.current && geracao.current === atual) setErro(e instanceof Error ? e.message : String(e)); }
    finally { trava.current = false; if (vivo.current) setOcupado(false); }
  }
  async function confirmar() {
    if (!entrada || !previa || trava.current) return;
    trava.current = true; setOcupado(true); setErro(null);
    try { const r = await reqProtocolo<ReciboClinico>("/execucoes/confirmar", entrada.propriedadeId, { execucao: entrada, chave: chave.current, fingerprint: previa.fingerprint }); if (vivo.current) { setAlterado(false); setRecibo(r); } }
    catch (e) { if (vivo.current) { setErro(e instanceof Error ? e.message : String(e)); if (e instanceof ProtocoloApiError && e.status === 409) invalidar(); } }
    finally { trava.current = false; if (vivo.current) setOcupado(false); }
  }
  async function paginarResultado(p: number, final: boolean) {
    if (!entrada || trava.current) return;
    trava.current = true; setOcupado(true); setErro(null);
    try {
      if (final && recibo) { const r = await reqProtocolo<ReciboClinico>(`/execucoes/${recibo.chave}/itens?pagina=${p}&porPagina=10`, entrada.propriedadeId); if (vivo.current) setRecibo(r); }
      else { const r = await reqProtocolo<PreviaClinica>(`/execucoes/previa?pagina=${p}&porPagina=10`, entrada.propriedadeId, entrada); if (!vivo.current) return; if (r.fingerprint !== previa?.fingerprint) { invalidar(); throw new Error("Os dados mudaram. Confira o conjunto novamente."); } setPrevia(r); }
    } catch (e) { if (vivo.current) setErro(e instanceof Error ? e.message : String(e)); }
    finally { trava.current = false; if (vivo.current) setOcupado(false); }
  }
  const formularioIndividual = (t: TarefaOperacional) => { const d = dadosAnimal(t); return <fieldset key={t.id} disabled={ocupado} className="grid gap-3 border-t border-border pt-4"><legend className="font-semibold">{t.animal.brinco}{t.animal.nome ? ` · ${t.animal.nome}` : ""}</legend>{tipo === "EXAME" && <><label className="flex gap-2"><input type="checkbox" checked={d.informarResultado} onChange={e => mudarAnimal(t.id, { informarResultado: e.target.checked })} />Informar resultado · {t.animal.brinco}</label>{d.informarResultado ? <ResultadoClinico dados={d} onChange={patch => mudarAnimal(t.id, patch)} /> : <p className="text-sm text-ink-3">Coleta sem resultado. O resultado poderá ser completado no mesmo exame, sem repetir a coleta.</p>}</>}
        {tipo === "AVALIACAO" && <CamposAvaliacaoClinica tarefa={t} dados={d} onChange={patch => mudarAnimal(t.id, patch)} />}
        {tipo === "TENTATIVA" && tarefas.length > 1 && <div className="mt-3"><CamposTentativaClinica tarefa={t} dados={d} identificacao={t.animal.brinco} onChange={patch => mudarAnimal(t.id, patch)} /></div>}
        <label>Observações · {t.animal.brinco}<textarea className={classeInput} maxLength={1000} value={d.observacao} onChange={e => mudarAnimal(t.id, { observacao: e.target.value })} /></label>
        {reprodutivo && d.momento && <CienciaClinica tarefa={t} dados={d} onChange={cienciaRecalendarioLegado => mudarAnimal(t.id, { cienciaRecalendarioLegado })} />}
        <details><summary className="cursor-pointer text-sm">Exceções e motivo do desvio · {t.animal.brinco}</summary><div className="mt-3 grid gap-3"><CampoDataIatf rotulo={`Data individual · ${t.animal.brinco}`} valor={d.momento} onChange={momento => mudarAnimal(t.id, { momento })} /><label>Responsável individual<input className={classeInput} value={d.responsavel} onChange={e => mudarAnimal(t.id, { responsavel: e.target.value })} /></label><label>Motivo do desvio<textarea className={classeInput} minLength={5} maxLength={500} value={d.motivoDesvio} onChange={e => mudarAnimal(t.id, { motivoDesvio: e.target.value })} /></label></div></details>
      </fieldset>; };
  const individual = tarefas.find(t => t.id === individualId);
  if (individual && tipo !== "AVALIACAO") return <PainelCadastro icon={Stethoscope} aberto titulo={`Registro individual · ${individual.animal.brinco}`} onFechar={() => setIndividualId(null)} rodape={<Button onClick={() => setIndividualId(null)}>Concluir edição individual</Button>}><p className="mb-4 text-sm text-ink-3">As alterações compõem o atendimento coletivo. Os registros serão salvos somente após conferir e confirmar o conjunto.</p>{formularioIndividual(individual)}</PainelCadastro>;
  if (invalido) return <PainelCadastro icon={Stethoscope} aberto titulo="Registrar atendimento" onFechar={onFechar} rodape={<Button secondary onClick={onFechar}>Fechar</Button>}><ErrorBox erro="Selecione de um a cem animais distintos, elegíveis, da mesma ação e sítio." /></PainelCadastro>;
  const indicados = animaisIndicadosParaIatf(entrada);
  const preparar = () => { try { onPrepararIatf?.(indicados); } catch { setErro("Atendimentos já salvos. Não foi possível abrir a preparação; tente novamente sem registrar os diagnósticos outra vez."); } };
  if (recibo) return <PainelClinico key="recibo" emPagina={tipo === "AVALIACAO"} icon={Stethoscope} aberto titulo="Atendimentos registrados" onFechar={onSalvo} rodape={<><Button secondary onClick={onSalvo}>Concluir</Button>{indicados.length > 0 && onPrepararIatf && <Button onClick={preparar}>Preparar próxima IATF · {indicados.length} {indicados.length === 1 ? "animal indicado" : "animais indicados"}</Button>}</>}><ErrorBox erro={erro} /><p role="status">{recibo.total} atendimentos confirmados. Os fatos individuais permanecem na ficha de cada animal.</p>{tipo === "AVALIACAO" && <p className="mt-3 text-sm">{indicados.length} indicações para nova IATF. A preparação exige revisão e confirmação próprias.</p>}<ul className="divide-y divide-border">{recibo.itens.map(i => <li className="py-3" key={i.tarefaId}><strong>{tarefas.find(t => t.animal.id === i.animalId)?.animal.brinco ?? "Animal"}</strong> · <a className="underline" href={i.tipo === "EXAME" ? `/pecuaria/sanidade?animalId=${i.animalId}&detalheTipo=exame&detalheId=${i.id}&propriedadeId=${primeira.propriedadeId}` : `/pecuaria/reproducao?animalId=${i.animalId}&fatoId=${i.id}&propriedadeId=${primeira.propriedadeId}`}>Abrir registro na ficha</a>{entrada?.itens.find(item => item.tarefaId === i.tarefaId)?.tipo === "AVALIACAO" && <p>{resumoClinico(entrada.itens.find(item => item.tarefaId === i.tarefaId)!)}</p>}{i.acompanhamentoPendente && <p>Acompanhamento pendente. O exame permanece no histórico.</p>}{entrada?.itens.find(item => item.tarefaId === i.tarefaId)?.resultado === "INCONCLUSIVO" && <p>Exame inconclusivo registrado. Consulte o acompanhamento e a próxima avaliação na ficha.</p>}</li>)}</ul>{recibo.total > 10 && <Paginacao paginaAtual={recibo.pagina} totalPaginas={Math.ceil(recibo.total / 10)} totalItens={recibo.total} itensPorPagina={10} onPaginaChange={p => void paginarResultado(p, true)} rotulo="atendimentos confirmados" idSelect="recibo-clinico" />}</PainelClinico>;
  return <PainelClinico emPagina={tipo === "AVALIACAO"} alteracoesExternas={alterado} largura={tarefas.length > 1 ? "sm:max-w-5xl" : undefined} icon={Stethoscope} aberto titulo={tipo === "EXAME" ? "Registrar exame" : tipo === "TENTATIVA" ? "Registrar tentativa" : "Avaliação reprodutiva"} onFechar={onFechar} bloqueado={ocupado} rodape={fechar => <><Button secondary disabled={ocupado} onClick={fechar}>Cancelar</Button>{previa ? <><Button secondary disabled={ocupado} onClick={invalidar}>Editar atendimento</Button><Button disabled={ocupado} onClick={() => void confirmar()}>Confirmar conjunto</Button></> : <Button disabled={ocupado} type="submit" form="form-execucao-clinica">Conferir execução</Button>}</>}>
    <ErrorBox erro={erro} />
    {tipo === "AVALIACAO" && <dl className="mb-5 flex flex-wrap gap-8 border-b border-border pb-4" aria-label="Conferência dos animais"><div><dt className="text-sm text-ink-3">Selecionados</dt><dd className="font-semibold">{tarefas.length}</dd></div><div><dt className="text-sm text-ink-3">Com resultado informado</dt><dd className="font-semibold">{tarefas.filter(t=>!!dadosAnimal(t).resultado).length}</dd></div><div><dt className="text-sm text-ink-3">Continuam pendentes</dt><dd className="font-semibold">{tarefas.filter(t=>!dadosAnimal(t).resultado).length}</dd></div></dl>}
    <p className="mb-4 text-sm">{tarefas.length} {tarefas.length === 1 ? "animal selecionado" : "animais selecionados"}.</p>
    {previa ? <><section className="mb-5 grid gap-3" aria-label="Resumo clínico para confirmação"><h3 className="font-semibold">Atendimentos conferidos</h3>{tipo === "AVALIACAO" && <p className="text-sm">{indicados.length} indicações para nova IATF. {entrada!.itens.length - indicados.length} animais ficam fora da próxima preparação; as decisões individuais estão abaixo.</p>}{previa.tarefas.itens.map(t => { const i = entrada?.itens.find(item => item.tarefaId === t.tarefaId); if (!i) return null; return <div key={t.tarefaId} className="border-b border-border pb-3 text-sm"><strong>{tarefas.find(item => item.id === t.tarefaId)?.animal.brinco}</strong><p>{horarioIatf(i.realizadaEm)} · {resumoClinico(i)}</p>{t.avaliacaoContextual&&<PreviaAvaliacaoContextual dados={t.avaliacaoContextual}/>}{Array.isArray(i.resultados) && i.resultados.map((r: { campo: string; valor: string | number | boolean }) => <p key={r.campo}>{nomeCampoExame(comum.formato?.campos?.find(c => c.codigo === r.campo) ?? { codigo: r.campo })}: {typeof r.valor === "boolean" ? r.valor ? "Sim" : "Não" : String(r.valor)}</p>)}{typeof i.motivoQuantidadeExcepcional === "string" && i.motivoQuantidadeExcepcional && <p>Motivo da quantidade excepcional: {i.motivoQuantidadeExcepcional}</p>}{typeof i.observacao === "string" && i.observacao && <p className="break-words">Observação: {i.observacao}</p>}{t.diferencas.length > 0 && <ul className="mt-2 list-inside list-disc">{t.diferencas.map(d => <li key={d.campo}>{rotuloCampoClinico(d.campo)}: {valorComparacaoExecucao(d.campo, d.planejado, t.exibicao?.planejado[d.campo])} → {valorComparacaoExecucao(d.campo, d.realizado, t.exibicao?.realizado[d.campo])}</li>)}</ul>}{t.motivoObrigatorio && <p>Motivo do desvio: {t.motivo ?? "Informe o motivo antes de confirmar."}</p>}{t.referencia === "LEGADO_SEM_SNAPSHOT" && <p>Planejamento histórico sem parâmetros suficientes para aferir conformidade.</p>}</div>; })}</section><section className="my-5 grid gap-2" aria-label="Consumos previstos"><h3 className="font-semibold">Consumo previsto para confirmação</h3>{previa.consumos.itens.length ? previa.consumos.itens.map((c, i) => <p key={i} className="text-sm">{c.quantidade} {c.unidade} · {valorComparacaoExecucao("produtoId", c.produtoId, c.produtoNome)}{c.partidaId ? ` · lote ${valorComparacaoExecucao("partidaId", c.partidaId, c.partidaNome)}` : ""}</p>) : <p className="text-sm">Sem consumo de estoque nesta conferência.</p>}</section>{previa.tarefas.total > 10 && <Paginacao paginaAtual={previa.tarefas.pagina} totalPaginas={Math.ceil(previa.tarefas.total / 10)} totalItens={previa.tarefas.total} itensPorPagina={10} onPaginaChange={p => void paginarResultado(p, false)} rotulo="atendimentos em conferência" idSelect="previa-clinica" />}</> : <form id="form-execucao-clinica" className="grid gap-5" onSubmit={e => { e.preventDefault(); void conferir(); }}><fieldset disabled={ocupado} className="clinica-dados-comuns grid gap-4"><legend className="mb-3 font-semibold">Atendimento <AjudaCampo rotulo="Ajuda sobre dados comuns" texto="Aplicados aos animais selecionados. Ajuste exceções em Registro individual."/></legend><CampoDataIatf rotulo={tipo === "EXAME" ? "Data da coleta" : "Data do atendimento"} valor={comum.momento} onChange={momento => mudarComum({ momento })} /><label>Responsável<input className={classeInput} value={comum.responsavel} maxLength={160} onChange={e => mudarComum({ responsavel: e.target.value })} /></label>{(tipo === "EXAME" || tipo === "AVALIACAO") && <SeletorClinico tarefaId={primeira.id} propriedadeId={primeira.propriedadeId} opcao="TIPO_EXAME" rotulo="tipo de exame" valor={comum.tipoExameId} onHidratar={hidratarFormato} onChange={(tipoExameId, escolha) => { if (tipoExameId !== comum.tipoExameId) setExcecoes(es => Object.fromEntries(Object.entries(es).map(([id, d]) => [id, { ...d, resultados: [], valorResultado: "", avaliacaoContextual:undefined, vinculosConclusao:undefined, realizadoSemDG:undefined }]))); mudarComum({ tipoExameId, ...(tipoExameId!==comum.tipoExameId?{avaliacaoContextual:undefined,vinculosConclusao:undefined,realizadoSemDG:undefined}:{}), formato: escolha?.tipoResultado ? { ...escolha, tipoResultado: escolha.tipoResultado } : undefined }); }} />}{tipo === "TENTATIVA" && <section className="clinica-material grid gap-4"><h3 className="font-semibold">Material e procedimento</h3><CamposTentativaClinica tarefa={primeira} dados={comum} onChange={mudarComum} /></section>}{tipo === "EXAME" && <SeletorClinico tarefaId={primeira.id} propriedadeId={primeira.propriedadeId} opcao="SERVICO" rotulo="Serviço do exame" valor={comum.operacaoServicoId} onChange={operacaoServicoId => mudarComum({ operacaoServicoId })} />}{reprodutivo && tipo !== "EXAME" && <label className="flex gap-2"><input type="checkbox" checked={comum.cienciaSanitaria} onChange={e => mudarComum({ cienciaSanitaria: e.target.checked })} />Confirmo ciência dos alertas sanitários aplicáveis.</label>}</fieldset>
      <section className="grid gap-4" aria-label="Dados por animal"><h3 className="font-semibold">Animais <AjudaCampo rotulo="Ajuda sobre registro individual" texto="Resultados e observações são individuais. A confirmação salva o conjunto."/></h3>{tarefas.length === 1 ? formularioIndividual(primeira) : <div className="protocolo-tabela protocolos-superficie"><table><thead><tr><th>Animal</th><th>Registro</th><th>Ação</th></tr></thead><tbody>{tarefas.slice((pagina - 1) * 10, pagina * 10).map(t => { const d = dadosAnimal(t); return <tr key={t.id}><td data-label="Animal"><strong>{t.animal.brinco}</strong>{t.animal.nome && <span className="block text-sm text-ink-3">{t.animal.nome}</span>}</td><td data-label="Registro">{tipo === "AVALIACAO" ? ({ POSITIVO: "Gestação confirmada", NEGATIVO: "Gestação não confirmada", INCONCLUSIVO: "Inconclusivo", RECONFIRMACAO: "Reconfirmada", SEXAGEM: "Sexagem" } as Record<string, string>)[d.resultado] ?? "Aguardando resultado" : tipo === "EXAME" ? d.informarResultado ? "Resultado informado" : "Somente coleta" : d.materialId || d.tipoTentativa === "COBERTURA" ? "Dados comuns aplicados" : "Selecione o material"}{d.resultado === "NEGATIVO" && <span className="block text-sm text-ink-3">{d.decisaoIatf === "INDICAR" ? "Indicar para IATF" : d.decisaoIatf === "NAO_INDICAR" ? "Não indicar para IATF" : "IATF: decidir depois"}</span>}</td><td data-label="Ação"><Button secondary type="button" onClick={() => setIndividualId(t.id)}>Registro individual · {t.animal.brinco}</Button></td></tr>; })}</tbody></table></div>}{tarefas.length > 10 && <Paginacao paginaAtual={pagina} totalPaginas={Math.ceil(tarefas.length / 10)} totalItens={tarefas.length} itensPorPagina={10} onPaginaChange={setPagina} rotulo="animais do atendimento" idSelect="animais-clinica" />}</section>
      {tipo === "AVALIACAO" && individual && tarefas.length > 1 && <section className="grid gap-4 border border-border rounded-lg p-4" aria-label={`Detalhes do exame · ${individual.animal.brinco}`}>{formularioIndividual(individual)}<Button secondary type="button" onClick={()=>setIndividualId(null)}>Concluir edição individual</Button></section>}
      <div className="text-sm text-ink-3">Animal não atendido <AjudaCampo rotulo="Ajuda sobre animal não atendido" texto="Use Não atender esta etapa no menu do animal. Informe o motivo; esse registro não cria exame nem gestação."/></div>
    </form>}
  </PainelClinico>;
}
function ResultadoClinico({ dados: d, onChange }: { dados: DadosClinicos; onChange: (patch: Partial<DadosClinicos>) => void }) {
  if (!d.formato) return <p>Selecione o tipo de exame para carregar seu formato.</p>;
  if (d.formato.tipoResultado === "MULTIPLO") return <CamposResultadoExame campos={d.formato.campos ?? []} valores={d.resultados} onChange={resultados => onChange({ resultados })} />;
  return <label>Resultado{d.formato.unidade ? ` · ${d.formato.unidade}` : ""}{d.formato.tipoResultado === "OPCAO" ? <SelectCampo className={classeInput} value={d.valorResultado} onValueChange={(valor) => onChange({ valorResultado: valor })}><option value="">Não informado</option>{d.formato.opcoes?.map(o => <option key={o}>{o}</option>)}</SelectCampo> : <input className={classeInput} type={d.formato.tipoResultado === "NUMERO" ? "number" : "text"} step="any" value={d.valorResultado} onChange={e => onChange({ valorResultado: e.target.value })} />}</label>;
}

function CienciaClinica({ tarefa, dados, onChange }: { tarefa: TarefaOperacional; dados: DadosClinicos; onChange: (valor: boolean) => void }) {
  let instante = ""; try { instante = dataHoraISO(dados.momento); } catch { /* Campo em edição. */ }
  const calendario = usePreviaInicioExecucao(tarefa.id, tarefa.propriedadeId, instante, dados.cienciaRecalendarioLegado);
  useEffect(() => { if (calendario.ciencia !== dados.cienciaRecalendarioLegado) onChange(calendario.ciencia); }, [calendario.ciencia]);
  return <div>{calendario.conteudo}</div>;
}

function resumoClinico(item: import("./clinica-api").ItemClinico): string {
  if (item.tipo === "TENTATIVA") return `Tentativa: ${String(item.tipoTentativa)} · origem ${String(item.origem).toLocaleLowerCase("pt-BR")}`;
  if (item.tipo === "AVALIACAO") {
    const resultado = ({ POSITIVO: "Gestação confirmada", NEGATIVO: "Gestação não confirmada", INCONCLUSIVO: "Exame inconclusivo", RECONFIRMACAO: "Gestação conhecida reconfirmada", SEXAGEM: "Sexagem de gestação conhecida", NAO_AVALIADO: "Avaliação realizada sem DG" } as Record<string, string>)[String(item.resultado)] ?? "Resultado a conferir";
    const finalidade = ({ DIAGNOSTICO: "Diagnóstico", RECONFIRMACAO: "Reconfirmação", SEXAGEM: "Sexagem" } as Record<string, string>)[String(item.finalidade)];
    return [resultado, item.resultadoAptidao && `Aptidão: ${({ APTO: "Apta", NAO_APTO: "Não apta", INCONCLUSIVO: "Pendente" } as Record<string, string>)[String(item.resultadoAptidao)]}`, item.retornoAptidaoEm && `Retorno de aptidão: ${item.retornoAptidaoEm}`, finalidade && `Finalidade: ${finalidade}`, item.resultado === "NEGATIVO" ? item.decisaoIatf === "INDICAR" ? "Indicar para nova IATF" : item.decisaoIatf === "NAO_INDICAR" ? "Não indicar neste atendimento" : "IATF: decidir depois" : item.sexoFetal ? `Sexo fetal: ${item.sexoFetal === "F" ? "Fêmea" : "Macho"}` : "Sexo fetal não informado", item.gestacaoId && "Vinculado à gestação conhecida"].filter(Boolean).join(" · ");
  }
  if (item.resultadoNumero != null) return `Resultado: ${String(item.resultadoNumero)}`;
  if (item.resultadoTexto || item.resultadoOpcao) return `Resultado: ${String(item.resultadoTexto ?? item.resultadoOpcao)}`;
  if (Array.isArray(item.resultados) && item.resultados.length) return "Coleta com resultados nas informações do exame";
  return "Coleta registrada, aguardando resultado";
}

function rotuloCampoClinico(campo: string): string {
  return ({ data: "Data", tipoExameId: "Tipo de exame", tipo: "Procedimento", tipoTentativa: "Tipo de tentativa", materialId: "Material genético", quantidade: "Quantidade", partidaId: "Lote", origem: "Origem", resultado: "Resultado", finalidade: "Finalidade" } as Record<string, string>)[campo] ?? "Parâmetro do atendimento";
}

function PainelClinico({emPagina, ...props}: ComponentProps<typeof PainelCadastro> & {emPagina?: boolean}) {
  if (emPagina) return <div className="clinica-avaliacao-pagina grid gap-5 min-w-0"><PageHeader titulo={props.titulo}/><ModalPolitica {...props} emPagina titulo="Atendimento"/></div>;
  return <PainelCadastro {...props} rodape={typeof props.rodape === "function" ? props.rodape(props.onFechar) : props.rodape}/>;
}
