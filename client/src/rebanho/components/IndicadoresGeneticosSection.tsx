import { useCallback, useEffect, useState } from "react";
import {
  atualizarIndicador,
  criarIndicador,
  excluirIndicador,
  listarIndicadores,
  type ColunaLegadaIndicador,
  type DirecaoIndicadorGenetico,
  type IndicadorGeneticoDTO,
  type IndicadorGeneticoInput,
} from "../api";
import { Loader } from "../../components/Loading";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";
import { RebSelect } from "@/components/rb/RebSelect";
import { RebModal } from "@/components/rb/RebModal";
import { RebAnm, RebEmpty, RebPill } from "@/components/rb/RebPrimitives";
import { RebTable } from "@/components/rb/RebTable";

type FormIndicador = {
  sigla: string;
  nome: string;
  unidade: string;
  direcao: DirecaoIndicadorGenetico;
  colunaLegada: "" | ColunaLegadaIndicador;
  ranking: boolean;
  ativo: boolean;
};

const FORM_VAZIO: FormIndicador = {
  sigla: "",
  nome: "",
  unidade: "",
  direcao: "maior_melhor",
  colunaLegada: "",
  ranking: false,
  ativo: true,
};

const COLUNAS_LEGADAS: { value: ColunaLegadaIndicador; label: string }[] = [
  { value: "ptaLeite", label: "PTA leite" },
  { value: "ptaGordura", label: "PTA gordura" },
  { value: "ptaProteina", label: "PTA proteína" },
  { value: "tpi", label: "TPI" },
];

function formDoIndicador(indicador: IndicadorGeneticoDTO): FormIndicador {
  return {
    sigla: indicador.sigla,
    nome: indicador.nome,
    unidade: indicador.unidade ?? "",
    direcao: indicador.direcao,
    colunaLegada: indicador.colunaLegada ?? "",
    ranking: indicador.ranking,
    ativo: indicador.ativo,
  };
}

function payloadDoForm(form: FormIndicador): IndicadorGeneticoInput {
  return {
    sigla: form.sigla.trim(),
    nome: form.nome.trim(),
    unidade: form.unidade.trim() || null,
    direcao: form.direcao,
    colunaLegada: form.colunaLegada || null,
    ranking: form.ranking,
    ativo: form.ativo,
  };
}

function direcaoLabel(direcao: DirecaoIndicadorGenetico) {
  return direcao === "maior_melhor" ? "Maior é melhor" : "Menor é melhor";
}

export function IndicadoresGeneticosSection() {
  const [indicadores, setIndicadores] = useState<IndicadorGeneticoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<IndicadorGeneticoDTO | "novo" | null>(null);
  const [form, setForm] = useState<FormIndicador>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<IndicadorGeneticoDTO | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setIndicadores(await listarIndicadores());
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível carregar os indicadores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  function abrirNovo() {
    setForm(FORM_VAZIO);
    setErro(null);
    setEditando("novo");
  }

  function abrirEdicao(indicador: IndicadorGeneticoDTO) {
    setForm(formDoIndicador(indicador));
    setErro(null);
    setEditando(indicador);
  }

  function fecharEditor() {
    if (!salvando) setEditando(null);
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!form.sigla.trim() || !form.nome.trim()) {
      setErro("Informe a sigla e o nome do indicador.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const payload = payloadDoForm(form);
      if (editando === "novo") await criarIndicador(payload);
      else if (editando) await atualizarIndicador(editando.id, payload);
      setEditando(null);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar o indicador.");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setSalvando(true);
    setErro(null);
    try {
      await excluirIndicador(excluindo.id);
      setExcluindo(null);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível excluir o indicador.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-indicadores-geneticos">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 id="titulo-indicadores-geneticos" className="m-0 font-serif text-lg font-medium">Indicadores genéticos</h3>
          <p className="mb-0 mt-1 text-sm text-ink-3">Defina os índices usados nas fichas e quais podem ordenar a biblioteca de touros.</p>
        </div>
        <RebButton variant="pri" onClick={abrirNovo}>+ Novo indicador</RebButton>
      </div>

      <div aria-live="polite">
        {erro && !editando && <p className="mt-2 text-sm text-prejuizo">Erro: {erro}</p>}
      </div>

      {loading ? <Loader /> : indicadores.length === 0 ? (
        <RebEmpty>
          Nenhum indicador cadastrado. Cadastre o primeiro índice para registrar valores genéticos e montar rankings de reprodutores.
        </RebEmpty>
      ) : (
        <RebTable>
          <thead>
            <tr><th>Sigla</th><th>Indicador</th><th>Direção</th><th>Espelho atual</th><th>Uso</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {indicadores.map((indicador) => (
              <tr key={indicador.id}>
                <td><RebAnm>{indicador.sigla}</RebAnm></td>
                <td>{indicador.nome}{indicador.unidade ? <small className="ml-1 text-ink-3">({indicador.unidade})</small> : null}</td>
                <td>{direcaoLabel(indicador.direcao)}</td>
                <td>{COLUNAS_LEGADAS.find((item) => item.value === indicador.colunaLegada)?.label ?? "—"}</td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    <RebPill tone={indicador.ativo ? "ok" : "bad"}>{indicador.ativo ? "Ativo" : "Inativo"}</RebPill>
                    {indicador.ranking && <RebPill tone="warn">Disponível no ranking</RebPill>}
                  </div>
                </td>
                <td className="whitespace-nowrap text-right">
                  <RebButton onClick={() => abrirEdicao(indicador)}>Editar</RebButton>{" "}
                  <RebButton variant="danger" onClick={() => setExcluindo(indicador)}>Excluir</RebButton>
                </td>
              </tr>
            ))}
          </tbody>
        </RebTable>
      )}

      {editando && (
        <RebModal
          title={editando === "novo" ? "Novo indicador genético" : `Editar ${editando.sigla}`}
          onClose={fecharEditor}
          actions={(
            <>
              <RebButton onClick={fecharEditor} disabled={salvando}>Cancelar</RebButton>
              <RebButton variant="pri" type="submit" form="form-indicador-genetico" disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar indicador"}
              </RebButton>
            </>
          )}
        >
          <form id="form-indicador-genetico" onSubmit={salvar}>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 max-[560px]:grid-cols-1">
              <RebField label="Sigla">
                <input value={form.sigla} onChange={(e) => setForm((atual) => ({ ...atual, sigla: e.target.value }))} maxLength={40} required />
              </RebField>
              <RebField label="Nome">
                <input value={form.nome} onChange={(e) => setForm((atual) => ({ ...atual, nome: e.target.value }))} maxLength={120} required />
              </RebField>
            </div>
            <div className="grid grid-cols-3 gap-x-4 max-[560px]:grid-cols-1">
              <RebField label="Unidade">
                <input value={form.unidade} onChange={(e) => setForm((atual) => ({ ...atual, unidade: e.target.value }))} placeholder="kg, %, pontos…" />
              </RebField>
              <RebField label="Direção desejável">
                <RebSelect aria-label="Direção desejável" value={form.direcao} onChange={(v) => setForm((atual) => ({ ...atual, direcao: v as DirecaoIndicadorGenetico }))}>
                  <option value="maior_melhor" data-descricao="Na escolha de touros, valor mais alto conta a favor.">Maior é melhor</option>
                  <option value="menor_melhor" data-descricao="Na escolha de touros, valor mais baixo conta a favor.">Menor é melhor</option>
                </RebSelect>
              </RebField>
              <RebField label="Espelhar no índice atual">
                <RebSelect aria-label="Espelhar no índice atual" value={form.colunaLegada} onChange={(v) => setForm((atual) => ({ ...atual, colunaLegada: v as FormIndicador["colunaLegada"] }))}>
                  <option value="" data-descricao="O valor fica guardado só neste indicador.">Nenhum</option>
                  {COLUNAS_LEGADAS.map((item) => <option key={item.value} value={item.value} data-descricao={`O valor também preenche o campo ${item.label} do touro, usado no ranking atual.`}>{item.label}</option>)}
                </RebSelect>
              </RebField>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
              <label className="flex min-h-6 cursor-pointer items-center gap-2">
                <input type="checkbox" checked={form.ranking} onChange={(e) => setForm((atual) => ({ ...atual, ranking: e.target.checked }))} />
                Disponível para ordenar o ranking
              </label>
              <label className="flex min-h-6 cursor-pointer items-center gap-2">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((atual) => ({ ...atual, ativo: e.target.checked }))} />
                Indicador ativo
              </label>
            </div>
            <div aria-live="polite">{erro && <p className="mb-0 mt-3 text-sm text-prejuizo">Erro: {erro}</p>}</div>
          </form>
        </RebModal>
      )}

      {excluindo && (
        <RebModal
          title="Excluir indicador?"
          onClose={() => !salvando && setExcluindo(null)}
          className="max-w-[460px]"
          actions={(
            <>
              <RebButton onClick={() => setExcluindo(null)} disabled={salvando}>Cancelar</RebButton>
              <RebButton variant="danger" onClick={() => void confirmarExclusao()} disabled={salvando}>
                {salvando ? "Excluindo…" : "Excluir indicador"}
              </RebButton>
            </>
          )}
        >
          <p className="m-0 text-sm text-ink-2">
            O indicador <strong>{excluindo.sigla}</strong> será removido. Se já estiver presente em fichas, ele será desativado para preservar o histórico.
          </p>
        </RebModal>
      )}
    </section>
  );
}
