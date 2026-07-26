import {
  Injectable,
  ParseUUIDPipe,
  PayloadTooLargeException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FileInterceptor } from '@nestjs/platform-express'
import { catchError, from, throwError, type Observable } from 'rxjs'

import { getRequestContext } from '../../common/http/request-context'
import type { AuthenticatedHttpRequest } from '../auth/auth.guard'
import type { AppEnvironment } from '../config/env.schema'
import { MaterialsAuditService } from './materials.audit.service'
import {
  invalidMaterialsRequestException,
  pdfTooLargeException,
} from './materials.errors'

@Injectable()
export class PdfUploadInterceptor implements NestInterceptor {
  private readonly interceptor: NestInterceptor
  private readonly courseIdPipe = new ParseUUIDPipe({ version: '4' })

  constructor(
    configService: ConfigService<AppEnvironment, true>,
    private readonly materialsAuditService: MaterialsAuditService,
  ) {
    const multerInterceptor = FileInterceptor('file', {
      limits: {
        fileSize: configService.get('PDF_MAX_UPLOAD_BYTES', { infer: true }),
        files: 1,
        fields: 1,
      },
    })

    this.interceptor = new multerInterceptor()
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedHttpRequest>()
    const rawCourseId = (request.params as Record<string, unknown>).courseId
    const courseId = typeof rawCourseId === 'string' ? rawCourseId : ''

    try {
      await this.courseIdPipe.transform(courseId, {
        type: 'param',
        metatype: String,
        data: 'courseId',
      })
    } catch (error) {
      await this.materialsAuditService.recordUploadFailed({
        actor: request.user,
        courseId: null,
        unverifiedCourseId: courseId.length > 0 ? courseId : null,
        reason: 'INVALID_COURSE_ID',
        requestContext: getRequestContext(request),
      })
      throw error
    }

    let downstreamStarted = false
    const trackedNext: CallHandler = {
      handle: () => {
        downstreamStarted = true
        return next.handle()
      },
    }

    try {
      const response = await this.interceptor.intercept(context, trackedNext)

      return response.pipe(
        catchError((error: unknown) => {
          if (downstreamStarted) {
            return throwError(() => error)
          }

          return from(this.rejectBoundaryUpload(context, error))
        }),
      )
    } catch (error) {
      return from(this.rejectBoundaryUpload(context, error))
    }
  }

  private async rejectBoundaryUpload(
    context: ExecutionContext,
    error: unknown,
  ): Promise<never> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedHttpRequest>()
    const courseId = (request.params as Record<string, unknown>).courseId
    const isOversize =
      error instanceof PayloadTooLargeException ||
      getMulterErrorCode(error) === 'LIMIT_FILE_SIZE'

    await this.materialsAuditService.recordUploadFailed({
      actor: request.user,
      courseId: null,
      unverifiedCourseId: typeof courseId === 'string' ? courseId : null,
      reason: isOversize ? 'PDF_TOO_LARGE' : 'MALFORMED_MULTIPART',
      requestContext: getRequestContext(request),
    })

    if (isOversize) {
      throw pdfTooLargeException()
    }

    throw invalidMaterialsRequestException([
      {
        field: 'file',
        message: 'Multipart PDF upload is malformed',
      },
    ])
  }
}

function getMulterErrorCode(error: unknown): string | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    typeof error.code !== 'string'
  ) {
    return null
  }

  return error.code
}
