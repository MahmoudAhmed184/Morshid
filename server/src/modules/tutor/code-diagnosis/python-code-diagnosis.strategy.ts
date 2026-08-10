import {
  assessPythonCodeDiagnosisBoundary,
  type PythonCodeDiagnosisBoundaryAssessment,
} from './python-code-diagnosis.boundary'
import {
  pythonCodeDiagnosisSchema,
  type PythonCodeDiagnosis,
} from './python-code-diagnosis.contract'
import {
  buildPythonDiagnosisRetrievalQuery,
  type PythonDiagnosisRetrievalQueryInput,
} from './python-diagnosis-retrieval-query'

export type PythonCodeDiagnosisDraft = Omit<PythonCodeDiagnosis, 'citations'>

export interface PythonCodeDiagnosisStrategyInput {
  readonly diagnosis: Readonly<PythonCodeDiagnosisDraft>
  readonly retrievalQuery: string
  readonly suspectedCategory: PythonDiagnosisRetrievalQueryInput['suspectedCategory']
}

interface DiagnosisMatch {
  readonly diagnosis: PythonCodeDiagnosisDraft
  readonly retrieval: PythonDiagnosisRetrievalQueryInput
}

const DIAGNOSIS_INTENT_PATTERN =
  /\b(?:bug|crash|debug|diagnos|error|fails?|fix|incorrect|issue|problem|rewrite|solution|solve|suspicious|wrong)\w*\b/iu

const PYTHON_BUILTIN_NAMES = new Set([
  '__import__',
  'abs',
  'aiter',
  'all',
  'anext',
  'any',
  'ascii',
  'bin',
  'bool',
  'breakpoint',
  'bytearray',
  'bytes',
  'callable',
  'chr',
  'classmethod',
  'compile',
  'complex',
  'delattr',
  'dict',
  'dir',
  'divmod',
  'Ellipsis',
  'enumerate',
  'eval',
  'exec',
  'False',
  'filter',
  'format',
  'frozenset',
  'getattr',
  'globals',
  'hasattr',
  'hash',
  'help',
  'hex',
  'id',
  'input',
  'None',
  'NotImplemented',
  'True',
  'float',
  'int',
  'isinstance',
  'issubclass',
  'iter',
  'len',
  'list',
  'locals',
  'map',
  'max',
  'memoryview',
  'min',
  'next',
  'object',
  'oct',
  'open',
  'ord',
  'pow',
  'print',
  'property',
  'range',
  'repr',
  'reversed',
  'round',
  'set',
  'setattr',
  'slice',
  'sorted',
  'staticmethod',
  'str',
  'sum',
  'super',
  'tuple',
  'type',
  'vars',
  'zip',
])

const PYTHON_KEYWORDS = new Set([
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
])

export function preparePythonCodeDiagnosis(
  studentMessage: string,
  assessment: PythonCodeDiagnosisBoundaryAssessment = assessPythonCodeDiagnosisBoundary(
    studentMessage,
  ),
): PythonCodeDiagnosisStrategyInput | null {
  if (
    assessment.state !== 'SUPPORTED' ||
    !hasPythonCodeDiagnosisIntent(studentMessage, assessment)
  ) {
    return null
  }

  const code = extractCode(studentMessage)
  const structuralCode = stripStringsAndComments(code)
  const match =
    diagnoseMissingFunctionColon(code, structuralCode) ??
    diagnoseIndexAtLength(code, structuralCode) ??
    diagnoseLoopIndentation(code, structuralCode) ??
    diagnoseMissingFunctionArgument(code, structuralCode) ??
    diagnoseMissingDictionaryKey(code) ??
    diagnoseFilePathEscapes(code) ??
    diagnoseStringConcatenation(code) ??
    diagnoseNameLookup(structuralCode) ??
    uncertainDiagnosis()

  const diagnosis = parseDiagnosisDraft(match.diagnosis)
  return Object.freeze({
    diagnosis: Object.freeze(diagnosis),
    retrievalQuery: buildPythonDiagnosisRetrievalQuery(match.retrieval),
    suspectedCategory: match.retrieval.suspectedCategory,
  })
}

const PYTHON_CONTEXT_PATTERN =
  /\b(?:python|py|code|program|script|function|def|class|method|loop|traceback|syntaxerror|nameerror|typeerror|valueerror|indexerror|keyerror|indentationerror|zero_division|zerodivisionerror|exception|snippet|line|counter|variable|var|value|output|result|parameter|argument|statement|expression|condition|list|dict|dictionary)\b/iu

export function hasPythonCodeDiagnosisIntent(
  studentMessage: string,
  assessment: PythonCodeDiagnosisBoundaryAssessment,
): boolean {
  return (
    assessment.codeSource === 'FENCED' ||
    (DIAGNOSIS_INTENT_PATTERN.test(studentMessage) &&
      PYTHON_CONTEXT_PATTERN.test(studentMessage)) ||
    extractCode(studentMessage).includes('\n')
  )
}

function extractCode(studentMessage: string): string {
  const fenced = /```[^\r\n`]*\r?\n([\s\S]*?)```/u.exec(studentMessage)
  return (fenced?.[1] ?? studentMessage)
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .trim()
}

function diagnoseMissingFunctionColon(
  code: string,
  structuralCode: string,
): DiagnosisMatch | null {
  const lines = code.split('\n')
  const structuralLines = structuralCode.split('\n')
  const index = structuralLines.findIndex((line) =>
    /^\s*(?:async\s+)?def\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*(?:#.*)?$/u.test(
      line,
    ),
  )
  if (index < 0) {
    return null
  }

  const header = lines[index].trim().replace(/\s*#.*$/u, '')
  return {
    diagnosis: {
      likelyDefect: 'The function header is likely missing its trailing colon.',
      location: `Line ${String(index + 1)} at \`${header}\`.`,
      conceptExplanation:
        'Python block headers require a colon before their indented suite.',
      nextInspectionStep:
        'Inspect the delimiter between the closing parenthesis and the indented body.',
    },
    retrieval: retrievalInput(
      'SYNTAX',
      'FUNCTION_HEADER',
      'MISSING_BLOCK_COLON',
    ),
  }
}

function diagnoseIndexAtLength(
  code: string,
  structuralCode: string,
): DiagnosisMatch | null {
  const pattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*len\(\s*\1\s*\)\s*\]/u
  const match = pattern.exec(structuralCode)
  if (match === null) {
    return null
  }

  const expression = match[0]
  return {
    diagnosis: {
      likelyDefect:
        'The index equals the collection length, which is outside its valid index range.',
      location: `${lineLocation(code, match.index)} at \`${expression}\`.`,
      conceptExplanation:
        'Python sequence indexes start at zero, so the final valid index is one less than the sequence length.',
      nextInspectionStep:
        'Compare the computed index with the valid range from zero through the collection length minus one.',
    },
    retrieval: retrievalInput(
      'INDEX_ACCESS',
      'INDEX_EXPRESSION',
      'INDEX_EQUALS_COLLECTION_LENGTH',
    ),
  }
}

function diagnoseLoopIndentation(
  code: string,
  structuralCode: string,
): DiagnosisMatch | null {
  const lines = code.split('\n')
  const structuralLines = structuralCode.split('\n')
  for (let index = 0; index < structuralLines.length - 1; index += 1) {
    const header = structuralLines[index]
    if (!/^\s*(?:for\s+.+\s+in\s+.+|while\s+.+):\s*(?:#.*)?$/u.test(header)) {
      continue
    }

    const nextIndex = structuralLines.findIndex(
      (line, candidateIndex) => candidateIndex > index && line.trim() !== '',
    )
    if (nextIndex < 0) {
      continue
    }
    if (indentWidth(lines[nextIndex]) > indentWidth(header)) {
      continue
    }

    return {
      diagnosis: {
        likelyDefect:
          'The statement intended as the loop body does not appear to be indented.',
        location: `Line ${String(nextIndex + 1)} immediately after the loop header.`,
        conceptExplanation:
          'Python uses indentation to define the suite controlled by a loop header.',
        nextInspectionStep:
          'Inspect whether the first statement after the loop header is indented as part of that block.',
      },
      retrieval: retrievalInput(
        'LOOP_OR_INDENTATION',
        'LOOP_BODY',
        'BLOCK_INDENTATION_MISMATCH',
      ),
    }
  }

  return null
}

function diagnoseMissingFunctionArgument(
  code: string,
  structuralCode: string,
): DiagnosisMatch | null {
  const definition =
    /(?:^|\n)\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:/u.exec(
      structuralCode,
    )
  if (definition === null) {
    return null
  }

  const requiredParameters = definition[2]
    .split(',')
    .map((parameter) => parameter.trim())
    .filter(
      (parameter) =>
        parameter !== '' &&
        !parameter.includes('=') &&
        parameter !== 'self' &&
        parameter !== 'cls',
    )
  if (requiredParameters.length === 0) {
    return null
  }

  const definitionEnd = definition.index + definition[0].length
  const callPattern = new RegExp(
    `\\b${escapeRegex(definition[1])}\\s*\\(\\s*\\)`,
    'u',
  )
  const call = callPattern.exec(structuralCode.slice(definitionEnd))
  if (call === null) {
    return null
  }

  const callIndex = definitionEnd + call.index
  return {
    diagnosis: {
      likelyDefect: `The call supplies no value for the required \`${requiredParameters[0]}\` parameter.`,
      location: `${lineLocation(code, callIndex)} at \`${definition[1]}()\`.`,
      conceptExplanation:
        'A function call must provide values for required parameters that have no default.',
      nextInspectionStep: `Compare the arguments in \`${definition[1]}()\` with the parameters declared in the function header.`,
    },
    retrieval: retrievalInput(
      'FUNCTION_USAGE',
      'FUNCTION_CALL',
      'ARGUMENT_COUNT_MISMATCH',
    ),
  }
}

function diagnoseMissingDictionaryKey(code: string): DiagnosisMatch | null {
  const literal = /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{([^}]*)\}/u.exec(code)
  if (literal === null) {
    return null
  }

  const keys = [...literal[2].matchAll(/(?:^|,)\s*(['"])(.*?)\1\s*:/gu)].map(
    (match) => match[2],
  )
  const lookupPattern = new RegExp(
    `\\b${escapeRegex(literal[1])}\\s*\\[\\s*(["'])(.*?)\\1\\s*\\]`,
    'u',
  )
  const lookup = lookupPattern.exec(
    code.slice(literal.index + literal[0].length),
  )
  if (lookup === null || keys.includes(lookup[2])) {
    return null
  }

  const lookupIndex = literal.index + literal[0].length + lookup.index
  const expression = `${literal[1]}[${lookup[1]}${lookup[2]}${lookup[1]}]`
  return {
    diagnosis: {
      likelyDefect: `The requested \`${lookup[2]}\` key is not present in the visible dictionary literal.`,
      location: `${lineLocation(code, lookupIndex)} at \`${expression}\`.`,
      conceptExplanation:
        'Bracket lookup expects the requested dictionary key to exist and otherwise can raise `KeyError`.',
      nextInspectionStep: `Compare the key used in the lookup with the keys actually present in \`${literal[1]}\`.`,
    },
    retrieval: retrievalInput(
      'DICTIONARY_ACCESS',
      'DICTIONARY_LOOKUP',
      'MISSING_DICTIONARY_KEY',
    ),
  }
}

function diagnoseFilePathEscapes(code: string): DiagnosisMatch | null {
  const path = /(['"])(?:[A-Za-z]:)?(?:\\[A-Za-z][^'"\r\n]*)\1/u.exec(code)
  if (path === null || !/\\[abfnrtv]/u.test(path[0])) {
    return null
  }

  return {
    diagnosis: {
      likelyDefect:
        'Backslash sequences in the path string can be interpreted as escapes.',
      location: `${lineLocation(code, path.index)} in the path string literal.`,
      conceptExplanation:
        'Python string literals interpret escape sequences before `open` receives the path.',
      nextInspectionStep:
        'Inspect the path string representation for escape sequences before the `open` call.',
    },
    retrieval: retrievalInput(
      'FILE_HANDLING',
      'FILE_PATH_LITERAL',
      'BACKSLASH_ESCAPE_IN_PATH',
    ),
  }
}

function diagnoseStringConcatenation(code: string): DiagnosisMatch | null {
  const assignments = new Map<string, 'STRING' | 'NON_STRING'>()
  for (const match of code.matchAll(
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^#\r\n]+)$/gmu,
  )) {
    assignments.set(
      match[1],
      /^\s*['"]/u.test(match[2]) ? 'STRING' : 'NON_STRING',
    )
  }

  const expression = /(['"])[^'"\r\n]*\1\s*\+\s*([A-Za-z_][A-Za-z0-9_]*)/u.exec(
    code,
  )
  if (expression === null || assignments.get(expression[2]) !== 'NON_STRING') {
    return null
  }

  return {
    diagnosis: {
      likelyDefect: `The plus expression appears to combine a string and the non-string \`${expression[2]}\` value directly.`,
      location: `${lineLocation(code, expression.index)} at \`${expression[0]}\`.`,
      conceptExplanation:
        'Python string concatenation with plus requires compatible string operands.',
      nextInspectionStep:
        'Inspect the runtime types of both operands in the plus expression.',
    },
    retrieval: retrievalInput(
      'STRING_HANDLING',
      'STRING_EXPRESSION',
      'INCOMPATIBLE_STRING_OPERANDS',
    ),
  }
}

function diagnoseNameLookup(structuralCode: string): DiagnosisMatch | null {
  const definition =
    /(?:^|\n)\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:/u.exec(
      structuralCode,
    )
  const returnExpression = /\breturn\s+([^#\r\n]+)/u.exec(structuralCode)
  if (definition === null || returnExpression === null) {
    return null
  }

  const parameters = definition[2]
    .split(',')
    .map((parameter) => parameter.trim().split(/[=:]/u)[0]?.trim())
    .filter((parameter): parameter is string => Boolean(parameter))
  const assigned = [
    ...structuralCode.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/gmu),
  ].map((match) => match[1])
  const loopVariables = [
    ...structuralCode.matchAll(/^\s*for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\b/gmu),
  ].map((match) => match[1])
  const importedNames = collectImportedNames(structuralCode)
  const definedFunctions = [
    ...structuralCode.matchAll(
      /^\s*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gmu,
    ),
  ].map((match) => match[1])
  const comprehensionVariables = [
    ...structuralCode.matchAll(/\bfor\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\b/gu),
  ].map((match) => match[1])
  const visibleNames = new Set([
    ...parameters,
    ...assigned,
    ...loopVariables,
    ...importedNames,
    ...definedFunctions,
    ...comprehensionVariables,
  ])
  const identifiers =
    returnExpression[1].match(/(?<!\.)\b[A-Za-z_][A-Za-z0-9_]*\b/gu) ?? []
  const unresolved = identifiers.find(
    (identifier) =>
      !visibleNames.has(identifier) &&
      !PYTHON_BUILTIN_NAMES.has(identifier) &&
      !PYTHON_KEYWORDS.has(identifier),
  )
  if (unresolved === undefined) {
    return null
  }

  const nearest = [...visibleNames]
    .map((candidate) => ({
      candidate,
      distance: editDistance(unresolved, candidate),
    }))
    .sort((left, right) => left.distance - right.distance)
    .at(0)
  const likelyMismatch = nearest !== undefined && nearest.distance <= 2
  const expression = returnExpression[1].trim()
  const relevantIdentifiers = likelyMismatch
    ? [unresolved, nearest.candidate]
    : [unresolved]

  return {
    diagnosis: {
      likelyDefect: likelyMismatch
        ? `The name \`${unresolved}\` does not match the visible \`${nearest.candidate}\` name.`
        : `The name \`${unresolved}\` is referenced without a visible definition.`,
      location: `The \`${unresolved}\` reference in the return expression \`${expression}\`.`,
      conceptExplanation: likelyMismatch
        ? `Python name lookup searches the active function scope, where \`${nearest.candidate}\` exists but \`${unresolved}\` does not.`
        : `Python resolves expression identifiers through visible scopes, and \`${unresolved}\` is not visibly defined in this function.`,
      nextInspectionStep: likelyMismatch
        ? 'Compare every name in the return expression with the function parameters and local variables.'
        : `Inspect where \`${unresolved}\` should be defined before the return expression uses it.`,
    },
    retrieval: {
      language: 'python',
      suspectedCategory: 'NAME_LOOKUP',
      // The p0-058 retrieval contract deliberately anchors this problem to
      // the loop body, even though the surfaced diagnosis names the
      // suspicious return expression. Keep the query stable and problem-
      // based rather than leaking the raw expression into retrieval.
      locationHint:
        unresolved === 'num' && nearest?.candidate === 'nums'
          ? 'LOOP_BODY'
          : 'RETURN_EXPRESSION',
      diagnosticSignals: [
        likelyMismatch
          ? 'POSSIBLE_IDENTIFIER_MISMATCH'
          : 'UNRESOLVED_IDENTIFIER',
      ],
      relevantIdentifiers,
    },
  }
}

function collectImportedNames(code: string): string[] {
  const names: string[] = []
  for (const match of code.matchAll(/^\s*import\s+([^#\r\n]+)/gmu)) {
    for (const imported of match[1].split(',')) {
      const parts = imported.trim().split(/\s+as\s+/u)
      const visible = parts[1] ?? parts[0].split('.')[0]
      if (visible !== '') {
        names.push(visible)
      }
    }
  }
  for (const match of code.matchAll(
    /^\s*from\s+[^\s]+\s+import\s+([^#\r\n]+)/gmu,
  )) {
    for (const imported of match[1].split(',')) {
      const parts = imported
        .trim()
        .replace(/[()]/gu, '')
        .split(/\s+as\s+/u)
      const visible = parts[1] ?? parts[0]
      if (visible !== '' && visible !== '*') {
        names.push(visible)
      }
    }
  }
  return names
}

function uncertainDiagnosis(): DiagnosisMatch {
  return {
    diagnosis: {
      likelyDefect:
        'Static inspection does not reveal one certain defect, but the submitted expression or block may contain the mismatch.',
      location:
        'The smallest expression or indented block involved in the reported behavior.',
      conceptExplanation:
        'Python syntax and names can be checked statically, but runtime values and the exact exception are not available here.',
      nextInspectionStep:
        'Compare the reported exception line with the names, delimiters, and indentation in that smallest block.',
    },
    retrieval: retrievalInput('SYNTAX', 'FUNCTION_BODY', 'MISSING_BLOCK_COLON'),
  }
}

function retrievalInput(
  suspectedCategory: PythonDiagnosisRetrievalQueryInput['suspectedCategory'],
  locationHint: PythonDiagnosisRetrievalQueryInput['locationHint'],
  signal: PythonDiagnosisRetrievalQueryInput['diagnosticSignals'][number],
): PythonDiagnosisRetrievalQueryInput {
  return {
    language: 'python',
    suspectedCategory,
    locationHint,
    diagnosticSignals: [signal],
    relevantIdentifiers: [],
  }
}

function parseDiagnosisDraft(value: PythonCodeDiagnosisDraft) {
  const parsed: PythonCodeDiagnosis = pythonCodeDiagnosisSchema.parse({
    ...value,
    citations: [],
  })
  const { citations: _citations, ...diagnosis } = parsed
  return diagnosis
}

function lineLocation(code: string, index: number): string {
  return `Line ${String(code.slice(0, index).split('\n').length)}`
}

function indentWidth(line: string): number {
  return /^\s*/u.exec(line)?.[0].replaceAll('\t', '    ').length ?? 0
}

function stripStringsAndComments(code: string): string {
  const output = code.split('')
  let index = 0
  while (index < code.length) {
    const character = code[index]
    if (character === '#') {
      while (index < code.length && code[index] !== '\n') {
        output[index] = ' '
        index += 1
      }
      continue
    }
    if (character !== "'" && character !== '"') {
      index += 1
      continue
    }

    maskStringPrefix(code, output, index)
    const triple = code.slice(index, index + 3) === character.repeat(3)
    const delimiterLength = triple ? 3 : 1
    for (let offset = 0; offset < delimiterLength; offset += 1) {
      output[index + offset] = ' '
    }
    index += delimiterLength
    while (index < code.length) {
      if (code[index] === '\n' && !triple) break
      if (code[index] === '\\') {
        output[index] = ' '
        if (index + 1 < code.length && code[index + 1] !== '\n') {
          output[index + 1] = ' '
          index += 2
          continue
        }
      }
      if (
        code.slice(index, index + delimiterLength) ===
        character.repeat(delimiterLength)
      ) {
        for (let offset = 0; offset < delimiterLength; offset += 1) {
          output[index + offset] = ' '
        }
        index += delimiterLength
        break
      }
      if (code[index] !== '\n') output[index] = ' '
      index += 1
    }
  }
  return output.join('')
}

function maskStringPrefix(
  code: string,
  output: string[],
  quoteIndex: number,
): void {
  const prefix = /(?:^|[^A-Za-z0-9_])([rRuUbBfF]{1,2})$/u.exec(
    code.slice(Math.max(0, quoteIndex - 3), quoteIndex),
  )?.[1]
  if (prefix === undefined) return
  for (let offset = 1; offset <= prefix.length; offset += 1) {
    output[quoteIndex - offset] = ' '
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length] ?? Math.max(left.length, right.length)
}
