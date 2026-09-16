import { useEffect, useMemo, useRef, useState } from "react";
import { RebButton } from "@/components/rb/RebButton";
import { RebModal } from "@/components/rb/RebModal";
import { RebFieldset } from "@/components/rb/RebPrimitives";
import { RebSelect } from "@/components/rb/RebSelect";
import {
  criarFolhaCampo,
  criarModeloFormularioCampo,
  listarCamposFormulario,
  listarModelosFormularioCampo,
  type CampoFormularioCampoDTO,
  type ChaveColunaSistemaFormulario,
  type ConfigFormularioCampo,
  type FiltrosRelatorioRebanho,
  type FolhaCampoDTO,
  type ModeloFormularioCampoDTO,
  type ResultadoRelatorioRebanhoDTO,
} from "../api";
import { exportarFormularioCampoPdf, montarPreviaFormularioCampo } from "./formularioCampoExport";

const BASE_SISTEMA: { chave: ChaveColunaSistemaFormulario; rotulo: string }[] = [
  { chave: "animal", rotulo: "Animal" },
  { chave: "categoria", rotulo: "Categoria" },
  { chave: "grupo_setor", rotulo: "Grupo / setor" },
  { chave: "data", rotulo: "Data" },
];

function nomeInicial(relatorio: ResultadoRelatorioRebanhoDTO) {
  const periodo = relatorio.meta.periodo.inicio && relatorio.meta.periodo.fim
    ? `${relatorio.meta.periodo.inicio} a ${relatorio.meta.periodo.fim}`
    : new Date().toISOString().slice(0, 10);
  return `${relatorio.titulo} · ${periodo}`;
}

export function FormularioCampoModal({
  relatorio,
  filtros,
  onClose,
  onCriada,
}: {
  relatorio: ResultadoRelatorioRebanhoDTO;
  filtros: FiltrosRelatorioRebanho;
  onClose: () => void;
  onCriada: (folha: FolhaCampoDTO) => void;
}) {
  const [nome, setNome] = useState(() => nomeInicial(relatorio));
  const [campos, setCampos] = useState<CampoFormularioCampoDTO[]>([]);
  const [modelos, setModelos] = useState<ModeloFormularioCampoDTO[]>([]);
  const [modeloId, setModeloId] = useState("");
  const colunasRelatorio = useMemo(() => relatorio.colunas.map((coluna) => ({ chave: coluna.chave as ChaveColunaSistemaFormulario, rotulo: coluna.rotulo })), [relatorio.colunas]);
  const colunasDisponiveis = useMemo(() => [...BASE_SISTEMA, ...colunasRelatorio].filter((item, indice, itens) => itens.findIndex((outro) => outro.chave === item.chave) === indice), [colunasRelatorio]);
  const [colunasSistema, setColunasSistema] = useState<ChaveColunaSistemaFormulario[]>(() => ["animal", "grupo_setor", "data", ...colunasRelatorio.map((c) => c.chave)]);
  const [camposPapel, setCamposPapel] = useState<ConfigFormularioCampo["camposPapel"]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ativo = true;
    Promise.allSettled([listarCamposFormulario(relatorio.templateId), listarModelosFormularioCampo(relatorio.templateId)])
      .then(([resultadoCampos, resultadoModelos]) => {
        if (!ativo) return;
        if (resultadoCampos.status === "rejected") {
          setErro(resultadoCampos.reason instanceof Error ? resultadoCampos.reason.message : "Não foi possível carregar os campos do formulário.");
          return;
        }
        const novosCampos = resultadoCampos.value;
        setCampos(novosCampos);
        setCamposPapel(novosCampos.map((campo) => campo.chave));
        if (resultadoModelos.status === "fulfilled") {
          setModelos(resultadoModelos.value);
        } else {
          setModelos([]);
          setErro("Os modelos salvos estão indisponíveis, mas você ainda pode montar uma nova folha.");
        }
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível carregar o montador."));
    return () => { ativo = false; };
  }, [relatorio.templateId]);

  const config = useMemo<ConfigFormularioCampo>(() => ({ colunasSistema, camposPapel }), [colunasSistema, camposPapel]);
  useEffect(() => {
    if (!previewRef.current) return;
    previewRef.current.replaceChildren(montarPreviaFormularioCampo({ nome, config, relatorio, campos }));
  }, [nome, config, relatorio, campos]);

  function toggleColuna(chave: ChaveColunaSistemaFormulario) {
    setColunasSistema((atuais) => atuais.includes(chave) ? atuais.filter((item) => item !== chave) : [...atuais, chave]);
  }
  function toggleCampo(chave: ConfigFormularioCampo["camposPapel"][number]) {
    const campo = campos.find((item) => item.chave === chave);
    if (campo?.obrigatorio && camposPapel.includes(chave)) return;
    setCamposPapel((atuais) => atuais.includes(chave) ? atuais.filter((item) => item !== chave) : [...atuais, chave]);
  }
  function usarModelo(id: string) {
    setModeloId(id);
    const modelo = modelos.find((item) => String(item.id) === id);
    if (!modelo) return;
    setColunasSistema(modelo.config.colunasSistema);
    setCamposPapel(modelo.config.camposPapel);
    setNome(modelo.nome);
  }

  async function salvarModelo() {
    if (!nome.trim()) { setErro("Informe o nome do modelo."); return; }
    setOcupado(true); setErro(null);
    try {
      const modelo = await criarModeloFormularioCampo({ nome: nome.trim(), templateId: relatorio.templateId, config });
      setModelos((atuais) => [modelo, ...atuais]);
      setModeloId(String(modelo.id));
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar o modelo."); }
    finally { setOcupado(false); }
  }

  async function criarEImprimir() {
    if (!nome.trim()) { setErro("Informe o nome da folha."); return; }
    if (!colunasSistema.length || !camposPapel.length) { setErro("Selecione dados do sistema e campos para preencher."); return; }
    setOcupado(true); setErro(null);
    try {
      const folha = await criarFolhaCampo({ nome: nome.trim(), filtros, config, ...(modeloId ? { modeloId: Number(modeloId) } : {}) });
      await exportarFormularioCampoPdf(folha, campos);
      onCriada(folha);
      onClose();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível criar a folha."); }
    finally { setOcupado(false); }
  }

  return (
    <RebModal
      title="Montar formulário de campo"
      onClose={onClose}
      className="w-[min(1180px,calc(100vw-32px))]"
      actions={<><RebButton disabled={ocupado} onClick={salvarModelo}>Salvar como modelo</RebButton><RebButton variant="pri" disabled={ocupado || !campos.length} onClick={criarEImprimir}>{ocupado ? "Preparando…" : "Criar folha e imprimir"}</RebButton></>}
    >
      <p className="mb-5 mt-0 text-sm text-ink-3">Escolha o que já vem preenchido pelo sistema e o que o veterinário anotará no papel. A prévia acompanha cada escolha.</p>
      {erro && <p role="alert" className="rounded-lg border border-[color:var(--rule-soft)] px-3 py-2 text-sm text-prejuizo">Erro: {erro}</p>}
      <div className="grid min-h-[540px] gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="min-w-0">
          <label className="mb-4 grid gap-1 text-sm font-semibold text-foreground">Nome da folha<input aria-label="Nome da folha" value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          <label className="mb-4 grid gap-1 text-sm font-semibold text-foreground">Usar modelo salvo<RebSelect aria-label="Usar modelo salvo" value={modeloId} onChange={usarModelo}><option value="" data-descricao="Mantém as colunas e campos marcados abaixo.">Configuração atual</option>{modelos.map((modelo) => <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>)}</RebSelect></label>
          <RebFieldset><legend>Dados preenchidos pelo sistema</legend><div className="grid gap-2 pb-3">{colunasDisponiveis.map((coluna) => <label key={coluna.chave} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" aria-label={coluna.rotulo} checked={colunasSistema.includes(coluna.chave)} onChange={() => toggleColuna(coluna.chave)} />{coluna.rotulo}</label>)}</div></RebFieldset>
          <RebFieldset><legend>Campos para preencher no papel</legend><div className="grid gap-2 pb-3">{campos.map((campo) => <label key={campo.chave} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" aria-label={campo.rotulo} checked={camposPapel.includes(campo.chave)} onChange={() => toggleCampo(campo.chave)} />{campo.rotulo}{campo.obrigatorio && <span className="text-xs text-ink-3">obrigatório</span>}</label>)}</div></RebFieldset>
        </div>
        <section className="min-w-0 rounded-lg border border-[color:var(--rule-soft)] bg-white p-4" aria-label="Prévia do formulário">
          <p className="mb-3 mt-0 text-xs font-semibold uppercase tracking-[.12em] text-ink-3">Prévia da impressão</p>
          <div ref={previewRef} className="formulario-campo-preview origin-top-left overflow-auto text-black" />
        </section>
      </div>
    </RebModal>
  );
}
