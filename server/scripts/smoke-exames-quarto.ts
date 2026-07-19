// Smoke local (Postgres local): registra uma passada CMT com quarto crônico e confere a agregação
// em ResumoAnimal + a série por quarto. Idempotente-ish: limpa os ExameQuarto que cria ao final.
import { prisma } from "../src/db.js";
import { registrarExameQuarto, listarSaudeUbere } from "../src/services/rebanho/exames-quarto.js";

async function main() {
  const animal = await prisma.animal.findFirst({ where: { status: "ATIVO" }, select: { id: true, numero: true } });
  if (!animal) { console.log("SKIP: nenhum animal ATIVO no banco local"); return; }
  console.log(`animal #${animal.numero} (id ${animal.id})`);

  // 3 positivos no quarto PE em datas recentes → deve virar crônico.
  const hoje = new Date();
  const d = (offset: number) => new Date(hoje.getTime() - offset * 86400000).toISOString().slice(0, 10);
  await registrarExameQuarto(animal.id, { data: d(200), quartos: [{ quarto: "PE", scoreCmt: "DUAS_CRUZES", ccs: 900 }] });
  await registrarExameQuarto(animal.id, { data: d(90), quartos: [{ quarto: "PE", scoreCmt: "TRES_CRUZES" }] });
  const saude = await registrarExameQuarto(animal.id, { data: d(5), quartos: [{ quarto: "PE", scoreCmt: "DUAS_CRUZES", ccs: 850 }, { quarto: "AE", scoreCmt: "NEGATIVO" }] });

  console.log("porQuarto.PE:", saude.porQuarto.PE);
  console.log("quartosCronicos:", saude.quartosCronicos, "| quartosPerdidos:", saude.quartosPerdidos);
  console.log("total exames:", saude.exames.length);

  const resumo = await prisma.resumoAnimal.findUnique({ where: { animalId: animal.id }, select: { quartosCronicos: true, quartosPerdidos: true } });
  console.log("ResumoAnimal:", resumo);

  const ok = saude.porQuarto.PE.estado === "CRONICO" && saude.quartosCronicos === 1 && resumo?.quartosCronicos === 1;
  console.log(ok ? "\n✅ SMOKE OK — quarto PE crônico agregado no resumo" : "\n❌ SMOKE FALHOU");

  // limpeza
  await prisma.exameQuarto.deleteMany({ where: { animalId: animal.id } });
  const { recomputarSanidade } = await import("../src/services/rebanho/eventos-sanidade.js");
  await recomputarSanidade(animal.id);
  await prisma.$disconnect();
  if (!ok) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
