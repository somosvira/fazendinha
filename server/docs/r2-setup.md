# Setup Cloudflare R2 para Notas Fiscais

Este guia provisiona o bucket R2 para o backend usar `STORAGE_DRIVER=r2`. Em desenvolvimento mantenha `STORAGE_DRIVER=local` — não precisa de Cloudflare.

R2 é S3-compatible — usamos o mesmo `@aws-sdk/client-s3`, só apontando para o endpoint da Cloudflare.

---

## 1. Criar o bucket

Dashboard Cloudflare → **R2** → **Create bucket**.

- **Nome**: `rionovo-notas` (precisa ser único na sua conta)
- **Location**: `Automatic` (Cloudflare escolhe a melhor região)
- **Default storage class**: `Standard`

Não habilitar acesso público — o backend gera presigned URLs com TTL.

## 2. Aplicar lifecycle policy

Política: arquivos com mais de 90 dias migram para Infrequent Access (mais barato, latência ainda em ms).

Dashboard: bucket → **Settings** → **Object lifecycle policies** → **Add rule**.

- **Rule name**: `notas-fiscais-tier`
- **Prefix**: `notas/`
- **Transition**: depois de **90 dias** → `Infrequent Access`

Ou via `wrangler r2 bucket lifecycle add rionovo-notas --rules-file lifecycle.json`, onde `lifecycle.json`:

```json
{
  "rules": [
    {
      "id": "notas-fiscais-tier",
      "enabled": true,
      "conditions": { "prefix": "notas/" },
      "transitions": [
        {
          "condition": { "type": "Age", "maxAge": 7776000 },
          "storageClass": "InfrequentAccess"
        }
      ]
    }
  ]
}
```

**Sem Glacier**: R2 não tem o equivalente a Deep Archive. Arquivos em IA continuam acessíveis instantaneamente — perde-se o "ultra-frio" da AWS, ganha-se simplicidade (sem `RestoreObject`, sem espera de 12h).

## 3. Gerar R2 API Token

Dashboard → **R2** → **Manage R2 API Tokens** → **Create API token**.

- **Permissions**: `Object Read & Write`
- **Specify bucket**: selecionar **`rionovo-notas`** (escopo bucket-specific, não conta inteira)
- **TTL**: sem expiração (rotação manual quando necessário)

Anotar três valores:
- `Access Key ID`
- `Secret Access Key` (só aparece **uma vez** — copiar imediatamente)
- `Account ID` (no canto superior direito do dashboard Cloudflare)

## 4. Popular `server/.env`

```env
STORAGE_DRIVER="r2"
R2_ACCOUNT_ID="<account_id>"
R2_ACCESS_KEY_ID="<access_key_id>"
R2_SECRET_ACCESS_KEY="<secret_access_key>"
R2_BUCKET_NOTAS="rionovo-notas"
OCR_ENABLED="true"
```

Reiniciar o backend. A validação Zod em `server/src/env.ts` aborta o boot se algo faltar.

## 5. Smoke test

Subir uma nota via UI ou cURL:

```bash
curl -X POST http://localhost:41873/api/lancamentos/1/nota-fiscal \
  -F "arquivo=@nota.pdf"
```

Conferir no dashboard R2 → bucket → **Objects** que `notas/1/<sha256>.pdf` apareceu com Storage class `Standard`.

## Custo estimado (volume 300 notas/mês)

| Item | Mensal |
|---|---|
| Storage (5 anos acumulados ~9GB, Standard→IA após 90d) | ~$0.10 |
| Classe A (PUT/POST/LIST, ~300/mês) | desprezível |
| Classe B (GET, ~600/mês com downloads esporádicos) | desprezível |
| Egress (downloads/visualização) | **$0** (R2 não cobra) |
| OCR Tesseract.js local | **$0** |
| **Total** | **~$0.10–$0.20** |

R2 cobra Classe A em $4.50 por milhão de operações e Classe B em $0.36 por milhão. No volume da fazenda, são frações de centavo por mês.

## Quando voltar a S3

Se um dia o volume saltar para milhões de docs/ano e o tier ultra-frio fizer diferença material (Deep Archive a $0.00099/GB), considerar dump anual para S3 Glacier ou para Backblaze B2 ($0.006/GB). Para o volume atual da fazenda, R2 sozinho atende.
