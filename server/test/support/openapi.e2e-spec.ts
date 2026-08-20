import type { INestApplication } from '@nestjs/common'
import type { OpenAPIObject } from '@nestjs/swagger'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../../src/app.setup'
import { AppModule } from '../../src/app.module'
import { MaterialProcessingScheduler } from '../../src/modules/materials/processing/material-processing.scheduler'
import { PrismaService } from '../../src/platform/database/prisma.service'
import { RedisService } from '../../src/platform/cache/redis.service'
import { NoopMaterialProcessingScheduler } from './noop-material-processing-scheduler'

type OperationObject = NonNullable<OpenAPIObject['paths'][string]['get']>
type HttpMethod = 'get' | 'post' | 'patch' | 'delete'
type ParameterObject = Exclude<
  NonNullable<OperationObject['parameters']>[number],
  { $ref: string }
>

function getOperation(
  document: OpenAPIObject,
  path: string,
  method: HttpMethod,
): OperationObject {
  const operation = document.paths[path][method]

  if (operation === undefined) {
    throw new Error(`Missing ${method.toUpperCase()} ${path}`)
  }

  return operation
}

function getParameter(
  operation: OperationObject,
  name: string,
): ParameterObject {
  const parameter = operation.parameters?.find(
    (candidate) => !('$ref' in candidate) && candidate.name === name,
  )

  if (parameter === undefined || '$ref' in parameter) {
    throw new Error(`Missing parameter ${name}`)
  }

  return parameter
}

function expectResponseStatuses(
  operation: OperationObject,
  statuses: string[],
) {
  expect(Object.keys(operation.responses).sort()).toEqual([...statuses].sort())
}

function expectResponseSchemaReference(
  operation: OperationObject,
  status: string,
  schemaName: string,
) {
  expect(operation.responses[status]).toMatchObject({
    content: {
      'application/json': {
        schema: { $ref: `#/components/schemas/${schemaName}` },
      },
    },
  })
}

function expectBodyOrRouteParamBadRequest(operation: OperationObject) {
  expect(operation.responses['400']).toMatchObject({
    content: {
      'application/json': {
        schema: {
          oneOf: [
            { $ref: '#/components/schemas/OpenApiValidationErrorDto' },
            { $ref: '#/components/schemas/NestBadRequestErrorDto' },
          ],
        },
      },
    },
  })
}

function expectRequestSchemaReference(
  operation: OperationObject,
  schemaName: string,
) {
  expect(operation.requestBody).toMatchObject({
    content: {
      'application/json': {
        schema: { $ref: `#/components/schemas/${schemaName}` },
      },
    },
  })
}

function expectProtectedOperation(
  document: OpenAPIObject,
  expected: {
    path: string
    method: HttpMethod
    tag: string
    summary: string
    statuses: readonly string[]
  },
): OperationObject {
  const operation = getOperation(document, expected.path, expected.method)
  expect(operation.tags).toEqual([expected.tag])
  expect(operation.summary).toBe(expected.summary)
  expect(operation.security).toEqual([{ 'access-token': [] }])
  expectResponseStatuses(operation, [...expected.statuses])
  expectResponseSchemaReference(operation, '401', 'OpenApiErrorDto')
  expectResponseSchemaReference(operation, '403', 'OpenApiErrorDto')
  return operation
}

describe('OpenAPI contract (e2e)', () => {
  const prismaService = {
    ping: jest.fn().mockResolvedValue(undefined),
    hasPgVectorExtension: jest.fn().mockResolvedValue(true),
  }
  const redisService = {
    ping: jest.fn().mockResolvedValue('PONG'),
  }

  async function createApp(
    nodeEnv: 'development' | 'test' | 'production' | undefined,
  ): Promise<INestApplication<App>> {
    const previousNodeEnv = process.env.NODE_ENV

    if (nodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = nodeEnv
    }

    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(PrismaService)
        .useValue(prismaService)
        .overrideProvider(RedisService)
        .useValue(redisService)
        .overrideProvider(MaterialProcessingScheduler)
        .useClass(NoopMaterialProcessingScheduler)
        .compile()

      const app = moduleFixture.createNestApplication()
      configureApp(app)
      await app.init()
      return app
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = previousNodeEnv
      }
    }
  }

  it('documents the minimal Instructor review queue contract', async () => {
    const app = await createApp('test')

    try {
      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
      const document = response.body as OpenAPIObject
      const operation = expectProtectedOperation(document, {
        path: '/api/v1/instructor/reviews',
        method: 'get',
        tag: 'instructor-reviews',
        summary: 'List the Instructor review queue',
        statuses: ['200', '400', '401', '403', '404'],
      })

      expectResponseSchemaReference(
        operation,
        '200',
        'InstructorReviewQueueResponseDto',
      )
      expect(
        operation.parameters?.map((parameter) =>
          '$ref' in parameter ? parameter.$ref : parameter.name,
        ),
      ).toEqual(['limit', 'studentFlagReason', 'cursor', 'courseId'])

      const schemas = document.components?.schemas as Record<
        string,
        { properties?: Record<string, unknown> }
      >
      expect(
        Object.keys(schemas.InstructorReviewQueueItemDto.properties ?? {}),
      ).toEqual([
        'reviewCaseId',
        'status',
        'trigger',
        'triggers',
        'studentFlagReason',
        'studentNote',
        'createdAt',
        'age',
        'course',
        'student',
        'pending',
      ])
      expect(
        Object.keys(schemas.InstructorReviewQueueResponseDto.properties ?? {}),
      ).toEqual(['items', 'pendingCount', 'nextCursor'])
    } finally {
      await app.close()
    }
  })

  it('documents the bounded Instructor review detail contract', async () => {
    const app = await createApp('test')

    try {
      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
      const document = response.body as OpenAPIObject
      const operation = expectProtectedOperation(document, {
        path: '/api/v1/instructor/reviews/{reviewCaseId}',
        method: 'get',
        tag: 'instructor-reviews',
        summary: 'Get an Instructor review case',
        statuses: ['200', '400', '401', '403', '404'],
      })
      expectResponseSchemaReference(
        operation,
        '200',
        'InstructorReviewDetailDto',
      )

      const schemas = document.components?.schemas as Record<
        string,
        { properties?: Record<string, unknown> }
      >
      expect(
        Object.keys(schemas.InstructorReviewDetailDto.properties ?? {}),
      ).toEqual([
        'reviewCaseId',
        'status',
        'version',
        'canReject',
        'trigger',
        'triggers',
        'studentFlagReason',
        'createdAt',
        'requestedAt',
        'studentNote',
        'course',
        'student',
        'flaggedExchange',
        'assistantResponse',
        'previousExchange',
        'followingExchange',
        'actions',
        'reviewSummary',
      ])
    } finally {
      await app.close()
    }
  })

  it('documents Instructor terminal review actions', async () => {
    const app = await createApp('test')

    try {
      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
      const document = response.body as OpenAPIObject
      for (const expectation of [
        {
          path: '/api/v1/instructor/reviews/{reviewCaseId}/resolve',
          summary: 'Publish a terminal Instructor review outcome',
          requestSchema: 'ResolveReviewRequestDto',
        },
        {
          path: '/api/v1/instructor/reviews/{reviewCaseId}/reject',
          summary: 'Reject a Student review request',
          requestSchema: 'RejectReviewRequestDto',
        },
      ]) {
        const operation = expectProtectedOperation(document, {
          path: expectation.path,
          method: 'post',
          tag: 'instructor-reviews',
          summary: expectation.summary,
          statuses: ['200', '400', '401', '403', '404', '409'],
        })
        expectRequestSchemaReference(operation, expectation.requestSchema)
        expectResponseSchemaReference(
          operation,
          '200',
          'InstructorReviewActionResponseDto',
        )
        expect(getParameter(operation, 'reviewCaseId')).toMatchObject({
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        })
        expect(getParameter(operation, 'Idempotency-Key')).toMatchObject({
          in: 'header',
          required: true,
        })
      }
    } finally {
      await app.close()
    }
  })

  it('documents the Student-safe review detail operation and allow-list', async () => {
    const app = await createApp('test')

    try {
      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
      const document = response.body as OpenAPIObject
      const operation = expectProtectedOperation(document, {
        path: '/api/v1/student/reviews/{reviewCaseId}',
        method: 'get',
        tag: 'student-reviews',
        summary: 'Get a Student-safe review outcome',
        statuses: ['200', '400', '401', '403', '404'],
      })
      expectResponseSchemaReference(operation, '200', 'StudentReviewDetailDto')
      expect(getParameter(operation, 'reviewCaseId')).toMatchObject({
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      })

      const schemas = document.components?.schemas as Record<
        string,
        { properties?: Record<string, unknown> }
      >
      expect(
        Object.keys(schemas.StudentReviewDetailDto.properties ?? {}),
      ).toEqual([
        'reviewCaseId',
        'status',
        'outcome',
        'publishedContent',
        'rejectionReason',
        'requestedAt',
        'resolvedAt',
        'messageId',
        'sessionId',
      ])
    } finally {
      await app.close()
    }
  })

  it('documents authenticated Student Review Inbox reads', async () => {
    const app = await createApp('test')

    try {
      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
      const document = response.body as OpenAPIObject
      const list = expectProtectedOperation(document, {
        path: '/api/v1/reviews/inbox',
        method: 'get',
        tag: 'student-reviews',
        summary: 'List the Student Review Inbox',
        statuses: ['200', '400', '401', '403'],
      })
      expectResponseSchemaReference(
        list,
        '200',
        'StudentReviewInboxListResponseDto',
      )

      const count = expectProtectedOperation(document, {
        path: '/api/v1/reviews/inbox/unread-count',
        method: 'get',
        tag: 'student-reviews',
        summary: 'Count unread Student Review Inbox items',
        statuses: ['200', '401', '403'],
      })
      expectResponseSchemaReference(
        count,
        '200',
        'StudentReviewInboxUnreadCountDto',
      )

      const read = expectProtectedOperation(document, {
        path: '/api/v1/reviews/inbox/{inboxItemId}/read',
        method: 'post',
        tag: 'student-reviews',
        summary: 'Mark a Student Review Inbox item as read',
        statuses: ['200', '400', '401', '403', '404'],
      })
      expectResponseSchemaReference(read, '200', 'StudentReviewInboxItemDto')
      expectResponseSchemaReference(read, '400', 'NestBadRequestErrorDto')
      expect(getParameter(read, 'inboxItemId')).toMatchObject({
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      })
    } finally {
      await app.close()
    }
  })

  it('serves documentation only in development and test', async () => {
    for (const nodeEnv of ['development', 'test'] as const) {
      const app = await createApp(nodeEnv)

      try {
        await request(app.getHttpServer())
          .get('/docs')
          .expect(200)
          .expect('Content-Type', /html/)
        await request(app.getHttpServer())
          .get('/docs-json')
          .expect(200)
          .expect('Content-Type', /json/)
        await request(app.getHttpServer())
          .get('/docs-yaml')
          .expect(200)
          .expect('Content-Type', /yaml/)
      } finally {
        await app.close()
      }
    }

    for (const nodeEnv of ['production', undefined] as const) {
      const app = await createApp(nodeEnv)

      try {
        await request(app.getHttpServer()).get('/docs').expect(404)
        await request(app.getHttpServer()).get('/docs-json').expect(404)
        await request(app.getHttpServer()).get('/docs-yaml').expect(404)
        await request(app.getHttpServer()).get('/health/live').expect(200)
      } finally {
        await app.close()
      }
    }
  })

  it('publishes stable tags and named authentication schemes', async () => {
    const app = await createApp('test')

    try {
      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
      const document = response.body as OpenAPIObject

      expect(document.openapi).toBe('3.0.4')
      expect(document.tags).toEqual([
        { name: 'auth', description: 'Authentication and session management.' },
        {
          name: 'courses',
          description: 'Course access and administration operations.',
        },
        {
          name: 'materials',
          description: 'Course material upload, processing, and indexing.',
        },
        {
          name: 'conversations',
          description: 'Private conversation session and message persistence.',
        },
        {
          name: 'tutoring',
          description: 'Tutoring turn execution and response governance.',
        },
        {
          name: 'user-administration',
          description: 'Administrative user account operations.',
        },
        {
          name: 'universities',
          description:
            'University tenant management and administration operations.',
        },
        { name: 'audit', description: 'Audit event access.' },
        { name: 'health', description: 'Service health checks.' },
      ])
      expect(document.components?.securitySchemes).toMatchObject({
        'access-token': {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'refresh-session': {
          type: 'apiKey',
          in: 'cookie',
          name: 'morshid_refresh',
        },
      })

      expect(getOperation(document, '/health/live', 'get')).toMatchObject({
        tags: ['health'],
        summary: 'Process liveness check',
      })
      expect(getOperation(document, '/health/ready', 'get')).toMatchObject({
        tags: ['health'],
        summary: 'Dependency readiness check',
      })
    } finally {
      await app.close()
    }
  })

  it('documents authentication requests, sessions, errors, and security', async () => {
    const app = await createApp('test')

    try {
      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
      const document = response.body as OpenAPIObject
      const signIn = getOperation(document, '/api/v1/auth/sign-in', 'post')
      const refresh = getOperation(document, '/api/v1/auth/refresh', 'post')
      const logout = getOperation(document, '/api/v1/auth/logout', 'post')
      const me = getOperation(document, '/api/v1/me', 'get')

      expect(signIn).toMatchObject({
        tags: ['identity'],
        summary: 'Sign in',
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SignInRequestDto' },
            },
          },
        },
      })
      expect(signIn.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/IdentitySessionResponseDto',
            },
          },
        },
      })
      expect(signIn.responses['200']).toHaveProperty('headers.Set-Cookie')
      expect(Object.keys(signIn.responses).sort()).toEqual([
        '200',
        '400',
        '401',
        '403',
      ])
      expect(signIn.security).toBeUndefined()

      expect(refresh).toMatchObject({
        tags: ['identity'],
        summary: 'Refresh authentication session',
      })
      expect(refresh.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/IdentitySessionResponseDto',
            },
          },
        },
      })
      expect(refresh.responses['200']).toHaveProperty('headers.Set-Cookie')
      expect(Object.keys(refresh.responses).sort()).toEqual([
        '200',
        '401',
        '403',
      ])
      expect(refresh.security).toEqual([{ 'refresh-session': [] }])

      expect(logout).toMatchObject({
        tags: ['identity'],
        summary: 'Log out',
      })
      expect(logout.responses['204']).toMatchObject({
        headers: {
          'Set-Cookie': {
            description:
              'Clears the HttpOnly morshid_refresh cookie scoped to /api/v1/auth.',
            schema: {
              type: 'string',
            },
          },
        },
      })
      expect(logout.responses['204']).toHaveProperty(
        'headers.Set-Cookie.schema.example',
        expect.stringContaining('morshid_refresh=;'),
      )
      expect(Object.keys(logout.responses).sort()).toEqual(['204'])
      expect(logout.security).toEqual([{ 'refresh-session': [] }])

      expect(me).toMatchObject({
        tags: ['identity'],
        summary: 'Get current user',
        security: [{ 'access-token': [] }],
      })
      expect(me.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/MeResponseDto' },
          },
        },
      })
      expect(Object.keys(me.responses).sort()).toEqual(['200', '401', '403'])

      for (const operation of [signIn, refresh, logout, me]) {
        for (const status of ['400', '401', '403']) {
          const errorResponse = operation.responses[status]

          if (errorResponse !== undefined) {
            expect(errorResponse).toMatchObject({
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/OpenApiErrorDto' },
                },
              },
            })
          }
        }
      }

      const schemas = document.components?.schemas as Record<
        string,
        { required?: string[]; properties?: Record<string, unknown> }
      >
      expect(schemas.SignInRequestDto.properties).toMatchObject({
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 1 },
      })
      expect(schemas.IdentitySessionResponseDto.properties).toMatchObject({
        tokenType: { type: 'string', enum: ['Bearer'] },
        accessTokenExpiresAt: { type: 'string', format: 'date-time' },
      })
      expect(schemas.IdentitySessionResponseDto.properties).not.toHaveProperty(
        'refreshToken',
      )
      expect(schemas.IdentitySessionResponseDto.properties).not.toHaveProperty(
        'refreshTokenExpiresAt',
      )
      expect(schemas.IdentityUserSummaryDto.properties).not.toHaveProperty(
        'courses',
      )
    } finally {
      await app.close()
    }
  })

  it('documents course and admin-user operations and reachable errors', async () => {
    const app = await createApp('test')

    try {
      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
      const document = response.body as OpenAPIObject
      const expectedOperations = [
        {
          path: '/api/v1/courses',
          method: 'get',
          tag: 'courses',
          summary: 'List accessible courses',
          statuses: ['200', '401', '403'],
        },
        {
          path: '/api/v1/admin/users',
          method: 'get',
          tag: 'user-administration',
          summary: 'List users',
          statuses: ['200', '400', '401', '403'],
        },
        {
          path: '/api/v1/admin/users',
          method: 'post',
          tag: 'user-administration',
          summary: 'Create user',
          statuses: ['201', '400', '401', '403', '409'],
        },
        {
          path: '/api/v1/admin/users/{userId}',
          method: 'patch',
          tag: 'user-administration',
          summary: 'Update user',
          statuses: ['200', '400', '401', '403', '404', '409'],
        },
        {
          path: '/api/v1/admin/users/{userId}/disable',
          method: 'patch',
          tag: 'user-administration',
          summary: 'Disable user',
          statuses: ['200', '400', '401', '403', '404', '409'],
        },
        {
          path: '/api/v1/admin/users/{userId}/reactivate',
          method: 'patch',
          tag: 'user-administration',
          summary: 'Reactivate user',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: '/api/v1/admin/users/{userId}/reset-password',
          method: 'patch',
          tag: 'user-administration',
          summary: 'Reset user password',
          statuses: ['200', '400', '401', '403', '404'],
        },
      ] as const

      for (const expected of expectedOperations) {
        expectProtectedOperation(document, expected)
      }

      const listUsers = getOperation(document, '/api/v1/admin/users', 'get')
      expect(getParameter(listUsers, 'limit')).toMatchObject({
        in: 'query',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 50,
        },
      })
      expect(getParameter(listUsers, 'cursor')).toMatchObject({
        in: 'query',
        required: false,
        schema: { type: 'string', format: 'uuid' },
      })
      expectResponseSchemaReference(
        listUsers,
        '200',
        'ManagedUserListResponseDto',
      )
      expectResponseSchemaReference(
        listUsers,
        '400',
        'OpenApiValidationErrorDto',
      )

      expectResponseSchemaReference(
        getOperation(document, '/api/v1/courses', 'get'),
        '200',
        'CourseListResponseDto',
      )

      const createUser = getOperation(document, '/api/v1/admin/users', 'post')
      expectRequestSchemaReference(createUser, 'CreateUserRequestDto')
      expectResponseSchemaReference(createUser, '201', 'CreateUserResponseDto')
      expectResponseSchemaReference(
        createUser,
        '400',
        'OpenApiValidationErrorDto',
      )
      expectResponseSchemaReference(createUser, '409', 'OpenApiErrorDto')

      const updateUser = getOperation(
        document,
        '/api/v1/admin/users/{userId}',
        'patch',
      )
      expectRequestSchemaReference(updateUser, 'UpdateUserRequestDto')
      expect(getParameter(updateUser, 'userId')).toMatchObject({
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      })
      expectResponseSchemaReference(updateUser, '200', 'UpdateUserResponseDto')
      expectResponseSchemaReference(updateUser, '409', 'OpenApiErrorDto')

      for (const action of ['disable', 'reactivate', 'reset-password']) {
        const operation = getOperation(
          document,
          `/api/v1/admin/users/{userId}/${action}`,
          'patch',
        )
        expect(getParameter(operation, 'userId')).toMatchObject({
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        })
        expectResponseSchemaReference(operation, '404', 'OpenApiErrorDto')
      }

      const disableUser = getOperation(
        document,
        '/api/v1/admin/users/{userId}/disable',
        'patch',
      )
      expectResponseSchemaReference(
        disableUser,
        '400',
        'NestBadRequestErrorDto',
      )
      expectResponseSchemaReference(disableUser, '409', 'OpenApiErrorDto')
      expectResponseSchemaReference(
        disableUser,
        '200',
        'DisableUserResponseDto',
      )

      const reactivateUser = getOperation(
        document,
        '/api/v1/admin/users/{userId}/reactivate',
        'patch',
      )
      expectResponseSchemaReference(
        reactivateUser,
        '400',
        'NestBadRequestErrorDto',
      )
      expectResponseSchemaReference(
        reactivateUser,
        '200',
        'ReactivateUserResponseDto',
      )

      const resetPassword = getOperation(
        document,
        '/api/v1/admin/users/{userId}/reset-password',
        'patch',
      )
      expectRequestSchemaReference(resetPassword, 'ResetUserPasswordRequestDto')
      expectResponseSchemaReference(
        resetPassword,
        '200',
        'ResetUserPasswordResponseDto',
      )
      expect(resetPassword.responses['400']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  $ref: '#/components/schemas/OpenApiValidationErrorDto',
                },
                { $ref: '#/components/schemas/NestBadRequestErrorDto' },
              ],
            },
          },
        },
      })

      const schemas = document.components?.schemas as Record<
        string,
        { properties: Record<string, unknown> }
      >
      const passwordPolicy = {
        minLength: 15,
        maxLength: 128,
      }
      expect(schemas.CreateUserRequestDto.properties.password).toMatchObject(
        passwordPolicy,
      )
      expect(
        schemas.ResetUserPasswordRequestDto.properties.newPassword,
      ).toMatchObject(passwordPolicy)
    } finally {
      await app.close()
    }
  })

  it('documents materials upload, list, detail, and status operations', async () => {
    const app = await createApp('test')

    try {
      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
      const document = response.body as OpenAPIObject
      const base = '/api/v1/courses/{courseId}/materials'
      const expectedOperations = [
        {
          path: base,
          method: 'post',
          tag: 'materials',
          summary: 'Upload course PDF material',
          statuses: ['201', '400', '401', '403', '404', '409', '413'],
        },
        {
          path: base,
          method: 'get',
          tag: 'materials',
          summary: 'List course materials',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: `${base}/{materialId}`,
          method: 'get',
          tag: 'materials',
          summary: 'Get course material',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: `${base}/{materialId}`,
          method: 'delete',
          tag: 'materials',
          summary: 'Delete a course material knowledge source',
          statuses: ['204', '400', '401', '403', '404', '503'],
        },
        {
          path: `${base}/{materialId}/status`,
          method: 'get',
          tag: 'materials',
          summary: 'Get course material processing status',
          statuses: ['200', '400', '401', '403', '404'],
        },
      ] as const

      for (const expected of expectedOperations) {
        const operation = expectProtectedOperation(document, expected)

        expect(getParameter(operation, 'courseId')).toMatchObject({
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        })

        if (expected.path.includes('{materialId}')) {
          expect(getParameter(operation, 'materialId')).toMatchObject({
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          })
        }

        expectResponseSchemaReference(operation, '404', 'OpenApiErrorDto')
      }

      const upload = getOperation(document, base, 'post')
      expect(upload.requestBody).toMatchObject({
        content: {
          'multipart/form-data': {
            schema: {
              $ref: '#/components/schemas/UploadMaterialRequestDto',
            },
          },
        },
      })
      expect(upload.responses['400']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  $ref: '#/components/schemas/OpenApiValidationErrorDto',
                },
                { $ref: '#/components/schemas/NestBadRequestErrorDto' },
              ],
            },
          },
        },
      })
      expectResponseSchemaReference(upload, '201', 'MaterialResponseDto')
      expectResponseSchemaReference(upload, '413', 'OpenApiErrorDto')

      expectResponseSchemaReference(
        getOperation(document, base, 'get'),
        '200',
        'MaterialListResponseDto',
      )
      expectResponseSchemaReference(
        getOperation(document, `${base}/{materialId}`, 'get'),
        '200',
        'MaterialResponseDto',
      )
      expectResponseSchemaReference(
        getOperation(document, `${base}/{materialId}/status`, 'get'),
        '200',
        'MaterialStatusDto',
      )

      for (const operation of [
        getOperation(document, base, 'get'),
        getOperation(document, `${base}/{materialId}`, 'get'),
        getOperation(document, `${base}/{materialId}/status`, 'get'),
      ]) {
        expectResponseSchemaReference(
          operation,
          '400',
          'NestBadRequestErrorDto',
        )
      }

      const schemas = document.components?.schemas as Record<
        string,
        { required?: string[]; properties?: Record<string, unknown> }
      >
      expect(schemas.UploadMaterialRequestDto.properties).toMatchObject({
        title: { type: 'string', minLength: 1, maxLength: 180 },
        file: { type: 'string', format: 'binary' },
      })
      expect(Object.keys(schemas.MaterialDto.properties ?? {})).toEqual([
        'id',
        'courseId',
        'title',
        'originalFilename',
        'status',
        'extractedTextLength',
        'chunkCount',
        'errorMessage',
        'createdAt',
        'updatedAt',
        'canDelete',
      ])
      expect(Object.keys(schemas.MaterialStatusDto.properties ?? {})).toEqual([
        'id',
        'status',
        'extractedTextLength',
        'chunkCount',
        'errorMessage',
        'updatedAt',
      ])
    } finally {
      await app.close()
    }
  })

  it('documents conversation and tutoring operations and reachable error shapes', async () => {
    const app = await createApp('test')

    try {
      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
      const document = response.body as OpenAPIObject
      const base = '/api/v1/courses/{courseId}/chat-sessions'
      const expectedOperations = [
        {
          path: base,
          method: 'post',
          tag: 'conversations',
          summary: 'Create chat session',
          statuses: ['201', '400', '401', '403'],
        },
        {
          path: base,
          method: 'get',
          tag: 'conversations',
          summary: 'List chat sessions',
          statuses: ['200', '400', '401', '403'],
        },
        {
          path: `${base}/{sessionId}`,
          method: 'get',
          tag: 'conversations',
          summary: 'Get chat session',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: `${base}/{sessionId}`,
          method: 'patch',
          tag: 'conversations',
          summary: 'Rename chat session',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: `${base}/{sessionId}`,
          method: 'delete',
          tag: 'conversations',
          summary: 'Delete chat session',
          statuses: ['204', '400', '401', '403', '404'],
        },
        {
          path: `${base}/{sessionId}/messages`,
          method: 'get',
          tag: 'conversations',
          summary: 'List chat session messages',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: `${base}/{sessionId}/messages`,
          method: 'post',
          tag: 'tutoring',
          summary: 'Send tutoring message',
          statuses: ['201', '400', '401', '403', '404', '409', '503'],
        },
        {
          path: `${base}/{sessionId}/tutoring-attempts/{attemptId}/retry`,
          method: 'post',
          tag: 'tutoring',
          summary: 'Retry failed tutoring response',
          statuses: ['200', '400', '401', '403', '404', '409', '503'],
        },
      ] as const

      for (const expected of expectedOperations) {
        const operation = expectProtectedOperation(document, expected)

        expect(getParameter(operation, 'courseId')).toMatchObject({
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        })

        if (expected.path.includes('{sessionId}')) {
          expect(getParameter(operation, 'sessionId')).toMatchObject({
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          })
        }

        if (expected.path.includes('{attemptId}')) {
          expect(getParameter(operation, 'attemptId')).toMatchObject({
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          })
        }

        if ((expected.statuses as readonly string[]).includes('404')) {
          expectResponseSchemaReference(operation, '404', 'OpenApiErrorDto')
        }
      }

      // Endpoints with a request body or query carry both validation shapes at
      // 400 (Zod validation error or a non-UUID path parameter).
      const validationOrUuidBadRequest = {
        oneOf: [
          { $ref: '#/components/schemas/OpenApiValidationErrorDto' },
          { $ref: '#/components/schemas/NestBadRequestErrorDto' },
        ],
      }
      for (const { path, method } of [
        { path: base, method: 'post' },
        { path: base, method: 'get' },
        { path: `${base}/{sessionId}`, method: 'patch' },
        { path: `${base}/{sessionId}/messages`, method: 'get' },
        { path: `${base}/{sessionId}/messages`, method: 'post' },
        {
          path: `${base}/{sessionId}/tutoring-attempts/{attemptId}/retry`,
          method: 'post',
        },
      ] as const) {
        expect(
          getOperation(document, path, method).responses['400'],
        ).toMatchObject({
          content: {
            'application/json': { schema: validationOrUuidBadRequest },
          },
        })
      }

      // Endpoints with only UUID path parameters can only 400 on a bad UUID.
      for (const { path, method } of [
        { path: `${base}/{sessionId}`, method: 'get' },
        { path: `${base}/{sessionId}`, method: 'delete' },
      ] as const) {
        expectResponseSchemaReference(
          getOperation(document, path, method),
          '400',
          'NestBadRequestErrorDto',
        )
      }

      expectRequestSchemaReference(
        getOperation(document, base, 'post'),
        'CreateChatSessionRequestDto',
      )
      expectResponseSchemaReference(
        getOperation(document, base, 'post'),
        '201',
        'ChatSessionResponseDto',
      )
      expectResponseSchemaReference(
        getOperation(document, base, 'get'),
        '200',
        'ChatSessionListResponseDto',
      )
      expectRequestSchemaReference(
        getOperation(document, `${base}/{sessionId}`, 'patch'),
        'RenameChatSessionRequestDto',
      )
      expectResponseSchemaReference(
        getOperation(document, `${base}/{sessionId}`, 'get'),
        '200',
        'ChatSessionResponseDto',
      )
      expectResponseSchemaReference(
        getOperation(document, `${base}/{sessionId}/messages`, 'get'),
        '200',
        'ChatMessageHistoryResponseDto',
      )
      expectRequestSchemaReference(
        getOperation(document, `${base}/{sessionId}/messages`, 'post'),
        'SendTutoringMessageRequestDto',
      )
      expectResponseSchemaReference(
        getOperation(document, `${base}/{sessionId}/messages`, 'post'),
        '201',
        'TutoringTurnResponseDto',
      )
      const retry = getOperation(
        document,
        `${base}/{sessionId}/tutoring-attempts/{attemptId}/retry`,
        'post',
      )
      expect(retry.requestBody).toBeUndefined()
      expectResponseSchemaReference(retry, '200', 'TutoringTurnResponseDto')

      const schemas = document.components?.schemas as Record<
        string,
        { required?: string[]; properties?: Record<string, unknown> }
      >
      expect(schemas.SendTutoringMessageRequestDto.properties).toEqual({
        clientMessageId: {
          type: 'string',
          format: 'uuid',
        },
        content: {
          type: 'string',
          minLength: 1,
          maxLength: 4000,
        },
        problemId: {
          description:
            'Stable visible problem identity used to select the topic.',
          type: 'string',
          format: 'uuid',
        },
        conceptId: {
          description:
            'Stable visible concept identity used to select the topic.',
          type: 'string',
          format: 'uuid',
        },
        title: {
          type: 'string',
          minLength: 1,
          maxLength: 160,
        },
      })
      expect(schemas.SendTutoringMessageRequestDto.required).toEqual(
        expect.arrayContaining(['clientMessageId', 'content']),
      )
      expect(schemas.ChatMessageDto.properties?.citations).toEqual({
        type: 'array',
        items: { $ref: '#/components/schemas/ChatCitationDto' },
      })
      expect(schemas.ChatMessageDto.properties?.attemptId).toEqual({
        type: 'string',
        format: 'uuid',
        nullable: true,
      })
      expect(schemas.ChatMessageDto.properties?.topicId).toEqual({
        type: 'string',
        format: 'uuid',
        nullable: true,
      })
      expect(schemas.ChatMessageDto.properties?.hintLevel).toEqual({
        type: 'number',
        minimum: 1,
        maximum: 4,
        nullable: true,
      })
      expect(schemas.ChatCitationDto.properties?.evidence).toEqual({
        type: 'array',
        items: { $ref: '#/components/schemas/ChatCitationEvidenceDto' },
      })
      expect(schemas.ChatCitationDto.properties?.sourceStatus).toEqual({
        type: 'string',
        enum: ['AVAILABLE', 'DELETED', 'UNAVAILABLE'],
      })
    } finally {
      await app.close()
    }
  })

  it('documents the review creation seam and forward-compatible review contracts', async () => {
    const app = await createApp('test')

    try {
      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
      const document = response.body as OpenAPIObject
      const operation = expectProtectedOperation(document, {
        path: '/api/v1/messages/{messageId}/review-requests',
        method: 'post',
        tag: 'student-reviews',
        summary: 'Request Instructor review of an assistant response',
        statuses: [
          '200',
          '201',
          '400',
          '401',
          '403',
          '404',
          '409',
          '413',
          '429',
        ],
      })

      expect(getParameter(operation, 'messageId')).toMatchObject({
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      })
      expect(getParameter(operation, 'Idempotency-Key')).toMatchObject({
        in: 'header',
        required: true,
      })
      expectRequestSchemaReference(operation, 'CreateReviewRequestDto')
      expectResponseSchemaReference(
        operation,
        '201',
        'CreateReviewRequestResponseDto',
      )

      const schemas = document.components?.schemas as Record<
        string,
        { enum?: string[]; properties?: Record<string, unknown> }
      >
      for (const schemaName of [
        'ReviewQueueItemContractDto',
        'ReviewDetailContractDto',
        'ReviewActionContractDto',
        'PublishedReviewContractDto',
        'StudentReviewInboxItemDto',
        'StudentReviewInboxListResponseDto',
        'StudentReviewInboxUnreadCountDto',
      ]) {
        expect(schemas).toHaveProperty(schemaName)
      }
      expect(schemas.ReviewStatus.enum).toEqual([
        'PENDING',
        'IN_REVIEW',
        'RESOLVED',
        'REJECTED',
      ])
      expect(schemas.StudentReviewSummaryDto.properties?.outcome).toMatchObject(
        {
          nullable: true,
        },
      )
      expect(schemas.ReviewOutcome.enum).toEqual([
        'APPROVED',
        'EDITED',
        'REPLACED',
        'REQUEST_REJECTED',
      ])
      expect(schemas.ReviewInboxItemType.enum).toEqual([
        'REVIEW_RESOLVED',
        'REVIEW_REJECTED',
      ])
      expect(schemas.ReviewInboxItemStatus.enum).toEqual(['UNREAD', 'READ'])
    } finally {
      await app.close()
    }
  })

  it('documents admin course, material, and audit operations', async () => {
    const app = await createApp('test')

    try {
      const response = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200)
      const document = response.body as OpenAPIObject
      const expectedOperations = [
        {
          path: '/api/v1/admin/courses',
          method: 'get',
          tag: 'courses',
          summary: 'List courses for administration',
          statuses: ['200', '401', '403'],
        },
        {
          path: '/api/v1/admin/courses',
          method: 'post',
          tag: 'courses',
          summary: 'Create course',
          statuses: ['201', '400', '401', '403', '409'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}',
          method: 'get',
          tag: 'courses',
          summary: 'Get course details',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}',
          method: 'patch',
          tag: 'courses',
          summary: 'Update course',
          statuses: ['200', '400', '401', '403', '404', '409'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members',
          method: 'post',
          tag: 'courses',
          summary: 'Add course member',
          statuses: ['201', '400', '401', '403', '404', '409'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members/{userId}',
          method: 'delete',
          tag: 'courses',
          summary: 'Remove course member',
          statuses: ['204', '400', '401', '403', '404'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members',
          method: 'get',
          tag: 'courses',
          summary: 'List course members',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members/{userId}',
          method: 'patch',
          tag: 'courses',
          summary: 'Update course member role',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: '/api/v1/admin/audit',
          method: 'get',
          tag: 'audit',
          summary:
            'List recent audit events with search, filters, and pagination',
          statuses: ['200', '400', '401', '403'],
        },
      ] as const

      for (const expected of expectedOperations) {
        const operation = expectProtectedOperation(document, expected)

        if (expected.path.includes('{courseId}')) {
          expect(getParameter(operation, 'courseId')).toMatchObject({
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          })
        }

        if (expected.path.includes('{userId}')) {
          expect(getParameter(operation, 'userId')).toMatchObject({
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          })
        }

        if (expected.path.includes('{materialId}')) {
          expect(getParameter(operation, 'materialId')).toMatchObject({
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          })
        }
      }

      const detailAndMutationOperations = expectedOperations.filter(
        ({ statuses }) => (statuses as readonly string[]).includes('404'),
      )
      for (const expected of detailAndMutationOperations) {
        expectResponseSchemaReference(
          getOperation(document, expected.path, expected.method),
          '404',
          'OpenApiErrorDto',
        )
      }

      const addMember = getOperation(
        document,
        '/api/v1/admin/courses/{courseId}/members',
        'post',
      )
      expectRequestSchemaReference(addMember, 'AddCourseMemberRequestDto')
      expectBodyOrRouteParamBadRequest(addMember)
      expectResponseSchemaReference(addMember, '409', 'OpenApiErrorDto')

      const createCourse = getOperation(
        document,
        '/api/v1/admin/courses',
        'post',
      )
      expectRequestSchemaReference(createCourse, 'CreateCourseRequestDto')
      expectResponseSchemaReference(
        createCourse,
        '400',
        'OpenApiValidationErrorDto',
      )
      expectResponseSchemaReference(createCourse, '409', 'OpenApiErrorDto')

      const updateCourse = getOperation(
        document,
        '/api/v1/admin/courses/{courseId}',
        'patch',
      )
      expectRequestSchemaReference(updateCourse, 'UpdateCourseRequestDto')
      expectBodyOrRouteParamBadRequest(updateCourse)
      expectResponseSchemaReference(updateCourse, '409', 'OpenApiErrorDto')

      const updateMember = getOperation(
        document,
        '/api/v1/admin/courses/{courseId}/members/{userId}',
        'patch',
      )
      expectRequestSchemaReference(updateMember, 'UpdateMemberRoleRequestDto')
      expectBodyOrRouteParamBadRequest(updateMember)

      const audit = getOperation(document, '/api/v1/admin/audit', 'get')
      expect(getParameter(audit, 'limit')).toMatchObject({
        in: 'query',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
        },
      })
      expectResponseSchemaReference(audit, '400', 'OpenApiIssuesErrorDto')

      const successfulResponseSchemas = [
        {
          path: '/api/v1/admin/courses',
          method: 'get',
          status: '200',
          schema: 'CourseAdministrationListResponseDto',
        },
        {
          path: '/api/v1/admin/courses',
          method: 'post',
          status: '201',
          schema: 'CourseAdministrationDetailResponseDto',
        },
        {
          path: '/api/v1/admin/courses/{courseId}',
          method: 'get',
          status: '200',
          schema: 'CourseAdministrationDetailResponseDto',
        },
        {
          path: '/api/v1/admin/courses/{courseId}',
          method: 'patch',
          status: '200',
          schema: 'CourseAdministrationDetailResponseDto',
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members',
          method: 'post',
          status: '201',
          schema: 'CourseAdministrationMemberResponseDto',
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members',
          method: 'get',
          status: '200',
          schema: 'CourseAdministrationMemberListResponseDto',
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members/{userId}',
          method: 'patch',
          status: '200',
          schema: 'CourseAdministrationMemberResponseDto',
        },
        {
          path: '/api/v1/admin/audit',
          method: 'get',
          status: '200',
          schema: 'AuditEventListResponseDto',
        },
      ] as const

      for (const expected of successfulResponseSchemas) {
        expectResponseSchemaReference(
          getOperation(document, expected.path, expected.method),
          expected.status,
          expected.schema,
        )
      }
    } finally {
      await app.close()
    }
  })
})
