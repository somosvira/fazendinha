import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { listarComprasDiretas, listarServicos, listarTiposAplicacao, registrarAplicacao, reqSanidade, type AplicacaoInput, type CompraDireta, type EstadoPrazo, type ServicoSanitario, type TipoAplicacao } from "./api";
import { listarPartidasNutricionais, type PartidaNutricional } from "../nutricao/api";
import { buscarFichaAnimal } from "../api";
import type { AnimalFicha } from "../types";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { UNIDADES, UNIDADES_ORDENADAS, type UnidadeMedida } from "../../../lib/unidades";

export type TarefaAplicacao = { id: string; produtoId: string; tipoAplicacaoId: string; dose: string; unidade: string };
export function FormAplicacaoServico({ animalId, propriedadeId, onSalvo, onFechar, tarefa, animais }: {
  animalId: string; propriedadeId: number; onSalvo: () => void; onFechar: () => void;
  tarefa?: TarefaAplicacao;
  animais?: Array<{ id: string; brinco: string; propriedadeId: number | null }>;
}) {
  const [leiteRelevante, setLeiteRelevante] = useState<boolean | null>(null);
  const [ficha, setFicha] = useState<AnimalFicha | null>(null);
  useEffect(() => { let vivo = true; if (animais?.length) { setLeiteRelevante(null); return; } buscarFichaAnimal(animalId).then((a) => { if (vivo) { setFicha(a); setLeiteRelevante(a.sexo === "F" && a.aptidao === "LEITE"); if (a.baixa) setData(a.baixa.data.slice(0, 10)); } }).catch(() => { if (vivo) setLeiteRelevante(null); }); return () => { vivo = false; }; }, [animalId]);
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [conferindo, setConferindo] = useState(false);
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [servicos, setServicos] = useState<ServicoSanitario[]>([]);
  const [tipos, setTipos] = useState<TipoAplicacao[]>([]);
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [compras, setCompras] = useState<CompraDireta[]>([]);
  const [partidas, setPartidas] = useState<PartidaNutricional[]>([]);
  const [tipoId, setTipoId] = useState(tarefa?.tipoAplicacaoId ?? "");
  const [origem, setOrigem] = useState<AplicacaoInput["origemInsumo"]>("BAIXA_ESTOQUE");
  const [servicoId, setServicoId] = useState("");
  const [produtoId, setProdutoId] = useState(tarefa?.produtoId ?? "");
  const [compraId, setCompraId] = useState("");
  const [cienciaValidadeDesconhecida, setCienciaValidadeDesconhecida] = useState(false);
  const [cienciaVencida, setCienciaVencida] = useState(false);
  const [motivoVencida, setMotivoVencida] = useState("");
  const [partidaId, setPartidaId] = useState("");
  const [data, setData] = useState(hoje());
  const [hora, setHora] = useState("");
  const [nome, setNome] = useState("");
  const [dose, setDose] = useState(tarefa?.dose ?? "");
  const [unidade, setUnidade] = useState(tarefa?.unidade ?? "ML");
  const [responsavel, setResponsavel] = useState("");
  const [via, setVia] = useState("");
  const [ocorrenciaId, setOcorrenciaId] = useState("");
  const [ocorrencias, setOcorrencias] = useState<{ id: string; inicio: string; doenca: { nome: string } }[]>([]);
  useEffect(() => { let vivo = true; if (animais?.length) return; reqSanidade<{ id: string; inicio: string; doenca: { nome: string } }[]>(`/ocorrencias?animalId=${animalId}&situacao=VALIDO`).then((v) => { if (vivo) setOcorrencias(v); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [animalId, animais]);
  const [justificativa, setJustificativa] = useState("");
  const [estadoLeite, setEstadoLeite] = useState<EstadoPrazo>("NAO_INFORMADO");
  const [estadoCarne, setEstadoCarne] = useState<EstadoPrazo>("NAO_INFORMADO");
  const [leite, setLeite] = useState("");
  const [carne, setCarne] = useState("");
  const [motivoCarne, setMotivoCarne] = useState("");
  const [partida, setPartida] = useState("");
  const [validade, setValidade] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const emCurso = useRef(false);
  const localDoFato = ficha?.historicoLocalizacoes?.find((l) => l.propriedade && l.desde.slice(0, 10) <= data && (l.ate == null || l.ate.slice(0, 10) > data || (ficha.baixa?.data.slice(0, 10) === data && l.ate.slice(0, 10) === data)));
  const sitioDoFato = animais?.length ? propriedadeId : localDoFato?.propriedade?.id ?? propriedadeId;
  const produto = produtos.find((p) => p.id === produtoId);
  const unidadesCompativeis = produto ? UNIDADES_ORDENADAS.filter((u) => UNIDADES[u].base === UNIDADES[produto.unidade].base) : UNIDADES_ORDENADAS;
  const partidaSugerida = partidas.filter((p) => Number(p.saldo) > 0 && p.validade && p.validade.slice(0, 10) >= data)
    .sort((a, b) => (a.validade ?? "").localeCompare(b.validade ?? ""))[0];
  useEffect(() => {
    let vivo = true;
    Promise.all([listarServicos(sitioDoFato), listarTiposAplicacao(), listarProdutos({ ativo: true }), listarComprasDiretas(sitioDoFato)])
      .then(([s, t, p, c]) => { if (vivo) { setServicos(s); setTipos(t.filter((v) => v.ativo)); setProdutos(p); if (tarefa) setNome(p.find((v) => v.id === tarefa.produtoId)?.nome ?? ""); setCompras(c); } })
      .catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [sitioDoFato]);
  useEffect(() => {
    let vivo = true; setPartidas([]); setPartidaId(""); setCienciaValidadeDesconhecida(false);
    if (produto?.rastrearPartidas && origem === "BAIXA_ESTOQUE") listarPartidasNutricionais(produto.id, sitioDoFato).then((p) => { if (vivo) setPartidas(p); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [produto?.id, produto?.rastrearPartidas, origem, sitioDoFato]);
  function selecionarProduto(id: string) { setProdutoId(id); const p = produtos.find((v) => v.id === id); if (p) { setNome(p.nome); setUnidade(p.unidade); setVia(p.perfilSanitario?.viaPadrao ?? ""); setLeite(p.perfilSanitario?.carenciaLeiteHoras?.toString() ?? ""); setCarne(p.perfilSanitario?.carenciaCarneHoras?.toString() ?? ""); setEstadoLeite(p.perfilSanitario?.carenciaLeiteHoras == null ? "NAO_INFORMADO" : "INFORMADO"); setEstadoCarne(p.perfilSanitario?.carenciaCarneHoras == null ? "NAO_INFORMADO" : "INFORMADO"); } }
  async function submeter(e: FormEvent) {
    e.preventDefault(); if (emCurso.current) return;
    if (!tipoId || !data || !hora || !nome.trim() || !(Number(dose) > 0)) { setErro("Informe tipo, medicamento, quantidade e data/hora."); return; }
    if (ficha?.historicoLocalizacoes?.length && !localDoFato?.propriedade) { setErro("Não há sítio comprovado para o animal nessa data. Confira o histórico de localização."); return; }
    if (ficha?.baixa && data > ficha.baixa.data.slice(0, 10)) { setErro("A aplicação histórica não pode ser posterior à baixa do animal."); return; }
    for (const [estado, prazo] of [[estadoLeite, leite], [estadoCarne, carne]]) if (estado === "INFORMADO" && (prazo === "" || !Number.isInteger(Number(prazo)) || Number(prazo) < 0)) { setErro("Informe a carência em horas inteiras. Zero é permitido; vazio não é zero."); return; }
    if (animais?.some((a) => a.propriedadeId !== propriedadeId)) { setErro("Selecione somente animais do mesmo sítio."); return; }
    if (animais?.length && !conferindo) { setQuantidades(Object.fromEntries(animais.map((a) => [a.id, dose]))); setConferindo(true); setChave(crypto.randomUUID()); return; }
    if (animais?.some((a) => !(Number(quantidades[a.id]) > 0))) { setErro("Confira a quantidade de cada animal. Nenhuma aplicação foi gravada."); return; }
    emCurso.current = true; setSalvando(true); setErro(null);
    try {
      const input: AplicacaoInput = { animalId, propriedadeId: sitioDoFato, tarefaId: tarefa?.id, data, aplicadaEm: new Date(`${data}T${hora}:00-03:00`).toISOString(), tipoAplicacaoId: tipoId, origemInsumo: origem,
        nomeProdutoAplicado: nome.trim(), dose, unidadeDose: unidade, responsavel: responsavel.trim() || undefined, via: via.trim() || undefined, ocorrenciaId: ocorrenciaId || undefined,
        produtoId: origem === "SEM_ORIGEM_JUSTIFICADA" ? undefined : produtoId || undefined,
        operacaoServicoId: servicoId || undefined, itemCompraDiretaId: origem === "COMPRA_CONSUMO_DIRETO" ? compraId : undefined,
        partidaId: origem === "BAIXA_ESTOQUE" ? partidaId || undefined : undefined,
        cienciaValidadeDesconhecida: origem === "BAIXA_ESTOQUE" ? cienciaValidadeDesconhecida : undefined,
        ...(origem === "BAIXA_ESTOQUE" && partidas.some((p) => p.id === partidaId && p.validade != null && p.validade.slice(0, 10) < data) ? { documentacaoExcepcional: cienciaVencida, motivoDocumentacaoExcepcional: motivoVencida || undefined } : {}),
        partidaCodigo: origem === "INCLUSO_SERVICO" ? partida.trim() || undefined : undefined, partidaValidade: origem === "INCLUSO_SERVICO" ? validade || undefined : undefined,
        justificativaSemOrigem: origem === "SEM_ORIGEM_JUSTIFICADA" ? justificativa.trim() : undefined,
        estadoCarenciaLeite: estadoLeite, estadoCarenciaCarne: estadoCarne,
        carenciaLeiteHoras: estadoLeite === "INFORMADO" ? Number(leite) : null, carenciaCarneHoras: estadoCarne === "INFORMADO" ? Number(carne) : null,
        justificativaCarenciaCarne: estadoCarne === "NAO_APLICAVEL" ? motivoCarne.trim() : undefined };
      if (animais?.length) await reqSanidade("/aplicacoes/coletivas", { method: "POST", body: JSON.stringify({ chave, propriedadeId, itens: animais.map((a) => ({ ...input, animalId: a.id, dose: quantidades[a.id] })) }) });
      else await reqSanidade("/aplicacoes/coletivas", { method: "POST", body: JSON.stringify({ chave, propriedadeId, itens: [input] }) });
      onSalvo();
    } catch (falha) { setErro(falha instanceof Error ? falha.message : String(falha)); }
    finally { emCurso.current = false; setSalvando(false); }
  }
  return <PainelCadastro aberto titulo={animais?.length ? "Aplicação sanitária coletiva" : "Registrar aplicação sanitária"} onFechar={() => { if (!salvando) onFechar(); }} rodape={<><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form="form-aplicacao-sanitaria" disabled={salvando || carregando}>{salvando ? "Salvando…" : animais?.length ? conferindo ? "Confirmar todas as aplicações" : "Conferir por animal" : "Registrar aplicação"}</Button></>}>
    <form id="form-aplicacao-sanitaria" onSubmit={submeter} className="grid gap-4">
      <ErrorBox erro={erro} />{carregando && <p>Carregando cadastros…</p>}
      <fieldset disabled={conferindo} className="grid gap-4">
      <CampoFormulario id="san-tipo" rotulo="Tipo de aplicação" obrigatorio>{(p) => <select {...p} required value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={classeInput}><option value="">Selecione</option>{tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>}</CampoFormulario>
      <CampoFormulario id="san-origem" rotulo="Origem do medicamento" obrigatorio>{(p) => <select {...p} value={origem} onChange={(e) => { setOrigem(e.target.value as typeof origem); setServicoId(""); setCompraId(""); setProdutoId(""); setNome(""); }} className={classeInput}><option value="BAIXA_ESTOQUE">Estoque da fazenda</option><option value="INCLUSO_SERVICO">Incluído em Serviço</option><option value="COMPRA_CONSUMO_DIRETO">Compra para consumo direto</option><option value="SEM_ORIGEM_JUSTIFICADA">Origem não localizada</option></select>}</CampoFormulario>
      {origem === "COMPRA_CONSUMO_DIRETO" && <CampoFormulario id="san-compra" rotulo="Item confirmado com quantidade disponível" obrigatorio>{(p) => <select {...p} required value={compraId} onChange={(e) => { setCompraId(e.target.value); const c = compras.find((v) => v.id === e.target.value); if (c) selecionarProduto(c.produtoId); }} className={classeInput}><option value="">Selecione</option>{compras.map((c) => <option key={c.id} value={c.id}>#{c.operacao.numero} · {c.produto.nome} · disponível {c.disponivel} {c.unidade}</option>)}</select>}</CampoFormulario>}
      {(origem === "BAIXA_ESTOQUE" || origem === "INCLUSO_SERVICO") && <CampoFormulario id="san-produto" rotulo={origem === "BAIXA_ESTOQUE" ? "Produto do estoque" : "Produto cadastrado (opcional)"} obrigatorio={origem === "BAIXA_ESTOQUE"}>{(p) => <select {...p} required={origem === "BAIXA_ESTOQUE"} value={produtoId} onChange={(e) => selecionarProduto(e.target.value)} className={classeInput}><option value="">Selecione</option>{produtos.map((v) => <option key={v.id} value={v.id}>{v.nome} · {v.unidade}</option>)}</select>}</CampoFormulario>}
      <CampoFormulario id="san-nome" rotulo="Medicamento utilizado" obrigatorio>{(p) => <input {...p} required readOnly={!!produtoId} maxLength={160} value={nome} onChange={(e) => setNome(e.target.value)} className={classeInput} />}</CampoFormulario>
      {origem !== "SEM_ORIGEM_JUSTIFICADA" && <CampoFormulario id="san-servico" rotulo={origem === "INCLUSO_SERVICO" ? "Serviço que incluiu o medicamento" : "Serviço de atendimento (opcional)"} obrigatorio={origem === "INCLUSO_SERVICO"}>{(p) => <select {...p} required={origem === "INCLUSO_SERVICO"} value={servicoId} onChange={(e) => setServicoId(e.target.value)} className={classeInput}><option value="">{origem === "INCLUSO_SERVICO" ? "Selecione" : "Sem Serviço — aplicação pela fazenda"}</option>{servicos.map((s) => <option key={s.id} value={s.id}>#{s.numero} · {s.descricao || s.parceiro?.nome || "Serviço"}</option>)}</select>}</CampoFormulario>}
      {origem === "SEM_ORIGEM_JUSTIFICADA" && <CampoFormulario id="san-justificativa" rotulo="Justificativa da origem não localizada" obrigatorio>{(p) => <textarea {...p} required maxLength={500} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} className={classeInput} />}</CampoFormulario>}
      {origem === "BAIXA_ESTOQUE" && produto?.rastrearPartidas && <><CampoFormulario id="san-lote" rotulo="Lote do Produto" obrigatorio>{(p) => <select {...p} required value={partidaId} onChange={(e) => { setPartidaId(e.target.value); setCienciaValidadeDesconhecida(false); }} className={classeInput}><option value="">Selecione — confira saldo e validade</option>{partidas.map((v) => <option key={v.id} value={v.id}>{v.nome || (v.origemRastreio === "LEGADO_NAO_IDENTIFICADO" ? "Estoque sem validade informada" : v.codigo)} · saldo {v.saldo} {produto.unidade} · validade {v.validade?.slice(0, 10) ?? "não informada"}</option>)}</select>}</CampoFormulario>{partidaSugerida && <p className="text-xs text-ink-3">Vencimento válido mais próximo na data do fato: {partidaSugerida.nome || partidaSugerida.codigo} · {partidaSugerida.validade?.slice(0, 10)}. Sugestão apenas: confirme o lote.</p>}</>}
      {origem === "BAIXA_ESTOQUE" && partidas.some((p) => p.id === partidaId && p.validade === null) && <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={cienciaValidadeDesconhecida} onChange={(e) => setCienciaValidadeDesconhecida(e.target.checked)} />Estou ciente de que a validade deste lote não foi informada.</label>}
      {origem === "BAIXA_ESTOQUE" && partidas.some((p) => p.id === partidaId && p.validade != null && p.validade.slice(0, 10) < data) && <section className="grid gap-2 rounded-lg border border-red-200 p-3"><p className="text-sm">Lote vencido na data informada: uso operacional bloqueado. Esta exceção documenta somente um fato já ocorrido; não autoriza uma nova aplicação.</p><label className="text-sm"><input type="checkbox" checked={cienciaVencida} onChange={(e) => setCienciaVencida(e.target.checked)} /> Confirmo que o fato já ocorreu e estou ciente do vencimento.</label><label>Justificativa da documentação excepcional<textarea required minLength={5} maxLength={500} value={motivoVencida} onChange={(e) => setMotivoVencida(e.target.value)} className={classeInput} /></label></section>}
      {origem === "INCLUSO_SERVICO" && <div className="grid gap-4 sm:grid-cols-2"><CampoFormulario id="san-codigo" rotulo="Lote do fabricante (opcional)">{(p) => <input {...p} value={partida} onChange={(e) => setPartida(e.target.value)} className={classeInput} />}</CampoFormulario><CampoFormulario id="san-validade" rotulo="Validade (opcional)">{(p) => <DatePicker {...p} value={validade} onChange={setValidade} />}</CampoFormulario></div>}
      <div className="grid gap-4 sm:grid-cols-2"><CampoFormulario id="san-dose" rotulo="Quantidade aplicada" obrigatorio>{(p) => <input {...p} required type="number" min="0.001" step="0.001" value={dose} onChange={(e) => setDose(e.target.value)} className={classeInput} />}</CampoFormulario><CampoFormulario id="san-unidade" rotulo="Unidade" obrigatorio>{(p) => <select {...p} value={unidade} onChange={(e) => setUnidade(e.target.value)} className={classeInput}>{unidadesCompativeis.map((u) => <option key={u} value={u}>{UNIDADES[u as UnidadeMedida].rotulo}</option>)}</select>}</CampoFormulario></div>
      <div className="grid gap-4 sm:grid-cols-2"><CampoFormulario id="san-via" rotulo="Via de aplicação (opcional)">{(p) => <input {...p} maxLength={80} value={via} onChange={(e) => setVia(e.target.value)} className={classeInput} />}</CampoFormulario></div>
      <div className="grid gap-4 sm:grid-cols-2"><CampoFormulario id="san-data" rotulo="Data" obrigatorio>{(p) => <DatePicker {...p} required max={ficha?.baixa?.data.slice(0, 10) ?? hoje()} value={data} onChange={setData} />}</CampoFormulario><CampoFormulario id="san-hora" rotulo="Hora" obrigatorio>{(p) => <input {...p} type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className={classeInput} />}</CampoFormulario></div>
      {ficha?.baixa && <p className="text-xs text-ink-3">Animal baixado: registre somente fato ocorrido até {ficha.baixa.data.slice(0, 10)}. O sítio será o da localização nessa data; o lançamento não reativa o animal.</p>}
      <CampoFormulario id="san-responsavel" rotulo="Responsável pela aplicação (opcional)">{(p) => <input {...p} maxLength={160} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={classeInput} />}</CampoFormulario>
      {!animais?.length && <CampoFormulario id="ap-ocorrencia" rotulo="Ocorrência associada (opcional)">{(p) => <select {...p} className={classeInput} value={ocorrenciaId} onChange={(e) => setOcorrenciaId(e.target.value)}><option value="">Sem ocorrência</option>{ocorrencias.map((o) => <option key={o.id} value={o.id}>{o.doenca.nome} · {o.inicio.slice(0, 10)}</option>)}</select>}</CampoFormulario>}
      <fieldset className="grid gap-4 rounded-lg border border-border p-3"><legend className="px-1 font-semibold">Carência</legend>{([{ destino: "Leite", estado: estadoLeite, setEstado: setEstadoLeite, prazo: leite, setPrazo: setLeite }, { destino: "Abate/carne", estado: estadoCarne, setEstado: setEstadoCarne, prazo: carne, setPrazo: setCarne }]).map((c, i) => <details key={c.destino} open={i !== 0 || leiteRelevante !== false}><summary className="mb-2 cursor-pointer text-sm font-medium">{c.destino}{i === 0 && leiteRelevante === false ? " · revisar aplicabilidade" : ""}</summary>{i === 0 && leiteRelevante === false && <p className="mb-2 text-xs text-ink-3">Na finalidade atual, leite pode não se aplicar. Confirme explicitamente no campo abaixo; nenhum prazo vazio será tratado como zero.</p>}<CampoFormulario id={`san-estado-${i}`} rotulo={c.destino}>{(p) => <select {...p} value={c.estado} onChange={(e) => c.setEstado(e.target.value as EstadoPrazo)} className={classeInput}><option value="NAO_INFORMADO">Não informado</option><option value="INFORMADO">Prazo informado</option><option value="NAO_APLICAVEL">Não se aplica — confirmado por mim</option></select>}</CampoFormulario>{c.estado === "INFORMADO" && <CampoFormulario id={`san-prazo-${i}`} rotulo="Prazo em horas" obrigatorio>{(p) => <input {...p} required type="number" min="0" step="1" value={c.prazo} onChange={(e) => c.setPrazo(e.target.value)} className={classeInput} />}</CampoFormulario>}</details>)}{estadoCarne === "NAO_APLICAVEL" && <CampoFormulario id="san-motivo-carne" rotulo="Justificativa de não aplicabilidade para abate/carne" obrigatorio>{(p) => <textarea {...p} required value={motivoCarne} onChange={(e) => setMotivoCarne(e.target.value)} className={classeInput} />}</CampoFormulario>}<p className="text-xs text-ink-3">Zero é um prazo confirmado. Não informado mantém a restrição desconhecida. O autor do lançamento será registrado na auditoria, separadamente do responsável.</p></fieldset>
      </fieldset>
      {conferindo && animais && <section className="grid gap-3"><h3 className="font-semibold">Revisão por animal</h3><p className="text-sm">Os dados acima serão usados para todos. Cada linha permite ajustar a quantidade. A confirmação é atômica; erro em uma linha impede o conjunto.</p>{animais.map((a) => <label key={a.id}>{a.brinco} · quantidade ({unidade})<input aria-label={`Quantidade aplicada em ${a.brinco}`} required type="number" min="0.001" step="0.001" className={classeInput} value={quantidades[a.id] ?? ""} onChange={(e) => { setQuantidades((q) => ({ ...q, [a.id]: e.target.value })); setChave(crypto.randomUUID()); }} /></label>)}<Button secondary onClick={() => setConferindo(false)}>Voltar aos dados comuns</Button></section>}
    </form>
  </PainelCadastro>;
}
