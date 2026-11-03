import { prisma } from "../../../db.js";
import { temArea } from "../../auth/papeis.js";
import { hojeLocal, podeConsultarFinanceiro } from "../financeiro.js";
import { listarCompromissos } from "../../financeiro/operacoes.js";
import {
  consultarAlertas,
  consultaAlertasSchema,
} from "../../pecuaria/sanidade/alertas/consulta-alertas.js";
import type { ContextoAssistente } from "../tipos.js";
import type { RadarDTO } from "./tipos.js";
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const dataBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export async function coletarRadar(ctx: ContextoAssistente): Promise<RadarDTO> {
  const dia = hojeLocal(ctx.agora);
  const r: RadarDTO = {
    dia,
    geradoEm: ctx.agora.toISOString(),
    escopo: { propriedadeId: ctx.propriedadeId, nome: ctx.nomeEscopo },
    sintese: { modo: "deterministica", texto: "" },
    prioridades: [],
    leitura: [],
    cobertura: [],
  };
  const fonte = (titulo: string, url: string) => ({
    titulo,
    url:
      ctx.propriedadeId == null
        ? url
        : `${url}${url.includes("?") ? "&" : "?"}propriedadeId=${ctx.propriedadeId}`,
  });
  if (temArea(ctx.usuario, "pecuaria")) {
    const local = {
      ate: null,
      ...(ctx.propriedadeId == null
        ? {}
        : { propriedadeId: ctx.propriedadeId }),
    };
    const [animais, pesados, leite, alertas] = await Promise.all([
      prisma.localizacaoAnimal.count({ where: local }),
      prisma.localizacaoAnimal.count({
        where: {
          ...local,
          animal: {
            pesagens: {
              some: {
                data: {
                  gte: new Date(`${dia}T00:00:00Z`),
                  lte: new Date(`${dia}T23:59:59Z`),
                },
                ...(ctx.propriedadeId == null
                  ? {}
                  : { propriedadeId: ctx.propriedadeId }),
              },
            },
          },
        },
      }),
      prisma.diaProducaoLeite.findFirst({
        where: {
          ...(ctx.propriedadeId == null
            ? {}
            : { propriedadeId: ctx.propriedadeId }),
          dataOperacional: { lte: new Date(`${dia}T00:00:00Z`) },
        },
        orderBy: { dataOperacional: "desc" },
        select: { dataOperacional: true },
      }),
      consultarAlertas(
        ctx.propriedadeId,
        consultaAlertasSchema.parse({ disposicao: "ATENCAO", tamanho: 5 }),
        ctx.agora,
      ),
    ]);
    r.leitura.push({
      titulo: "Rebanho no sítio atual",
      texto: `${plural(animais, "animal", "animais")} neste sítio hoje.`,
      fonte: fonte("Rebanho · localização atual", "/pecuaria/rebanho/animais"),
    });
    r.cobertura.push({
      titulo: "Pesagens de hoje",
      texto: `${pesados} de ${plural(animais, "animal", "animais")} com pesagem registrada hoje.`,
      fonte: fonte(
        "Pesagens · registros por animal",
        "/pecuaria/rebanho/animais",
      ),
    });
    r.cobertura.push({
      titulo: "Registro de produção",
      texto: leite
        ? `Último dia de produção cadastrado: ${dataBR(leite.dataOperacional.toISOString())}. Confira na ordenha as medições confirmadas.`
        : "Nenhum dia de produção cadastrado neste sítio.",
      fonte: fonte(
        "Leite · ordenha",
        `/pecuaria/leite?leiteSecao=ordenhas&leiteModo=geral&ordenhasInicio=${leite?.dataOperacional.toISOString().slice(0, 10) ?? dia}&ordenhasFim=${leite?.dataOperacional.toISOString().slice(0, 10) ?? dia}`,
      ),
    });
    r.cobertura.push({
      titulo: "Avaliação sanitária",
      texto: `${({ ATUALIZADA: "Avaliação atualizada", DESATUALIZADA: "Avaliação desatualizada", NAO_AVALIADO: "Avaliação ainda não realizada", FALHA: "A avaliação não foi concluída" } as Record<string, string>)[alertas.cobertura.estado] ?? "Cobertura não informada"}. ${alertas.cobertura.diaCoberto ? `Dia coberto: ${dataBR(alertas.cobertura.diaCoberto)}.` : "Sem dia coberto; a lista pode estar incompleta."}`,
      fonte: fonte(
        "Alertas · atenção",
        "/pecuaria/rebanho/alertas?disposicao=ATENCAO",
      ),
    });
    // Só expomos contagem e títulos operacionais; motivo/resumo livre não segue para IA.
    for (const a of alertas.itens)
      r.prioridades.push({
        id: `sanidade:${a.chave}`,
        titulo: a.titulo,
        descricao: `${plural(a.necessidades, "necessidade registrada", "necessidades registradas")} em ${plural(a.animais, "animal", "animais")}.`,
        fonte: fonte(
          "Alertas · grupo registrado",
          `/pecuaria/rebanho/alertas/participantes?disposicao=ATENCAO&cuidado=${encodeURIComponent(a.chave)}`,
        ),
        pergunta: `Como conferir o alerta ${a.titulo}?`,
      });
  }
  if (podeConsultarFinanceiro(ctx, "pagar")) {
    const fim = new Date(`${dia}T23:59:59.999Z`);
    const inicio = new Date(
      new Date(`${dia}T00:00:00Z`).getTime() - 29 * 86400000,
    );
    const cs = (
      await listarCompromissos(ctx.propriedadeId, { inicio, fim })
    ).filter(
      (c) => c.tipo === "PAGAR" && ["PENDENTE", "PARCIAL"].includes(c.status),
    );
    const url = `/financeiro/compromissos?inicio=${inicio.toISOString().slice(0, 10)}&fim=${dia}&situacao=pagar`;
    r.leitura.push({
      titulo: "Vencimentos financeiros",
      texto: `${plural(cs.length, "compromisso a pagar pendente", "compromissos a pagar pendentes")} com vencimento nos últimos 30 dias.`,
      fonte: fonte("Compromissos · período consultado", url),
    });
    if (cs.length)
      r.prioridades.push({
        id: "financeiro:vencimentos",
        titulo: "Conferir compromissos a pagar",
        descricao: `${plural(cs.length, "compromisso pendente", "compromissos pendentes")} com vencimento nos últimos 30 dias.`,
        fonte: fonte("Compromissos · período consultado", url),
        pergunta: `Quais os compromissos a pagar de ${inicio.toISOString().slice(0, 10)} até ${dia}?`,
      });
    r.cobertura.push({
      titulo: "Financeiro",
      texto:
        "Pendências por vencimento nos últimos 30 dias. Saldos e resultado realizado não entram nesta leitura.",
      fonte: fonte("Compromissos · período consultado", url),
    });
  }
  r.sintese.texto = r.leitura.length
    ? `${plural(r.prioridades.length, "prioridade", "prioridades")} a partir dos registros que você pode consultar. Confira as fontes antes de decidir.`
    : "Não há fontes habilitadas para este acesso. Solicite ao administrador a revisão das permissões.";
  return r;
}
