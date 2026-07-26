import { GEMINI_EMBEDDING_LIVE_SMOKE_FIXTURE } from './gemini-embedding-live-smoke.fixture'

export type GeminiEmbeddingTaskFixtureCategory =
  | 'direct_factual'
  | 'paraphrased'
  | 'conceptual'
  | 'code'
  | 'low_lexical_overlap'

export interface GeminiEmbeddingTaskFixture {
  readonly id: string
  readonly category: GeminiEmbeddingTaskFixtureCategory
  readonly query: string
  readonly relevantDocument: string
}

/**
 * Synthetic, permission-safe calibration cases for choosing the Gemini query
 * prefix. These must stay disjoint from the held-out cases below.
 */
export const GEMINI_EMBEDDING_TASK_CALIBRATION_FIXTURES = [
  {
    id: 'calibration-direct-1',
    category: 'direct_factual',
    query: 'At what temperature does water freeze at standard pressure?',
    relevantDocument:
      'At standard atmospheric pressure, pure water freezes at zero degrees Celsius.',
  },
  {
    id: 'calibration-direct-2',
    category: 'direct_factual',
    query: 'Which port does HTTPS use by default?',
    relevantDocument:
      'The default network port assigned to HTTPS traffic is port 443.',
  },
  {
    id: 'calibration-paraphrase-1',
    category: 'paraphrased',
    query: 'What information does memoization keep for later calls?',
    relevantDocument:
      'A memoized function caches earlier outputs under the arguments that produced them.',
  },
  {
    id: 'calibration-paraphrase-2',
    category: 'paraphrased',
    query: 'How can a program continue while a file operation is pending?',
    relevantDocument:
      'Asynchronous input and output lets other work proceed instead of blocking on a slow device.',
  },
  {
    id: 'calibration-concept-1',
    category: 'conceptual',
    query: 'Why must binary search operate on ordered data?',
    relevantDocument:
      'Ordering lets each comparison eliminate one half of the remaining search interval.',
  },
  {
    id: 'calibration-concept-2',
    category: 'conceptual',
    query: 'Why normalize tables in a relational database?',
    relevantDocument:
      'Normalization separates repeated facts to reduce duplication and prevent update anomalies.',
  },
  {
    id: 'calibration-code-1',
    category: 'code',
    query: 'What value does JavaScript Array.map return?',
    relevantDocument:
      'Array.map creates a new array containing the callback result for every source element.',
  },
  {
    id: 'calibration-code-2',
    category: 'code',
    query: 'How can Python guarantee that an opened file is closed?',
    relevantDocument:
      'A Python with statement invokes the context manager cleanup even when the block raises.',
  },
  {
    id: 'calibration-low-overlap-1',
    category: 'low_lexical_overlap',
    query: 'How can I avoid repeating expensive work for the same arguments?',
    relevantDocument:
      'Memoization stores a function result in a cache keyed by its inputs.',
  },
  {
    id: 'calibration-low-overlap-2',
    category: 'low_lexical_overlap',
    query:
      'How can several readers safely share one value without coordinating?',
    relevantDocument:
      'Immutable data removes write races because no participant can change the shared object.',
  },
] as const satisfies readonly GeminiEmbeddingTaskFixture[]

/**
 * Held-out validation cases. Selection must use only the calibration set; these
 * cases confirm that the selected prefix generalizes.
 */
export const GEMINI_EMBEDDING_TASK_VALIDATION_FIXTURES = [
  {
    id: 'validation-direct-1',
    category: 'direct_factual',
    query: 'What does an HTTP 404 status mean?',
    relevantDocument:
      'An HTTP response with status 404 reports that the requested resource was not found.',
  },
  {
    id: 'validation-paraphrase-1',
    category: 'paraphrased',
    query: 'Which item leaves a stack first?',
    relevantDocument:
      'A stack follows last-in, first-out order, so the most recently pushed item is removed first.',
  },
  {
    id: 'validation-concept-1',
    category: 'conceptual',
    query: 'Why can adding a database index slow down writes?',
    relevantDocument:
      'Each insert or update must also maintain affected index structures, trading write cost for faster reads.',
  },
  {
    id: 'validation-code-1',
    category: 'code',
    query: 'How should SQL values be supplied without concatenating them?',
    relevantDocument:
      'A parameterized query sends SQL structure separately from bound values.',
  },
  {
    id: 'validation-low-overlap-1',
    category: 'low_lexical_overlap',
    query: 'How can related updates either all happen or none happen?',
    relevantDocument:
      'A database transaction commits the complete unit atomically and rolls it back after a failure.',
  },
  {
    id: 'validation-live-smoke',
    category: 'low_lexical_overlap',
    query: GEMINI_EMBEDDING_LIVE_SMOKE_FIXTURE.query,
    relevantDocument: GEMINI_EMBEDDING_LIVE_SMOKE_FIXTURE.relevant,
  },
] as const satisfies readonly GeminiEmbeddingTaskFixture[]

export const GEMINI_EMBEDDING_TASK_CALIBRATION_DISTRACTORS = [
  'A transfer orbit depends on the relative positions and velocities of two planets.',
  'Photosynthesis converts light energy into chemical energy inside plant cells.',
  'A major chord contains a root, a major third, and a perfect fifth.',
  'The area of a circle is pi multiplied by the square of its radius.',
  'Bread dough rises when fermentation produces gas inside its elastic structure.',
] as const

export const GEMINI_EMBEDDING_TASK_VALIDATION_DISTRACTORS = [
  'Migrating birds use seasonal signals while traveling between habitats.',
  'A prism separates visible light because wavelengths refract by different amounts.',
  'A metronome marks evenly spaced beats for musical practice.',
  'A triangle has three sides whose interior angles sum to 180 degrees in Euclidean geometry.',
  'Caramelization browns sugar as heat creates new aromatic compounds.',
] as const

export const GEMINI_EMBEDDING_TASK_FIXTURE_TITLE =
  'Synthetic embedding protocol evaluation'
