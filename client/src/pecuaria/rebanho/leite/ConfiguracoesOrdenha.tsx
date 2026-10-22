import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";
import { salvarConfiguracao } from "./api";
import type { ConfiguracaoOrdenha, PosicaoOrdenha } from "./types";
export function ConfiguracoesOrdenha({
  configuracao,
  data,
  aoFechar,
  aoSalvar,
}: {
  configuracao: ConfiguracaoOrdenha;
  data: string;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [ordenhas, setOrdenhas] = useState<PosicaoOrdenha[]>(
    configuracao.ordenhas.map((o) => ({ ...o })),
  );
  const [vigencia, setVigencia] = useState(data);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [tentativa, setTentativa] = useState<{
    payload: string;
    chave: string;
  } | null>(null);
  function mudar(i: number, patch: Partial<PosicaoOrdenha>) {
    setOrdenhas((atual) =>
      atual.map((o, j) => (j === i ? { ...o, ...patch } : o)),
    );
  }
  function mover(indice: number, direcao: number) {
    setOrdenhas((atual) => {
      const copia = [...atual];
      [copia[indice], copia[indice + direcao]] = [
        copia[indice + direcao],
        copia[indice],
      ];
      return copia;
    });
  }
  async function salvar() {
    if (ordenhas.some((o) => !o.nome.trim())) {
      setErro("Dê um nome a cada ordenha.");
      return;
    }
    setSalvando(true);
    setErro("");
    const base = {
      propriedadeId: configuracao.propriedadeId,
      vigenteDesde: vigencia,
      ordenhas: ordenhas.map((o, i) => ({
        ...o,
        nome: o.nome.trim(),
        ordem: i + 1,
        horario: o.horario || null,
      })),
    };
    const payload = JSON.stringify(base);
    const chave =
      tentativa?.payload === payload ? tentativa.chave : crypto.randomUUID();
    setTentativa({ payload, chave });
    try {
      await salvarConfiguracao({ ...base, chave });
      aoSalvar();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar a configuração.",
      );
    } finally {
      setSalvando(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto && !salvando) aoFechar();
      }}
    >
      <DialogContent className="leite-config">
        <DialogTitle>Configurar ordenhas</DialogTitle>
        <DialogDescription>
          Defina a rotina do sítio. Dias já registrados conservam sua
          configuração.
        </DialogDescription>
        <label>
          Vigente desde
          <input
            type="date"
            value={vigencia}
            onChange={(e) => setVigencia(e.target.value)}
            required
            disabled={salvando}
          />
        </label>
        <div className="leite-config-lista">
          {ordenhas.map((o, i) => (
            <div className="leite-config-linha" key={o.posicaoId}>
              <span>{i + 1}</span>
              <label>
                Nome
                <input
                  value={o.nome}
                  maxLength={60}
                  disabled={salvando}
                  onChange={(e) => mudar(i, { nome: e.target.value })}
                />
              </label>
              <label>
                Horário (opcional)
                <input
                  type="time"
                  value={o.horario ?? ""}
                  disabled={salvando}
                  onChange={(e) =>
                    mudar(i, { horario: e.target.value || null })
                  }
                />
              </label>
              <div className="leite-ordem">
                <button
                  className="leite-icon"
                  type="button"
                  aria-label={`Mover ${o.nome} para cima`}
                  disabled={i === 0 || salvando}
                  onClick={() => mover(i, -1)}
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  className="leite-icon"
                  type="button"
                  aria-label={`Mover ${o.nome} para baixo`}
                  disabled={i === ordenhas.length - 1 || salvando}
                  onClick={() => mover(i, 1)}
                >
                  <ChevronDown size={15} />
                </button>
              </div>
              <button
                type="button"
                className="leite-icon"
                aria-label={`Remover ordenha ${o.nome}`}
                disabled={ordenhas.length === 1 || salvando}
                onClick={() =>
                  setOrdenhas((atual) => atual.filter((_, j) => j !== i))
                }
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="leite-button"
          disabled={ordenhas.length >= 12 || salvando}
          onClick={() =>
            setOrdenhas((atual) => [
              ...atual,
              {
                posicaoId: crypto.randomUUID(),
                nome: `Ordenha ${atual.length + 1}`,
                ordem: atual.length + 1,
                horario: null,
              },
            ])
          }
        >
          <Plus size={18} />
          Adicionar ordenha
        </button>
        <p className="leite-muted">
          De 1 a 12 ordenhas. A ordem das linhas define a sequência.
        </p>
        {erro && (
          <p role="alert" className="leite-erro">
            {erro}
          </p>
        )}
        <div className="leite-config-acoes">
          <button
            className="leite-button"
            disabled={salvando}
            onClick={aoFechar}
          >
            Cancelar
          </button>
          <button
            className="leite-button leite-primary"
            disabled={salvando || !vigencia}
            onClick={() => void salvar()}
          >
            {salvando ? "Salvando…" : "Salvar configuração"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
