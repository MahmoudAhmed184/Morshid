import { Link, useNavigate } from '@tanstack/react-router'
import {
  Check,
  Clock,
  Edit2,
  Eye,
  GraduationCap,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/custom/status-badge/status-badge'
import type {
  UniversityItem,
  UniversityStatus,
} from '@/features/universities/universities.schema'
import { EditUniversityDialog } from './edit-university-dialog'
import { useUniversityMutations } from './use-universities'

type UniversitiesTableProps = {
  universities: UniversityItem[]
}

type PendingStatusChange = {
  university: UniversityItem
  status: UniversityStatus
}

function formatDate(isoString: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

export function UniversitiesTable({ universities }: UniversitiesTableProps) {
  const navigate = useNavigate()
  const [editingUniversity, setEditingUniversity] =
    useState<UniversityItem | null>(null)
  const [pendingStatusChange, setPendingStatusChange] =
    useState<PendingStatusChange | null>(null)
  const { updateUniversityStatus } = useUniversityMutations()

  const selectStatus = (
    university: UniversityItem,
    status: UniversityStatus,
  ) => {
    if (university.status !== status) {
      setPendingStatusChange({ university, status })
    }
  }

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return

    await updateUniversityStatus.mutateAsync({
      universityId: pendingStatusChange.university.id,
      status: pendingStatusChange.status,
    })
  }

  return (
    <>
      <div className="rounded-xl border bg-card text-card-foreground shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[280px]">University</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[260px]">Primary Owner</TableHead>
              <TableHead className="w-[140px]">Students</TableHead>
              <TableHead className="w-[140px]">Created</TableHead>
              <TableHead className="w-[60px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {universities.map((uni) => (
              <TableRow key={uni.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/super-admin/universities/$universityId"
                      params={{ universityId: uni.id }}
                      className="font-semibold text-foreground hover:text-primary hover:underline text-left cursor-pointer transition-colors"
                    >
                      {uni.name}
                    </Link>
                    <Badge variant="outline" className="font-mono text-xs">
                      {uni.code}
                    </Badge>
                  </div>
                </TableCell>

                <TableCell>
                  <StatusBadge status={uni.status} />
                </TableCell>

                <TableCell>
                  {uni.owner ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground leading-tight">
                          {uni.owner.displayName}
                        </span>
                        {uni.owner.status === 'DISABLED' ? (
                          <Badge
                            variant="destructive"
                            className="text-[0.65rem] px-1 py-0"
                          >
                            Disabled
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground leading-tight">
                        {uni.owner.email}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">
                      No owner assigned
                    </span>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <GraduationCap className="size-3.5 text-primary/70" />
                    <span className="font-medium text-foreground">
                      {uni.studentsCount}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(uni.createdAt)}
                </TableCell>

                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Actions for ${uni.name}`}
                        />
                      }
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onClick={() => {
                          void navigate({
                            to: '/super-admin/universities/$universityId',
                            params: { universityId: uni.id },
                          })
                        }}
                      >
                        <Eye className="size-4" aria-hidden />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditingUniversity(uni)}
                      >
                        <Edit2 className="size-4" aria-hidden />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Change status</DropdownMenuLabel>
                        <DropdownMenuItem
                          disabled={uni.status === 'ACTIVE'}
                          onClick={() => selectStatus(uni, 'ACTIVE')}
                        >
                          <ShieldCheck
                            className="size-4 text-emerald-500"
                            aria-hidden
                          />
                          Active
                          {uni.status === 'ACTIVE' ? (
                            <Check className="ml-auto size-3.5" aria-hidden />
                          ) : null}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={uni.status === 'INACTIVE'}
                          onClick={() => selectStatus(uni, 'INACTIVE')}
                        >
                          <Clock
                            className="size-4 text-amber-500"
                            aria-hidden
                          />
                          Inactive
                          {uni.status === 'INACTIVE' ? (
                            <Check className="ml-auto size-3.5" aria-hidden />
                          ) : null}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={uni.status === 'SUSPENDED'}
                          onClick={() => selectStatus(uni, 'SUSPENDED')}
                        >
                          <ShieldAlert className="size-4" aria-hidden />
                          Suspended
                          {uni.status === 'SUSPENDED' ? (
                            <Check className="ml-auto size-3.5" aria-hidden />
                          ) : null}
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditUniversityDialog
        university={editingUniversity}
        open={Boolean(editingUniversity)}
        onOpenChange={(open) => {
          if (!open) setEditingUniversity(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingStatusChange)}
        onOpenChange={(open) => {
          if (!open) setPendingStatusChange(null)
        }}
        title={`Change status to ${pendingStatusChange?.status.toLowerCase()}?`}
        description={
          pendingStatusChange?.status === 'SUSPENDED'
            ? `Suspend "${pendingStatusChange.university.name}"? All tenant users will immediately lose access.`
            : pendingStatusChange
              ? `Change "${pendingStatusChange.university.name}" from ${pendingStatusChange.university.status.toLowerCase()} to ${pendingStatusChange.status.toLowerCase()}?`
              : undefined
        }
        confirmLabel={`Set to ${pendingStatusChange?.status.toLowerCase()}`}
        destructive={pendingStatusChange?.status === 'SUSPENDED'}
        disabled={updateUniversityStatus.isPending}
        onConfirm={confirmStatusChange}
      />
    </>
  )
}
