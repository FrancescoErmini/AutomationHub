import { useQuery } from '@tanstack/react-query'

import {
  fetchApqcCategories,
  fetchApqcProcessGroups,
  fetchApqcProcesses,
} from '../../api/apqc'
import { CascadingSelect } from './CascadingSelect'
import type { StepProps } from './types'

export function Step2ProcessMapping({ value, onChange }: StepProps) {
  const categories = useQuery({
    queryKey: ['apqc', 'categories'],
    queryFn: fetchApqcCategories,
  })
  const processGroups = useQuery({
    queryKey: ['apqc', 'process-groups', value.categoryId],
    queryFn: () => fetchApqcProcessGroups(value.categoryId as number),
    enabled: value.categoryId !== undefined,
  })
  const processes = useQuery({
    queryKey: ['apqc', 'processes', value.processGroupId],
    queryFn: () => fetchApqcProcesses(value.processGroupId as number),
    enabled: value.processGroupId !== undefined,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-ink">
        Process Mapping
      </h2>
      <p className="text-sm text-slate-600">
        Map this idea to the APQC process taxonomy. Each level filters the next.
      </p>
      <CascadingSelect
        label="L1 — Category"
        options={categories.data ?? []}
        value={value.categoryId}
        onChange={(categoryId) =>
          onChange({
            categoryId,
            processGroupId: undefined,
            processId: undefined,
          })
        }
      />
      <CascadingSelect
        label="L2 — Process Group"
        options={processGroups.data ?? []}
        value={value.processGroupId}
        onChange={(processGroupId) =>
          onChange({ processGroupId, processId: undefined })
        }
        disabled={value.categoryId === undefined}
      />
      <CascadingSelect
        label="L3 — Process"
        options={processes.data ?? []}
        value={value.processId}
        onChange={(processId) => onChange({ processId })}
        disabled={value.processGroupId === undefined}
      />
    </div>
  )
}
