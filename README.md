# Reouvir EN

PWA de treino de escuta em inglês (*Hear it again.*). O desenho completo está em [`docs/estrutura-do-projeto.md`](docs/estrutura-do-projeto.md).

## Estado

| Fase | O que é | Situação |
|---|---|---|
| 1 | Fundação: workspace, auth, migrações, Compose | Implementada e testada |
| 2 | Spike do player com a tela bloqueada | **Falta testar no iPhone/Android** (ver abaixo) |
| 3 | Backoffice do catálogo e usuários | API testada; telas compilam |
| 4 | Revisão e publicação; carga direta pela pipeline (triggers no banco) | API e triggers testados; telas compilam |
| 5 | Áudio lazy (ElevenLabs, single-flight, storage local) | Testada com TTS falso; **falta testar com a chave real** |
| 6 | App do aluno e player | Motor testado (relógio simulado); telas compilam |
| 7 | Offline (IndexedDB, Cache Storage, service worker) | Compila; **falta testar no navegador** |
| 8 | Painel, limites, backup, Caddy | API testada; Caddy/Tailscale **ainda não executados** |

As telas (`apps/web`, `apps/admin`) passaram por typecheck e build, mas ninguém as usou num navegador ainda.

## Desenvolvimento

Requisitos: Node 22+, pnpm 9 (`corepack enable`), Docker.

```bash
cp .env.example .env          # ajuste SESSION_SECRET, ADMIN_*, ELEVENLABS_API_KEY
pnpm install
pnpm db:up                    # Postgres em container
pnpm db:migrate               # dbmate up
pnpm seed                     # administrador (ADMIN_EMAIL / ADMIN_PASSWORD) + níveis e tópicos (docs/pipeline/curriculum-*.yaml); idempotente
pnpm dev                      # api :3711, web :5273, admin :5274/admin/
```

Sem `ELEVENLABS_API_KEY`, tudo funciona menos gerar áudio novo (a API responde 503 nessa rota).

Fluxo no backoffice (`http://localhost:5274/admin/`): crie um **Contexto** (com o detalhamento, se quiser); as playlists vazias dos tópicos nascem junto. Níveis e tópicos vêm do `pnpm seed`; as frases chegam pela pipeline, direto no banco (o ambiente local não carrega frases nem contextos de exemplo) (seção 8 do documento); depois revise no tópico e **publique**. Para testar sem a pipeline, adicione frases à mão na tela do tópico. Depois entre como aluno em `http://localhost:5273`.

## Testes

```bash
pnpm typecheck
pnpm test                     # unitários (shared, motor do player, tokens, MP3...)

# integração (Postgres real): crie e migre o banco de teste uma vez
docker compose -f infra/docker-compose.yml exec postgres createdb -U reouvir reouvir_test
DATABASE_URL="$DATABASE_URL_TEST" pnpm db:migrate
DATABASE_URL_TEST=postgres://reouvir:reouvir@localhost:5432/reouvir_test?sslmode=disable pnpm test
```

Os testes de integração rodam `TRUNCATE` no banco de teste: nunca aponte `DATABASE_URL_TEST` para o banco real.

## Deploy local (Compose + Caddy + Tailscale)

1. `cp .env.example .env` e defina segredos reais (`SESSION_SECRET`, senhas, `COOKIE_SECURE=true`).
2. `pnpm build` (gera `apps/web/dist` e `apps/admin/dist`).
3. `docker compose --env-file .env -f infra/docker-compose.yml up -d --build` sobe `postgres`, `migrate`, `api` e `caddy` (em `127.0.0.1:$CADDY_PORT`, padrão 8080).
4. Uma vez: `docker compose --env-file .env -f infra/docker-compose.yml run --rm api pnpm exec tsx src/seed-admin.ts`. O catálogo (níveis e tópicos) sai do repositório, porque a imagem da API não leva `docs/`: com o Postgres do Compose em `127.0.0.1:5432`, rode `pnpm seed:catalog` com `DATABASE_URL` apontando para ele.
5. HTTPS (obrigatório para o service worker no celular): habilite MagicDNS e certificados HTTPS no painel do Tailscale e rode `tailscale serve --bg 8080` (a porta de `CADDY_PORT`; o comando exato varia com a versão). Acesse `https://<maquina>.<tailnet>.ts.net`.

Origem única: `/` (aluno), `/admin` (backoffice), `/api` (API), `/audio` (MP3, servido direto pelo Caddy).

### Operação

- **Backup:** `BACKUP_DIR=/outro/disco/reouvir ./infra/backup.sh` (pg_dump + cópia dos MP3). Agende no cron.
- **Áudios órfãos** (frase editada ou removida): o painel só **conta**; não há como apagar por lá, porque o áudio já foi pago e é reaproveitado se a mesma frase voltar (mesma voz e modelo). Limpeza manual, só se precisar: `pnpm --filter @reouvir/api cleanup:audio` (prévia) e `... cleanup:audio -- --apply`.
- **Limites do TTS:** `TTS_MAX_PER_MINUTE` e `TTS_MAX_PER_USER_PER_MINUTE` (o "Baixar playlist" conta).

## Fase 2: o que testar no celular

Abra o app pelo HTTPS do Tailscale, baixe uma playlist e dê play. Com a tela **bloqueada**, confira:

1. As frases continuam avançando durante os silêncios longos (5–30 s), sem parar.
2. Os controles da tela de bloqueio (play, pause, próxima, anterior) funcionam.
3. A troca de `src` entre a faixa silenciosa e a frase seguinte não falha (principalmente no iOS).

O motor usa um único `<audio>`: toca a frase e, no silêncio, uma faixa muda em loop (`src/player/driver.ts`). Se o iOS suspender a página, o ajuste fica nesse driver. O motor (`src/player/engine.ts`) não muda.

## Pontos a validar

- Licença do ElevenLabs: confirme que o plano permite uso comercial e a distribuição dos áudios antes de abrir o app para outras pessoas.
- O formato de saída do TTS é `mp3_44100_128`; a duração é medida somando os quadros do MP3 (`apps/api/src/modules/audio/mp3.ts`).
