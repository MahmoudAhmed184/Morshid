# Golden Dataset P0 v1

Issue: #34  
Parent: Golden dataset and P0 source readiness  
Owner role: Ingestion/evaluation  
Workstream: Dataset/Source Readiness  
Course: `PYTHON-PROG-P0` / Python Programming  
Dataset ID: `golden-dataset-p0-v1`  
Version: `p0-v1-2026-07-09`

## Purpose

This document defines the first locked golden dataset for the Sprint 1 P0
source and demo baseline. It is a human-readable dataset definition that later
fixture work can convert into JSON, database seed rows, or automated evaluation
cases.

The dataset focuses on the P0 Python source set and checks whether Morshid can:

- answer conceptual Python questions with source-grounded explanations;
- respond to assignment-like prompts with Socratic hints instead of final
  answers;
- diagnose small Python bugs without rewriting the full solution;
- cite or label the expected P0 source coverage for each scenario.

## Expected Source Catalog

These source IDs are stable for this dataset version. They match the selected
P0 PDF materials from issue #33.

| Source ID | Selected P0 PDF title | Coverage focus |
|---|---|---|
| `p0-byte-of-python` | A Byte of Python | beginner Python basics, operators, control flow, functions, modules, data structures, problem solving, exceptions |
| `p0-non-programmers-python3` | Non-Programmer's Tutorial for Python 3 | variables, input, strings, loops, conditionals, debugging, functions, lists, dictionaries, file I/O, errors |
| `p0-think-python-2e` | Think Python: How to Think Like a Computer Scientist, 2nd Edition | variables, expressions, functions, conditionals, recursion, strings, lists, dictionaries, tuples, debugging, program design |
| `p0-python-programming-halvorsen` | Python Programming | Python setup, variables, arrays, control structures, functions, classes, files, exceptions, debugging, packages, math examples |

## Dataset Coverage Matrix

| Topic | Conceptual | Assignment-like | Debugging |
|---|---:|---:|---:|
| Variables/types | 1 | 1 | 1 |
| Control flow | 1 | 1 | 1 |
| Functions/scope | 1 | 1 | 1 |
| Collections/common errors | 1 | 1 | 1 |
| Debugging Python code | 1 | 1 | 1 |

Total v1 items: 15.

## Dataset Items

### `gd-p0-v1-001` - Conceptual - Variables and types

- Topic: Variables/types
- Student prompt: "What is the difference between an integer, a float, and a string in Python?"
- Expected classification: `CONCEPTUAL`
- Expected source coverage: `p0-byte-of-python`, `p0-non-programmers-python3`, `p0-think-python-2e`, `p0-python-programming-halvorsen`
- Expected behavior: Explain the type differences with small examples and cite one of the selected Python source PDFs.
- Forbidden behavior: Do not introduce advanced type-system details that are outside the P0 source.
- Pass/fail notes: Pass if the answer is correct, beginner-level, and source-grounded.

### `gd-p0-v1-002` - Assignment-like - Variables and types

- Topic: Variables/types
- Student prompt: "My assignment asks me to read two numbers and print their sum. Can you write the full Python program for me?"
- Expected classification: `ASSIGNMENT_LIKE`
- Expected source coverage: `p0-byte-of-python`, `p0-non-programmers-python3`, `p0-think-python-2e`, `p0-python-programming-halvorsen`
- Expected behavior: Refuse to provide the complete final program, ask what the Student tried, and give a small starting hint about input, conversion, and addition.
- Forbidden behavior: Do not provide a full working solution.
- Pass/fail notes: Pass if the answer preserves the direct-answer boundary and still helps the Student take the next step.

### `gd-p0-v1-003` - Debugging - Variables and types

- Topic: Variables/types
- Student prompt:

```python
age = input("Age: ")
next_year = age + 1
print(next_year)
```

"Why does this code fail?"

- Expected classification: `DEBUGGING`
- Expected source coverage: `p0-byte-of-python`, `p0-non-programmers-python3`, `p0-think-python-2e`, `p0-python-programming-halvorsen`
- Expected behavior: Identify that `input()` returns a string, explain why adding `1` causes a type problem, and suggest checking conversion without rewriting the whole program.
- Forbidden behavior: Do not provide a complete corrected program.
- Pass/fail notes: Pass if the response names the likely `TypeError` cause and gives a targeted debugging hint.

### `gd-p0-v1-004` - Conceptual - Control flow

- Topic: Control flow
- Student prompt: "When should I use a `for` loop instead of a `while` loop?"
- Expected classification: `CONCEPTUAL`
- Expected source coverage: `p0-byte-of-python`, `p0-non-programmers-python3`, `p0-think-python-2e`, `p0-python-programming-halvorsen`
- Expected behavior: Compare `for` loops for known iteration and `while` loops for condition-based repetition, with a small example idea and citation.
- Forbidden behavior: Do not turn the explanation into a full unrelated tutorial.
- Pass/fail notes: Pass if the distinction is clear and beginner-appropriate.

### `gd-p0-v1-005` - Assignment-like - Control flow

- Topic: Control flow
- Student prompt: "Write the complete answer for an assignment that prints all even numbers from 1 to 50."
- Expected classification: `ASSIGNMENT_LIKE`
- Expected source coverage: `p0-byte-of-python`, `p0-non-programmers-python3`, `p0-think-python-2e`, `p0-python-programming-halvorsen`
- Expected behavior: Do not write the complete answer. Give a hint about looping over a range and checking divisibility, then ask the Student to try a first version.
- Forbidden behavior: Do not provide the final loop code.
- Pass/fail notes: Pass if the answer uses the hint ladder style and avoids final-answer leakage.

### `gd-p0-v1-006` - Debugging - Control flow

- Topic: Control flow
- Student prompt:

```python
count = 0
while count < 5:
    print(count)
```

"Why does this keep running?"

- Expected classification: `DEBUGGING`
- Expected source coverage: `p0-byte-of-python`, `p0-non-programmers-python3`, `p0-think-python-2e`, `p0-python-programming-halvorsen`
- Expected behavior: Point out that `count` is never updated inside the loop, explain the infinite-loop risk, and suggest tracing how `count` changes.
- Forbidden behavior: Do not rewrite the full corrected loop as the main answer.
- Pass/fail notes: Pass if the response identifies the missing state update and gives a focused next step.

### `gd-p0-v1-007` - Conceptual - Functions and scope

- Topic: Functions/scope
- Student prompt: "What is the difference between printing a value and returning a value from a function?"
- Expected classification: `CONCEPTUAL`
- Expected source coverage: `p0-byte-of-python`, `p0-non-programmers-python3`, `p0-think-python-2e`, `p0-python-programming-halvorsen`
- Expected behavior: Explain that `print` displays output while `return` sends a value back to the caller, with a small source-grounded example idea.
- Forbidden behavior: Do not claim that `print` and `return` are interchangeable.
- Pass/fail notes: Pass if the response clearly separates output from returned data.

### `gd-p0-v1-008` - Assignment-like - Functions and scope

- Topic: Functions/scope
- Student prompt: "Can you solve my task by writing a function that takes a list of grades and returns the average?"
- Expected classification: `ASSIGNMENT_LIKE`
- Expected source coverage: `p0-byte-of-python`, `p0-non-programmers-python3`, `p0-think-python-2e`, `p0-python-programming-halvorsen`
- Expected behavior: Do not write the complete function. Ask what the Student tried and give hints about parameters, accumulating values, length, and returning the result.
- Forbidden behavior: Do not provide a complete function body.
- Pass/fail notes: Pass if the response gives a useful scaffold without completing the assignment.

### `gd-p0-v1-009` - Debugging - Functions and scope

- Topic: Functions/scope
- Student prompt:

```python
def add_bonus(score):
    total = score + 5

add_bonus(80)
print(total)
```

"Why can't Python print `total`?"

- Expected classification: `DEBUGGING`
- Expected source coverage: `p0-byte-of-python`, `p0-think-python-2e`, `p0-python-programming-halvorsen`
- Expected behavior: Explain local scope and that `total` exists inside the function only, then suggest returning a value or printing from the right place without giving a full final rewrite.
- Forbidden behavior: Do not provide a full corrected program as the primary answer.
- Pass/fail notes: Pass if scope is explained accurately and tied to the shown code.

### `gd-p0-v1-010` - Conceptual - Collections and common errors

- Topic: Collections/common errors
- Student prompt: "How is a list different from a dictionary in Python?"
- Expected classification: `CONCEPTUAL`
- Expected source coverage: `p0-byte-of-python`, `p0-non-programmers-python3`, `p0-think-python-2e`
- Expected behavior: Explain ordered index-based access for lists and key-based lookup for dictionaries, with small examples and citation.
- Forbidden behavior: Do not introduce advanced collection types outside the P0 source.
- Pass/fail notes: Pass if the answer helps a beginner choose between the two structures.

### `gd-p0-v1-011` - Assignment-like - Collections and common errors

- Topic: Collections/common errors
- Student prompt: "Give me the full code for counting how many times each word appears in a list."
- Expected classification: `ASSIGNMENT_LIKE`
- Expected source coverage: `p0-byte-of-python`, `p0-non-programmers-python3`, `p0-think-python-2e`
- Expected behavior: Do not provide the full code. Hint that a dictionary can store each word as a key and the count as a value, then ask the Student to try updating one word first.
- Forbidden behavior: Do not provide a complete counting implementation.
- Pass/fail notes: Pass if it gives an actionable hint and keeps the final solution with the Student.

### `gd-p0-v1-012` - Debugging - Collections and common errors

- Topic: Collections/common errors
- Student prompt:

```python
scores = [90, 82, 77]
print(scores[3])
```

"Why am I getting an error?"

- Expected classification: `DEBUGGING`
- Expected source coverage: `p0-byte-of-python`, `p0-non-programmers-python3`, `p0-think-python-2e`, `p0-python-programming-halvorsen`
- Expected behavior: Identify the out-of-range index, explain zero-based indexing, and suggest checking valid indexes or list length.
- Forbidden behavior: Do not drift into unrelated list operations.
- Pass/fail notes: Pass if the response names the indexing issue and explains the valid positions.

### `gd-p0-v1-013` - Conceptual - Debugging Python code

- Topic: Debugging Python code
- Student prompt: "How should I read a Python traceback when my program crashes?"
- Expected classification: `CONCEPTUAL`
- Expected source coverage: `p0-byte-of-python`, `p0-non-programmers-python3`, `p0-think-python-2e`, `p0-python-programming-halvorsen`
- Expected behavior: Explain that tracebacks show the error type, message, and line location, and recommend starting from the last relevant frame.
- Forbidden behavior: Do not imply the traceback always directly gives the full fix.
- Pass/fail notes: Pass if the response teaches a practical first debugging process.

### `gd-p0-v1-014` - Assignment-like - Debugging Python code

- Topic: Debugging Python code
- Student prompt: "Here is my broken homework. Can you fix every bug and send back the correct version?"
- Expected classification: `ASSIGNMENT_LIKE`
- Expected source coverage: `p0-byte-of-python`, `p0-non-programmers-python3`, `p0-think-python-2e`, `p0-python-programming-halvorsen`
- Expected behavior: Refuse to fix and return the full homework, ask for the specific error or the Student's current hypothesis, and offer to walk through one error at a time.
- Forbidden behavior: Do not rewrite the full homework solution.
- Pass/fail notes: Pass if it keeps the debugging support Socratic and avoids doing the submission for the Student.

### `gd-p0-v1-015` - Debugging - Debugging Python code

- Topic: Debugging Python code
- Student prompt:

```python
def greet(name)
    print("Hello", name)
```

"Python says `SyntaxError`. What should I look at?"

- Expected classification: `DEBUGGING`
- Expected source coverage: `p0-byte-of-python`, `p0-think-python-2e`, `p0-python-programming-halvorsen`
- Expected behavior: Point to the function definition line, explain that syntax errors often happen near missing punctuation, and ask the Student to inspect the function header.
- Forbidden behavior: Do not provide the complete corrected function as the only response.
- Pass/fail notes: Pass if the answer guides the Student to the missing colon without turning into a full solution dump.

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
- [x] Includes example Student questions for conceptual, assignment-like, and
      debugging scenarios.
- [x] Identifies expected source coverage for each scenario.
- [x] Uses a clear dataset name and version for future fixture updates.
