import { Injectable } from '@nestjs/common'

import {
  invalidTopicStateRequestException,
  staleTopicStateVersionException,
  topicStateNotFoundException,
  topicStateTopicNotFoundException,
} from './topic-state.errors'
import { TopicStateRepository } from './topic-state.repository'
import type { TopicStatePatch, TopicStateSnapshot } from './topic-state.types'

@Injectable()
export class TopicStateService {
  constructor(private readonly topicStateRepository: TopicStateRepository) {}

  async getOrCreate(topicId: string): Promise<TopicStateSnapshot> {
    await this.assertTopicExists(topicId)

    const existing = await this.topicStateRepository.findByTopicId(topicId)

    if (existing !== null) {
      return existing
    }

    const created = await this.topicStateRepository.createForTopic(topicId)

    if (created !== null) {
      return created
    }

    const winner = await this.topicStateRepository.findByTopicId(topicId)

    if (winner !== null) {
      return winner
    }

    throw topicStateNotFoundException()
  }

  async applyTransition(
    topicId: string,
    expectedVersion: number,
    patch: TopicStatePatch,
  ): Promise<TopicStateSnapshot> {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      throw invalidTopicStateRequestException()
    }
    if (Object.keys(patch).length === 0) {
      throw invalidTopicStateRequestException()
    }

    const updated = await this.topicStateRepository.applyVersionedPatch({
      topicId,
      expectedVersion,
      patch,
    })

    if (updated !== null) {
      return updated
    }

    const existingState = await this.topicStateRepository.findByTopicId(topicId)

    if (existingState !== null) {
      throw staleTopicStateVersionException()
    }

    await this.assertTopicExists(topicId)
    throw topicStateNotFoundException()
  }

  private async assertTopicExists(topicId: string): Promise<void> {
    if (!(await this.topicStateRepository.topicExists(topicId))) {
      throw topicStateTopicNotFoundException()
    }
  }
}
