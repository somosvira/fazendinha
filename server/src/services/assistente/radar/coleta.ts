import { prisma } from "../../../db.js";
import { temArea } from "../../auth/papeis.js";
import { hojeLocal, podeConsultarFinanceiro } from "../financeiro.js";
import { listarCompromissos } from "../../financeiro/operacoes.js";
import {
  consultarAlertas,
  consultaAlertasSchema,
} from "../../pecuaria/sanidade/alertas/consulta-alertas.js";
import type { ContextoAssistente } from "../tipos.js";
import type { PrioridadeRadar, RadarDTO, UrgenciaRadar } from "./tipos.js";
import { calcularVolumeGeral, incluirDiaGeral } from "../metas/leite.js";
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const dataBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const diaMes = (iso: string) => dataBR(iso).slice(0, 5);
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const somarDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const ORDEM: Record<UrgenciaRadar, number> = { atrasado: 0, hoje: 1, semana: 2, depois: 3 };
/** Prazo relativo ao dia do Radar: o que já passou vem antes do que vence hoje e depois. */
function urgencia(data: string | null, dia: string): Pick<PrioridadeRadar, "urgencia" | "prazo"> {
  if (!data || data === dia) return { urgencia: "hoje", prazo: "Hoje" };
  if (data < dia) return { urgencia: "atrasado", prazo: `Atrasado desde ${diaMes(data)}` };
  return data <= somarDias(dia, 7) ? { urgencia: "semana", prazo: `Até ${diaMes(data)}` } : { urgencia: "depois", prazo: `Até ${diaMes(data)}` };
}

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
        include: incluirDiaGeral,
      }),
      consultarAlertas(
        ctx.propriedadeId,
        consultaAlertasSchema.parse({ disposicao: "ATENCAO", tamanho: 5 }),
        ctx.agora,
      ),
    ]);
    r.leitura.push({
      titulo: "Rebanho",
      valor: plural(animais, "animal", "animais"),
      texto: "Com localização aberta hoje.",
      fonte: fonte("Rebanho · localização atual", "/pecuaria/rebanho/animais"),
    });
    if (leite && ctx.propriedadeId != null) {
      // O volume só aparece quando o dia fecha com todas as parcelas confirmadas.
      let volume: number | null = null;
      try { volume = calcularVolumeGeral(leite).valor; } catch { /* dia sem apuração completa */ }
      r.leitura.push({
        titulo: "Produção do último dia",
        valor: volume == null ? "Sem apuração" : `${volume.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`,
        texto: volume == null ? `${dataBR(leite.dataOperacional.toISOString())} · parcelas a confirmar` : dataBR(leite.dataOperacional.toISOString()),
        fonte: fonte("Leite · ordenha", `/pecuaria/leite?leiteSecao=ordenhas&leiteModo=geral&ordenhasInicio=${leite.dataOperacional.toISOString().slice(0, 10)}&ordenhasFim=${leite.dataOperacional.toISOString().slice(0, 10)}`),
      });
    }
    r.leitura.push({
      titulo: "Pesagens de hoje",
      valor: `${pesados} de ${animais}`,
      texto: "Animais com pesagem registrada hoje.",
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
        descricao: `${plural(a.necessidades, "necessidade em aberto", "necessidades em aberto")} em ${plural(a.animais, "animal", "animais")}.`,
        ...urgencia(a.primeiraData, dia),
        quantidade: a.animais ? { valor: a.animais, unidade: a.animais === 1 ? "animal" : "animais" } : { valor: a.necessidades, unidade: a.necessidades === 1 ? "necessidade" : "necessidades" },
        acao: "Abrir",
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
    const total = (lista: typeof cs) => lista.reduce((s, c) => s + Number(c.saldoPendente), 0);
    const nomes = (lista: typeof cs) => [...new Set(lista.map(c => c.parceiro?.nome).filter(Boolean))].slice(0, 3).join(", ");
    const vencidos = cs.filter(c => c.dataVencimento.toISOString().slice(0, 10) < dia).sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime());
    const deHoje = cs.filter(c => c.dataVencimento.toISOString().slice(0, 10) === dia);
    if (vencidos.length)
      r.prioridades.push({
        id: "financeiro:vencidos",
        titulo: vencidos.length === 1 ? "Compromisso a pagar vencido" : "Compromissos a pagar vencidos",
        descricao: [nomes(vencidos), moeda(total(vencidos))].filter(Boolean).join(" · "),
        ...urgencia(vencidos[0].dataVencimento.toISOString().slice(0, 10), dia),
        quantidade: { valor: vencidos.length, unidade: vencidos.length === 1 ? "conta" : "contas" },
        acao: "Abrir",
        fonte: fonte("Compromissos · vencidos", url),
        pergunta: `Quais os compromissos a pagar de ${inicio.toISOString().slice(0, 10)} até ${dia}?`,
      });
    if (deHoje.length)
      r.prioridades.push({
        id: "financeiro:hoje",
        titulo: deHoje.length === 1 ? "Conta a pagar hoje" : "Contas a pagar hoje",
        descricao: [nomes(deHoje), moeda(total(deHoje))].filter(Boolean).join(" · "),
        urgencia: "hoje", prazo: "Hoje",
        quantidade: { valor: deHoje.length, unidade: deHoje.length === 1 ? "conta" : "contas" },
        acao: "Abrir",
        fonte: fonte("Compromissos · hoje", `/financeiro/compromissos?inicio=${dia}&fim=${dia}&situacao=pagar`),
        pergunta: `Quais os compromissos a pagar em ${dia}?`,
      });
    const amanha = somarDias(dia, 1), fimSemana = somarDias(dia, 7);
    const semana = (await listarCompromissos(ctx.propriedadeId, { inicio: new Date(`${amanha}T00:00:00Z`), fim: new Date(`${fimSemana}T23:59:59.999Z`) }))
      .filter((c) => c.tipo === "PAGAR" && ["PENDENTE", "PARCIAL"].includes(c.status));
    if (semana.length)
      r.prioridades.push({
        id: "financeiro:semana",
        titulo: "Contas a pagar nos próximos 7 dias",
        descricao: [nomes(semana), moeda(total(semana))].filter(Boolean).join(" · "),
        urgencia: "semana", prazo: `Até ${diaMes(fimSemana)}`,
        quantidade: { valor: semana.length, unidade: semana.length === 1 ? "conta" : "contas" },
        acao: "Abrir",
        fonte: fonte("Compromissos · próximos 7 dias", `/financeiro/compromissos?inicio=${amanha}&fim=${fimSemana}&situacao=pagar`),
        pergunta: `Quais os compromissos a pagar de ${amanha} até ${fimSemana}?`,
      });
    r.cobertura.push({
      titulo: "Financeiro",
      texto:
        "Pendências por vencimento nos últimos 30 dias. Saldos e resultado realizado não entram nesta leitura.",
      fonte: fonte("Compromissos · período consultado", url),
    });
  }
  r.prioridades.sort((a, b) => ORDEM[a.urgencia ?? "depois"] - ORDEM[b.urgencia ?? "depois"]);
  r.sintese.texto = r.leitura.length
    ? `${plural(r.prioridades.length, "prioridade", "prioridades")} a partir dos registros que você pode consultar. Confira as fontes antes de decidir.`
    : "Não há fontes habilitadas para este acesso. Solicite ao administrador a revisão das permissões.";
  return r;
}
