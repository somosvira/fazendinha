#!/usr/bin/env python3
"""Extrai os lançamentos da fazenda Rio Novo do .xlsx original.

Lê o pivotCache 3 (a base consolidada da holding), filtra *Fonte == 'RIO NOVO'
e escreve um JSON normalizado para o modelo do nosso sistema.

Uso:
    python3 scripts/extract_rio_novo.py "Relatório Rio Novo 2026.05.04.xlsx" server/prisma/rio_novo.json
"""
import sys, os, json, zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def shared_value(item):
    """Valor de um <s>/<n>/<d>/<m> dentro de sharedItems."""
    tag = item.tag[len(NS):]
    if tag == "m":
        return None
    return item.get("v")


def build_cache(zf, defn_path, rec_path):
    defn = ET.fromstring(zf.read(defn_path))
    fields = []  # (name, [sharedItems] or None)
    cache_fields = defn.find(f"{NS}cacheFields")
    for cf in cache_fields.findall(f"{NS}cacheField"):
        name = cf.get("name")
        si = cf.find(f"{NS}sharedItems")
        items = None
        if si is not None and len(list(si)) > 0:
            items = [shared_value(it) for it in si]
        fields.append((name, items))

    recs = ET.fromstring(zf.read(rec_path))
    field_names = [f[0] for f in fields]
    out = []
    for r in recs.findall(f"{NS}r"):
        rec = {}
        for idx, cell in enumerate(r):
            name, items = fields[idx]
            tag = cell.tag[len(NS):]
            if tag == "x":  # índice em sharedItems
                rec[name] = items[int(cell.get("v"))] if items else None
            elif tag == "m":  # missing
                rec[name] = None
            else:  # s, n, d, b
                rec[name] = cell.get("v")
        out.append(rec)
    return field_names, out


def date_only(v):
    return v[:10] if v else None


def main():
    xlsx = sys.argv[1] if len(sys.argv) > 1 else "Relatório Rio Novo 2026.05.04.xlsx"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "server/prisma/rio_novo.json"

    with zipfile.ZipFile(xlsx) as zf:
        _, records = build_cache(
            zf,
            "xl/pivotCache/pivotCacheDefinition3.xml",
            "xl/pivotCache/pivotCacheRecords3.xml",
        )

    lancs = []
    skipped_fonte = 0
    for rec in records:
        if (rec.get("*Fonte") or "").strip() != "RIO NOVO":
            skipped_fonte += 1
            continue

        cd = rec.get("eCreditoDebito") or rec.get("*C/D")
        natureza = "CREDITO" if cd in ("Credito", "C") else "DEBITO"

        raw_valor = rec.get("*Valor")
        valor = abs(float(raw_valor)) if raw_valor not in (None, "") else 0.0
        if valor == 0:
            continue

        sit = (rec.get("eSituacao") or "Aberto")
        situacao = {
            "Liquidado": "LIQUIDADO",
            "Aberto": "ABERTO",
            "LiquidadoParcial": "LIQUIDADO_PARCIAL",
        }.get(sit, "ABERTO")

        venc = date_only(rec.get("dVencto")) or date_only(rec.get("*Dt Vcto/Pgto"))
        liq = date_only(rec.get("dLiquidacao"))
        comp = date_only(rec.get("dCompetencia")) or venc
        if not venc:
            venc = liq or date_only(rec.get("*Dt Vcto/Pgto")) or comp
        if not venc:
            continue
        if situacao != "LIQUIDADO":
            liq = None

        centro = (rec.get("*CCusto") or "").strip() or "(Sem centro de custo)"
        grupo = (rec.get("*Grupo Categoria") or "").strip() or "(Sem grupo)"
        categoria = (rec.get("*Categoria") or "").strip() or "(Sem categoria)"

        lancs.append({
            "natureza": natureza,
            "valor": round(valor, 2),
            "dataCompetencia": comp or venc,
            "dataVencimento": venc,
            "dataLiquidacao": liq,
            "situacao": situacao,
            "estornado": (rec.get("eEstorno") == "Sim"),
            "centro": centro,
            "ehInvestimento": "investimento" in centro.lower(),
            "grupo": grupo,
            "categoria": categoria,
            "fornecedor": (rec.get("tClienteFornecedor") or "").strip() or None,
            "conta": (rec.get("tContaBancaria") or "").strip() or None,
            "numeroDocumento": (rec.get("tNumeroDocumento") or "").strip() or None,
            "numeroParcela": int(float(rec["tNumeroParcela"])) if rec.get("tNumeroParcela") else None,
            "descricao": (rec.get("tDescricao") or "").strip() or None,
        })

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(lancs, f, ensure_ascii=False, indent=0)

    # Resumo
    from collections import Counter
    print(f"Total de registros no cache: {len(records)}")
    print(f"Ignorados (outra Fonte): {skipped_fonte}")
    print(f"Lançamentos Rio Novo exportados: {len(lancs)}")
    print("Por situação:", dict(Counter(l["situacao"] for l in lancs)))
    print("Centros de custo:", dict(Counter(l["centro"] for l in lancs)))
    datas = sorted(l["dataVencimento"] for l in lancs)
    print("Período (vencimento):", datas[0], "->", datas[-1])
    print(f"JSON salvo em: {out_path}")


if __name__ == "__main__":
    main()
