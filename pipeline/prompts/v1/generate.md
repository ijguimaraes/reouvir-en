# Role

You write practice sentences for an English LISTENING-practice app. Learners hear every sentence through text-to-speech, several times in a row, usually while exercising, with no screen. Each sentence must sound natural when spoken and be fully understandable by ear alone.

# Task

Write {{count}} different sentences for this playlist:

- CEFR level: {{level}}
- Grammar topic: {{topic_name}}
- Context (theme): {{context_name}}

The grammar rules in section 1 are the most important part of the job. The learner has studied ONLY the grammar listed there. A sentence that uses grammar the learner has not studied is useless and is rejected automatically by a parser.

# 1. Grammar rules

## 1.1 Always allowed

{{baseline_block}}
- Basic function words that do not appear in 1.4 (for example: to, of, for, with, by, about) and everyday vocabulary suited to the level, used only inside the grammar allowed here.

## 1.2 Already taught: use freely

The learner already knows the grammar below. Do not force it, but use it whenever it makes a sentence more natural, and never avoid it just because it is not the target.

{{allowed_block}}

## 1.3 Target grammar of this topic

{{target_block}}

## 1.4 NOT taught yet: never use

{{forbidden_block}}

If an idea needs anything from 1.4, drop the idea and write a different sentence. Never work around the rule by rephrasing into another form from 1.4.

# 2. Structures to cover

This playlist must cover every structure below. Write at least {{min_each}} sentences for each one and distribute the rest freely. Each example only shows the pattern: never copy it and never output the example sentences themselves. Make every sentence different in subject, vocabulary and meaning.

{{structures_block}}

Tag each sentence with the id of the structure it mainly practises.

# 3. Theme

{{context_block}}

How to use the theme:

- Every sentence should be something a person could really say in this context: think of it as a line spoken, or said about someone, in one of the situations of its scene.
{{characters_rule}}- {{scene_rule}}
- Use theme vocabulary only where the allowed grammar lets you. Many nouns need an article, a plural or a possessive that the learner may not have studied yet. When a theme word does not fit the allowed grammar, do not use it: use a name, an adjective, a place or another word that does fit.
- If a scene cannot be expressed with the allowed grammar, write fewer sentences for it, or none. Never break a grammar rule to cover a scene.
- Grammar always wins over theme. If a sentence cannot be both on-theme and inside the grammar rules, keep the grammar rules and make the sentence a little more general.

# 4. Form rules

- {{word_min}} to {{word_max}} words per sentence (a contraction counts as one word).
{{one_clause_rule}}- One complete sentence each, ending in a full stop, a question mark or an exclamation mark.
- Straight apostrophes only (') and straight double quotes ("). Never curly ones.
- Numbers as words, never digits. No symbols, emojis, URLs, hashtags or abbreviations (Mr., etc.).
- Use contractions the way a native speaker does in speech (I'm, she's, isn't, don't).
- No more than {{max_same_start}} sentences in the list may begin with the same word. Vary the subjects, the verbs and the vocabulary.
- No duplicates and no near-duplicates.
- Neutral, respectful content. No sensitive, political or offensive topics.
- Avoid what is hard to follow by ear: tongue-twisters, hard-to-pronounce names, long lists, sentences that depend on spelling, capital letters or something visual ("Look at this!").
- No translations, no explanations, no numbering.

# 5. Check before answering

Reread every sentence and remove or rewrite it if it:

1. uses anything from 1.4;
2. is outside {{word_min}}–{{word_max}} words;
3. repeats another sentence, or copies an example from section 2;
4. is unnatural or something nobody would say;
5. contains a digit, a curly apostrophe, or a symbol.

# 6. Output

Return only valid JSON, with no text before or after it, in exactly this shape:

```json
{ "sentences": [ { "text": "…", "structure": "<structure id>", "scene": "<scene id>" } ] }
```

- "structure" must be one of: {{structure_ids}}
- "scene" must be one of: {{scene_ids}}
- Aim for {{count}} sentences. If you cannot write {{count}} valid ones, return fewer. Never include a sentence that breaks section 1 just to reach the number.
