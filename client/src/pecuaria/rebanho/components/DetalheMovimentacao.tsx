// Painel lateral (largo) com o detalhe de uma movimentação: cabeçalho com origem/destino/motivo/
// quem fez e a lista dos animais movidos — inclusive os de uma movimentação já desfeita, já que o
// histórico nunca escode os animais (GET /movimentacoes/:id sempre traz `animais`). Aberto a
// partir de uma linha de HistoricoMovimentacoes (Lotes · Histórico e DetalheLote).

import { useCallback, useEffect, useState } from "react";
import { Loader } from "../../../components/Loading";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";
import { Button, ErrorBox, Pill } from "../../../financeiro/financeiro-ui";
import { buscarMovimentacao, desfazerMovimentacao, RebanhoApiError } from "../api";
import type { MovimentacaoDetalhe } from "../types";
import { formatarDataBR, rotuloCategoria } from "../lib/rotulos";
import { ModalMotivo } from "../ui";
import { navegarPara } from "../../../router";

function rotuloDestino(mov: MovimentacaoDetalhe): string {
  return mov.destino.lote ? `${mov.destino.lote.nome} (${mov.destino.propriedade.nome})` : mov.destino.propriedade.nome;
}

function mensagemErro(e: unknown): string {
  return e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e);
}

const ROTULO_SITUACAO_ANIMAL: Record<string, { texto: string; tone: "green" | "neutral" | "red" }> = {
  NO_DESTINO: { texto: "No destino", tone: "green" },
  SAIU_DO_DESTINO: { texto: "Saiu do destino", tone: "neutral" },
  DESFEITO: { texto: "Desfeito", tone: "red" },
};

export function DetalheMovimentacao({ id, podeLancar = true, onFechar, onMudou }: {
  id: string;
  podeLancar?: boolean;
  onFechar: () => void;
  /** chamado depois de um desfazer bem-sucedido, para o pai recarregar a lista/lote */
  onMudou?: () => void;
}) {
  const [mov, setMov] = useState<MovimentacaoDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [desfazendo, setDesfazendo] = useState(false);
  const [processandoDesfazer, setProcessandoDesfazer] = useState(false);
  const [erroDesfazer, setErroDesfazer] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try { setMov(await buscarMovimentacao(id)); }
    catch (e) { setErro(mensagemErro(e)); }
    finally { setCarregando(false); }
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  const abrirAnimal = (animalId: string) => {
    onFechar();
    navegarPara(`/pecuaria/rebanho/animais/${animalId}`);
  };

  const confirmarDesfazer = (motivo: string) => {
    if (!mov || processandoDesfazer) return;
    setProcessandoDesfazer(true); setErroDesfazer(null);
    desfazerMovimentacao(mov.id, motivo)
      .then(async () => { setDesfazendo(false); await carregar(); onMudou?.(); })
      .catch((e) => setErroDesfazer(mensagemErro(e)))
      .finally(() => setProcessandoDesfazer(false));
  };

  return <PainelCadastro aberto eyebrow="Rebanho" titulo="Movimentação" largura="sm:max-w-3xl" onFechar={onFechar}
      rodape={<Button secondary onClick={onFechar}>Fechar</Button>}>
      <ErrorBox erro={erro} />
      {carregando && !mov ? <Loader label="Carregando movimentação" /> : mov && <div className="grid gap-5">
        <div className="rounded-xl border border-border p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {mov.direcao && <Pill tone={mov.direcao === "ENTRADA" ? "green" : "amber"}>{mov.direcao === "ENTRADA" ? "Entrada" : "Saída"}</Pill>}
            <span className="text-ink-3">{formatarDataBR(mov.data)}</span>
            <strong>{mov.quantidadeTotal} {mov.quantidadeTotal === 1 ? "animal" : "animais"}</strong>
          </div>
          <p className="mt-2 break-words">{mov.origens.length ? mov.origens.join(", ") : "Origem não identificada"} → {rotuloDestino(mov)}</p>
          {mov.motivo && <p className="mt-1 break-words text-ink-3">Motivo: {mov.motivo}</p>}
          <p className="mt-1 text-xs text-ink-3">{mov.criadoPor ?? "Sistema"} · {formatarDataBR(mov.criadoEm)}</p>
          {mov.desfeitaEm && <p className="mt-1 text-xs font-medium text-red-700">Desfeita em {formatarDataBR(mov.desfeitaEm)}{mov.desfeitaMotivo ? ` · ${mov.desfeitaMotivo}` : ""}</p>}
          {podeLancar && mov.podeDesfazer && <div className="mt-3"><Button secondary onClick={() => { setErroDesfazer(null); setDesfazendo(true); }}>Desfazer movimentação</Button></div>}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f4f2e9] text-[11px] uppercase tracking-[.08em] text-ink-3">
              <tr><th className="p-3 font-semibold">Animal</th><th className="p-3 font-semibold">Categoria</th><th className="p-3 font-semibold">Veio de</th><th className="p-3 font-semibold">Situação</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mov.animais.map((a) => {
                const situacao = ROTULO_SITUACAO_ANIMAL[a.situacao] ?? { texto: a.situacao, tone: "neutral" as const };
                return <tr key={a.animalId}>
                  <td className="p-3"><button type="button" onClick={() => abrirAnimal(a.animalId)} className="break-words font-semibold text-mast hover:underline">{a.brinco}{a.nome ? ` · ${a.nome}` : ""}</button></td>
                  <td className="p-3">{rotuloCategoria(a.categoria)}</td>
                  <td className="p-3">{a.origem ?? "—"}</td>
                  <td className="p-3"><Pill tone={situacao.tone}>{situacao.texto}</Pill></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>}

      {desfazendo && <ModalMotivo
        titulo="Desfazer movimentação?"
        eyebrow={mov ? `Movimentação de ${formatarDataBR(mov.data)}` : "Movimentação"}
        impacto={mov ? <p>Os {mov.quantidadeTotal} animais desta movimentação voltam para a localização anterior.</p> : undefined}
        labelManter="Manter"
        labelConfirmar="Desfazer movimentação"
        confirmando={processandoDesfazer}
        erro={erroDesfazer}
        onFechar={() => setDesfazendo(false)}
        onConfirmar={confirmarDesfazer}
      />}
    </PainelCadastro>;
}
