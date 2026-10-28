---
name: design-backoffice
description: Use ao mexer em apps/admin do Reouvir EN. Densidade de informação, tabelas, formulários, revisão e reordenação de frases, ações destrutivas e consistência com o app do aluno.
---

# Backoffice

O admin é uma ferramenta de trabalho. Familiaridade e velocidade valem mais que expressão. Mesma identidade visual do app do aluno (mesmos tokens), mais densa.

## Princípios

1. **Consistência sobre surpresa.** A ação "Salvar" parece igual em toda tela. Sem controles inventados para tarefas padrão.
2. **Densidade útil.** Tabelas com muitas linhas são bem-vindas, desde que a leitura seja fácil: linha de ~40px, cabeçalho fixo, números tabulares, truncar com `title` e expandir.
3. **Cor com restrição.** Acento só em ação primária e item selecionado. Estado usa `--success`, `--warning`, `--danger` com texto, não só cor.
4. **Escala de texto fixa em rem**, sem fluidez. Corpo ≥ 14px (`--text-label`); não desça disso.

## Layout

- Casca: barra lateral (hoje 220px) + conteúdo (`max-width` ~1100px). Abaixo de 760px a lateral vira linha de navegação.
- No celular a tabela vira lista de cartões (`data-label`) ou rola dentro de um contêiner, com a primeira coluna fixa. Não deixe a página rolar na horizontal.
- Cabeçalho da tela com título, contagem e ação principal à direita.

## Fluxos principais

**Revisar frases** (editar, remover, reordenar, adicionar, publicar)
- Edição inline com salvar explícito ou automático claro (mostrar "Salvo"). Atalhos: Enter salva, Esc cancela.
- Reordenar por arrastar **e** por campo de posição/botões (arrastar sozinho não é acessível nem funciona bem em toque). Mostre onde vai cair (`tr.dragover`).
- Remover deixa lacuna (regra do produto); mostre isso na numeração sem confundir. Adicionar vai ao fim.
- Contador de caracteres e aviso de frase longa (afeta o áudio e o custo).
- Indicar, por frase, se o áudio já foi gerado. Isso é patrimônio.

**Contextos** (criar, editar, excluir)
- Campo "Descrição" (curta, vista pelo aluno) separado de "Detalhamento" (só admin), com rótulo e ajuda dizendo a diferença.
- Exclusão recusada quando há frases: explique o motivo e quais playlists bloqueiam.

**Usuários:** bloquear e redefinir senha temporária. A senha temporária aparece uma vez, com botão de copiar.

## Ações destrutivas

- Use `useConfirm()` (`apps/admin/src/ui.tsx`), que abre um `<dialog>`; não use `window.confirm`.
- Confirmar nomeando o objeto e a consequência ("Excluir o contexto *Entrevista Java*? Apaga 12 playlists vazias.").
- Botão de confirmação com o verbo da ação, não "OK". Cancelar é o foco padrão.
- Preferir desfazer quando possível; senão, confirmar.
- Nunca ofereça apagar áudio no painel (só pelo CLI `cleanup:audio`).

## Estados que o admin precisa

Carregando (esqueleto de tabela), vazio com próxima ação, erro de rede com "Tentar de novo", sucesso discreto (toast que repete o verbo: "Publicada"), permissão negada.

## Verificação

Tarefa completa só com teclado: abrir uma playlist, editar uma frase, reordenar e publicar. Veja `design-accessibility` e `design-visual-qa`.
