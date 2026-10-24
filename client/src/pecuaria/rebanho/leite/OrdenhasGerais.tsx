import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/DatePicker";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { Settings2, Sun, Moon, Cylinder, Plus } from "lucide-react";
import "./ordenhas-gerais.css";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { ConfiguracoesOrdenha } from "./ConfiguracoesOrdenha";
import { PainelCadastro } from "@/financeiro/PainelCadastro";
import { OrigensAfericaoLeite } from "./OrigensAfericaoLeite";
import { ConfiguracaoTanques } from "./ConfiguracaoTanques";
import { hojeOperacional, formatarLitros, dataValida } from "./modelo";
import type {
  ConsultaOrdenhasGerais,
  MedicaoGeral,
  TanqueLeite,
} from "./tanques-types";
import "./leite.css";

type EstadoProdutos = "carregando" | "erro" | "pronto";

type RascunhoTanque = {
  versao: number;
  litros: string;
  regua: string;
  natureza: "COMERCIAL" | "NAO_COMERCIAL" | "COLOSTRO";
  origens: string[];
  responsavel: string;
  motivo: string;
  produto?: string;
  alterado?: boolean;
};
function lerRascunhoTanque(chave: string): RascunhoTanque | null {
  try {
    const r = JSON.parse(sessionStorage.getItem(chave) ?? "null");
    if (
      !r ||
      !Number.isInteger(r.versao) ||
      !["litros", "regua", "responsavel", "motivo"].every(
        (k) => typeof r[k] === "string",
      ) ||
      !["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO"].includes(r.natureza) ||
      !Array.isArray(r.origens) ||
      !r.origens.every((v: unknown) => typeof v === "string")
      || (r.produto !== undefined && typeof r.produto !== "string")
      || (r.alterado !== undefined && typeof r.alterado !== "boolean")
    )
      return null;
    return r;
  } catch {
    return null;
  }
}

function AfericaoTanque({
  tanque,
  medicao,
  sitio,
  data,
  posicao,
  animais,
  origensAutomaticas,
  produtos,
  estadoProdutos,
  tentarProdutos,
  podeLancar,
  aoSalvar,
}: {
  tanque: TanqueLeite;
  medicao?: MedicaoGeral;
  sitio: number;
  data: string;
  posicao: string;
  animais: ConsultaOrdenhasGerais["animais"];
  origensAutomaticas: ConsultaOrdenhasGerais["origensAutomaticas"];
  produtos: ProdutoDTO[];
  estadoProdutos: EstadoProdutos;
  tentarProdutos: () => void;
  podeLancar: boolean;
  aoSalvar: () => void;
}) {
  const chaveRascunho = `fazendinha:leite:geral:${sitio}:${data}:${posicao}:${tanque.id}`;
  const [rascunho] = useState(() => medicao?.entradaId ? null : lerRascunhoTanque(chaveRascunho));
  const [versaoBase, setVersaoBase] = useState(
    rascunho?.versao ?? medicao?.versao ?? 0,
  );
  const [litros, setLitros] = useState(
    rascunho?.litros ?? (medicao ? String(medicao.litros) : ""),
  );
  const [regua, setRegua] = useState(
    rascunho?.regua ??
      (medicao?.reguaMm == null ? "" : String(medicao.reguaMm)),
  );
  const [natureza, setNatureza] = useState(
    rascunho?.natureza ?? medicao?.natureza ?? "COMERCIAL",
  );
  const [origens, setOrigens] = useState(
    rascunho?.origens ?? medicao?.animaisOrigem ?? origensAutomaticas.map(a => a.animalId),
  );
  const [responsavel, setResponsavel] = useState(
    rascunho?.responsavel ?? medicao?.responsavel ?? "",
  );
  const [motivo, setMotivo] = useState(rascunho?.motivo ?? "");
  const [produto, setProduto] = useState(rascunho?.produto ?? "");
  useEffect(() => {
    if (
      estadoProdutos === "pronto" &&
      produto &&
      !produtos.some((p) => p.id === produto)
    )
      setProduto("");
  }, [estadoProdutos, produtos, produto]);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [alterado, setAlterado] = useState(() => {
    if (!rascunho) return false;
    if (rascunho.versao !== (medicao?.versao ?? 0)) return true;
    return rascunho.alterado ?? true;
  });
  useEffect(() => {
    if (!alterado && !produto && !motivo) return;
    if (medicao?.entradaId) return;
    try {
      sessionStorage.setItem(
        chaveRascunho,
        JSON.stringify({
          versao: versaoBase,
          litros,
          regua,
          natureza,
          origens,
          responsavel,
          motivo,
          produto,
          alterado,
        }),
      );
    } catch {
      /* Os valores continuam em memória. */
    }
  }, [
    alterado,
    chaveRascunho,
    versaoBase,
    litros,
    regua,
    natureza,
    origens,
    responsavel,
    motivo,
    produto,
    medicao?.entradaId,
  ]);
  useEffect(() => {
    if (!alterado) return;
    const proteger = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", proteger);
    return () => window.removeEventListener("beforeunload", proteger);
  }, [alterado]);
  function descartarRascunho() {
    try {
      sessionStorage.removeItem(chaveRascunho);
    } catch {}
    setLitros(medicao ? String(medicao.litros) : "");
    setRegua(medicao?.reguaMm == null ? "" : String(medicao.reguaMm));
    setNatureza(medicao?.natureza ?? "COMERCIAL");
    setOrigens(medicao?.animaisOrigem ?? origensAutomaticas.map(a => a.animalId));
    setResponsavel(medicao?.responsavel ?? "");
    setMotivo("");
    setProduto("");
    setVersaoBase(medicao?.versao ?? 0);
    setAlterado(false);
    setErro("");
  }
  const travado = !podeLancar || ocupado || !!medicao?.entradaId;
  function mudarRegua(v: string) {
    setAlterado(true);
    setRegua(v);
    if (v.trim()) {
      const ponto = tanque.tabelaConversao.find(
        (p) => p.mm === Number(v.replace(",", ".")),
      );
      if (ponto) setLitros(String(ponto.litros));
    }
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    try {
      if (!litros.trim() || !/^\d+(?:[.,]\d+)?$/.test(litros))
        throw new Error(
          "Informe os litros aferidos; zero precisa ser explícito.",
        );
      if (regua.trim() && !/^\d+(?:[.,]\d+)?$/.test(regua))
        throw new Error("Informe a régua em milímetros.");
      await registrarLeite("/geral", sitio, {
        propriedadeId: sitio,
        dataOperacional: data,
        posicaoId: posicao,
        tanqueId: tanque.id,
        versaoEsperada: versaoBase,
        litros: Number(litros.replace(",", ".")),
        reguaMm: regua.trim() ? Number(regua.replace(",", ".")) : null,
        natureza,
        animaisOrigem: origens,
        responsavel,
        motivoCorrecao: medicao ? motivo : null,
      });
      try {
        sessionStorage.removeItem(chaveRascunho);
      } catch {}
      setAlterado(false);
      setMotivo("");
      setProduto("");
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setOcupado(false);
    }
  }
  async function confirmar() {
    if (
      !medicao ||
      alterado ||
      motivo.trim().length < 5 ||
      ocupado ||
      estadoProdutos !== "pronto" ||
      !produtos.some((p) => p.id === produto)
    ) return;
    setErro("");
    setOcupado(true);
    try {
      await registrarLeite("/geral/confirmacoes", sitio, {
        medicaoId: medicao.id,
        versaoEsperada: medicao.versao,
        produtoId: produto,
        motivoNatureza: motivo,
      });
      try { sessionStorage.removeItem(chaveRascunho); } catch {}
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível confirmar.");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <article className="leite-tanque-afericao">
      <header className="leite-tanque-cabecalho">
        <Cylinder size={20} aria-hidden="true" />
        <div>
          <h3>
            {tanque.nome} · {formatarLitros(tanque.capacidadeLitros)}
          </h3>
          <p>
            {medicao?.entradaId
              ? "Confirmada no estoque"
              : medicao
                ? "Aferição salva · ainda não confirmada no estoque"
                : "Aferição não registrada"}
          </p>
        </div>
      </header>
      {alterado && (
        <p role="status">
          Rascunho local
          {versaoBase !== (medicao?.versao ?? 0)
            ? " — a versão no servidor mudou; confira os dados antes de descartar o rascunho."
            : ""}{" "}
          <Button
            variant="outline"
            type="button"
            disabled={ocupado}
            onClick={descartarRascunho}
          >
            Descartar rascunho
          </Button>
        </p>
      )}
      <OrigensAfericaoLeite
        selecionados={origens}
        animais={animais}
        automaticos={origensAutomaticas}
        salva={!!medicao}
        somenteLeitura={!podeLancar || !!medicao?.entradaId}
        ocupado={ocupado}
        onAplicar={ids => { if (JSON.stringify([...ids].sort()) !== JSON.stringify([...origens].sort())) { setOrigens(ids); setAlterado(true); } }}
      />
      <form onSubmit={(e) => void salvar(e)}>
        <fieldset disabled={travado}>
          <div className="leite-ajuste-grade">
            <label>
              Régua (mm)
              <input
                inputMode="decimal"
                value={regua}
                onChange={(e) => mudarRegua(e.target.value)}
              />
            </label>
            <label>
              Litros desta ordenha
              <input
                required
                inputMode="decimal"
                value={litros}
                onChange={(e) => {
                  setLitros(e.target.value);
                  setAlterado(true);
                }}
              />
            </label>
            <label>
              Natureza
              <SelectCampo
                aria-label="Natureza"
                disabled={travado}
                value={natureza}
                onValueChange={(v) => {
                  setNatureza(v as typeof natureza);
                  setAlterado(true);
                }}
              >
                <option value="COMERCIAL">Comercial</option>
                <option value="NAO_COMERCIAL">Não comercial</option>
                <option value="COLOSTRO">Colostro</option>
              </SelectCampo>
            </label>
            <label>
              Responsável
              <input
                required
                maxLength={160}
                value={responsavel}
                onChange={(e) => {
                  setResponsavel(e.target.value);
                  setAlterado(true);
                }}
              />
            </label>
          </div>

          {medicao && (
            <label>
              Motivo da correção ou declaração da natureza
              <input
                value={motivo}
                minLength={5}
                maxLength={500}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>
          )}
          {podeLancar && !medicao?.entradaId && (
            <Button type="submit" disabled={ocupado}>
              {ocupado ? "Salvando…" : "Salvar aferição"}
            </Button>
          )}
        </fieldset>
      </form>
      {medicao && !medicao.entradaId && medicao.litros > 0 && podeLancar && (
        <div className="leite-tanque-confirmacao">
          <label>
            Produto para o estoque
            <SelectCampo
              aria-label="Produto para o estoque"
              disabled={
                ocupado || estadoProdutos !== "pronto" || !produtos.length
              }
              value={produto}
              onValueChange={setProduto}
            >
              <option value="">Selecione</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </SelectCampo>
          </label>
          {estadoProdutos === "carregando" ? (
            <p role="status">Carregando produtos para o estoque…</p>
          ) : estadoProdutos === "erro" ? (
            <div role="alert">
              <p>
                Não foi possível carregar os produtos para o estoque. Tente
                novamente para confirmar a entrada.
              </p>
              <Button
                variant="outline"
                type="button"
                disabled={ocupado}
                onClick={tentarProdutos}
              >
                Tentar novamente
              </Button>
            </div>
          ) : !produtos.length ? (
            <p role="status">
              Nenhum produto elegível para o estoque. Cadastre um produto ativo
              em litros (L), sem rastreamento de partidas.
            </p>
          ) : null}
          <Button
            variant="outline"
            type="button"
            disabled={
              ocupado ||
              alterado ||
              estadoProdutos !== "pronto" ||
              !produtos.some((p) => p.id === produto) ||
              motivo.trim().length < 5
            }
            onClick={() => void confirmar()}
          >
            Confirmar entrada no estoque
          </Button>
          <p>
            Informe o motivo da declaração acima. Salve alterações antes de
            confirmar.
          </p>
        </div>
      )}
      {erro && (
        <p role="alert" className="leite-erro">
          {erro}
        </p>
      )}
    </article>
  );
}
export function OrdenhasGerais({
  podeLancar,
  acoesContainer,
}: {
  podeLancar: boolean;
  acoesContainer?: HTMLElement | null;
}) {
  const sitio = getPropriedadeAtiva();
  const [data, setData] = useState(() => {
    const p = new URLSearchParams(location.search).get("dataOperacional");
    return dataValida(p) ? p : hojeOperacional();
  });
  const [posicao, setPosicao] = useState(
    () => new URLSearchParams(location.search).get("ordenha") ?? "",
  );
  const [dados, setDados] = useState<ConsultaOrdenhasGerais | null>(null);
  const [erro, setErro] = useState("");
  const [revisao, setRevisao] = useState(0);
  const [config, setConfig] = useState(false);
  const [gerenciarTanques, setGerenciarTanques] = useState(false);
  const [tanquesEscolhidos, setTanquesEscolhidos] = useState<Record<string, string>>({});
  const [editarTanque, setEditarTanque] = useState<
    TanqueLeite | null | undefined
  >();
  const [consultaProdutos, setConsultaProdutos] = useState<{
    sitio: number | null;
    estado: EstadoProdutos;
    produtos: ProdutoDTO[];
  }>({ sitio, estado: "carregando", produtos: [] });
  const [revisaoProdutos, setRevisaoProdutos] = useState(0);
  const estadoProdutos =
    consultaProdutos.sitio === sitio ? consultaProdutos.estado : "carregando";
  const produtos = consultaProdutos.sitio === sitio ? consultaProdutos.produtos : [];
  useEffect(() => {
    setDados(null);
  }, [sitio, data]);
  useEffect(() => {
    let ativo = true;
    setErro("");
    if (sitio == null) return;
    void consultarLeite<ConsultaOrdenhasGerais>(
      `/geral?dataOperacional=${data}`,
      sitio,
    )
      .then((r) => {
        if (ativo) setDados(r);
      })
      .catch((e) => {
        if (ativo) setErro(e.message);
      });
    return () => {
      ativo = false;
    };
  }, [sitio, data, revisao]);
  useEffect(() => {
    let ativo = true;
    if (sitio == null) return;
    setConsultaProdutos((anterior) => ({
      sitio,
      estado: "carregando",
      produtos: anterior.sitio === sitio ? anterior.produtos : [],
    }));
    void listarProdutos({ ativo: true }, sitio)
      .then((r) => {
        if (ativo)
          setConsultaProdutos({
            sitio,
            estado: "pronto",
            produtos: r.filter(
              (p) => p.ativo !== false && p.unidade === "L" && !p.rastrearPartidas,
            ),
          });
      })
      .catch(() => {
        if (ativo)
          setConsultaProdutos((anterior) => ({ ...anterior, estado: "erro" }));
      });
    return () => {
      ativo = false;
    };
  }, [sitio, revisaoProdutos]);
  useEffect(() => {
    const atualizar = () => {
      const q = new URLSearchParams(location.search);
      const d = q.get("dataOperacional");
      setData(dataValida(d) ? d : hojeOperacional());
      setPosicao(q.get("ordenha") ?? "");
    };
    window.addEventListener("popstate", atualizar);
    return () => window.removeEventListener("popstate", atualizar);
  }, []);
  function navegar(dia: string, ordenha: string) {
    setData(dia);
    setPosicao(ordenha);
    const url = new URL(location.href);
    url.searchParams.set("dataOperacional", dia);
    if (ordenha) url.searchParams.set("ordenha", ordenha);
    history.replaceState(null, "", url);
  }
  const sessao =
    dados?.sessoes.find((s) => s.posicaoId === posicao) ?? dados?.sessoes[0];
  const medicoes =
    dados?.medicoes.filter((m) => m.sessaoId === sessao?.id) ?? [];
  // Aferições existentes conservam a versão do tanque, mesmo após outro cadastro.
  const tanques = [...new Map([
    ...(dados?.tanques.filter(t => t.ativo && !medicoes.some(m => m.tanque.identidadeId === t.identidadeId)) ?? []),
    ...medicoes.map(m => m.tanque),
  ].map(t => [t.id, t])).values()];
  const contextoTanque = `${sitio}:${data}:${sessao?.posicaoId ?? ""}`;
  const tanqueSelecionado = tanques.find(t => t.id === tanquesEscolhidos[contextoTanque])
    ?? tanques.find(t => medicoes.some(m => m.tanque.id === t.id)) ?? tanques[0];
  const botao =
    podeLancar && dados ? (
      <Button
        variant="outline"
        type="button"
        className="leite-configurar"
        onClick={() => setConfig(true)}
      >
        <Settings2 size={18} aria-hidden="true" />
        <span>Configurações de produção</span>
      </Button>
    ) : null;
  return (
    <div className="leite-page leite-geral">
      <header className="leite-header">
        <div>
          <h2>Ordenha em foco</h2>
          <p>Escolha o tanque e registre o volume desta ordenha.</p>
        </div>
        <div className="leite-geral-acoes">
          <DatePicker
            aria-label="Data da produção"
            max={hojeOperacional()}
            value={data}
            onChange={(v) => {
              if (dataValida(v)) navegar(v, posicao);
            }}
          />
          {acoesContainer ? createPortal(botao, acoesContainer) : botao}
        </div>
      </header>
      {sitio == null ? (
        <p>Selecione um sítio para registrar a produção.</p>
      ) : erro ? (
        <div role="alert">
          {erro}
          <Button variant="outline" onClick={() => setRevisao((r) => r + 1)}>
            Tentar novamente
          </Button>
        </div>
      ) : !dados ? (
        <p role="status">Carregando ordenhas…</p>
      ) : (
        <>
          <nav className="leite-sessoes" aria-label="Ordenhas do dia">
            {dados.sessoes.map((s, i) => {
              const afericoes = dados.medicoes.filter(
                (m) => m.sessaoId === s.id,
              );
              const Icone =
                i === dados.sessoes.length - 1 && i > 1 ? Moon : Sun;
              return (
                <button
                  key={s.posicaoId}
                  type="button"
                  className={`leite-sessao ${s.posicaoId === sessao?.posicaoId ? "selecionada" : ""}`}
                  aria-label={s.nome}
                  aria-pressed={s.posicaoId === sessao?.posicaoId}
                  onClick={() => navegar(data, s.posicaoId)}
                >
                  <Icone size={22} aria-hidden="true" />
                  <span>
                    <strong>{s.nome}</strong>
                    <small>
                      {afericoes.length
                        ? `${afericoes.length} tanque(s) aferido(s)`
                        : "Aguardando aferição"}
                    </small>
                  </span>
                  <b>
                    {afericoes.length
                      ? formatarLitros(
                          afericoes.reduce((total, m) => total + m.litros, 0),
                        )
                      : "—"}
                  </b>
                </button>
              );
            })}
          </nav>
          <div className="leite-corpo">
            <div className="leite-tanques-area">
              <div className="leite-tanques-titulo">
                <div>
                  <h3>Aferição · {sessao?.nome}</h3>
                  <p>
                    {medicoes.length} {medicoes.length === 1 ? "tanque com aferição salva" : "tanques com aferição salva"}.
                  </p>
                </div>
                {podeLancar && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditarTanque(null)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Cadastrar tanque
                  </Button>
                )}
              </div>
              {dados.configuracao.fonteProducao !== "GERAL" ? (
                <p>
                  Esta data usa medições individuais como fonte da produção.
                  Configure uma nova vigência para iniciar a aferição geral.
                </p>
              ) : (
                sessao && tanqueSelecionado && <>
                  <div className="leite-escolha-tanque">
                    <label>Tanque desta aferição
                      <SelectCampo aria-label="Tanque desta aferição" value={tanqueSelecionado.id} onValueChange={id => setTanquesEscolhidos(anteriores => ({ ...anteriores, [contextoTanque]: id }))}>
                        {tanques.map(t => <option key={t.id} value={t.id}>{t.nome} · {formatarLitros(t.capacidadeLitros)}{medicoes.some(m => m.tanque.id === t.id) ? " · aferição salva" : ""}</option>)}
                      </SelectCampo>
                    </label>
                    <p>Registre somente os tanques utilizados. Trocar a seleção preserva os rascunhos e as aferições desta ordenha.</p>
                  </div>
                  <AfericaoTanque
                    key={`${sitio}:${data}:${sessao.posicaoId}:${tanqueSelecionado.id}:${medicoes.find(m => m.tanque.id === tanqueSelecionado.id)?.versao ?? 0}:${medicoes.find(m => m.tanque.id === tanqueSelecionado.id)?.entradaId ?? ""}`}
                    tanque={tanqueSelecionado}
                    medicao={medicoes.find(m => m.tanque.id === tanqueSelecionado.id)}
                    sitio={sitio} data={data} posicao={sessao.posicaoId}
                    animais={dados.animais} origensAutomaticas={dados.origensAutomaticas ?? []}
                    produtos={produtos} estadoProdutos={estadoProdutos}
                    tentarProdutos={() => setRevisaoProdutos(r => r + 1)}
                    podeLancar={podeLancar}
                    aoSalvar={() => setRevisao(r => r + 1)}
                  />
                </>
              )}

              {!tanques.length && (
                <p>
                  Cadastre os tanques para começar. As tabelas de conversão são
                  específicas de cada tanque.
                </p>
              )}
            </div>
            <aside
              className="leite-resumos"
              aria-label="Resumo da produção geral"
            >
              <section className="leite-resumo">
                <h3>Produção do dia</h3>
                <dl className="leite-geral-parciais">
                  {dados.sessoes.map((s) => {
                    const itens = dados.medicoes.filter(
                      (m) => m.sessaoId === s.id,
                    );
                    return (
                      <div key={s.id}>
                        <dt>{s.nome}</dt>
                        <dd>
                          {itens.length
                            ? formatarLitros(
                                itens.reduce((v, m) => v + m.litros, 0),
                              )
                            : "Não aferida"}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <div className="leite-geral-total">
                  <span>Total registrado</span>
                  <strong>
                    {dados.medicoes.length
                      ? formatarLitros(
                          dados.medicoes.reduce((v, m) => v + m.litros, 0),
                        )
                      : "—"}
                  </strong>
                </div>
                <p className="leite-ajuste-ajuda">
                  Somente aferições salvas. Rascunhos não entram no total.
                  Ausência de aferição não significa zero.
                </p>
              </section>
              <section className="leite-resumo">
                <h3>Controle individual</h3>
                <p>
                  A cada {dados.configuracao.intervaloIndividualQuantidade ?? 1}{" "}
                  {dados.configuracao.intervaloIndividualUnidade === "DIAS"
                    ? "dia(s)"
                    : "mês(es)"}
                  .
                </p>
                <p className="leite-ajuste-ajuda">
                  As medições por animal continuam disponíveis no controle
                  individual.
                </p>
              </section>
              {podeLancar && (
                <section className="leite-resumo leite-tanques-config">
                  <h3>Tanques cadastrados</h3>
                  <p>Escolha o utilizado em cada ordenha. Os demais não são aferições obrigatórias.</p>
                  <Button type="button" variant="outline" onClick={() => setGerenciarTanques(true)}><Settings2 size={18} aria-hidden="true" />Gerenciar tanques</Button>
                </section>
              )}
            </aside>
          </div>
          {config && (
            <ConfiguracoesOrdenha
              configuracao={dados.configuracao}
              data={data}
              aoFechar={() => setConfig(false)}
              aoSalvar={() => {
                setConfig(false);
                setRevisao((r) => r + 1);
              }}
            />
          )}
          {gerenciarTanques && <PainelCadastro compacto aberto titulo="Configuração dos tanques" icon={Cylinder} onFechar={() => setGerenciarTanques(false)} rodape={<><Button variant="outline" onClick={() => setGerenciarTanques(false)}>Fechar</Button><Button onClick={() => { setGerenciarTanques(false); setEditarTanque(null); }}>Cadastrar tanque</Button></>}>
            <div className="leite-tanques-catalogo">{dados.tanques.map(t => <section key={t.id}>
              <h3>{t.nome}</h3><p>{formatarLitros(t.capacidadeLitros)} · Versão {t.versao} · {t.ativo ? "Ativo" : "Inativo"}</p>
              <p>{[t.fabricante, t.modelo, t.numeroSerie && `Série ${t.numeroSerie}`].filter(Boolean).join(" · ") || "Especificações adicionais não informadas"}</p>
              <Button variant="outline" aria-label={`Nova versão de ${t.nome}`} onClick={() => { setGerenciarTanques(false); setEditarTanque(t); }}>Editar especificações</Button>
            </section>)}</div>
          </PainelCadastro>}
          {editarTanque !== undefined && (
            <ConfiguracaoTanques
              sitio={sitio}
              data={data}
              tanque={editarTanque ?? undefined}
              aoFechar={() => setEditarTanque(undefined)}
              aoSalvar={() => {
                setEditarTanque(undefined);
                setRevisao((r) => r + 1);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
