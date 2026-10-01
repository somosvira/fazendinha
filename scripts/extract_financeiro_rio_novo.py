#!/usr/bin/env python3
"""Extrai, sem perda, a base financeira Rio Novo do cache do Excel.

O arquivo gerado e um artefato de preparacao: mantem todos os campos da linha
original e acrescenta somente normalizacoes deterministicas. Ele nao acessa o
banco e nunca decide sozinho quais registros serao aplicados.

Uso:
    python3 scripts/extract_financeiro_rio_novo.py origem.xlsx saida.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import zipfile
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any
import xml.etree.ElementTree as ET

from extract_rio_novo import build_cache


DEFINITION = "xl/pivotCache/pivotCacheDefinition3.xml"
RECORDS = "xl/pivotCache/pivotCacheRecords3.xml"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
DOIS_CENTAVOS = Decimal("0.01")


def texto(valor: Any) -> str | None:
    if valor is None:
        return None
    normalizado = str(valor).strip()
    return normalizado or None


def data_iso(valor: Any) -> str | None:
    valor_texto = texto(valor)
    if not valor_texto:
        return None
    candidato = valor_texto[:10]
    try:
        return datetime.strptime(candidato, "%Y-%m-%d").date().isoformat()
    except ValueError:
        return None


def dinheiro(valor: Any) -> str | None:
    valor_texto = texto(valor)
    if valor_texto is None:
        return None
    try:
        decimal = abs(Decimal(valor_texto)).quantize(DOIS_CENTAVOS, rounding=ROUND_HALF_UP)
    except InvalidOperation:
        return None
    return format(decimal, ".2f")


def inteiro(valor: Any) -> int | None:
    valor_texto = texto(valor)
    if valor_texto is None:
        return None
    try:
        return int(Decimal(valor_texto))
    except (InvalidOperation, ValueError):
        return None


def sha256_arquivo(caminho: Path) -> str:
    resumo = hashlib.sha256()
    with caminho.open("rb") as arquivo:
        for bloco in iter(lambda: arquivo.read(1024 * 1024), b""):
            resumo.update(bloco)
    return resumo.hexdigest()


def sha256_linha(indice: int, origem: dict[str, Any]) -> str:
    serializado = json.dumps(
        {"indiceCache": indice, "origem": origem},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(serializado.encode("utf-8")).hexdigest()


def data_excel_iso(valor: str | None) -> str | None:
    """Converte serial de data do Excel (epoch 1899-12-30) para UTC."""
    if not valor:
        return None
    try:
        instante = datetime(1899, 12, 30, tzinfo=timezone.utc) + timedelta(days=float(valor))
    except ValueError:
        return None
    return instante.isoformat().replace("+00:00", "Z")


def natureza(rec: dict[str, Any]) -> str | None:
    valor = texto(rec.get("eCreditoDebito") or rec.get("*C/D"))
    if valor in {"Credito", "C"}:
        return "CREDITO"
    if valor in {"Debito", "D"}:
        return "DEBITO"
    return None


def situacao(rec: dict[str, Any]) -> str:
    return {
        "Liquidado": "LIQUIDADO",
        "Aberto": "ABERTO",
        "LiquidadoParcial": "LIQUIDADO_PARCIAL",
    }.get(texto(rec.get("eSituacao")), "DESCONHECIDA")


def normalizar_linha(indice: int, rec: dict[str, Any]) -> dict[str, Any]:
    origem = {campo: rec.get(campo) for campo in rec}
    situacao_normalizada = situacao(rec)
    valor_realizado = dinheiro(rec.get("vLiquidacao")) if situacao_normalizada == "LIQUIDADO" else None
    return {
        "indiceCache": indice,
        "hashLinha": sha256_linha(indice, origem),
        "competencia": data_iso(rec.get("dCompetencia")) or data_iso(rec.get("*Dt Comp")),
        "vencimento": data_iso(rec.get("dVencto")) or data_iso(rec.get("*Dt Vcto/Pgto")),
        "liquidacao": data_iso(rec.get("dLiquidacao")) if situacao_normalizada == "LIQUIDADO" else None,
        "tipoLancamento": texto(rec.get("eTipoLancto")),
        "natureza": natureza(rec),
        "situacao": situacao_normalizada,
        "valorOriginal": dinheiro(rec.get("vVencto")),
        "valorRealizado": valor_realizado,
        "valorRelatorio": dinheiro(rec.get("*Valor")),
        "estorno": texto(rec.get("eEstorno")) == "Sim",
        "fonte": texto(rec.get("*Fonte")),
        "fonteLinha": texto(rec.get("*Fonte Linha")),
        "descricao": texto(rec.get("tDescricao")),
        "detalhes": texto(rec.get("tDetalhes")),
        "parceiro": texto(rec.get("tClienteFornecedor")),
        "conta": texto(rec.get("tContaBancaria")),
        "numeroDocumento": texto(rec.get("tNumeroDocumento")),
        "numeroParcela": inteiro(rec.get("tNumeroParcela")),
        "meioPagamento": texto(rec.get("tMeioPagamento")),
        "grupoCategoriaBruto": texto(rec.get("tGrupoCategoria")),
        "categoriaBruta": texto(rec.get("tCategoria")),
        "centroCusto": texto(rec.get("*CCusto")),
        "grupoCategoria": texto(rec.get("*Grupo Categoria")),
        "categoria": texto(rec.get("*Categoria")),
        "origem": origem,
    }


def extrair(caminho: Path, fonte: str) -> dict[str, Any]:
    with zipfile.ZipFile(caminho) as zf:
        definicao = ET.fromstring(zf.read(DEFINITION))
        campos, registros = build_cache(zf, DEFINITION, RECORDS)

    linhas = [
        normalizar_linha(indice, rec)
        for indice, rec in enumerate(registros, start=1)
        if texto(rec.get("*Fonte")) == fonte
    ]
    datas = [
        data
        for linha in linhas
        for data in (linha["competencia"], linha["vencimento"], linha["liquidacao"])
        if data
    ]
    return {
        "versaoFormato": 1,
        "arquivo": caminho.name,
        "sha256": sha256_arquivo(caminho),
        "fonte": fonte,
        "extraidoEm": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "cache": {
            "definicao": DEFINITION,
            "registros": RECORDS,
            "quantidadeTotal": len(registros),
            "quantidadeFonte": len(linhas),
            "quantidadeCampos": len(campos),
            "campos": campos,
            "atualizadoPor": definicao.get("refreshedBy"),
            "atualizadoEm": data_excel_iso(definicao.get("refreshedDate")),
            "dataMinima": min(datas) if datas else None,
            "dataMaxima": max(datas) if datas else None,
        },
        "linhas": linhas,
    }


def argumentos() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extrai a base financeira Rio Novo do pivotCache 3")
    parser.add_argument("xlsx", type=Path, help="planilha .xlsx de origem")
    parser.add_argument("saida", type=Path, help="arquivo JSON de destino")
    parser.add_argument("--fonte", default="RIO NOVO", help="valor exato do campo *Fonte")
    return parser.parse_args()


def main() -> None:
    args = argumentos()
    if not args.xlsx.is_file():
        raise SystemExit(f"Planilha nao encontrada: {args.xlsx}")

    artefato = extrair(args.xlsx, args.fonte)
    diretorio = args.saida.parent
    if str(diretorio) not in {"", "."}:
        os.makedirs(diretorio, exist_ok=True)
    with args.saida.open("w", encoding="utf-8") as arquivo:
        json.dump(artefato, arquivo, ensure_ascii=False, indent=2)
        arquivo.write("\n")

    cache = artefato["cache"]
    print(f"SHA-256: {artefato['sha256']}")
    print(f"Cache: {cache['quantidadeTotal']} linhas; fonte {args.fonte}: {cache['quantidadeFonte']}")
    print(f"Periodo observado: {cache['dataMinima']} -> {cache['dataMaxima']}")
    print(f"JSON salvo em: {args.saida}")


if __name__ == "__main__":
    main()
