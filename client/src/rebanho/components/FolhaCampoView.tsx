import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { RebButton } from "@/components/rb/RebButton";
import { RebMain } from "@/components/rb/RebPrimitives";
import { RebTable } from "@/components/rb/RebTable";
import {
  cancelarFolhaCampo,
  concluirFolhaCampo,
  listarCamposFormulario,
  salvarLinhasFolhaCampo,
  type AtualizacaoLinhaFolha,
  type CampoFormularioCampoDTO,
  type FolhaCampoDTO,
  type LinhaFolhaCampoDTO,
} from "../api";
import { rotuloAnimal } from "./AnimalIdentity";
import { RebHeader } from "./RebHeader";

type EdicaoLinha = {
  status: "PENDENTE" | "PREENCHIDA" | "NAO_REALIZADO";
  respostas: Record<string, string | number>;
  motivoNaoRealizado: string;
};

const ROTULOS_SISTEMA: Record<string, string> = {
  animal: "Animal", categoria: "Categoria", grupo_setor: "Grupo / setor", data: "Data",
  reprodutor: "Touro / sêmen", protocolo: "Protocolo", doadora: "Doadora", resultado: "Resultado",
  partoPrevisto: "Parto previsto", diasGestacao: "Dias de gestação", ultimaTentativa: "Última tentativa",
  previsaoSecagem: "Previsão de secagem", tipoParto: "Tipo", auxilio: "Auxílio", crias: "Crias",
  vivas: "Vivas", natimortas: "Natimortas", sexo: "Sexo", motivo: "Motivo", observacao: "Observação registrada",
};

function edicaoInicial(linha: LinhaFolhaCampoDTO): EdicaoLinha {
  const status = linha.status === "REGISTRADA" ? "PREENCHIDA" : linha.status;
  return {
    status,
    respostas: Object.fromEntries(Object.entries(linha.respostas ?? {}).filter((item): item is [string, string | number] => typeof item[1] === "string" || typeof item[1] === "number")),
    motivoNaoRealizado: linha.motivoNaoRealizado ?? "",
  };
}

function valorSistema(linha: LinhaFolhaCampoDTO, chave: string) {
  const s = linha.snapshot;
  if (chave === "animal") return rotuloAnimal(s.numero, s.nome);
  if (chave === "categoria") return s.categoria;
  if (chave === "grupo_setor") return [s.grupo, s.setor].filter(Boolean).join(" · ") || "—";
  if (chave === "data") return s.data ?? "—";
  return s.valores[chave] ?? "—";
}

function linhaResolvida(edicao: EdicaoLinha, campos: CampoFormularioCampoDTO[]) {
  if (edicao.status === "NAO_REALIZADO") return edicao.motivoNaoRealizado.trim().length > 0;
  const obrigatorios = campos.filter((campo) => campo.obrigatorio).every((campo) => {
    const valor = edicao.respostas[campo.chave];
    return valor !== undefined && valor !== null && String(valor).trim() !== "";
  });
  const camposLeite = campos.filter((campo) => ["peso_1", "peso_2", "peso_3", "peso_total"].includes(campo.chave));
  const temLeite = !camposLeite.length || camposLeite.some((campo) => String(edicao.respostas[campo.chave] ?? "").trim() !== "");
  return obrigatorios && temLeite;
}

export function FolhaCampoView({
  folhaInicial,
  onVoltar,
  onAtualizada,
}: {
  folhaInicial: FolhaCampoDTO;
  onVoltar: () => void;
  onAtualizada: (folha: FolhaCampoDTO) => void;
}) {
  const [folha, setFolha] = useState(folhaInicial);
  const [campos, setCampos] = useState<CampoFormularioCampoDTO[]>([]);
  const [edicoes, setEdicoes] = useState<Record<number, EdicaoLinha>>(() => Object.fromEntries(folhaInicial.linhas.map((linha) => [linha.id, edicaoInicial(linha)])));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const bloqueada = folha.status === "CONCLUIDA" || folha.status === "CANCELADA";

  useEffect(() => {
    listarCamposFormulario(folha.templateId).then(setCampos).catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar campos."));
  }, [folha.templateId]);
  const camposAtivos = useMemo(() => campos.filter((campo) => folha.config.camposPapel.includes(campo.chave)), [campos, folha.config.camposPapel]);
  const pendentes = folha.linhas.filter((linha) => !linhaResolvida(edicoes[linha.id] ?? edicaoInicial(linha), camposAtivos)).length;

  function alterarStatus(linha: LinhaFolhaCampoDTO, status: EdicaoLinha["status"]) {
    setEdicoes((atuais) => ({ ...atuais, [linha.id]: { ...(atuais[linha.id] ?? edicaoInicial(linha)), status } }));
  }
  function alterarResposta(linha: LinhaFolhaCampoDTO, chave: string, valor: string) {
    setEdicoes((atuais) => {
      const edicao = atuais[linha.id] ?? edicaoInicial(linha);
      return { ...atuais, [linha.id]: { ...edicao, status: "PREENCHIDA", respostas: { ...edicao.respostas, [chave]: valor } } };
    });
  }

  function payload(): AtualizacaoLinhaFolha[] {
    return folha.linhas.map((linha) => {
      const edicao = edicoes[linha.id] ?? edicaoInicial(linha);
      if (edicao.status === "NAO_REALIZADO") return { id: linha.id, status: "NAO_REALIZADO", motivoNaoRealizado: edicao.motivoNaoRealizado.trim() };
      if (linhaResolvida(edicao, camposAtivos)) return { id: linha.id, status: "PREENCHIDA", respostas: edicao.respostas };
      return { id: linha.id, status: "PENDENTE", ...(Object.keys(edicao.respostas).length ? { respostas: edicao.respostas } : {}) };
    });
  }

  async function salvar() {
    setOcupado(true); setErro(null); setFeedback(null);
    try {
      const atualizada = await salvarLinhasFolhaCampo(folha.id, payload());
      setFolha(atualizada); onAtualizada(atualizada); setFeedback("Rascunho salvo.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setOcupado(false); }
  }
  async function concluir() {
    if (pendentes > 0) return;
    setOcupado(true); setErro(null); setFeedback(null);
    try {
      await salvarLinhasFolhaCampo(folha.id, payload());
      const concluida = await concluirFolhaCampo(folha.id);
      setFolha(concluida); onAtualizada(concluida); setFeedback("Folha concluída e eventos registrados no rebanho.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível concluir."); }
    finally { setOcupado(false); }
  }
  async function cancelar() {
    setConfirmarCancelamento(false); setOcupado(true); setErro(null);
    try {
      const cancelada = await cancelarFolhaCampo(folha.id);
      setFolha(cancelada); onAtualizada(cancelada); setFeedback("Folha cancelada.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível cancelar."); }
    finally { setOcupado(false); }
  }

  return (
    <RebMain>
      <button type="button" onClick={onVoltar} className="mb-4 border-0 bg-transparent p-0 text-sm text-ink-3">← Voltar aos relatórios</button>
      <RebHeader eyebrow="Rebanho · Formulário de campo" title={folha.nome} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-ink-3">{folha.totalLinhas - pendentes} de {folha.totalLinhas} resolvidas · {pendentes ? `${pendentes} pendentes` : "pronta para concluir"}</p>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-[.08em]">{folha.status.replaceAll("_", " ")}</span>
      </div>
      {erro && <p role="alert" className="text-sm text-prejuizo">Erro: {erro}</p>}
      {feedback && <p role="status" className="text-sm text-foreground">{feedback}</p>}
      <RebTable className="min-w-[1100px]">
        <thead><tr>{folha.config.colunasSistema.map((chave) => <th key={chave}>{ROTULOS_SISTEMA[chave] ?? chave}</th>)}<th>Situação</th>{camposAtivos.map((campo) => <th key={campo.chave}>{campo.rotulo}</th>)}</tr></thead>
        <tbody>{folha.linhas.map((linha) => {
          const edicao = edicoes[linha.id] ?? edicaoInicial(linha);
          return <tr key={linha.id}>
            {folha.config.colunasSistema.map((chave) => <td key={chave}>{valorSistema(linha, chave)}</td>)}
            <td><select aria-label={`Situação da linha do animal ${linha.snapshot.numero}`} disabled={bloqueada} value={edicao.status} onChange={(e) => alterarStatus(linha, e.target.value as EdicaoLinha["status"])}><option value="PENDENTE">Pendente</option><option value="PREENCHIDA">Preencher</option><option value="NAO_REALIZADO">Não realizado</option></select>{edicao.status === "NAO_REALIZADO" && <input aria-label={`Motivo de não realizar no animal ${linha.snapshot.numero}`} placeholder="Motivo" value={edicao.motivoNaoRealizado} onChange={(e) => setEdicoes((atuais) => ({ ...atuais, [linha.id]: { ...edicao, motivoNaoRealizado: e.target.value } }))} />}</td>
            {camposAtivos.map((campo) => <td key={campo.chave}>{campo.tipoUi === "opcoes" ? <select aria-label={`${campo.rotulo} do animal ${linha.snapshot.numero}`} disabled={bloqueada || edicao.status === "NAO_REALIZADO"} value={String(edicao.respostas[campo.chave] ?? "")} onChange={(e) => alterarResposta(linha, campo.chave, e.target.value)}><option value="">Selecione</option>{campo.opcoes?.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}</select> : <input type={campo.tipoUi === "data" ? "date" : campo.tipoUi === "numero" ? "number" : "text"} aria-label={`${campo.rotulo} do animal ${linha.snapshot.numero}`} disabled={bloqueada || edicao.status === "NAO_REALIZADO"} value={String(edicao.respostas[campo.chave] ?? "")} onChange={(e) => alterarResposta(linha, campo.chave, e.target.value)} />}</td>)}
          </tr>;
        })}</tbody>
      </RebTable>
      {!bloqueada && <div className="sticky bottom-0 mt-4 flex flex-wrap justify-end gap-2 border-t border-border bg-[color:var(--bg)] py-4"><RebButton variant="danger" disabled={ocupado} onClick={() => setConfirmarCancelamento(true)}>Cancelar atividade</RebButton><RebButton disabled={ocupado} onClick={salvar}>Salvar rascunho</RebButton><RebButton variant="pri" disabled={ocupado || pendentes > 0 || !campos.length} onClick={concluir}>Concluir e registrar {folha.totalLinhas - pendentes} resultados</RebButton></div>}
      <ConfirmDialog open={confirmarCancelamento} title="Cancelar folha de campo?" message="A folha permanecerá no histórico, mas não aceitará novos lançamentos e não criará eventos." confirmLabel="Cancelar folha" tone="danger" onCancel={() => setConfirmarCancelamento(false)} onConfirm={() => void cancelar()} />
    </RebMain>
  );
}
