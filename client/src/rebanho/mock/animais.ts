import type { Animal, ResumoAnimal } from "../types";

export const animais: Animal[] = [
  { id: "1234", numero: "1234", nome: "Jurema", sexo: "F", categoria: "VACA", raca: "Girolando 5/8", dataNascimento: "2020-03-12", dataEntrada: "2020-03-12", brincoEletronico: "982000123456789", maeId: "0871", paiNome: "Lance 612", grupoAtual: "Alta Produção", setor: "Galpão 2", ativo: true },
  { id: "1188", numero: "1188", nome: "Aurora", sexo: "F", categoria: "VACA", raca: "Girolando 1/2", dataNascimento: "2021-06-02", dataEntrada: "2021-06-02", grupoAtual: "Alta Produção", ativo: true },
  { id: "0942", numero: "0942", nome: "Bonita", sexo: "F", categoria: "VACA", raca: "Holandês", dataNascimento: "2020-09-18", dataEntrada: "2020-09-18", grupoAtual: "Média Produção", ativo: true },
  { id: "1305", numero: "1305", nome: "Cravina", sexo: "F", categoria: "VACA", raca: "Girolando 3/4", dataNascimento: "2021-01-05", dataEntrada: "2021-01-05", grupoAtual: "Média Produção", ativo: true },
  { id: "0877", numero: "0877", nome: "Dália", sexo: "F", categoria: "VACA", raca: "Girolando 5/8", dataNascimento: "2020-04-22", dataEntrada: "2020-04-22", grupoAtual: "Alta Produção", ativo: true },
  { id: "1421", numero: "1421", nome: "Estrela", sexo: "F", categoria: "VACA", raca: "Holandês", dataNascimento: "2021-08-30", dataEntrada: "2021-08-30", grupoAtual: "Média Produção", ativo: true },
  { id: "0871", numero: "0871", nome: "Jandira", sexo: "F", categoria: "VACA", raca: "Girolando 5/8", dataNascimento: "2018-02-10", dataEntrada: "2018-02-10", grupoAtual: "Alta Produção", ativo: true },
  { id: "1442", numero: "1442", nome: "Bezerra 1442", sexo: "F", categoria: "BEZERRA", raca: "Girolando 9/16", dataNascimento: "2026-01-22", dataEntrada: "2026-01-22", maeId: "1234", paiNome: "Lance 884", grupoAtual: "Bezerreiro", ativo: true },
];

export const resumos: ResumoAnimal[] = [
  { animalId: "1234", statusReprodutivo: "PRENHE", del: 145, ordemLactacao: 3, producaoMediaDia: 28, producao305: 8900, ccs: 512, ccsTendencia: "subindo", ultimoDgData: "2026-05-28", ultimoDgResultado: "positivo", iepProjetado: 395, diasGestacao: 30, previsaoSecagem: "2026-12-12", ultimaInseminacao: "2026-04-28", protocoloAtual: "IATF 11d" },
  { animalId: "1188", statusReprodutivo: "PEV", del: 72, ordemLactacao: 2, producaoMediaDia: 31, ccs: 180, ccsTendencia: "estavel", protocoloAtual: "IATF 11d (D0)" },
  { animalId: "0942", statusReprodutivo: "VAZIA", del: 96, ordemLactacao: 3, producaoMediaDia: 24, ccs: 240, ccsTendencia: "estavel", ultimoDgData: "2026-05-14", ultimoDgResultado: "negativo", protocoloAtual: "IATF 11d (D9)" },
  { animalId: "1305", statusReprodutivo: "VAZIA", del: 110, ordemLactacao: 2, producaoMediaDia: 22, ccs: 300, ccsTendencia: "subindo", ultimoDgData: "2026-05-02", ultimoDgResultado: "negativo" },
  { animalId: "0877", statusReprodutivo: "PEV", del: 68, ordemLactacao: 4, producaoMediaDia: 33, ccs: 150, ccsTendencia: "estavel" },
  { animalId: "1421", statusReprodutivo: "VAZIA", del: 83, ordemLactacao: 1, producaoMediaDia: 26, ccs: 210, ccsTendencia: "estavel", ultimoDgData: "2026-05-20", ultimoDgResultado: "negativo" },
  { animalId: "0871", statusReprodutivo: "PRENHE", del: 210, ordemLactacao: 4, producaoMediaDia: 21, ccs: 130, ccsTendencia: "estavel", iepProjetado: 402, diasGestacao: 95, previsaoSecagem: "2026-09-30" },
];
