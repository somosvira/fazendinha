// Seed de DEMONSTRAÇÃO do módulo Equipe & Ponto (RH leve). Idempotente:
//   - funcionários por upsert em chave natural (nome);
//   - registros do mês por upsert em (funcionarioId, data) — pode rodar N vezes.
//
// Gera um mês real (2026-05, mesmo pin de datas do app) de jornada para cada
// funcionário: dias úteis 07:00–17:00 (int 60 = 9h → 1h extra 50%), alguns dias
// mais longos, um domingo trabalhado (extra 100%) e folgas nos fins de semana —
// para a Folha mostrar extra50/extra100 e valorExtra reais.
//
//   pnpm --filter rionovo-server run seed:ponto

import { type TipoDiaPonto } from "@prisma/client";
import { prisma } from "../src/db.js";

const MES = "2026-05"; // âncora de datas do app

const FUNCIONARIOS = [
  { nome: "Marcos Vieira",     cargo: "Gerente da fazenda",   salarioMensal: 6500, cpf: "111.111.111-11", chavePix: "marcos@fazenda.com" },
  { nome: "José Ferreira",     cargo: "Tratorista",            salarioMensal: 2800, cpf: "222.222.222-22", chavePix: "22222222222" },
  { nome: "Antônio Silva",     cargo: "Ordenhador",            salarioMensal: 2200, cpf: "333.333.333-33", chavePix: "33333333333" },
  { nome: "Pedro Santos",      cargo: "Ordenhador",            salarioMensal: 2200, cpf: "444.444.444-44", chavePix: "44444444444" },
  { nome: "João Oliveira",     cargo: "Peão geral",            salarioMensal: 1800, cpf: "555.555.555-55", chavePix: "55555555555" },
  { nome: "Carla Mendes",      cargo: "Auxiliar administrativo", salarioMensal: 2600, cpf: "666.666.666-66", chavePix: "carla@fazenda.com" },
] as const;

// Todos com carga 220 h/mês e jornada 8 h/dia.
const CARGA_MENSAL = 220;
const JORNADA = 8;

interface DiaSeed {
  entrada: string | null;
  saida: string | null;
  intervaloMin: number;
  tipoDia: TipoDiaPonto;
}

// Retorna o dia da semana (0=domingo … 6=sábado) de "YYYY-MM-DD" em UTC.
function diaSemana(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Padrão diário por funcionário (index) — varia horas extras/domingos por pessoa
// para a Folha ficar heterogênea.
function padraoDia(iso: string, idx: number): DiaSeed {
  const dow = diaSemana(iso);
  const dia = Number(iso.slice(8, 10));

  // Domingo: gerente e tratorista trabalham no 1º domingo do mês (extra 100%);
  // os demais folgam.
  if (dow === 0) {
    const primeiroDomingo = dia <= 7;
    if (primeiroDomingo && (idx === 0 || idx === 1))
      return { entrada: "07:00", saida: "12:00", intervaloMin: 0, tipoDia: "DOMINGO" }; // 5h a 100%
    return { entrada: null, saida: null, intervaloMin: 0, tipoDia: "FOLGA" };
  }
  // Sábado: meio período (07:00–11:00 = 4h, sem extra), ou folga para o admin.
  if (dow === 6) {
    if (idx === 5) return { entrada: null, saida: null, intervaloMin: 0, tipoDia: "FOLGA" };
    return { entrada: "07:00", saida: "11:00", intervaloMin: 0, tipoDia: "UTIL" };
  }
  // Dia útil. Alguns funcionários fazem hora extra em dias específicos.
  // Padrão: 07:00–17:00 int 60 = 9h (1h extra 50%). Auxiliar admin: 08:00–17:00
  // int 60 = 8h (sem extra). Alguns dias mais longos (mutirão) 07:00–19:00 = 11h.
  const mutirao = (dia === 12 || dia === 20) && idx !== 5; // 2 dias de mutirão no campo
  if (idx === 5) return { entrada: "08:00", saida: "17:00", intervaloMin: 60, tipoDia: "UTIL" }; // 8h
  if (mutirao) return { entrada: "07:00", saida: "19:00", intervaloMin: 60, tipoDia: "UTIL" }; // 11h (3h extra50)
  return { entrada: "07:00", saida: "17:00", intervaloMin: 60, tipoDia: "UTIL" }; // 9h (1h extra50)
}

// Todos os dias do mês MES como "YYYY-MM-DD".
function diasDoMes(mes: string): string[] {
  const [y, m] = mes.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= ultimoDia; d++) out.push(`${mes}-${String(d).padStart(2, "0")}`);
  return out;
}

async function main() {
  // 1) Funcionários — upsert por nome (chave natural para idempotência do seed).
  const funcIds: number[] = [];
  for (const f of FUNCIONARIOS) {
    const data = {
      cargo: f.cargo,
      salarioMensal: f.salarioMensal,
      cargaMensalHoras: CARGA_MENSAL,
      jornadaDiariaHoras: JORNADA,
      dataAdmissao: new Date("2023-01-10"),
      cpf: f.cpf,
      chavePix: f.chavePix,
      ativo: true,
    };
    const existing = await prisma.funcionario.findFirst({ where: { nome: f.nome } });
    const row = existing
      ? await prisma.funcionario.update({ where: { id: existing.id }, data })
      : await prisma.funcionario.create({ data: { nome: f.nome, ...data } });
    funcIds.push(row.id);
  }

  // 2) Registros do mês — upsert por (funcionarioId, data). Idempotente.
  const dias = diasDoMes(MES);
  let registrosCriados = 0;
  for (let idx = 0; idx < funcIds.length; idx++) {
    const funcionarioId = funcIds[idx];
    for (const iso of dias) {
      const p = padraoDia(iso, idx);
      const data = new Date(iso);
      const payload = {
        entrada: p.entrada,
        saida: p.saida,
        intervaloMin: p.intervaloMin,
        tipoDia: p.tipoDia,
        observacao: null,
      };
      await prisma.registroPonto.upsert({
        where: { funcionarioId_data: { funcionarioId, data } },
        update: payload,
        create: { funcionarioId, data, ...payload },
      });
      registrosCriados++;
    }
  }

  console.log(
    `Seed ponto ok: ${FUNCIONARIOS.length} funcionários, ${registrosCriados} registros de ponto (mês ${MES}).`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
