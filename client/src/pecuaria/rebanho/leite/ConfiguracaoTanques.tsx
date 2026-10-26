import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useId, useState } from "react";
import { PainelCadastro, classeInput } from "@/financeiro/PainelCadastro";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/DatePicker";
import { Cylinder } from "lucide-react";
import "./ordenhas-gerais.css";
import { registrarLeite } from "./operacoes-api";
import type { TanqueLeite } from "./tanques-types";
export function ConfiguracaoTanques({
  sitio,
  data,
  tanque,
  aoFechar,
  aoSalvar,
}: {
  sitio: number;
  data: string;
  tanque?: TanqueLeite;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [nome, setNome] = useState(tanque?.nome ?? "");
  const [fabricante, setFabricante] = useState(tanque?.fabricante ?? "");
  const [modelo, setModelo] = useState(tanque?.modelo ?? "");
  const [serie, setSerie] = useState(tanque?.numeroSerie ?? "");
  const [capacidade, setCapacidade] = useState(
    String(tanque?.capacidadeLitros ?? ""),
  );
  const [vigencia, setVigencia] = useState(data);
  const [ativo, setAtivo] = useState(tanque?.ativo ?? true);
  const [referencia, setReferencia] = useState(tanque?.referenciaTabela ?? "");
  const [tabela, setTabela] = useState(
    tanque?.tabelaConversao.map((p) => `${p.mm};${p.litros}`).join("\n") ?? "",
  );
  const [identidade] = useState(
    () => tanque?.identidadeId ?? crypto.randomUUID(),
  );
  const formId = useId();
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    try {
      const tabelaConversao = tabela.trim()
        ? tabela
            .trim()
            .split(/\r?\n/)
            .map((linha, i) => {
              const partes = linha.split(";");
              if (
                partes.length !== 2 ||
                partes.some(
                  (p) => !p.trim() || !/^\d+(?:[.,]\d+)?$/.test(p.trim()),
                )
              )
                throw new Error(
                  `Linha ${i + 1}: informe milímetros;litros, sem cabeçalho.`,
                );
              return {
                mm: Number(partes[0].trim().replace(",", ".")),
                litros: Number(partes[1].trim().replace(",", ".")),
              };
            })
        : [];
      await registrarLeite("/tanques", sitio, {
        propriedadeId: sitio,
        identidadeId: identidade,
        versaoEsperada: tanque?.versao ?? 0,
        nome,
        fabricante: fabricante || null,
        modelo: modelo || null,
        numeroSerie: serie || null,
        capacidadeLitros: Number(capacidade.replace(",", ".")),
        vigenteDesde: vigencia,
        ativo,
        referenciaTabela: referencia || null,
        tabelaConversao,
      });
      aoSalvar();
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível salvar o tanque.",
      );
    } finally {
      setOcupado(false);
    }
  }
  return (
    <PainelCadastro
      compacto
      aberto
      icon={Cylinder}
      titulo={tanque ? "Nova versão do tanque" : "Cadastrar tanque"}
      onFechar={aoFechar}
      bloqueado={ocupado}
      alteracoesExternas={vigencia !== data}
      rodape={(fechar) => (
        <>
          <Button variant="outline" disabled={ocupado} onClick={fechar}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={ocupado}>
            {ocupado ? "Salvando…" : "Salvar tanque"}
          </Button>
        </>
      )}
    >
      <form
        id={formId}
        className="leite-ajuste-form"
        onSubmit={(e) => void salvar(e)}
      >
        <p className="leite-ajuste-ajuda">
          Especificações e tabela própria do tanque. As aferições anteriores
          conservam a versão utilizada.
        </p>
        <fieldset disabled={ocupado} className="leite-ajuste-secao">
          <div className="leite-ajuste-grade">
            <label>
              Nome do tanque
              <Input
                className={classeInput}
                required
                maxLength={100}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </label>
            <label>
              Capacidade (L)
              <Input
                className={classeInput}
                required
                inputMode="decimal"
                value={capacidade}
                onChange={(e) => setCapacidade(e.target.value)}
              />
            </label>
            <label>
              Vigente desde
              <DatePicker
                aria-label="Vigente desde"
                disabled={ocupado}
                required
                value={vigencia}
                onChange={setVigencia}
                className="mt-1.5"
              />
            </label>
          </div>
          <div className="leite-ajuste-grade">
            <label>
              Fabricante
              <Input
                className={classeInput}
                maxLength={100}
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
              />
            </label>
            <label>
              Modelo
              <Input
                className={classeInput}
                maxLength={100}
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
              />
            </label>
            <label>
              Número de série ou ordem
              <Input
                className={classeInput}
                maxLength={100}
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
              />
            </label>
          </div>
          <label>
            <Input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
            />
            Disponível para novas aferições
          </label>
          <h3 className="leite-ajuste-divisao">Conversão da régua</h3>
          <label>
            Referência da tabela
            <Input
              className={classeInput}
              maxLength={1000}
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </label>
          <label>
            Tabela de conversão — milímetros;litros
            <Textarea
              className={classeInput}
              rows={7}
              value={tabela}
              onChange={(e) => setTabela(e.target.value)}
              placeholder={"0;22,5\n100;336,7"}
            />
          </label>
          <p>
            Um ponto por linha. Cadastre apenas valores conferidos na tabela
            deste tanque. Sem tabela, é possível registrar litros aferidos
            diretamente; conversões ausentes não serão estimadas.
          </p>
          {erro && <p role="alert">{erro}</p>}
        </fieldset>
      </form>
    </PainelCadastro>
  );
}
