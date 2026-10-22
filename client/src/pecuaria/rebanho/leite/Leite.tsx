import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleMinus,
  Milk,
  Moon,
  Save,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { useToast } from "../../../components/Toast";
import { obterFolha, salvarFolha } from "./api";
import { IncluirAnimal } from "./IncluirAnimal";
import { ConfiguracoesOrdenha } from "./ConfiguracoesOrdenha";
import {
  celulasFolha,
  dataValida,
  formatarLitros,
  hojeOperacional,
  lerLitros,
  resumirCelulas,
} from "./modelo";
import type { FolhaLeite, MedicaoInput, SalvarFolhaInput } from "./types";
import "./leite.css";
interface Rascunho {
  originais?: MedicaoInput[];
  tentativa?: { payload: string; chave: string } | null; // Compatibilidade com rascunhos anteriores.
  tentativas?: Record<string, string>;
  adicionais?: import("./types").AnimalFolhaLeite[];
  versao: number;
  celulas: MedicaoInput[];
  excluir: string[];
  motivo: string;
}
const chaveRascunho = (sitio: number | null, data: string) =>
  `terrano:leite:${sitio ?? "principal"}:${data}`;
function lerRascunho(chave: string): Rascunho | null {
  try {
    return JSON.parse(
      sessionStorage.getItem(chave) ?? "null",
    ) as Rascunho | null;
  } catch {
    return null;
  }
}
export function Leite({ podeLancar, acoesContainer }: { podeLancar: boolean; acoesContainer?: HTMLElement | null }) {
  const toast = useToast();
  const sitio = getPropriedadeAtiva();
  const [data, setData] = useState(() => {
    const p = new URLSearchParams(location.search).get("dataOperacional");
    return dataValida(p) ? p : hojeOperacional();
  });
  const [posicao, setPosicao] = useState(
    () => new URLSearchParams(location.search).get("ordenha") ?? "",
  );
  const [originais, setOriginais] = useState<MedicaoInput[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [folha, setFolha] = useState<FolhaLeite | null>(null);
  const [celulas, setCelulas] = useState<MedicaoInput[]>([]);
  const [excluir, setExcluir] = useState<string[]>([]);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [falhasAnimais, setFalhasAnimais] = useState<string[]>([]);
  const [config, setConfig] = useState(false);
  const [incluir, setIncluir] = useState(false);
  const [adicionais, setAdicionais] = useState<
    import("./types").AnimalFolhaLeite[]
  >([]);
  const [versaoBase, setVersaoBase] = useState(0);
  const [invalidos, setInvalidos] = useState<string[]>([]);
  const [pagina, setPagina] = useState(() =>
    Math.max(
      1,
      Number(new URLSearchParams(location.search).get("leitePagina")) || 1,
    ),
  );
  const [busca, setBusca] = useState(
    () => new URLSearchParams(location.search).get("leiteBusca") ?? "",
  );
  const [revisao, setRevisao] = useState(0);
  const geracao = useRef(0);
  const tentativas = useRef<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const sessoesRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const revelarAtiva = () => {
      const grupo = sessoesRef.current;
      const ativa = grupo?.querySelector<HTMLButtonElement>(
        'button[aria-pressed="true"]',
      );
      if (grupo && ativa && grupo.scrollWidth > grupo.clientWidth)
        grupo.scrollLeft = Math.max(
          0,
          ativa.offsetLeft -
            grupo.offsetLeft -
            (grupo.clientWidth - ativa.offsetWidth) / 2,
        );
    };
    revelarAtiva();
    window.addEventListener("resize", revelarAtiva);
    return () => window.removeEventListener("resize", revelarAtiva);
  }, [posicao, folha]);
  const escopo = useRef("");
  escopo.current = `${sitio}:${data}`;
  useEffect(() => {
    const ouvir = () => {
      const p = new URLSearchParams(location.search);
      const d = p.get("dataOperacional");
      if (dataValida(d)) setData(d);
      setPosicao(p.get("ordenha") ?? "");
      setBusca(p.get("leiteBusca") ?? "");
      setPagina(Math.max(1, Number(p.get("leitePagina")) || 1));
    };
    window.addEventListener("popstate", ouvir);
    return () => window.removeEventListener("popstate", ouvir);
  }, []);
  useEffect(() => {
    const atual = ++geracao.current;
    setCarregando(true);
    setErro("");
    setFolha(null);
    setSujo(false);
    setExcluir([]);
    setMotivo("");
    setAdicionais([]);
    setInvalidos([]);
    setValores({});
    setFalhasAnimais([]);
    tentativas.current = {};
    void obterFolha(data, sitio)
      .then((f) => {
        if (atual !== geracao.current) return;
        setFolha(f);
        const r = podeLancar ? lerRascunho(chaveRascunho(sitio, data)) : null;
        setOriginais(r?.originais ?? celulasFolha(f.animais));
        tentativas.current = r?.tentativas ?? (r?.tentativa ? { [r.tentativa.payload]: r.tentativa.chave } : {});
        setVersaoBase(r?.versao ?? f.versao);
        setAdicionais(r?.adicionais ?? []);
        if (r) {
          setCelulas(r.celulas);
          setExcluir(r.excluir);
          setMotivo(r.motivo);
          setSujo(true);
          if (r.versao !== f.versao)
            setErro(
              "A folha mudou desde o seu rascunho. Confira os registros antes de reaplicar as alterações.",
            );
        } else setCelulas(celulasFolha(f.animais));
        setPosicao((p) =>
          f.sessoes.some((s) => s.posicaoId === p)
            ? p
            : (f.sessoes[0]?.posicaoId ?? ""),
        );
      })
      .catch((e) => {
        if (atual === geracao.current)
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar a folha.",
          );
      })
      .finally(() => {
        if (atual === geracao.current) setCarregando(false);
      });
    return () => {
      geracao.current++;
    };
  }, [data, sitio, revisao, podeLancar]);
  useEffect(() => {
    if (
      !folha ||
      !sujo ||
      folha.dataOperacional !== data ||
      (sitio !== null && folha.propriedadeId !== sitio)
    )
      return;
    try {
      sessionStorage.setItem(
        chaveRascunho(sitio, data),
        JSON.stringify({
          versao: versaoBase,
          celulas,
          excluir,
          motivo,
          adicionais,
          originais,
          tentativas: tentativas.current,
        }),
      );
    } catch {
      /* O estado em memória permanece disponível. */
    }
  }, [
    folha,
    sujo,
    celulas,
    excluir,
    motivo,
    sitio,
    data,
    adicionais,
    versaoBase,
    originais,
    salvando,
  ]);
  useEffect(() => {
    if (!sujo) return;
    const alertar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", alertar);
    return () => window.removeEventListener("beforeunload", alertar);
  }, [sujo]);
  useEffect(() => {
    if (!folha || folha.dataOperacional !== data || !posicao) return;
    const u = new URL(location.href);
    u.searchParams.set("dataOperacional", data);
    u.searchParams.set("ordenha", posicao);
    history.replaceState(history.state, "", u);
  }, [folha, data, posicao]);
  function navegar(d: string, p = posicao) {
    const u = new URL(location.href);
    u.searchParams.set("dataOperacional", d);
    u.searchParams.set("leitePagina", "1");
    if (p) u.searchParams.set("ordenha", p);
    history.pushState(null, "", u);
    setData(d);
    setPosicao(p);
    setPagina(1);
  }
  function filtrar(buscaNova: string, paginaNova: number) {
    setBusca(buscaNova);
    setPagina(paginaNova);
    const u = new URL(location.href);
    if (buscaNova) u.searchParams.set("leiteBusca", buscaNova);
    else u.searchParams.delete("leiteBusca");
    u.searchParams.set("leitePagina", String(paginaNova));
    history.replaceState(history.state, "", u);
  }
  function dia(delta: number) {
    const d = new Date(`${data}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    navegar(d.toISOString().slice(0, 10));
  }
  const podeEditar = podeLancar && !salvando && !carregando;
  function mudar(animalId: string, patch: Partial<MedicaoInput>) {
    setCelulas((atual) =>
      atual.map((c) =>
        c.animalId === animalId && c.posicaoId === posicao
          ? { ...c, ...patch }
          : c,
      ),
    );
    setSujo(true);
    setErro("");
  }
  async function salvar(animalId?: string) {
    if (!folha || !podeEditar || invalidos.some(id => !animalId || id === `${animalId}:${posicao}`)) return;
    const noRecorte = (c: MedicaoInput) => !animalId || (c.animalId === animalId && c.posicaoId === posicao);
    const contexto = escopo.current;
    const atual = geracao.current;
    setErro("");
    if (
      celulas.some(
        (c) =>
          noRecorte(c) && c.estado === "NAO_ORDENHADO" &&
          (!c.motivo || c.motivo.trim().length < 5),
      )
    ) {
      setErro(
        "Explique com ao menos 5 caracteres por que cada animal não foi ordenhado.",
      );
      return;
    }
    const alteradas = celulas.filter(
      (c) =>
        noRecorte(c) && !excluir.includes(c.animalId) &&
        JSON.stringify(c) !==
          JSON.stringify(
            originais.find(
              (o) => o.animalId === c.animalId && o.posicaoId === c.posicaoId,
            ),
          ),
    );
    const adicionarAgora = adicionais.filter(a => !animalId || a.animalId === animalId);
    const excluirAgora = animalId ? [] : excluir;
    const corrigindo =
      (folha.congelada && adicionarAgora.length > 0) ||
      alteradas.some((c) =>
        originais.some(
          (o) =>
            o.animalId === c.animalId &&
            o.posicaoId === c.posicaoId &&
            o.estado !== "PENDENTE",
        ),
      ) ||
      excluirAgora.length > 0;
    if (corrigindo && motivo.trim().length < 5) {
      setErro(
        "Informe o motivo da correção ou exclusão com ao menos 5 caracteres.",
      );
      return;
    }
    const base: Omit<SalvarFolhaInput, "chave"> = {
      propriedadeId: folha.propriedadeId,
      dataOperacional: data,
      versaoEsperada: versaoBase,
      medicoes: alteradas,
      animaisAdicionar: adicionarAgora.map((a) => a.animalId),
      animaisExcluir: excluirAgora,
      motivoCorrecao: motivo.trim() || null,
    };
    const payload = JSON.stringify(base);
    // Uma resposta perdida de outro animal continua recuperável após tentativas intermediárias.
    const chave = tentativas.current[payload] ?? crypto.randomUUID();
    tentativas.current[payload] = chave;
    setSalvando(true);
    try {
      const f = await salvarFolha({ ...base, chave });
      sessionStorage.removeItem(chaveRascunho(sitio, data));
      if (escopo.current !== contexto || atual !== geracao.current) return;
      const servidor = celulasFolha(f.animais);
      const restantes = celulas.filter(c => !noRecorte(c) &&
        JSON.stringify(c) !== JSON.stringify(originais.find(o => o.animalId === c.animalId && o.posicaoId === c.posicaoId)));
      const adicionaisRestantes = adicionais.filter(a => !adicionarAgora.includes(a));
      const excluirRestantes = excluir.filter(id => !excluirAgora.includes(id));
      const locais = [...servidor, ...celulasFolha(adicionaisRestantes)].map(c =>
        restantes.find(r => r.animalId === c.animalId && r.posicaoId === c.posicaoId) ?? c);
      const aindaSujo = restantes.length > 0 || adicionaisRestantes.length > 0 || excluirRestantes.length > 0;
      setFolha(f);
      setOriginais(servidor);
      setValores(atual => Object.fromEntries(Object.entries(atual).filter(([id]) => animalId && id !== `${animalId}:${posicao}`)));
      setVersaoBase(f.versao);
      setAdicionais(adicionaisRestantes);
      setCelulas(locais);
      setExcluir(excluirRestantes);
      if (!aindaSujo) setMotivo("");
      setSujo(aindaSujo);
      setFalhasAnimais(ids => animalId ? ids.filter(id => id !== `${animalId}:${posicao}`) : []);
      delete tentativas.current[payload];
      toast.success(animalId ? "Animal salvo no servidor" : "Ordenha salva");
    } catch (e) {
      if (escopo.current === contexto && atual === geracao.current) {
        if (animalId) setFalhasAnimais(ids => [...new Set([...ids, `${animalId}:${posicao}`])]);
        setErro(
          `${e instanceof Error ? e.message : "Não foi possível salvar."} Seu rascunho foi preservado.`,
        );
      }
    } finally {
      setSalvando(false);
    }
  }
  const ativos = [...(folha?.animais ?? []), ...adicionais].filter(
    (a) => !excluir.includes(a.animalId),
  );
  const selecionada = folha?.sessoes.find((s) => s.posicaoId === posicao);
  const celulasAtivas = celulas.filter((c) => !excluir.includes(c.animalId));
  const resumo = resumirCelulas(
    celulasAtivas.filter((c) => c.posicaoId === posicao),
  );
  const total = resumirCelulas(celulasAtivas);
  const filtrados = ativos.filter((a) =>
    `${a.nome ?? ""} ${a.brinco}`
      .toLocaleLowerCase("pt-BR")
      .includes(busca.toLocaleLowerCase("pt-BR")),
  );
  const paginas = Math.max(1, Math.ceil(filtrados.length / 10));
  const visiveis = filtrados.slice(
    (Math.min(pagina, paginas) - 1) * 10,
    Math.min(pagina, paginas) * 10,
  );
  const proximo = ativos.find((a) =>
    celulas.some(
      (c) =>
        c.animalId === a.animalId &&
        c.posicaoId === posicao &&
        c.estado === "PENDENTE",
    ),
  );
  const acaoConfigurar = podeLancar ? (
<button
                  className="leite-button leite-configurar"
                  disabled={salvando || sujo || carregando || !folha}
                  title={
                    sujo
                      ? "Salve a ordenha antes de alterar a configuração"
                      : undefined
                  }
                  onClick={() => setConfig(true)}
                >
                  <Settings2 size={20} aria-hidden="true" />
                  <span>Configurar ordenhas</span>
                </button>
  ) : null;
  return (
    <section className="leite-page" aria-label="Ordenha">
      <header className="leite-header">
        <div>
          <h2 className="leite-titulo-secao">Ordenha em foco</h2>
          <p>Registre os litros de cada animal nesta ordenha.</p>
        </div>
        <div className="leite-header-acoes">
          {acoesContainer ? createPortal(acaoConfigurar, acoesContainer) : acaoConfigurar}
        <div className="leite-data">
          <button
            className="leite-icon"
            onClick={() => dia(-1)}
            aria-label="Dia anterior"
          >
            <ChevronLeft />
          </button>
          <input
            aria-label="Data operacional"
            type="date"
            value={data}
            onChange={(e) => {
              if (dataValida(e.target.value)) navegar(e.target.value);
            }}
          />
          <button
            className="leite-icon"
            onClick={() => dia(1)}
            aria-label="Próximo dia"
          >
            <ChevronRight />
          </button>
        </div>
        </div>
      </header>
      {carregando && (
        <p role="status" className="leite-aviso">
          Carregando a folha de ordenha…
        </p>
      )}
      {erro && (
        <div role="alert" className="leite-erro">
          {erro}
          <button
            className="leite-button"
            onClick={() => setRevisao((r) => r + 1)}
            disabled={salvando}
          >
            Atualizar folha
          </button>
          {sujo && (
            <button
              className="leite-button"
              disabled={salvando}
              onClick={() => {
                sessionStorage.removeItem(chaveRascunho(sitio, data));
                setSujo(false);
                setRevisao((r) => r + 1);
              }}
            >
              Descartar rascunho e atualizar
            </button>
          )}
        </div>
      )}
      {!podeLancar && (
        <p className="leite-aviso">
          Você tem acesso de consulta. Os registros são exibidos sem edição.
        </p>
      )}
      {folha && (
        <>
          {folha.impedimentos?.length > 0 && <details className="leite-aviso">
            <summary>Animais fora da ordenha nesta data ({folha.impedimentos.length})</summary>
            <p>A finalidade e os demais requisitos são conferidos pelo servidor na data da produção. Confira o cadastro antes de tentar incluir.</p>
            <ul>{folha.impedimentos.map(a => <li key={a.animalId}>{a.nome || a.brinco} · Brinco {a.brinco}: {a.motivo}</li>)}</ul>
          </details>}
          <div
            className="leite-sessoes"
            ref={sessoesRef}
            role="group"
            aria-label="Ordenhas do dia"
          >
            {folha.sessoes.map((s, i) => {
              const r = resumirCelulas(
                celulasAtivas.filter((c) => c.posicaoId === s.posicaoId),
              );
              const Icon = i === 2 ? Moon : Sun;
              return (
                <button
                  aria-pressed={s.posicaoId === posicao}
                  className={`leite-sessao ${s.posicaoId === posicao ? "selecionada" : ""}`}
                  key={s.posicaoId}
                  onClick={() => navegar(data, s.posicaoId)}
                >
                  <Icon size={28} />
                  <span>
                    <strong>{s.nome}</strong>
                    <small>
                      {r.medidas} medições · {r.pendentes} pendentes
                      {s.horario ? ` · ${s.horario}` : ""}
                    </small>
                  </span>
                  <b>
                    {formatarLitros(r.litros)}
                    {r.pendentes > 0 && r.litros !== null && (
                      <small>parcial</small>
                    )}
                  </b>
                </button>
              );
            })}
          </div>
          <div className="leite-corpo">
            <div className="leite-tabela-area">
              <div className="leite-filtro">
                {podeLancar && (
                  <button
                    className="leite-button"
                    disabled={!podeEditar}
                    onClick={() => setIncluir(true)}
                  >
                    Incluir animal
                  </button>
                )}
                <div className="leite-busca-campo">
                  <label htmlFor="leite-busca">Buscar animal</label>
                  <input
                    id="leite-busca"
                    type="search"
                    value={busca}
                    placeholder="Nome ou brinco"
                    onChange={(e) => {
                      filtrar(e.target.value, 1);
                    }}
                  />
                </div>
              </div>
              <div className="leite-table-scroll">
                <table className="leite-table" aria-label="Medições por animal">
                  <thead>
                    <tr>
                      <th className="leite-coluna-numero" scope="col">#</th>
                      <th scope="col">Animal</th>
                      <th scope="col">Litros nesta ordenha (L)</th>
                      <th scope="col">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((a, i) => {
                      const c = celulas.find(
                        (c) =>
                          c.animalId === a.animalId && c.posicaoId === posicao,
                      );
                      if (!c) return null;
                      return (
                        <tr key={a.animalId} data-estado={c.estado}>
                          <td className="leite-coluna-numero">
                            {(Math.min(pagina, paginas) - 1) * 10 + i + 1}
                          </td>
                          <td>
                            <div className="leite-animal">
                              <Milk size={19} />
                              <span>
                                <strong>{a.nome || a.brinco}</strong>
                                <small>
                                  {a.nome
                                    ? `Brinco ${a.brinco}`
                                    : "Nome não informado"}
                                </small>
                                {a.pendencias.map((p) => (
                                  <small className="leite-pendencia" key={p}>
                                    {p === "LACTACAO_NAO_INFORMADA"
                                      ? "Lactação a conciliar"
                                      : p === "FINALIDADE_NAO_COMPROVADA"
                                        ? "Finalidade histórica a conciliar; litros registrados preservados"
                                        : p
                                          .replaceAll("_", " ")
                                          .toLocaleLowerCase("pt-BR")}
                                  </small>
                                ))}
                              </span>
                            </div>
                            {podeLancar && folha.congelada && (
                              <button
                                className="leite-excluir"
                                disabled={!podeEditar}
                                onClick={() => {
                                  if (
                                    adicionais.some(
                                      (item) => item.animalId === a.animalId,
                                    )
                                  ) {
                                    setAdicionais((atual) =>
                                      atual.filter(
                                        (item) => item.animalId !== a.animalId,
                                      ),
                                    );
                                    setCelulas((atual) =>
                                      atual.filter(
                                        (item) => item.animalId !== a.animalId,
                                      ),
                                    );
                                  } else
                                    setExcluir((ids) => [...ids, a.animalId]);
                                  setSujo(true);
                                }}
                              >
                                Excluir do dia
                              </button>
                            )}
                          </td>
                          <td>
                            <div className="leite-valor">
                              <input
                                ref={(el) => {
                                  inputRefs.current[a.animalId] = el;
                                }}
                                aria-label={`Litros de ${a.nome ? `${a.nome}, brinco ${a.brinco}` : `brinco ${a.brinco}`}`}
                                aria-invalid={invalidos.includes(
                                  `${a.animalId}:${posicao}`,
                                )}
                                inputMode="decimal"
                                type="text"
                                placeholder="—"
                                key={`${a.animalId}:${posicao}:${folha.versao}`}
                                value={
                                  valores[`${a.animalId}:${posicao}`] ??
                                  c.litros ??
                                  ""
                                }
                                disabled={
                                  !podeEditar || c.estado === "NAO_ORDENHADO"
                                }
                                onChange={(e) => {
                                  setValores((atual) => ({
                                    ...atual,
                                    [`${a.animalId}:${posicao}`]:
                                      e.target.value,
                                  }));
                                  try {
                                    const litros = lerLitros(e.target.value);
                                    e.target.setCustomValidity("");
                                    setInvalidos((ids) =>
                                      ids.filter(
                                        (id) =>
                                          id !== `${a.animalId}:${posicao}`,
                                      ),
                                    );
                                    mudar(a.animalId, {
                                      litros,
                                      estado:
                                        litros === null ? "PENDENTE" : "MEDIDO",
                                      motivo: null,
                                    });
                                  } catch (erro) {
                                    setInvalidos((ids) => [
                                      ...new Set([
                                        ...ids,
                                        `${a.animalId}:${posicao}`,
                                      ]),
                                    ]);
                                    e.target.setCustomValidity(
                                      erro instanceof Error
                                        ? erro.message
                                        : "Valor inválido",
                                    );
                                    setErro(
                                      erro instanceof Error
                                        ? erro.message
                                        : "Valor inválido",
                                    );
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    const seguinte = visiveis[i + 1];
                                    if (seguinte)
                                      inputRefs.current[
                                        seguinte.animalId
                                      ]?.focus();
                                  }
                                }}
                              />
                              <span>L</span>
                              {podeEditar && c.estado === "MEDIDO" && (
                                <button
                                  className="leite-icon"
                                  aria-label={`Limpar litros de ${a.nome ? `${a.nome}, brinco ${a.brinco}` : `brinco ${a.brinco}`}`}
                                  onClick={() => {
                                    mudar(a.animalId, {
                                      litros: null,
                                      estado: "PENDENTE",
                                      motivo: null,
                                    });
                                    setValores((atual) => ({
                                      ...atual,
                                      [`${a.animalId}:${posicao}`]: "",
                                    }));
                                    setInvalidos((ids) =>
                                      ids.filter(
                                        (id) =>
                                          id !== `${a.animalId}:${posicao}`,
                                      ),
                                    );
                                  }}
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td>
                            {podeLancar ? (
                              <select
                                data-estado={c.estado}
                                aria-label={`Situação de ${a.nome ? `${a.nome}, brinco ${a.brinco}` : `brinco ${a.brinco}`}`}
                                value={c.estado}
                                disabled={!podeEditar}
                                onChange={(e) => {
                                  const estado = e.target
                                    .value as MedicaoInput["estado"];
                                  mudar(a.animalId, {
                                    estado,
                                    litros:
                                      estado === "MEDIDO"
                                        ? (c.litros ?? 0)
                                        : null,
                                    motivo: null,
                                  });
                                  setValores((atual) => ({
                                    ...atual,
                                    [`${a.animalId}:${posicao}`]:
                                      estado === "MEDIDO"
                                        ? String(c.litros ?? 0)
                                        : "",
                                  }));
                                  setInvalidos((ids) =>
                                    ids.filter(
                                      (id) => id !== `${a.animalId}:${posicao}`,
                                    ),
                                  );
                                }}
                              >
                                <option value="PENDENTE">Pendente</option>
                                <option value="MEDIDO">
                                  {c.litros === 0
                                    ? "0 litro medido"
                                    : "Registrado"}
                                </option>
                                <option value="NAO_ORDENHADO">
                                  Não ordenhado
                                </option>
                              </select>
                            ) : (
                              <span className="leite-status" data-estado={c.estado}>
                                {c.estado === "MEDIDO" ? (
                                  <CheckCircle2 size={17} />
                                ) : c.estado === "NAO_ORDENHADO" ? (
                                  <Ban size={17} />
                                ) : (
                                  <Circle size={12} />
                                )}{" "}
                                {c.estado === "MEDIDO"
                                  ? c.litros === 0
                                    ? "0 litro medido"
                                    : "Registrado"
                                  : c.estado === "NAO_ORDENHADO"
                                    ? "Não ordenhado"
                                    : "Pendente"}
                              </span>
                            )}
                            <small className="leite-salvamento-animal" role="status">
                              {falhasAnimais.includes(`${a.animalId}:${posicao}`) ? "Falha ao salvar · rascunho local" :
                                JSON.stringify(c) !== JSON.stringify(originais.find(o => o.animalId === c.animalId && o.posicaoId === c.posicaoId)) ? "Rascunho local" :
                                  a.medicoes.find(m => m.posicaoId === posicao)?.id ? "Salvo no servidor" : "Ainda não salvo"}
                            </small>
                            {podeLancar && (
                              <button className="leite-button leite-salvar-animal" disabled={!podeEditar || invalidos.includes(`${a.animalId}:${posicao}`) ||
                                JSON.stringify(c) === JSON.stringify(originais.find(o => o.animalId === c.animalId && o.posicaoId === c.posicaoId))}
                                onClick={() => void salvar(a.animalId)}>
                                Salvar animal · {a.nome || a.brinco}
                              </button>
                            )}
                            {c.estado === "NAO_ORDENHADO" && (
                              <input
                                className="leite-motivo-animal"
                                aria-label={`Motivo de ${a.nome ? `${a.nome}, brinco ${a.brinco}` : `brinco ${a.brinco}`}`}
                                placeholder="Por que não foi ordenhado?"
                                value={c.motivo ?? ""}
                                maxLength={500}
                                disabled={!podeEditar}
                                onChange={(e) =>
                                  mudar(a.animalId, { motivo: e.target.value })
                                }
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!filtrados.length && (
                <p className="leite-vazio">
                  {ativos.length
                    ? "Nenhum animal corresponde à busca."
                    : "Nenhum animal na população desta data. A ausência de registros não representa produção zero."}
                </p>
              )}
              <div className="leite-paginacao">
                <span>
                  {filtrados.length} animais · página{" "}
                  {Math.min(pagina, paginas)} de {paginas}
                </span>
                <button
                  className="leite-icon"
                  aria-label="Página anterior"
                  disabled={pagina <= 1}
                  onClick={() => filtrar(busca, pagina - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="leite-icon"
                  aria-label="Próxima página"
                  disabled={pagina >= paginas}
                  onClick={() => filtrar(busca, pagina + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              {excluir.length > 0 && (
                <div className="leite-aviso">
                  {excluir.length} exclusões aguardando salvar.{" "}
                  <button
                    className="leite-button"
                    onClick={() => {
                      setExcluir([]);
                      setSujo(true);
                    }}
                  >
                    Desfazer exclusões
                  </button>
                </div>
              )}
              {sujo && (
                <label className="leite-correcao">
                  Motivo da alteração (correção, inclusão ou exclusão de
                  população guardada)
                  <textarea
                    value={motivo}
                    maxLength={500}
                    disabled={!podeEditar}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                </label>
              )}
            </div>
            <aside className="leite-resumos">
              <section className="leite-resumo">
                <h2>Produção do dia (conhecidos)</h2>
                <div className="leite-parciais">
                  {folha.sessoes.map((s) => {
                    const r = resumirCelulas(
                      celulasAtivas.filter((c) => c.posicaoId === s.posicaoId),
                    );
                    return (
                      <div key={s.posicaoId}>
                        <span>{s.nome}</span>
                        <strong>{formatarLitros(r.litros)}</strong>
                        {r.pendentes > 0 && <small>parcial</small>}
                      </div>
                    );
                  })}
                </div>
                <div className="leite-total">
                  <span>Total conhecido{sujo ? " · rascunho" : ""}</span>
                  <strong>{formatarLitros(total.litros)}</strong>
                </div>
                <div className="leite-cobertura">
                  <h3>Cobertura da ordenha {selecionada?.nome}</h3>
                  <progress
                    value={resumo.resolvidas}
                    max={Math.max(1, resumo.esperadas)}
                    aria-label="Cobertura da ordenha"
                  />
                  <div>
                    <span>
                      {resumo.resolvidas} de {resumo.esperadas} animais
                      resolvidos
                    </span>
                    <span>{resumo.pendentes} pendentes</span>
                  </div>
                  <p>
                    {resumo.medidas} medidos · {resumo.naoOrdenhadas} não
                    ordenhados
                  </p>
                </div>
              </section>
              <section className="leite-resumo leite-legenda">
                <h2>Situação nesta ordenha</h2>
                <div>
                  <CheckCircle2 />
                  <strong>Registrado</strong>
                  <span>Litros informados para o animal.</span>
                </div>
                <div>
                  <Circle />
                  <strong>Pendente</strong>
                  <span>Ainda não tem registro nesta ordenha.</span>
                </div>
                <div>
                  <CircleMinus />
                  <strong>0 litro</strong>
                  <span>Animal ordenhado e não produziu leite.</span>
                </div>
                <div>
                  <Ban />
                  <strong>Não ordenhado</strong>
                  <span>Animal não foi ordenhado. Informe o motivo.</span>
                </div>
              </section>
            </aside>
          </div>
          <footer className="leite-footer">
            <div className="leite-proximo">
              <Milk size={28} />
              <span>
                <strong>Próximo animal</strong>
                <small>
                  {proximo
                    ? `${proximo.nome || proximo.brinco} · pendente`
                    : "Nenhuma medição pendente nesta ordenha"}
                </small>
              </span>
            </div>
            <div className="leite-footer-acoes">
              {podeLancar && (
                <button
                  className="leite-button leite-primary"
                  disabled={!podeEditar || !sujo || invalidos.length > 0}
                  onClick={() => void salvar()}
                >
                  <Save size={20} />
                  {salvando ? "Salvando…" : "Salvar ordenha"}
                </button>
              )}
            </div>
          </footer>
          {incluir && (
            <IncluirAnimal
              data={data}
              propriedadeId={folha.propriedadeId}
              existentes={ativos.map((a) => a.animalId)}
              aoFechar={() => setIncluir(false)}
              aoIncluir={(a) => {
                const animal = {
                  ...a,
                  participanteId: null,
                  localizacaoId: "",
                  excluidoEm: null,
                  motivoExclusao: null,
                  medicoes: folha.sessoes.map((s) => ({
                    id: null,
                    posicaoId: s.posicaoId,
                    estado: "PENDENTE" as const,
                    litros: null,
                    motivo: null,
                    versao: 0,
                  })),
                  totais: resumirCelulas([]),
                };
                setAdicionais((anteriores) => [...anteriores, animal]);
                setCelulas((anteriores) => [
                  ...anteriores,
                  ...celulasFolha([animal]),
                ]);
                setSujo(true);
                setIncluir(false);
              }}
            />
          )}
          {config && (
            <ConfiguracoesOrdenha
              configuracao={folha.configuracao}
              data={data}
              aoFechar={() => setConfig(false)}
              aoSalvar={() => {
                setConfig(false);
                toast.success("Configuração salva");
                setRevisao((r) => r + 1);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
