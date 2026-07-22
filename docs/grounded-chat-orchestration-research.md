# Grounded chat orchestration research

Reviewed 2026-07-21 for issue #88. This note records the primary-source basis
for the authorized grounded-chat transaction, relation, HTTP validation, and
object-authorization design. It is an implementation rationale, not an
expansion of the issue's product scope.

## Short transactions and bounded database retries

Prisma's interactive-transaction guidance says to keep transactions short
because long-running transactions hurt performance and can cause deadlocks. It
specifically recommends avoiding network requests and slow queries inside the
transaction callback
([Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions#interactive-transactions)).
For Morshid, the embedding, retrieval, backing-file checks, and completion call
therefore remain outside database transactions. The initial send or retry
transaction should perform only authorization, locking, state checks, sequence
allocation, and the required writes; a later short transaction should persist
the terminal assistant state and its evidence atomically.

Prisma documents `P2034` as the error returned when a transaction fails because
of a write conflict or deadlock and recommends retrying the transaction in
application code. Its example places the retry around the transaction itself
([Prisma transaction timing issues](https://www.prisma.io/docs/orm/prisma-client/queries/transactions#transaction-timing-issues)).
The issue #88 policy is correspondingly to retry only the short database
callback when the error is `P2034`, with at most three attempts. Three is a
Morshid bound, not a Prisma-prescribed count. Keeping provider work outside the
callback is important: a database retry must never repeat an already-issued
completion call.

An orchestration attempt is identified by a server-generated UUID and a
database-timestamped five-minute lease on its pending assistant row. Every
terminal transition compares that UUID. A retry may reclaim an expired lease
on the same Student/assistant pair, while a late worker from the prior attempt
can no longer overwrite the newer attempt. A new send first converts expired
pending work to the fixed safe failure state, so process death or a temporarily
unavailable terminal write cannot wedge the session indefinitely. The lease is
only a recovery boundary: retrieval and completion still run outside the
transaction and are never repeated by the database retry loop.

A connection failure after PostgreSQL commits but before Prisma receives the
acknowledgement is treated as ambiguous rather than as a proven rollback.
Begin, retry, and terminal writes use their preallocated attempt/message ids to
read back the exact state. A matching committed result is returned; an exact
pending result can be failed safely; and `503` is reserved for state that still
cannot be determined or terminalized.

The session lock needs raw SQL because it uses PostgreSQL's locking clause. A
Prisma `$queryRaw` tagged template turns interpolated data values into prepared
statement parameters; the documentation warns against constructing query text
from untrusted input
([Prisma raw queries](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries#queryraw)).
The session ID should therefore be a bound value in a fixed `SELECT ... FOR
UPDATE` statement, never concatenated into SQL.

## What the session row lock guarantees

PostgreSQL says `FOR UPDATE` locks the rows returned by the `SELECT` as though
they were being updated. Other transactions cannot lock, modify, or delete
those rows until the current transaction ends; a conflicting locker waits and
then receives the updated row, or no row if it was deleted
([PostgreSQL explicit row locking](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)).
Ordinary non-locking reads are not blocked by row-level locks, and the locks are
released at transaction end or on a rollback to the savepoint that acquired
them
([PostgreSQL explicit row locking](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS)).

Locking the owned, non-deleted `chat_sessions` row before reading and advancing
`last_sequence` gives competing sends and retries one serialization point for a
session. Within that protected section, Morshid can re-check membership and
ownership, reject an existing `PENDING` or `STREAMING` assistant, and allocate
two consecutive message sequences without leaving an orphan Student message.
This is the local use of PostgreSQL's guarantee; the database does not supply
Morshid's turn-state rules.

PostgreSQL also warns that row locks can participate in deadlocks and recommends
acquiring multiple objects in a consistent order; it automatically aborts one
transaction when a deadlock is detected
([PostgreSQL deadlocks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-DEADLOCKS)).
The repository should consequently lock the session first and keep a consistent
write order across send, retry, finalization, blocking, and failure paths. This
also reinforces the short-transaction boundary above.

For user-authorized begin, retry, completion, and blocked transitions, the
repository locks the trusted session row first and then locks the exact
course-membership row before validating that its role is Student and
`removed_at` is null. Failure cleanup is different: the persisted
session/Student/assistant/attempt relationship is an internal capability, so an
exact pending attempt can be changed to the fixed safe failed state even after
membership revocation or session soft deletion. This cannot create or expose a
turn; it only closes work already authorized and persisted. Grounded completion
still requires current authorization.

## One assistant response per Student message

Prisma defines a SQL one-to-one relation by placing a `UNIQUE` constraint on
the foreign-key scalar; without that constraint, the relation is one-to-many.
The scalar side may be optional, and the side without the relation scalar must
be optional
([Prisma one-to-one relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-one-relations)).
For a one-to-one self-relation, both relation fields use the same relation name,
one side supplies `fields` and `references`, and the foreign-key scalar is
`@unique`
([Prisma self-relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/self-relations#one-to-one-self-relations)).

Applied to `Message`, `responseToMessageId String? @unique` is the owning
relation scalar, `responseToMessage Message?` remains the annotated side, and
the inverse `responses Message[]` becomes a singular optional relation field.
That schema expresses the required invariant: a Student message has at most one
assistant response, while messages that do not answer another message can keep
a null response pointer.

Prisma's schema reference states that `@unique` can be placed on an optional
scalar, maps to a relational `UNIQUE` construct, automatically adds a unique
index, and treats null values as distinct so multiple null rows remain allowed
([Prisma `@unique`](https://www.prisma.io/docs/orm/reference/prisma-schema-reference#unique)).
PostgreSQL independently documents that a unique constraint rejects duplicate
equal non-null values, permits multiple nulls by default, and creates a unique
B-tree index
([PostgreSQL unique constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS)).
The migration must therefore establish that no duplicate non-null
`response_to_message_id` values already exist, replace the old non-unique
response index with the unique index, and preserve nullability. The duplicate
check and index replacement are migration-review obligations derived from the
new invariant, not automatic data repair by Prisma.

Morshid's explicit legacy-data policy is non-destructive: the migration checks
for duplicate non-null response pointers before dropping the old index. If it
finds any, it aborts the transaction with SQLSTATE `23505`, a targeted message,
the affected Student message ids, and a remediation hint. Operators must review
and reconcile those assistant histories before retrying the migration; the
migration never guesses which answer or evidence should survive. Upgrade tests
cover both this diagnostic/rollback and successful index creation after an
operator-simulated reconciliation.

Prisma's development CLI supports `migrate dev --name ... --create-only`, which
creates but does not apply the migration, allowing the SQL to be inspected
before a later `migrate dev` applies it
([Prisma `migrate dev`](https://docs.prisma.io/docs/cli/migrate/dev)).
That is the appropriate workflow for reviewing the index replacement and
constraint. Prisma v7 no longer has `migrate dev` run generators automatically,
and Prisma says schema changes require regenerating the client, so issue #88
must run `prisma generate` explicitly after the reviewed migration
([Prisma `migrate dev`](https://docs.prisma.io/docs/cli/migrate/dev),
[Prisma Client generation](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/introduction#evolving-your-application)).

## Strict NestJS request validation

Nest's `ValidationPipe` validates client payloads from decorators on concrete
DTO classes. Nest cautions that interfaces and type-only DTO imports are erased
at runtime and therefore might not be validated correctly
([NestJS validation](https://docs.nestjs.com/techniques/validation#auto-validation)).
The send body should consequently be a runtime class with validation decorators
for its sole `content` property, including the local trim, nonblank, and 4,000
Unicode-code-point rules.

With `whitelist: true`, `ValidationPipe` removes properties that have no
validation decorator; adding `forbidNonWhitelisted: true` makes those properties
an error instead. Validation failures use `BadRequestException` by default
([NestJS validation options](https://docs.nestjs.com/techniques/validation#using-the-built-in-validationpipe),
[NestJS property whitelisting](https://docs.nestjs.com/techniques/validation#stripping-properties)).
Issue #88 requires rejection, not silent stripping, so the endpoint must use
both settings. This is what prevents clients from supplying course, Student,
retrieval, citation, rank, score, provider, model, or other orchestration-owned
fields. The exact code-point counting and trimming behavior is a Morshid input
contract and needs focused tests; Nest's general guidance does not define that
product limit.

Nest's Swagger integration discovers `@Body()`, `@Query()`, and `@Param()` DTOs,
but DTO properties need `@ApiProperty()` metadata or the Swagger CLI plugin to
appear in the generated model. Arrays and otherwise ambiguous nested types can
be declared explicitly
([NestJS OpenAPI types and parameters](https://docs.nestjs.com/openapi/types-and-parameters)).
The citation and evidence DTO classes should therefore expose every nested
field, including the evidence array element type, rather than relying on
TypeScript-only shapes.

Nest documents response DTOs through `@ApiResponse()` or its status-specific
decorators, including created, success, bad-request, forbidden, not-found,
conflict, and service-unavailable responses; a response model is attached with
the decorator's `type` property
([NestJS OpenAPI operations](https://docs.nestjs.com/openapi/operations#responses)).
The send and retry operations should use those DTOs to document their distinct
`201` and `200` successes and every specified error. Nest also requires a bearer
security definition on the base document and `@ApiBearerAuth()` on the protected
operation or controller for bearer authentication to appear in OpenAPI
([NestJS OpenAPI bearer authentication](https://docs.nestjs.com/openapi/security#bearer-authentication)).

## Object-level authorization and concealed resource denial

OWASP API1:2023 identifies object IDs in paths, queries, headers, and bodies as
an attack surface. Every endpoint that receives an object ID and acts on that
object should verify that the logged-in user can perform the requested action
on that specific object; merely comparing one user identifier with a client
parameter addresses only a subset of broken object-level authorization cases
([OWASP API1:2023](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)).
OWASP's prevention guidance further says to apply the authorization mechanism
in every function that uses client input to access a database record and to
test the mechanism
([OWASP API1:2023 prevention](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/#how-to-prevent)).

For Morshid, `courseId`, `sessionId`, and `studentMessageId` are all
client-controlled object identifiers. Authorization must therefore be repeated
at the HTTP operation seam and inside the locked transaction: require an active
Student membership, bind the session to both the authenticated Student and its
trusted stored course, reject deleted sessions, and on retry verify that the
target Student message belongs to that same authorized session. Deriving the
course from the locked session rather than trusting a request value is the local
application of OWASP's object-level check.

OWASP API1:2023 mandates the authorization checks, but it does **not** prescribe
a particular HTTP status for concealing a forbidden object. RFC 9110 says an
origin server that wants to hide the current existence of a forbidden target
resource may answer `404`, and defines `404` to include a server that is not
willing to disclose that a representation exists
([RFC 9110 section 15.5.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4),
[RFC 9110 section 15.5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5)).
Using a content-free concealed `404` for deleted, unowned, mismatched-course
sessions and foreign retry targets is therefore a permitted **Morshid design
choice**, not an OWASP mandate. Returning `403` for an authenticated Student's
inactive membership is likewise the product's deliberate distinction.

## Primary sources used

- [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [Prisma raw queries](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries)
- [Prisma one-to-one relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-one-relations)
- [Prisma self-relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/self-relations)
- [Prisma Schema API: `@unique`](https://www.prisma.io/docs/orm/reference/prisma-schema-reference#unique)
- [Prisma `migrate dev`](https://docs.prisma.io/docs/cli/migrate/dev)
- [Prisma Client setup and generation](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/introduction)
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL unique constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS)
- [NestJS validation](https://docs.nestjs.com/techniques/validation)
- [NestJS OpenAPI types and parameters](https://docs.nestjs.com/openapi/types-and-parameters)
- [NestJS OpenAPI operations](https://docs.nestjs.com/openapi/operations)
- [NestJS OpenAPI security](https://docs.nestjs.com/openapi/security)
- [OWASP API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [RFC 9110: HTTP Semantics, 403 and 404](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4)
