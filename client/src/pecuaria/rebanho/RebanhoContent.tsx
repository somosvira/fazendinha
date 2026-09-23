import { useEffect, useMemo, useState } from "react";
import { RebButton } from "../../components/rb/RebButton";
import { RebField } from "../../components/rb/RebField";
import { RebSelect } from "../../components/rb/RebSelect";
import { RebKpiStrip, RebKpi } from "../../components/rb/RebKpiStrip";
import { RebTable } from "../../components/rb/RebTable";
import { Donut, MiniBarChart } from "../../components/charts";
import { EmptyState } from "../../components/EmptyState";
import { Loader } from "../../components/Loading";
import { useToast } from "../../components/Toast";
import * as api from "./api";
import { RebanhoApiError } from "./api";
import { agruparParaPainel, painelDoServidor } from "./lib/painel";
import { filtrarLocal } from "./lib/filtro";
import { formatarDataBR, formatarIdade, rotuloAptidao, rotuloCategoria, rotuloPapelReprodutivo, rotuloSituacao } from "./lib/rotulos";
import { FormCadastroAnimal } from "./components/FormCadastroAnimal";
import { FichaAnimal } from "./components/FichaAnimal";
import type { AnimalResumo, CadastrarAnimalInput, Catalogos, Categoria, ListarFiltros, PainelServidor } from "./types";
import { CODIGOS_ERRO_AMIGAVEIS } from "./types";

type Visao = "painel" | "animais" | "ficha";

function mensagemErro(erro: unknown): string {
  if (erro instanceof RebanhoApiError) {
    return (erro.code && CODIGOS_ERRO_AMIGAVEIS[erro.code]) || erro.message;
  }
  return "Erro inesperado. Tente novamente.";
}

export function RebanhoContent() {
  const toast = useToast();
  const [visao, setVisao] = useState<Visao>("painel");
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [animais, setAnimais] = useState<AnimalResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [ficha, setFicha] = useState<Awaited<ReturnType<typeof api.buscarFichaAnimal>> | null>(null);
  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [mostrarMovimentarMassa, setMostrarMovimentarMassa] = useState(false);
  const [movPropriedadeId, setMovPropriedadeId] = useState("");
  const [movLoteId, setMovLoteId] = useState("");

  const [filtros, setFiltros] = useState<ListarFiltros>({ situacao: "ATIVO", page: 1, pageSize: 200 });
  const [busca, setBusca] = useState("");
  const [painel, setPainel] = useState<PainelServidor | null>(null);

  async function carregarCatalogos() {
    try {
      setCatalogos(await api.obterCatalogos());
    } catch (erro) {
      toast.error("Não foi possível carregar os catálogos", mensagemErro(erro));
    }
  }

  async function carregarAnimais() {
    setCarregando(true);
    try {
      const resultado = await api.listarAnimais(filtros);
      setAnimais(resultado.itens);
      setTotal(resultado.total);
      setPainel(resultado.painel ?? null);
    } catch (erro) {
      toast.error("Não foi possível carregar os animais", mensagemErro(erro));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarCatalogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregarAnimais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  // Debounce simples: além do filtro local (sobre a página carregada), reenvia a busca
  // ao servidor para alcançar animais fora da página atual.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFiltros((f) => (f.busca === busca ? f : { ...f, busca: busca || undefined }));
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  async function abrirFicha(id: string) {
    setAnimalId(id);
    setVisao("ficha");
    try {
      setFicha(await api.buscarFichaAnimal(id));
    } catch (erro) {
      toast.error("Não foi possível abrir a ficha", mensagemErro(erro));
      setVisao("animais");
    }
  }

  async function recarregarFicha() {
    if (!animalId) return;
    setFicha(await api.buscarFichaAnimal(animalId));
  }

  async function cadastrar(input: CadastrarAnimalInput) {
    setProcessando(true);
    try {
      await api.cadastrarAnimal(input);
      toast.success("Animal cadastrado");
      setMostrarCadastro(false);
      carregarAnimais();
    } catch (erro) {
      toast.error("Não foi possível cadastrar o animal", mensagemErro(erro));
    } finally {
      setProcessando(false);
    }
  }

  const listaFiltradaLocal = useMemo(() => filtrarLocal(animais, busca), [animais, busca]);
  const resumoPainel = useMemo(() => (painel ? painelDoServidor(painel) : agruparParaPainel(animais)), [painel, animais]);

  function alternarSelecao(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function confirmarMovimentacaoMassa() {
    if (!movPropriedadeId || selecionados.size === 0) return;
    setProcessando(true);
    try {
      await api.movimentarAnimais({
        animalIds: Array.from(selecionados),
        propriedadeId: Number(movPropriedadeId),
        loteId: movLoteId || null,
        data: new Date().toISOString().slice(0, 10),
      });
      toast.success(`${selecionados.size} animal(is) movimentado(s)`);
      setSelecionados(new Set());
      setMostrarMovimentarMassa(false);
      carregarAnimais();
    } catch (erro) {
      toast.error("Não foi possível movimentar", mensagemErro(erro));
    } finally {
      setProcessando(false);
    }
  }

  if (visao === "ficha" && animalId) {
    if (!ficha || !catalogos) return <Loader />;
    return (
      <FichaAnimal
        ficha={ficha}
        catalogos={catalogos}
        onVoltar={() => { setVisao("animais"); setAnimalId(null); setFicha(null); carregarAnimais(); }}
        processando={processando}
        onMovimentar={async (input) => {
          setProcessando(true);
          try {
            await api.movimentarAnimais({ animalIds: [ficha.id], ...input });
            toast.success("Animal movimentado");
            recarregarFicha();
          } catch (erro) {
            toast.error("Não foi possível movimentar", mensagemErro(erro));
          } finally { setProcessando(false); }
        }}
        onMudarDestino={async (input) => {
          setProcessando(true);
          try {
            await api.mudarDestinoAnimal(ficha.id, input);
            toast.success("Destino atualizado");
            recarregarFicha();
          } catch (erro) {
            toast.error("Não foi possível mudar o destino", mensagemErro(erro));
          } finally { setProcessando(false); }
        }}
        onSaida={async (input) => {
          setProcessando(true);
          try {
            await api.darSaidaAnimal(ficha.id, input as never);
            toast.success("Saída registrada");
            recarregarFicha();
          } catch (erro) {
            toast.error("Não foi possível registrar a saída", mensagemErro(erro));
          } finally { setProcessando(false); }
        }}
        onEstornarSaida={async (motivo) => {
          setProcessando(true);
          try {
            await api.estornarSaidaAnimal(ficha.id, { motivo });
            toast.success("Saída estornada");
            recarregarFicha();
          } catch (erro) {
            toast.error("Não foi possível estornar a saída", mensagemErro(erro));
          } finally { setProcessando(false); }
        }}
        onRegistrarPesagem={async (input) => {
          setProcessando(true);
          try {
            await api.registrarPesagemAnimal(ficha.id, input as never);
            toast.success("Pesagem registrada");
            recarregarFicha();
          } catch (erro) {
            toast.error("Não foi possível registrar a pesagem", mensagemErro(erro));
          } finally { setProcessando(false); }
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <RebButton variant={visao === "painel" ? "pri" : "default"} onClick={() => setVisao("painel")}>Painel</RebButton>
        <RebButton variant={visao === "animais" ? "pri" : "default"} onClick={() => setVisao("animais")}>Animais</RebButton>
      </div>

      {visao === "painel" && (
        carregando ? <Loader /> : (
          <div>
            <RebKpiStrip cols={4}>
              <RebKpi lab="Total ativos" val={resumoPainel.totalAtivos} />
              <RebKpi lab="% receptoras" val={resumoPainel.pctReceptoras.toFixed(0)} sufixo="%" />
              <RebKpi lab="Sítios" val={resumoPainel.porSitio.length} />
              <RebKpi lab="Categorias" val={resumoPainel.porCategoria.length} />
            </RebKpiStrip>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="mb-2 font-serif text-lg italic text-ink-3">Por categoria</h3>
                <MiniBarChart data={resumoPainel.porCategoria.map((c) => ({ x: c.rotulo, y: c.total }))} color="var(--cafe)" />
              </div>
              <div>
                <h3 className="mb-2 font-serif text-lg italic text-ink-3">Por sítio</h3>
                <Donut
                  segments={resumoPainel.porSitio.map((s, i) => ({
                    value: s.total,
                    color: i % 2 === 0 ? "var(--leite)" : "var(--outros)",
                  }))}
                  label={String(resumoPainel.totalAtivos)}
                />
                <ul className="mt-2 text-sm text-ink-2">
                  {resumoPainel.porSitio.map((s) => (
                    <li key={String(s.propriedadeId)}>{s.nome}: {s.total}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )
      )}

      {visao === "animais" && (
        <div>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <RebField label="Busca">
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Brinco ou nome" />
            </RebField>
            <RebField label="Sítio">
              <RebSelect value={filtros.propriedadeId != null ? String(filtros.propriedadeId) : ""} onChange={(v) => setFiltros((f) => ({ ...f, propriedadeId: v ? Number(v) : undefined }))}>
                <option value="">Todos</option>
                {catalogos?.propriedades.map((p) => <option key={p.id} value={String(p.id)}>{p.apelido ?? p.nome}</option>)}
              </RebSelect>
            </RebField>
            <RebField label="Categoria">
              <RebSelect value={filtros.categoria ?? ""} onChange={(v) => setFiltros((f) => ({ ...f, categoria: (v || undefined) as Categoria | undefined }))}>
                <option value="">Todas</option>
                <option value="BEZERRA">Bezerra</option>
                <option value="NOVILHA">Novilha</option>
                <option value="VACA">Vaca</option>
                <option value="BEZERRO">Bezerro</option>
                <option value="GARROTE">Garrote</option>
                <option value="TOURO">Touro</option>
              </RebSelect>
            </RebField>
            <RebField label="Aptidão">
              <RebSelect value={filtros.aptidao ?? ""} onChange={(v) => setFiltros((f) => ({ ...f, aptidao: (v || undefined) as "LEITE" | "CORTE" | undefined }))}>
                <option value="">Todas</option>
                <option value="LEITE">Leite</option>
                <option value="CORTE">Corte</option>
              </RebSelect>
            </RebField>
            <RebField label="Situação">
              <RebSelect value={filtros.situacao ?? "ATIVO"} onChange={(v) => setFiltros((f) => ({ ...f, situacao: v as "ATIVO" | "SAIU" | "TODOS" }))}>
                <option value="ATIVO">Ativo</option>
                <option value="SAIU">Saiu</option>
                <option value="TODOS">Todos</option>
              </RebSelect>
            </RebField>
            <RebButton variant="pri" onClick={() => setMostrarCadastro(true)}>Cadastrar animal</RebButton>
            {selecionados.size > 0 && (
              <RebButton onClick={() => setMostrarMovimentarMassa(true)}>Movimentar ({selecionados.size})</RebButton>
            )}
          </div>

          {carregando ? <Loader /> : listaFiltradaLocal.length === 0 ? (
            <EmptyState titulo="Nenhum animal encontrado" descricao="Ajuste os filtros ou cadastre um animal." />
          ) : (
            <RebTable>
              <thead>
                <tr>
                  <th></th>
                  <th>Brinco</th>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Idade</th>
                  <th>Sítio</th>
                  <th>Lote</th>
                  <th>Aptidão</th>
                  <th>Papel</th>
                  <th>Situação</th>
                  <th>Último peso</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltradaLocal.map((a) => (
                  <tr key={a.id} className="rb-row">
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selecionados.has(a.id)} onChange={() => alternarSelecao(a.id)} />
                    </td>
                    <td onClick={() => abrirFicha(a.id)}>{a.brinco}</td>
                    <td onClick={() => abrirFicha(a.id)}>{a.nome ?? "—"}</td>
                    <td onClick={() => abrirFicha(a.id)}>{rotuloCategoria(a.categoria)}</td>
                    <td onClick={() => abrirFicha(a.id)}>{formatarIdade(a.idadeMeses)}</td>
                    <td onClick={() => abrirFicha(a.id)}>{a.propriedade?.nome ?? "—"}</td>
                    <td onClick={() => abrirFicha(a.id)}>{a.lote?.nome ?? "—"}</td>
                    <td onClick={() => abrirFicha(a.id)}>{rotuloAptidao(a.aptidao)}</td>
                    <td onClick={() => abrirFicha(a.id)}>{rotuloPapelReprodutivo(a.papelReprodutivo)}</td>
                    <td onClick={() => abrirFicha(a.id)}>{rotuloSituacao(a.situacao)}</td>
                    <td onClick={() => abrirFicha(a.id)}>{a.ultimoPeso ? `${a.ultimoPeso.kg} kg (${formatarDataBR(a.ultimoPeso.data)})` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </RebTable>
          )}
          <p className="mt-2 text-sm text-ink-2">{total} animal(is) no total (servidor) · {listaFiltradaLocal.length} exibido(s)</p>
        </div>
      )}

      {mostrarCadastro && catalogos && (
        <FormCadastroAnimal catalogos={catalogos} salvando={processando} onClose={() => setMostrarCadastro(false)} onSalvar={cadastrar} />
      )}

      {mostrarMovimentarMassa && catalogos && (
        <FormMovimentarMassa
          catalogos={catalogos}
          propriedadeId={movPropriedadeId}
          loteId={movLoteId}
          onPropriedadeId={setMovPropriedadeId}
          onLoteId={setMovLoteId}
          processando={processando}
          onClose={() => setMostrarMovimentarMassa(false)}
          onConfirmar={confirmarMovimentacaoMassa}
        />
      )}
    </div>
  );
}

function FormMovimentarMassa({
  catalogos, propriedadeId, loteId, onPropriedadeId, onLoteId, processando, onClose, onConfirmar,
}: {
  catalogos: Catalogos;
  propriedadeId: string;
  loteId: string;
  onPropriedadeId: (v: string) => void;
  onLoteId: (v: string) => void;
  processando: boolean;
  onClose: () => void;
  onConfirmar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[420px] rounded-xl border border-border bg-card p-6">
        <h3 className="mb-3 font-serif text-lg">Movimentar em massa</h3>
        <RebField label="Sítio">
          <RebSelect value={propriedadeId} onChange={onPropriedadeId}>
            <option value="">Selecione</option>
            {catalogos.propriedades.map((p) => <option key={p.id} value={String(p.id)}>{p.apelido ?? p.nome}</option>)}
          </RebSelect>
        </RebField>
        <RebField label="Lote">
          <RebSelect value={loteId} onChange={onLoteId}>
            <option value="">Sem lote</option>
          </RebSelect>
        </RebField>
        <div className="mt-4 flex justify-end gap-2">
          <RebButton onClick={onClose} disabled={processando}>Cancelar</RebButton>
          <RebButton variant="pri" onClick={onConfirmar} disabled={processando || !propriedadeId}>Confirmar</RebButton>
        </div>
      </div>
    </div>
  );
}
