import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { toAnimalDTO } from "./animais.mappers.js";

const row: any = {
  id: 7, numero: "1234", nome: "Jurema", sexo: "F", categoria: "VACA",
  raca: { id: 1, nome: "Girolando 5/8" }, grauSangue: "Girolando 5/8",
  dataNascimento: new Date("2020-03-12"), dataEntrada: new Date("2020-03-12"),
  brincoEletronico: "982", sisbov: null,
  mae: { id: 3, numero: "0871", nome: "Jandira" }, maeId: 3, paiNome: "Lance 612",
  grupo: { id: 1, nome: "Alta Produção" }, grupoId: 1, setor: "Galpão 2",
  status: "ATIVO", dataBaixa: null, motivoBaixa: null,
  resumo: { statusReprodutivo: "PRENHE", del: 145, ordemLactacao: 3, producaoMediaDia: new Prisma.Decimal("28.00"), producao305: 8900, ccs: 512, ccsTendencia: "subindo", ultimoDgData: new Date("2026-05-28"), ultimoDgResultado: "positivo", iepProjetado: 395, diasGestacao: 30, previsaoSecagem: new Date("2026-12-12") },
};

describe("toAnimalDTO", () => {
  it("serializa ids como string, datas como ISO e Decimal como number", () => {
    const dto = toAnimalDTO(row);
    expect(dto.id).toBe("7");
    expect(dto.raca).toBe("Girolando 5/8");
    expect(dto.maeId).toBe("3");
    expect(dto.maeNumero).toBe("0871");
    expect(dto.grupoNome).toBe("Alta Produção");
    expect(dto.ativo).toBe(true);
    expect(dto.dataNascimento).toBe("2020-03-12");
    expect(dto.resumo?.producaoMediaDia).toBe(28);
    expect(typeof dto.resumo?.producaoMediaDia).toBe("number");
  });
  it("serializa a última pesagem como ultimoPesoKg (number) e null quando não há pesagem", () => {
    const com = toAnimalDTO({ ...row, pesagens: [{ id: 1, data: new Date("2026-06-01"), peso: new Prisma.Decimal("512.50") }] });
    expect(com.ultimoPesoKg).toBe(512.5);
    expect(typeof com.ultimoPesoKg).toBe("number");
    expect(toAnimalDTO(row).ultimoPesoKg).toBeNull();               // sem include
    expect(toAnimalDTO({ ...row, pesagens: [] }).ultimoPesoKg).toBeNull(); // include vazio
  });
  it("lida com relações nulas", () => {
    const dto = toAnimalDTO({ ...row, raca: null, grupo: null, mae: null, maeId: null, resumo: null, status: "BAIXADO", dataBaixa: new Date("2026-06-01"), motivoBaixa: "venda" });
    expect(dto.raca).toBeNull();
    expect(dto.grupoNome).toBeNull();
    expect(dto.maeId).toBeNull();
    expect(dto.ativo).toBe(false);
    expect(dto.dataBaixa).toBe("2026-06-01");
    expect(dto.resumo).toBeNull();
  });
});
