import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  FileText,
  History,
  ImagePlus,
  Loader2,
  MapPin,
  MessageCircle,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  Send,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  consultarAssistente,
  ouvirRespostaAssistente,
  consultarAssistenteComVoz,
  confirmarPesagemAssistente,
  obterConfiguracaoAssistente,
  listarConversasAssistente,
  obterConversaAssistente,
  salvarConversaAssistente,
  type ConfiguracaoAssistente,
  type EntradaAssistente,
  type RespostaAssistente,
  type MensagemSalva,
  type VisaoAssistente,
} from "../api/assistente";
import { listarPropriedades, type PropriedadeDTO } from "../api/propriedades";
import { getToken } from "../lib/auth";
import { getPropriedadeAtiva } from "../propriedadeScope";
import { registrarGuardaNavegacao } from "../navegacaoGuardada";
import { ConfirmDialog } from "./ConfirmDialog";
import { navegarPara } from "../router";
import { prepararPrint } from "../lib/midia-assistente";
import { useAudioAssistente } from "./useAudioAssistente";
import { useConversaVoz } from "./useConversaVoz";
import { RespostaDados } from "./RespostaDados";
import { ConferenciaPesagem } from "./ConferenciaPesagem";
import "./assistente-consulta.css";

type Anexo = { nome: string; dataUrl: string; tipo: "imagem" | "pdf" };
type Mensagem = MensagemSalva & {
  anexo?: Anexo;
  entrada?: EntradaAssistente;
  cancelada?: boolean;
};
const mensagensPersistiveis = (mensagens: Mensagem[]): MensagemSalva[] =>
  mensagens.map(({ pergunta, resposta, erro }) => ({
    pergunta,
    ...(resposta
      ? {
          resposta: {
            modo: resposta.modo,
            resposta: resposta.resposta,
            ...(resposta.dados ? { dados: resposta.dados } : {}),
            fontes: resposta.fontes,
            consultadoEm: resposta.consultadoEm,
            escopo: resposta.escopo,
          },
        }
      : {}),
    ...(erro ? { erro } : {}),
  }));
const CONSULTAS: {
  visao: VisaoAssistente;
  titulo: string;
  pergunta: string;
}[] = [
  {
    visao: "resumo",
    titulo: "Resumo do mês",
    pergunta: "Como está o financeiro deste mês?",
  },
  {
    visao: "saldo",
    titulo: "Saldo atual",
    pergunta: "Qual é o saldo atual das contas?",
  },
  {
    visao: "pagar",
    titulo: "A pagar no mês",
    pergunta: "Quanto temos a pagar neste mês?",
  },
  {
    visao: "receber",
    titulo: "A receber no mês",
    pergunta: "Quanto temos a receber neste mês?",
  },
  {
    visao: "despesas_categoria",
    titulo: "Despesas por categoria",
    pergunta: "Quais são as despesas por categoria neste mês?",
  },
];
const acessoRevogado = (e: unknown) =>
  e instanceof Error && "status" in e && [401, 403].includes(Number(e.status));
export function AssistenteConsulta({
  onAbrirFonte, pagina = false, perguntaInicial, novaConversaVersao = 0, abrirHistoricoVersao = 0, ativo = true,
}: { onAbrirFonte?: (url: string, sitio: number | null) => void; pagina?: boolean; perguntaInicial?: string; novaConversaVersao?: number; abrirHistoricoVersao?: number; ativo?: boolean } = {}) {
  const [aberto, setAberto] = useState(pagina);
  const [modoVoz, setModoVoz] = useState(false);
  const [modo, setModo] = useState<"consultar" | "editar">("consultar");
  const [sitio, setSitio] = useState<number | null>(getPropriedadeAtiva);
  const [sitios, setSitios] = useState<PropriedadeDTO[]>([]);
  const [config, setConfig] = useState<ConfiguracaoAssistente | null>(null);
  const [carregandoConfig, setCarregandoConfig] = useState(false);
  const [erroConfig, setErroConfig] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState("");
  const [anexo, setAnexo] = useState<Anexo | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [historico, setHistorico] = useState<Array<{
    id: string;
    titulo: string;
    atualizadoEm: string;
  }> | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState<string | null>(null);
  const [copiada, setCopiada] = useState<number | null>(null);
  const conversaId = useRef<string>(crypto.randomUUID());
  const emCurso = useRef<AbortController | null>(null);
  const versao = useRef(0);
  const trava = useRef(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const [ouvindo, setOuvindo] = useState<number | null>(null);
  const configAnterior = useRef<string | null>(null);
  const snapshotsSalvos = useRef(new Map<string, string>());
  const revisoes = useRef(new Map<string, number>());
  const filaSalvar = useRef<Promise<void>>(Promise.resolve());
  const historicoRequest = useRef<AbortController | null>(null);
  const audio = useAudioAssistente(
    aberto && ativo && !!config?.conversaDisponivel,
    (texto) => {
      const pergunta = [input.trim(), texto].filter(Boolean).join("\n");
      if (pergunta.length > 2000) {
        setErro(
          "O texto com a transcrição ultrapassa 2.000 caracteres. Reduza a pergunta antes de transcrever novamente.",
        );
        return;
      }
      setInput(pergunta);
      inputRef.current?.focus();
    },
    setErro,
    sitio,
  );
  const voz = useConversaVoz(
    aberto && ativo && modoVoz && !!config?.conversaDisponivel && !carregandoConfig,
    async (texto, signal) => {
      if (mensagens.length >= 100) throw new Error("Esta conversa atingiu 100 mensagens. Inicie uma nova; o histórico foi preservado.");
      setMensagens((m) => [
        ...m.map((item) => ({ ...item, cancelada: true })),
        { pergunta: texto },
      ]);
      try {
        const resposta = await consultarAssistenteComVoz(
          {
            pergunta: texto,
            historico: mensagens
              .filter((m) => m.resposta)
              .map((m) => m.pergunta)
              .slice(-6),
            pagina: window.location.pathname,
            modo,
          },
          signal,
          sitio,
        );
        if (!signal.aborted)
          setMensagens((m) =>
            resposta.modo === "acesso_negado"
              ? []
              : m.map((item, i) =>
                  i === m.length - 1 ? { ...item, resposta } : item,
                ),
          );
        return resposta;
      } catch (e) {
        if (!signal.aborted) {
          if (acessoRevogado(e)) setMensagens([]);
          else
            setMensagens((ms) =>
              ms.map((item, i) =>
                i === ms.length - 1
                  ? {
                      ...item,
                      erro:
                        e instanceof Error
                          ? e.message
                          : "Não foi possível concluir.",
                    }
                  : item,
              ),
            );
          throw e;
        }
        throw e;
      }
    },
    setErro,
    sitio,
  );
  const bloqueado =
    ocupado || preparando || audio.ocupado || voz.ativa || ouvindo !== null;
  function cancelarPendentes() {
    player.current?.pause();
    player.current = null;
    setOuvindo(null);
    setMensagens((ms) =>
      ms.map((item) =>
        !item.resposta && !item.erro
          ? {
              ...item,
              erro: "Solicitação interrompida. Envie novamente para continuar.",
            }
          : item,
      ),
    );
    versao.current++;
    emCurso.current?.abort();
    historicoRequest.current?.abort();
    setCarregandoHistorico(false);
    voz.encerrar();
    audio.cancelar();
    trava.current = false;
    setOcupado(false);
    setPreparando(false);
    setArrastando(false);
  }
  function mudarModo(valor: "consultar" | "editar") {
    cancelarPendentes();
    setModo(valor);
    setMensagens((m) => m.map((item) => ({ ...item, cancelada: true })));
    setErro(null);
  }
  function trocarSitio(id: number | null) {
    cancelarPendentes();
    setSitio(id);
    setErroHistorico(null);
    setConfig(null);
    setModo("consultar");
    setMensagens([]);
    setInput("");
    setAnexo(null);
    setHistorico(null);
    setModoVoz(false);
    setErro(null);
    conversaId.current = crypto.randomUUID();
  }
  function novaConversa() {
    cancelarPendentes();
    conversaId.current = crypto.randomUUID();
    setModoVoz(false);
    setMensagens([]);
    setInput("");
    setAnexo(null);
    setErro(null);
    setHistorico(null);
    setErroHistorico(null);
    inputRef.current?.focus();
  }
  useEffect(
    () => () => {
      versao.current++;
      emCurso.current?.abort();
      historicoRequest.current?.abort();
      player.current?.pause();
    },
    [],
  );
  useEffect(() => {
    if (!aberto || !ativo) return;
    const controller = new AbortController();
    setCarregandoConfig(true);
    setErroConfig(null);
    obterConfiguracaoAssistente(controller.signal, sitio)
      .then((c) => {
        if (!controller.signal.aborted) {
          const assinatura = JSON.stringify(c);
          if (configAnterior.current && configAnterior.current !== assinatura) {
            setMensagens([]);
            setAnexo(null);
            setInput("");
            versao.current++;
          }
          configAnterior.current = assinatura;
          setConfig(c);
          if (!c.podeEditar) setModo("consultar");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setConfig(null);
          setMensagens([]);
          setErroConfig(
            e instanceof Error
              ? e.message
              : "Não foi possível abrir o assistente.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregandoConfig(false);
      });
    listarPropriedades()
      .then((lista) => {
        if (!controller.signal.aborted) setSitios(lista.filter((s) => s.ativo));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setErro(
            "Não foi possível carregar as fazendas. Reabra o assistente para tentar novamente.",
          );
      });
    return () => controller.abort();
  }, [aberto, ativo, sitio, revisao]);
  useEffect(() => {
    if (aberto) fimRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [aberto, mensagens, ocupado]);
  useEffect(() => {
    if (
      !config ||
      ocupado ||
      !mensagens.length ||
      mensagens.some((m) => !m.resposta && !m.erro)
    )
      return;
    const controller = new AbortController();
    const id = conversaId.current;
    const identidade = getToken();
    const contexto = config.contextoHistorico;
    const snapshot = mensagensPersistiveis(mensagens);
    const serializado = JSON.stringify(snapshot);
    if (snapshotsSalvos.current.get(id) === serializado) return;
    filaSalvar.current = filaSalvar.current
      .then(async () => {
        if (getToken() !== identidade) return;
        const r = await salvarConversaAssistente(
          id,
          snapshot,
          controller.signal,
          sitio,
          {
            versaoBase: revisoes.current.get(id) ?? 0,
            contextoHistorico: contexto,
          },
        );
        revisoes.current.set(id, r.revisao);
        snapshotsSalvos.current.set(id, serializado);
        if (conversaId.current === id) setErroHistorico(null);
      })
      .catch((e) => {
        if (conversaId.current === id)
          setErroHistorico(
            e instanceof Error
              ? `Não foi possível salvar: ${e.message}`
              : "Não foi possível salvar esta conversa. Suas mensagens continuam abertas.",
          );
      });
    // A fila conserva snapshots concluídos mesmo ao fechar, trocar sítio ou iniciar outra conversa.
  }, [config, mensagens, ocupado, sitio]);
  async function enviar(entrada: EntradaAssistente, pergunta: string) {
    if (mensagens.length >= 100) { setErro("Esta conversa atingiu 100 mensagens. Inicie uma nova; o histórico foi preservado."); return; }
    if (trava.current || bloqueado || !config || carregandoConfig) return;
    trava.current = true;
    setOcupado(true);
    setInput("");
    setAnexo(null);
    setErro(null);
    setHistorico(null);
    const controller = new AbortController();
    emCurso.current = controller;
    setMensagens((m) => [
      ...m.map((item) => ({ ...item, cancelada: true })),
      { pergunta, entrada, ...(anexo ? { anexo } : {}) },
    ]);
    try {
      const resposta = await consultarAssistente(
        entrada,
        controller.signal,
        sitio,
      );
      if (!controller.signal.aborted)
        setMensagens((m) =>
          resposta.modo === "acesso_negado"
            ? [{ pergunta, resposta }]
            : m.map((item, i) =>
                i === m.length - 1 ? { ...item, resposta } : item,
              ),
        );
    } catch (e) {
      if (!controller.signal.aborted) {
        if (acessoRevogado(e)) {
          setMensagens([]);
          setErro(e instanceof Error ? e.message : "Acesso revogado.");
        } else
          setMensagens((m) =>
            m.map((item, i) =>
              i === m.length - 1
                ? {
                    ...item,
                    erro:
                      e instanceof Error
                        ? e.message
                        : "Não foi possível concluir.",
                  }
                : item,
            ),
          );
      }
    } finally {
      if (!controller.signal.aborted) {
        trava.current = false;
        setOcupado(false);
      }
    }
  }
  function enviarPergunta() {
    const pergunta =
      input.trim() ||
      (anexo ? "Explique este documento ou tela no contexto do Terrano." : "");
    if (!pergunta || !config?.conversaDisponivel) return;
    void enviar(
      {
        pergunta,
        historico: mensagens
          .filter((m) => m.resposta)
          .map((m) => m.pergunta)
          .slice(-6),
        pagina: window.location.pathname,
        modo,
        ...(anexo?.tipo === "imagem" ? { imagem: anexo.dataUrl } : {}),
        ...(anexo?.tipo === "pdf"
          ? { documento: { nome: anexo.nome, dataUrl: anexo.dataUrl } }
          : {}),
      },
      pergunta,
    );
  }
  async function anexar(arquivo: File) {
    if (bloqueado || !config?.conversaDisponivel || carregandoConfig) return;
    if (
      arquivo.type.startsWith("audio/") ||
      /\.(m4a|mp3|wav|webm)$/i.test(arquivo.name)
    ) {
      void audio.enviarArquivo(arquivo);
      return;
    }
    const token = ++versao.current;
    setPreparando(true);
    setErro(null);
    try {
      let dataUrl: string;
      let tipo: Anexo["tipo"] = "imagem";
      if (arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name)) {
        if (arquivo.size > 2 * 1024 * 1024)
          throw new Error("Envie um PDF de até 2 MiB.");
        if (
          !new TextDecoder()
            .decode(await arquivo.slice(0, 5).arrayBuffer())
            .startsWith("%PDF-")
        )
          throw new Error("O arquivo não é um PDF válido.");
        tipo = "pdf";
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(
              String(reader.result).replace(
                /^data:[^;]+;/,
                "data:application/pdf;",
              ),
            );
          reader.onerror = () =>
            reject(new Error("Não foi possível ler o PDF."));
          reader.readAsDataURL(arquivo);
        });
      } else {
        if (!/^image\/(png|jpeg|webp)$/.test(arquivo.type))
          throw new Error(
            "Use PDF, imagem PNG/JPEG/WebP ou áudio. Outros documentos ainda não são aceitos.",
          );
        dataUrl = await prepararPrint(arquivo);
      }
      if (token === versao.current)
        setAnexo({ nome: arquivo.name.slice(0, 120), tipo, dataUrl });
    } catch (e) {
      if (token === versao.current)
        setErro(e instanceof Error ? e.message : "Não foi possível anexar.");
    } finally {
      if (token === versao.current) setPreparando(false);
    }
  }
  async function abrirHistorico() {
    historicoRequest.current?.abort();
    const controller = new AbortController();
    historicoRequest.current = controller;
    setCarregandoHistorico(true);
    setErroHistorico(null);
    try {
      await filaSalvar.current;
      if (controller.signal.aborted) return;
      const lista = await listarConversasAssistente(controller.signal, sitio);
      if (!controller.signal.aborted) setHistorico(lista);
    } catch {
      if (!controller.signal.aborted)
        setErroHistorico(
          "Não foi possível carregar o histórico. Tente novamente.",
        );
    } finally {
      if (!controller.signal.aborted) setCarregandoHistorico(false);
    }
  }
  async function carregarConversa(id: string) {
    const controller = new AbortController();
    historicoRequest.current = controller;
    setCarregandoHistorico(true);
    try {
      await filaSalvar.current;
      if (controller.signal.aborted) return;
      const r = await obterConversaAssistente(id, controller.signal, sitio);
      if (!controller.signal.aborted) {
        conversaId.current = id;
        revisoes.current.set(id, r.revisao);
        snapshotsSalvos.current.set(
          id,
          JSON.stringify(mensagensPersistiveis(r.mensagens)),
        );
        setMensagens(r.mensagens.map((m) => ({ ...m, cancelada: true })));
        setHistorico(null);
        setAnexo(null);
        setInput("");
      }
    } catch {
      if (!controller.signal.aborted)
        setErroHistorico(
          "Esta conversa não está disponível para o seu acesso atual.",
        );
    } finally {
      if (!controller.signal.aborted) setCarregandoHistorico(false);
    }
  }
  async function ouvir(indice: number, token: string) {
    if (bloqueado) return;
    const controller = new AbortController();
    emCurso.current = controller;
    setOuvindo(indice);
    try {
      const r = await ouvirRespostaAssistente(token, controller.signal, sitio);
      if (controller.signal.aborted) return;
      const som = new Audio(r.audio);
      player.current = som;
      som.onended = () => {
        player.current = null;
        setOuvindo(null);
      };
      som.onerror = () => {
        player.current = null;
        setOuvindo(null);
        setErro("Não foi possível reproduzir a resposta.");
      };
      await som.play();
    } catch (e) {
      if (!controller.signal.aborted) {
        setOuvindo(null);
        setErro(
          e instanceof Error ? e.message : "Não foi possível ouvir a resposta.",
        );
      }
    }
  }
  async function confirmar(indice: number, token: string) {
    if (modo !== "editar" || bloqueado || trava.current) return;
    trava.current = true;
    setOcupado(true);
    const controller = new AbortController();
    emCurso.current = controller;
    try {
      const resposta = await confirmarPesagemAssistente(
        token,
        controller.signal,
        sitio,
      );
      if (!controller.signal.aborted)
        setMensagens((m) =>
          m.map((item, i) =>
            i === indice
              ? { ...item, resposta, cancelada: true, erro: undefined }
              : item,
          ),
        );
    } catch (e) {
      if (!controller.signal.aborted) {
        if (acessoRevogado(e)) setMensagens([]);
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível registrar. Tente confirmar novamente.",
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        trava.current = false;
        setOcupado(false);
      }
    }
  }
  useEffect(() => { if (perguntaInicial) { setInput(perguntaInicial); inputRef.current?.focus(); } }, [perguntaInicial]);
  useEffect(() => { if (novaConversaVersao > 0) novaConversa(); }, [novaConversaVersao]);

  // A saída com mensagem não enviada pergunta pelo diálogo do sistema, como nas demais telas.
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const resolverSaida = useRef<((sair: boolean) => void) | null>(null);
  useEffect(() => () => { resolverSaida.current?.(false); }, []);
  useEffect(() => {
    if (!pagina || !ativo || (!input.trim() && !anexo && !ocupado && !audio.ocupado)) return;
    return registrarGuardaNavegacao(async () => {
      if (ocupado || audio.ocupado) return false;
      setConfirmarSaida(true);
      return new Promise<boolean>(resolve => { resolverSaida.current = resolve; });
    });
  }, [pagina, ativo, input, anexo, ocupado, audio.ocupado]);
  const responderSaida = (sair: boolean) => { setConfirmarSaida(false); resolverSaida.current?.(sair); resolverSaida.current = null; };
  useEffect(() => { if (!ativo) { cancelarPendentes(); setModoVoz(false); } }, [ativo]);
  useEffect(() => { if (abrirHistoricoVersao > 0) { voz.encerrar(); setModoVoz(false); void abrirHistorico(); } }, [abrirHistoricoVersao]);

  const seletorModo = (
    <div
      className="assistente-toggle"
      role="group"
      aria-label="Modo do assistente"
    >
      {(["consultar", "editar"] as const).map((valor) => (
        <button
          type="button"
          key={valor}
          aria-pressed={modo === valor}
          disabled={
            carregandoConfig ||
            (valor === "editar" && !config?.podeEditar)
          }
          onClick={() => mudarModo(valor)}
        >
          {valor === "consultar" ? "Consultar" : "Editar"}
        </button>
      ))}
    </div>
  );
  return (
    <>
    <Dialog
      open={aberto}
      onOpenChange={(valor) => {
        if (!valor) cancelarPendentes();
        setAberto(valor);
      }}
    >
      {!pagina && <DialogTrigger asChild>
        <Button
          className="fixed bottom-5 right-3 z-40 size-11 rounded-lg p-0 shadow-lg max-[901px]:bottom-auto max-[901px]:top-3"
          aria-label="Abrir assistente do Terrano"
        >
          <MessageCircle size={18} aria-hidden />
        </Button>
      </DialogTrigger>}
      <SuperficieChat pagina={pagina}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          tituloRef.current?.focus();
        }}
        className={`financeiro-colorido assistente-consulta${pagina ? " assistente-pagina" : ""}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            if (!bloqueado && !modoVoz) setArrastando(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setArrastando(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setArrastando(false);
          if (bloqueado || modoVoz) return;
          if (e.dataTransfer.files.length !== 1) {
            setErro("Solte um arquivo por vez.");
            return;
          }
          void anexar(e.dataTransfer.files[0]);
        }}
      >
        <DialogHeader className="assistente-cabecalho">
          <div className={`assistente-titulo${pagina ? " assistente-titulo-pagina" : ""}`}>
            <DialogTitle ref={tituloRef} tabIndex={-1}>
              <MessageCircle size={24} aria-hidden />
              Assistente Terrano
            </DialogTitle>
            <div className="assistente-acoes">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Histórico de conversas"
                disabled={bloqueado || carregandoConfig}
                onClick={() => void abrirHistorico()}
              >
                <History size={18} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Nova conversa"
                disabled={bloqueado}
                onClick={novaConversa}
              >
                <Plus size={20} />
              </Button>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Converse sobre o Terrano, consulte dados ou prepare uma pesagem para
            confirmação.
          </DialogDescription>
          <div className="assistente-contexto">
            {!pagina && <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={ocupado || preparando}
                  aria-label="Mudar fazenda"
                >
                  <MapPin size={15} />
                  {config?.escopo.nome ?? "Selecionar fazenda"}
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {sitios.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onSelect={() => trocarSitio(s.id)}
                  >
                    {s.nome}
                    {s.id === sitio && <Check size={14} />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>}
            {!pagina && seletorModo}
          </div>
        </DialogHeader>
        <div className="assistente-corpo">
          {carregandoConfig && (
            <p role="status">
              <Loader2 className="animate-spin" size={16} />
              Abrindo assistente…
            </p>
          )}
          {erroConfig && (
            <div role="alert">
              <p>{erroConfig}</p>
              <Button
                variant="outline"
                onClick={() => setRevisao((r) => r + 1)}
              >
                Tentar novamente
              </Button>
            </div>
          )}
          {carregandoHistorico && <p role="status">Carregando conversas…</p>}
          {erroHistorico && (
            <p role="alert" className="assistente-aviso">
              {erroHistorico}
            </p>
          )}
          {historico && (
            <section className="assistente-historico">
              <div>
                <h3>Conversas anteriores</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistorico(null)}
                >
                  Voltar à conversa
                </Button>
              </div>
              {historico.length ? (
                historico.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => void carregarConversa(c.id)}
                    disabled={carregandoHistorico}
                  >
                    <MessageCircle size={16} />
                    <span>{c.titulo}</span>
                    <span>
                      {new Date(c.atualizadoEm).toLocaleDateString("pt-BR")}
                    </span>
                  </button>
                ))
              ) : (
                <p>Nenhuma conversa salva nesta fazenda.</p>
              )}
            </section>
          )}
          {!historico && (
            <>
              {modoVoz && (
                <section className="assistente-voz">
                  <Button
                    variant="ghost"
                    aria-label="Conversa por texto"
                    onClick={() => {
                      voz.encerrar();
                      setModoVoz(false);
                    }}
                  >
                    Voltar ao texto
                  </Button>
                  <div
                    className="assistente-onda"
                    data-estado={voz.estado}
                    aria-hidden
                  >
                    {[20, 38, 65, 46, 76, 42, 28].map((altura, i) => (
                      <span key={i} style={{ height: altura }} />
                    ))}
                  </div>
                  <h3 role="status">
                    {voz.estado === "conectando"
                      ? "Aguardando microfone…"
                      : voz.estado === "processando"
                        ? "Consultando…"
                        : voz.estado === "falando"
                          ? "Terrano está falando"
                          : voz.ativa
                            ? voz.silenciado
                              ? "Microfone silenciado"
                              : "Pode falar"
                            : "Vamos conversar?"}
                  </h3>
                  <div className="assistente-voz-controles">
                    {!voz.ativa ? (
                      <Button
                        disabled={!voz.suportado || carregandoConfig}
                        onClick={() => void voz.iniciar()}
                      >
                        <Mic size={16} />
                        Iniciar conversa
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={voz.alternarMicrofone}
                        >
                          {voz.silenciado ? (
                            <MicOff size={16} />
                          ) : (
                            <Mic size={16} />
                          )}
                          {voz.silenciado
                            ? "Ativar microfone"
                            : "Silenciar microfone"}
                        </Button>
                        {voz.estado === "falando" && (
                          <Button variant="outline" onClick={voz.interromper}>
                            Interromper
                          </Button>
                        )}
                        <Button variant="outline" onClick={voz.encerrar}>
                          Encerrar
                        </Button>
                      </>
                    )}
                  </div>
                  <p>
                    Voz gerada por IA. Áudio e respostas faladas são processados
                    pela OpenAI.
                  </p>
                  {!voz.suportado && (
                    <p>
                      Este navegador não oferece gravação por voz. Use texto ou
                      envie um arquivo de áudio.
                    </p>
                  )}
                </section>
              )}
              {!mensagens.length && config && !modoVoz && (
                <section className="assistente-boas-vindas">
                  <h3>
                    {modo === "editar"
                      ? "O que você quer registrar?"
                      : "Como posso ajudar?"}
                  </h3>
                  <p>
                    {modo === "editar"
                      ? "Informe o brinco, a data e o peso. Você confere a pesagem antes de confirmar."
                      : "Consulte os dados da fazenda, tire uma dúvida ou anexe um documento."}
                  </p>
                  {modo === "consultar" && (
                    <>
                      <div className="assistente-sugestoes">
                        {CONSULTAS.filter((c) =>
                          config.consultas.includes(c.visao),
                        ).map((c) => (
                          <Button
                            key={c.visao}
                            variant="outline"
                            size="sm"
                            disabled={bloqueado}
                            onClick={() =>
                              void enviar(
                                {
                                  consulta: {
                                    visao: c.visao,
                                    inicio: null,
                                    fim: null,
                                  },
                                },
                                c.pergunta,
                              )
                            }
                          >
                            {c.titulo}
                          </Button>
                        ))}
                      </div>
                      <details className="assistente-guias">
                        <summary>
                          <BookOpen size={16} />
                          Guias de uso
                        </summary>
                        {config.artigos.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            disabled={bloqueado}
                            onClick={() =>
                              void enviar({ artigoId: a.id }, a.titulo)
                            }
                          >
                            {a.titulo}
                          </button>
                        ))}
                      </details>
                    </>
                  )}
                </section>
              )}
              <div
                role="log"
                aria-label="Conversa com o assistente"
                aria-live="polite"
                className="assistente-mensagens"
              >
                {mensagens.map((m, i) => (
                  <div key={i}>
                    <p className="assistente-pergunta">{m.pergunta}</p>
                    {m.anexo && (
                      <p className="assistente-anexo-enviado">
                        <Paperclip size={14} />
                        {m.anexo.nome}
                      </p>
                    )}
                    {m.resposta && (
                      <div className="assistente-resposta">
                        <div className="assistente-autor">
                          <MessageCircle size={16} />
                          Terrano
                        </div>
                        {m.resposta.dados ? <RespostaDados dados={m.resposta.dados} /> : <p>{m.resposta.resposta}</p>}
                        {m.resposta.proposta &&
                          !m.cancelada &&
                          modo === "editar" && (
                            <ConferenciaPesagem
                              proposta={m.resposta.proposta}
                              escopo={m.resposta.escopo.nome}
                              bloqueado={bloqueado}
                              onGravar={() => void confirmar(i, m.resposta!.proposta!.token)}
                              onCorrigir={() => {
                                setMensagens((ms) => ms.map((item, j) => (j === i ? { ...item, cancelada: true } : item)));
                                setInput(m.pergunta);
                                inputRef.current?.focus();
                              }}
                            />
                          )}
                        {m.resposta.modo === "proposta" &&
                          (m.cancelada || !m.resposta.proposta) && (
                            <p className="assistente-aviso">
                              Pesagem não gravada. Ajuste a mensagem e envie de novo.
                            </p>
                          )}
                        {m.resposta.fontes.map((f) => (
                          <button
                            type="button"
                            key={f.url}
                            className="assistente-fonte"
                            onClick={() => {
                              cancelarPendentes();
                              setAberto(false);
                              if (onAbrirFonte)
                                onAbrirFonte(
                                  f.url,
                                  m.resposta!.escopo.propriedadeId,
                                );
                              else navegarPara(f.url);
                            }}
                          >
                            {f.titulo}
                            <ArrowUpRight size={15} />
                          </button>
                        ))}
                        <div className="assistente-metadados">
                          {m.resposta.locucao && (
                            <button
                              type="button"
                              disabled={bloqueado && ouvindo !== i}
                              onClick={() => {
                                if (ouvindo === i) {
                                  player.current?.pause();
                                  player.current = null;
                                  emCurso.current?.abort();
                                  setOuvindo(null);
                                } else void ouvir(i, m.resposta!.locucao!);
                              }}
                            >
                              <Volume2 size={13} />
                              {ouvindo === i ? "Parar áudio" : "Ouvir"}
                            </button>
                          )}
                          <span>
                            {m.resposta.escopo.nome} ·{" "}
                            {new Date(
                              m.resposta.consultadoEm,
                            ).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard
                                .writeText(m.resposta!.resposta)
                                .then(() => setCopiada(i))
                                .catch(() =>
                                  setErro(
                                    "Não foi possível copiar a resposta.",
                                  ),
                                );
                            }}
                          >
                            <Copy size={13} />
                            {copiada === i ? "Copiado" : "Copiar"}
                          </button>
                        </div>
                      </div>
                    )}
                    {m.erro && (
                      <div role="alert" className="assistente-aviso">
                        <p>{m.erro}</p>
                        {m.entrada && (
                          <Button
                            disabled={bloqueado}
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void enviar(
                                "pergunta" in m.entrada!
                                  ? { ...m.entrada!, modo }
                                  : m.entrada!,
                                m.pergunta,
                              )
                            }
                          >
                            Tentar novamente
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {ocupado && (
                  <p role="status">
                    <Loader2 className="animate-spin" size={16} />
                    {modo === "editar" ? "Preparando…" : "Consultando…"}
                  </p>
                )}
                <div ref={fimRef} />
              </div>
            </>
          )}
        </div>
        {!modoVoz && (
          <form
            className="assistente-rodape"
            onSubmit={(e) => {
              e.preventDefault();
              enviarPergunta();
            }}
          >
            {config && !config.conversaDisponivel && (
              <p className="assistente-aviso">
                A conversa com IA ainda não está configurada. As consultas
                rápidas e os guias de uso já estão disponíveis.
              </p>
            )}
            {anexo && (
              <div className="assistente-previa">
                {anexo.tipo === "imagem" ? (
                  <img src={anexo.dataUrl} alt="Prévia do print" />
                ) : (
                  <FileText size={28} />
                )}
                <span>{anexo.nome}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover anexo"
                  onClick={() => {
                    setAnexo(null);
                    versao.current++;
                  }}
                >
                  <X size={16} />
                </Button>
              </div>
            )}
            {erro && (
              <p role="alert" className="assistente-aviso">
                {erro}
              </p>
            )}
            {(audio.ocupado || preparando) && (
              <div role="status" className="assistente-progresso">
                <span>
                  {audio.gravando
                    ? `Gravando · ${audio.segundos}s / 60s`
                    : audio.transcrevendo
                      ? "Transcrevendo áudio…"
                      : audio.preparando
                        ? "Aguardando microfone…"
                        : "Preparando anexo…"}
                </span>
                {audio.ocupado && (
                  <Button variant="ghost" size="sm" onClick={audio.cancelar}>
                    Descartar
                  </Button>
                )}
              </div>
            )}
            <div className="assistente-compositor">
              <label htmlFor="pergunta-assistente" className="sr-only">
                Sua pergunta sobre o Terrano
              </label>
              <Textarea
                id="pergunta-assistente"
                ref={inputRef}
                value={input}
                maxLength={2000}
                rows={2}
                disabled={
                  !config?.conversaDisponivel || bloqueado || carregandoConfig
                }
                placeholder={
                  modo === "editar"
                    ? "Ex.: registrar 450 kg para o brinco 1058 hoje…"
                    : "Pergunte sobre sua fazenda ou sobre o Terrano…"
                }
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    enviarPergunta();
                  }
                }}
                onPaste={(e) => {
                  const arquivo = [...e.clipboardData.items]
                    .find((item) => item.kind === "file")
                    ?.getAsFile();
                  if (arquivo) {
                    e.preventDefault();
                    void anexar(arquivo);
                  }
                }}
              />
              <div className="assistente-ferramentas">
                {pagina && seletorModo}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={bloqueado || !config?.conversaDisponivel}
                    >
                      <Paperclip size={16} />
                      Anexar
                      <ChevronDown size={14} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onSelect={() => arquivoRef.current?.click()}
                    >
                      <ImagePlus size={16} />
                      Imagem ou PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => audioRef.current?.click()}
                    >
                      <AudioLines size={16} />
                      Arquivo de áudio
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={
                    !config?.conversaDisponivel ||
                    ocupado ||
                    preparando ||
                    audio.preparando ||
                    audio.transcrevendo ||
                    !audio.suportado
                  }
                  aria-label={
                    audio.gravando
                      ? "Parar e transcrever áudio"
                      : "Gravar áudio"
                  }
                  onClick={() => {
                    if (audio.gravando) audio.parar();
                    else void audio.iniciar();
                  }}
                >
                  {audio.gravando ? <Square size={16} /> : <Mic size={16} />}
                  {audio.gravando ? "Parar" : "Ditar"}
                </Button>
                <Button
                  type="submit"
                  className="assistente-enviar"
                  aria-label="Enviar pergunta"
                  disabled={
                    !config?.conversaDisponivel ||
                    bloqueado ||
                    carregandoConfig ||
                    (!input.trim() && !anexo)
                  }
                >
                  <Send size={17} />
                </Button>
              </div>
            </div>
            {pagina && config && !carregandoConfig && !modoVoz && mensagens.length > 0 && <div className="assistente-atalhos" aria-label="Mensagens sugeridas">
          {CONSULTAS.filter(c => config.consultas.includes(c.visao)).slice(0, 2).map(c => <Button key={c.visao} variant="outline" size="sm" disabled={bloqueado} onClick={() => { setModo("consultar"); setInput(c.pergunta); inputRef.current?.focus(); }}>{c.titulo}</Button>)}
          {config.podeEditar && <Button variant="outline" size="sm" disabled={bloqueado} onClick={() => { mudarModo("editar"); setInput("Quero registrar uma pesagem de rotina."); inputRef.current?.focus(); }}>Registrar pesagem</Button>}
          <Button variant="outline" size="sm" disabled={bloqueado} onClick={() => { setInput("Como posso usar o Terrano?"); inputRef.current?.focus(); }}>Ajuda com o Terrano</Button>
        </div>}
            <input
              type="file"
              ref={arquivoRef}
              accept="image/png,image/jpeg,image/webp,application/pdf"
              aria-label="Selecionar documento ou imagem"
              hidden
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) void anexar(arquivo);
              }}
            />
            <input
              type="file"
              ref={audioRef}
              accept="audio/*,.m4a,.webm"
              aria-label="Selecionar arquivo de áudio"
              hidden
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) void anexar(arquivo);
              }}
            />
            <div className="assistente-opcoes">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={bloqueado || !config?.conversaDisponivel}
                onClick={() => {
                  setErro(null);
                  setModoVoz(true);
                }}
              >
                <AudioLines size={17} />
                Conversar por voz
              </Button>
              <details>
                <summary>Áudio e privacidade</summary>
                <p>
                  Áudio, documentos e prints enviados são processados pela
                  OpenAI. Voz gerada por IA. Revise o ditado antes de enviar.
                  Conversas são salvas na sua conta, por fazenda; anexos e áudio
                  não são guardados no histórico.
                </p>
              </details>
            </div>
          </form>
        )}
        {modoVoz && erro && (
          <p role="alert" className="assistente-aviso">
            {erro}
          </p>
        )}
        {arrastando && (
          <div className="assistente-drop" role="status">
            <Paperclip size={32} />
            <strong>Solte o arquivo aqui</strong>
            <span>Imagem, PDF de até 2 MiB ou áudio</span>
          </div>
        )}
      </SuperficieChat>
    </Dialog>
    <ConfirmDialog open={confirmarSaida} title="Sair da conversa?" message="A mensagem ainda não enviada será descartada." confirmLabel="Sair e descartar" cancelLabel="Continuar na conversa" cancelTone="safe" tone="danger" onConfirm={() => responderSaida(true)} onCancel={() => responderSaida(false)} />
    </>
  );
}

function SuperficieChat({ pagina, onOpenAutoFocus, children, ...props }: React.ComponentProps<typeof DialogContent> & { pagina: boolean }) {
  if (pagina) return <div {...props} role="region" aria-label="Conversa com IA Terrano">{children}</div>;
  return <DialogContent {...props} onOpenAutoFocus={onOpenAutoFocus}>{children}</DialogContent>;
}
