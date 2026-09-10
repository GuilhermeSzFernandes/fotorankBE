# Fotec (fotorank-backend)

API REST que sustenta a plataforma **Fotec**, usada para organizar concursos fotográficos institucionais — desenvolvida para o **1º Concurso Fotográfico da Etec Carapicuíba**. Este repositório é o back-end; o front-end fica em [fotorankFE](https://github.com/GuilhermeSzFernandes/fotorankFE).

## Objetivo

Prover a lógica de negócio e persistência para:

- Autenticação (registro, login, sessão via cookie JWT, recuperação de senha por e-mail).
- Envio, armazenamento e remoção de fotos dos participantes (com validação de formato/resolução).
- Avaliação das fotos por professores (nota + comentário), com controle de fase do concurso.
- Administração: métricas gerais, gestão de professores/usuários, controle das datas/fase do concurso e visibilidade do ranking.
- Ranking público (por foto e por participante), com acesso restrito até o encerramento do concurso, salvo se liberado pelo admin.
- Log de auditoria dos eventos principais (upload, avaliação, mudança de papel de usuário, etc.).

## Tecnologias

- **Node.js** + **Express** — servidor HTTP e rotas da API.
- **PostgreSQL** (via `pg`) — persistência principal (`schema.sql` define o schema).
- **JWT** (`jsonwebtoken`) + cookies `httpOnly` — autenticação e sessão.
- **bcryptjs** — hash de senhas.
- **Multer** + **image-size** — upload e validação de imagens.
- **AWS S3** (`@aws-sdk/client-s3`) — armazenamento de fotos em produção (opcional, via `USE_S3`; alternativa é disco local em `uploads/`).
- **Brevo (API HTTP)** — envio do e-mail de recuperação de senha (evita as portas SMTP bloqueadas em hosts como o Render).
- **Render** — hospedagem da API.

## Estrutura

```
src/
  app.js          bootstrap do Express, CORS, rotas
  routes/         auth, photos, grades, ranking, admin, contest, profile, users
  lib/            db (pool + seed), contestPhase, mailer, s3, audit
  data/           queries.js (acesso ao Postgres)
schema.sql        schema do banco (tabelas, tipos, constraints)
```

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string do PostgreSQL |
| `JWT_SECRET` | Segredo para assinar os tokens de sessão |
| `FRONTEND_URL` | Origem(ns) permitidas no CORS (separadas por vírgula) |
| `PORT` | Porta do servidor (padrão `3001`) |
| `USE_S3` | `true` para usar S3 no upload de fotos/avatares; caso contrário usa disco local |
| `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Credenciais do S3 (quando `USE_S3=true`) |
| `BREVO_API_KEY` | Chave da API da Brevo, para envio de e-mail |
| `EMAIL_FROM`, `EMAIL_FROM_NAME` (ou `SMTP_FROM`) | Remetente do e-mail de recuperação de senha |
| `SENTRY_DSN` | DSN do Sentry para captura de erros (opcional; usa um valor padrão se ausente) |

## Rodando localmente

```bash
npm install
npm run dev
```

O servidor sobe em `http://localhost:3001` e aplica o `schema.sql` automaticamente na inicialização.
