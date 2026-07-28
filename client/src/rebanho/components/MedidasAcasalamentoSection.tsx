import { useCallback, useEffect, useState } from "react";
import {
  atualizarCombinacaoMedida,
  atualizarMedidaAcasalamento,
  criarCombinacaoMedida,
  criarMedidaAcasalamento,
  excluirCombinacaoMedida,
  excluirMedidaAcasalamento,
  listarCombinacoesMedida,
  listarIndicadores,
  listarMedidasAcasalamento,
  type CombinacaoMedidaDTO,
  type CombinacaoMedidaInput,
  type IndicadorGeneticoDTO,
  type MedidaAcasalamentoDTO,
  type MedidaAcasalamentoInput,
  type TipoMedidaAcasalamento,
} from "../api";
import { Loader } from "../../components/Loading";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { RebModal } from "@/components/rb/RebModal";
import { RebAnm, RebBox, RebEmpty, RebPill, REB_CHIPS, REB_CHIP_Q } from "@/components/rb/RebPrimitives";
import { RebTable } from "@/components/rb/RebTable";

export function percentualParaCoeficiente(percentual: number | null): number | null {
  return percentual == null ? null : percentual / 100;
}

export function coeficienteParaPercentual(coeficiente: number | null): number | null {
  return coeficiente == null ? null : coeficiente * 100;
}

type Aba = "medidas" | "combinacoes";
type ItemMedidaForm = { indicadorId: string; peso: string; minimo: string; maximo: string };
type MedidaForm = {
  nome: string;
  tipo: TipoMedidaAcasalamento;
  consanguinidadePercentual: string;
  exigePedigree: boolean;
  ativo: boolean;
  itens: ItemMedidaForm[];
};
type ItemCombinacaoForm = { medidaId: string; peso: string; obrigatoria: boolean; ordem: string };
type CombinacaoForm = { nome: string; ativo: boolean; itens: ItemCombinacaoForm[] };
type Exclusao = { tipo: "medida"; entidade: MedidaAcasalamentoDTO } | { tipo: "combinacao"; entidade: CombinacaoMedidaDTO };

const TIPOS: { value: TipoMedidaAcasalamento; label: string }[] = [
  { value: "MERITO", label: "Mérito genético" },
  { value: "RESTRICAO_INDICADOR", label: "Restrição por indicador" },
  { value: "CONSANGUINIDADE", label: "Consanguinidade" },
  { value: "PEDIGREE", label: "Pedigree" },
  { value: "SEMEN", label: "Disponibilidade de sêmen" },
];
const TIPO_LABEL = Object.fromEntries(TIPOS.map((tipo) => [tipo.value, tipo.label])) as Record<TipoMedidaAcasalamento, string>;
const ITEM_MEDIDA_VAZIO: ItemMedidaForm = { indicadorId: "", peso: "1", minimo: "", maximo: "" };
const ITEM_COMBINACAO_VAZIO: ItemCombinacaoForm = { medidaId: "", peso: "1", obrigatoria: false, ordem: "0" };
const MEDIDA_VAZIA: MedidaForm = {
  nome: "",
  tipo: "MERITO",
  consanguinidadePercentual: "",
  exigePedigree: false,
  ativo: true,
  itens: [{ ...ITEM_MEDIDA_VAZIO }],
};
const COMBINACAO_VAZIA: CombinacaoForm = {
  nome: "",
  ativo: true,
  itens: [{ ...ITEM_COMBINACAO_VAZIO }],
};

function numeroOpcional(valor: string): number | null {
  return valor.trim() === "" ? null : Number(valor);
}

function formDaMedida(medida: MedidaAcasalamentoDTO): MedidaForm {
  return {
    nome: medida.nome,
    tipo: medida.tipo,
    consanguinidadePercentual: coeficienteParaPercentual(medida.consanguinidadeMax)?.toString() ?? "",
    exigePedigree: medida.exigePedigree,
    ativo: medida.ativo,
    itens: medida.itens.map((item) => ({
      indicadorId: String(item.indicadorId),
      peso: String(item.peso),
      minimo: item.minimo?.toString() ?? "",
      maximo: item.maximo?.toString() ?? "",
    })),
  };
}

function formDaCombinacao(combinacao: CombinacaoMedidaDTO): CombinacaoForm {
  return {
    nome: combinacao.nome,
    ativo: combinacao.ativo,
    itens: combinacao.itens.map((item) => ({
      medidaId: String(item.medidaId),
      peso: String(item.peso),
      obrigatoria: item.obrigatoria,
      ordem: String(item.ordem),
    })),
  };
}

function resumoMedida(medida: MedidaAcasalamentoDTO): string {
  if (medida.tipo === "CONSANGUINIDADE") {
    const percentual = coeficienteParaPercentual(medida.consanguinidadeMax);
    return percentual == null ? "Sem limite" : `Até ${percentual}%`;
  }
  if (medida.tipo === "PEDIGREE") return medida.exigePedigree ? "Pedigree obrigatório" : "Pedigree opcional";
  if (medida.tipo === "SEMEN") return "Exige sêmen disponível";
  if (medida.itens.length === 0) return "Sem indicadores";
  return medida.itens.map((item) => `${item.indicadorSigla} × ${item.peso}`).join(" · ");
}

function mensagemErro(erro: unknown, fallback: string): string {
  return erro instanceof Error ? erro.message : fallback;
}

export function MedidasAcasalamentoSection() {
  const [aba, setAba] = useState<Aba>("medidas");
  const [indicadores, setIndicadores] = useState<IndicadorGeneticoDTO[]>([]);
  const [medidas, setMedidas] = useState<MedidaAcasalamentoDTO[]>([]);
  const [combinacoes, setCombinacoes] = useState<CombinacaoMedidaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editorMedida, setEditorMedida] = useState<MedidaAcasalamentoDTO | "nova" | null>(null);
  const [formMedida, setFormMedida] = useState<MedidaForm>(MEDIDA_VAZIA);
  const [editorCombinacao, setEditorCombinacao] = useState<CombinacaoMedidaDTO | "nova" | null>(null);
  const [formCombinacao, setFormCombinacao] = useState<CombinacaoForm>(COMBINACAO_VAZIA);
  const [exclusao, setExclusao] = useState<Exclusao | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [novosIndicadores, novasMedidas, novasCombinacoes] = await Promise.all([
        listarIndicadores(),
        listarMedidasAcasalamento(true),
        listarCombinacoesMedida(true),
      ]);
      setIndicadores(novosIndicadores.filter((indicador) => indicador.ativo));
      setMedidas(novasMedidas);
      setCombinacoes(novasCombinacoes);
    } catch (falha) {
      setErro(mensagemErro(falha, "Não foi possível carregar medidas e combinações."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  function abrirNovaMedida() {
    setFormMedida({ ...MEDIDA_VAZIA, itens: [{ ...ITEM_MEDIDA_VAZIO }] });
    setErro(null);
    setEditorMedida("nova");
  }

  function abrirEdicaoMedida(medida: MedidaAcasalamentoDTO) {
    setFormMedida(formDaMedida(medida));
    setErro(null);
    setEditorMedida(medida);
  }

  function fecharEditorMedida() {
    if (salvando) return;
    setEditorMedida(null);
    setErro(null);
  }

  function mudarTipoMedida(tipo: TipoMedidaAcasalamento) {
    const usaIndicadores = tipo === "MERITO" || tipo === "RESTRICAO_INDICADOR";
    setFormMedida((atual) => ({
      ...atual,
      tipo,
      consanguinidadePercentual: tipo === "CONSANGUINIDADE" ? atual.consanguinidadePercentual : "",
      exigePedigree: tipo === "PEDIGREE",
      itens: usaIndicadores ? (atual.itens.length > 0 ? atual.itens : [{ ...ITEM_MEDIDA_VAZIO }]) : [],
    }));
  }

  function atualizarItemMedida(indice: number, patch: Partial<ItemMedidaForm>) {
    setFormMedida((atual) => ({
      ...atual,
      itens: atual.itens.map((item, posicao) => posicao === indice ? { ...item, ...patch } : item),
    }));
  }

  function validarMedida(): MedidaAcasalamentoInput | null {
    if (!formMedida.nome.trim()) {
      setErro("Informe o nome da medida.");
      return null;
    }
    const usaIndicadores = formMedida.tipo === "MERITO" || formMedida.tipo === "RESTRICAO_INDICADOR";
    if (usaIndicadores && formMedida.itens.length === 0) {
      setErro("Adicione ao menos um indicador à medida.");
      return null;
    }
    const ids = formMedida.itens.map((item) => Number(item.indicadorId));
    if (usaIndicadores && ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      setErro("Selecione o indicador de cada linha.");
      return null;
    }
    if (new Set(ids).size !== ids.length) {
      setErro("O indicador não pode se repetir na mesma medida.");
      return null;
    }
    const itens = formMedida.itens.map((item) => ({
      indicadorId: Number(item.indicadorId),
      peso: Number(item.peso),
      minimo: numeroOpcional(item.minimo),
      maximo: numeroOpcional(item.maximo),
    }));
    if (itens.some((item) => !Number.isFinite(item.peso) || item.peso <= 0)) {
      setErro("Informe um peso maior que zero para cada indicador.");
      return null;
    }
    if (itens.some((item) => (item.minimo != null && !Number.isFinite(item.minimo)) || (item.maximo != null && !Number.isFinite(item.maximo)))) {
      setErro("Informe limites numéricos válidos.");
      return null;
    }
    if (itens.some((item) => item.minimo != null && item.maximo != null && item.minimo > item.maximo)) {
      setErro("O mínimo não pode ser maior que o máximo.");
      return null;
    }
    let consanguinidadeMax: number | null = null;
    if (formMedida.tipo === "CONSANGUINIDADE") {
      const percentual = numeroOpcional(formMedida.consanguinidadePercentual);
      if (percentual == null || !Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
        setErro("Informe o limite de consanguinidade entre 0% e 100%.");
        return null;
      }
      consanguinidadeMax = percentualParaCoeficiente(percentual);
    }
    return {
      nome: formMedida.nome.trim(),
      tipo: formMedida.tipo,
      consanguinidadeMax,
      exigePedigree: formMedida.tipo === "PEDIGREE",
      ativo: formMedida.ativo,
      itens: usaIndicadores ? itens : [],
    };
  }

  async function salvarMedida(evento: React.FormEvent) {
    evento.preventDefault();
    const payload = validarMedida();
    if (!payload) return;
    setSalvando(true);
    setErro(null);
    try {
      if (editorMedida === "nova") await criarMedidaAcasalamento(payload);
      else if (editorMedida) await atualizarMedidaAcasalamento(editorMedida.id, payload);
      setEditorMedida(null);
      await carregar();
    } catch (falha) {
      setErro(mensagemErro(falha, "Não foi possível salvar a medida."));
    } finally {
      setSalvando(false);
    }
  }

  function abrirNovaCombinacao() {
    setFormCombinacao({ ...COMBINACAO_VAZIA, itens: [{ ...ITEM_COMBINACAO_VAZIO }] });
    setErro(null);
    setEditorCombinacao("nova");
  }

  function abrirEdicaoCombinacao(combinacao: CombinacaoMedidaDTO) {
    setFormCombinacao(formDaCombinacao(combinacao));
    setErro(null);
    setEditorCombinacao(combinacao);
  }

  function fecharEditorCombinacao() {
    if (salvando) return;
    setEditorCombinacao(null);
    setErro(null);
  }

  function atualizarItemCombinacao(indice: number, patch: Partial<ItemCombinacaoForm>) {
    setFormCombinacao((atual) => ({
      ...atual,
      itens: atual.itens.map((item, posicao) => posicao === indice ? { ...item, ...patch } : item),
    }));
  }

  function validarCombinacao(): CombinacaoMedidaInput | null {
    if (!formCombinacao.nome.trim()) {
      setErro("Informe o nome da combinação.");
      return null;
    }
    if (formCombinacao.itens.length === 0) {
      setErro("Adicione ao menos uma medida à combinação.");
      return null;
    }
    const ids = formCombinacao.itens.map((item) => Number(item.medidaId));
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      setErro("Selecione a medida de cada linha.");
      return null;
    }
    if (new Set(ids).size !== ids.length) {
      setErro("A medida não pode se repetir na mesma combinação.");
      return null;
    }
    const itens = formCombinacao.itens.map((item) => ({
      medidaId: Number(item.medidaId),
      peso: Number(item.peso),
      obrigatoria: item.obrigatoria,
      ordem: Number(item.ordem),
    }));
    if (itens.some((item) => !Number.isFinite(item.peso) || item.peso <= 0)) {
      setErro("Informe um peso maior que zero para cada medida.");
      return null;
    }
    if (itens.some((item) => !Number.isInteger(item.ordem) || item.ordem < 0)) {
      setErro("Informe uma ordem inteira igual ou maior que zero.");
      return null;
    }
    return { nome: formCombinacao.nome.trim(), ativo: formCombinacao.ativo, itens };
  }

  async function salvarCombinacao(evento: React.FormEvent) {
    evento.preventDefault();
    const payload = validarCombinacao();
    if (!payload) return;
    setSalvando(true);
    setErro(null);
    try {
      if (editorCombinacao === "nova") await criarCombinacaoMedida(payload);
      else if (editorCombinacao) await atualizarCombinacaoMedida(editorCombinacao.id, payload);
      setEditorCombinacao(null);
      await carregar();
    } catch (falha) {
      setErro(mensagemErro(falha, "Não foi possível salvar a combinação."));
    } finally {
      setSalvando(false);
    }
  }

  async function alternarMedida(medida: MedidaAcasalamentoDTO) {
    setSalvando(true);
    setErro(null);
    try {
      await atualizarMedidaAcasalamento(medida.id, { ativo: !medida.ativo });
      await carregar();
    } catch (falha) {
      setErro(mensagemErro(falha, "Não foi possível alterar a situação da medida."));
    } finally {
      setSalvando(false);
    }
  }

  async function alternarCombinacao(combinacao: CombinacaoMedidaDTO) {
    setSalvando(true);
    setErro(null);
    try {
      await atualizarCombinacaoMedida(combinacao.id, { ativo: !combinacao.ativo });
      await carregar();
    } catch (falha) {
      setErro(mensagemErro(falha, "Não foi possível alterar a situação da combinação."));
    } finally {
      setSalvando(false);
    }
  }

  function abrirExclusao(proximaExclusao: Exclusao) {
    setErro(null);
    setExclusao(proximaExclusao);
  }

  function fecharExclusao() {
    if (salvando) return;
    setExclusao(null);
    setErro(null);
  }

  async function confirmarExclusao() {
    if (!exclusao) return;
    setSalvando(true);
    setErro(null);
    try {
      if (exclusao.tipo === "medida") await excluirMedidaAcasalamento(exclusao.entidade.id);
      else await excluirCombinacaoMedida(exclusao.entidade.id);
      setExclusao(null);
      await carregar();
    } catch (falha) {
      setErro(mensagemErro(falha, `Não foi possível excluir ${exclusao.tipo === "medida" ? "a medida" : "a combinação"}.`));
    } finally {
      setSalvando(false);
    }
  }

  const editorAberto = editorMedida != null || editorCombinacao != null;
  const erroVisivel = erro && (!loading || editorAberto || exclusao != null);

  return (
    <section aria-labelledby="titulo-medidas-acasalamento">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h3 id="titulo-medidas-acasalamento" className="m-0 font-serif text-lg font-medium">Medidas e combinações de acasalamento</h3>
            <RebPill tone="warn">Cadastro compartilhado</RebPill>
          </div>
          <p className="m-0 text-sm text-ink-3">Configure critérios reutilizáveis de mérito, restrição, pedigree, consanguinidade e sêmen.</p>
        </div>
      </div>

      <div className={REB_CHIPS} role="group" aria-label="Cadastros de acasalamento" style={{ marginBottom: 16 }}>
        <button className={REB_CHIP_Q} onClick={() => setAba("medidas")} aria-pressed={aba === "medidas"} style={aba === "medidas" ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>Medidas</button>
        <button className={REB_CHIP_Q} onClick={() => setAba("combinacoes")} aria-pressed={aba === "combinacoes"} style={aba === "combinacoes" ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>Combinações</button>
      </div>

      {erroVisivel && !editorAberto && !exclusao && (
        <RebBox role="alert">
          <p className="mb-3 mt-0 text-sm text-prejuizo">Erro: {erro}</p>
          <RebButton onClick={() => void carregar()}>Tentar carregar novamente</RebButton>
        </RebBox>
      )}

      {loading ? <Loader /> : !erroVisivel && aba === "medidas" ? (
        <MedidasLista
          medidas={medidas}
          salvando={salvando}
          onNova={abrirNovaMedida}
          onEditar={abrirEdicaoMedida}
          onAlternar={(medida) => void alternarMedida(medida)}
          onExcluir={(medida) => abrirExclusao({ tipo: "medida", entidade: medida })}
        />
      ) : !erroVisivel && aba === "combinacoes" ? (
        <CombinacoesLista
          combinacoes={combinacoes}
          salvando={salvando}
          onNova={abrirNovaCombinacao}
          onEditar={abrirEdicaoCombinacao}
          onAlternar={(combinacao) => void alternarCombinacao(combinacao)}
          onExcluir={(combinacao) => abrirExclusao({ tipo: "combinacao", entidade: combinacao })}
        />
      ) : null}

      {editorMedida && (
        <RebModal
          title={editorMedida === "nova" ? "Nova medida de acasalamento" : `Editar medida ${editorMedida.nome}`}
          onClose={fecharEditorMedida}
          className="max-w-[860px]"
          actions={(
            <>
              <RebButton onClick={fecharEditorMedida} disabled={salvando}>Cancelar</RebButton>
              <RebButton variant="pri" type="submit" form="form-medida-acasalamento" disabled={salvando}>{salvando ? "Salvando…" : "Salvar medida"}</RebButton>
            </>
          )}
        >
          <form id="form-medida-acasalamento" aria-label="Cadastro de medida" onSubmit={salvarMedida}>
            <div className="grid grid-cols-2 gap-x-4 max-[620px]:grid-cols-1">
              <RebField label="Nome da medida">
                <input value={formMedida.nome} onChange={(e) => setFormMedida((atual) => ({ ...atual, nome: e.target.value }))} maxLength={120} required />
              </RebField>
              <RebField label="Tipo de medida">
                <select value={formMedida.tipo} onChange={(e) => mudarTipoMedida(e.target.value as TipoMedidaAcasalamento)}>
                  {TIPOS.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
                </select>
              </RebField>
            </div>

            {formMedida.tipo === "CONSANGUINIDADE" && (
              <RebField label="Limite de consanguinidade (%)" className="max-w-[320px]">
                <input type="number" min="0" max="100" step="0.01" value={formMedida.consanguinidadePercentual} onChange={(e) => setFormMedida((atual) => ({ ...atual, consanguinidadePercentual: e.target.value }))} required />
              </RebField>
            )}

            {formMedida.tipo === "PEDIGREE" && (
              <label className="mb-4 flex min-h-6 cursor-not-allowed items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" checked disabled />
                Exigir pedigree verificável
              </label>
            )}

            {(formMedida.tipo === "MERITO" || formMedida.tipo === "RESTRICAO_INDICADOR") && (
              <RebBox>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="mb-0!">Indicadores da medida</h4>
                  <RebButton onClick={() => setFormMedida((atual) => ({ ...atual, itens: [...atual.itens, { ...ITEM_MEDIDA_VAZIO }] }))}>Adicionar indicador</RebButton>
                </div>
                <div className="grid gap-3">
                  {formMedida.itens.map((item, indice) => (
                    <div key={indice} className="grid grid-cols-[minmax(150px,2fr)_repeat(3,minmax(90px,1fr))_auto] items-end gap-x-3 max-[760px]:grid-cols-2">
                      <RebField label={`Indicador ${indice + 1}`}>
                        <select value={item.indicadorId} onChange={(e) => atualizarItemMedida(indice, { indicadorId: e.target.value })} required>
                          <option value="">Selecione</option>
                          {indicadores.map((indicador) => <option key={indicador.id} value={indicador.id}>{indicador.sigla} · {indicador.nome}</option>)}
                        </select>
                      </RebField>
                      <RebField label={`Peso ${indice + 1}`}>
                        <input type="number" min="0.0001" step="any" value={item.peso} onChange={(e) => atualizarItemMedida(indice, { peso: e.target.value })} required />
                      </RebField>
                      <RebField label={`Mínimo ${indice + 1}`}>
                        <input type="number" step="any" value={item.minimo} onChange={(e) => atualizarItemMedida(indice, { minimo: e.target.value })} />
                      </RebField>
                      <RebField label={`Máximo ${indice + 1}`}>
                        <input type="number" step="any" value={item.maximo} onChange={(e) => atualizarItemMedida(indice, { maximo: e.target.value })} />
                      </RebField>
                      <RebButton aria-label={`Remover indicador ${indice + 1}`} onClick={() => setFormMedida((atual) => ({ ...atual, itens: atual.itens.filter((_, posicao) => posicao !== indice) }))}>Remover</RebButton>
                    </div>
                  ))}
                </div>
              </RebBox>
            )}

            <label className="flex min-h-6 cursor-pointer items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" checked={formMedida.ativo} onChange={(e) => setFormMedida((atual) => ({ ...atual, ativo: e.target.checked }))} />
              Medida ativa
            </label>
            {erro && <p role="alert" className="mb-0 mt-3 text-sm text-prejuizo">Erro: {erro}</p>}
          </form>
        </RebModal>
      )}

      {editorCombinacao && (
        <RebModal
          title={editorCombinacao === "nova" ? "Nova combinação de medidas" : `Editar combinação ${editorCombinacao.nome}`}
          onClose={fecharEditorCombinacao}
          className="max-w-[820px]"
          actions={(
            <>
              <RebButton onClick={fecharEditorCombinacao} disabled={salvando}>Cancelar</RebButton>
              <RebButton variant="pri" type="submit" form="form-combinacao-medidas" disabled={salvando}>{salvando ? "Salvando…" : "Salvar combinação"}</RebButton>
            </>
          )}
        >
          <form id="form-combinacao-medidas" aria-label="Cadastro de combinação" onSubmit={salvarCombinacao}>
            <RebField label="Nome da combinação">
              <input value={formCombinacao.nome} onChange={(e) => setFormCombinacao((atual) => ({ ...atual, nome: e.target.value }))} maxLength={120} required />
            </RebField>
            <RebBox>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="mb-0!">Medidas combinadas</h4>
                <RebButton onClick={() => setFormCombinacao((atual) => ({ ...atual, itens: [...atual.itens, { ...ITEM_COMBINACAO_VAZIO, ordem: String(atual.itens.length) }] }))}>Adicionar medida</RebButton>
              </div>
              <div className="grid gap-3">
                {formCombinacao.itens.map((item, indice) => (
                  <div key={indice} className="grid grid-cols-[minmax(170px,2fr)_minmax(90px,1fr)_minmax(80px,1fr)_auto_auto] items-end gap-x-3 max-[700px]:grid-cols-2">
                    <RebField label={`Medida ${indice + 1}`}>
                      <select value={item.medidaId} onChange={(e) => atualizarItemCombinacao(indice, { medidaId: e.target.value })} required>
                        <option value="">Selecione</option>
                        {medidas.map((medida) => <option key={medida.id} value={medida.id}>{medida.nome}{medida.ativo ? "" : " · inativa"}</option>)}
                      </select>
                    </RebField>
                    <RebField label={`Peso da medida ${indice + 1}`}>
                      <input type="number" min="0.0001" step="any" value={item.peso} onChange={(e) => atualizarItemCombinacao(indice, { peso: e.target.value })} required />
                    </RebField>
                    <RebField label={`Ordem ${indice + 1}`}>
                      <input type="number" min="0" step="1" value={item.ordem} onChange={(e) => atualizarItemCombinacao(indice, { ordem: e.target.value })} required />
                    </RebField>
                    <label className="mb-3.5 flex min-h-6 cursor-pointer items-center gap-2 text-sm text-ink-2">
                      <input type="checkbox" aria-label={`Obrigatória ${indice + 1}`} checked={item.obrigatoria} onChange={(e) => atualizarItemCombinacao(indice, { obrigatoria: e.target.checked })} />
                      Obrigatória
                    </label>
                    <RebButton aria-label={`Remover medida ${indice + 1}`} onClick={() => setFormCombinacao((atual) => ({ ...atual, itens: atual.itens.filter((_, posicao) => posicao !== indice) }))}>Remover</RebButton>
                  </div>
                ))}
              </div>
            </RebBox>
            <label className="flex min-h-6 cursor-pointer items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" checked={formCombinacao.ativo} onChange={(e) => setFormCombinacao((atual) => ({ ...atual, ativo: e.target.checked }))} />
              Combinação ativa
            </label>
            {erro && <p role="alert" className="mb-0 mt-3 text-sm text-prejuizo">Erro: {erro}</p>}
          </form>
        </RebModal>
      )}

      {exclusao && (
        <RebModal
          title={`Excluir ${exclusao.tipo}?`}
          onClose={fecharExclusao}
          className="max-w-[460px]"
          actions={(
            <>
              <RebButton onClick={fecharExclusao} disabled={salvando}>Cancelar</RebButton>
              <RebButton variant="danger" onClick={() => void confirmarExclusao()} disabled={salvando} aria-label={`Confirmar exclusão de ${exclusao.entidade.nome}`}>{salvando ? "Excluindo…" : `Excluir ${exclusao.tipo}`}</RebButton>
            </>
          )}
        >
          <p className="m-0 text-sm text-ink-2">Confirme a exclusão de <strong>{exclusao.entidade.nome}</strong>. Se houver histórico vinculado, o cadastro poderá apenas ser desativado.</p>
          {erro && <p role="alert" className="mb-0 mt-3 text-sm text-prejuizo">Erro: {erro}</p>}
        </RebModal>
      )}
    </section>
  );
}

function MedidasLista({
  medidas,
  salvando,
  onNova,
  onEditar,
  onAlternar,
  onExcluir,
}: {
  medidas: MedidaAcasalamentoDTO[];
  salvando: boolean;
  onNova: () => void;
  onEditar: (medida: MedidaAcasalamentoDTO) => void;
  onAlternar: (medida: MedidaAcasalamentoDTO) => void;
  onExcluir: (medida: MedidaAcasalamentoDTO) => void;
}) {
  return (
    <section aria-labelledby="titulo-lista-medidas">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 id="titulo-lista-medidas" className="m-0 font-serif text-base font-medium">Medidas</h4>
        <RebButton variant="pri" onClick={onNova}>+ Nova medida</RebButton>
      </div>
      {medidas.length === 0 ? (
        <RebEmpty>
          <p className="mt-0">Nenhuma medida cadastrada. Comece por um critério que represente a estratégia genética do rebanho.</p>
          <RebButton variant="pri" onClick={onNova}>Cadastrar primeira medida</RebButton>
        </RebEmpty>
      ) : (
        <RebTable>
          <thead><tr><th>Medida</th><th>Tipo</th><th>Resumo</th><th>Estado</th><th>Ações</th></tr></thead>
          <tbody>
            {medidas.map((medida) => (
              <tr key={medida.id}>
                <td><RebAnm>{medida.nome}</RebAnm></td>
                <td><RebPill tone="warn">{TIPO_LABEL[medida.tipo]}</RebPill></td>
                <td>{resumoMedida(medida)}</td>
                <td><RebPill tone={medida.ativo ? "ok" : "bad"}>{medida.ativo ? "Ativa" : "Inativa"}</RebPill></td>
                <td className="whitespace-nowrap text-right">
                  <RebButton aria-label={`Editar medida ${medida.nome}`} onClick={() => onEditar(medida)} disabled={salvando}>Editar</RebButton>{" "}
                  <RebButton aria-label={`${medida.ativo ? "Desativar" : "Ativar"} medida ${medida.nome}`} onClick={() => onAlternar(medida)} disabled={salvando}>{medida.ativo ? "Desativar" : "Ativar"}</RebButton>{" "}
                  <RebButton variant="danger" aria-label={`Excluir medida ${medida.nome}`} onClick={() => onExcluir(medida)} disabled={salvando}>Excluir</RebButton>
                </td>
              </tr>
            ))}
          </tbody>
        </RebTable>
      )}
    </section>
  );
}

function CombinacoesLista({
  combinacoes,
  salvando,
  onNova,
  onEditar,
  onAlternar,
  onExcluir,
}: {
  combinacoes: CombinacaoMedidaDTO[];
  salvando: boolean;
  onNova: () => void;
  onEditar: (combinacao: CombinacaoMedidaDTO) => void;
  onAlternar: (combinacao: CombinacaoMedidaDTO) => void;
  onExcluir: (combinacao: CombinacaoMedidaDTO) => void;
}) {
  return (
    <section aria-labelledby="titulo-lista-combinacoes">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 id="titulo-lista-combinacoes" className="m-0 font-serif text-base font-medium">Combinações</h4>
        <RebButton variant="pri" onClick={onNova}>+ Nova combinação</RebButton>
      </div>
      {combinacoes.length === 0 ? (
        <RebEmpty>
          <p className="mt-0">Nenhuma combinação cadastrada. Agrupe medidas para reutilizar a mesma estratégia nos planos de acasalamento.</p>
          <RebButton variant="pri" onClick={onNova}>Cadastrar primeira combinação</RebButton>
        </RebEmpty>
      ) : (
        <RebTable>
          <thead><tr><th>Combinação</th><th>Medidas</th><th>Estado</th><th>Ações</th></tr></thead>
          <tbody>
            {combinacoes.map((combinacao) => (
              <tr key={combinacao.id}>
                <td><RebAnm>{combinacao.nome}</RebAnm></td>
                <td>{combinacao.itens.length} {combinacao.itens.length === 1 ? "medida" : "medidas"} · {combinacao.itens.filter((item) => item.obrigatoria).length} obrigatórias</td>
                <td><RebPill tone={combinacao.ativo ? "ok" : "bad"}>{combinacao.ativo ? "Ativa" : "Inativa"}</RebPill></td>
                <td className="whitespace-nowrap text-right">
                  <RebButton aria-label={`Editar combinação ${combinacao.nome}`} onClick={() => onEditar(combinacao)} disabled={salvando}>Editar</RebButton>{" "}
                  <RebButton aria-label={`${combinacao.ativo ? "Desativar" : "Ativar"} combinação ${combinacao.nome}`} onClick={() => onAlternar(combinacao)} disabled={salvando}>{combinacao.ativo ? "Desativar" : "Ativar"}</RebButton>{" "}
                  <RebButton variant="danger" aria-label={`Excluir combinação ${combinacao.nome}`} onClick={() => onExcluir(combinacao)} disabled={salvando}>Excluir</RebButton>
                </td>
              </tr>
            ))}
          </tbody>
        </RebTable>
      )}
    </section>
  );
}
