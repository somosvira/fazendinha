// Modal de "desfazer movimentação" com o impacto explicado animal a animal — usado tanto
// pelo histórico geral (HistoricoMovimentacoes) quanto pelo detalhe de uma movimentação
// (DetalheMovimentacao). Quem já tem o detalhe carregado passa `detalhe` para evitar um
// refetch; sem ele, busca sozinho via GET /movimentacoes/:id (o mesmo endpoint sempre traz
// `animais`, inclusive os de uma movimentação já desfeita).

import { useCallback, useEffect, useState } from "react";
import { Loader } from "../../../components/Loading";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { buscarMovimentacao, desfazerMovimentacao, RebanhoApiError } from "../api";
import type { MovimentacaoDetalhe } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import { ModalMotivo } from "../ui";
import { navegarPara } from "../../../router";

function mensagemErro(e: unknown): string {
  return e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e);
}

/** "<lote> (<sítio>)" quando há lote, senão "<sítio>, sem lote" — mesma redação de FormMovimentar. */
function destinoTexto(mov: MovimentacaoDetalhe): string {
  return mov.destino.lote ? `${mov.destino.lote.nome} (${mov.destino.propriedade.nome})` : `${mov.destino.propriedade.nome}, sem lote`;
}

function fraseResumo(mov: MovimentacaoDetalhe, qtd: number): string {
  const destino = destinoTexto(mov);
  const data = formatarDataBR(mov.data);
  return qtd === 1
    ? `1 animal sai de ${destino} e volta para onde estava em ${data}.`
    : `${qtd} animais saem de ${destino} e voltam para onde estavam em ${data}.`;
}

export function ConfirmarDesfazerMovimentacao({ movimentacaoId, detalhe, onConfirmado, onFechar }: {
  movimentacaoId: string;
  /** já carregado por quem chama (evita um segundo GET /movimentacoes/:id) */
  detalhe?: MovimentacaoDetalhe;
  onConfirmado: () => void;
  onFechar: () => void;
}) {
  const [mov, setMov] = useState<MovimentacaoDetalhe | null>(detalhe ?? null);
  const [carregando, setCarregando] = useState(!detalhe);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErroCarga(null);
    try { setMov(await buscarMovimentacao(movimentacaoId)); }
    catch (e) { setErroCarga(mensagemErro(e)); }
    finally { setCarregando(false); }
  }, [movimentacaoId]);

  useEffect(() => { if (!detalhe) void carregar(); }, [detalhe, carregar]);

  const confirmar = (motivo: string) => {
    if (salvando) return;
    setSalvando(true); setErro(null);
    desfazerMovimentacao(movimentacaoId, motivo)
      .then(() => onConfirmado())
      .catch((e) => setErro(mensagemErro(e)))
      .finally(() => setSalvando(false));
  };

  const abrirAnimal = (animalId: string) => {
    navegarPara(`/pecuaria/rebanho/animais/${animalId}`);
    onFechar();
  };

  const voltam = mov ? mov.animais.filter((a) => a.situacao !== "DESFEITO") : [];
  const jaDesfeitos = mov ? mov.animais.filter((a) => a.situacao === "DESFEITO") : [];

  return <ModalMotivo
    titulo="Desfazer movimentação?"
    eyebrow={mov ? `Movimentação de ${formatarDataBR(mov.data)}` : "Movimentação"}
    impacto={carregando
      ? <Loader label="Carregando movimentação" size="sm" />
      : erroCarga
        ? <ErrorBox erro={erroCarga} />
        : mov && <div className="space-y-3">
          <p>{fraseResumo(mov, voltam.length)}</p>
          {voltam.length > 0 && <div className="overflow-x-auto rounded-lg border border-red-200">
            <table className="w-full text-left text-xs">
              <thead className="text-red-900"><tr><th className="p-2 font-semibold">Brinco</th><th className="p-2 font-semibold">Nome</th><th className="p-2 font-semibold">Volta para</th><th className="p-2 font-semibold">Categoria</th></tr></thead>
              <tbody className="divide-y divide-red-200">
                {voltam.map((a) => <tr key={a.animalId}>
                  <td className="p-2"><button type="button" onClick={() => abrirAnimal(a.animalId)} className="font-semibold text-mast hover:underline">{a.brinco}</button></td>
                  <td className="p-2">{a.nome ?? "—"}</td>
                  <td className="p-2">{a.origem ?? "—"}</td>
                  <td className="p-2">{a.categoria?.nome ?? "Sem categoria"}</td>
                </tr>)}
              </tbody>
            </table>
          </div>}
          {jaDesfeitos.length > 0 && <p className="text-xs">Já desfeitos (não mudam): {jaDesfeitos.map((a) => a.brinco).join(", ")}</p>}
          <p className="text-xs">O registro da movimentação continua no histórico, marcado como desfeito.</p>
        </div>}
    labelManter="Manter"
    labelConfirmar="Desfazer movimentação"
    confirmando={salvando || carregando}
    erro={erro}
    onFechar={onFechar}
    onConfirmar={confirmar}
  />;
}
