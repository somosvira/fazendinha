import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button, hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { listarComprasDiretas, listarServicos, listarTiposAplicacao, reqSanidade, type AplicacaoInput, type CompraDireta, type EstadoPrazo, type ServicoSanitario, type TipoAplicacao } from "./api";
import { CircleAlert } from "lucide-react";
import { listarPartidasNutricionais, type PartidaNutricional } from "../nutricao/api";
import { buscarFichaAnimal } from "../api";
import type { AnimalFicha } from "../types";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { UNIDADES, UNIDADES_ORDENADAS, type UnidadeMedida } from "../../../lib/unidades";
import { ConferenciaExecucao, type PreviaExecucao } from "./PreviaExecucao";
import { AjusteIndividualAplicacao, type AjusteEtapaAplicacao } from "./AjusteIndividualAplicacao";
import { dataSanitaria, unidadeSanitaria } from "./rotulos";

export type TarefaAplicacao = { id: string; produtoId: string; tipoAplicacaoId: string; dose: string; unidade: string; previstaPara?: string; via?: string; protocoloNome?: string; protocoloVersao?: number; animalId?: string };
export function FormAplicacaoServico({ animalId, propriedadeId, onSalvo, onFechar, tarefa, tarefas, animais }: {
  animalId: string; propriedadeId: number; onSalvo: (id?: string, propriedadeIdFato?: number) => void; onFechar: () => void;
  tarefa?: TarefaAplicacao;
  tarefas?: TarefaAplicacao[];
  animais?: Array<{ id: string; brinco: string; propriedadeId: number | null }>;
}) {
  const [leiteRelevante, setLeiteRelevante] = useState<boolean | null>(null);
  const [ficha, setFicha] = useState<AnimalFicha | null>(null);
  useEffect(() => { let vivo = true; setFicha(null); setLeiteRelevante(null); if (animais?.length) return; buscarFichaAnimal(animalId).then((a) => { if (vivo) { setFicha(a); setLeiteRelevante(a.sexo === "F" && a.aptidao === "LEITE"); if (a.baixa) setData(a.baixa.data.slice(0, 10)); } }).catch(() => { if (vivo) setLeiteRelevante(null); }); return () => { vivo = false; }; }, [animalId, animais?.length]);
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [desvio, setDesvio] = useState(false);
  const [motivoDesvio, setMotivoDesvio] = useState("");
  const [previaExecucao, setPreviaExecucao] = useState<PreviaExecucao | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [ajustesEtapa, setAjustesEtapa] = useState<Record<string, Partial<AplicacaoInput> & { motivoDesvio?: string }>>({});
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
  useEffect(() => { setCienciaVencida(false); setMotivoVencida(""); }, [partidaId]);
  const [data, setData] = useState(tarefa?.previstaPara?.slice(0, 10) ?? hoje());
  const [hora, setHora] = useState("");
  useEffect(() => { setCienciaVencida(false); setMotivoVencida(""); setCienciaValidadeDesconhecida(false); }, [data, hora]);
  const [nome, setNome] = useState("");
  const [dose, setDose] = useState(tarefa?.dose ?? "");
  const [unidade, setUnidade] = useState(tarefa?.unidade ?? "ML");
  const [responsavel, setResponsavel] = useState("");
  const [via, setVia] = useState(tarefa?.via ?? "");
  const [ocorrenciaId, setOcorrenciaId] = useState("");
  const [ocorrencias, setOcorrencias] = useState<{ id: string; inicio: string; doenca: { nome: string } }[]>([]);
  useEffect(() => { let vivo = true; setOcorrencias([]); setOcorrenciaId(""); if (animais?.length) return; reqSanidade<{ id: string; inicio: string; doenca: { nome: string } }[]>(`/ocorrencias?animalId=${animalId}&situacao=VALIDO`).then((v) => { if (vivo) setOcorrencias(v); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [animalId, animais]);
  const [justificativa, setJustificativa] = useState("");
  const [estadoLeite, setEstadoLeite] = useState<EstadoPrazo>("NAO_INFORMADO");
  const [estadoCarne, setEstadoCarne] = useState<EstadoPrazo>("NAO_INFORMADO");
  const [leite, setLeite] = useState("");
  const [carne, setCarne] = useState("");
  const [motivoCarne, setMotivoCarne] = useState("");
  const [partida, setPartida] = useState("");
  const [validade, setValidade] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [errosCampos, setErrosCampos] = useState<Record<string, string>>({});
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const campo = formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!campo) return;
    let ancestral = campo.parentElement;
    while (ancestral) { if (ancestral instanceof HTMLDetailsElement) ancestral.open = true; ancestral = ancestral.parentElement; }
    campo.scrollIntoView?.({ block: "center", behavior: "smooth" });
    campo.focus();
  }, [errosCampos]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setChave(crypto.randomUUID()); setPreviaExecucao(null); }, [tipoId, origem, servicoId, produtoId, compraId, partidaId, data, hora, nome, dose, unidade, responsavel, via, ocorrenciaId, justificativa, estadoLeite, estadoCarne, leite, carne, motivoCarne, partida, validade, cienciaValidadeDesconhecida, cienciaVencida, motivoVencida, quantidades, motivoDesvio, desvio]);
  const emCurso = useRef(false);
  const localDoFato = ficha?.historicoLocalizacoes?.find((l) => l.propriedade && l.desde.slice(0, 10) <= data && (l.ate == null || l.ate.slice(0, 10) > data || (ficha.baixa?.data.slice(0, 10) === data && l.ate.slice(0, 10) === data)));
  const sitioDoFato = animais?.length ? propriedadeId : localDoFato?.propriedade?.id ?? propriedadeId;
  const produto = produtos.find((p) => p.id === produtoId);
  const nomeAplicado = origem === "COMPRA_CONSUMO_DIRETO" ? compras.find((c) => c.id === compraId)?.produto.nome ?? "" : produto?.nome ?? nome;
  const unidadesCompativeis = produto ? UNIDADES_ORDENADAS.filter((u) => UNIDADES[u].base === UNIDADES[produto.unidade].base) : UNIDADES_ORDENADAS;
  const partidaSugerida = partidas.filter((p) => Number(p.saldo) > 0 && p.validade && p.validade.slice(0, 10) >= data)
    .sort((a, b) => (a.validade ?? "").localeCompare(b.validade ?? ""))[0];
  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setServicos([]); setCompras([]); setServicoId(""); setCompraId("");
    Promise.all([listarServicos(sitioDoFato), listarTiposAplicacao(), listarProdutos({ ativo: true }), listarComprasDiretas(sitioDoFato)])
      .then(([s, t, p, c]) => { if (vivo) { setServicos(s); setTipos(t.filter((v) => v.ativo)); setProdutos(p); setCompras(c); setTipoId((id) => t.some((v) => v.id === id && v.ativo) ? id : ""); setProdutoId((id) => p.some((v) => v.id === id && v.usoSanitario) ? id : ""); } })
      .catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [sitioDoFato]);
  useEffect(() => {
    let vivo = true; setPartidas([]); setPartidaId(""); setCienciaValidadeDesconhecida(false);
    if (produto?.rastrearPartidas && origem === "BAIXA_ESTOQUE") listarPartidasNutricionais(produto.id, sitioDoFato).then((p) => { if (vivo) setPartidas(p); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [produto?.id, produto?.rastrearPartidas, origem, sitioDoFato]);
  function limparProduto() {
    setProdutoId(""); setNome(""); setVia(""); setLeite(""); setCarne(""); setUnidade("ML");
    setEstadoLeite("NAO_INFORMADO"); setEstadoCarne("NAO_INFORMADO"); setMotivoCarne("");
    setPartidaId(""); setPartida(""); setValidade(""); setCienciaValidadeDesconhecida(false); setCienciaVencida(false); setMotivoVencida("");
    if (tarefa && !desvio) { setProdutoId(tarefa.produtoId); setUnidade(tarefa.unidade); setVia(tarefa.via ?? ""); }
  }
  function selecionarProduto(id: string) { limparProduto(); setProdutoId(id); const p = produtos.find((v) => v.id === id); if (p) { setUnidade(p.unidade); setVia(p.perfilSanitario?.viaPadrao ?? ""); setLeite(p.perfilSanitario?.carenciaLeiteHoras?.toString() ?? ""); setCarne(p.perfilSanitario?.carenciaCarneHoras?.toString() ?? ""); setEstadoLeite(p.perfilSanitario?.carenciaLeiteHoras == null ? "NAO_INFORMADO" : "INFORMADO"); setEstadoCarne(p.perfilSanitario?.carenciaCarneHoras == null ? "NAO_INFORMADO" : "INFORMADO"); } }
  function erroDaApi(falha: unknown) {
    const mensagem = falha instanceof Error ? falha.message : String(falha);
    const campo = falha instanceof Error && "campo" in falha && typeof falha.campo === "string" ? falha.campo : "";
    const partes = /^itens\.(\d+)\.(.+)$/.exec(campo);
    const atributo = partes?.[2] ?? campo;
    const animal = partes && animais?.[Number(partes[1])];
    const ids: Record<string, string> = { tipoAplicacaoId: "san-tipo", origemInsumo: "san-origem", nomeProdutoAplicado: origem === "BAIXA_ESTOQUE" ? "san-produto" : origem === "COMPRA_CONSUMO_DIRETO" ? "san-compra" : produtoId ? "san-produto" : "san-nome", produtoId: origem === "COMPRA_CONSUMO_DIRETO" ? "san-compra" : "san-produto", operacaoServicoId: "san-servico", itemCompraDiretaId: "san-compra", partidaId: "san-lote", dose: animal ? `san-dose-${animal.id}` : "san-dose", unidadeDose: "san-unidade", data: "san-data", aplicadaEm: "san-hora", propriedadeId: "san-data", animalId: animal ? `san-dose-${animal.id}` : "san-data", justificativaSemOrigem: "san-justificativa", cienciaValidadeDesconhecida: "san-ciencia", documentacaoExcepcional: "san-vencida", motivoDocumentacaoExcepcional: "san-motivo-vencida", carenciaLeiteHoras: "san-prazo-0", carenciaCarneHoras: "san-prazo-1", justificativaCarenciaCarne: "san-motivo-carne", ocorrenciaId: "ap-ocorrencia" };
    Object.assign(ids, { estadoCarenciaLeite: "san-estado-0", estadoCarenciaCarne: "san-estado-1", carenciaLeiteHoras: estadoLeite === "INFORMADO" ? "san-prazo-0" : "san-estado-0", carenciaCarneHoras: estadoCarne === "INFORMADO" ? "san-prazo-1" : "san-estado-1", partidaCodigo: "san-codigo", partidaValidade: "san-validade", responsavel: "san-responsavel", via: "san-via", tarefaId: "san-tipo" });
    const mensagemLocalizada = animal ? `${animal.brinco}: ${mensagem}` : mensagem;
    setErro(mensagemLocalizada);
    setErrosCampos(ids[atributo] ? { [ids[atributo]]: mensagemLocalizada } : {});
  }
  async function submeter(e: FormEvent) {
    e.preventDefault(); if (emCurso.current) return;
    if (carregando) { setErro("Aguarde a consulta dos cadastros antes de confirmar."); return; }
    const erros: Record<string, string> = {};
    if (!tipoId) erros["san-tipo"] = "Selecione o tipo de aplicação.";
    if (origem === "BAIXA_ESTOQUE" && !produtoId) erros["san-produto"] = "Selecione o medicamento do estoque.";
    if (origem === "COMPRA_CONSUMO_DIRETO" && !compraId) erros["san-compra"] = "Selecione o item da compra.";
    if ((origem === "SEM_ORIGEM_JUSTIFICADA" || origem === "INCLUSO_SERVICO" && !produtoId) && !nomeAplicado.trim()) erros["san-nome"] = "Informe o medicamento utilizado.";
    if (origem === "INCLUSO_SERVICO" && !servicoId) erros["san-servico"] = "Selecione o Serviço que incluiu o medicamento.";
    if (origem === "SEM_ORIGEM_JUSTIFICADA" && !justificativa.trim()) erros["san-justificativa"] = "Explique a origem não localizada.";
    if (origem === "BAIXA_ESTOQUE" && produto?.rastrearPartidas && !partidaId) erros["san-lote"] = "Selecione o lote do produto.";
    const lote = partidas.find((p) => p.id === partidaId);
    if (origem === "BAIXA_ESTOQUE" && lote?.validade === null && !cienciaValidadeDesconhecida) erros["san-ciencia"] = "Confirme a ciência da validade não informada.";
    if (origem === "BAIXA_ESTOQUE" && lote?.validade && lote.validade.slice(0, 10) < data) {
      if (!cienciaVencida) erros["san-vencida"] = "Confirme que o fato já ocorreu.";
      if (motivoVencida.trim().length < 5) erros["san-motivo-vencida"] = "Explique o fato ocorrido com pelo menos 5 caracteres.";
    }
    const quantidadeValida = (valor: string) => /^\d+(\.\d{1,3})?$/.test(valor) && Number.isFinite(Number(valor)) && Number(valor) > 0;
    if (!quantidadeValida(dose)) erros["san-dose"] = "Informe uma quantidade maior que zero com até três casas decimais.";
    if (!data || data > hoje()) erros["san-data"] = "Informe uma data até hoje.";
    if (tarefa && desvio && (motivoDesvio.trim().length < 5 || motivoDesvio.trim().length > 500)) erros["san-desvio"] = "Explique o desvio com 5 a 500 caracteres.";
    if (!hora) erros["san-hora"] = "Informe a hora da aplicação.";
    if (ficha?.historicoLocalizacoes?.length && !localDoFato?.propriedade) erros["san-data"] = "Não há sítio comprovado nessa data. Confira o histórico de localização.";
    if (ficha?.baixa && data > ficha.baixa.data.slice(0, 10)) erros["san-data"] = "A aplicação histórica não pode ser posterior à baixa do animal.";
    [[estadoLeite, leite], [estadoCarne, carne]].forEach(([estado, prazo], i) => { if (estado === "INFORMADO" && (prazo === "" || !Number.isInteger(Number(prazo)) || Number(prazo) < 0)) erros[`san-prazo-${i}`] = "Informe horas inteiras. Zero é permitido; vazio não é zero."; });
    if (estadoCarne === "NAO_APLICAVEL" && !motivoCarne.trim()) erros["san-motivo-carne"] = "Justifique por que não se aplica ao abate/carne.";
    const animaisDeOutroSitio = animais?.filter((a) => a.propriedadeId !== propriedadeId);
    if (!tarefa && animaisDeOutroSitio?.length) erros["san-data"] = `${animaisDeOutroSitio.map((a) => a.brinco).join(", ")}: confira o sítio dos animais antes de confirmar o conjunto.`;
    if (conferindo) animais?.forEach((a) => { if (!quantidadeValida(quantidades[a.id] ?? "")) erros[`san-dose-${a.id}`] = `${a.brinco}: informe uma quantidade maior que zero com até três casas decimais.`; });
    setErrosCampos(erros);
    if (Object.keys(erros).length) { setErro("Confira os campos indicados antes de confirmar a aplicação."); return; }
    setErro(null);
    if (animais?.length && !conferindo) { setQuantidades((q) => Object.fromEntries(animais.map((a) => [a.id, q[a.id] ?? tarefas?.find((t) => t.animalId === a.id)?.dose ?? dose]))); setConferindo(true); setChave(crypto.randomUUID()); return; }
    emCurso.current = true; setSalvando(true);
    try {
      const input: AplicacaoInput = { animalId, propriedadeId: sitioDoFato, tarefaId: tarefa?.id, data, aplicadaEm: new Date(`${data}T${hora}:00-03:00`).toISOString(), tipoAplicacaoId: tipoId, origemInsumo: origem,
        nomeProdutoAplicado: nomeAplicado.trim(), dose, unidadeDose: unidade, responsavel: responsavel.trim() || undefined, via: via.trim() || undefined, ocorrenciaId: ocorrenciaId || undefined,
        produtoId: origem === "SEM_ORIGEM_JUSTIFICADA" && !tarefa ? undefined : produtoId || undefined,
        operacaoServicoId: servicoId || undefined, itemCompraDiretaId: origem === "COMPRA_CONSUMO_DIRETO" ? compraId : undefined,
        partidaId: origem === "BAIXA_ESTOQUE" ? partidaId || undefined : undefined,
        cienciaValidadeDesconhecida: origem === "BAIXA_ESTOQUE" ? cienciaValidadeDesconhecida : undefined,
        ...(origem === "BAIXA_ESTOQUE" && partidas.some((p) => p.id === partidaId && p.validade != null && p.validade.slice(0, 10) < data) ? { documentacaoExcepcional: cienciaVencida, motivoDocumentacaoExcepcional: motivoVencida || undefined } : {}),
        partidaCodigo: origem === "INCLUSO_SERVICO" ? partida.trim() || undefined : undefined, partidaValidade: origem === "INCLUSO_SERVICO" ? validade || undefined : undefined,
        justificativaSemOrigem: origem === "SEM_ORIGEM_JUSTIFICADA" ? justificativa.trim() : undefined,
        estadoCarenciaLeite: estadoLeite, estadoCarenciaCarne: estadoCarne,
        carenciaLeiteHoras: estadoLeite === "INFORMADO" ? Number(leite) : null, carenciaCarneHoras: estadoCarne === "INFORMADO" ? Number(carne) : null,
        justificativaCarenciaCarne: estadoCarne === "NAO_APLICAVEL" ? motivoCarne.trim() : undefined };
      const entradas = animais?.length ? animais.map((a) => {
        const t = tarefas?.find((t) => t.animalId === a.id);
        const { motivoDesvio: _motivo, ...ajuste } = ajustesEtapa[a.id] ?? {};
        return { ...input, ...(t && !desvio ? { data: t.previstaPara?.slice(0, 10) ?? input.data, aplicadaEm: new Date(`${t.previstaPara?.slice(0, 10) ?? input.data}T${hora}:00-03:00`).toISOString(), produtoId: t.produtoId, dose: t.dose, unidadeDose: t.unidade, via: t.via, tipoAplicacaoId: t.tipoAplicacaoId } : desvio ? ajuste : {}), animalId: a.id, tarefaId: t?.id ?? tarefa?.id, dose: desvio || !t ? quantidades[a.id] : t.dose };
      }) : [input];
      if (tarefa) {
        if (animais?.length) {
          const fichas = await Promise.all(entradas.map((i) => buscarFichaAnimal(i.animalId)));
          entradas.forEach((i, n) => { const f = fichas[n]; const l = f.historicoLocalizacoes?.find((l) => l.desde.slice(0, 10) <= i.data && (!l.ate || l.ate.slice(0, 10) > i.data || f.baixa?.data.slice(0, 10) === i.data && l.ate.slice(0, 10) === i.data)); if (!l?.propriedade) throw new Error(`${animais[n].brinco}: confira o sítio histórico na data realizada.`); i.propriedadeId = l.propriedade.id; });
        }
        const sitioExecucao = entradas[0].propriedadeId;
        if (entradas.some((i) => i.propriedadeId !== sitioExecucao)) throw new Error("As aplicações selecionadas precisam ocorrer no mesmo sítio nas datas realizadas.");
        const payload = { propriedadeId: sitioExecucao, itens: entradas.map((i) => ({ ...i, tipo: "APLICACAO", ...(desvio ? { desvio: { motivo: (ajustesEtapa[i.animalId]?.motivoDesvio || motivoDesvio).trim() } } : {}) })) };
        if (!previaExecucao) { setPreviaExecucao(await reqSanidade<PreviaExecucao>("/tarefas/execucao/previa", { method: "POST", body: JSON.stringify(payload) })); return; }
        if (previaExecucao.itens.some((i) => i.motivoObrigatorio && !i.motivo)) { setErro("Registre o motivo do desvio e confira uma nova prévia."); return; }
        await reqSanidade("/tarefas/execucao/confirmacao", { method: "POST", body: JSON.stringify({ ...payload, chave, fingerprint: previaExecucao.fingerprint }) });
        onSalvo(undefined, sitioExecucao); return;
      }
      const resultado = await reqSanidade<{ aplicacoes: string[] }>("/aplicacoes/coletivas", { method: "POST", body: JSON.stringify({ chave, propriedadeId: animais?.length ? propriedadeId : sitioDoFato, itens: entradas }) });
      onSalvo(resultado?.aplicacoes?.[0], sitioDoFato);
    } catch (falha) { erroDaApi(falha); }
    finally { emCurso.current = false; setSalvando(false); }
  }
  return <PainelCadastro aberto titulo={animais?.length ? "Aplicação sanitária coletiva" : "Registrar aplicação sanitária"} onFechar={() => { if (!salvando) onFechar(); }} rodape={<div className="grid w-full gap-2">{erro && <p role="alert" className="flex items-start gap-2 text-sm text-red-700"><CircleAlert size={16} className="shrink-0" aria-hidden />{erro}</p>}<div className="flex justify-end gap-2"><Button secondary onClick={onFechar} disabled={salvando}>Cancelar</Button><Button type="submit" form="form-aplicacao-sanitaria" disabled={salvando || carregando}>{salvando ? "Salvando…" : tarefa ? previaExecucao ? "Confirmar execução" : "Conferir execução" : animais?.length ? conferindo ? "Confirmar todas as aplicações" : "Conferir por animal" : "Registrar aplicação"}</Button></div></div>}>
    <form ref={formulario} noValidate id="form-aplicacao-sanitaria" onSubmit={submeter} onChange={() => { setChave(crypto.randomUUID()); setPreviaExecucao(null); }} className="grid gap-4">
      {carregando && <p>Carregando cadastros…</p>}
      {tarefa && <section className="grid gap-3 rounded-lg border border-border p-3"><strong>{tarefa.protocoloNome ?? "Protocolo"} · v{tarefa.protocoloVersao ?? "—"} · Aplicação</strong><p>Animal: {animais?.map((a) => a.brinco).join(", ") ?? ficha?.brinco ?? "Carregando animal…"}. Versão e natureza são fixas. Planejado: {tarefa.previstaPara ? dataSanitaria(tarefa.previstaPara) : "Data não registrada"} · {produto?.nome ?? "Produto planejado"} · {tarefa.dose} {unidadeSanitaria(tarefa.unidade)} · {tarefa.via ?? "Via não informada"}</p><Button secondary disabled={salvando} onClick={() => { setDesvio((v) => !v); setPreviaExecucao(null); if (desvio) { setData(tarefa.previstaPara?.slice(0, 10) ?? hoje()); setTipoId(tarefa.tipoAplicacaoId); setProdutoId(tarefa.produtoId); setDose(tarefa.dose); setUnidade(tarefa.unidade); setVia(tarefa.via ?? ""); setMotivoDesvio(""); setAjustesEtapa({}); } }}>{desvio ? "Voltar ao planejamento" : "Registrar desvio"}</Button>{desvio && <CampoFormulario id="san-desvio" erro={errosCampos["san-desvio"]} rotulo="Motivo do desvio" obrigatorio>{(p) => <textarea {...p} minLength={5} maxLength={500} className={classeInput} value={motivoDesvio} onChange={(e) => setMotivoDesvio(e.target.value)} />}</CampoFormulario>}</section>}
      <fieldset disabled={salvando} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2"><CampoFormulario id="san-data" erro={errosCampos["san-data"]} rotulo="Data" obrigatorio>{(p) => <DatePicker {...p} disabled={!!tarefa && !desvio} required max={ficha?.baixa?.data.slice(0, 10) ?? hoje()} value={data} onChange={setData} />}</CampoFormulario><CampoFormulario id="san-hora" erro={errosCampos["san-hora"]} rotulo="Hora" obrigatorio>{(p) => <input {...p} type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className={classeInput} />}</CampoFormulario></div>
      <CampoFormulario id="san-tipo" erro={errosCampos["san-tipo"]} rotulo="Tipo de aplicação" obrigatorio>{(p) => <select {...p} disabled={!!tarefa && !desvio} required value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={classeInput}><option value="">Selecione</option>{tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>}</CampoFormulario>
      <CampoFormulario id="san-origem" erro={errosCampos["san-origem"]} rotulo="Origem do medicamento" obrigatorio>{(p) => <select {...p} value={origem} onChange={(e) => { setOrigem(e.target.value as typeof origem); setServicoId(""); setCompraId(""); setJustificativa(""); limparProduto(); setErrosCampos({}); setErro(null); }} className={classeInput}><option value="BAIXA_ESTOQUE">Estoque da fazenda</option><option value="INCLUSO_SERVICO">Incluído em Serviço</option><option value="COMPRA_CONSUMO_DIRETO">Compra para consumo direto</option><option value="SEM_ORIGEM_JUSTIFICADA">Origem não localizada</option></select>}</CampoFormulario>
      {origem === "COMPRA_CONSUMO_DIRETO" && <CampoFormulario id="san-compra" erro={errosCampos["san-compra"]} rotulo="Item confirmado com quantidade disponível" obrigatorio>{(p) => <select {...p} required value={compraId} onChange={(e) => { setCompraId(e.target.value); const c = compras.find((v) => v.id === e.target.value); selecionarProduto(c?.produtoId ?? ""); const unidadeCompra = c && UNIDADES_ORDENADAS.find((u) => u === c.unidade.toUpperCase() || UNIDADES[u].rotulo.toLowerCase() === c.unidade.toLowerCase()); if (unidadeCompra) setUnidade(unidadeCompra); }} className={classeInput}><option value="">Selecione</option>{compras.map((c) => <option key={c.id} value={c.id}>#{c.operacao.numero} · {c.produto.nome} · disponível {c.disponivel} {c.unidade}</option>)}</select>}</CampoFormulario>}
      {(origem === "BAIXA_ESTOQUE" || origem === "INCLUSO_SERVICO") && <CampoFormulario id="san-produto" erro={errosCampos["san-produto"]} rotulo={origem === "BAIXA_ESTOQUE" ? "Medicamento do estoque" : "Produto cadastrado (opcional)"} obrigatorio={origem === "BAIXA_ESTOQUE"}>{(p) => <select {...p} disabled={!!tarefa && !desvio} required={origem === "BAIXA_ESTOQUE"} value={produtoId} onChange={(e) => selecionarProduto(e.target.value)} className={classeInput}><option value="">Selecione</option>{produtos.filter((v) => v.usoSanitario).map((v) => <option key={v.id} value={v.id}>{v.nome} · {v.unidade}</option>)}</select>}</CampoFormulario>}
      {(origem === "SEM_ORIGEM_JUSTIFICADA" || origem === "INCLUSO_SERVICO" && !produtoId) && <CampoFormulario id="san-nome" erro={errosCampos["san-nome"]} rotulo="Medicamento utilizado" obrigatorio>{(p) => <input {...p} required maxLength={160} value={nome} onChange={(e) => setNome(e.target.value)} className={classeInput} />}</CampoFormulario>}
      {origem !== "SEM_ORIGEM_JUSTIFICADA" && <CampoFormulario id="san-servico" erro={errosCampos["san-servico"]} rotulo={origem === "INCLUSO_SERVICO" ? "Serviço que incluiu o medicamento" : "Serviço de atendimento (opcional)"} obrigatorio={origem === "INCLUSO_SERVICO"}>{(p) => <select {...p} required={origem === "INCLUSO_SERVICO"} value={servicoId} onChange={(e) => setServicoId(e.target.value)} className={classeInput}><option value="">{origem === "INCLUSO_SERVICO" ? "Selecione" : "Sem Serviço — aplicação pela fazenda"}</option>{servicos.map((s) => <option key={s.id} value={s.id}>#{s.numero} · {s.descricao || s.parceiro?.nome || "Serviço"}</option>)}</select>}</CampoFormulario>}
      {origem === "SEM_ORIGEM_JUSTIFICADA" && <CampoFormulario id="san-justificativa" erro={errosCampos["san-justificativa"]} rotulo="Justificativa da origem não localizada" obrigatorio>{(p) => <textarea {...p} required maxLength={500} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} className={classeInput} />}</CampoFormulario>}
      {origem === "BAIXA_ESTOQUE" && produto?.rastrearPartidas && <><CampoFormulario id="san-lote" erro={errosCampos["san-lote"]} rotulo="Lote do Produto" obrigatorio>{(p) => <select {...p} required value={partidaId} onChange={(e) => { setPartidaId(e.target.value); setCienciaValidadeDesconhecida(false); }} className={classeInput}><option value="">Selecione — confira saldo e validade</option>{partidas.map((v) => <option key={v.id} value={v.id}>{v.nome || (v.origemRastreio === "LEGADO_NAO_IDENTIFICADO" ? "Estoque sem validade informada" : v.codigo)} · saldo {v.saldo} {produto.unidade} · validade {v.validade?.slice(0, 10) ?? "não informada"}</option>)}</select>}</CampoFormulario>{partidaSugerida && <p className="text-xs text-ink-3">Vencimento válido mais próximo na data do fato: {partidaSugerida.nome || partidaSugerida.codigo} · {partidaSugerida.validade?.slice(0, 10)}. Sugestão apenas: confirme o lote.</p>}</>}
      {origem === "BAIXA_ESTOQUE" && partidas.some((p) => p.id === partidaId && p.validade === null) && <ConfirmacaoCiencia id="san-ciencia" erro={errosCampos["san-ciencia"]} obrigatorio checked={cienciaValidadeDesconhecida} onChange={setCienciaValidadeDesconhecida}>Estou ciente de que a validade deste lote não foi informada.</ConfirmacaoCiencia>}
      {origem === "BAIXA_ESTOQUE" && partidas.some((p) => p.id === partidaId && p.validade != null && p.validade.slice(0, 10) < data) && <section className="grid gap-2 rounded-lg border border-red-200 p-3"><p className="text-sm">Lote vencido na data informada: uso operacional bloqueado. Esta exceção documenta somente um fato já ocorrido; não autoriza uma nova aplicação.</p><ConfirmacaoCiencia id="san-vencida" erro={errosCampos["san-vencida"]} obrigatorio checked={cienciaVencida} onChange={setCienciaVencida}>Confirmo que o fato já ocorreu e estou ciente do vencimento.</ConfirmacaoCiencia><CampoFormulario id="san-motivo-vencida" erro={errosCampos["san-motivo-vencida"]} rotulo="Justificativa da documentação excepcional" obrigatorio>{(p) => <textarea {...p} minLength={5} maxLength={500} value={motivoVencida} onChange={(e) => setMotivoVencida(e.target.value)} className={classeInput} />}</CampoFormulario></section>}
      {origem === "INCLUSO_SERVICO" && <div className="grid gap-4 sm:grid-cols-2"><CampoFormulario id="san-codigo" erro={errosCampos["san-codigo"]} rotulo="Lote do fabricante (opcional)">{(p) => <input {...p} value={partida} onChange={(e) => setPartida(e.target.value)} className={classeInput} />}</CampoFormulario><CampoFormulario id="san-validade" erro={errosCampos["san-validade"]} rotulo="Validade (opcional)">{(p) => <DatePicker {...p} value={validade} onChange={setValidade} />}</CampoFormulario></div>}
      <div className="grid gap-4 sm:grid-cols-2"><CampoFormulario id="san-dose" erro={errosCampos["san-dose"]} rotulo="Quantidade aplicada" obrigatorio>{(p) => <input {...p} disabled={!!tarefa && !desvio} required type="number" min="0.001" step="0.001" value={dose} onChange={(e) => setDose(e.target.value)} className={classeInput} />}</CampoFormulario><CampoFormulario id="san-unidade" erro={errosCampos["san-unidade"]} rotulo="Unidade" obrigatorio>{(p) => <select {...p} disabled={!!tarefa && !desvio} value={unidade} onChange={(e) => setUnidade(e.target.value)} className={classeInput}>{unidadesCompativeis.map((u) => <option key={u} value={u}>{UNIDADES[u as UnidadeMedida].rotulo}</option>)}</select>}</CampoFormulario></div>
      <div className="grid gap-4 sm:grid-cols-2"><CampoFormulario id="san-via" erro={errosCampos["san-via"]} rotulo="Via de aplicação (opcional)">{(p) => <input {...p} disabled={!!tarefa && !desvio} maxLength={80} value={via} onChange={(e) => setVia(e.target.value)} className={classeInput} />}</CampoFormulario></div>
      {ficha?.baixa && <p className="text-xs text-ink-3">Animal baixado: registre somente fato ocorrido até {ficha.baixa.data.slice(0, 10)}. O sítio será o da localização nessa data; o lançamento não reativa o animal.</p>}
      <CampoFormulario id="san-responsavel" erro={errosCampos["san-responsavel"]} rotulo="Responsável pela aplicação (opcional)">{(p) => <input {...p} maxLength={160} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={classeInput} />}</CampoFormulario>
      {!animais?.length && <CampoFormulario id="ap-ocorrencia" erro={errosCampos["ap-ocorrencia"]} rotulo="Ocorrência associada (opcional)">{(p) => <select {...p} className={classeInput} value={ocorrenciaId} onChange={(e) => setOcorrenciaId(e.target.value)}><option value="">Sem ocorrência</option>{ocorrencias.map((o) => <option key={o.id} value={o.id}>{o.doenca.nome} · {o.inicio.slice(0, 10)}</option>)}</select>}</CampoFormulario>}
      <fieldset className="grid gap-4 rounded-lg border border-border p-3"><legend className="px-1 font-semibold">Carência</legend>{([{ destino: "Leite", estado: estadoLeite, setEstado: setEstadoLeite, prazo: leite, setPrazo: setLeite }, { destino: "Abate/carne", estado: estadoCarne, setEstado: setEstadoCarne, prazo: carne, setPrazo: setCarne }]).map((c, i) => <details key={c.destino} open={i !== 0 || leiteRelevante !== false}><summary className="mb-2 cursor-pointer text-sm font-medium">{c.destino}{i === 0 && leiteRelevante === false ? " · revisar aplicabilidade" : ""}</summary>{i === 0 && leiteRelevante === false && <p className="mb-2 text-xs text-ink-3">Na finalidade atual, leite pode não se aplicar. Confirme explicitamente no campo abaixo; nenhum prazo vazio será tratado como zero.</p>}<CampoFormulario id={`san-estado-${i}`} erro={errosCampos[`san-estado-${i}`]} rotulo={c.destino}>{(p) => <select {...p} value={c.estado} onChange={(e) => c.setEstado(e.target.value as EstadoPrazo)} className={classeInput}><option value="NAO_INFORMADO">Não informado</option><option value="INFORMADO">Prazo informado</option><option value="NAO_APLICAVEL">Não se aplica — confirmado por mim</option></select>}</CampoFormulario>{c.estado === "INFORMADO" && <CampoFormulario id={`san-prazo-${i}`} erro={errosCampos[`san-prazo-${i}`]} rotulo="Prazo em horas" obrigatorio>{(p) => <input {...p} required type="number" min="0" step="1" value={c.prazo} onChange={(e) => c.setPrazo(e.target.value)} className={classeInput} />}</CampoFormulario>}</details>)}{estadoCarne === "NAO_APLICAVEL" && <CampoFormulario id="san-motivo-carne" erro={errosCampos["san-motivo-carne"]} rotulo="Justificativa de não aplicabilidade para abate/carne" obrigatorio>{(p) => <textarea {...p} required value={motivoCarne} onChange={(e) => setMotivoCarne(e.target.value)} className={classeInput} />}</CampoFormulario>}<p className="text-xs text-ink-3">Zero é um prazo confirmado. Não informado mantém a restrição desconhecida. O autor do lançamento será registrado na auditoria, separadamente do responsável.</p></fieldset>
      </fieldset>
      {previaExecucao && <ConferenciaExecucao previa={previaExecucao} animais={animais ?? [{ id: animalId, brinco: ficha?.brinco ?? animalId }]} />}
      {tarefa && desvio && conferindo && animais && animais.map((a) => <AjusteIndividualAplicacao key={a.id} brinco={a.brinco} ajuste={ajustesEtapa[a.id] ?? {}} comum={{ propriedadeId, data, hora, produtoId, tipoAplicacaoId: tipoId, unidadeDose: unidade, via, responsavel, partidaId, origemInsumo: origem, estadoCarenciaLeite: estadoLeite, estadoCarenciaCarne: estadoCarne, carenciaLeiteHoras: leite === "" ? null : Number(leite), carenciaCarneHoras: carne === "" ? null : Number(carne) }} produtos={produtos} tipos={tipos} onChange={(patch: AjusteEtapaAplicacao) => { setPreviaExecucao(null); setChave(crypto.randomUUID()); setAjustesEtapa((v) => ({ ...v, [a.id]: { ...v[a.id], ...patch } })); }} />)}
      {conferindo && animais && <section className="grid gap-3"><h3 className="font-semibold">Revisão por animal</h3><p className="text-sm">Os dados acima serão usados para todos e continuam disponíveis para correção. Cada linha permite ajustar a quantidade. A confirmação é atômica; erro em uma linha impede o conjunto.</p>{animais.map((a) => <CampoFormulario key={a.id} id={`san-dose-${a.id}`} erro={errosCampos[`san-dose-${a.id}`]} rotulo={`Quantidade aplicada em ${a.brinco}`} obrigatorio>{(p) => <input {...p} disabled={salvando || !!tarefa && !desvio} type="number" min="0.001" step="0.001" className={classeInput} value={quantidades[a.id] ?? ""} onChange={(e) => { setQuantidades((q) => ({ ...q, [a.id]: e.target.value })); }} />}</CampoFormulario>)}<Button secondary disabled={salvando} onClick={() => setConferindo(false)}>Voltar aos dados comuns</Button></section>}
    </form>
  </PainelCadastro>;
}
