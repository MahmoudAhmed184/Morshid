import { EventEmitter } from 'node:events'

import {
  assertRequestBudget,
  createRequestBudget,
  RequestBudgetExceededError,
} from './request-deadline'

describe('request deadline', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('aborts at the configured deadline', () => {
    jest.useFakeTimers()

    const budget = createRequestBudget(1_000)

    jest.advanceTimersByTime(1_000)

    expect(budget.signal.aborted).toBe(true)
    expect(() => {
      assertRequestBudget(budget)
    }).toThrow(RequestBudgetExceededError)
    budget.dispose()
  })

  it('aborts when the request disconnects before completion', () => {
    const request = new EventEmitter() as EventEmitter & {
      complete?: boolean
    }
    request.complete = false
    const budget = createRequestBudget(1_000, { request })

    request.emit('aborted')

    expect(budget.signal.aborted).toBe(true)
    budget.dispose()
  })

  it('does not abort after the response has finished', () => {
    const response = new EventEmitter()
    const budget = createRequestBudget(1_000, { response })

    response.emit('finish')
    response.emit('close')

    expect(budget.signal.aborted).toBe(false)
    budget.dispose()
  })

  it('removes lifecycle listeners when disposed', () => {
    const request = new EventEmitter() as EventEmitter & {
      complete?: boolean
    }
    request.complete = false
    const budget = createRequestBudget(1_000, { request })

    budget.dispose()
    request.emit('aborted')

    expect(budget.signal.aborted).toBe(false)
  })
})
