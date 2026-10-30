import { Stethoscope } from "lucide-react";
import { CamposTentativaClinica, CamposAvaliacaoClinica, type TarefaClinica } from "./CamposClinicos";
import { useEffect, useRef, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
import { usePreviaInicioExecucao } from "./PreviaInicioExecucao";
import { CampoDataIatf, dataHoraISO, horarioIatf } from "../reproducao/CampoDataIatf";
import { CamposResultadoExame, nomeCampoExame } from "../sanidade/CamposExame";
import { valorComparacaoExecucao } from "../sanidade/PreviaExecucao";
import { reqProtocolo, ProtocoloApiError, type TarefaOperacional } from "./api";
import { dadosClinicosIniciais, montarItemClinico } from "./clinica-form";
import { SeletorClinico } from "./SeletorClinico";
import type { DadosClinicos, EntradaClinica, PreviaClinica, ReciboClinico, EscolhaClinica } from "./clinica-api";

export function EditorExecucaoClinica({ tarefas, reprodutivo, onFechar, onSalvo }: { tarefas: TarefaOperacional[]; reprodutivo: boolean; podeEditarValores?: boolean; onFechar: () => void; onSalvo: () => void }) {
  const primeira = tarefas[0];
  if (!primeira) return <PainelCadastro icon={Stethoscope} aberto titulo="Registrar atendimento" onFechar={onFechar} rodape={<Button secondary onClick={onFechar}>Fechar</Button>}><ErrorBox erro="Selecione de um a cem animais distintos, elegíveis, da mesma ação e sítio." /></PainelCadastro>;
  const identidade = tarefas.map(t => `${t.id}:${t.propriedadeId}:${t.etapaId}`).join("|");
  return <EditorClinico key={identidade} tarefas={tarefas} reprodutivo={reprodutivo} onFechar={onFechar} onSalvo={onSalvo} primeira={primeira} />;
}
function EditorClinico({ tarefas, primeira, reprodutivo, onFechar, onSalvo }: { tarefas: TarefaOperacional[]; primeira: TarefaOperacional; reprodutivo: boolean; onFechar: () => void; onSalvo: () => void }) {
  const [comum, setComum] = useState<DadosClinicos>(() => dadosClinicosIniciais(primeira));
  const [excecoes, setExcecoes] = useState<Record<string, Partial<DadosClinicos>>>({});
  const [pagina, setPagina] = useState(1), [erro, setErro] = useState<string | null>(null), [ocupado, setOcupado] = useState(false);
  const [previa, setPrevia] = useState<PreviaClinica | null>(null), [entrada, setEntrada] = useState<EntradaClinica | null>(null), [recibo, setRecibo] = useState<ReciboClinico | null>(null);
  const chave = useRef(crypto.randomUUID()), trava = useRef(false), vivo = useRef(true), geracao = useRef(0);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; geracao.current++; }; }, []);
  const tipo = primeira?.tarefaOrigem.tipo;
  const invalido = !primeira || tarefas.length > 100 || new Set(tarefas.map(t => t.animal.id)).size !== tarefas.length || new Set(tarefas.map(t => t.id)).size !== tarefas.length || tarefas.some(t => t.propriedadeId !== primeira.propriedadeId || t.etapaId !== primeira.etapaId || t.tarefaOrigem.tipo !== tipo || !t.acoes.atender && !(tipo === "AVALIACAO" && (t as TarefaClinica).acoes.reavaliar)) || !["EXAME", "TENTATIVA", "AVALIACAO"].includes(tipo ?? "");
  const invalidar = () => { geracao.current++; setPrevia(null); setEntrada(null); chave.current = crypto.randomUUID(); };
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
      if (tarefas.some(t => (t as TarefaClinica).acoes.reavaliar && !dadosAnimal(t).demandaAcompanhamentoId)) throw new Error("Vincule cada reavaliação ao acompanhamento pendente antes de conferir.");
      const execucao: EntradaClinica = { versao: 1, propriedadeId: primeira.propriedadeId, itens: tarefas.map(t => montarItemClinico(t, dadosAnimal(t))) };
      const p = await reqProtocolo<PreviaClinica>("/execucoes/previa", primeira.propriedadeId, execucao);
      if (vivo.current && geracao.current === atual) { setEntrada(execucao); setPrevia(p); }
    } catch (e) { if (vivo.current && geracao.current === atual) setErro(e instanceof Error ? e.message : String(e)); }
    finally { trava.current = false; if (vivo.current) setOcupado(false); }
  }
  async function confirmar() {
    if (!entrada || !previa || trava.current) return;
    trava.current = true; setOcupado(true); setErro(null);
    try { const r = await reqProtocolo<ReciboClinico>("/execucoes/confirmar", entrada.propriedadeId, { execucao: entrada, chave: chave.current, fingerprint: previa.fingerprint }); if (vivo.current) setRecibo(r); }
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
  if (invalido) return <PainelCadastro icon={Stethoscope} aberto titulo="Registrar atendimento" onFechar={onFechar} rodape={<Button secondary onClick={onFechar}>Fechar</Button>}><ErrorBox erro="Selecione de um a cem animais distintos, elegíveis, da mesma ação e sítio." /></PainelCadastro>;
  if (recibo) return <PainelCadastro icon={Stethoscope} aberto titulo="Atendimentos registrados" onFechar={onSalvo} rodape={<Button onClick={onSalvo}>Concluir</Button>}><ErrorBox erro={erro} /><p role="status">{recibo.total} atendimentos confirmados. Os fatos individuais permanecem na ficha de cada animal.</p><ul className="divide-y divide-border">{recibo.itens.map(i => <li className="py-3" key={i.tarefaId}><strong>{tarefas.find(t => t.animal.id === i.animalId)?.animal.brinco ?? "Animal"}</strong> · <a className="underline" href={i.tipo === "EXAME" ? `/pecuaria/sanidade?animalId=${i.animalId}&detalheTipo=exame&detalheId=${i.id}&propriedadeId=${primeira.propriedadeId}` : `/pecuaria/reproducao?animalId=${i.animalId}&fatoId=${i.id}&propriedadeId=${primeira.propriedadeId}`}>Abrir registro na ficha</a>{i.acompanhamentoPendente && <p>Acompanhamento pendente. O exame permanece no histórico.</p>}{entrada?.itens.find(item => item.tarefaId === i.tarefaId)?.resultado === "INCONCLUSIVO" && <p>Exame inconclusivo registrado. Consulte o acompanhamento e a próxima avaliação na ficha.</p>}</li>)}</ul>{recibo.total > 10 && <Paginacao paginaAtual={recibo.pagina} totalPaginas={Math.ceil(recibo.total / 10)} totalItens={recibo.total} itensPorPagina={10} onPaginaChange={p => void paginarResultado(p, true)} rotulo="atendimentos confirmados" idSelect="recibo-clinico" />}</PainelCadastro>;
  return <PainelCadastro icon={Stethoscope} aberto titulo={tipo === "EXAME" ? "Registrar exame" : tipo === "TENTATIVA" ? "Registrar tentativa" : "Registrar avaliação"} onFechar={onFechar} bloqueado={ocupado} rodape={<><Button secondary disabled={ocupado} onClick={onFechar}>Cancelar</Button>{previa ? <><Button secondary disabled={ocupado} onClick={invalidar}>Editar atendimento</Button><Button disabled={ocupado} onClick={() => void confirmar()}>Confirmar conjunto</Button></> : <Button disabled={ocupado} type="submit" form="form-execucao-clinica">Conferir execução</Button>}</>}>
    <ErrorBox erro={erro} />
    <p className="mb-4 text-sm">{tarefas.length} {tarefas.length === 1 ? "animal selecionado" : "animais selecionados"}. Resultados e observações são individuais. A confirmação salva o conjunto inteiro.</p>
    {previa ? <><section className="mb-5 grid gap-3" aria-label="Resumo clínico para confirmação"><h3 className="font-semibold">Atendimentos conferidos</h3>{previa.tarefas.itens.map(t => { const i = entrada?.itens.find(item => item.tarefaId === t.tarefaId); if (!i) return null; return <div key={t.tarefaId} className="border-b border-border pb-3 text-sm"><strong>{tarefas.find(item => item.id === t.tarefaId)?.animal.brinco}</strong><p>{horarioIatf(i.realizadaEm)} · {resumoClinico(i)}</p>{Array.isArray(i.resultados) && i.resultados.map((r: { campo: string; valor: string | number | boolean }) => <p key={r.campo}>{nomeCampoExame(comum.formato?.campos?.find(c => c.codigo === r.campo) ?? { codigo: r.campo })}: {typeof r.valor === "boolean" ? r.valor ? "Sim" : "Não" : String(r.valor)}</p>)}{typeof i.observacao === "string" && i.observacao && <p className="break-words">Observação: {i.observacao}</p>}{t.diferencas.length > 0 && <ul className="mt-2 list-inside list-disc">{t.diferencas.map(d => <li key={d.campo}>{rotuloCampoClinico(d.campo)}: {valorComparacaoExecucao(d.campo, d.planejado, t.exibicao?.planejado[d.campo])} → {valorComparacaoExecucao(d.campo, d.realizado, t.exibicao?.realizado[d.campo])}</li>)}</ul>}{t.motivoObrigatorio && <p>Motivo do desvio: {t.motivo ?? "Informe o motivo antes de confirmar."}</p>}{t.referencia === "LEGADO_SEM_SNAPSHOT" && <p>Planejamento histórico sem parâmetros suficientes para aferir conformidade.</p>}</div>; })}</section><section className="my-5 grid gap-2" aria-label="Consumos previstos"><h3 className="font-semibold">Consumo previsto para confirmação</h3>{previa.consumos.itens.length ? previa.consumos.itens.map((c, i) => <p key={i} className="text-sm">{c.quantidade} {c.unidade} · {valorComparacaoExecucao("produtoId", c.produtoId, c.produtoNome)}{c.partidaId ? ` · lote ${valorComparacaoExecucao("partidaId", c.partidaId, c.partidaNome)}` : ""}</p>) : <p className="text-sm">Sem consumo de estoque nesta conferência.</p>}</section>{previa.tarefas.total > 10 && <Paginacao paginaAtual={previa.tarefas.pagina} totalPaginas={Math.ceil(previa.tarefas.total / 10)} totalItens={previa.tarefas.total} itensPorPagina={10} onPaginaChange={p => void paginarResultado(p, false)} rotulo="atendimentos em conferência" idSelect="previa-clinica" />}</> : <form id="form-execucao-clinica" className="grid gap-5" onSubmit={e => { e.preventDefault(); void conferir(); }}><fieldset disabled={ocupado} className="grid gap-4"><legend className="mb-3 font-semibold">Dados comuns</legend><CampoDataIatf rotulo={tipo === "EXAME" ? "Data da coleta" : "Data do atendimento"} valor={comum.momento} onChange={momento => mudarComum({ momento })} /><label>Responsável<input className={classeInput} value={comum.responsavel} maxLength={160} onChange={e => mudarComum({ responsavel: e.target.value })} /></label>{(tipo === "EXAME" || tipo === "AVALIACAO") && <SeletorClinico tarefaId={primeira.id} propriedadeId={primeira.propriedadeId} opcao="TIPO_EXAME" rotulo="tipo de exame" valor={comum.tipoExameId} onHidratar={hidratarFormato} onChange={(tipoExameId, escolha) => { if (tipoExameId !== comum.tipoExameId) setExcecoes(es => Object.fromEntries(Object.entries(es).map(([id, d]) => [id, { ...d, resultados: [], valorResultado: "" }]))); mudarComum({ tipoExameId, formato: escolha?.tipoResultado ? { ...escolha, tipoResultado: escolha.tipoResultado } : undefined }); }} />}{tipo === "TENTATIVA" && <CamposTentativaClinica tarefa={primeira} dados={comum} onChange={mudarComum} />}{tipo === "EXAME" && <SeletorClinico tarefaId={primeira.id} propriedadeId={primeira.propriedadeId} opcao="SERVICO" rotulo="Serviço do exame" valor={comum.operacaoServicoId} onChange={operacaoServicoId => mudarComum({ operacaoServicoId })} />}{reprodutivo && tipo !== "EXAME" && <label className="flex gap-2"><input type="checkbox" checked={comum.cienciaSanitaria} onChange={e => mudarComum({ cienciaSanitaria: e.target.checked })} />Confirmo ciência dos alertas sanitários aplicáveis.</label>}</fieldset>
      <section className="grid gap-4" aria-label="Dados por animal"><h3 className="font-semibold">Registro por animal</h3>{tarefas.slice((pagina - 1) * 10, pagina * 10).map(t => { const d = dadosAnimal(t); return <fieldset key={t.id} disabled={ocupado} className="grid gap-3 border-t border-border pt-4"><legend className="font-semibold">{t.animal.brinco}{t.animal.nome ? ` · ${t.animal.nome}` : ""}</legend>{tipo === "EXAME" && <><label className="flex gap-2"><input type="checkbox" checked={d.informarResultado} onChange={e => mudarAnimal(t.id, { informarResultado: e.target.checked })} />Informar resultado · {t.animal.brinco}</label>{d.informarResultado ? <ResultadoClinico dados={d} onChange={patch => mudarAnimal(t.id, patch)} /> : <p className="text-sm text-ink-3">Coleta sem resultado. O resultado poderá ser completado no mesmo exame, sem repetir a coleta.</p>}</>}
        {tipo === "AVALIACAO" && <CamposAvaliacaoClinica tarefa={t} dados={d} onChange={patch => mudarAnimal(t.id, patch)} />}
        {tipo === "TENTATIVA" && <details><summary className="cursor-pointer text-sm">Exceções da tentativa · {t.animal.brinco}</summary><div className="mt-3"><CamposTentativaClinica tarefa={t} dados={d} identificacao={t.animal.brinco} onChange={patch => mudarAnimal(t.id, patch)} /></div></details>}
        <label>Observações · {t.animal.brinco}<textarea className={classeInput} maxLength={1000} value={d.observacao} onChange={e => mudarAnimal(t.id, { observacao: e.target.value })} /></label>
        {reprodutivo && d.momento && <CienciaClinica tarefa={t} dados={d} onChange={cienciaRecalendarioLegado => mudarAnimal(t.id, { cienciaRecalendarioLegado })} />}
        <details><summary className="cursor-pointer text-sm">Exceções e motivo do desvio · {t.animal.brinco}</summary><div className="mt-3 grid gap-3"><CampoDataIatf rotulo={`Data individual · ${t.animal.brinco}`} valor={d.momento} onChange={momento => mudarAnimal(t.id, { momento })} /><label>Responsável individual<input className={classeInput} value={d.responsavel} onChange={e => mudarAnimal(t.id, { responsavel: e.target.value })} /></label><label>Motivo do desvio<textarea className={classeInput} minLength={5} maxLength={500} value={d.motivoDesvio} onChange={e => mudarAnimal(t.id, { motivoDesvio: e.target.value })} /></label></div></details>
      </fieldset>; })}{tarefas.length > 10 && <Paginacao paginaAtual={pagina} totalPaginas={Math.ceil(tarefas.length / 10)} totalItens={tarefas.length} itensPorPagina={10} onPaginaChange={setPagina} rotulo="animais do atendimento" idSelect="animais-clinica" />}</section>
      <p className="text-sm text-ink-3">Se o animal não foi atendido ou avaliado, registre a justificativa de não atendimento na tarefa. Motivo é obrigatório; nenhum exame ou gestação é criado por esse registro.</p>
    </form>}
  </PainelCadastro>;
}
function ResultadoClinico({ dados: d, onChange }: { dados: DadosClinicos; onChange: (patch: Partial<DadosClinicos>) => void }) {
  if (!d.formato) return <p>Selecione o tipo de exame para carregar seu formato.</p>;
  if (d.formato.tipoResultado === "MULTIPLO") return <CamposResultadoExame campos={d.formato.campos ?? []} valores={d.resultados} onChange={resultados => onChange({ resultados })} />;
  return <label>Resultado{d.formato.unidade ? ` · ${d.formato.unidade}` : ""}{d.formato.tipoResultado === "OPCAO" ? <select className={classeInput} value={d.valorResultado} onChange={e => onChange({ valorResultado: e.target.value })}><option value="">Não informado</option>{d.formato.opcoes?.map(o => <option key={o}>{o}</option>)}</select> : <input className={classeInput} type={d.formato.tipoResultado === "NUMERO" ? "number" : "text"} step="any" value={d.valorResultado} onChange={e => onChange({ valorResultado: e.target.value })} />}</label>;
}

function CienciaClinica({ tarefa, dados, onChange }: { tarefa: TarefaOperacional; dados: DadosClinicos; onChange: (valor: boolean) => void }) {
  let instante = ""; try { instante = dataHoraISO(dados.momento); } catch { /* Campo em edição. */ }
  const calendario = usePreviaInicioExecucao(tarefa.id, tarefa.propriedadeId, instante, dados.cienciaRecalendarioLegado);
  useEffect(() => { if (calendario.ciencia !== dados.cienciaRecalendarioLegado) onChange(calendario.ciencia); }, [calendario.ciencia]);
  return <div>{calendario.conteudo}</div>;
}

function resumoClinico(item: import("./clinica-api").ItemClinico): string {
  if (item.tipo === "TENTATIVA") return `Tentativa: ${String(item.tipoTentativa)} · origem ${String(item.origem).toLocaleLowerCase("pt-BR")}`;
  if (item.tipo === "AVALIACAO") return ({ POSITIVO: "Gestação confirmada", NEGATIVO: "Gestação não confirmada", INCONCLUSIVO: "Exame inconclusivo", RECONFIRMACAO: "Gestação conhecida reconfirmada", SEXAGEM: "Sexagem de gestação conhecida" } as Record<string, string>)[String(item.resultado)] ?? "Resultado a conferir";
  if (item.resultadoNumero != null) return `Resultado: ${String(item.resultadoNumero)}`;
  if (item.resultadoTexto || item.resultadoOpcao) return `Resultado: ${String(item.resultadoTexto ?? item.resultadoOpcao)}`;
  if (Array.isArray(item.resultados) && item.resultados.length) return "Coleta com resultados nas informações do exame";
  return "Coleta registrada, aguardando resultado";
}

function rotuloCampoClinico(campo: string): string {
  return ({ data: "Data", tipoExameId: "Tipo de exame", tipo: "Procedimento", tipoTentativa: "Tipo de tentativa", materialId: "Material genético", quantidade: "Quantidade", partidaId: "Lote", origem: "Origem", resultado: "Resultado", finalidade: "Finalidade" } as Record<string, string>)[campo] ?? "Parâmetro do atendimento";
}
