import { useEffect, useMemo, useState } from "react";
import {
  listarProdutos,
  listarSaldos,
  registrarMovimento,
  type ProdutoDTO,
  type SaldoDTO,
} from "../api";
import type { Animal } from "../types";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";

interface Props {
  animalId: string;
  animal?: Animal;
  produtoDigitado: string;
  dose?: string;
  loteProduto?: string;
  data: string;
  tipo: "APLICACAO" | "VACINA";
  onFechar: () => void;
  onBaixaFeita: () => void;
}

const rotuloTipo = (t: Props["tipo"]) => (t === "VACINA" ? "Vacina" : "Aplicação");

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function acharProduto(produtos: ProdutoDTO[], digitado: string): ProdutoDTO | null {
  const n = norm(digitado);
  if (!n) return null;
  return (
    produtos.find((p) => norm(p.nome) === n) ??
    (n.length >= 3 ? produtos.find((p) => norm(p.nome).includes(n)) ?? null : null)
  );
}

function fmtQtd(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
}

function fmtDataBR(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function BaixaEstoqueCard({
  animalId,
  animal,
  produtoDigitado,
  dose,
  loteProduto,
  data,
  tipo,
  onFechar,
  onBaixaFeita,
}: Props) {
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [saldos, setSaldos] = useState<SaldoDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [produtoId, setProdutoId] = useState<number | null>(null);
  const [quantidade, setQuantidade] = useState<string>("1");
  const [observacao, setObservacao] = useState<string>(() => {
    const partes = [
      `${rotuloTipo(tipo)}${animal ? ` em ${animal.nome || animal.numero}` : ""}`,
      dose ? `dose: ${dose}` : null,
      loteProduto ? `lote ${loteProduto}` : null,
    ].filter(Boolean);
    return partes.join(" · ");
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarProdutos({ ativo: true }), listarSaldos()])
      .then(([ps, ss]) => {
        if (!vivo) return;
        setProdutos(ps);
        setSaldos(ss);
        const match = acharProduto(ps, produtoDigitado);
        if (match) setProdutoId(match.id);
      })
      .catch((e) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [produtoDigitado]);

  const produtoSel = useMemo(
    () => produtos.find((p) => p.id === produtoId) ?? null,
    [produtos, produtoId],
  );
  const saldoSel = useMemo(
    () => saldos.find((s) => s.produtoId === produtoId) ?? null,
    [saldos, produtoId],
  );

  const naoEstocavel = produtoSel && !produtoSel.estocavel;
  const podeDarBaixa =
    !!produtoSel && !naoEstocavel && Number(quantidade) > 0 && !salvando;

  async function darBaixa() {
    if (!produtoSel) return;
    setSalvando(true);
    setErro(null);
    try {
      await registrarMovimento({
        produtoId: produtoSel.id,
        tipo: "SAIDA",
        data,
        quantidade: Number(quantidade),
        observacao: observacao || undefined,
      });
      setSucesso(true);
      setTimeout(() => {
        onBaixaFeita();
        onFechar();
      }, 700);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <RebModal
      title={`Atividade registrada · ${rotuloTipo(tipo)}`}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar} disabled={salvando}>
            Fechar sem baixar
          </RebButton>
          <RebButton variant="pri" onClick={darBaixa} disabled={!podeDarBaixa}>
            {salvando ? "Baixando…" : "Dar baixa no estoque"}
          </RebButton>
        </>
      }
    >
      <>
        <dl className="rb-baixa-resumo">
          <div><dt>Data</dt><dd>{fmtDataBR(data)}</dd></div>
          {animal && <div><dt>Animal</dt><dd>{animal.nome ? `${animal.nome} (${animal.numero})` : animal.numero}</dd></div>}
          <div><dt>Produto</dt><dd>{produtoDigitado || "—"}</dd></div>
          {dose && <div><dt>Dose</dt><dd>{dose}</dd></div>}
          {loteProduto && <div><dt>Lote</dt><dd>{loteProduto}</dd></div>}
        </dl>

        <label className="rb-fld">
          Produto do estoque a abater
          <select
            value={produtoId ?? ""}
            onChange={(e) => setProdutoId(e.target.value ? Number(e.target.value) : null)}
            disabled={carregando}
          >
            <option value="">{carregando ? "Carregando…" : "— selecionar —"}</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.tipo.toLowerCase()} · {p.unidade})
              </option>
            ))}
          </select>
        </label>

        {produtoSel && (
          <div className="rb-baixa-status">
            {naoEstocavel ? (
              <span className="rb-pill">Produto não é controlado por estoque</span>
            ) : !saldoSel || saldoSel.saldo <= 0 ? (
              <span className="rb-pill bad">
                Sem estoque{saldoSel ? ` (saldo: ${fmtQtd(saldoSel.saldo)} ${produtoSel.unidade})` : ""}
              </span>
            ) : saldoSel.abaixoMinimo ? (
              <span className="rb-pill warn">
                ⚠ Abaixo do mínimo — saldo {fmtQtd(saldoSel.saldo)} {produtoSel.unidade}
                {saldoSel.minimoEstoque != null ? ` · mín ${fmtQtd(saldoSel.minimoEstoque)}` : ""}
              </span>
            ) : (
              <span className="rb-baixa-saldo">
                Saldo atual: {fmtQtd(saldoSel.saldo)} {produtoSel.unidade}
              </span>
            )}
          </div>
        )}

        <label className="rb-fld">
          Quantidade{produtoSel ? ` (${produtoSel.unidade})` : ""}
          <input
            type="number"
            min={0}
            step="0.01"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            disabled={!produtoSel || !!naoEstocavel}
          />
        </label>

        <label className="rb-fld">
          Observação
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </label>

        {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
        {sucesso && <p style={{ color: "var(--lucro)", fontSize: 13 }}>Baixa registrada.</p>}
      </>
    </RebModal>
  );
}
