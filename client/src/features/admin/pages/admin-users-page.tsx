import { useQuery } from '@tanstack/react-query'

import { DataTableState } from '@/components/ui/custom/data-table-state'
import { PageHeader } from '@/components/ui/custom/page-header'
import { AdminPanel } from '../components/admin-panel'
import { AdminUsersTable } from '../components/admin-users-table'
import { CreateAdminUserDialog } from '../components/create-admin-user-dialog'
import { adminUsersQueryOptions } from '../data/admin-ops.queries'

export function AdminUsersPage() {
  const usersQuery = useQuery(adminUsersQueryOptions())

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Identity Operations"
        title="User Management"
        description="Create users, review core identity fields, disable or reactivate accounts, and reset passwords."
        actions={<CreateAdminUserDialog />}
      />

      <AdminPanel>
        <DataTableState
          isLoading={usersQuery.isPending}
          isError={usersQuery.isError}
          isEmpty={usersQuery.data?.length === 0}
          onRetry={() => void usersQuery.refetch()}
          isRetrying={usersQuery.isFetching}
          emptyTitle="No users found"
          emptyDescription="Users returned by the API will appear in this table."
        >
          <AdminUsersTable users={usersQuery.data ?? []} />
        </DataTableState>
      </AdminPanel>
    </div>
  )
}
