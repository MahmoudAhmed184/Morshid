import type { AdminUserFormValues } from '../schemas/admin-user.schema'

export async function submitAdminUserForm(_values: AdminUserFormValues) {
  await new Promise((resolve) => window.setTimeout(resolve, 600))
}
