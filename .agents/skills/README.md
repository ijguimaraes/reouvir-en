# Skills de design (Reouvir EN)

Regras de layout e design system para qualquer agente de IA (Claude, Codex, Cursor, Copilot, Gemini). São Markdown puro, sem dependência de ferramenta. Cada pasta tem um `SKILL.md` com frontmatter `name` e `description`.

Escritas em português. Identificadores de código e termos técnicos ficam em inglês.

## Quando usar cada uma

| Skill | Use quando |
|---|---|
| `design-tokens` | Criar ou alterar cor, espaço, raio, sombra, duração. Sempre antes de escrever CSS novo. |
| `design-theming` | Mexer em tema claro/escuro ou em qualquer cor semântica. |
| `design-layout` | Montar ou ajustar telas, grids, espaçamento, responsividade. |
| `design-typography` | Definir tamanhos, pesos, medida de texto, fontes. |
| `design-components` | Criar ou revisar botão, campo, lista, cartão, badge, estados. |
| `design-accessibility` | Qualquer UI nova ou alterada. Contraste, foco, alvos de toque, semântica. |
| `design-motion` | Adicionar transição ou animação. |
| `design-player-ux` | Mexer no player do `apps/web` (uso mãos livres). |
| `design-backoffice` | Mexer no `apps/admin` (tabelas, formulários, edição). |
| `design-visual-qa` | Terminar qualquer mudança visual. Checklist final com capturas. |

## Ordem sugerida

1. `design-tokens` e `design-theming` (a base).
2. `design-layout`, `design-typography`, `design-components` (a estrutura).
3. `design-accessibility`, `design-motion` (a qualidade).
4. `design-player-ux` ou `design-backoffice` (o contexto do app).
5. `design-visual-qa` (a verificação).

## Fonte única de tokens

`packages/shared/src/theme.css`. Os dois apps importam esse arquivo. Não duplique valores nos CSS dos apps.

## Créditos

Parte das regras foi destilada, em português e ajustada a este projeto, de dois trabalhos sob licença Apache 2.0:

- `frontend-design`, de Anthropic (https://github.com/anthropics/skills).
- Impeccable, de Paul Bakaus (https://github.com/pbakaus/impeccable).

Nada foi copiado literalmente, e nenhum script ou binário deles foi incluído.
