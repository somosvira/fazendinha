import { EditorRegrasAcompanhamentoModelo, type ConfiguracaoAcompanhamentoV2 } from "../reproducao/EditorRegrasAcompanhamentoModelo";
import { validarConfiguracaoAcompanhamento } from "../reproducao/acompanhamento-api";
import { ResumoCustoModelo } from "./ResumoCustoModelo";
import { executarComGuardaNavegacao, registrarGuardaNavegacao } from "../../../navegacaoGuardada";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ClipboardList, Copy, FilePlus, Info } from "lucide-react";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Button as BotaoIcone } from "../../../components/ui/button";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { PainelCadastro, classeInput } from "../../../financeiro/PainelCadastro";
import { navegarPara } from "../../../router";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { Paginacao } from "../ui";
import { reqV4 } from "../reproducao/api";
import { RebanhoApiError } from "../api";
import { etapaParaCadastro, type EtapaIatf } from "../reproducao/Iatf";
import { reqSanidade } from "../sanidade/api";
import { EditorModeloSanitario, nova, type Etapa } from "./EditorModeloSanitario";
import type { CargaAcoesCadastro } from "./BuilderEtapasProtocolo";
import { EditorModeloReprodutivo } from "./EditorModeloReprodutivo";
import { listarCadastrosProtocolos, obterCadastroProtocolo, type CadastroProtocoloMeta, type FinalidadeProtocoloCadastro } from "./cadastros-api";
import { momentoParaCadastro } from "./CamposMomentoAcao";
import { ListaRascunho } from "./ListaRascunho";
import { SelectBuscavel } from "../../../components/SelectBuscavel";
import { opcoesProtocolo } from "./opcoesProtocolo";
import "./protocolos.css";
import "./PaginaCadastroProtocolo.css";

type Tipo = CadastroProtocoloMeta["tipo"];
import { caminhoCadastroProtocolo } from "./rotas-cadastro";
import { Empty } from "@/financeiro/financeiro-ui";
import { EsqueletoFormulario, EsqueletoLista } from "../../../components/Esqueleto";
import { SelectCampo } from "@/financeiro/SelectCampo";
const novaReprodutiva = (): EtapaIatf => ({ chaveEdicao: crypto.randomUUID(), nome: "Aplicação de produto", tipo: "APLICACAO", intervalo: 0, unidade: "DIAS", momento: { nome: "D0", ordem: 1, modoAtendimento: "MANUAL" } });
const tipoTentativaDaFinalidade = (finalidade: string | null | undefined) => finalidade === "IATF" ? "IA" : finalidade === "TETF" ? "TE" : null;
function prazoDaFinalidade(configuracao: ConfiguracaoAcompanhamentoV2 | null | undefined, finalidade: FinalidadeProtocoloCadastro | "" | null | undefined) {
  const publico = tipoTentativaDaFinalidade(finalidade);
  const regra = configuracao?.regras.find(r => r.finalidade === "DIAGNOSTICO" && r.ocorrencia === 1 && r.publico === publico);
  return regra ? String(regra.intervalo) : "";
}
const finalidades: Record<FinalidadeProtocoloCadastro, string> = { SANITARIO: "Sanitário", IATF: "IATF", TETF: "TETF", PRE_SINCRONIZACAO: "Pré-sincronização / preparação" };

/** A rota fixa o domínio; a configuração não cria participantes, fatos ou consumo. */
export function PaginaCadastroProtocolo({ tipo, podeLancar }: { tipo: Tipo; podeLancar: boolean }) {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const editarId = params.get("editar");
  const raiz = caminhoCadastroProtocolo(tipo);
  const destino = new URL(params.get("retorno") ?? raiz, window.location.origin);
  const retorno = destino.origin === window.location.origin && destino.pathname === raiz ? destino.pathname + destino.search : raiz;
  const [identificacaoAberta, setIdentificacaoAberta] = useState(false);
  const identificacaoAnterior = useRef<(() => void) | null>(null);
  const [baseAberta, setBaseAberta] = useState(tipo === "REPRODUTIVO");
  const [origem, setOrigem] = useState<CadastroProtocoloMeta | null>(null);
  const [iniciado, setIniciado] = useState(tipo === "REPRODUTIVO" && !editarId && !params.get("base"));
  const [passo, setPasso] = useState<0 | 1 | 2>(0);
  const [prazoDg, setPrazoDg] = useState("");
  const [confirmarIncompatibilidade, setConfirmarIncompatibilidade] = useState(false);
  const identificacaoConfirmada = useRef<{ finalidade: FinalidadeProtocoloCadastro | ""; tentativa: "ETAPA" | "EXTERNA" | ""; diagnostico: "PROTOCOLO" | "EXTERNO" | ""; prazoDg: string } | null>(null);
  const [basePendente, setBasePendente] = useState<string | null>(null);
  const [origemEscolha, setOrigemEscolha] = useState<"zero" | "base">(params.get("base") || editarId ? "base" : "zero");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [finalidade, setFinalidade] = useState<FinalidadeProtocoloCadastro | "">(tipo === "SANITARIO" ? "SANITARIO" : "");
  const [modalidadeTentativa, setModalidadeTentativa] = useState<"ETAPA" | "EXTERNA" | "">("");
  const [modalidadeDiagnostico, setModalidadeDiagnostico] = useState<"PROTOCOLO" | "EXTERNO" | "">("");
  const [configuracaoAcompanhamento,setConfiguracaoAcompanhamento]=useState<ConfiguracaoAcompanhamentoV2|null>(null);
  const [regrasAbertas,setRegrasAbertas]=useState(false);
  const [sanitarias, setSanitarias] = useState<Etapa[]>([]);
  const cargaReprodutiva = useRef<CargaAcoesCadastro | null>(null);
  const [reprodutivas, setReprodutivas] = useState<EtapaIatf[]>([]);
  const [completo, setCompleto] = useState(false);
  const [indiceErro, setIndiceErro] = useState<number | null>(null);
  const [erroCampo, setErroCampo] = useState<{ indice: number; campo: string; mensagem: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState<{ itens: CadastroProtocoloMeta[]; total: number; pagina: number } | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [confirmar, setConfirmar] = useState<"origem" | "sair" | null>(null);
  const geracao = useRef(0);
  const trava = useRef(false);
  const liberarSaida = useRef(false);
  const resolverSaida = useRef<((permitir: boolean) => void) | null>(null);
  const vivo = useRef(true);
  const erroRef = useRef<HTMLDivElement>(null);
  const legadoEditavel = !!editarId && !!origem && !origem.finalidade;
  const contratoNovo = !legadoEditavel || !!finalidade;
  const versao = origem ? editarId ? origem.versao : origem.proximaVersao : 1;
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; geracao.current++; }; }, []);
  useEffect(() => {
    if (!podeLancar || (iniciado && tipo !== "REPRODUTIVO") || !baseAberta) return;
    let ativo = true;
    setCarregandoLista(true); setErroLista(null); setLista(null);
    listarCadastrosProtocolos(tipo, pagina, busca).then(p => { if (ativo) setLista(p); })
      .catch(e => { if (ativo) setErroLista(e instanceof Error ? e.message : "Não foi possível carregar os protocolos-base."); })
      .finally(() => { if (ativo) setCarregandoLista(false); });
    return () => { ativo = false; };
  }, [tipo, pagina, busca, baseAberta, iniciado, podeLancar, revisao]);
  useEffect(() => {
    if (!iniciado) return;
    const removerGuarda = registrarGuardaNavegacao((intencao) => {
      if (liberarSaida.current) return Promise.resolve(true);
      if (trava.current) return Promise.resolve(false);
      if (tipo === "REPRODUTIVO" && intencao === "troca-sitio") return Promise.resolve(true);
      return new Promise<boolean>(resolve => { resolverSaida.current = resolve; setConfirmar("sair"); });
    });
    const proteger = (e: BeforeUnloadEvent) => { if (!liberarSaida.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", proteger);
    return () => { removerGuarda(); resolverSaida.current?.(false); resolverSaida.current = null; window.removeEventListener("beforeunload", proteger); };
  }, [iniciado]);
  useEffect(() => { if (erro) erroRef.current?.focus(); }, [erro]);

  async function usarBase(id: string) {
    const pedido = ++geracao.current;
    setCarregando(true); setErro(null);
    try {
      const meta = await obterCadastroProtocolo(id);
      if (!vivo.current || geracao.current !== pedido) return;
      if (meta.tipo !== tipo) throw new Error("Este protocolo pertence a outro cadastro. Escolha uma base desta área.");
      if (editarId && (meta.publicado || meta.publicadoEm || meta.utilizada || !meta.ativo)) throw new Error("Esta versão não pode ser editada. Abra uma nova versão a partir do cadastro.");
      if (!editarId && !meta.proximaVersao) throw new Error("Não foi possível determinar a próxima versão. Recarregue o protocolo-base.");
      setOrigemEscolha("base"); setOrigem(meta); setConfiguracaoAcompanhamento(meta.configuracaoAcompanhamento??null); setRegrasAbertas(!!meta.configuracaoAcompanhamento); setNome(meta.nome); setDescricao(meta.descricao ?? "");
      setFinalidade(editarId && !meta.finalidade ? "" : tipo === "SANITARIO" ? "SANITARIO" : meta.finalidade ?? "");
      setModalidadeTentativa(meta.modalidadeTentativa ?? ""); setModalidadeDiagnostico(meta.modalidadeDiagnostico ?? "");
      const prazo = prazoDaFinalidade(meta.configuracaoAcompanhamento, meta.finalidade);
      identificacaoConfirmada.current = { finalidade: meta.finalidade ?? "", tentativa: meta.modalidadeTentativa ?? "", diagnostico: meta.modalidadeDiagnostico ?? "", prazoDg: prazo };
      setPrazoDg(prazo);
      cargaReprodutiva.current = null;
      setSanitarias([]); setReprodutivas([]); setCompleto(false); setIndiceErro(null); setIniciado(true);
    } catch (e) { if (vivo.current && geracao.current === pedido) setErro(e instanceof Error ? e.message : "Não foi possível carregar a base."); }
    finally { if (vivo.current && geracao.current === pedido) setCarregando(false); }
  }
  useEffect(() => {
    const id = editarId ?? params.get("base");
    if (id && podeLancar) void usarBase(id);
    // A sessão do editor é identificada pela rota e remontada ao navegar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function comecar() {
    identificacaoConfirmada.current = null;
    setOrigemEscolha("zero"); setOrigem(null); setConfiguracaoAcompanhamento(null); setRegrasAbertas(false); setIniciado(true); setNome(""); setDescricao(""); setErro(null); setIndiceErro(null); setCompleto(true);
    setFinalidade(tipo === "SANITARIO" ? "SANITARIO" : "");
    setModalidadeTentativa(""); setModalidadeDiagnostico("");
    setSanitarias(tipo === "SANITARIO" ? [nova()] : []);
    cargaReprodutiva.current = null;
    setReprodutivas([]); setPrazoDg(""); setPasso(0);
  }
  function falhar(indice: number, mensagem: string) {
    if (tipo === "REPRODUTIVO") setPasso(1);
    setIndiceErro(indice);
    setErro(`Procedimento ${indice + 1}: ${mensagem}`);
  }
  function avaliacaoSemExame(etapa: EtapaIatf) {
    return etapa.tipo === "AVALIACAO" && (contratoNovo ? !etapa.planoAvaliacao?.tipoExameId : !etapa.planoAvaliacao);
  }
  function configuracaoParaSalvar() {
    const publico = tipoTentativaDaFinalidade(finalidade);
    const dg = reprodutivas.find(etapa => etapa.referenciaPrazoDiagnostico && etapa.exameDgAlterado);
    const tipoExameId = dg?.planoAvaliacao?.tipoExameId;
    if (!configuracaoAcompanhamento || !tipoExameId) return configuracaoAcompanhamento;
    return {
      ...configuracaoAcompanhamento,
      regras: configuracaoAcompanhamento.regras.map(regra => {
        if (regra.finalidade !== "DIAGNOSTICO" || regra.publico !== publico || !regra.tipoExameId || regra.tipoExameId === tipoExameId) return regra;
        const { tipoExameVersao: _versaoAnterior, ...campos } = regra;
        return { ...campos, tipoExameId };
      }),
    };
  }
  async function salvar() {
    if (!podeLancar || trava.current || !completo || !iniciado || (tipo === "REPRODUTIVO" && passo !== 2)) return;
    setErro(null); setIndiceErro(null); setErroCampo(null);
    if (nome.trim().length < 2 || (!finalidade && !legadoEditavel)) { setErro("Informe o nome e a finalidade do protocolo."); return; }
    const configuracao = tipo === "REPRODUTIVO" ? configuracaoParaSalvar() : null;
    if(configuracao){const erroRegra=validarConfiguracaoAcompanhamento(configuracao);if(erroRegra){setErro(erroRegra);return;}}
    const itens = tipo === "SANITARIO" ? sanitarias : reprodutivas;
    if (!itens.length || itens.length > 100) { setErro("Configure de 1 a 100 procedimentos antes de salvar."); return; }
    const semNomeEtapa = itens.findIndex(e => e.momento && !e.momento.nome.trim());
    if (semNomeEtapa >= 0) return falhar(semNomeEtapa, "informe o nome da etapa.");
    if (tipo === "SANITARIO") {
      const indice = sanitarias.findIndex(e => !Number.isInteger(e.diaRelativo) || e.diaRelativo < 0 || contratoNovo && e.tipo === "MANEJO" || e.tipo === "APLICACAO" && (!e.produtoId || !(Number(e.dose) > 0) || !e.unidade || e.momento?.modoAtendimento === "AUTOMATIZADA" && !e.tipoAplicacaoId) || e.tipo === "EXAME" && (!e.tipoExameId || e.momento?.modoAtendimento === "AUTOMATIZADA"));
      if (indice >= 0) return falhar(indice, "confira intervalo, procedimento, produto/quantidade, modelo de exame e a classificação necessária ao modo automatizado.");
    } else {
      const indice = reprodutivas.findIndex(e => e.intervaloPendente || !e.nome.trim() || !Number.isFinite(e.intervalo) || e.intervalo < 0 || contratoNovo && e.tipo === "MANEJO" || e.tipo === "APLICACAO" && (!(e.planoAplicacao?.produtoId || e.planoAplicacao?.produtoCatalogoId) || !(Number(e.planoAplicacao?.dose) > 0)) || e.tipo === "EXAME" && !e.planoExame?.tipoExameId || avaliacaoSemExame(e) || e.momento?.modoAtendimento === "AUTOMATIZADA" && ["TENTATIVA", "EXAME", "AVALIACAO"].includes(e.tipo));
      if (indice >= 0) return falhar(indice, "confira nome, intervalo, produto/quantidade e modelo de exame; exames e tentativas exigem modo manual.");
      const exigida = finalidade === "IATF" ? "IA" : finalidade === "TETF" ? "TE" : null;
      if (exigida && modalidadeTentativa !== "EXTERNA" && !reprodutivas.some(e => e.tipo === "TENTATIVA" && (e.tentativaTipo ?? e.planoTentativa?.tipo) === exigida)) { setErro(`Finalidade ${finalidade} exige ao menos uma ação ${exigida} antes de salvar.`); return; }
    }
    if (tipo === "REPRODUTIVO" && ["IATF", "TETF"].includes(finalidade)) {
      if ((!editarId || origem?.modalidadeTentativa != null) && (!modalidadeTentativa || !modalidadeDiagnostico) || !!modalidadeTentativa !== !!modalidadeDiagnostico) { setErro("Escolha como acompanhar a tentativa e o diagnóstico de gestação."); return; }
      if (modalidadeTentativa === "EXTERNA" && reprodutivas.some(e => e.tipo === "TENTATIVA")) { setErro("A tentativa será acompanhada separadamente. Remova a ação de IA ou TE das etapas, ou escolha realizá-la no protocolo."); return; }
      const possuiDiagnostico = reprodutivas.some(e => e.tipo === "AVALIACAO" && e.planoAvaliacao?.tipo === "DIAGNOSTICO");
      if (modalidadeDiagnostico === "PROTOCOLO" && !possuiDiagnostico) { setErro("Inclua uma avaliação de diagnóstico nas etapas ou escolha acompanhar o diagnóstico separadamente."); return; }
      if (modalidadeDiagnostico === "EXTERNO" && possuiDiagnostico) { setErro("O diagnóstico será acompanhado separadamente. Remova sua ação das etapas, ou escolha realizá-lo no protocolo."); return; }
    }
    trava.current = true; setSalvando(true);
    try {
      const comum = { nome: nome.trim(), descricao: descricao.trim() || null, ...(finalidade ? { finalidade } : {}), versao, publicado: true, ...(!editarId && origem ? { origemVersaoId: origem.id } : {}) };
      if (tipo === "SANITARIO") await reqSanidade(`/protocolos${editarId ? `/${encodeURIComponent(editarId)}` : ""}`, { method: editarId ? "PATCH" : "POST", body: JSON.stringify({ ...comum, etapas: sanitarias.map(e => ({ diaRelativo: e.diaRelativo, tipo: e.tipo, referenciasCusto: e.referenciasCusto, ...(e.momento ? { momento: momentoParaCadastro(e.momento) } : {}), ...(e.tipo === "APLICACAO" ? { subtipo: e.subtipo ?? "APLICACAO", produtoId: e.produtoId, ...(e.tipoAplicacaoId ? { tipoAplicacaoId: e.tipoAplicacaoId } : {}), dose: Number(e.dose), unidade: e.unidade } : e.tipo === "EXAME" ? { tipoExameId: e.tipoExameId } : {}) })) }) });
      else await reqV4("/reproducao/protocolos" + (editarId ? `/${encodeURIComponent(editarId)}` : ""), { ...comum, versao, configuracaoAcompanhamento: configuracao, ...(finalidade === "PRE_SINCRONIZACAO" ? { modalidadeTentativa: null, modalidadeDiagnostico: null } : tipoTentativaDaFinalidade(finalidade) && modalidadeTentativa && modalidadeDiagnostico ? { modalidadeTentativa, modalidadeDiagnostico } : {}), etapas: reprodutivas.map(e => { const item = etapaParaCadastro(e, contratoNovo); return !editarId && item.referenciasCusto ? { ...item, referenciasCusto: item.referenciasCusto.servico ? { servico: item.referenciasCusto.servico } : undefined } : item; }) }, editarId ? "PATCH" : "POST", getPropriedadeAtiva() ?? undefined);
      if (vivo.current) { liberarSaida.current = true; void executarComGuardaNavegacao(() => { setIniciado(false); navegarPara(retorno); }); }
    } catch (e) {
      if (vivo.current) {
        const campo = e instanceof RebanhoApiError ? /^etapas\.(\d+)\.planoAplicacao\.([^.]+)/.exec(e.campo ?? "") : null;
        const mensagem = e instanceof Error ? e.message : "Não foi possível salvar o protocolo.";
        if (campo) {
          const indice = Number(campo[1]);
          setErroCampo({ indice, campo: campo[2], mensagem });
          if (tipo === "REPRODUTIVO") setPasso(1);
          setIndiceErro(indice);
        } else setErro(mensagem);
      }
    }
    finally { trava.current = false; if (vivo.current) setSalvando(false); }
  }
  const sair = () => { if (!salvando) void executarComGuardaNavegacao(() => navegarPara(retorno)); };
  const total = tipo === "SANITARIO" ? sanitarias.length : reprodutivas.length;
  const acoes = tipo === "SANITARIO" ? sanitarias : reprodutivas;
  const etapasTotal = new Set(acoes.map((e, i) => e.momento ? `momento-${e.momento.ordem}` : `legado-${i}`)).size;
  const produtos = new Map<string, { id: string; nome?: string; quantidade: number; unidade: string }>();
  const materiais = tipo === "SANITARIO" ? sanitarias.filter(e => e.tipo === "APLICACAO").map(e => ({ id: e.produtoId, quantidade: Number(e.dose), unidade: e.unidade })) : reprodutivas.flatMap(e => e.tipo === "APLICACAO" && e.planoAplicacao ? [{ id: e.planoAplicacao.produtoId || e.planoAplicacao.produtoCatalogoId || "", nome: e.planoAplicacao.nomeProduto, quantidade: Number(e.planoAplicacao.dose), unidade: e.planoAplicacao.unidadeDose }] : []);
  for (const p of materiais) if (p.id) { const chave = `${p.id}:${p.unidade}`; const anterior = produtos.get(chave); produtos.set(chave, { ...p, quantidade: (anterior?.quantidade ?? 0) + (Number.isFinite(p.quantidade) ? p.quantidade : 0) }); }
  if (!podeLancar) return <p role="alert">Você não tem permissão para cadastrar protocolos.</p>;
  function abrirIdentificacao() {
    identificacaoAnterior.current = () => { setNome(nome); setDescricao(descricao); setFinalidade(finalidade); setModalidadeTentativa(modalidadeTentativa); setModalidadeDiagnostico(modalidadeDiagnostico); setConfiguracaoAcompanhamento(configuracaoAcompanhamento); setRegrasAbertas(regrasAbertas); };
    setIdentificacaoAberta(true);
  }
  function cancelarIdentificacao() { identificacaoAnterior.current?.(); identificacaoAnterior.current = null; setIdentificacaoAberta(false); }
  function isSanitario() { return tipo === "SANITARIO"; }
  function isReprodutivo() { return tipo === "REPRODUTIVO"; }
  if (isReprodutivo()) {
    const tentativa = tipoTentativaDaFinalidade(finalidade);
    const conflitos = legadoEditavel && !finalidade ? [] : reprodutivas.filter(e => e.tipo === "TENTATIVA" && (!tentativa || modalidadeTentativa !== "ETAPA" || (e.tentativaTipo ?? e.planoTentativa?.tipo) !== tentativa) || e.tipo === "AVALIACAO" && e.planoAvaliacao?.tipo === "DIAGNOSTICO" && (!tentativa || modalidadeDiagnostico !== "PROTOCOLO"));
    function avancarIdentificacao(confirmado = false) {
      setErro(null);
      if (origemEscolha === "base" && !origem) { setErro("Selecione o protocolo-base."); return; }
      if (nome.trim().length < 2 || (!finalidade && !legadoEditavel)) { setErro("Informe o nome e a finalidade do protocolo."); return; }
      if (tentativa && (!modalidadeTentativa || !modalidadeDiagnostico)) { setErro("Escolha como acompanhar a tentativa e o diagnóstico de gestação."); return; }
      if (!completo) { setErro("Aguarde o carregamento completo da versão-base."); return; }
      if (modalidadeDiagnostico === "PROTOCOLO" && tentativa && (prazoDg.trim() === "" || !Number.isInteger(Number(prazoDg)) || Number(prazoDg) < 0 || Number(prazoDg) > 1000)) { setErro("Informe o prazo do diagnóstico em dias inteiros entre 0 e 1000."); return; }
      if (conflitos.length && !confirmado) { setConfirmarIncompatibilidade(true); return; }
      const proximas = confirmado ? reprodutivas.filter(e => !conflitos.includes(e)) : [...reprodutivas];
      const faltam = Number(!!tentativa && modalidadeTentativa === "ETAPA" && !proximas.some(e => e.tipo === "TENTATIVA" && (e.tentativaTipo ?? e.planoTentativa?.tipo) === tentativa)) + Number(!!tentativa && modalidadeDiagnostico === "PROTOCOLO" && !proximas.some(e => e.tipo === "AVALIACAO" && e.planoAvaliacao?.tipo === "DIAGNOSTICO"));
      if (proximas.length + faltam > 100) { setErro("O modelo excederia o limite de 100 procedimentos. Remova procedimentos antes de avançar."); setConfirmarIncompatibilidade(false); return; }
      const adicionar = (e: Partial<EtapaIatf> & Pick<EtapaIatf, "nome" | "tipo">) => { const ordem = Math.max(0, ...proximas.map(item => item.momento?.ordem ?? 0)) + 1; proximas.push({ chaveEdicao: crypto.randomUUID(), intervalo: 0, unidade: "DIAS", ...e, momento: { nome: e.nome, ordem, modoAtendimento: "MANUAL", politicaExecucao: "CONFIRMACAO_OBRIGATORIA" } }); };
      if (tentativa && modalidadeTentativa === "ETAPA" && !proximas.some(e => e.tipo === "TENTATIVA" && (e.tentativaTipo ?? e.planoTentativa?.tipo) === tentativa)) adicionar({ nome: tentativa === "IA" ? "Inseminação" : "Transferência de embrião", tipo: "TENTATIVA", tentativaTipo: tentativa, intervaloPendente: true });
      if (tentativa && modalidadeDiagnostico === "PROTOCOLO") {
        let dg = proximas.find(e => e.tipo === "AVALIACAO" && e.planoAvaliacao?.tipo === "DIAGNOSTICO" && e.referenciaPrazoDiagnostico) ?? proximas.find(e => e.tipo === "AVALIACAO" && e.planoAvaliacao?.tipo === "DIAGNOSTICO");
        if (!dg) { adicionar({ nome: "Diagnóstico de gestação", tipo: "AVALIACAO", planoAvaliacao: { tipo: "DIAGNOSTICO" }, referenciaPrazoDiagnostico: true }); dg = proximas[proximas.length - 1]; }
        else { const i = proximas.indexOf(dg); proximas[i] = { ...dg, referenciaPrazoDiagnostico: true }; }
        setConfiguracaoAcompanhamento(atual => { const regras = [...(atual?.regras ?? [])]; const i = regras.findIndex(r => r.finalidade === "DIAGNOSTICO" && r.ocorrencia === 1 && r.publico === tentativa); if (i >= 0) regras[i] = { ...regras[i], intervalo: Number(prazoDg) }; else regras.push({ finalidade: "DIAGNOSTICO", ocorrencia: 1, publico: tentativa, referencia: tentativa, intervalo: Number(prazoDg), unidade: "DIAS", antecedencia: 0, tolerancia: 0, resolucao: "DIAGNOSTICO_CONCLUSIVO" }); return { versao: 2, efeito: "ALERTA", regras }; });
      }
      setReprodutivas(proximas); identificacaoConfirmada.current = { finalidade, tentativa: modalidadeTentativa, diagnostico: modalidadeDiagnostico, prazoDg }; setConfirmarIncompatibilidade(false); setPasso(1);
    }
    const podeRemover = (indices: number[]) => {
      if (tentativa && modalidadeDiagnostico === "PROTOCOLO" && indices.some(i => reprodutivas[i]?.referenciaPrazoDiagnostico)) return false;
      const restantes = reprodutivas.filter((_, i) => !indices.includes(i));
      return !(tentativa && modalidadeTentativa === "ETAPA" && !restantes.some(e => e.tipo === "TENTATIVA" && (e.tentativaTipo ?? e.planoTentativa?.tipo) === tentativa)
        || tentativa && modalidadeDiagnostico === "PROTOCOLO" && !restantes.some(e => e.tipo === "AVALIACAO" && e.planoAvaliacao?.tipo === "DIAGNOSTICO"));
    };
    return <div className="protocolos-pagina cadastro-protocolo-pagina cadastro-reprodutivo">
      <header className="cadastro-reprodutivo-cabecalho">
        <BotaoIcone type="button" variant="ghost" size="icon" className="shrink-0 text-primary" aria-label="Voltar para protocolos reprodutivos" disabled={salvando} onClick={sair}>
          <ArrowLeft aria-hidden />
        </BotaoIcone>
        <h1>{editarId ? "Editar protocolo" : origem ? "Nova versão de protocolo" : "Novo protocolo"}</h1>
      </header>
      <div className="cadastro-reprodutivo-moldura">
        <nav className="cadastro-passos" aria-label="Etapas do cadastro">{["Identificação", "Etapas", "Conferência"].map((nomePasso, i) => <button type="button" key={nomePasso} aria-current={passo === i ? "step" : undefined} disabled={i > passo} onClick={() => setPasso(i as 0 | 1 | 2)}><span>{i + 1}</span>{nomePasso}</button>)}</nav>
        <div className="cadastro-reprodutivo-corpo"><form id="cadastro-protocolo" noValidate onChangeCapture={() => { setIndiceErro(null); setErroCampo(null); }} onSubmit={e => { e.preventDefault(); void salvar(); }} className="cadastro-protocolo-editor">
          <div ref={erroRef} tabIndex={-1}><ErrorBox erro={erro} /></div>{carregando && <EsqueletoFormulario label="Carregando protocolo-base" />}
          {iniciado && <div hidden={passo !== 0}><section><h2>Identificação</h2><div className="cadastro-protocolo-identificacao">
            {!editarId && <fieldset className="cadastro-protocolo-nome cadastro-origem-opcoes"><legend>Origem do protocolo</legend><label><input type="radio" name="origem-protocolo" checked={origemEscolha === "zero"} onChange={() => { if (origem) setBasePendente(""); else setOrigemEscolha("zero"); }} />Começar do zero</label><label><input type="radio" name="origem-protocolo" checked={origemEscolha === "base"} onChange={() => setOrigemEscolha("base")} />Usar protocolo como base</label></fieldset>}
            {!editarId && origemEscolha === "base" && <label className="cadastro-protocolo-nome">Protocolo-base<select className={classeInput} value={origem?.id ?? ""} onChange={e => { const proxima = e.target.value; if (!proxima) return; if (nome || descricao || reprodutivas.length || origem) setBasePendente(proxima); else void usarBase(proxima); }}><option value="">Selecione o protocolo-base</option>{origem && !lista?.itens.some(p => p.id === origem.id) && <option value={origem.id}>{origem.nome} · v{origem.versao}</option>}{lista?.itens.map(p => <option key={p.id} value={p.id}>{p.nome} · v{p.versao}</option>)}</select></label>}
            {erroLista && <ErrorBox erro={erroLista} />}{lista && lista.total > 10 && <Paginacao paginaAtual={lista.pagina} totalPaginas={Math.ceil(lista.total / 10)} totalItens={lista.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="protocolos-base" idSelect="pagina-protocolos-base" />}
            <label className="cadastro-protocolo-nome">Nome do protocolo<input className={classeInput} value={nome} readOnly={!!origem && !editarId} onChange={e => setNome(e.target.value)} maxLength={120} /></label><label>Finalidade<SelectCampo value={finalidade} onValueChange={v => {
              const escolhida = v as FinalidadeProtocoloCadastro | "";
              if (escolhida !== finalidade) setPrazoDg(prazoDaFinalidade(configuracaoAcompanhamento, escolhida));
              setFinalidade(escolhida);
            }}><option value="">Selecione</option>{(["PRE_SINCRONIZACAO", "IATF", "TETF"] as const).map(f => <option key={f} value={f}>{finalidades[f]}</option>)}</SelectCampo></label><label>Versão<input className={classeInput} readOnly value={versao ?? "A confirmar"} /></label>
            {tentativa && <><label>Tentativa<SelectCampo value={modalidadeTentativa} onValueChange={v => setModalidadeTentativa(v as "ETAPA" | "EXTERNA")}><option value="">Selecione</option><option value="ETAPA">No protocolo</option><option value="EXTERNA">Acompanhar separadamente</option></SelectCampo></label><label>Diagnóstico de gestação<SelectCampo value={modalidadeDiagnostico} onValueChange={v => setModalidadeDiagnostico(v as "PROTOCOLO" | "EXTERNO")}><option value="">Selecione</option><option value="PROTOCOLO">No protocolo</option><option value="EXTERNO">Acompanhar separadamente</option></SelectCampo></label>{modalidadeDiagnostico === "PROTOCOLO" && <label>Dias após a tentativa<input className={classeInput} type="number" min="0" max="1000" step="1" value={prazoDg} onChange={e => setPrazoDg(e.target.value)} /></label>}</>}
            <label className="cadastro-protocolo-nome">Descrição (opcional)<textarea className={classeInput} value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={2000} /></label></div></section>{regrasAbertas ? <EditorRegrasAcompanhamentoModelo valor={configuracaoAcompanhamento} onChange={setConfiguracaoAcompanhamento} propriedadeId={getPropriedadeAtiva() ?? undefined} disabled={salvando} /> : <Button secondary type="button" onClick={() => setRegrasAbertas(true)}>Definir outras regras de acompanhamento</Button>}</div>}
          {passo === 2 && <section aria-labelledby="cadastro-conferencia">
            <header className="quadro-protocolo-cabecalho"><h2 id="cadastro-conferencia">Conferência</h2><Button secondary type="button" disabled={salvando} onClick={() => setPasso(1)}>Editar etapas</Button></header>
            <dl className="quadro-etapa-resumo cadastro-conferencia-resumo">
              <div><dt>Origem</dt><dd>{origem ? `${origem.nome} · v${origem.versao}` : "Começar do zero"}</dd></div>
              <div><dt>Finalidade</dt><dd>{finalidade ? finalidades[finalidade] : "Conforme a versão de origem"}</dd></div>
              {tentativa && <div><dt>Diagnóstico de gestação</dt><dd>{modalidadeDiagnostico === "PROTOCOLO" ? `${prazoDg} dias após a tentativa` : "Acompanhar separadamente"}</dd></div>}
            </dl>
          </section>}
          {iniciado && <div hidden={passo === 0 && completo}><section><EditorModeloReprodutivo origemCadastro={origem} cargaPersistida={cargaReprodutiva} etapas={reprodutivas} setEtapas={setReprodutivas} setAcoesCompletas={setCompleto} acoesCompletas={completo} indiceErroCadastro={indiceErro} erroCampo={erroCampo} sitioEfetivo={getPropriedadeAtiva()} contratoNovo={contratoNovo} podeRemover={podeRemover} prazoDg={prazoDg} somenteLeitura={passo === 2} tituloQuadro={passo === 2 ? "Procedimentos planejados" : "Etapas e procedimentos"} /></section></div>}
        </form><aside className="cadastro-protocolo-revisao"><div className="cadastro-protocolo-resumo"><h2>Resumo do protocolo</h2><h3>{nome || "Nome não informado"}</h3><p>Versão {versao ?? "a confirmar"} · {finalidade ? finalidades[finalidade] : "Finalidade não informada"}</p><p>{etapasTotal} etapas · {total} procedimentos{!completo ? " · carregamento incompleto" : ""}</p><h3>Produtos por animal</h3>{produtos.size ? [...produtos.values()].map(p => <div className="cadastro-protocolo-produto" key={`${p.id}:${p.unidade}`}>{p.nome ? <span>{p.nome}</span> : <SelectBuscavel somenteLeitura buscar={opcoesProtocolo({ opcao: "PRODUTO", origem: tipo })} rotulo="Produto previsto" valor={p.id} onChange={() => {}} />}<span>{p.quantidade.toLocaleString("pt-BR")} {p.unidade}</span></div>) : <p>Nenhum produto predefinido.</p>}{reprodutivas.some(e => e.tipo === "TENTATIVA") && <p>Material genético: a definir no atendimento.</p>}</div></aside></div>
        <footer className="cadastro-reprodutivo-rodape"><Button secondary type="button" onClick={() => passo ? setPasso((passo - 1) as 0 | 1) : sair()}>{passo ? "Voltar" : "Cancelar"}</Button>{passo === 0 ? <Button key="etapas" type="button" disabled={!iniciado || carregando} onClick={() => avancarIdentificacao()}>Ir para etapas</Button> : passo === 1 ? <Button key="conferencia" type="button" onClick={() => { if (!reprodutivas.length) { setErro("Adicione ao menos um procedimento antes da conferência."); return; } if (conflitos.length) { setErro(`Os procedimentos ${conflitos.map(e => e.nome).join(", ")} são incompatíveis com a identificação. Revise-os antes da conferência.`); return; } const i = reprodutivas.findIndex(e => e.intervaloPendente || avaliacaoSemExame(e) || e.tipo === "APLICACAO" && (!(e.planoAplicacao?.produtoId || e.planoAplicacao?.produtoCatalogoId) || !(Number(e.planoAplicacao?.dose) > 0))); if (i >= 0) { setErro(`Procedimento ${i + 1}: complete o dia, produto ou modelo de exame pendente.`); setIndiceErro(i); return; } setErro(null); setPasso(2); }}>Ir para conferência</Button> : <Button key="salvar" type="button" onClick={() => void salvar()} disabled={!completo || salvando || carregando}>{salvando ? "Salvando…" : "Salvar protocolo"}</Button>}</footer>
      </div><ConfirmDialog open={basePendente !== null} title="Trocar origem do protocolo?" message="As alterações do rascunho serão descartadas." confirmLabel="Trocar origem" onCancel={() => setBasePendente(null)} onConfirm={() => { const id = basePendente; setBasePendente(null); if (id) void usarBase(id); else comecar(); }} /><ConfirmDialog open={confirmarIncompatibilidade} title="Alterar procedimentos planejados?" message={`A mudança exige remover ${conflitos.map(e => e.nome).join(", ")}. Os demais procedimentos serão preservados.`} confirmLabel="Remover e continuar" onCancel={() => { const anterior = identificacaoConfirmada.current; if (anterior) { setFinalidade(anterior.finalidade); setModalidadeTentativa(anterior.tentativa); setModalidadeDiagnostico(anterior.diagnostico); setPrazoDg(anterior.prazoDg); } setConfirmarIncompatibilidade(false); }} onConfirm={() => avancarIdentificacao(true)} />
      <ConfirmDialog open={confirmar === "sair"} title="Sair sem salvar?" message="As alterações desta página serão descartadas." confirmLabel="Sair sem salvar" onCancel={() => { resolverSaida.current?.(false); resolverSaida.current = null; setConfirmar(null); }} onConfirm={() => { resolverSaida.current?.(true); resolverSaida.current = null; setConfirmar(null); }} />
    </div>;
  }
  return <div className={`protocolos-pagina protocolos-superficie cadastro-protocolo-pagina cadastro-protocolo-continuo ${isReprodutivo() && iniciado ? "cadastro-protocolo-quadro" : ""}`}>
    <form id="cadastro-protocolo" noValidate onChangeCapture={() => { setIndiceErro(null); setErroCampo(null); }} onSubmit={e => { e.preventDefault(); void salvar(); }} className="cadastro-protocolo-editor">
      <nav aria-label="Cadastro de protocolos" className="cadastro-protocolo-caminho"><button type="button" disabled={salvando} onClick={sair}><ArrowLeft size={16} aria-hidden />Protocolos {isSanitario() ? "sanitários" : "reprodutivos"}</button><span>/</span><span>{editarId ? "Editar protocolo" : origem ? "Nova versão" : "Novo protocolo"}</span></nav>
      <h1 className="flex items-center gap-3">{isSanitario() && <ClipboardList size={26} aria-hidden />}{editarId ? "Editar protocolo" : origem ? "Nova versão de protocolo" : "Novo protocolo"}</h1>
      <div ref={erroRef} tabIndex={-1}><ErrorBox erro={erro} /></div>
      {carregando && <EsqueletoFormulario label="Carregando protocolo-base" />}
      {!iniciado && !carregando && <section aria-labelledby="origem-protocolo">
        <h2 id="origem-protocolo">Como deseja começar?</h2>
        <div className="cadastro-protocolo-origens">
          <button type="button" onClick={comecar}>
            <FilePlus size={20} aria-hidden="true" />
            <span><strong>Começar do zero</strong><small>Definir etapas e procedimentos.</small></span>
          </button>
          <button type="button" aria-expanded={baseAberta} aria-controls="protocolos-base"
            onClick={() => setBaseAberta(aberta => !aberta)}>
            <Copy size={20} aria-hidden="true" />
            <span><strong>Usar protocolo como base</strong><small>Criar uma nova versão e adaptar.</small></span>
          </button>
        </div>
        <div id="protocolos-base" hidden={!baseAberta}>{baseAberta && <>
          <label>Buscar protocolo-base<input type="search" className={classeInput} value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} /></label><ErrorBox erro={erroLista} />{erroLista && <Button secondary type="button" onClick={() => setRevisao(v => v + 1)}>Tentar carregar bases novamente</Button>}{carregandoLista && <EsqueletoLista label="Carregando protocolos-base" />}{lista && <><div className="cadastro-protocolo-bases-rolagem" role="region" aria-label="Escolha de protocolo-base, com rolagem horizontal" tabIndex={0}><table className="consulta-tabela" aria-label="Protocolos-base"><thead><tr><th>Protocolo</th><th>Versão</th><th>Procedimentos</th><th><span className="sr-only">Escolher</span></th></tr></thead><tbody>{lista.itens.map(p => <tr key={p.id}><td>{p.nome}</td><td>v{p.versao}</td><td>{p.totalEtapas}</td><td><Button secondary type="button" aria-label={`Usar ${p.nome} v${p.versao} como base`} onClick={() => void usarBase(p.id)}>Usar como base</Button></td></tr>)}</tbody></table></div>{!lista.total && <Empty>Nenhum protocolo corresponde à busca. Você pode começar do zero.</Empty>}{lista.total > 10 && <Paginacao paginaAtual={lista.pagina} totalPaginas={Math.ceil(lista.total / 10)} totalItens={lista.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="protocolos-base" idSelect="pagina-protocolos-base" />}</>}</>}</div>
      </section>}
      {iniciado && <fieldset disabled={salvando} className="cadastro-protocolo-campos">
        {isReprodutivo() ? <><section className="quadro-identificacao"><header><h2><Info size={18} aria-hidden />Identificação</h2><Button secondary type="button" onClick={abrirIdentificacao}>Editar identificação</Button></header><dl><div><dt>Origem</dt><dd>{origem ? `${origem.nome} · v${origem.versao}` : "Novo protocolo"}</dd></div><div><dt>Nova versão</dt><dd>{nome || "Não informado"} · versão {versao ?? "a confirmar"}</dd></div><div><dt>Finalidade</dt><dd>{finalidade ? finalidades[finalidade] : "Não informada"}</dd></div><div><dt>Diagnóstico de gestação</dt><dd>{modalidadeDiagnostico === "EXTERNO" ? "Separado do protocolo" : modalidadeDiagnostico === "PROTOCOLO" ? "No protocolo" : "Não informado"}</dd></div></dl></section>{identificacaoAberta && <PainelCadastro aberto titulo="Editar identificação" rascunhoPersistido onFechar={cancelarIdentificacao} rodape={<><Button secondary type="button" onClick={cancelarIdentificacao}>Cancelar</Button><Button type="button" onClick={() => { identificacaoAnterior.current = null; setIdentificacaoAberta(false); }}>Concluir</Button></>}>        <section><div className="cadastro-protocolo-origem"><div><h2>Origem do protocolo</h2><p>{origem ? `${origem.nome} · v${origem.versao}` : "Protocolo iniciado do zero"}</p>{origem && <p className="text-sm">{editarId ? "A gravação conclui o cadastro desta versão ainda não utilizada." : "As versões anteriores e seus atendimentos permanecem preservados."}</p>}</div>{!editarId && <Button secondary type="button" onClick={() => setConfirmar("origem")}>Trocar origem</Button>}</div></section>
        <section><h2>Identificação</h2><div className="cadastro-protocolo-identificacao"><label className="cadastro-protocolo-nome">Nome do protocolo<input className={classeInput} required minLength={2} maxLength={isSanitario() ? 160 : 120} readOnly={!!origem && !editarId} value={nome} onChange={e => setNome(e.target.value)} /></label>{isReprodutivo() && <label>Finalidade da versão<SelectCampo className={classeInput} required={!legadoEditavel} value={finalidade} onValueChange={(valor) => setFinalidade(valor as FinalidadeProtocoloCadastro)}><option value="">{legadoEditavel ? "Legado sem finalidade declarada" : "Selecione a finalidade"}</option>{(["PRE_SINCRONIZACAO", "IATF", "TETF"] as const).map(f => <option key={f} value={f}>{finalidades[f]}</option>)}</SelectCampo></label>}{isReprodutivo() && ["IATF", "TETF"].includes(finalidade) && <><label>Tentativa<SelectCampo value={modalidadeTentativa} onValueChange={v => setModalidadeTentativa(v as "ETAPA" | "EXTERNA")}><option value="">{editarId && origem && !origem.modalidadeTentativa ? "Manter configuração anterior" : "Selecione"}</option><option value="ETAPA">No protocolo</option><option value="EXTERNA">Acompanhar separadamente</option></SelectCampo></label><label>Diagnóstico de gestação<SelectCampo value={modalidadeDiagnostico} onValueChange={v => setModalidadeDiagnostico(v as "PROTOCOLO" | "EXTERNO")}><option value="">{editarId && origem && !origem.modalidadeTentativa ? "Manter configuração anterior" : "Selecione"}</option><option value="PROTOCOLO">No protocolo</option><option value="EXTERNO">Acompanhar separadamente</option></SelectCampo></label></>}<label>Versão<input className={classeInput} readOnly value={versao ?? "A confirmar"} /></label><label className="cadastro-protocolo-nome">Descrição (opcional)<textarea className={classeInput} maxLength={isSanitario() ? 500 : 2000} rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} /></label></div></section>
        {isReprodutivo()&&<section>{regrasAbertas?<EditorRegrasAcompanhamentoModelo valor={configuracaoAcompanhamento} onChange={setConfiguracaoAcompanhamento} propriedadeId={getPropriedadeAtiva()??undefined} disabled={salvando||carregando}/>:<><h2>Prazos de acompanhamento</h2><p>Sem regra própria deste modelo. Agendamentos individuais e regras do sítio continuam disponíveis; ausência de configuração não cria um prazo.</p><Button secondary type="button" onClick={()=>setRegrasAbertas(true)}>Definir regras do modelo</Button></>}</section>}
</PainelCadastro>}</> : <>        <section><div className="cadastro-protocolo-origem"><div><h2>Origem do protocolo</h2><p>{origem ? `${origem.nome} · v${origem.versao}` : "Protocolo iniciado do zero"}</p>{origem && <p className="text-sm">{editarId ? "A gravação conclui o cadastro desta versão ainda não utilizada." : "As versões anteriores e seus atendimentos permanecem preservados."}</p>}</div>{!editarId && <Button secondary type="button" onClick={() => setConfirmar("origem")}>Trocar origem</Button>}</div></section>
        <section><h2>Identificação</h2><div className="cadastro-protocolo-identificacao"><label className="cadastro-protocolo-nome">Nome do protocolo<input className={classeInput} required minLength={2} maxLength={isSanitario() ? 160 : 120} readOnly={!!origem && !editarId} value={nome} onChange={e => setNome(e.target.value)} /></label>{isReprodutivo() && <label>Finalidade da versão<SelectCampo className={classeInput} required={!legadoEditavel} value={finalidade} onValueChange={(valor) => setFinalidade(valor as FinalidadeProtocoloCadastro)}><option value="">{legadoEditavel ? "Legado sem finalidade declarada" : "Selecione a finalidade"}</option>{(["PRE_SINCRONIZACAO", "IATF", "TETF"] as const).map(f => <option key={f} value={f}>{finalidades[f]}</option>)}</SelectCampo></label>}{isReprodutivo() && ["IATF", "TETF"].includes(finalidade) && <><label>Tentativa<SelectCampo value={modalidadeTentativa} onValueChange={v => setModalidadeTentativa(v as "ETAPA" | "EXTERNA")}><option value="">{editarId && origem && !origem.modalidadeTentativa ? "Manter configuração anterior" : "Selecione"}</option><option value="ETAPA">No protocolo</option><option value="EXTERNA">Acompanhar separadamente</option></SelectCampo></label><label>Diagnóstico de gestação<SelectCampo value={modalidadeDiagnostico} onValueChange={v => setModalidadeDiagnostico(v as "PROTOCOLO" | "EXTERNO")}><option value="">{editarId && origem && !origem.modalidadeTentativa ? "Manter configuração anterior" : "Selecione"}</option><option value="PROTOCOLO">No protocolo</option><option value="EXTERNO">Acompanhar separadamente</option></SelectCampo></label></>}<label>Versão<input className={classeInput} readOnly value={versao ?? "A confirmar"} /></label><label className="cadastro-protocolo-nome">Descrição (opcional)<textarea className={classeInput} maxLength={isSanitario() ? 500 : 2000} rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} /></label></div></section>
        {isReprodutivo()&&<section>{regrasAbertas?<EditorRegrasAcompanhamentoModelo valor={configuracaoAcompanhamento} onChange={setConfiguracaoAcompanhamento} propriedadeId={getPropriedadeAtiva()??undefined} disabled={salvando||carregando}/>:<><h2>Prazos de acompanhamento</h2><p>Sem regra própria deste modelo. Agendamentos individuais e regras do sítio continuam disponíveis; ausência de configuração não cria um prazo.</p><Button secondary type="button" onClick={()=>setRegrasAbertas(true)}>Definir regras do modelo</Button></>}</section>}
</>}
      <section><h2>{isReprodutivo() ? "Quadro de procedimentos" : "Etapas e procedimentos"}</h2>{isSanitario() ? <EditorModeloSanitario origemCadastro={origem} etapas={sanitarias} setEtapas={setSanitarias} setAcoesCompletas={setCompleto} acoesCompletas={completo} indiceErroCadastro={indiceErro} /> : <EditorModeloReprodutivo origemCadastro={origem} etapas={reprodutivas} setEtapas={setReprodutivas} setAcoesCompletas={setCompleto} acoesCompletas={completo} indiceErroCadastro={indiceErro} erroCampo={erroCampo} sitioEfetivo={getPropriedadeAtiva()} contratoNovo={contratoNovo} />}</section>
      </fieldset>}
    </form>
    {isSanitario() && <aside className="cadastro-protocolo-revisao" aria-labelledby="revisao-protocolo"><div className="cadastro-protocolo-resumo"><h2 id="revisao-protocolo">Revisão do protocolo</h2>{!iniciado ? <p>Escolha uma base ou comece do zero para revisar a estrutura.</p> : <><h3>{nome || "Nome não informado"}</h3><p>{finalidade ? finalidades[finalidade] : "Finalidade não informada"} · versão {versao ?? "a confirmar"}</p><p>{etapasTotal} {etapasTotal === 1 ? "etapa" : "etapas"} · {total} {total === 1 ? "procedimento" : "procedimentos"}{!completo ? " · carregamento incompleto" : ""}</p>{origem && <><h3>Origem</h3><p>{origem.nome} · v{origem.versao}</p><p>Somente a configuração é copiada. Animais e atendimentos permanecem na versão de origem.</p></>}{isReprodutivo() && ["IATF", "TETF"].includes(finalidade) && <dl className="cadastro-protocolo-modalidades"><div><dt>Tentativa</dt><dd>{modalidadeTentativa === "EXTERNA" ? "Acompanhar separadamente" : modalidadeTentativa === "ETAPA" ? "No protocolo" : editarId ? "Conforme versão anterior" : "A definir"}</dd></div><div><dt>Diagnóstico</dt><dd>{modalidadeDiagnostico === "EXTERNO" ? "Acompanhar separadamente" : modalidadeDiagnostico === "PROTOCOLO" ? "No protocolo" : editarId ? "Conforme versão anterior" : "A definir"}</dd></div></dl>}{isReprodutivo()&&<ResumoCustoModelo etapas={reprodutivas} propriedadeId={getPropriedadeAtiva()} completo={completo&&iniciado}/>}<h3>Produtos previstos por animal</h3>{produtos.size ? <ListaRascunho itens={[...produtos.values()]} rotulo="produtos previstos" renderizar={p => <div className="cadastro-protocolo-produto" key={`${p.id}:${p.unidade}`}><SelectBuscavel somenteLeitura buscar={opcoesProtocolo({ opcao: "PRODUTO", origem: tipo })} rotulo="Produto previsto" valor={p.id} onChange={() => {}} /><span>{p.quantidade.toLocaleString("pt-BR")} {p.unidade}</span></div>} /> : <Empty>Nenhum produto predefinido.</Empty>}{reprodutivas.some(e => e.tipo === "TENTATIVA") && <p>O sêmen ou embrião será definido no atendimento individual ou coletivo.</p>}</>}</div></aside>}<footer className="cadastro-protocolo-acoes">{isReprodutivo() && iniciado && <ResumoCustoModelo etapas={reprodutivas} propriedadeId={getPropriedadeAtiva()} completo={completo}/>}{isSanitario() && <p>Salvar o modelo não inclui animais nem movimenta estoque.</p>}<Button type="submit" form="cadastro-protocolo" disabled={!iniciado || !completo || salvando || carregando || !versao}>{salvando ? "Salvando…" : "Salvar protocolo"}</Button>{isSanitario() && <Button secondary type="button" disabled={salvando} onClick={sair}>Cancelar</Button>}</footer>{isReprodutivo() && iniciado && <div id="manutencao-protocolo" className="quadro-manutencao" />}
    <ConfirmDialog open={!!confirmar} title={confirmar === "origem" ? "Trocar a origem do protocolo?" : "Sair sem salvar?"} message="As alterações desta página serão descartadas." confirmLabel={confirmar === "origem" ? "Escolher outra origem" : "Sair sem salvar"} onCancel={() => { resolverSaida.current?.(false); resolverSaida.current = null; setConfirmar(null); }} onConfirm={() => { if (confirmar === "sair") { resolverSaida.current?.(true); resolverSaida.current = null; } else { geracao.current++; identificacaoAnterior.current = null; setIdentificacaoAberta(false); setIniciado(false); setOrigem(null); setErro(null); setErroCampo(null); setIndiceErro(null); setSanitarias([]); setReprodutivas([]); } setConfirmar(null); }} />
  </div>;
}
