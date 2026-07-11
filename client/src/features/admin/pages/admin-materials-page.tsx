import { useQuery } from '@tanstack/react-query'
import { UploadCloudIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AdminPanel } from '../components/admin-panel'
import { PageHeader } from '@/components/ui/custom/page-header'
import { AdminStatusBadge } from '../components/admin-status-badge'
import { adminMaterialsQueryOptions } from '../data/admin-ops.queries'

export function AdminMaterialsPage() {
  const materialsQuery = useQuery(adminMaterialsQueryOptions())

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Content Operations"
        title="Material Metadata"
        description="Review material titles, owners, asset type, course association, and publication state."
        actions={
          <Button>
            <UploadCloudIcon />
            Add Material
          </Button>
        }
      />

      <AdminPanel>
        <DataTableState
          isLoading={materialsQuery.isPending}
          isError={materialsQuery.isError}
          isEmpty={materialsQuery.data?.length === 0}
          emptyTitle="No materials found"
          emptyDescription="Material metadata returned by the API will appear here."
        >
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {[
                  'Material',
                  'Course',
                  'Type',
                  'Status',
                  'Owner',
                  'Updated',
                ].map((header) => (
                  <TableHead
                    key={header}
                    className="h-14 px-6 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase"
                  >
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialsQuery.data?.map((material) => (
                <TableRow
                  key={material.id}
                  className="border-border hover:bg-muted/40"
                >
                  <TableCell className="px-6 py-5">
                    <p className="font-medium text-foreground">
                      {material.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {material.id}
                    </p>
                  </TableCell>
                  <TableCell className="px-6 py-5">{material.course}</TableCell>
                  <TableCell className="px-6 py-5">{material.type}</TableCell>
                  <TableCell className="px-6 py-5">
                    <AdminStatusBadge status={material.status} />
                  </TableCell>
                  <TableCell className="px-6 py-5">{material.owner}</TableCell>
                  <TableCell className="px-6 py-5">
                    {material.updatedAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableState>
      </AdminPanel>
    </div>
  )
}
