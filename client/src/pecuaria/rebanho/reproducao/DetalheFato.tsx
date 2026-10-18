import { CustosDiretos } from "../custos/CustosDiretos";
import { ColostroCria } from "./ColostroCria";
import { nomeCampoExame } from "../sanidade/CamposExame";
import { CorrigirFato } from "./CorrigirFato";
import { getUsuario } from "../../../lib/auth";
import { temAcessoArea } from "../../../lib/areas";
import { useState } from "react";
import { AnularFato } from "./AnularFato";
import { Button, brl, Modal, Pill } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";
import type { FatoReprodutivo } from "./api";
export function DetalheFato({
  fato,
  onFechar,
  podeLancar,
  onMudou,
}: {
  fato: FatoReprodutivo & { grupo: string };
  onFechar: () => void;
  podeLancar: boolean;
  onMudou: () => void;
}) {
  const [corrigindo, setCorrigindo] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const usuario = getUsuario();
  const podeFinanceiro =
    !!usuario && temAcessoArea(usuario.areas, "financeiro", !!usuario.dono);
  const podeVerValores =
    podeFinanceiro &&
    (!!usuario?.dono || !!usuario?.flags.includes("verValores"));
  const snapshot = fato.geneticaSnapshot;
  if (corrigindo)
    return (
      <CorrigirFato
        tipo="parto"
        id={fato.id}
        animalId={fato.animalId}
        propriedadeId={fato.propriedadeId}
        tipoPartoInicial={fato.tipo}
        gestacaoInicial={fato.gestacaoId}
        onFechar={() => setCorrigindo(false)}
        onSalvo={onMudou}
      />
    );
  if (anulando)
    return (
      <AnularFato
        tipo={
          {
            Tentativa: "tentativas",
            Avaliação: "avaliacoes",
            Parto: "partos",
            "Situação inicial": "situacoes-iniciais",
            Restrição: "restricoes",
          }[fato.grupo] ?? "tentativas"
        }
        id={fato.id}
        propriedadeId={fato.propriedadeId}
        onFechar={() => setAnulando(false)}
        onSalvo={onMudou}
      />
    );
  return (
    <Modal
      titulo={`${fato.grupo} · ${fato.data.slice(0, 10).split("-").reverse().join("/")}`}
      eyebrow="Histórico reprodutivo"
      onClose={onFechar}
    >
      <div className="p-5 space-y-4">
        <Pill>{fato.status ?? "Registrado"}</Pill>
        {fato.exame && <section className="rounded-lg border border-border p-4"><h3 className="font-semibold">{fato.exame.formatoSnapshot.nome ?? "Exame reprodutivo"}</h3><p className="text-sm">Finalidades: {fato.exame.finalidades.map(f => ({DIAGNOSTICO:"Diagnóstico",RECONFIRMACAO:"Reconfirmação",SEXAGEM:"Sexagem"} as Record<string,string>)[f] ?? f).join(" · ")}</p><p className="text-sm">{fato.exame.realizacao === "NAO_REALIZADO" ? "Exame não realizado" : "Exame realizado"}</p><dl className="grid gap-3 mt-3">{fato.exame.resultados.map(r => { const campo=fato.exame?.formatoSnapshot.campos?.find(c => c.codigo===r.campo); const rotulos:Record<string,string>={POSITIVO:"Gestação confirmada",NEGATIVO:"Gestação não confirmada",INCONCLUSIVO:"Inconclusivo",M:"Macho",F:"Fêmea"}; return <div key={r.campo}><dt className="text-sm text-ink-3">{nomeCampoExame(campo ?? {codigo:r.campo})}</dt><dd>{typeof r.valor === "boolean" ? r.valor ? "Sim" : "Não" : ["CONCLUSAO_GESTACIONAL","SEXO_FETAL"].includes(r.campo) ? rotulos[String(r.valor)] ?? String(r.valor) : String(r.valor)}{r.unidade ? ` ${r.unidade}` : ""}</dd></div>; })}</dl></section>}
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-ink-3">Procedimento / resultado</dt>
            <dd>{fato.tipo ?? fato.resultado ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Ordem registrada da tentativa</dt>
            <dd>
              {fato.ordem == null ? "Não informada" : `${fato.ordem}ª`}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Origem do material</dt>
            <dd>{fato.origemMaterial ?? fato.origem ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Quantidade</dt>
            <dd>{fato.quantidade ?? "Não informada"}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Responsável</dt>
            <dd>{fato.responsavel ?? "Não informado"}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Registro / autoria</dt>
            <dd>
              {fato.criadoEm?.slice(0, 10) ?? "—"} ·{" "}
              {fato.criadoPorId == null
                ? "Autoria histórica não informada"
                : `Usuário ${fato.criadoPorId}`}
            </dd>
          </div>
          {podeVerValores && fato.valorProdutoAtribuido != null && (
            <div>
              <dt className="text-ink-3">Custo do material</dt>
              <dd>{brl(fato.valorProdutoAtribuido)}</dd>
            </div>
          )}
          {podeVerValores && fato.valorServicoAtribuido != null && (
            <div>
              <dt className="text-ink-3">Valor de serviço atribuído</dt>
              <dd>{brl(fato.valorServicoAtribuido)}</dd>
            </div>
          )}
        </dl>
        {fato.grupo === "Tentativa" && fato.propriedadeId != null && <CustosDiretos key={fato.id} tentativaId={fato.id} propriedadeId={fato.propriedadeId} podeLancar={podeLancar} />}
        {fato.grupo === "Parto" && <section className="grid gap-3 rounded-lg border border-border p-4"><h3 className="font-semibold">Parto e pós-parto</h3><dl className="grid grid-cols-2 gap-3 text-sm">{[
          ["Desfecho", fato.desfecho ?? (fato.tipo === "ABORTO" ? "Aborto" : fato.tipo === "NORMAL" || fato.tipo === "DISTOCICO" || fato.tipo === "NATIMORTO" ? "Nascimento" : "Não informado")],
          ["Horário", fato.ocorridoEm ? `${new Date(fato.ocorridoEm).toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"})}${fato.horarioEstimado ? " · estimado" : ""}` : "Não informado"],
          ["Parto induzido", fato.induzido == null ? "Não informado" : fato.induzido ? "Sim" : "Não"],
          ["Dificuldade", fato.dificuldade == null ? "Não informada" : fato.dificuldade ? "Sim" : "Não"],
          ["Assistência", fato.assistenciaDescricao || "Não informada"],
          ["Retenção de placenta", fato.retencaoPlacenta == null ? "Não informada" : fato.retencaoPlacenta ? "Sim" : "Não"],
        ].map(([rotulo,valor])=><div key={rotulo}><dt className="text-ink-3">{rotulo}</dt><dd>{valor}</dd></div>)}</dl>{fato.vinculosPesagem?.filter(v=>!v.revogadoEm).map(v=><p key={v.id} className="text-sm">{v.sujeito === "MATRIZ" ? "Peso da matriz" : "Peso da cria"}: {v.pesagem.pesoKg} kg · pesagem em {v.pesagem.data.slice(0,10).split("-").reverse().join("/")}</p>)}{fato.examesPosParto?.map(exame=><div key={exame.id} className="text-sm rounded border border-border p-2"><p>Escore corporal · {exame.data.slice(0,10)} · {exame.status}</p><dl className="grid grid-cols-2 gap-2">{exame.resultados.map(r=><div key={r.campo}><dt className="text-ink-3">{({ESCORE:"Escore",ESCALA_MIN:"Mínimo da escala",ESCALA_MAX:"Máximo da escala",ESCALA_DESCRICAO:"Escala"} as Record<string,string>)[r.campo]??r.campo}</dt><dd>{String(r.valor)}</dd></div>)}</dl></div>)}{fato.ocorrenciasRetencaoPlacenta?.map(o=><p key={o.id} className="text-sm">Ocorrência vinculada: {o.doenca.nome}</p>)}</section>}
        {snapshot && (
          <section className="border-t border-border pt-4">
            <h3 className="font-semibold text-sm">
              Genética preservada na data do fato
            </h3>
            <p className="text-sm mt-2">
              Mãe genética:{" "}
              {snapshot.mae?.nome ??
                (snapshot.mae ? "Animal interno" : "Não informada")}{" "}
              · Pai genético:{" "}
              {snapshot.pai?.nome ??
                (snapshot.pai ? "Animal interno" : "Não informado")}
            </p>
            {snapshot.receptoraId && (
              <p className="text-sm">
                Receptora: animal da tentativa. A receptora não substitui a
                doadora na filiação.
              </p>
            )}
          </section>
        )}
        <p className="text-sm">
          {fato.motivo ??
            fato.observacao ??
            fato.anotacaoOriginal ??
            "Sem observação"}
        </p>
        {fato.crias?.map((c, i) => (
          <div key={i} className="border border-border p-3 rounded-lg text-sm">
            Cria {i + 1} · {c.viva ? "Viva" : "Sem sobrevivência"} ·{" "}
            {c.sexo === "F" ? "Fêmea" : "Macho"} · Peso ao nascer: {c.pesoKg == null ? "Não informado" : `${c.pesoKg} kg`}
            {c.viva && c.id && fato.propriedadeId && fato.status !== "ANULADO" && <ColostroCria criaId={c.id} propriedadeId={fato.propriedadeId} dataParto={fato.data} podeLancar={podeLancar} onMudou={onMudou}/>}
            {c.animalId && (
              <Button
                secondary
                onClick={() =>
                  navegarPara(`/pecuaria/rebanho/animais/${c.animalId}`)
                }
              >
                Abrir cadastro da cria
              </Button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {snapshot?.material?.produtoId && (
            <Button
              secondary
              onClick={() =>
                navegarPara(`/estoque/produtos/${snapshot.material!.produtoId}`)
              }
            >
              Material no estoque
            </Button>
          )}
          {podeFinanceiro && fato.operacaoServicoId && (
            <Button
              secondary
              onClick={() =>
                navegarPara(`/financeiro/operacoes/${fato.operacaoServicoId}`)
              }
            >
              Serviço associado
            </Button>
          )}
          {podeLancar &&
            fato.grupo === "Parto" &&
            fato.status !== "ANULADO" && (
              <Button secondary onClick={() => setCorrigindo(true)}>
                Corrigir / completar parto
              </Button>
            )}
          {podeLancar && fato.grupo!=="Gestação" && fato.status !== "ANULADO" && (
            <Button danger onClick={() => setAnulando(true)}>
              Conferir anulação
            </Button>
          )}
          <Button secondary onClick={onFechar}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
