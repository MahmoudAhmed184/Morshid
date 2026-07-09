# Golden Dataset P0 v1

Issue: #34  
Parent: Golden dataset and P0 source readiness  
Owner role: Ingestion/evaluation  
Workstream: Dataset/Source Readiness  
Course: `PYTHON-PROG-P0` / Python Programming  
Dataset ID: `golden-dataset-p0-v1`  
Version: `p0-v1-2026-07-09-part-sources`

## Purpose

This document defines the first locked golden dataset for the Sprint 1 P0
source and demo baseline. It is a human-readable dataset definition that later
fixture work can convert into JSON, database seed rows, or automated evaluation
cases.

The dataset now aligns with the five grouped Python part PDFs from issue #33.
It checks whether Morshid can:

- answer conceptual Python questions with source-grounded explanations;
- respond to assignment-like prompts with Socratic hints instead of final
  answers;
- diagnose small Python bugs without rewriting the full solution;
- cite or label the expected part source coverage for each scenario.

## Expected Source Catalog

These source IDs are stable for this dataset version. They match the selected
Python part PDFs from issue #33.

| Source ID | Selected P0 PDF title | Local filename | Coverage focus |
|---|---|---|---|
| `p0-npt-part-01` | Python Part 1 | `storage/pdfs/Python_Part_1.pdf` | Hello World; Input and Variables; Count to 10 |
| `p0-npt-part-02` | Python Part 2 | `storage/pdfs/Python_Part_2.pdf` | Decisions; Debugging; Defining Functions |
| `p0-npt-part-03` | Python Part 3 | `storage/pdfs/Python_Part_3.pdf` | Lists; For Loops; Boolean Expressions |
| `p0-npt-part-04` | Python Part 4 | `storage/pdfs/Python_Part_4.pdf` | Dictionaries; Using Modules; More on Lists |
| `p0-npt-part-05` | Python Part 5 | `storage/pdfs/Python_Part_5.pdf` | Strings; File I/O |

## Scenario Types

| Scenario type | Expected behavior |
|---|---|
| `CONCEPTUAL` | Give a concise, source-grounded explanation with a citation to the expected part source. |
| `ASSIGNMENT_LIKE` | Do not provide a full final answer. Ask what the Student tried and give a small next-step hint. |
| `DEBUGGING` | Identify the likely issue and guide the Student to inspect or change the relevant line without rewriting the whole program. |
| `PRACTICE_ATTEMPT` | Respond to a Student's partial attempt with targeted feedback, one next step, and no completed solution. |

## Dataset Coverage Matrix

| Topic area | Source coverage | Conceptual | Assignment-like | Debugging | Practice attempt |
|---|---|---:|---:|---:|---:|
| Running Python and output | `p0-npt-part-01` | 1 | 1 | 1 | 1 |
| Input and variables | `p0-npt-part-01` | 1 | 1 | 1 | 1 |
| While loops | `p0-npt-part-01` | 1 | 1 | 1 | 1 |
| Decisions and conditionals | `p0-npt-part-02` | 1 | 1 | 1 | 1 |
| Debugging process | `p0-npt-part-02` | 1 | 1 | 1 | 1 |
| Functions | `p0-npt-part-02` | 1 | 1 | 1 | 1 |
| Lists | `p0-npt-part-03` | 1 | 1 | 1 | 1 |
| For loops | `p0-npt-part-03` | 1 | 1 | 1 | 1 |
| Boolean expressions | `p0-npt-part-03` | 1 | 1 | 1 | 1 |
| Dictionaries | `p0-npt-part-04` | 1 | 1 | 1 | 1 |
| Modules | `p0-npt-part-04` | 1 | 1 | 1 | 1 |
| More list patterns | `p0-npt-part-04` | 1 | 1 | 1 | 1 |
| Strings | `p0-npt-part-05` | 1 | 1 | 1 | 1 |
| File I/O | `p0-npt-part-05` | 1 | 1 | 1 | 1 |

Total v1 items: 56.

## Dataset Items

| ID | Scenario type | Topic | Student prompt | Expected source coverage | Expected behavior | Forbidden behavior |
|---|---|---|---|---|---|---|
| `gd-p0-v1-001` | `CONCEPTUAL` | Running Python and output | "What does `print(\"Hello, World!\")` do in Python?" | `p0-npt-part-01` | Explain that `print` sends text to the screen and cite the Hello, World source. | Do not introduce unrelated formatting or advanced I/O. |
| `gd-p0-v1-002` | `ASSIGNMENT_LIKE` | Running Python and output | "Write the full first program I should submit that prints my name and a greeting." | `p0-npt-part-01` | Refuse the full submission, ask what the Student tried, and hint toward using `print`. | Do not provide the final exact program. |
| `gd-p0-v1-003` | `DEBUGGING` | Running Python and output | "`print(Hello, World!)` gives an error. What is wrong?" | `p0-npt-part-01`, `p0-npt-part-02` | Point to missing quotation marks around text and explain why Python treats bare words differently. | Do not rewrite a complete final file. |
| `gd-p0-v1-004` | `PRACTICE_ATTEMPT` | Running Python and output | "I wrote `print(\"Hello\")`. How do I also show my course name?" | `p0-npt-part-01` | Confirm the attempt and suggest adding another `print` or adding text to the same call. | Do not turn it into a full assignment answer. |
| `gd-p0-v1-005` | `CONCEPTUAL` | Input and variables | "Why does `input()` need a variable?" | `p0-npt-part-01` | Explain that a variable stores the typed value so later lines can use it. | Do not imply `input()` always returns a number. |
| `gd-p0-v1-006` | `ASSIGNMENT_LIKE` | Input and variables | "Can you write the full program that asks for my name and prints a welcome message?" | `p0-npt-part-01` | Ask for the Student's attempt and hint at combining `input` with `print`. | Do not provide the finished program. |
| `gd-p0-v1-007` | `DEBUGGING` | Input and variables | "`name = input` then `print(name)` prints something weird. Why?" | `p0-npt-part-01`, `p0-npt-part-02` | Explain that `input` must be called with parentheses to run it. | Do not rewrite the whole script. |
| `gd-p0-v1-008` | `PRACTICE_ATTEMPT` | Input and variables | "I wrote `user_input = input(\"Who goes there? \")`. What should I check next?" | `p0-npt-part-01` | Suggest printing the variable and testing with a simple typed value. | Do not add extra features beyond the part scope. |
| `gd-p0-v1-009` | `CONCEPTUAL` | While loops | "How does a `while` loop know when to stop?" | `p0-npt-part-01` | Explain that the condition is checked before each loop iteration and stops when false. | Do not jump to `for` loops as the main answer. |
| `gd-p0-v1-010` | `ASSIGNMENT_LIKE` | While loops | "Write the complete answer for counting from 1 to 10 with a loop." | `p0-npt-part-01` | Refuse the full answer and hint about a counter, condition, print, and update. | Do not provide final loop code. |
| `gd-p0-v1-011` | `DEBUGGING` | While loops | "`a = 0; while a < 10: print(a)` never stops. Why?" | `p0-npt-part-01`, `p0-npt-part-02` | Identify that `a` is never changed inside the loop and suggest tracing the counter. | Do not paste a complete corrected loop. |
| `gd-p0-v1-012` | `PRACTICE_ATTEMPT` | While loops | "My loop prints 0 through 9. How do I reason about why it starts at 0?" | `p0-npt-part-01` | Explain the starting counter value and ask the Student to trace the first two iterations. | Do not replace the Student's code with a final version. |
| `gd-p0-v1-013` | `CONCEPTUAL` | Decisions and conditionals | "What is the purpose of an `if` statement?" | `p0-npt-part-02` | Explain that `if` runs code only when a condition is true. | Do not introduce complex boolean algebra before the basics. |
| `gd-p0-v1-014` | `ASSIGNMENT_LIKE` | Decisions and conditionals | "Give me the full password-checking program for my homework." | `p0-npt-part-02` | Refuse the complete solution and hint toward comparing input with the stored password. | Do not provide a complete login program. |
| `gd-p0-v1-015` | `DEBUGGING` | Decisions and conditionals | "`if password = input_password:` gives an error. What should I look at?" | `p0-npt-part-02` | Explain assignment versus comparison and point to the condition line. | Do not supply the full corrected program. |
| `gd-p0-v1-016` | `PRACTICE_ATTEMPT` | Decisions and conditionals | "I used `if guess == answer:` and it works. How can I handle the wrong answer?" | `p0-npt-part-02` | Suggest using an `else` branch and describe what it should represent. | Do not write the complete branch body for the assignment. |
| `gd-p0-v1-017` | `CONCEPTUAL` | Debugging process | "What does debugging mean?" | `p0-npt-part-02` | Explain debugging as finding and fixing defects by reading errors and tracing state. | Do not imply guessing randomly is enough. |
| `gd-p0-v1-018` | `ASSIGNMENT_LIKE` | Debugging process | "Fix all the bugs in my homework and send back the correct version." | `p0-npt-part-02` | Refuse to fix the full homework, ask for one error or hypothesis, and offer guided debugging. | Do not return a full corrected submission. |
| `gd-p0-v1-019` | `DEBUGGING` | Debugging process | "My average program gives the wrong result. How should I debug it?" | `p0-npt-part-02` | Suggest checking input count, running totals, and intermediate printed values. | Do not produce a full average program. |
| `gd-p0-v1-020` | `PRACTICE_ATTEMPT` | Debugging process | "I added print statements and saw my counter stays at 0. What does that tell me?" | `p0-npt-part-02`, `p0-npt-part-01` | Explain that the update step is missing or not reached and suggest inspecting control flow. | Do not rewrite the loop. |
| `gd-p0-v1-021` | `CONCEPTUAL` | Functions | "Why should I define a function instead of copying the same code again?" | `p0-npt-part-02` | Explain reuse, naming steps, and reducing repeated logic. | Do not jump into classes or decorators. |
| `gd-p0-v1-022` | `ASSIGNMENT_LIKE` | Functions | "Write a complete function that calculates an average for my assignment." | `p0-npt-part-02`, `p0-npt-part-03` | Refuse the complete function and hint at parameters, total, count, and return. | Do not provide a complete function body. |
| `gd-p0-v1-023` | `DEBUGGING` | Functions | "`def greet(name)` gives `SyntaxError`. What should I check?" | `p0-npt-part-02` | Point to the function header and guide the Student to inspect missing punctuation. | Do not provide only the corrected line without explanation. |
| `gd-p0-v1-024` | `PRACTICE_ATTEMPT` | Functions | "I made `def say_hi(): print(\"hi\")`. How do I call it?" | `p0-npt-part-02` | Explain that defining and calling are separate and suggest using the function name with parentheses. | Do not add extra parameters unless asked. |
| `gd-p0-v1-025` | `CONCEPTUAL` | Lists | "How is a list different from a normal variable?" | `p0-npt-part-03` | Explain that a list can store multiple values in order. | Do not introduce dictionaries as the main answer. |
| `gd-p0-v1-026` | `ASSIGNMENT_LIKE` | Lists | "Write the full code to store five scores in a list and print the highest." | `p0-npt-part-03`, `p0-npt-part-04` | Refuse the full code and hint about list values and checking items. | Do not provide a completed solution. |
| `gd-p0-v1-027` | `DEBUGGING` | Lists | "`scores = [90, 82, 77]; print(scores[3])` errors. Why?" | `p0-npt-part-03`, `p0-npt-part-02` | Explain zero-based indexing and that index 3 is outside a three-item list. | Do not drift into unrelated list methods. |
| `gd-p0-v1-028` | `PRACTICE_ATTEMPT` | Lists | "I can print the first item with `items[0]`. How do I think about the second item?" | `p0-npt-part-03` | Explain index positions and ask the Student to map positions to indexes. | Do not solve a larger list exercise. |
| `gd-p0-v1-029` | `CONCEPTUAL` | For loops | "When is a `for` loop useful?" | `p0-npt-part-03` | Explain iteration over a sequence or list of values. | Do not make `while` loops the main answer. |
| `gd-p0-v1-030` | `ASSIGNMENT_LIKE` | For loops | "Write the full solution that asks three quiz questions and grades them." | `p0-npt-part-03` | Refuse the full solution and hint at storing questions and looping over them. | Do not provide the complete quiz program. |
| `gd-p0-v1-031` | `DEBUGGING` | For loops | "My `for item in items` loop only prints one result. What should I inspect?" | `p0-npt-part-03`, `p0-npt-part-02` | Suggest checking indentation and whether the print is inside or outside the loop. | Do not rewrite the whole loop. |
| `gd-p0-v1-032` | `PRACTICE_ATTEMPT` | For loops | "I looped through questions but my score never changes. What is the next thing to check?" | `p0-npt-part-03`, `p0-npt-part-02` | Guide the Student to inspect the condition and score update inside the loop. | Do not complete the quiz logic. |
| `gd-p0-v1-033` | `CONCEPTUAL` | Boolean expressions | "What is a boolean expression?" | `p0-npt-part-03` | Explain that it is an expression that evaluates to true or false. | Do not overcomplicate with truth tables unless needed. |
| `gd-p0-v1-034` | `ASSIGNMENT_LIKE` | Boolean expressions | "Give me the full code to check whether a number is between 1 and 10." | `p0-npt-part-03`, `p0-npt-part-02` | Refuse the full code and hint at using two comparisons with `and`. | Do not provide a final condition plus full program. |
| `gd-p0-v1-035` | `DEBUGGING` | Boolean expressions | "`if age > 12 and < 18:` gives an error. Why?" | `p0-npt-part-03`, `p0-npt-part-02` | Explain that each side of `and` needs a complete comparison. | Do not paste the final full answer as the only response. |
| `gd-p0-v1-036` | `PRACTICE_ATTEMPT` | Boolean expressions | "I wrote `if guess == answer:`. How can I make it ignore uppercase?" | `p0-npt-part-03`, `p0-npt-part-04` | Suggest normalizing the compared text and cite the relevant source if available. | Do not build a whole guessing game. |
| `gd-p0-v1-037` | `CONCEPTUAL` | Dictionaries | "What is a dictionary used for?" | `p0-npt-part-04` | Explain key-value storage and lookup by key. | Do not center the answer on list indexing. |
| `gd-p0-v1-038` | `ASSIGNMENT_LIKE` | Dictionaries | "Write the full word-count program using a dictionary." | `p0-npt-part-04`, `p0-npt-part-05` | Refuse the complete solution and hint about using words as keys and counts as values. | Do not provide a complete counting implementation. |
| `gd-p0-v1-039` | `DEBUGGING` | Dictionaries | "`ages[\"Mona\"]` gives `KeyError`. What does that mean?" | `p0-npt-part-04`, `p0-npt-part-02` | Explain that the key is missing and suggest checking existing keys before lookup. | Do not rewrite the whole dictionary program. |
| `gd-p0-v1-040` | `PRACTICE_ATTEMPT` | Dictionaries | "I made `scores = {\"Ali\": 90}`. How do I add another student?" | `p0-npt-part-04` | Explain adding or updating a value by key and ask the Student to try one entry. | Do not build a full gradebook. |
| `gd-p0-v1-041` | `CONCEPTUAL` | Modules | "Why do Python programs use `import`?" | `p0-npt-part-04` | Explain that importing lets a program use code from a module. | Do not introduce packaging or environments as the main topic. |
| `gd-p0-v1-042` | `ASSIGNMENT_LIKE` | Modules | "Write the full program that imports my helper module and grades students." | `p0-npt-part-04` | Refuse the full program and hint at separating helper functions into a file and importing them. | Do not provide complete multi-file code. |
| `gd-p0-v1-043` | `DEBUGGING` | Modules | "`import helpers` fails. What should I check first?" | `p0-npt-part-04`, `p0-npt-part-02` | Suggest checking filename, current directory, spelling, and whether the module exists. | Do not assume the module is installed globally. |
| `gd-p0-v1-044` | `PRACTICE_ATTEMPT` | Modules | "I put a function in another file. How do I know the import worked?" | `p0-npt-part-04` | Suggest importing the module and calling one small known function. | Do not create a complete project structure. |
| `gd-p0-v1-045` | `CONCEPTUAL` | More list patterns | "What does it mean to mutate a list?" | `p0-npt-part-04` | Explain changing the existing list rather than creating a separate value. | Do not introduce advanced memory-model details. |
| `gd-p0-v1-046` | `ASSIGNMENT_LIKE` | More list patterns | "Write the complete solution that removes all duplicates from a list." | `p0-npt-part-04`, `p0-npt-part-03` | Refuse the full solution and hint at tracking seen values or checking before adding. | Do not provide the final algorithm. |
| `gd-p0-v1-047` | `DEBUGGING` | More list patterns | "I remove items from a list while looping and some values are skipped. Why?" | `p0-npt-part-04`, `p0-npt-part-02` | Explain that changing a list during iteration can shift positions and cause skipped items. | Do not provide a full fixed implementation. |
| `gd-p0-v1-048` | `PRACTICE_ATTEMPT` | More list patterns | "I sorted my list but expected the old order later. What should I think about?" | `p0-npt-part-04` | Ask whether the operation changed the original list and guide the Student to inspect before and after values. | Do not solve an unrelated sorting assignment. |
| `gd-p0-v1-049` | `CONCEPTUAL` | Strings | "How are strings similar to lists?" | `p0-npt-part-05`, `p0-npt-part-03` | Explain that strings can be indexed and sliced like sequences of characters. | Do not claim strings are mutable like lists. |
| `gd-p0-v1-050` | `ASSIGNMENT_LIKE` | Strings | "Write the full solution that checks if a word is a palindrome." | `p0-npt-part-05`, `p0-npt-part-03` | Refuse the complete solution and hint at comparing characters or slices. | Do not provide the final palindrome code. |
| `gd-p0-v1-051` | `DEBUGGING` | Strings | "`word[10]` crashes for `cat`. Why?" | `p0-npt-part-05`, `p0-npt-part-02` | Explain string indexing and out-of-range positions. | Do not turn it into a full string tutorial. |
| `gd-p0-v1-052` | `PRACTICE_ATTEMPT` | Strings | "I can get `word[0]`. How do I get the last character without hardcoding an index?" | `p0-npt-part-05` | Hint at using length or a negative index if supported by the source coverage. | Do not solve a larger text-processing problem. |
| `gd-p0-v1-053` | `CONCEPTUAL` | File I/O | "Why do programs open files before reading them?" | `p0-npt-part-05` | Explain opening a file as the step that lets Python access its contents. | Do not discuss databases or network storage. |
| `gd-p0-v1-054` | `ASSIGNMENT_LIKE` | File I/O | "Write the complete program that reads a file and prints every line with a number." | `p0-npt-part-05` | Refuse the full program and hint at opening the file, looping over lines, and tracking a counter. | Do not provide the completed file-processing script. |
| `gd-p0-v1-055` | `DEBUGGING` | File I/O | "`open(\"data.txt\")` says file not found. What should I check?" | `p0-npt-part-05`, `p0-npt-part-02` | Suggest checking filename spelling, working directory, and whether the file exists. | Do not assume the file contents are wrong. |
| `gd-p0-v1-056` | `PRACTICE_ATTEMPT` | File I/O | "I opened a file and printed one line. How do I process all lines?" | `p0-npt-part-05` | Suggest looping over the file object or repeated reads depending on source examples. | Do not write the full final program. |

## Versioning Notes

- Keep existing item IDs stable after this version is used in fixtures.
- Add new items with the next `gd-p0-v1-###` ID unless the dataset version is
  intentionally bumped.
- If a prompt, expected classification, or expected behavior changes after
  fixtures are created, record that as a dataset update in the future fixture
  conventions work.
- This v1 dataset intentionally focuses on Python learning scenarios. Broader
  authorization, course-isolation, prompt-injection, and conflicting-source
  cases can be added as separate security or policy fixtures when those tracks
  are ready.

## Acceptance Checklist

- [x] Covers variables/types, control flow, functions/scope,
      collections/common errors, and debugging Python code.
- [x] Adds broader part coverage for output, modules, strings, and file I/O.
- [x] Includes example Student questions for conceptual, assignment-like, and
      debugging scenarios.
- [x] Includes practice-attempt prompts for later fixture expansion.
- [x] Identifies expected source coverage for each scenario.
- [x] Uses a clear dataset name and version for future fixture updates.
