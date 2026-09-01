# Banco local do Fazendinha

Este projeto usa uma cópia local do banco **Rio Novo**, com dados reais, executada
diretamente no WSL. Ela não é o PostgreSQL padrão do sistema e não é um container
Docker.

## Configuração atual

| Item | Valor |
| --- | --- |
| Banco | `rionovo` |
| Host | `127.0.0.1` |
| Porta | `5433` |
| Diretório de dados | `/home/mateu/.local/pgdata-rionovo` |
| Binários PostgreSQL | `/usr/lib/postgresql/18/bin` |
| Log | `/home/mateu/.local/pgdata-rionovo/server.log` |
| Configuração da aplicação | `server/.env` |

> Atenção: esse banco contém dados reais. Não apagar o diretório de dados, não
> executar seeds/importações destrutivas e não recriar o cluster sem backup.

## Depois de reiniciar o WSL

O banco não inicia automaticamente. Rode este comando na raiz do projeto:

```bash
/usr/lib/postgresql/18/bin/pg_ctl \
  -D /home/mateu/.local/pgdata-rionovo \
  -l /home/mateu/.local/pgdata-rionovo/server.log \
  -o "-p 5433 -k /tmp" \
  start
```

O resultado esperado termina com:

```text
server started
```

O parâmetro `-p 5433` é obrigatório porque já existe outro PostgreSQL na porta
padrão `5432`. O parâmetro `-k /tmp` também é obrigatório para evitar erro de
permissão ao criar o socket em `/var/run/postgresql`.

## Validar o banco

```bash
/usr/lib/postgresql/18/bin/pg_isready -h 127.0.0.1 -p 5433
```

Resultado esperado:

```text
127.0.0.1:5433 - accepting connections
```

Com a API ativa, valide também a conexão de ponta a ponta:

```bash
curl http://127.0.0.1:41873/api/health/db
```

Resultado esperado:

```json
{"ok":true,"db":"up"}
```

## Subir o projeto completo

Primeiro inicie o banco conforme descrito acima. Depois, na raiz do projeto:

```bash
pnpm dev
```

Serviços:

| Serviço | Endereço |
| --- | --- |
| Frontend | <http://localhost:41875> |
| Backend | <http://localhost:41873> |
| Saúde da API | <http://localhost:41873/api/health> |
| Saúde do banco | <http://localhost:41873/api/health/db> |

O comando de desenvolvimento do backend executa `prisma db push` antes de iniciar
a API. Portanto, o banco precisa estar ativo primeiro.

## Parar o banco corretamente

Antes de encerrar o WSL, prefira uma parada limpa:

```bash
/usr/lib/postgresql/18/bin/pg_ctl \
  -D /home/mateu/.local/pgdata-rionovo \
  stop
```

Isso reduz a necessidade de recuperação automática do PostgreSQL na próxima
inicialização.

## Diagnóstico rápido

### Verificar se o banco já está rodando

```bash
/usr/lib/postgresql/18/bin/pg_ctl \
  -D /home/mateu/.local/pgdata-rionovo \
  status
```

### Ver as últimas mensagens do banco

```bash
tail -80 /home/mateu/.local/pgdata-rionovo/server.log
```

### Erro: `127.0.0.1:5433 - no response`

O banco local não está ativo. Execute o comando da seção “Depois de reiniciar o
WSL”.

### Erro: `Address already in use` na porta 5432

O banco foi iniciado sem `-p 5433`. Use exatamente o comando documentado acima.
Não desligue o PostgreSQL da porta `5432`, pois ele pertence a outro serviço.

### Erro ao criar lock em `/var/run/postgresql`

O banco foi iniciado sem `-k /tmp`. Use exatamente o comando documentado acima.

### Docker mostra `licify-db`

Esse container pertence a outro projeto e publica a porta `5435`. Ele não é o
banco do Fazendinha. Não o remova nem altere para tentar corrigir este projeto.

## O que aconteceu em 17/08/2026

Após o WSL reiniciar, o cluster em `/home/mateu/.local/pgdata-rionovo` continuava
íntegro, mas seu processo não estava ativo. Como o `server/.env` aponta para
`127.0.0.1:5433`, o backend falhava durante `prisma db push` e encerrava também o
comando paralelo do frontend.

A correção foi iniciar o cluster existente explicitamente na porta `5433`, usando
o socket em `/tmp`, e então executar `pnpm dev`.
