import { RequestMethod, type INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  })

  const openApiConfig = new DocumentBuilder()
    .setTitle('Morshid API')
    .setDescription('Foundation scaffold API for Morshid.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, openApiConfig)

  SwaggerModule.setup('docs', app, document)
}
