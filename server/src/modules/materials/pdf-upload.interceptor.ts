import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Observable } from 'rxjs'

import type { AppEnvironment } from '../config/env.schema'

@Injectable()
export class PdfUploadInterceptor implements NestInterceptor {
  private readonly interceptor: NestInterceptor

  constructor(configService: ConfigService<AppEnvironment, true>) {
    const multerInterceptor = FileInterceptor('file', {
      limits: {
        fileSize: configService.get('PDF_MAX_UPLOAD_BYTES', { infer: true }),
        files: 1,
        fields: 1,
      },
    })

    this.interceptor = new multerInterceptor()
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> | Promise<Observable<unknown>> {
    return this.interceptor.intercept(context, next)
  }
}
