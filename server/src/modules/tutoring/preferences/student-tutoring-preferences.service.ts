import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../../platform/database/prisma.service'
import {
  ExplanationDetailLevel,
  normalizeExplanationDetailLevel,
} from './explanation-detail-level'
import type { UpdateStudentTutoringPreferencesRequest } from './student-tutoring-preferences.dto'

export interface StudentTutoringPreferencesRecord {
  readonly explanationDetailLevel: ExplanationDetailLevel
}

@Injectable()
export class StudentTutoringPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(
    studentId: string,
  ): Promise<StudentTutoringPreferencesRecord> {
    const record = await this.prisma.studentTutoringPreference.findUnique({
      where: { studentId },
      select: { explanationDetailLevel: true },
    })

    return {
      explanationDetailLevel: normalizeExplanationDetailLevel(
        record?.explanationDetailLevel,
      ),
    }
  }

  async updatePreferences(
    studentId: string,
    input: UpdateStudentTutoringPreferencesRequest,
  ): Promise<StudentTutoringPreferencesRecord> {
    const validatedLevel = normalizeExplanationDetailLevel(
      input.explanationDetailLevel,
    )

    const record = await this.prisma.studentTutoringPreference.upsert({
      where: { studentId },
      create: {
        studentId,
        explanationDetailLevel: validatedLevel,
      },
      update: {
        explanationDetailLevel: validatedLevel,
      },
      select: { explanationDetailLevel: true },
    })

    return {
      explanationDetailLevel: normalizeExplanationDetailLevel(
        record.explanationDetailLevel,
      ),
    }
  }
}
