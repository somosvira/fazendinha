import { useEffect, useRef, useState } from "react";
import { Button, ErrorBox, hoje } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { buscarFichaAnimal, listarAnimais } from "../api";
import type { AnimalFicha, AnimalResumo } from "../types";
import { listarServicos, reqSanidade, SanidadeApiError, type ServicoSanitario } from "./api";
import type { Doenca, TipoExame } from "./CadastrosSanitarios";
import { dataSanitaria, nomeAnimalSanitario } from "./rotulos";

export type TipoFatoSanitario = "ocorrencia" | "exame" | "protocolo";
export function FormFatoSanitario({ tipo, animalInicial = "", fixo = false, cadastroInicial = "", tarefaId, onFechar, onSalvo }: {
  tipo: TipoFatoSanitario; animalInicial?: string; fixo?: boolean; cadastroInicial?: string; tarefaId?: string | null;
  onFechar: () => void; onSalvo: () => void;
}) {
  const [animalId, setAnimalId] = useState(animalInicial);
  const [busca, setBusca] = useState("");
  const [animais, setAnimais] = useState<AnimalResumo[]>([]);
  const [ficha, setFicha] = useState<AnimalFicha | null>(null);
  const [data, setData] = useState(hoje());
  const [cadastros, setCadastros] = useState<(Doenca | TipoExame)[]>([]);
  const [cadastroId, setCadastroId] = useState(cadastroInicial);
  const [servicos, setServicos] = useState<ServicoSanitario[]>([]);
  const [servicoId, setServicoId] = useState("");
  const [ocorrencias, setOcorrencias] = useState<{ id: string; doenca: { nome: string }; inicio: string }[]>([]);
  const [ocorrenciaId, setOcorrenciaId] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [resultado, setResultado] = useState("");
  const [texto, setTexto] = useState("");
  const [sobreposicao, setSobreposicao] = useState(false);
  const [ciencia, setCiencia] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [campoErro, setCampoErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const trava = useRef(false);
  const erroCampo = (nome: string) => campoErro === nome ? <ErrorBox erro={erro} /> : null;
  const invalido = (nome: string) => campoErro === nome || undefined;
  useEffect(() => { const campo = formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]'); campo?.focus(); campo?.scrollIntoView?.({ block: "center" }); }, [campoErro, erro]);
  const chave = useRef(crypto.randomUUID());
  const formato = cadastros.find((c) => c.id === cadastroId) as TipoExame | undefined;
  const local = ficha?.historicoLocalizacoes.find((l) => l.desde.slice(0, 10) <= data && (!l.ate || l.ate.slice(0, 10) > data || ficha.baixa?.data.slice(0, 10) === data && l.ate.slice(0, 10) === data));
  const sitio = local?.propriedade?.id;
  useEffect(() => { let vivo = true; listarAnimais({ pageSize: 100, busca }).then((v) => { if (vivo) setAnimais(v.itens); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [busca]);
  useEffect(() => { let vivo = true; setFicha(null); if (animalId) buscarFichaAnimal(animalId).then((v) => { if (vivo) setFicha(v); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [animalId]);
  useEffect(() => { let vivo = true; reqSanidade<(Doenca | TipoExame)[]>(tipo === "ocorrencia" ? "/doencas" : tipo === "exame" ? "/tipos-exame" : "/protocolos").then((v) => { if (vivo) setCadastros(v.filter((c) => c.ativo && (tipo !== "protocolo" || !!(c as Doenca & { publicadoEm?: string }).publicadoEm))); }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [tipo]);
  useEffect(() => {
    let vivo = true; setServicos([]); setServicoId(""); setOcorrencias([]); setOcorrenciaId("");
    if (sitio && animalId) Promise.all([listarServicos(sitio), reqSanidade<typeof ocorrencias>(`/ocorrencias?animalId=${encodeURIComponent(animalId)}&propriedadeId=${sitio}&situacao=VALIDO`)]).then(([s, o]) => { if (vivo) { setServicos(s); setOcorrencias(o); } }).catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [sitio, animalId]);
  useEffect(() => { setCiencia(false); setSobreposicao(false); chave.current = crypto.randomUUID(); }, [animalId, data, cadastroId]);
  useEffect(() => { chave.current = crypto.randomUUID(); }, [resultado, responsavel, texto, servicoId, ocorrenciaId, ciencia]);
  async function salvar() {
    if (trava.current) return;
    if (!sitio) { setErro("Confira o animal e a data: não há sítio histórico nesta data."); setCampoErro("data"); return; }
    trava.current = true; setOcupado(true); setErro(null); setCampoErro("");
    const base = { animalId, propriedadeId: sitio };
    const body = tipo === "ocorrencia" ? { ...base, doencaId: cadastroId, inicio: data, observacao: texto.trim() || null } : tipo === "exame" ? { ...base, tipoExameId: cadastroId, data, tarefaId, operacaoServicoId: servicoId || null, ocorrenciaId: ocorrenciaId || null, responsavel: responsavel.trim() || null, ...(resultado === "" ? {} : formato?.tipoResultado === "NUMERO" ? { resultadoNumero: Number(resultado) } : formato?.tipoResultado === "OPCAO" ? { resultadoOpcao: resultado } : { resultadoTexto: resultado }) } : { ...base, protocoloId: cadastroId, inicio: data, operacaoServicoId: servicoId || null, ocorrenciaId: ocorrenciaId || null, ...(ciencia ? { confirmarSobreposicao: true, justificativaSobreposicao: texto.trim() } : {}) };
    try { await reqSanidade(tipo === "ocorrencia" ? "/ocorrencias" : tipo === "exame" ? "/exames/coletivos" : "/execucoes/coletivas", { method: "POST", body: JSON.stringify(tipo === "ocorrencia" ? body : { chave: chave.current, propriedadeId: sitio, itens: [body] }) }); onSalvo(); }
    catch (e) { const mensagem = e instanceof Error ? e.message : String(e); setErro(mensagem); const recebido = e instanceof SanidadeApiError ? (e.campo ?? "").replace(/^itens\.\d+\./, "") : ""; setCampoErro(({ inicio: "data", doencaId: "cadastro", tipoExameId: "cadastro", protocoloId: "cadastro", operacaoServicoId: "servico", resultadoNumero: "resultado", resultadoTexto: "resultado", resultadoOpcao: "resultado", observacao: "texto", justificativaSobreposicao: "texto", motivo: "texto", confirmarSobreposicao: "ciencia", propriedadeId: "data" } as Record<string, string>)[recebido] ?? recebido); if (tipo === "protocolo" && /protocolo pendente|sobreposição/i.test(mensagem)) setSobreposicao(true); }
    finally { trava.current = false; setOcupado(false); }
  }
  const titulo = tipo === "ocorrencia" ? "Nova ocorrência" : tipo === "exame" ? "Registrar exame" : "Iniciar protocolo";
  return <PainelCadastro aberto titulo={titulo} onFechar={() => { if (!ocupado) onFechar(); }} rodape={<><ErrorBox erro={erro} /><Button secondary disabled={ocupado} onClick={onFechar}>Cancelar</Button><Button type="submit" form="novo-fato-sanitario" disabled={ocupado || !ficha}>Confirmar</Button></>}>
    <form ref={formulario} id="novo-fato-sanitario" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
      <CampoFormulario id="fato-data" rotulo="Data" obrigatorio erro={campoErro === "data" ? erro ?? undefined : undefined}>{(p) => <DatePicker {...p} required value={data} onChange={setData} />}</CampoFormulario>
      {fixo ? <p>Animal: {ficha ? nomeAnimalSanitario(ficha) : "Carregando animal…"}</p> : <><label>Buscar animal<input className={classeInput} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Brinco ou nome" /></label><label>Animal<select required className={classeInput} aria-label="Animal" aria-invalid={invalido("animalId")} value={animalId} onChange={(e) => setAnimalId(e.target.value)}><option value="">Selecione</option>{ficha && !animais.some((a) => a.id === ficha.id) && <option value={ficha.id}>{nomeAnimalSanitario(ficha)}</option>}{animais.map((a) => <option key={a.id} value={a.id}>{nomeAnimalSanitario(a)}</option>)}</select>{erroCampo("animalId")}</label></>}
      <p className="text-sm text-ink-3">Sítio na data: {local?.propriedade?.nome ?? "Não localizado"}</p>
      <label>{tipo === "ocorrencia" ? "Doença" : tipo === "exame" ? "Tipo de exame" : "Protocolo publicado"}<select required className={classeInput} aria-label={tipo === "ocorrencia" ? "Doença" : tipo === "exame" ? "Tipo de exame" : "Protocolo publicado"} aria-invalid={invalido("cadastro")} value={cadastroId} onChange={(e) => { setCadastroId(e.target.value); setResultado(""); }}><option value="">Selecione</option>{cadastros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>{erroCampo("cadastro")}</label>
      {tipo !== "ocorrencia" && <><label>Serviço associado (opcional)<select className={classeInput} aria-label="Serviço associado (opcional)" aria-invalid={invalido("servico")} value={servicoId} onChange={(e) => setServicoId(e.target.value)}><option value="">Sem Serviço</option>{servicos.map((s) => <option key={s.id} value={s.id}>#{s.numero} · {s.descricao ?? "Serviço"}</option>)}</select>{erroCampo("servico")}</label><label>Ocorrência associada (opcional)<select className={classeInput} aria-label="Ocorrência associada (opcional)" aria-invalid={invalido("ocorrenciaId")} value={ocorrenciaId} onChange={(e) => setOcorrenciaId(e.target.value)}><option value="">Sem ocorrência</option>{ocorrencias.map((o) => <option key={o.id} value={o.id}>{o.doenca.nome} · {dataSanitaria(o.inicio)}</option>)}</select>{erroCampo("ocorrenciaId")}</label></>}
      {tipo === "exame" && <><label>Responsável (opcional)<input className={classeInput} maxLength={160} aria-label="Responsável (opcional)" aria-invalid={invalido("responsavel")} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />{erroCampo("responsavel")}</label><label>Resultado (opcional){formato?.unidade ? ` · ${formato.unidade}` : ""}{formato?.tipoResultado === "OPCAO" ? <select className={classeInput} aria-label="Resultado (opcional)" aria-invalid={invalido("resultado")} value={resultado} onChange={(e) => setResultado(e.target.value)}><option value="">Aguardando resultado</option>{formato.opcoes?.map((o) => <option key={o}>{o}</option>)}</select> : <input type={formato?.tipoResultado === "NUMERO" ? "number" : "text"} step="any" className={classeInput} aria-label="Resultado (opcional)" aria-invalid={invalido("resultado")} value={resultado} onChange={(e) => setResultado(e.target.value)} />}{erroCampo("resultado")}</label></>}
      {(tipo === "ocorrencia" || sobreposicao) && <label>{sobreposicao ? "Motivo da sobreposição" : "Observação"}<textarea required={sobreposicao} minLength={sobreposicao ? 5 : undefined} maxLength={500} className={classeInput} aria-invalid={invalido("texto")} value={texto} onChange={(e) => setTexto(e.target.value)} />{erroCampo("texto")}</label>}
      {sobreposicao && <ConfirmacaoCiencia id="nova-sobreposicao" checked={ciencia} onChange={setCiencia} obrigatorio>Confirmo iniciar outro protocolo com tarefas pendentes.</ConfirmacaoCiencia>}
      {erroCampo("ciencia")}
    </form>
  </PainelCadastro>;
}
