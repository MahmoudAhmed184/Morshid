import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createUniversity,
  updateUniversity,
  updateUniversityStatus,
} from '@/features/universities/universities.api'
import type {
  CreateUniversityInput,
  ListUniversitiesInput,
  UpdateUniversityInput,
} from '@/features/universities/universities.api'
import type { UniversityStatus } from '@/features/universities/universities.schema'
import {
  universitiesQueryKeys,
  universitiesQueryOptions,
  universityDetailQueryOptions,
} from '@/features/universities/universities.queries'

export function useUniversities(
  query: ListUniversitiesInput = {},
  enabled = true,
) {
  return useQuery({
    ...universitiesQueryOptions(query),
    enabled,
  })
}

export function useUniversityDetail(universityId: string, enabled = true) {
  return useQuery({
    ...universityDetailQueryOptions(universityId),
    enabled: Boolean(universityId) && enabled,
  })
}

export function useUniversityMutations() {
  const queryClient = useQueryClient()

  const invalidateUniversities = () =>
    queryClient.invalidateQueries({
      queryKey: universitiesQueryKeys.all,
    })

  const create = useMutation({
    mutationFn: (input: CreateUniversityInput) => createUniversity(input),
    onSuccess: invalidateUniversities,
  })

  const update = useMutation({
    mutationFn: ({
      universityId,
      input,
    }: {
      universityId: string
      input: UpdateUniversityInput
    }) => updateUniversity(universityId, input),
    onSuccess: invalidateUniversities,
  })

  const updateStatus = useMutation({
    mutationFn: ({
      universityId,
      status,
    }: {
      universityId: string
      status: UniversityStatus
    }) => updateUniversityStatus(universityId, status),
    onSuccess: invalidateUniversities,
  })

  return {
    createUniversity: create,
    updateUniversity: update,
    updateUniversityStatus: updateStatus,
  }
}
