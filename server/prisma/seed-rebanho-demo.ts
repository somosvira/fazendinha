// Seed de demonstração do Rebanho (pecuária v1) para teste manual da interface.
//
// Passa pelos próprios services (cadastrar, movimentar, mudarDestino, darSaida...), então
// histórico, auditoria e categoria saem exatamente como sairiam pela tela. Cobre todas as
// entidades do schema `pecuaria`: Raca, ComposicaoRacial, Lote, Animal, LocalizacaoAnimal,
// DestinoAnimal, Movimentacao (com desfazer), SaidaAnimal (com estorno), MotivoSaida, Pesagem e AuditoriaPecuaria.
//
// Datas relativas a hoje, para as categorias (bezerra/novilha/garrote...) não envelhecerem.
// Pré-requisito: `seed:pecuaria` (raças, motivos e sítios). Não roda duas vezes (checa o brinco V101).

import { prisma } from "../src/db.js";
import { RebanhoError } from "../src/services/pecuaria/rebanho/regras.js";
import {
  cadastrar, movimentar, mudarDestino, desfazerLocalizacao, desfazerDestino, desfazerMovimentacao,
  darSaida, estornarSaida, registrarPesagem, editarPesagem, excluirPesagem,
} from "../src/services/pecuaria/rebanho/animais.js";
import { criarLote, editarLote } from "../src/services/pecuaria/rebanho/lotes.js";
import { criarRaca, editarRaca } from "../src/services/pecuaria/rebanho/racas.js";
import { criarMotivoSaida, editarMotivoSaida } from "../src/services/pecuaria/rebanho/motivos.js";
import type { CadastrarAnimalInput } from "../src/services/pecuaria/rebanho/schemas.js";

const USUARIO = null; // sem usuários no banco de dev: autoria vazia, como o dono sintético

const hoje = new Date();
/** Data ISO `meses` + `dias` antes de hoje, pelo calendário local (à noite no Brasil o UTC já é amanhã). */
function atras(meses: number, dias = 0): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - meses, hoje.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  if (await prisma.animal.findFirst({ where: { brinco: "V101" } })) {
    console.log("Seed do rebanho já aplicado (brinco V101 existe). Nada a fazer.");
    return;
  }

  // ---------- catálogos (vindos do seed:pecuaria) ----------
  const sitios = await prisma.propriedade.findMany({ where: { nome: { in: ["Principal", "Mexicana", "Carlos Alves", "São Francisco"] } } });
  const sitio = (nome: string) => {
    const s = sitios.find((p) => p.nome === nome);
    if (!s) throw new Error(`Sítio "${nome}" não existe — rode seed:pecuaria antes`);
    return s.id;
  };
  const P = sitio("Principal"), M = sitio("Mexicana"), C = sitio("Carlos Alves"), S = sitio("São Francisco");

  // raça nova usada em composição + raça criada e desativada (aparece em "mostrar inativos")
  await criarRaca({ nome: "Sindi", sigla: "SD", base: true }, USUARIO);
  const caracu = await criarRaca({ nome: "Caracu", sigla: "CR", base: true }, USUARIO);
  await editarRaca(caracu.id, { ativo: false }, USUARIO);

  const racas = await prisma.raca.findMany({ where: { ativo: true } });
  const raca = (sigla: string) => {
    const r = racas.find((x) => x.sigla === sigla);
    if (!r) throw new Error(`Raça ${sigla} não existe — rode seed:pecuaria antes`);
    return r.id;
  };
  const comp = (...partes: Array<[string, number]>) => partes.map(([sigla, fracao64]) => ({ racaId: raca(sigla), fracao64 }));

  // motivo novo usado numa saída + motivo criado e desativado
  const descarte = await criarMotivoSaida({ nome: "Descarte reprodutivo", tipo: "VENDA" }, USUARIO);
  const cobra = await criarMotivoSaida({ nome: "Picada de cobra", tipo: "MORTE" }, USUARIO);
  await editarMotivoSaida(cobra.id, { ativo: false }, USUARIO);

  const motivos = await prisma.motivoSaida.findMany({ where: { ativo: true } });
  const motivo = (nome: string) => {
    const m = motivos.find((x) => x.nome === nome);
    if (!m) throw new Error(`Motivo "${nome}" não existe — rode seed:pecuaria antes`);
    return m.id;
  };

  // ---------- lotes ----------
  const lote = async (nome: string, propriedadeId: number, observacao: string | null = null) =>
    (await criarLote({ nome, propriedadeId, observacao }, USUARIO)).id;
  const lactacao = await lote("Vacas em lactação", P, "Ordenha 2x ao dia");
  const secas = await lote("Vacas secas", P);
  const bezerreiro = await lote("Bezerreiro", P);
  const recria = await lote("Recria de novilhas", M);
  const receptoras = await lote("Receptoras", M, "Aguardando protocolo de TE");
  const engorda = await lote("Engorda", C);
  const touros = await lote("Touros", S);
  const antigo = await lote("Piquete 7 (antigo)", P, "Piquete reformado");
  await editarLote(antigo, { ativo: false }, USUARIO); // lote vazio desativado

  // ---------- animais ----------
  const ids: Record<string, string> = {};
  const novo = async (input: Omit<CadastrarAnimalInput, "nascimentoEstimado" | "partosAntesDaEntrada" | "papelReprodutivo" | "composicao"> & Partial<CadastrarAnimalInput>) => {
    const a = await cadastrar({
      nascimentoEstimado: false, partosAntesDaEntrada: 0, papelReprodutivo: "NENHUM", composicao: [], ...input,
    } as CadastrarAnimalInput, USUARIO);
    ids[input.brinco] = a.id;
    return a.id;
  };
  const pesar = (brinco: string, data: string, pesoKg: number, tipo: "NASCIMENTO" | "ENTRADA" | "DESMAMA" | "ROTINA" | "SAIDA" = "ROTINA", origem: "MANUAL" | "BALANCA" = "BALANCA") =>
    registrarPesagem({ animalId: ids[brinco], data, pesoKg, tipo, origem }, USUARIO);

  // Vacas (compradas com partos anteriores → categoria VACA)
  await novo({ brinco: "V101", nome: "Estrela", sexo: "F", dataNascimento: atras(72), origem: "COMPRADO", dataEntrada: atras(36), partosAntesDaEntrada: 3,
    propriedadeId: P, loteId: lactacao, aptidao: "LEITE", composicao: comp(["HO", 48], ["GO", 16]), pesoEntradaKg: 520,
    sisbov: "BR105000000101", brincoEletronico: "982000100000101", observacao: "3/4 Holandês, boa produtora" });
  await novo({ brinco: "V102", nome: "Mimosa", sexo: "F", dataNascimento: atras(60), origem: "COMPRADO", dataEntrada: atras(24), partosAntesDaEntrada: 2,
    propriedadeId: P, loteId: lactacao, aptidao: "LEITE", composicao: comp(["GL", 64]), pesoEntradaKg: 480, brincoEletronico: "982000100000102" });
  await novo({ brinco: "V103", nome: "Pintada", sexo: "F", dataNascimento: atras(84), origem: "COMPRADO", dataEntrada: atras(48), partosAntesDaEntrada: 4,
    propriedadeId: P, loteId: lactacao, aptidao: "LEITE", composicao: comp(["HO", 64]), pesoEntradaKg: 560 });
  await novo({ brinco: "V104", nome: "Jóia", sexo: "F", dataNascimento: atras(48), origem: "COMPRADO", dataEntrada: atras(18), partosAntesDaEntrada: 1,
    propriedadeId: P, loteId: secas, aptidao: "LEITE", composicao: comp(["JE", 32], ["HO", 32]), pesoEntradaKg: 410 });
  await novo({ brinco: "D201", nome: "Rainha", sexo: "F", dataNascimento: atras(60), origem: "COMPRADO", dataEntrada: atras(30), partosAntesDaEntrada: 2,
    propriedadeId: P, loteId: lactacao, aptidao: "LEITE", papelReprodutivo: "DOADORA", composicao: comp(["GO", 64]), pesoEntradaKg: 450,
    sisbov: "BR105000000201", observacao: "Doadora de embriões Gir Leiteiro" });

  // Novilhas nascidas na fazenda (entrada = nascimento), recriadas na Mexicana
  await novo({ brinco: "N301", sexo: "F", dataNascimento: atras(20), origem: "NASCIDO", dataEntrada: atras(20),
    propriedadeId: P, loteId: bezerreiro, aptidao: "LEITE", composicao: comp(["HO", 40], ["GO", 24]) });
  await novo({ brinco: "N302", sexo: "F", dataNascimento: atras(16), origem: "NASCIDO", dataEntrada: atras(16),
    propriedadeId: P, loteId: bezerreiro, aptidao: "LEITE", composicao: comp(["HO", 32], ["GO", 32]) });
  // Novilha comprada já como receptora, nascimento estimado, composição parcial (48/64 conhecidos)
  await novo({ brinco: "R303", sexo: "F", dataNascimento: atras(30), nascimentoEstimado: true, origem: "COMPRADO", dataEntrada: atras(10),
    propriedadeId: M, loteId: receptoras, aptidao: "LEITE", papelReprodutivo: "RECEPTORA", composicao: comp(["SD", 32], ["HO", 16]), pesoEntradaKg: 360 });

  // Bezerros
  await novo({ brinco: "B401", sexo: "F", dataNascimento: atras(3), origem: "NASCIDO", dataEntrada: atras(3),
    propriedadeId: P, loteId: bezerreiro, aptidao: "LEITE", composicao: comp(["HO", 48], ["GO", 16]) });
  await novo({ brinco: "B402", sexo: "M", dataNascimento: atras(4), origem: "NASCIDO", dataEntrada: atras(4),
    propriedadeId: P, loteId: bezerreiro, aptidao: "LEITE", composicao: comp(["HO", 32], ["GO", 32]) });

  // Garrotes de corte na Carlos Alves
  await novo({ brinco: "G501", sexo: "M", dataNascimento: atras(18), nascimentoEstimado: true, origem: "COMPRADO", dataEntrada: atras(12),
    propriedadeId: C, loteId: engorda, aptidao: "CORTE", composicao: comp(["NE", 64]), pesoEntradaKg: 180 });
  await novo({ brinco: "G502", sexo: "M", dataNascimento: atras(20), origem: "COMPRADO", dataEntrada: atras(12),
    propriedadeId: C, loteId: engorda, aptidao: "CORTE", composicao: comp(["NE", 32], ["AN", 32]), pesoEntradaKg: 195 });
  await novo({ brinco: "G503", sexo: "M", dataNascimento: atras(22), origem: "COMPRADO", dataEntrada: atras(12),
    propriedadeId: C, loteId: engorda, aptidao: "CORTE", composicao: comp(["NE", 64]), pesoEntradaKg: 210 });
  await novo({ brinco: "G504", sexo: "M", dataNascimento: atras(23), origem: "COMPRADO", dataEntrada: atras(12),
    propriedadeId: C, loteId: engorda, aptidao: "CORTE", composicao: comp(["NE", 48], ["AN", 16]), pesoEntradaKg: 220 });

  // Touros na São Francisco
  await novo({ brinco: "T601", nome: "Imperador", sexo: "M", dataNascimento: atras(48), origem: "COMPRADO", dataEntrada: atras(24),
    propriedadeId: S, loteId: touros, aptidao: "LEITE", composicao: comp(["GO", 64]), pesoEntradaKg: 610, sisbov: "BR105000000601" });
  await novo({ brinco: "T602", nome: "Barão", sexo: "M", dataNascimento: atras(36), origem: "COMPRADO", dataEntrada: atras(14),
    propriedadeId: S, loteId: touros, aptidao: "CORTE", composicao: comp(["AN", 64]), pesoEntradaKg: 640 });

  // Vacas que vão sair (morte, descarte) e uma com saída estornada
  await novo({ brinco: "V105", nome: "Serena", sexo: "F", dataNascimento: atras(96), origem: "COMPRADO", dataEntrada: atras(40), partosAntesDaEntrada: 5,
    propriedadeId: P, loteId: secas, aptidao: "LEITE", composicao: comp(["HO", 48], ["GO", 16]) });
  await novo({ brinco: "V106", nome: "Bonita", sexo: "F", dataNascimento: atras(108), origem: "COMPRADO", dataEntrada: atras(40), partosAntesDaEntrada: 6,
    propriedadeId: P, loteId: secas, aptidao: "LEITE", composicao: comp(["GL", 64]) });
  await novo({ brinco: "V107", nome: "Faceira", sexo: "F", dataNascimento: atras(54), origem: "COMPRADO", dataEntrada: atras(20), partosAntesDaEntrada: 2,
    propriedadeId: P, loteId: lactacao, aptidao: "LEITE", composicao: comp(["HO", 32], ["JE", 32]), pesoEntradaKg: 430 });

  // Cadastro errado (data de nascimento trocada) → saída "Cadastro indevido" → recadastro com o mesmo brinco
  await novo({ brinco: "B403", sexo: "F", dataNascimento: atras(14), origem: "NASCIDO", dataEntrada: atras(14),
    propriedadeId: P, loteId: bezerreiro, aptidao: "LEITE", observacao: "Lançado com a data errada" });
  const b403Errado = ids.B403;

  // ---------- movimentações ----------
  // em massa: as duas novilhas saem do bezerreiro para a recria na Mexicana
  await movimentar({ animalIds: [ids.N301, ids.N302], propriedadeId: M, loteId: recria, data: atras(8), motivo: "Desmama concluída, vão para a recria" }, USUARIO);
  // individual: Pintada secou
  await movimentar({ animalIds: [ids.V103], propriedadeId: P, loteId: secas, data: atras(1, 10), motivo: "Secagem" }, USUARIO);
  // em massa: vacas secas que pariram voltam para a lactação
  await movimentar({ animalIds: [ids.V104], propriedadeId: P, loteId: lactacao, data: atras(2), motivo: "Pariu" }, USUARIO);
  // touro de corte passa uma temporada na Carlos Alves e volta
  await movimentar({ animalIds: [ids.T602], propriedadeId: C, loteId: engorda, data: atras(6), motivo: "Estação de monta" }, USUARIO);
  await movimentar({ animalIds: [ids.T602], propriedadeId: S, loteId: touros, data: atras(2, 15), motivo: "Fim da estação de monta" }, USUARIO);
  // movimentação por engano, desfeita (fica só na auditoria)
  await movimentar({ animalIds: [ids.B401], propriedadeId: P, loteId: lactacao, data: atras(0), motivo: "Engano" }, USUARIO);
  await desfazerLocalizacao(ids.B401, USUARIO);
  // movimentação em massa para o lote errado, desfeita inteira (fica no histórico do lote como desfeita)
  const errada = await movimentar({ animalIds: [ids.G501, ids.G502], propriedadeId: S, loteId: touros, data: atras(0), motivo: "Lote errado" }, USUARIO);
  await desfazerMovimentacao(errada.movimentacaoId, "Destino digitado errado", USUARIO);

  // ---------- destino / papel reprodutivo ----------
  await mudarDestino({ animalId: ids.N302, aptidao: "LEITE", papelReprodutivo: "RECEPTORA", data: atras(1) }, USUARIO);
  await movimentar({ animalIds: [ids.N302], propriedadeId: M, loteId: receptoras, data: atras(1), motivo: "Entrou no programa de receptoras" }, USUARIO);
  await mudarDestino({ animalId: ids.B402, aptidao: "CORTE", papelReprodutivo: "NENHUM", data: atras(2) }, USUARIO); // macho leiteiro vai para corte
  // destino trocado por engano, desfeito
  await mudarDestino({ animalId: ids.N301, aptidao: "CORTE", papelReprodutivo: "NENHUM", data: atras(0) }, USUARIO);
  await desfazerDestino(ids.N301, USUARIO);

  // ---------- pesagens ----------
  await pesar("N301", atras(20), 36, "NASCIMENTO", "MANUAL");
  await pesar("N301", atras(17), 92, "DESMAMA");
  await pesar("N301", atras(14), 150);
  await pesar("N301", atras(8), 228);
  await pesar("N301", atras(2), 305);
  await pesar("N302", atras(16), 34, "NASCIMENTO", "MANUAL");
  await pesar("N302", atras(13), 88, "DESMAMA");
  await pesar("N302", atras(6), 210);
  await pesar("B401", atras(3), 38, "NASCIMENTO", "MANUAL");
  await pesar("B401", atras(1), 71);
  await pesar("B402", atras(4), 40, "NASCIMENTO", "MANUAL");
  await pesar("B402", atras(1), 105, "DESMAMA");
  await pesar("G501", atras(9), 236);
  await pesar("G501", atras(6), 291);
  const digitadaErrada = await pesar("G501", atras(3), 34); // faltou um zero
  await editarPesagem(digitadaErrada.id, { pesoKg: 340, observacao: "Corrigido: tinha sido digitado 34" }, USUARIO);
  await pesar("G501", atras(0, 7), 386);
  await pesar("G502", atras(6), 305);
  const duplicada = await pesar("G502", atras(6), 1800); // lançamento absurdo, removido de fato
  await excluirPesagem(duplicada.id, USUARIO);
  await pesar("G502", atras(0, 7), 402);
  await pesar("G503", atras(6), 318);
  await pesar("G504", atras(6), 330);
  await pesar("V101", atras(6), 535);
  await pesar("V101", atras(0, 5), 548);
  await pesar("T601", atras(3), 702);
  await pesar("T602", atras(3), 715);

  // ---------- saídas ----------
  await pesar("G503", atras(1), 452, "SAIDA");
  await darSaida({ animalId: ids.G503, data: atras(1), tipo: "VENDA", motivoId: motivo("Venda"), observacao: "Vendido ao frigorífico regional, 15 @" }, USUARIO);
  await pesar("G504", atras(0, 20), 470, "SAIDA");
  await darSaida({ animalId: ids.G504, data: atras(0, 20), tipo: "ABATE", motivoId: motivo("Abate"), observacao: "Abate para consumo da fazenda" }, USUARIO);
  await darSaida({ animalId: ids.V105, data: atras(2), tipo: "MORTE", motivoId: motivo("Pneumonia") }, USUARIO);
  await darSaida({ animalId: ids.V106, data: atras(0, 21), tipo: "VENDA", motivoId: descarte.id, observacao: "Idade avançada, 3 IAs sem prenhez" }, USUARIO);
  // saída estornada: V107 volta a ficar ativa na lactação
  await darSaida({ animalId: ids.V107, data: atras(0, 10), tipo: "VENDA", motivoId: motivo("Venda") }, USUARIO);
  await estornarSaida(ids.V107, { motivo: "Venda cancelada pelo comprador" }, USUARIO);
  // cadastro indevido e recadastro com o mesmo brinco no mesmo sítio
  await darSaida({ animalId: b403Errado, data: atras(0), tipo: "CADASTRO_INDEVIDO", motivoId: motivo("Cadastro indevido"), observacao: "Data de nascimento errada, recadastrado" }, USUARIO);
  await novo({ brinco: "B403", sexo: "F", dataNascimento: atras(2), origem: "NASCIDO", dataEntrada: atras(2),
    propriedadeId: P, loteId: bezerreiro, aptidao: "LEITE", composicao: comp(["HO", 48], ["GO", 16]) });

  // ---------- resumo ----------
  const [animais, saidasAtivas, pesagens, auditoria] = await Promise.all([
    prisma.animal.count(),
    prisma.saidaAnimal.count({ where: { estornadaEm: null } }),
    prisma.pesagem.count(),
    prisma.auditoriaPecuaria.count(),
  ]);
  console.log(`Seed do rebanho ok: ${animais} animais (${animais - saidasAtivas} ativos, ${saidasAtivas} com saída), ${pesagens} pesagens, ${auditoria} registros de auditoria.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    if (e instanceof RebanhoError) console.error(`RebanhoError ${e.code}: ${e.message}`);
    else console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
