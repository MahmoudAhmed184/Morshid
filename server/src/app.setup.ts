import { RequestMethod, type INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  })

  if (!['development', 'test'].includes(process.env.NODE_ENV ?? '')) {
    return
  }

  const openApiConfig = new DocumentBuilder()
    .setTitle('Morshid API')
    .setDescription('API for the Morshid Socratic teaching assistant.')
    .setVersion('0.1.0')
    .setOpenAPIVersion('3.0.4')
    .addTag('auth', 'Authentication and session management.')
    .addTag('courses', 'Course access for authenticated users.')
    .addTag(
      'materials',
      'Instructor and admin course material upload and status operations.',
    )
    .addTag(
      'student-chat-sessions',
      'Private Student chat session and message persistence.',
    )
    .addTag('admin-users', 'Administrative user account operations.')
    .addTag(
      'admin-courses',
      'Administrative course, membership, and material operations.',
    )
    .addTag('admin-audit', 'Administrative audit event access.')
    .addTag('health', 'Service health checks.')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token returned by the sign-in or refresh API.',
      },
      'access-token',
    )
    .addCookieAuth(
      'morshid_refresh',
      {
        type: 'apiKey',
        in: 'cookie',
        description: 'HttpOnly browser refresh-session cookie.',
      },
      'refresh-session',
    )
    .build()
  const document = SwaggerModule.createDocument(app, openApiConfig, {
    autoTagControllers: false,
  })

  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
  })
}
