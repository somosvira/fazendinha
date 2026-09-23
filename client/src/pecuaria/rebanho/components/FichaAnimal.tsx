import { useState } from "react";
import { RebButton } from "../../../components/rb/RebButton";
import { RebField } from "../../../components/rb/RebField";
import { RebModal } from "../../../components/rb/RebModal";
import { RebSelect } from "../../../components/rb/RebSelect";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { formatarDataBR, formatarIdade, rotuloAptidao, rotuloCategoria, rotuloPapelReprodutivo, rotuloTipoSaida } from "../lib/rotulos";
import type { AnimalFicha, Catalogos, MovimentarInput } from "../types";

export function FichaAnimal({
  ficha,
  catalogos,
  onVoltar,
  onMovimentar,
  onMudarDestino,
  onSaida,
  onEstornarSaida,
  onRegistrarPesagem,
  processando,
}: {
  ficha: AnimalFicha;
  catalogos: Catalogos;
  onVoltar: () => void;
  onMovimentar: (input: Omit<MovimentarInput, "animalIds">) => void;
  onMudarDestino: (input: { aptidao: "LEITE" | "CORTE"; papelReprodutivo: "NENHUM" | "RECEPTORA" | "DOADORA"; data: string }) => void;
  onSaida: (input: { data: string; tipo: string; motivoId: string | null; observacao: string | null }) => void;
  onEstornarSaida: (motivo: string) => void;
  onRegistrarPesagem: (input: { data: string; pesoKg: number; tipo: string }) => void;
  processando: boolean;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [modal, setModal] = useState<null | "movimentar" | "destino" | "saida" | "pesagem" | "estorno">(null);

  const [propriedadeId, setPropriedadeId] = useState(String(ficha.propriedade?.id ?? catalogos.propriedades[0]?.id ?? ""));
  const [loteId, setLoteId] = useState("");
  const [dataMov, setDataMov] = useState(hoje);

  const [aptidao, setAptidao] = useState<"LEITE" | "CORTE">(ficha.aptidao ?? "LEITE");
  const [papelReprodutivo, setPapelReprodutivo] = useState<"NENHUM" | "RECEPTORA" | "DOADORA">(ficha.papelReprodutivo ?? "NENHUM");
  const [dataDestino, setDataDestino] = useState(hoje);

  const [dataSaida, setDataSaida] = useState(hoje);
  const [tipoSaida, setTipoSaida] = useState("VENDA");
  const [motivoId, setMotivoId] = useState("");
  const [observacaoSaida, setObservacaoSaida] = useState("");
  const [motivoEstorno, setMotivoEstorno] = useState("");

  const [dataPesagem, setDataPesagem] = useState(hoje);
  const [pesoKg, setPesoKg] = useState("");
  const [tipoPesagem, setTipoPesagem] = useState("ROTINA");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <RebButton onClick={onVoltar}>← Voltar</RebButton>
        <div className="flex gap-2">
          <RebButton onClick={() => setModal("pesagem")} disabled={ficha.situacao === "SAIU"}>Registrar pesagem</RebButton>
          <RebButton onClick={() => setModal("movimentar")} disabled={ficha.situacao === "SAIU"}>Movimentar</RebButton>
          <RebButton onClick={() => setModal("destino")} disabled={ficha.situacao === "SAIU"}>Mudar destino</RebButton>
          {ficha.situacao === "ATIVO" ? (
            <RebButton variant="danger" onClick={() => setModal("saida")}>Dar saída</RebButton>
          ) : (
            <RebButton variant="danger" onClick={() => setModal("estorno")}>Estornar saída</RebButton>
          )}
        </div>
      </div>

      <h2 className="mb-1 font-serif text-2xl">
        {ficha.brinco} {ficha.nome ? `· ${ficha.nome}` : ""}
      </h2>
      <p className="mb-4 text-sm text-ink-2">
        {rotuloCategoria(ficha.categoria)} · {formatarIdade(ficha.idadeMeses)} · {ficha.situacao === "ATIVO" ? "Ativo" : "Saiu"}
      </p>

      <div className="grid grid-cols-2 gap-6">
        <section>
          <h3 className="mb-2 font-serif text-lg italic text-ink-3">Dados fixos</h3>
          <dl className="grid grid-cols-2 gap-1 text-sm">
            <dt className="text-ink-2">Sexo</dt><dd>{ficha.sexo === "F" ? "Fêmea" : "Macho"}</dd>
            <dt className="text-ink-2">Nascimento</dt><dd>{formatarDataBR(ficha.dataNascimento)}{ficha.nascimentoEstimado ? " (estimado)" : ""}</dd>
            <dt className="text-ink-2">Entrada</dt><dd>{formatarDataBR(ficha.dataEntrada)} · {ficha.origem === "NASCIDO" ? "Nascido" : "Comprado"}</dd>
            <dt className="text-ink-2">Partos antes da entrada</dt><dd>{ficha.partosAntesDaEntrada}</dd>
            <dt className="text-ink-2">Brinco eletrônico</dt><dd>{ficha.brincoEletronico ?? "—"}</dd>
            <dt className="text-ink-2">SISBOV</dt><dd>{ficha.sisbov ?? "—"}</dd>
            <dt className="text-ink-2">Observação</dt><dd>{ficha.observacao ?? "—"}</dd>
          </dl>

          <h3 className="mb-2 mt-4 font-serif text-lg italic text-ink-3">Composição racial</h3>
          <p className="text-sm">{ficha.composicaoRotulo}</p>
        </section>

        <section>
          <h3 className="mb-2 font-serif text-lg italic text-ink-3">Localização atual</h3>
          <p className="text-sm">{ficha.propriedade?.nome ?? "—"} {ficha.lote ? `· ${ficha.lote.nome}` : ""}</p>
          <h4 className="mb-1 mt-3 text-sm font-semibold uppercase text-ink-2">Histórico</h4>
          <ul className="space-y-1 text-sm">
            {ficha.historicoLocalizacoes.map((h) => (
              <li key={h.id}>
                {formatarDataBR(h.desde)} – {formatarDataBR(h.ate)}: {h.propriedade?.nome ?? "—"} {h.lote ? `· ${h.lote.nome}` : ""}
              </li>
            ))}
          </ul>

          <h3 className="mb-2 mt-4 font-serif text-lg italic text-ink-3">Destino</h3>
          <p className="text-sm">{rotuloAptidao(ficha.aptidao)} · {rotuloPapelReprodutivo(ficha.papelReprodutivo)}</p>
          <h4 className="mb-1 mt-3 text-sm font-semibold uppercase text-ink-2">Histórico</h4>
          <ul className="space-y-1 text-sm">
            {ficha.historicoDestinos.map((h) => (
              <li key={h.id}>
                {formatarDataBR(h.desde)} – {formatarDataBR(h.ate)}: {rotuloAptidao(h.aptidao)} · {rotuloPapelReprodutivo(h.papelReprodutivo)}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-4">
        <h3 className="mb-2 font-serif text-lg italic text-ink-3">Pesagens</h3>
        <ul className="space-y-1 text-sm">
          {ficha.historicoPesagens.map((p) => (
            <li key={p.id}>{formatarDataBR(p.data)}: {p.pesoKg} kg ({p.tipo.toLowerCase()})</li>
          ))}
          {ficha.historicoPesagens.length === 0 && <li className="text-ink-2">Nenhuma pesagem registrada.</li>}
        </ul>
      </section>

      {ficha.saida && (
        <section className="mt-4">
          <h3 className="mb-2 font-serif text-lg italic text-ink-3">Saída</h3>
          <p className="text-sm">
            {formatarDataBR(ficha.saida.data)} · {rotuloTipoSaida(ficha.saida.tipo)}
            {ficha.saida.estornadaEm ? ` · estornada em ${formatarDataBR(ficha.saida.estornadaEm)}` : ""}
          </p>
        </section>
      )}

      {modal === "movimentar" && (
        <RebModal
          title="Movimentar"
          onClose={() => setModal(null)}
          actions={
            <>
              <RebButton onClick={() => setModal(null)}>Cancelar</RebButton>
              <RebButton variant="pri" disabled={processando} onClick={() => { onMovimentar({ propriedadeId: Number(propriedadeId), loteId: loteId || null, data: dataMov }); setModal(null); }}>
                Confirmar
              </RebButton>
            </>
          }
        >
          <RebField label="Sítio">
            <RebSelect value={propriedadeId} onChange={setPropriedadeId}>
              {catalogos.propriedades.map((p) => <option key={p.id} value={String(p.id)}>{p.apelido ?? p.nome}</option>)}
            </RebSelect>
          </RebField>
          <RebField label="Lote">
            <RebSelect value={loteId} onChange={setLoteId}>
              <option value="">Sem lote</option>
            </RebSelect>
          </RebField>
          <RebField label="Data">
            <input type="date" value={dataMov} onChange={(e) => setDataMov(e.target.value)} />
          </RebField>
        </RebModal>
      )}

      {modal === "destino" && (
        <RebModal
          title="Mudar destino"
          onClose={() => setModal(null)}
          actions={
            <>
              <RebButton onClick={() => setModal(null)}>Cancelar</RebButton>
              <RebButton variant="pri" disabled={processando} onClick={() => { onMudarDestino({ aptidao, papelReprodutivo, data: dataDestino }); setModal(null); }}>
                Confirmar
              </RebButton>
            </>
          }
        >
          <RebField label="Aptidão">
            <RebSelect value={aptidao} onChange={(v) => setAptidao(v as "LEITE" | "CORTE")}>
              <option value="LEITE">Leite</option>
              <option value="CORTE">Corte</option>
            </RebSelect>
          </RebField>
          <RebField label="Papel reprodutivo">
            <RebSelect value={papelReprodutivo} onChange={(v) => setPapelReprodutivo(v as "NENHUM" | "RECEPTORA" | "DOADORA")}>
              <option value="NENHUM">Nenhum</option>
              <option value="RECEPTORA">Receptora</option>
              <option value="DOADORA">Doadora</option>
            </RebSelect>
          </RebField>
          <RebField label="Data">
            <input type="date" value={dataDestino} onChange={(e) => setDataDestino(e.target.value)} />
          </RebField>
        </RebModal>
      )}

      {modal === "saida" && (
        <ConfirmDialog
          open
          title="Dar saída do animal"
          tone="danger"
          dangerFilled
          processando={processando}
          confirmLabel="Confirmar saída"
          onCancel={() => setModal(null)}
          onDismiss={() => setModal(null)}
          onConfirm={() => { onSaida({ data: dataSaida, tipo: tipoSaida, motivoId: motivoId || null, observacao: observacaoSaida.trim() || null }); setModal(null); }}
          message={
            <div className="flex flex-col gap-3 text-left">
              <p>Esta ação marca o animal como inativo. Pode ser estornada depois, se necessário.</p>
              <RebField label="Data">
                <input type="date" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} />
              </RebField>
              <RebField label="Tipo">
                <RebSelect value={tipoSaida} onChange={setTipoSaida}>
                  <option value="VENDA">Venda</option>
                  <option value="ABATE">Abate</option>
                  <option value="MORTE">Morte</option>
                  <option value="DOACAO">Doação</option>
                  <option value="CADASTRO_INDEVIDO">Cadastro indevido</option>
                  <option value="OUTRO">Outro</option>
                </RebSelect>
              </RebField>
              <RebField label="Motivo">
                <RebSelect value={motivoId} onChange={setMotivoId}>
                  <option value="">—</option>
                  {catalogos.motivosSaida.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </RebSelect>
              </RebField>
              <RebField label="Observação">
                <textarea value={observacaoSaida} onChange={(e) => setObservacaoSaida(e.target.value)} rows={2} />
              </RebField>
            </div>
          }
        />
      )}

      {modal === "pesagem" && (
        <RebModal
          title="Registrar pesagem"
          onClose={() => setModal(null)}
          actions={
            <>
              <RebButton onClick={() => setModal(null)}>Cancelar</RebButton>
              <RebButton variant="pri" disabled={processando || !pesoKg} onClick={() => { onRegistrarPesagem({ data: dataPesagem, pesoKg: Number(pesoKg), tipo: tipoPesagem }); setModal(null); }}>
                Registrar
              </RebButton>
            </>
          }
        >
          <RebField label="Data">
            <input type="date" value={dataPesagem} onChange={(e) => setDataPesagem(e.target.value)} />
          </RebField>
          <RebField label="Peso (kg)">
            <input type="number" step="0.01" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} />
          </RebField>
          <RebField label="Tipo">
            <RebSelect value={tipoPesagem} onChange={setTipoPesagem}>
              <option value="NASCIMENTO">Nascimento</option>
              <option value="ENTRADA">Entrada</option>
              <option value="DESMAMA">Desmama</option>
              <option value="ROTINA">Rotina</option>
              <option value="SAIDA">Saída</option>
            </RebSelect>
          </RebField>
        </RebModal>
      )}

      {modal === "estorno" && (
        <ConfirmDialog
          open
          title="Estornar saída"
          tone="danger"
          processando={processando}
          confirmLabel="Confirmar estorno"
          onCancel={() => setModal(null)}
          onDismiss={() => setModal(null)}
          onConfirm={() => { if (motivoEstorno.trim()) onEstornarSaida(motivoEstorno.trim()); setModal(null); }}
          message={
            <div className="flex flex-col gap-3 text-left">
              <p>O animal volta a ficar ativo, na última localização e destino registrados.</p>
              <RebField label="Motivo do estorno *">
                <textarea value={motivoEstorno} onChange={(e) => setMotivoEstorno(e.target.value)} rows={2} />
              </RebField>
            </div>
          }
        />
      )}
    </div>
  );
}
