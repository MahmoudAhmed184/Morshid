import type { INestApplication } from '@nestjs/common'
import type { OpenAPIObject } from '@nestjs/swagger'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp } from '../src/app.setup'
import { AppModule } from '../src/app.module'
import { MaterialProcessingScheduler } from '../src/modules/materials/material-processing.scheduler'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { RedisService } from '../src/modules/redis/redis.service'
import { NoopMaterialProcessingScheduler } from './support/noop-material-processing-scheduler'

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
          description: 'Course access for authenticated users.',
        },
        {
          name: 'materials',
          description:
            'Instructor and admin course material upload and status operations.',
        },
        {
          name: 'student-chat-sessions',
          description: 'Private Student chat session and message persistence.',
        },
        {
          name: 'admin-users',
          description: 'Administrative user account operations.',
        },
        {
          name: 'admin-courses',
          description:
            'Administrative course, membership, and material operations.',
        },
        {
          name: 'admin-audit',
          description: 'Administrative audit event access.',
        },
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
        tags: ['auth'],
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
              $ref: '#/components/schemas/AuthSessionResponseDto',
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
        tags: ['auth'],
        summary: 'Refresh authentication session',
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshRequestDto' },
            },
          },
        },
      })
      expect(refresh.responses['200']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AuthSessionResponseDto',
            },
          },
        },
      })
      expect(refresh.responses['200']).toHaveProperty('headers.Set-Cookie')
      expect(Object.keys(refresh.responses).sort()).toEqual([
        '200',
        '400',
        '401',
        '403',
      ])
      expect(refresh.security).toEqual(
        expect.arrayContaining([{}, { 'refresh-session': [] }]),
      )

      expect(logout).toMatchObject({
        tags: ['auth'],
        summary: 'Log out',
      })
      expectRequestSchemaReference(logout, 'RefreshRequestDto')
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
      expect(Object.keys(logout.responses).sort()).toEqual(['204', '400'])
      expect(logout.security).toEqual(
        expect.arrayContaining([{}, { 'refresh-session': [] }]),
      )

      expect(me).toMatchObject({
        tags: ['auth'],
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
      expect(schemas.RefreshRequestDto.required ?? []).not.toContain(
        'refreshToken',
      )
      expect(schemas.AuthCourseSummaryDto.properties).toMatchObject({
        id: { type: 'string', format: 'uuid' },
        membershipRole: { nullable: true },
      })
      expect(schemas.AuthSessionResponseDto.properties).toMatchObject({
        tokenType: { type: 'string', enum: ['Bearer'] },
        accessTokenExpiresAt: { type: 'string', format: 'date-time' },
        refreshTokenExpiresAt: { type: 'string', format: 'date-time' },
      })
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
          tag: 'admin-users',
          summary: 'List users',
          statuses: ['200', '400', '401', '403'],
        },
        {
          path: '/api/v1/admin/users',
          method: 'post',
          tag: 'admin-users',
          summary: 'Create user',
          statuses: ['201', '400', '401', '403', '409'],
        },
        {
          path: '/api/v1/admin/users/{userId}/disable',
          method: 'patch',
          tag: 'admin-users',
          summary: 'Disable user',
          statuses: ['200', '400', '401', '403', '404', '409'],
        },
        {
          path: '/api/v1/admin/users/{userId}/reactivate',
          method: 'patch',
          tag: 'admin-users',
          summary: 'Reactivate user',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: '/api/v1/admin/users/{userId}/reset-password',
          method: 'patch',
          tag: 'admin-users',
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
        'AdminUserListResponseDto',
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
      expectRequestSchemaReference(createUser, 'AdminCreateUserRequestDto')
      expectResponseSchemaReference(
        createUser,
        '201',
        'AdminCreateUserResponseDto',
      )
      expectResponseSchemaReference(
        createUser,
        '400',
        'OpenApiValidationErrorDto',
      )
      expectResponseSchemaReference(createUser, '409', 'OpenApiErrorDto')

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
        'AdminDisableUserResponseDto',
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
        'AdminReactivateUserResponseDto',
      )

      const resetPassword = getOperation(
        document,
        '/api/v1/admin/users/{userId}/reset-password',
        'patch',
      )
      expectRequestSchemaReference(
        resetPassword,
        'AdminResetUserPasswordRequestDto',
      )
      expectResponseSchemaReference(
        resetPassword,
        '200',
        'AdminResetUserPasswordResponseDto',
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
        minLength: 8,
        maxLength: 50,
        pattern: '^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,50}$',
      }
      expect(
        schemas.AdminCreateUserRequestDto.properties.password,
      ).toMatchObject(passwordPolicy)
      expect(
        schemas.AdminResetUserPasswordRequestDto.properties.newPassword,
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
          statuses: ['201', '400', '401', '403', '404', '413'],
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

  it('documents student chat session operations and reachable error shapes', async () => {
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
          tag: 'student-chat-sessions',
          summary: 'Create chat session',
          statuses: ['201', '400', '401', '403'],
        },
        {
          path: base,
          method: 'get',
          tag: 'student-chat-sessions',
          summary: 'List chat sessions',
          statuses: ['200', '400', '401', '403'],
        },
        {
          path: `${base}/{sessionId}`,
          method: 'get',
          tag: 'student-chat-sessions',
          summary: 'Get chat session',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: `${base}/{sessionId}`,
          method: 'patch',
          tag: 'student-chat-sessions',
          summary: 'Rename chat session',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: `${base}/{sessionId}`,
          method: 'delete',
          tag: 'student-chat-sessions',
          summary: 'Delete chat session',
          statuses: ['204', '400', '401', '403', '404'],
        },
        {
          path: `${base}/{sessionId}/messages`,
          method: 'get',
          tag: 'student-chat-sessions',
          summary: 'List chat session messages',
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

        if (expected.path.includes('{sessionId}')) {
          expect(getParameter(operation, 'sessionId')).toMatchObject({
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
          tag: 'admin-courses',
          summary: 'List courses for administration',
          statuses: ['200', '401', '403'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}',
          method: 'get',
          tag: 'admin-courses',
          summary: 'Get course details',
          statuses: ['200', '401', '403', '404'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members',
          method: 'post',
          tag: 'admin-courses',
          summary: 'Add course member',
          statuses: ['201', '400', '401', '403', '404', '409'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members/{userId}',
          method: 'delete',
          tag: 'admin-courses',
          summary: 'Remove course member',
          statuses: ['204', '401', '403', '404'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members',
          method: 'get',
          tag: 'admin-courses',
          summary: 'List course members',
          statuses: ['200', '401', '403', '404'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members/{userId}',
          method: 'patch',
          tag: 'admin-courses',
          summary: 'Update course member role',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}/materials',
          method: 'get',
          tag: 'admin-courses',
          summary: 'List course materials',
          statuses: ['200', '401', '403', '404'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}/materials/{materialId}',
          method: 'get',
          tag: 'admin-courses',
          summary: 'Get course material',
          statuses: ['200', '401', '403', '404'],
        },
        {
          path: '/api/v1/admin/courses/{courseId}/materials/{materialId}',
          method: 'patch',
          tag: 'admin-courses',
          summary: 'Update course material',
          statuses: ['200', '400', '401', '403', '404'],
        },
        {
          path: '/api/v1/admin/audit',
          method: 'get',
          tag: 'admin-audit',
          summary: 'List recent audit events',
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
      expectRequestSchemaReference(addMember, 'AdminAddCourseMemberRequestDto')
      expectResponseSchemaReference(
        addMember,
        '400',
        'OpenApiValidationErrorDto',
      )
      expectResponseSchemaReference(addMember, '409', 'OpenApiErrorDto')

      const updateMember = getOperation(
        document,
        '/api/v1/admin/courses/{courseId}/members/{userId}',
        'patch',
      )
      expectRequestSchemaReference(
        updateMember,
        'AdminUpdateMemberRoleRequestDto',
      )
      expectResponseSchemaReference(
        updateMember,
        '400',
        'OpenApiValidationErrorDto',
      )

      const updateMaterial = getOperation(
        document,
        '/api/v1/admin/courses/{courseId}/materials/{materialId}',
        'patch',
      )
      expectRequestSchemaReference(
        updateMaterial,
        'AdminUpdateMaterialRequestDto',
      )
      expectResponseSchemaReference(
        updateMaterial,
        '400',
        'OpenApiValidationErrorDto',
      )

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
          schema: 'AdminCourseListResponseDto',
        },
        {
          path: '/api/v1/admin/courses/{courseId}',
          method: 'get',
          status: '200',
          schema: 'AdminCourseDetailResponseDto',
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members',
          method: 'post',
          status: '201',
          schema: 'AdminCourseMemberResponseDto',
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members',
          method: 'get',
          status: '200',
          schema: 'AdminCourseMemberListResponseDto',
        },
        {
          path: '/api/v1/admin/courses/{courseId}/members/{userId}',
          method: 'patch',
          status: '200',
          schema: 'AdminCourseMemberResponseDto',
        },
        {
          path: '/api/v1/admin/courses/{courseId}/materials',
          method: 'get',
          status: '200',
          schema: 'AdminMaterialListResponseDto',
        },
        {
          path: '/api/v1/admin/courses/{courseId}/materials/{materialId}',
          method: 'get',
          status: '200',
          schema: 'AdminMaterialResponseDto',
        },
        {
          path: '/api/v1/admin/courses/{courseId}/materials/{materialId}',
          method: 'patch',
          status: '200',
          schema: 'AdminMaterialResponseDto',
        },
        {
          path: '/api/v1/admin/audit',
          method: 'get',
          status: '200',
          schema: 'AdminAuditEventListResponseDto',
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
