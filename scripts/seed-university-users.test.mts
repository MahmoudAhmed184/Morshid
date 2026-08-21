import assert from 'node:assert/strict'
import test from 'node:test'

import { SEEDED_50_USERS } from './seed-university-users.mts'

void test('SEEDED_50_USERS contains exactly 50 user specifications', () => {
  assert.equal(SEEDED_50_USERS.length, 50)
})

void test('SEEDED_50_USERS has unique emails and valid roles', () => {
  const emails = new Set<string>()
  let instructorCount = 0
  let studentCount = 0

  for (const user of SEEDED_50_USERS) {
    assert.match(user.email, /^demo\.(student|instructor)\d{2}@morshid\.demo$/)
    assert.ok(user.displayName.trim().length > 0)
    assert.ok(user.role === 'STUDENT' || user.role === 'INSTRUCTOR')

    if (user.role === 'INSTRUCTOR') {
      instructorCount += 1
    } else {
      studentCount += 1
    }

    assert.equal(emails.has(user.email), false, `Duplicate email: ${user.email}`)
    emails.add(user.email)
  }

  assert.equal(instructorCount, 5)
  assert.equal(studentCount, 45)
})
