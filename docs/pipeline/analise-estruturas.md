# Análise das estruturas por tópico

Gerado por `pipeline/validator/analyze.py` (spaCy `en_core_web_sm`). Não edite à mão.

Cada estrutura tem uma regra spaCy e uma frase de exemplo. O exemplo precisa: ser detectado pela própria regra, caber na faixa de palavras do nível e não conter nenhuma feature introduzida em tópico posterior. **novo** = o exemplo usa uma feature introduzida no próprio tópico; **revisão** = só usa o que já foi ensinado.

| Nível | # | Tópico | Estruturas | Frases por estrutura (100) | Só novo | Novo + anterior | Revisão | Detectadas | Com erro |
|---|---|---|---|---|---|---|---|---|---|
| A1 | 1 | `subject-pronouns-and-verb-to-be` | 10 | ~10 | 10 | 0 | 0 | 10 | 0 |
| A1 | 2 | `to-be-negative-questions-and-possessives` | 11 | ~9 | 0 | 11 | 0 | 11 | 0 |
| A1 | 3 | `articles-a-an` | 8 | ~12 | 0 | 8 | 0 | 8 | 0 |
| A1 | 4 | `plurals-and-demonstratives` | 9 | ~11 | 0 | 9 | 0 | 9 | 0 |
| A1 | 5 | `article-the` | 8 | ~12 | 0 | 8 | 0 | 8 | 0 |
| A1 | 6 | `prepositions-in-on-at` | 9 | ~11 | 0 | 5 | 4 | 9 | 0 |
| A1 | 7 | `there-is-there-are` | 8 | ~12 | 0 | 8 | 0 | 8 | 0 |
| A1 | 8 | `numbers-dates-and-times` | 12 | ~8 | 0 | 11 | 1 | 12 | 0 |
| A1 | 9 | `have-got` | 8 | ~12 | 0 | 6 | 2 | 8 | 0 |
| A1 | 10 | `present-simple` | 13 | ~8 | 0 | 13 | 0 | 13 | 0 |
| A1 | 11 | `can-ability` | 8 | ~12 | 0 | 8 | 0 | 8 | 0 |
| A1 | 12 | `imperative` | 9 | ~11 | 2 | 7 | 0 | 9 | 0 |
| A2 | 1 | `object-pronouns` | 12 | ~8 | 0 | 12 | 0 | 12 | 0 |
| A2 | 2 | `possessive-pronouns-and-genitive` | 11 | ~9 | 0 | 10 | 1 | 11 | 0 |
| A2 | 3 | `adverbs-of-frequency-and-manner` | 13 | ~8 | 0 | 13 | 0 | 13 | 0 |
| A2 | 4 | `present-continuous` | 11 | ~9 | 0 | 11 | 0 | 11 | 0 |
| A2 | 5 | `countable-uncountable` | 12 | ~8 | 0 | 12 | 0 | 12 | 0 |
| A2 | 6 | `question-words` | 12 | ~8 | 0 | 12 | 0 | 12 | 0 |
| A2 | 7 | `verb-ing-or-to` | 10 | ~10 | 0 | 10 | 0 | 10 | 0 |
| A2 | 8 | `future-going-to-and-will` | 11 | ~9 | 0 | 11 | 0 | 11 | 0 |
| A2 | 9 | `have-to-must-should` | 11 | ~9 | 0 | 11 | 0 | 11 | 0 |
| A2 | 10 | `past-of-to-be` | 9 | ~11 | 0 | 9 | 0 | 9 | 0 |
| A2 | 11 | `past-simple` | 13 | ~8 | 0 | 13 | 0 | 13 | 0 |
| A2 | 12 | `comparatives-and-superlatives` | 11 | ~9 | 0 | 11 | 0 | 11 | 0 |
| A2 | 13 | `simple-connectors` | 9 | ~11 | 0 | 7 | 2 | 9 | 0 |
| B1 | 1 | `present-perfect` | 14 | ~7 | 0 | 14 | 0 | 14 | 0 |
| B1 | 2 | `present-perfect-vs-past-simple` | 8 | ~12 | 0 | 0 | 8 | 8 | 0 |
| B1 | 3 | `past-continuous-vs-past-simple` | 8 | ~12 | 0 | 8 | 0 | 8 | 0 |
| B1 | 4 | `used-to-be-used-to` | 10 | ~10 | 0 | 8 | 2 | 10 | 0 |
| B1 | 5 | `gerund-vs-infinitive` | 10 | ~10 | 0 | 4 | 6 | 10 | 0 |
| B1 | 6 | `modals-of-possibility-and-deduction` | 9 | ~11 | 0 | 7 | 2 | 9 | 0 |
| B1 | 7 | `first-and-second-conditional` | 10 | ~10 | 0 | 10 | 0 | 10 | 0 |
| B1 | 8 | `passive-voice-present-and-past` | 9 | ~11 | 0 | 9 | 0 | 9 | 0 |
| B1 | 9 | `relative-clauses` | 8 | ~12 | 0 | 8 | 0 | 8 | 0 |
| B1 | 10 | `reported-speech-basic` | 9 | ~11 | 0 | 9 | 0 | 9 | 0 |
| B1 | 11 | `common-phrasal-verbs` | 10 | ~10 | 0 | 8 | 2 | 10 | 0 |
| B1 | 12 | `connectors-b1` | 8 | ~12 | 0 | 5 | 3 | 8 | 0 |
| B2 | 1 | `present-perfect-continuous` | 9 | ~11 | 0 | 9 | 0 | 9 | 0 |
| B2 | 2 | `past-perfect-and-past-perfect-continuous` | 9 | ~11 | 0 | 9 | 0 | 9 | 0 |
| B2 | 3 | `third-and-mixed-conditionals` | 8 | ~12 | 0 | 7 | 1 | 8 | 0 |
| B2 | 4 | `wish-if-only` | 9 | ~11 | 0 | 9 | 0 | 9 | 0 |
| B2 | 5 | `past-modals` | 9 | ~11 | 0 | 8 | 1 | 9 | 0 |
| B2 | 6 | `passive-voice-advanced` | 10 | ~10 | 0 | 7 | 3 | 10 | 0 |
| B2 | 7 | `reported-speech-full` | 11 | ~9 | 0 | 9 | 2 | 11 | 0 |
| B2 | 8 | `non-defining-relative-clauses` | 8 | ~12 | 0 | 6 | 2 | 8 | 0 |
| B2 | 9 | `future-continuous-and-future-perfect` | 9 | ~11 | 0 | 9 | 0 | 9 | 0 |
| B2 | 10 | `inversion-for-emphasis` | 10 | ~10 | 0 | 10 | 0 | 10 | 0 |
| B2 | 11 | `formal-connectors` | 14 | ~7 | 0 | 14 | 0 | 14 | 0 |
| B2 | 12 | `advanced-phrasal-verbs-and-collocations` | 14 | ~7 | 0 | 10 | 4 | 14 | 0 |
| B2 | 13 | `formal-vs-informal-register` | 11 | ~9 | 0 | 9 | 2 | 11 | 0 |
| | | **Total** | **502** | | **12** | **442** | **48** | **502** | **0** |

**Só novo** = o exemplo usa o recurso do tópico e nada de tópicos anteriores. **Novo + anterior** = combina o recurso novo com algo já ensinado (incremental). **Revisão** = só usa o que já foi ensinado.

## Regras largas (detectam ≥10% dos exemplos de outros tópicos)

Regras largas não distinguem bem a estrutura. Servem para contagem de cobertura, mas não para provar que a frase é *daquela* estrutura.

- `article-the/the-after-prep`: 89 exemplos de outros tópicos (18%)
- `plurals-and-demonstratives/plural-s`: 69 exemplos de outros tópicos (14%)
- `articles-a-an/a-consonant`: 66 exemplos de outros tópicos (13%)
- `past-simple/regular-ed`: 52 exemplos de outros tópicos (11%)
- `present-simple/i-you-we-they`: 51 exemplos de outros tópicos (10%)

## A1 · 1. Subject pronouns and the verb to be (affirmative) (`subject-pronouns-and-verb-to-be`)

- ✔ `i-am` (novo) “I am very tired today.”
- ✔ `you-are` (novo) “You are very kind today.”
- ✔ `he-she-is` (novo) “She is happy today.”
- ✔ `it-is` (novo) “It is very cold today.”
- ✔ `we-they-are` (novo) “They are at home now.”
- ✔ `name-is` (novo) “Maria is at home now.”
- ✔ `be-place` (novo) “We are in London today.”
- ✔ `be-from` (novo) “I am from Brazil, and you?”
- ✔ `contraction` (novo) “We're very happy today.”
- ✔ `coordinated` (novo) “He is tired, but we are ready.”

## A1 · 2. The verb to be (negative and questions) and possessives (`to-be-negative-questions-and-possessives`)

- ✔ `negative-full` (novo+anterior) “I am not late today.”
- ✔ `negative-contraction` (novo+anterior) “She isn't at home now.”
- ✔ `yes-no-question` (novo+anterior) “Are you ready now?”
- ✔ `short-answer` (novo+anterior) “Yes, we are, my friend.”
- ✔ `wh-what` (novo+anterior) “What is your name?”
- ✔ `wh-where` (novo+anterior) “Where are you from?”
- ✔ `wh-who-how` (novo+anterior) “How old are you today?”
- ✔ `poss-my-your` (novo+anterior) “My name is Ana.”
- ✔ `poss-his-her` (novo+anterior) “Her brother is at home.”
- ✔ `poss-our-their` (novo+anterior) “Their house is in Paris.”
- ✔ `poss-negative` (novo+anterior) “Your bag isn't here now.”

## A1 · 3. Articles a and an (`articles-a-an`)

- ✔ `a-consonant` (novo+anterior) “He is a good cook.”
- ✔ `an-vowel` (novo+anterior) “It is an apple.”
- ✔ `profession` (novo+anterior) “My brother is a doctor.”
- ✔ `a-adj-noun` (novo+anterior) “It is a good idea.”
- ✔ `a-question` (novo+anterior) “Is it a good idea?”
- ✔ `a-negative` (novo+anterior) “It is not a problem.”
- ✔ `a-after-prep` (novo+anterior) “He is in a small town.”
- ✔ `a-or-a` (novo+anterior) “Is he a doctor or a nurse?”

## A1 · 4. Plural nouns and this / that / these / those (`plurals-and-demonstratives`)

- ✔ `plural-s` (novo+anterior) “They are good friends.”
- ✔ `plural-es-ies` (novo+anterior) “Her babies are very happy.”
- ✔ `plural-irregular` (novo+anterior) “Those men are very kind.”
- ✔ `this` (novo+anterior) “This is a good book.”
- ✔ `that` (novo+anterior) “That is an old car.”
- ✔ `these` (novo+anterior) “These are my bags.”
- ✔ `those` (novo+anterior) “Those are not my keys.”
- ✔ `demonstrative-noun` (novo+anterior) “This bag is very heavy.”
- ✔ `demonstrative-question` (novo+anterior) “Are these your keys?”

## A1 · 5. The article the (`article-the`)

- ✔ `the-subject` (novo+anterior) “The park is very big.”
- ✔ `the-after-prep` (novo+anterior) “We are at the station.”
- ✔ `the-plural` (novo+anterior) “The children are at school.”
- ✔ `a-and-the` (novo+anterior) “She is a teacher at the school.”
- ✔ `the-question` (novo+anterior) “Is the door open now?”
- ✔ `the-negative` (novo+anterior) “The door is not open.”
- ✔ `the-attribute` (novo+anterior) “This is the right room.”
- ✔ `the-same` (novo+anterior) “We are in the same room.”

## A1 · 6. Prepositions in, on, at (`prepositions-in-on-at`)

- ✔ `in-place` (revisão) “They are in the kitchen.”
- ✔ `on-surface` (novo+anterior) “The book is on the table.”
- ✔ `at-place` (revisão) “She is at the door.”
- ✔ `in-city-country` (revisão) “My uncle is in Spain today.”
- ✔ `at-home-school-work` (revisão) “The kids are at school now.”
- ✔ `on-street-floor` (novo+anterior) “My house is on this street.”
- ✔ `on-negative` (novo+anterior) “The keys are not on the table.”
- ✔ `on-question` (novo+anterior) “Is the bag on the chair?”
- ✔ `in-and-on` (novo+anterior) “The cat is on the chair in the kitchen.”

## A1 · 7. There is / there are (`there-is-there-are`)

- ✔ `there-is` (novo+anterior) “There is a book on the table.”
- ✔ `there-are` (novo+anterior) “There are two cats in the garden.”
- ✔ `there-contraction` (novo+anterior) “There's a cat on the chair.”
- ✔ `there-negative` (novo+anterior) “There isn't a bank near here.”
- ✔ `there-question-is` (novo+anterior) “Is there a bank near here?”
- ✔ `there-question-are` (novo+anterior) “Are there two beds in the room?”
- ✔ `there-number` (novo+anterior) “There are seven days in a week.”
- ✔ `there-adj` (novo+anterior) “There is an old tree here.”

## A1 · 8. Numbers, dates and times (`numbers-dates-and-times`)

- ✔ `cardinal-11-99` (novo+anterior) “There are twenty books here.”
- ✔ `hundred-thousand` (novo+anterior) “There are two hundred people here.”
- ✔ `ordinal` (novo+anterior) “It is the third door.”
- ✔ `month` (novo+anterior) “My birthday is in May.”
- ✔ `weekday` (novo+anterior) “The class is on Monday.”
- ✔ `full-date` (novo+anterior) “My birthday is on May fifth.”
- ✔ `oclock` (novo+anterior) “It is seven o'clock now.”
- ✔ `half-past` (novo+anterior) “It is half past seven.”
- ✔ `quarter` (novo+anterior) “It is a quarter to nine.”
- ✔ `time-question` (revisão) “What time is it now?”
- ✔ `at-time` (novo+anterior) “The film is at eight thirty.”
- ✔ `age` (novo+anterior) “My brother is twenty years old.”

## A1 · 9. Have got (`have-got`)

- ✔ `have-got` (novo+anterior) “I have got a new phone.”
- ✔ `has-got` (novo+anterior) “She has got a big family.”
- ✔ `have-main` (novo+anterior) “We have a small house.”
- ✔ `negative` (revisão) “I haven't got a car.”
- ✔ `question` (revisão) “Have you got a pen?”
- ✔ `short-answer` (novo+anterior) “Yes, I have, my friend.”
- ✔ `have-got-number` (novo+anterior) “She has got two brothers.”
- ✔ `has-got-poss` (novo+anterior) “My sister has got long hair.”

## A1 · 10. Present Simple (`present-simple`)

- ✔ `i-you-we-they` (novo+anterior) “We play football on Sunday.”
- ✔ `he-she-s` (novo+anterior) “She works in a hospital.”
- ✔ `es-ending` (novo+anterior) “He watches films at night.”
- ✔ `ies-ending` (novo+anterior) “She studies English at home.”
- ✔ `irregular-3rd` (novo+anterior) “He goes to school by bus.”
- ✔ `dont` (novo+anterior) “I don't like cold tea.”
- ✔ `doesnt` (novo+anterior) “She doesn't work on Sunday.”
- ✔ `do-question` (novo+anterior) “Do you like music?”
- ✔ `does-question` (novo+anterior) “Does he live in London?”
- ✔ `short-answer` (novo+anterior) “Yes, I do, my friend.”
- ✔ `verb-object` (novo+anterior) “They eat rice and beans.”
- ✔ `at-time` (novo+anterior) “The shop opens at nine.”
- ✔ `two-verbs` (novo+anterior) “She gets up and drinks tea.”

## A1 · 11. Can (ability) (`can-ability`)

- ✔ `can-affirmative` (novo+anterior) “I can swim and run.”
- ✔ `cant` (novo+anterior) “She can't drive a car.”
- ✔ `can-question` (novo+anterior) “Can you cook rice?”
- ✔ `short-answer` (novo+anterior) “Yes, I can, my friend.”
- ✔ `can-object` (novo+anterior) “They can play the guitar.”
- ✔ `can-two-verbs` (novo+anterior) “He can sing and dance.”
- ✔ `can-3rd-person` (novo+anterior) “She can speak three languages.”
- ✔ `cant-but-can` (novo+anterior) “I can't swim, but I can run.”

## A1 · 12. The imperative (`imperative`)

- ✔ `affirmative` (novo+anterior) “Open the door, please.”
- ✔ `negative-dont` (novo+anterior) “Don't open the window now.”
- ✔ `please-first` (novo) “Please sit down here.”
- ✔ `phrasal-chunk` (novo) “Stand up and sit down, please.”
- ✔ `lets` (novo+anterior) “Let's go to the park.”
- ✔ `be-adjective` (novo+anterior) “Be careful on the road.”
- ✔ `vocative` (novo+anterior) “Please close the door, Maria.”
- ✔ `two-imperatives` (novo+anterior) “Open your book and read.”
- ✔ `dont-be` (novo+anterior) “Please don't be late again.”

## A2 · 1. Object pronouns (me, you, him, her, it, us, them) (`object-pronouns`)

- ✔ `me` (novo+anterior) “She calls me on Sunday.”
- ✔ `you` (novo+anterior) “I can see you at the door.”
- ✔ `him` (novo+anterior) “They know him from school.”
- ✔ `her` (novo+anterior) “I help her at home.”
- ✔ `it` (novo+anterior) “We like it at home.”
- ✔ `us` (novo+anterior) “Ana calls us on Monday.”
- ✔ `them` (novo+anterior) “I see them at school.”
- ✔ `after-preposition` (novo+anterior) “This gift is for you.”
- ✔ `imperative-with` (novo+anterior) “Come with me, please.”
- ✔ `indirect-object` (novo+anterior) “She gives me a book.”
- ✔ `question` (novo+anterior) “Do you know them?”
- ✔ `negative` (novo+anterior) “I don't know her.”

## A2 · 2. Possessive pronouns (mine, yours...) and 's (`possessive-pronouns-and-genitive`)

Aprofunda `subject-pronouns-and-verb-to-be`.

- ✔ `mine` (novo+anterior) “This bag is mine.”
- ✔ `yours` (novo+anterior) “Is this pen yours?”
- ✔ `his-hers` (novo+anterior) “The red car is hers.”
- ✔ `ours-theirs` (novo+anterior) “These keys are ours.”
- ✔ `genitive-singular` (novo+anterior) “Maria's bag is on the table.”
- ✔ `genitive-family` (novo+anterior) “My sister's name is Ana.”
- ✔ `genitive-plural` (novo+anterior) “The kids' room is very small.”
- ✔ `whose` (revisão) “Whose bag is this?”
- ✔ `adj-and-pronoun` (novo+anterior) “This is my book, and that is yours.”
- ✔ `genitive-place` (novo+anterior) “We are at Ana's house.”
- ✔ `of-mine` (novo+anterior) “She is a friend of mine.”

## A2 · 3. Adverbs of frequency and manner (`adverbs-of-frequency-and-manner`)

- ✔ `always` (novo+anterior) “I always drink tea in the morning.”
- ✔ `usually` (novo+anterior) “She usually works at home.”
- ✔ `often` (novo+anterior) “We often eat at school.”
- ✔ `sometimes` (novo+anterior) “He sometimes plays football on Sunday.”
- ✔ `never` (novo+anterior) “They never watch TV at night.”
- ✔ `rarely` (novo+anterior) “I rarely go out on Monday.”
- ✔ `after-be` (novo+anterior) “She is always late for class.”
- ✔ `every` (novo+anterior) “I walk to school every day.”
- ✔ `once-twice` (novo+anterior) “We play football twice a week.”
- ✔ `manner-ly` (novo+anterior) “He drives very slowly.”
- ✔ `manner-well-fast-hard` (novo+anterior) “They work hard at school.”
- ✔ `question-often` (novo+anterior) “Do you often cook at home?”
- ✔ `negative-freq` (novo+anterior) “I don't always eat breakfast.”

## A2 · 4. Present Continuous (`present-continuous`)

- ✔ `i-am-ing` (novo+anterior) “I am reading a book now.”
- ✔ `are-ing` (novo+anterior) “They are playing in the park.”
- ✔ `is-ing` (novo+anterior) “She is cooking dinner now.”
- ✔ `negative` (novo+anterior) “He isn't sleeping right now.”
- ✔ `question` (novo+anterior) “Are you working today?”
- ✔ `doubling` (novo+anterior) “They are running in the park.”
- ✔ `drop-e` (novo+anterior) “She is writing an email now.”
- ✔ `future-arrangement` (novo+anterior) “I am meeting my friend on Friday.”
- ✔ `at-the-moment` (novo+anterior) “He is working at the moment.”
- ✔ `wh-question` (novo+anterior) “What is she doing now?”
- ✔ `contrast-simple` (novo+anterior) “I usually walk, but today I am driving.”

## A2 · 5. Countable and uncountable nouns (some, any, much, many) (`countable-uncountable`)

- ✔ `some-plural` (novo+anterior) “I have some friends in London.”
- ✔ `some-uncountable` (novo+anterior) “We need some water.”
- ✔ `any-negative` (novo+anterior) “I don't have any money.”
- ✔ `any-question` (novo+anterior) “Do you have any brothers?”
- ✔ `much` (novo+anterior) “I don't drink much coffee.”
- ✔ `many` (novo+anterior) “They don't have many friends here.”
- ✔ `a-lot-of` (novo+anterior) “She eats a lot of fruit.”
- ✔ `how-much` (novo+anterior) “How much is this book?”
- ✔ `how-many` (novo+anterior) “How many books are on the table?”
- ✔ `a-few-a-little` (novo+anterior) “She has a few friends.”
- ✔ `enough` (novo+anterior) “There is enough food here.”
- ✔ `mixed` (novo+anterior) “I need an apple and some bread.”

## A2 · 6. Question words (what, where, who, when, why, how, which) (`question-words`)

Aprofunda `to-be-negative-questions-and-possessives`.

- ✔ `what` (novo+anterior) “What do you do on Sunday?”
- ✔ `where` (novo+anterior) “Where does she live?”
- ✔ `who-subject` (novo+anterior) “Who lives in this house?”
- ✔ `when` (novo+anterior) “When do you get up?”
- ✔ `why` (novo+anterior) “Why do you like this song?”
- ✔ `how` (novo+anterior) “How do you go to school?”
- ✔ `which` (novo+anterior) “Which bag do you want?”
- ✔ `what-time` (novo+anterior) “What time do you wake up?”
- ✔ `how-often` (novo+anterior) “How often do you play football?”
- ✔ `how-many` (novo+anterior) “How many brothers do you have?”
- ✔ `how-long` (novo+anterior) “How long does the class take?”
- ✔ `wh-can` (novo+anterior) “What can you cook?”

## A2 · 7. Verb + -ing / to (`verb-ing-or-to`)

- ✔ `like-ing` (novo+anterior) “I like swimming in the sea.”
- ✔ `enjoy-ing` (novo+anterior) “She enjoys cooking for friends.”
- ✔ `hate-ing` (novo+anterior) “He hates waiting for the bus.”
- ✔ `want-to` (novo+anterior) “I want to learn English.”
- ✔ `need-to` (novo+anterior) “We need to leave now.”
- ✔ `hope-plan-to` (novo+anterior) “They plan to visit Spain.”
- ✔ `like-to` (novo+anterior) “I like to read at night.”
- ✔ `negative` (novo+anterior) “I don't want to go home.”
- ✔ `question` (novo+anterior) “Do you enjoy cooking?”
- ✔ `go-ing` (novo+anterior) “We go shopping on Saturday.”

## A2 · 8. Future with going to and will (`future-going-to-and-will`)

- ✔ `going-to` (novo+anterior) “I am going to learn Spanish.”
- ✔ `going-to-negative` (novo+anterior) “She isn't going to come today.”
- ✔ `going-to-question` (novo+anterior) “Are you going to cook tonight?”
- ✔ `will` (novo+anterior) “I will call you tomorrow.”
- ✔ `contraction-ll` (novo+anterior) “We'll see you on Friday.”
- ✔ `wont` (novo+anterior) “He won't be late tonight.”
- ✔ `will-question` (novo+anterior) “Will you help me?”
- ✔ `future-time` (novo+anterior) “She will travel next week.”
- ✔ `prediction` (novo+anterior) “It is going to rain today.”
- ✔ `offer` (novo+anterior) “I will help you with that.”
- ✔ `wh-going-to` (novo+anterior) “What are you going to do?”

## A2 · 9. Have to, must and should (`have-to-must-should`)

- ✔ `have-to` (novo+anterior) “I have to work on Saturday.”
- ✔ `has-to` (novo+anterior) “She has to wake up early.”
- ✔ `dont-have-to` (novo+anterior) “You don't have to pay today.”
- ✔ `question-have-to` (novo+anterior) “Do we have to go now?”
- ✔ `must` (novo+anterior) “You must wear a seat belt.”
- ✔ `mustnt` (novo+anterior) “You mustn't run here.”
- ✔ `should` (novo+anterior) “You should sleep early.”
- ✔ `shouldnt` (novo+anterior) “He shouldn't eat late at night.”
- ✔ `should-question` (novo+anterior) “Should I call him?”
- ✔ `wh-should` (novo+anterior) “What should I do?”
- ✔ `must-vs-have-to` (novo+anterior) “I must go, but you don't have to.”

## A2 · 10. Past of the verb to be (was / were) (`past-of-to-be`)

Aprofunda `subject-pronouns-and-verb-to-be`.

- ✔ `was` (novo+anterior) “I was at home yesterday.”
- ✔ `were` (novo+anterior) “We were in London last week.”
- ✔ `negative` (novo+anterior) “She wasn't at school today.”
- ✔ `was-question` (novo+anterior) “Was the film good?”
- ✔ `were-question` (novo+anterior) “Were you tired last night?”
- ✔ `wh-was-were` (novo+anterior) “Where were you yesterday?”
- ✔ `there-was` (novo+anterior) “There was a bank here.”
- ✔ `short-answer` (novo+anterior) “Yes, I was, my friend.”
- ✔ `profession` (novo+anterior) “My father was a teacher.”

## A2 · 11. Past Simple (regular and irregular) (`past-simple`)

- ✔ `regular-ed` (novo+anterior) “I walked to school yesterday.”
- ✔ `regular-d` (novo+anterior) “She lived in Paris last year.”
- ✔ `regular-ied` (novo+anterior) “She studied English last night.”
- ✔ `regular-doubling` (novo+anterior) “We stopped at the corner.”
- ✔ `irregular-went` (novo+anterior) “We went to the park.”
- ✔ `irregular-obj` (novo+anterior) “I saw her yesterday.”
- ✔ `had` (novo+anterior) “She had a headache.”
- ✔ `negative` (novo+anterior) “I didn't like the film.”
- ✔ `question` (novo+anterior) “Did you watch the game?”
- ✔ `short-answer` (novo+anterior) “Yes, I did, my friend.”
- ✔ `wh-did` (novo+anterior) “Where did you go yesterday?”
- ✔ `ago` (novo+anterior) “They arrived two days ago.”
- ✔ `two-verbs` (novo+anterior) “She woke up and made tea.”

## A2 · 12. Comparatives and superlatives (`comparatives-and-superlatives`)

- ✔ `er-than` (novo+anterior) “My bag is smaller than yours.”
- ✔ `more-than` (novo+anterior) “This book is more interesting than that one.”
- ✔ `better-worse` (novo+anterior) “Today is better than yesterday.”
- ✔ `ier` (novo+anterior) “This exercise is easier than that.”
- ✔ `est` (novo+anterior) “He is the tallest boy in class.”
- ✔ `most` (novo+anterior) “This is the most popular song.”
- ✔ `best-worst` (novo+anterior) “She is the best cook in town.”
- ✔ `as-as` (novo+anterior) “He is as tall as his father.”
- ✔ `not-as-as` (novo+anterior) “Your phone isn't as new as mine.”
- ✔ `question` (novo+anterior) “Is this bag cheaper than that one?”
- ✔ `adverb-comparative` (novo+anterior) “She runs faster than me.”

## A2 · 13. Simple connectors (and, but, because, so) (`simple-connectors`)

- ✔ `because` (novo+anterior) “I am tired because I worked late.”
- ✔ `so` (novo+anterior) “It was cold, so we stayed home.”
- ✔ `or` (revisão) “Do you want tea or coffee?”
- ✔ `and-but` (revisão) “I like tea, but she likes coffee.”
- ✔ `when` (novo+anterior) “I call her when I arrive.”
- ✔ `before` (novo+anterior) “Wash your hands before you eat.”
- ✔ `after` (novo+anterior) “We watched TV after we ate.”
- ✔ `then` (novo+anterior) “First I cook, then I eat.”
- ✔ `because-past` (novo+anterior) “She stayed home because she was ill.”

## B1 · 1. Present Perfect (for, since, already, yet, ever) (`present-perfect`)

- ✔ `regular` (novo+anterior) “I have visited three countries in my life.”
- ✔ `irregular` (novo+anterior) “She has seen that new film three times already.”
- ✔ `negative` (novo+anterior) “We haven't finished the project because of the problem.”
- ✔ `question` (novo+anterior) “Have you ever been to another country by plane?”
- ✔ `ever` (novo+anterior) “Have you ever tried the food from Japan?”
- ✔ `never` (novo+anterior) “I have never seen such a beautiful place before.”
- ✔ `already` (novo+anterior) “They have already left the office for today.”
- ✔ `yet` (novo+anterior) “She hasn't called her mother yet this week.”
- ✔ `just` (novo+anterior) “I have just finished my homework, so I am free.”
- ✔ `for-duration` (novo+anterior) “We have lived in this city for ten years.”
- ✔ `since` (novo+anterior) “He has worked here since last September and he likes it.”
- ✔ `recently` (novo+anterior) “I have recently started a new course at school.”
- ✔ `wh-question` (novo+anterior) “How long have you studied English at this school?”
- ✔ `been-to` (novo+anterior) “I have been to the new museum twice.”

## B1 · 2. Present Perfect vs. Past Simple (`present-perfect-vs-past-simple`)

- ✔ `unfinished-vs-finished` (revisão) “I saw that film last week, but she has not seen it.”
- ✔ `since-clause` (revisão) “She has lived in this town since she was a child.”
- ✔ `past-with-when` (revisão) “She lived in this town when she was a child.”
- ✔ `result-now` (revisão) “I have lost my keys, so I cannot open the door.”
- ✔ `past-ago` (revisão) “We bought this house about three years ago, and we love it.”
- ✔ `experience-then-detail` (revisão) “I have visited Spain, and I loved the food there.”
- ✔ `today` (revisão) “I have drunk three coffees today, and I feel very tired.”
- ✔ `yesterday-vs-today` (revisão) “I didn't see her yesterday, but I have seen her today.”

## B1 · 3. Past Continuous vs. Past Simple (`past-continuous-vs-past-simple`)

- ✔ `was-were-ing` (novo+anterior) “I was cooking dinner when my phone rang.”
- ✔ `negative` (novo+anterior) “We weren't sleeping when the storm started last night.”
- ✔ `wh-question` (novo+anterior) “What were you doing at nine o'clock last night?”
- ✔ `yes-no-question` (novo+anterior) “Was she studying when you called her yesterday evening?”
- ✔ `while` (novo+anterior) “I was walking home while it was raining very hard.”
- ✔ `interrupted` (novo+anterior) “She was reading a book when the lights went out.”
- ✔ `parallel` (novo+anterior) “He was cooking while she was washing the dishes.”
- ✔ `background` (novo+anterior) “It was raining and everybody was running to the bus stop.”

## B1 · 4. Used to / be used to (`used-to-be-used-to`)

- ✔ `used-to` (novo+anterior) “I used to play football every weekend with my cousins.”
- ✔ `didnt-use-to` (revisão) “She didn't use to like coffee, but now she loves it.”
- ✔ `question` (revisão) “Did you use to live near the sea as a child?”
- ✔ `state` (novo+anterior) “We used to have a big dog in the old house.”
- ✔ `contrast-now` (novo+anterior) “I used to be shy, but now I talk to everyone.”
- ✔ `be-used-to-noun` (novo+anterior) “I am used to the noise because I live downtown.”
- ✔ `be-used-to-ing` (novo+anterior) “He is used to getting up early every morning.”
- ✔ `get-used-to` (novo+anterior) “It takes time to get used to a new city.”
- ✔ `negative-be-used` (novo+anterior) “I am not used to the cold weather here yet.”
- ✔ `with-when` (novo+anterior) “When I was young, I used to climb trees all the time.”

## B1 · 5. Gerund vs. infinitive (`gerund-vs-infinitive`)

Aprofunda `verb-ing-or-to`.

- ✔ `gerund-subject` (novo+anterior) “Swimming every morning is very good for your health.”
- ✔ `after-preposition` (novo+anterior) “She is good at solving problems and explaining ideas to people.”
- ✔ `before-after-ing` (novo+anterior) “Wash your hands before eating anything at the table.”
- ✔ `stop-ing` (revisão) “He stopped smoking last year because he wanted to be healthy.”
- ✔ `stop-to` (revisão) “He stopped to buy some water on the way home.”
- ✔ `remember-to` (novo+anterior) “I remembered to lock the door before leaving the house.”
- ✔ `try-ing` (revisão) “Try turning it off and on again, because it often works.”
- ✔ `verbs-plus-ing` (revisão) “She avoids eating late because it makes her feel tired.”
- ✔ `verbs-plus-to` (revisão) “We managed to arrive early because the road was empty.”
- ✔ `adjective-to` (revisão) “It is important to drink enough water every day.”

## B1 · 6. Modals of possibility and deduction (`modals-of-possibility-and-deduction`)

- ✔ `may` (novo+anterior) “It may rain this afternoon, so take an umbrella with you.”
- ✔ `might` (novo+anterior) “She might be at home because her car is outside.”
- ✔ `could` (novo+anterior) “That could be a good solution to this big problem.”
- ✔ `must-deduction` (revisão) “He must be tired because he worked all night.”
- ✔ `cant-deduction` (revisão) “That can't be Ana, because she is in Spain now.”
- ✔ `might-not` (novo+anterior) “They might not come to the party tonight because of work.”
- ✔ `continuous` (novo+anterior) “She may be sleeping now, so please speak very quietly.”
- ✔ `question` (novo+anterior) “Could this be the right address for the party tonight?”
- ✔ `certainty-scale` (novo+anterior) “It is probably true, but it could also be a mistake.”

## B1 · 7. First and second conditional (`first-and-second-conditional`)

- ✔ `first` (novo+anterior) “If it rains tomorrow, we will stay at home and watch films.”
- ✔ `first-can` (novo+anterior) “If you need help, you can call me at any time.”
- ✔ `first-negative` (novo+anterior) “If you don't study, you won't pass the exam next week.”
- ✔ `first-if-last` (novo+anterior) “We will go to the beach if the weather is nice.”
- ✔ `second` (novo+anterior) “If I had more money, I would travel around the world.”
- ✔ `second-were` (novo+anterior) “If I were you, I would talk to him about it.”
- ✔ `wouldnt` (novo+anterior) “She wouldn't be so tired if she slept earlier at night.”
- ✔ `wh-second` (novo+anterior) “What would you do if you won a million dollars?”
- ✔ `would-advice` (novo+anterior) “I would take the train because it is cheaper and faster.”
- ✔ `would-like` (novo+anterior) “I would like a table for two near the window, please.”

## B1 · 8. Passive voice (present and past) (`passive-voice-present-and-past`)

- ✔ `present` (novo+anterior) “English is spoken in many countries around the world.”
- ✔ `past` (novo+anterior) “This bridge was built more than a hundred years ago.”
- ✔ `negative` (novo+anterior) “These rooms are not cleaned on Sundays by the staff.”
- ✔ `question` (novo+anterior) “Is breakfast served in the hotel every morning?”
- ✔ `agent` (novo+anterior) “The song was written by a famous singer from Brazil.”
- ✔ `no-agent` (novo+anterior) “My bag was stolen when I was at the station.”
- ✔ `plural` (novo+anterior) “Many films are made in this studio every year.”
- ✔ `was-born` (novo+anterior) “I was born in a small town near the sea.”
- ✔ `wh-passive` (novo+anterior) “Where was this photo taken during your last summer holiday?”

## B1 · 9. Relative clauses (who, which, that, where, whose) (`relative-clauses`)

- ✔ `who` (novo+anterior) “The woman who lives next door is a very kind nurse.”
- ✔ `which` (novo+anterior) “I bought a phone which has a very good camera.”
- ✔ `that` (novo+anterior) “This is the book that I told you about yesterday.”
- ✔ `where` (novo+anterior) “That is the restaurant where we had dinner last week.”
- ✔ `whose` (novo+anterior) “I have a friend whose brother works at the airport.”
- ✔ `contact-clause` (novo+anterior) “The film we saw last night was really boring.”
- ✔ `who-be` (novo+anterior) “People who are late must wait outside the room.”
- ✔ `in-question` (novo+anterior) “Do you know the girl who is sitting over there?”

## B1 · 10. Reported speech (basic) (`reported-speech-basic`)

- ✔ `said-that` (novo+anterior) “She said that she was very tired after the long trip.”
- ✔ `said-without-that` (novo+anterior) “He said he didn't like the film at all.”
- ✔ `told-object` (novo+anterior) “My boss told me that the meeting was cancelled.”
- ✔ `going-to-backshift` (novo+anterior) “They said they were going to buy a new car.”
- ✔ `will-would` (novo+anterior) “He told us that he would call us the next day.”
- ✔ `can-could` (novo+anterior) “She said she could not come because she was ill.”
- ✔ `time-change` (novo+anterior) “He said that he had to leave the next day.”
- ✔ `said-to` (novo+anterior) “He said to me that he was happy with it.”
- ✔ `negative` (novo+anterior) “She said that she didn't know him at all.”

## B1 · 11. Common phrasal verbs (`common-phrasal-verbs`)

- ✔ `separable-noun` (novo+anterior) “She picked up the phone and called her mother.”
- ✔ `separable-pronoun` (novo+anterior) “I picked it up and put it in my bag.”
- ✔ `verb-preposition` (revisão) “We are looking for a cheap hotel near the beach.”
- ✔ `intransitive` (novo+anterior) “The plane took off late because of the heavy rain.”
- ✔ `give-up` (novo+anterior) “He gave up smoking because it was bad for his health.”
- ✔ `find-out` (novo+anterior) “I need to find out the time of the next train.”
- ✔ `get-on` (revisão) “My brother and I get on well with our neighbours.”
- ✔ `imperative-negative` (novo+anterior) “Don't give up, because you are close to the end.”
- ✔ `question` (novo+anterior) “Can you help me fill in this form, please?”
- ✔ `past` (novo+anterior) “They set up a small company about five years ago.”

## B1 · 12. Connectors (although, however, while, in order to) (`connectors-b1`)

- ✔ `although` (novo+anterior) “Although it was raining, we decided to walk to the station.”
- ✔ `though` (novo+anterior) “He passed the exam, though he did not study much.”
- ✔ `however` (novo+anterior) “The food was good; however, the service was very slow.”
- ✔ `despite` (novo+anterior) “Despite the heavy traffic, she arrived at the office on time.”
- ✔ `in-order-to` (novo+anterior) “I use an app in order to learn new words every day.”
- ✔ `while-contrast` (revisão) “Some people like cities, while others prefer the quiet countryside.”
- ✔ `purpose-to` (revisão) “She went to the bank to ask about a new card.”
- ✔ `but-contrast` (revisão) “He studied a lot, but he still failed the final exam.”

## B2 · 1. Present Perfect Continuous (`present-perfect-continuous`)

Aprofunda `present-perfect`.

- ✔ `have-been-ing` (novo+anterior) “I have been waiting for the bus for almost an hour.”
- ✔ `has-been-ing` (novo+anterior) “She has been working at this company since last spring.”
- ✔ `negative` (novo+anterior) “They haven't been sleeping well because of the loud noise outside.”
- ✔ `question` (novo+anterior) “Have you been learning English for a long time?”
- ✔ `how-long` (novo+anterior) “How long have you been living in this small town?”
- ✔ `visible-result` (novo+anterior) “You look tired because you have been working too hard.”
- ✔ `vs-simple` (novo+anterior) “I have been reading this book, but I haven't finished it.”
- ✔ `since` (novo+anterior) “He has been feeling much better since last week.”
- ✔ `all-day` (novo+anterior) “It has been raining all day, so we stayed inside.”

## B2 · 2. Past Perfect and Past Perfect Continuous (`past-perfect-and-past-perfect-continuous`)

- ✔ `affirmative` (novo+anterior) “When we arrived, the film had already started.”
- ✔ `negative` (novo+anterior) “She hadn't eaten anything before the long journey began.”
- ✔ `question` (novo+anterior) “Had you finished your homework before your friends came?”
- ✔ `after` (novo+anterior) “After they had left, I cleaned the whole kitchen.”
- ✔ `by-the-time` (novo+anterior) “By the time he called, I had already gone to bed.”
- ✔ `with-past-simple` (novo+anterior) “I realised that I had forgotten my keys at home.”
- ✔ `continuous` (novo+anterior) “She was tired because she had been working all night.”
- ✔ `continuous-wh` (novo+anterior) “How long had they been waiting when the bus finally came?”
- ✔ `never-before` (novo+anterior) “He had never seen snow before he moved to Canada.”

## B2 · 3. Third conditional and mixed conditionals (`third-and-mixed-conditionals`)

Aprofunda `first-and-second-conditional`.

- ✔ `third` (novo+anterior) “If I had known about the problem, I would have helped you.”
- ✔ `third-negative` (novo+anterior) “If she hadn't missed the bus, she wouldn't have been late.”
- ✔ `third-wh` (novo+anterior) “What would you have done if you had lost your passport?”
- ✔ `third-if-last` (novo+anterior) “We would have won the match if we had played better.”
- ✔ `mixed-past-present` (revisão) “If I had taken that job, I would be rich now.”
- ✔ `mixed-present-past` (novo+anterior) “If I were more organised, I would have finished the report yesterday.”
- ✔ `regret` (novo+anterior) “I would have called you, but I lost my phone.”
- ✔ `contraction` (novo+anterior) “If they had left earlier, they'd have arrived on time.”

## B2 · 4. Wish and if only (`wish-if-only`)

- ✔ `wish-past` (novo+anterior) “I wish I had a bigger house near the beach.”
- ✔ `wish-were` (novo+anterior) “I wish I were taller, but I am not.”
- ✔ `wish-past-perfect` (novo+anterior) “She wishes she had studied medicine at university.”
- ✔ `if-only-past` (novo+anterior) “If only I had more time to relax, I would be happier.”
- ✔ `if-only-past-perfect` (novo+anterior) “If only we had left earlier, we would not be late now.”
- ✔ `wish-would` (novo+anterior) “I wish you would stop making so much noise at night.”
- ✔ `wish-could` (novo+anterior) “I wish I could speak French as well as you.”
- ✔ `wish-negative` (novo+anterior) “I wish I didn't have to work on Saturdays.”
- ✔ `hope-vs-wish` (novo+anterior) “I hope you can come, but I wish you could stay longer.”

## B2 · 5. Past modals (should have, could have, must have...) (`past-modals`)

Aprofunda `modals-of-possibility-and-deduction`.

- ✔ `should-have` (novo+anterior) “You should have told me about the problem earlier.”
- ✔ `shouldnt-have` (novo+anterior) “He shouldn't have left the window open during the storm.”
- ✔ `could-have` (novo+anterior) “We could have taken a taxi, but we walked instead.”
- ✔ `might-have` (novo+anterior) “She might have forgotten the meeting because she was busy.”
- ✔ `must-have` (novo+anterior) “They must have left early because the house is empty.”
- ✔ `cant-have` (novo+anterior) “He can't have seen us, because he was not there.”
- ✔ `may-have` (novo+anterior) “The package may have arrived while we were out.”
- ✔ `would-have` (revisão) “I would have gone to the party, but I was ill.”
- ✔ `question` (novo+anterior) “Could they have made a mistake with the dates?”

## B2 · 6. Passive voice (advanced) (`passive-voice-advanced`)

Aprofunda `passive-voice-present-and-past`.

- ✔ `perfect` (novo+anterior) “The new road has been built by a local company.”
- ✔ `modal` (novo+anterior) “All passengers must be checked before they board the plane.”
- ✔ `future` (novo+anterior) “The results will be announced on Friday afternoon.”
- ✔ `continuous` (novo+anterior) “The bridge is being repaired, so the road is closed.”
- ✔ `past-perfect` (novo+anterior) “The documents had been signed before the lawyer arrived.”
- ✔ `reporting` (revisão) “It is said that the old castle is haunted.”
- ✔ `believed-to` (revisão) “He is believed to be abroad at the moment.”
- ✔ `causative-have` (novo+anterior) “I had my car repaired last week at the garage.”
- ✔ `causative-get` (novo+anterior) “She got her hair cut at the new salon.”
- ✔ `passive-infinitive` (revisão) “He was asked to leave the meeting room immediately.”

## B2 · 7. Reported speech (full) (`reported-speech-full`)

Aprofunda `reported-speech-basic`.

- ✔ `ask-if` (novo+anterior) “She asked me if I had finished the report.”
- ✔ `ask-whether` (novo+anterior) “He asked whether the train had already left the station.”
- ✔ `ask-wh` (novo+anterior) “They asked me where I had bought my jacket.”
- ✔ `tell-to` (novo+anterior) “My manager told me to finish the report today.”
- ✔ `ask-to` (novo+anterior) “She asked him to close the window, please.”
- ✔ `told-not-to` (novo+anterior) “The doctor told him not to eat sweets.”
- ✔ `suggest-ing` (novo+anterior) “He suggested going to the cinema after the class.”
- ✔ `admit-deny` (novo+anterior) “She admitted that she had lost the money.”
- ✔ `promise-to` (novo+anterior) “He promised to call me as soon as he arrived.”
- ✔ `warn` (revisão) “They warned us that the roads were dangerous.”
- ✔ `backshift-past-perfect` (revisão) “He said that he had already seen the film.”

## B2 · 8. Non-defining relative clauses (`non-defining-relative-clauses`)

Aprofunda `relative-clauses`.

- ✔ `who` (novo+anterior) “My brother, who lives in Canada, is visiting us next month.”
- ✔ `which` (novo+anterior) “The hotel, which was built long ago, is very expensive.”
- ✔ `whose` (novo+anterior) “Maria, whose son is a doctor, works at the school.”
- ✔ `where` (novo+anterior) “We visited Rome, where my grandparents were born.”
- ✔ `which-clause` (novo+anterior) “He passed the test, which surprised everybody in the class.”
- ✔ `preposition-which` (revisão) “The company, for which she works, is based in Chicago.”
- ✔ `whom` (novo+anterior) “My teacher, whom I respect a lot, is retiring soon.”
- ✔ `of-whom` (revisão) “Many of the students, most of whom were young, left early.”

## B2 · 9. Future Continuous and Future Perfect (`future-continuous-and-future-perfect`)

- ✔ `continuous` (novo+anterior) “This time next week, I will be lying on a beach.”
- ✔ `continuous-question` (novo+anterior) “Will you be using the car this evening?”
- ✔ `continuous-negative` (novo+anterior) “She won't be working tomorrow because it is a holiday.”
- ✔ `perfect` (novo+anterior) “By next year, I will have finished my degree.”
- ✔ `perfect-negative` (novo+anterior) “They won't have arrived by seven o'clock tonight.”
- ✔ `perfect-question` (novo+anterior) “Will you have finished the project by the end of the month?”
- ✔ `by-the-time` (novo+anterior) “By the time you read this, we will have left.”
- ✔ `for-duration` (novo+anterior) “Next month, I will have worked here for five years.”
- ✔ `at-this-time` (novo+anterior) “At this time tomorrow, we will be flying to Paris.”

## B2 · 10. Inversion for emphasis (`inversion-for-emphasis`)

- ✔ `never` (novo+anterior) “Never have I seen such a beautiful sunset in my life.”
- ✔ `rarely` (novo+anterior) “Rarely does he complain about his heavy workload at the office.”
- ✔ `hardly` (novo+anterior) “Hardly had we arrived when it started to rain.”
- ✔ `no-sooner` (novo+anterior) “No sooner had she sat down than the phone rang.”
- ✔ `not-only` (novo+anterior) “Not only did he forget the tickets, but he also lost his bag.”
- ✔ `only-after` (novo+anterior) “Only after the meeting did I understand the real problem.”
- ✔ `little` (novo+anterior) “Little did they know that the shop was closed.”
- ✔ `conditional-had` (novo+anterior) “Had I known about the delay, I would have taken a taxi.”
- ✔ `conditional-should` (novo+anterior) “Should you need any help, please call me at once.”
- ✔ `conditional-were` (novo+anterior) “Were I in your position, I would accept the offer.”

## B2 · 11. Formal connectors (`formal-connectors`)

Aprofunda `connectors-b1`.

- ✔ `moreover` (novo+anterior) “The plan is cheap; moreover, it is easy to put into practice.”
- ✔ `furthermore` (novo+anterior) “The room is large; furthermore, it has a beautiful view of the sea.”
- ✔ `nevertheless` (novo+anterior) “The weather was awful; nevertheless, we enjoyed the trip very much.”
- ✔ `nonetheless` (novo+anterior) “The test was difficult; nonetheless, most students passed it easily.”
- ✔ `therefore` (novo+anterior) “The roads were closed; therefore, many people could not get to work.”
- ✔ `consequently` (novo+anterior) “He did not study; consequently, he failed the final exam.”
- ✔ `thus-hence` (novo+anterior) “The company grew quickly; thus, it needed more space and staff.”
- ✔ `whereas` (novo+anterior) “Some people prefer the city, whereas others love the countryside.”
- ✔ `unless` (novo+anterior) “You will not be admitted unless you show a valid ticket.”
- ✔ `provided` (novo+anterior) “You can borrow the car provided that you drive carefully.”
- ✔ `in-spite-of` (novo+anterior) “In spite of the rain, the match started on time.”
- ✔ `on-the-other-hand` (novo+anterior) “The job is well paid; on the other hand, it is very stressful.”
- ✔ `as-a-result` (novo+anterior) “The factory closed; as a result, hundreds of workers lost their jobs.”
- ✔ `in-addition` (novo+anterior) “In addition, the hotel offers free breakfast to all of its guests.”

## B2 · 12. Advanced phrasal verbs and collocations (`advanced-phrasal-verbs-and-collocations`)

Aprofunda `common-phrasal-verbs`.

- ✔ `look-forward-to` (revisão) “I am looking forward to meeting you at the conference next week.”
- ✔ `put-up-with` (novo+anterior) “I can't put up with the noise from the street any longer.”
- ✔ `come-up-with` (novo+anterior) “She came up with a clever idea to save time.”
- ✔ `get-away-with` (revisão) “He tried to get away with it, but they caught him.”
- ✔ `run-out-of` (revisão) “We have run out of milk, so I will go to the shop.”
- ✔ `separable-object` (revisão) “Could you sort the problem out before the meeting starts?”
- ✔ `make-a-decision` (novo+anterior) “We need to make a decision about the new project by Friday.”
- ✔ `take-advantage` (novo+anterior) “You should take advantage of the free classes at the library.”
- ✔ `reach-a-conclusion` (novo+anterior) “After a long discussion, they reached a conclusion about the budget.”
- ✔ `draw-attention` (novo+anterior) “The new advert drew attention to the importance of recycling.”
- ✔ `run-a-risk` (novo+anterior) “If you drive without a licence, you run a serious risk.”
- ✔ `meet-a-deadline` (novo+anterior) “We worked all weekend to meet the deadline for the report.”
- ✔ `pay-attention` (novo+anterior) “Please pay attention to the instructions before you start the exam.”
- ✔ `break-a-promise` (novo+anterior) “He broke his promise, and nobody trusted him after that.”

## B2 · 13. Formal vs. informal register (`formal-vs-informal-register`)

- ✔ `formal-request` (novo+anterior) “I would be grateful if you could send me the documents.”
- ✔ `shall` (novo+anterior) “Shall we begin the meeting now, ladies and gentlemen?”
- ✔ `formal-regret` (novo+anterior) “I regret to inform you that your application was unsuccessful.”
- ✔ `polite-would-you-mind` (revisão) “Would you mind closing the window? It is rather cold.”
- ✔ `informal-hey` (novo+anterior) “Hey, are you coming to the party tonight? It will be awesome.”
- ✔ `informal-i-mean` (novo+anterior) “Well, I mean, it is kind of hard to explain.”
- ✔ `informal-gonna` (novo+anterior) “We are gonna meet at the cafe around seven tonight.”
- ✔ `formal-impersonal` (novo+anterior) “It is requested that all visitors register at the front desk.”
- ✔ `formal-verbs` (novo+anterior) “We will commence the course on Monday and purchase the books.”
- ✔ `formal-kindly` (novo+anterior) “Kindly confirm your attendance by replying to this email as soon as possible.”
- ✔ `full-forms` (revisão) “I cannot attend because I do not have enough time.”
