import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { ModalPolitica } from "./ModalPolitica";
import { formatBRDateISO } from "../../../lib/hoje";
import { RebanhoApiError } from "../api";
import { reqV4 } from "./api";
import type {
  DemandaRevisavel,
  PoliticaAcompanhamento,
  PreviaRevisao,
} from "./acompanhamento-api";
const data = (d: string | null) => (d ? formatBRDateISO(d) : "Sem data");
const identidade = (d: DemandaRevisavel | undefined) =>
  d?.animal
    ? `${d.animal.brinco ?? "Sem brinco"}${d.animal.nome ? ` · ${d.animal.nome}` : ""}`
    : "Identificação indisponível";
const finalidades: Record<string, string> = {
  DIAGNOSTICO: "Diagnóstico",
  RECONFIRMACAO: "Reconfirmação",
  SEXAGEM: "Sexagem",
};
const origens: Record<string, string> = {
  INDIVIDUAL: "agendamento individual",
  MODELO: "modelo",
  FATO_NOVO: "política do sítio",
  ADOCAO_EXPLICITA: "adoção explícita",
  SEM_REGRA: "sem regra",
  PROTOCOLO: "atendimento de protocolo",
};
export function RevisaoPrazosAcompanhamento({
  propriedadeId,
  politicas,
}: {
  propriedadeId: number;
  politicas: PoliticaAcompanhamento[];
}) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<DemandaRevisavel[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [selecao, setSelecao] = useState<Record<string, DemandaRevisavel>>({});
  const [politicaId, setPoliticaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [previa, setPrevia] = useState<PreviaRevisao | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const chave = useRef<{ payload: string; id: string } | null>(null);
  useEffect(() => {
    if (!aberto) return;
    let atual = true;
    setCarregando(true);
    setErro(null);
    void reqV4<{ itens: DemandaRevisavel[]; total: number }>(
      `/reproducao/acompanhamento?estado=PENDENTE&pagina=${pagina}&porPagina=10`,
      undefined,
      "GET",
      propriedadeId,
    )
      .then((p) => {
        if (atual) {
          setItens(p.itens);
          setTotal(p.total);
        }
      })
      .catch((e) => {
        if (atual) setErro(e.message);
      })
      .finally(() => {
        if (atual) setCarregando(false);
      });
    return () => {
      atual = false;
    };
  }, [aberto, pagina, propriedadeId]);
  const invalidar = () => {
    setPrevia(null);
    setConfirmado(false);
  };
  async function executar(confirmar: boolean) {
    if (ocupado) return;
    setErro(null);
    setOcupado(true);
    const input = {
      propriedadeId,
      politicaId,
      demandaIds: Object.keys(selecao),
    };
    try {
      if (confirmar) {
        if (!previa || !confirmado || motivo.trim().length < 5) return;
        const body = { ...input, motivo, revisao: previa.revisao };
        const payload = JSON.stringify(body);
        if (chave.current?.payload !== payload)
          chave.current = { payload, id: crypto.randomUUID() };
        await reqV4(
          "/reproducao/acompanhamento/prazos/revisao",
          { ...body, chave: chave.current.id },
          "POST",
          propriedadeId,
        );
        setAberto(false);
        setMensagem("Prazos revisados com histórico preservado.");
      } else {
        setPrevia(
          await reqV4<PreviaRevisao>(
            "/reproducao/acompanhamento/prazos/previa",
            input,
            "POST",
            propriedadeId,
          ),
        );
        setConfirmado(false);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      if (confirmar && e instanceof RebanhoApiError && e.code === "CONFLITO")
        invalidar();
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setAberto(true);
          setSelecao({});
          setPagina(1);
          setPoliticaId("");
          setMotivo("");
          invalidar();
          setErro(null);
        }}
      >
        Revisar prazos existentes
      </Button>
      {mensagem && <p role="status">{mensagem}</p>}
      {aberto && (
        <ModalPolitica
          aberto
          titulo="Revisar prazos existentes"
          bloqueado={ocupado}
          alteracoesExternas={!!Object.keys(selecao).length || !!motivo}
          onFechar={() => setAberto(false)}
          rodape={(fechar) => (
            <>
              <Button variant="outline" onClick={fechar} disabled={ocupado}>
                Cancelar
              </Button>
              <Button
                onClick={() => void executar(false)}
                disabled={
                  ocupado || !politicaId || !Object.keys(selecao).length
                }
              >
                Conferir prévia
              </Button>
              <Button
                onClick={() => void executar(true)}
                disabled={
                  ocupado ||
                  !previa ||
                  !confirmado ||
                  motivo.trim().length < 5 ||
                  previa.propostas.some((p) => p.impedimento !== null)
                }
              >
                Confirmar revisão
              </Button>
            </>
          )}
        >
          <div className="space-y-4">
            <ErrorBox erro={erro} />
            <p>
              As datas individuais e agendamentos em visitas são preservados.
              Selecione apenas as necessidades cuja mudança deseja conferir.
            </p>
            <label>
              Versão a aplicar
              <SelectCampo
                value={politicaId}
                disabled={ocupado}
                onValueChange={(v) => {
                  setPoliticaId(v);
                  invalidar();
                }}
              >
                <option value="">Selecione</option>
                {politicas.map((p) => (
                  <option key={p.id} value={p.id}>
                    Versão {p.versao} · {data(p.vigenteDesde)}
                  </option>
                ))}
              </SelectCampo>
            </label>
            {carregando ? (
              <p role="status">Carregando necessidades…</p>
            ) : (
              <div className="space-y-2">
                {itens.map((d) => (
                  <label
                    className="flex items-start gap-2 border-t py-2"
                    key={d.id}
                  >
                    <input
                      type="checkbox"
                      disabled={
                        ocupado ||
                        (!selecao[d.id] && Object.keys(selecao).length >= 100)
                      }
                      checked={!!selecao[d.id]}
                      onChange={(e) => {
                        const copia = { ...selecao };
                        if (e.target.checked) copia[d.id] = d;
                        else delete copia[d.id];
                        setSelecao(copia);
                        invalidar();
                      }}
                    />
                    <span>
                      {finalidades[d.finalidade] ?? "Acompanhamento"} ·{" "}
                      {data(d.previstaPara)}
                      <small className="block text-ink-3">
                        {identidade(d)} · origem{" "}
                        {origens[d.origemAdocao] ?? "não informada"}
                      </small>
                    </span>
                  </label>
                ))}
                {!itens.length && <p>Nenhuma necessidade pendente.</p>}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                disabled={ocupado || pagina === 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                Página anterior
              </Button>
              <span>
                Página {pagina} · {Object.keys(selecao).length} selecionadas
              </span>
              <Button
                variant="outline"
                disabled={ocupado || pagina * 10 >= total}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima página
              </Button>
            </div>
            <label>
              Motivo da revisão
              <textarea
                required
                minLength={5}
                maxLength={1000}
                disabled={ocupado}
                className={classeInput}
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  setConfirmado(false);
                }}
              />
            </label>
            {previa && (
              <div className="space-y-2">
                <h3 className="font-semibold">Prévia da revisão</h3>
                {previa.propostas.map((p) => (
                  <p key={p.demandaId}>
                    <strong>{identidade(selecao[p.demandaId])}</strong> ·{" "}
                    {data(p.previstaAnterior)} →{" "}
                    {p.proposta ? data(p.proposta.previstaPara) : "Sem regra"}
                    {p.impedimento && (
                      <strong className="block">
                        Preservada:{" "}
                        {p.impedimento
                          .replaceAll("_", " ")
                          .toLocaleLowerCase("pt-BR")}
                      </strong>
                    )}
                  </p>
                ))}
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={confirmado}
                    disabled={
                      ocupado ||
                      previa.propostas.some((p) => p.impedimento !== null)
                    }
                    onChange={(e) => setConfirmado(e.target.checked)}
                  />
                  Conferi a seleção e as novas datas; confirmo a revisão.
                </label>
              </div>
            )}
          </div>
        </ModalPolitica>
      )}
    </div>
  );
}
