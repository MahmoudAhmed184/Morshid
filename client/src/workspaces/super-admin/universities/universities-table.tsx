import {
  BookOpen,
  Edit2,
  Eye,
  GraduationCap,
  MoreHorizontal,
  Presentation,
  ShieldAlert,
} from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import type { UniversityItem } from '@/features/universities/universities.schema'
import { EditUniversityDialog } from './edit-university-dialog'
import { UniversityDetailsDialog } from './university-details-dialog'
import { UpdateUniversityStatusDialog } from './update-university-status-dialog'

type UniversitiesTableProps = {
  universities: UniversityItem[]
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
  const [detailsUniversity, setDetailsUniversity] =
    useState<UniversityItem | null>(null)
  const [editingUniversity, setEditingUniversity] =
    useState<UniversityItem | null>(null)
  const [statusUniversity, setStatusUniversity] =
    useState<UniversityItem | null>(null)

  return (
    <>
      <div className="rounded-xl border bg-card text-card-foreground shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[280px]">University</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[260px]">Primary Owner</TableHead>
              <TableHead className="w-[220px]">Tenancy Scope</TableHead>
              <TableHead className="w-[140px]">Created</TableHead>
              <TableHead className="w-[60px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {universities.map((uni) => (
              <TableRow key={uni.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {uni.name}
                    </span>
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
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground">
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
                      <span className="text-xs text-muted-foreground">
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
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span
                      className="inline-flex items-center gap-1"
                      title={`${uni.studentsCount} students`}
                    >
                      <GraduationCap className="size-3.5 text-primary/70" />
                      <span className="font-medium text-foreground">
                        {uni.studentsCount}
                      </span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1"
                      title={`${uni.instructorsCount} instructors`}
                    >
                      <Presentation className="size-3.5 text-primary/70" />
                      <span className="font-medium text-foreground">
                        {uni.instructorsCount}
                      </span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1"
                      title={`${uni.coursesCount} courses`}
                    >
                      <BookOpen className="size-3.5 text-primary/70" />
                      <span className="font-medium text-foreground">
                        {uni.coursesCount}
                      </span>
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
                        onClick={() => setDetailsUniversity(uni)}
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
                      <DropdownMenuItem
                        onClick={() => setStatusUniversity(uni)}
                      >
                        <ShieldAlert className="size-4" aria-hidden />
                        Change Status
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <UniversityDetailsDialog
        university={detailsUniversity}
        open={Boolean(detailsUniversity)}
        onOpenChange={(open) => {
          if (!open) setDetailsUniversity(null)
        }}
        onEdit={(uni) => setEditingUniversity(uni)}
        onChangeStatus={(uni) => setStatusUniversity(uni)}
      />

      <EditUniversityDialog
        university={editingUniversity}
        open={Boolean(editingUniversity)}
        onOpenChange={(open) => {
          if (!open) setEditingUniversity(null)
        }}
      />

      <UpdateUniversityStatusDialog
        university={statusUniversity}
        open={Boolean(statusUniversity)}
        onOpenChange={(open) => {
          if (!open) setStatusUniversity(null)
        }}
      />
    </>
  )
}
