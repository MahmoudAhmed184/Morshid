import {
  adminAuditEvents,
  adminCourses,
  adminMaterials,
  adminUsers,
} from './admin-ops.fixtures'

const REQUEST_DELAY_MS = 120

async function resolveAdminData<T>(data: T): Promise<T> {
  await new Promise((resolve) => window.setTimeout(resolve, REQUEST_DELAY_MS))
  return structuredClone(data)
}

export function getAdminUsers() {
  return resolveAdminData(adminUsers)
}

export function getAdminCourses() {
  return resolveAdminData(adminCourses)
}

export function getAdminMaterials() {
  return resolveAdminData(adminMaterials)
}

export function getAdminAuditEvents() {
  return resolveAdminData(adminAuditEvents)
}
