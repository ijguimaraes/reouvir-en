# Reouvir EN

PWA de **treino de escuta em inglês** (não é um curso). O aluno ouve playlists de frases, definidas por `contexto / nível CEFR / tópico gramatical` (ex.: `Entrevista de engenheiro de software Java / A1 / Verbo to be`). O aluno escolhe primeiro o **contexto** e depois o nível e o tópico; um mesmo contexto serve a todos os níveis e tópicos. O app é no estilo de um player de música, para uso mãos livres (corrida, spinning). Slogan: *Hear it again.*

Responder ao usuário sempre em **português** (com acentuação correta). Identificadores de código e termos técnicos ficam em inglês.

## Fonte da verdade

`docs/estrutura-do-projeto.md` tem o desenho completo (escopo, regras, modelo de dados, API, stack, estrutura de pastas, deploy, riscos, premissas e fases). Leia antes de implementar qualquer coisa. Se uma decisão mudar, atualize o documento.

## Estado atual

- Existem o documento, o protótipo HTML (`prototipo/`, referência de UX, não é código de produção) e o código das fases 1 a 8, em monorepo pnpm. Portas de dev: API 3711, web 5273, admin 5274.
- **Fase 1 (Fundação) validada:** typecheck, testes (unitários e de integração contra Postgres real), migrações, seed do admin e build.
- Fases 3 a 8 implementadas em seguida (ver `README.md` para o que foi validado e o que depende de teste manual).
- **Fase 2 (spike do player) depende de teste manual** em iPhone/Android com a tela bloqueada e a regra de silêncio. Nenhum agente consegue validar isso.
- Para rodar: `cp .env.example .env`, `pnpm install`, `pnpm db:up`, `pnpm db:migrate`, `pnpm seed:admin`, `pnpm dev`. **O banco nasce vazio:** não há seed de níveis, tópicos, contextos nem frases (só o admin). Testes de integração usam `DATABASE_URL_TEST`.

## Decisões já tomadas

- **Níveis do escopo: A1, A2, B1 e B2.** C1 e C2 ficam fora (não entram no seed nem na pipeline).
- **Conteúdo curado:** o catálogo (níveis, tópicos, contextos) é gerido no backoffice. Os alunos só veem playlists publicadas.
- **As frases NÃO são geradas aqui, e não há importação por arquivo.** Uma pipeline externa grava **níveis, tópicos e frases direto no Postgres**. O backoffice só lê níveis e tópicos, revisa frases (editar, remover, reordenar, adicionar) e publica. Triggers do banco garantem a integridade de quem escreve direto: normalizam `text` e derivam `text_hash`/`char_count`, sobem `playlists.version` e criam a playlist vazia de cada tópico novo em todos os contextos (seção 8 do documento).
- **Contextos** são o único cadastro editável (criar, editar, excluir). Campos: nome, slug, categoria, descrição (curta, exibida ao aluno) e **detalhamento** (texto livre só para o admin, nunca exposto ao aluno). Criar um contexto gera uma playlist vazia por tópico; excluir apaga as vazias e recusa se alguma tiver frases.
- **Áudio já gerado é patrimônio (custa crédito do ElevenLabs): não apague nem limpe órfãos.** O painel não tem limpeza; só o CLI `cleanup:audio` (prévia por padrão). A chave usa texto normalizado + voz + modelo + configurações, então trocar a voz ou o modelo invalida o reaproveitamento (os áudios antigos viram órfãos).
- **Só o áudio é lazy:** gerado no ElevenLabs na primeira escuta, guardado e reaproveitado por todos. Chave: `sha256(texto normalizado | voice_id | model_id | voice_settings)`. Single-flight com `UNIQUE(audio_key)`.
- **Playlist** única por `(tópico, contexto)`, ordem fixa, ~100 frases (definido pela pipeline). Reordenar no backoffice renumera tudo de 1 a n; remover deixa lacuna; adicionar vai para o fim.
- **Ordem do currículo:** `(ordem do nível, ordem do tópico dentro do nível)`, vinda do catálogo (gravado pela pipeline). É a ordem em que o aluno vê os tópicos.
- **Offline:** o aluno baixa a playlist inteira (IndexedDB + Cache Storage) e ela toca localmente; o progresso (`last_sentence_id`, voltas, tempo) sincroniza na primeira rede.
- **Regra do silêncio (fixa, não configurável):** `silêncio = duração do áudio ÷ velocidade + 1,5 s`, depois de cada audição, inclusive a última repetição antes da próxima frase. Ex.: 10 s a 0,75x → 14,8 s. A regra vive em `packages/shared`.
- **Configurações do aluno:** só repetições seguidas (padrão 2), velocidade (0,75x/1x) e loop.
- **Tema claro e escuro** nos dois apps (segue o sistema, com alternância manual), feito com variáveis CSS.
- **Sem tradução, sem SRS, sem texto livre de contexto** no MVP.
- **Stack:** monorepo **pnpm** com `apps/web` (Vite + React, PWA), `apps/admin` (Vite + React, backoffice, sem service worker, servido em `/admin`), `apps/api` (Node + TypeScript + Fastify + zod), `packages/shared` e `packages/api-client`.
- **Banco:** Postgres com **SQL nativo, sem ORM** (driver `pg`, repositórios `*.repository.ts`). Migrações em `.sql` com **dbmate** (`-- migrate:up` / `-- migrate:down`). Sem fila de jobs. Testes com Vitest, e os de repositório rodam contra Postgres real.
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
