import { useState } from "react";
import type { Lote, TipoSanitario } from "../types";
import { registrarManejoSanitario, type ManejoInput } from "../api";
import { HOJE } from "../HOJE";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";

/* Catálogo de manejos sanitários (Calendário Embrapa cronograma 11). O label é
 * editorial; o valor é o enum TipoSanitario em UPPERCASE que o backend espera. */
const TIPOS: { v: TipoSanitario; lab: string }[] = [
  { v: "VACINA_AFTOSA", lab: "Vacina — Aftosa" },
  { v: "VACINA_BRUCELOSE_B19", lab: "Vacina — Brucelose B19 (fêmeas 3-8 meses)" },
  { v: "VACINA_CLOSTRIDIOSE", lab: "Vacina — Clostridiose (polivalente)" },
  { v: "VACINA_RAIVA", lab: "Vacina — Raiva" },
  { v: "VACINA_CARBUNCULO", lab: "Vacina — Carbúnculo" },
  { v: "VACINA_LEPTOSPIROSE", lab: "Vacina — Leptospirose" },
  { v: "VACINA_IBR_BVD", lab: "Vacina — IBR / BVD" },
  { v: "VERMIFUGACAO_5811", lab: "Vermifugação — esquema 5/8/11" },
  { v: "VERMIFUGACAO_ESTRATEGICA", lab: "Vermifugação — estratégica" },
  { v: "CONTROLE_CARRAPATO", lab: "Controle de carrapato" },
  { v: "CONTROLE_MOSCA", lab: "Controle de mosca-dos-chifres" },
  { v: "CONTROLE_BERNE", lab: "Controle de berne" },
  { v: "MARCACAO", lab: "Marcação / brinco" },
  { v: "DESCORNA", lab: "Descorna" },
  { v: "CASTRACAO", lab: "Castração" },
  { v: "BRINCO_ELETRONICO", lab: "Brinco eletrônico (SISBOV)" },
];

/* Drawer de registro de manejo sanitário — espelha o PesagemForm.
 * CRÍTICO: campos opcionais vazios são OMITIDOS (undefined), nunca enviados como
 * null/""; `tipo` é sempre um enum em UPPERCASE vindo do select tipado. */
export function ManejoForm({ lote, onFechar, onSalvo }: { lote: Lote; onFechar: () => void; onSalvo: () => void }) {
  const [data, setData] = useState<string>(HOJE);
  const [tipo, setTipo] = useState<TipoSanitario>("VACINA_AFTOSA");
  const [numCabecas, setNumCabecas] = useState<string>(String(lote.numCabecas ?? ""));
  const [produto, setProduto] = useState<string>("");
  const [doseMl, setDoseMl] = useState<string>("");
  const [responsavel, setResponsavel] = useState<string>("");
  const [carenciaDias, setCarenciaDias] = useState<string>("");
  const [proximaDose, setProximaDose] = useState<string>("");
  const [observacao, setObservacao] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload: ManejoInput = {
        data: data || HOJE,
        tipo,
        numCabecas: Number(numCabecas),
        // Opcionais: só entram no payload quando preenchidos (undefined caso contrário).
        produto: produto || undefined,
        doseMl: doseMl ? Number(doseMl) : undefined,
        responsavel: responsavel || undefined,
        carenciaDias: carenciaDias ? Number(carenciaDias) : undefined,
        proximaDose: proximaDose || undefined,
        observacao: observacao || undefined,
      };
      await registrarManejoSanitario(lote.id, payload);
      onSalvo();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao salvar.");
      setSalvando(false);
    }
  }

  return (
    <RebModal
      title={`Registrar manejo — ${lote.codigo}`}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar} disabled={salvando}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || !numCabecas} onClick={salvar}>{salvando ? "Salvando…" : "Salvar manejo"}</RebButton>
        </>
      }
    >
      <p className="text-sm text-ink-3">{lote.nome} · {lote.numCabecas} cabeças. Vacina, vermífugo e controles entram na linha do tempo do lote.</p>

      <div className="rb-fld">
        <label>Tipo de manejo*</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoSanitario)}>
          {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.lab}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div className="rb-fld" style={{ flex: 1 }}>
          <label>Data*</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} max={HOJE} />
        </div>
        <div className="rb-fld" style={{ flex: 1 }}>
          <label>Cabeças manejadas*</label>
          <input type="number" value={numCabecas} onChange={(e) => setNumCabecas(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div className="rb-fld" style={{ flex: 2 }}>
          <label>Produto</label>
          <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex.: Aftosa Marca · Vermífugo Ivomec" />
        </div>
        <div className="rb-fld" style={{ flex: 1 }}>
          <label>Dose (mL)</label>
          <input type="number" step="0.1" value={doseMl} onChange={(e) => setDoseMl(e.target.value)} placeholder="por cabeça" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div className="rb-fld" style={{ flex: 1 }}>
          <label>Carência (dias)</label>
          <input type="number" value={carenciaDias} onChange={(e) => setCarenciaDias(e.target.value)} placeholder="até liberar venda" />
        </div>
        <div className="rb-fld" style={{ flex: 1 }}>
          <label>Próxima dose</label>
          <input type="date" value={proximaDose} onChange={(e) => setProximaDose(e.target.value)} />
        </div>
      </div>

      <div className="rb-fld">
        <label>Responsável</label>
        <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Ex.: MV Carla · Vaqueiro João" />
      </div>

      <div className="rb-fld">
        <label>Observação</label>
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
      </div>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
