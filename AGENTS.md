# Reouvir EN

PWA de **treino de escuta em inglês** (não é um curso). O aluno ouve playlists de frases, definidas por `contexto / nível CEFR / tópico gramatical` (ex.: `Entrevista de engenheiro de software Java / A1 / Verbo to be`). O aluno escolhe primeiro o **contexto** e depois o nível e o tópico; um mesmo contexto serve a todos os níveis e tópicos. O app é no estilo de um player de música, para uso mãos livres (corrida, spinning). Slogan: *Hear it again.*

Responder ao usuário sempre em **português** (com acentuação correta). Identificadores de código e termos técnicos ficam em inglês.

## Fonte da verdade

`docs/estrutura-do-projeto.md` tem o desenho completo (escopo, regras, modelo de dados, API, stack, estrutura de pastas, deploy, riscos, premissas e fases). Leia antes de implementar qualquer coisa. Se uma decisão mudar, atualize o documento.

## Estado atual

- **Existem o documento e um protótipo HTML navegável** (`prototipo/`, referência de UX, não é código de produção; sobe com `python3 -m http.server` dentro da pasta). Nenhum código de produção, `package.json` nem repositório git foram criados ainda.
- Próximo passo: **fase 1 (Fundação)**: workspace pnpm, Docker Compose com Postgres, migrações com dbmate, login por e-mail e senha e papéis `student`/`admin`.
- Em seguida, a **fase 2 é um spike do player** (tela bloqueada no iPhone/Android com a regra de silêncio), antes de construir o resto.

## Decisões já tomadas

- **Níveis do escopo: A1, A2, B1 e B2.** C1 e C2 ficam fora (não entram no seed nem na pipeline).
- **Conteúdo curado:** o catálogo (níveis, tópicos, contextos) é gerido no backoffice. Os alunos só veem playlists publicadas.
- **As frases NÃO são geradas aqui.** Uma **pipeline externa** (outro projeto) gera por contexto/nível/tópico e entrega um **JSON aninhado** (contexto → níveis → tópicos → frases, com `order` em cada nível). O admin **importa** pelo backoffice (prévia + confirmação), tudo entra como `draft`, e depois revisa e publica. Formato em `docs/exemplo-importacao.json` e na seção 8 do documento. A regra "nunca usar gramática de tópico posterior" vive na pipeline.
- **Só o áudio é lazy:** gerado no ElevenLabs na primeira escuta, guardado e reaproveitado por todos. Chave: `sha256(texto normalizado | voice_id | model_id | voice_settings)`. Single-flight com `UNIQUE(audio_key)`.
- **Playlist** única por `(tópico, contexto)`, ordem fixa, ~100 frases (definido pela pipeline). Reordenar no backoffice renumera tudo de 1 a n; remover deixa lacuna; adicionar vai para o fim.
- **Ordem do currículo:** `(ordem do nível, ordem do tópico dentro do nível)`, vinda do catálogo/arquivo de importação. É a ordem em que o aluno vê os tópicos.
- **Offline:** o aluno baixa a playlist inteira (IndexedDB + Cache Storage) e ela toca localmente; o progresso (`last_sentence_id`, voltas, tempo) sincroniza na primeira rede.
- **Regra do silêncio (fixa, não configurável):** `silêncio = duração do áudio ÷ velocidade + 1,5 s`, depois de cada audição, inclusive a última repetição antes da próxima frase. Ex.: 10 s a 0,75x → 14,8 s. A regra vive em `packages/shared`.
- **Configurações do aluno:** só repetições seguidas (padrão 2), velocidade (0,75x/1x) e loop.
- **Tema claro e escuro** nos dois apps (segue o sistema, com alternância manual), feito com variáveis CSS.
- **Sem tradução, sem SRS, sem texto livre de contexto** no MVP.
- **Stack:** monorepo **pnpm** com `apps/web` (Vite + React, PWA), `apps/admin` (Vite + React, backoffice, sem service worker, servido em `/admin`), `apps/api` (Node + TypeScript + Fastify + zod), `packages/shared` e `packages/api-client`.
- **Banco:** Postgres com **SQL nativo, sem ORM** (driver `pg`, repositórios `*.repository.ts`). Migrações em `.sql` com **dbmate** (`-- migrate:up` / `-- migrate:down`). Sem fila de jobs (a importação é síncrona). Testes com Vitest, e os de repositório rodam contra Postgres real.
- **Auth:** e-mail e senha na API, com **access token (JWT 15 min) + refresh token rotativo** em cookies httpOnly. Telas de entrar e criar conta (cadastro aberto, papel `student`). O backoffice só bloqueia usuários e redefine senhas (senha temporária). **Google fica fora do MVP.**
- **Storage:** disco local atrás de uma interface com driver `local` (driver `s3` só no futuro). Sem bucket e sem CDN.
- **Deploy 100% local:** Docker Compose (`postgres`, `migrate`, `api`, `caddy`) numa máquina ligada, acessado pela VPN **Tailscale**. Origem única por caminho: `/` (web), `/admin` (admin), `/api` (API), `/audio` (MP3). **HTTPS é obrigatório** para o PWA (service worker), via MagicDNS + `tailscale serve`.
- **Next.js foi descartado:** não há necessidade de SEO nem de SSR.

## Pontos a validar durante a implementação

- Comportamento do áudio com a tela bloqueada (principalmente iOS) com silêncios longos. Tratamento previsto: áudios já baixados, Media Session API e faixa silenciosa durante os silêncios.
- Se o plano do ElevenLabs permite o uso comercial e a distribuição dos áudios, antes de abrir o app para outras pessoas.
- Backup da pasta de áudio (regenerar custa créditos) além do `pg_dump`.

## Preferências do usuário

- Respostas diretas. Quando o usuário escreve "APENAS RESPONDA", não faça alterações, só responda.
- Decide as tecnologias com base em fatos (ex.: escolheu o dbmate pela comunidade maior). Justifique escolhas com dados quando possível.
- Sem ORM, sem Next.js, backoffice como app separado.
- Mensagens de commit **sem** `Co-Authored-By` (regra global do usuário).
