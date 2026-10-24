import { SelectCampo } from "@/financeiro/SelectCampo";
import { useId, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { PainelCadastro, classeInput } from "@/financeiro/PainelCadastro";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/DatePicker";
import { Settings2 } from "lucide-react";
import "./ordenhas-gerais.css";
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
  const [fonte, setFonte] = useState<"INDIVIDUAL" | "GERAL">(
    configuracao.fonteProducao ?? "INDIVIDUAL",
  );
  const [intervalo, setIntervalo] = useState(
    configuracao.intervaloIndividualQuantidade ?? 1,
  );
  const [unidade, setUnidade] = useState<"DIAS" | "MESES">(
    configuracao.intervaloIndividualUnidade ?? "MESES",
  );
  const [vigencia, setVigencia] = useState(data);
  const formId = useId();
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
      fonteProducao: fonte,
      intervaloIndividualQuantidade: intervalo,
      intervaloIndividualUnidade: unidade,
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
    <PainelCadastro
      compacto
      aberto
      icon={Settings2}
      titulo="Configurar ordenhas"
      onFechar={aoFechar}
      bloqueado={salvando}
      alteracoesExternas={
        vigencia !== data ||
        JSON.stringify(ordenhas) !== JSON.stringify(configuracao.ordenhas) ||
        fonte !== (configuracao.fonteProducao ?? "INDIVIDUAL") ||
        unidade !== (configuracao.intervaloIndividualUnidade ?? "MESES")
      }
      rodape={(fechar) => (
        <>
          <Button variant="outline" disabled={salvando} onClick={fechar}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={salvando || !vigencia}>
            {salvando ? "Salvando…" : "Salvar configuração"}
          </Button>
        </>
      )}
    >
      <form
        id={formId}
        className="leite-ajuste-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <p className="leite-ajuste-ajuda">
          Defina a rotina do sítio. Dias já registrados conservam sua
          configuração.
        </p>
        <fieldset disabled={salvando} className="leite-ajuste-secao">
          <label>
            Vigente desde
            <DatePicker
              aria-label="Vigente desde"
              disabled={salvando}
              required
              value={vigencia}
              onChange={setVigencia}
              className="mt-1.5"
            />
          </label>
          <label>
            Fonte da produção diária
            <SelectCampo
              aria-label="Fonte da produção diária"
              className={classeInput}
              disabled={salvando}
              value={fonte}
              onValueChange={(v) =>
                setFonte(v === "GERAL" ? "GERAL" : "INDIVIDUAL")
              }
            >
              <option value="GERAL">Aferição geral nos tanques</option>
              <option value="INDIVIDUAL">Medições individuais completas</option>
            </SelectCampo>
          </label>
          <p>
            O controle individual permanece disponível nos dois modos. Somente a
            fonte escolhida compõe a produção diária e pode confirmar estoque.
          </p>
        </fieldset>
        <fieldset disabled={salvando} className="leite-ajuste-secao">
          <legend>Controle individual dos animais</legend>
          <p>
            Periodicidade para todos os animais deste sítio. Medições extras
            continuam permitidas.
          </p>
          <div className="leite-ajuste-grade">
            <label>
              Aferir a cada
              <input
                className={classeInput}
                type="number"
                min="1"
                max="365"
                step="1"
                value={intervalo}
                onChange={(e) => setIntervalo(Number(e.target.value))}
              />
            </label>
            <label>
              Unidade do intervalo
              <SelectCampo
                aria-label="Unidade do intervalo"
                className={classeInput}
                disabled={salvando}
                value={unidade}
                onValueChange={(v) =>
                  setUnidade(v === "DIAS" ? "DIAS" : "MESES")
                }
              >
                <option value="MESES">Meses</option>
                <option value="DIAS">Dias</option>
              </SelectCampo>
            </label>
          </div>
          <p>
            Mensal: 1 mês. Para medição diária com máquinas: 1 dia. A frequência
            das ordenhas abaixo é independente.
          </p>
        </fieldset>
        <section className="leite-ajuste-secao">
          <h3>Ordenhas do dia</h3>
          <div className="leite-ajuste-lista">
            {ordenhas.map((o, i) => (
              <div className="leite-ajuste-ordenha" key={o.posicaoId}>
                <span>{i + 1}</span>
                <label>
                  Nome
                  <input
                    className={classeInput}
                    value={o.nome}
                    maxLength={60}
                    disabled={salvando}
                    onChange={(e) => mudar(i, { nome: e.target.value })}
                  />
                </label>
                <label>
                  Horário (opcional)
                  <input
                    className={classeInput}
                    type="time"
                    value={o.horario ?? ""}
                    disabled={salvando}
                    onChange={(e) =>
                      mudar(i, { horario: e.target.value || null })
                    }
                  />
                </label>
                <div className="leite-ajuste-ordem">
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    aria-label={`Mover ${o.nome} para cima`}
                    disabled={i === 0 || salvando}
                    onClick={() => mover(i, -1)}
                  >
                    <ChevronUp size={15} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    aria-label={`Mover ${o.nome} para baixo`}
                    disabled={i === ordenhas.length - 1 || salvando}
                    onClick={() => mover(i, 1)}
                  >
                    <ChevronDown size={15} />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  type="button"
                  size="icon"
                  aria-label={`Remover ordenha ${o.nome}`}
                  disabled={ordenhas.length === 1 || salvando}
                  onClick={() =>
                    setOrdenhas((atual) => atual.filter((_, j) => j !== i))
                  }
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            type="button"
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
          </Button>
          <p className="leite-muted">
            De 1 a 12 ordenhas. A ordem das linhas define a sequência.
          </p>
        </section>
        {erro && (
          <p role="alert" className="leite-erro">
            {erro}
          </p>
        )}
      </form>
    </PainelCadastro>
  );
}
