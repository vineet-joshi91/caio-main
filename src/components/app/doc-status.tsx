import { CheckCircle2, CircleDashed, Loader2, XCircle } from 'lucide-react'
import type { Doc } from '../../../convex/_generated/dataModel'
import { cn } from '@/lib/utils'

const config: Record<
  Doc<'documents'>['status'],
  { label: string; className: string; Icon: typeof CheckCircle2; spin?: boolean }
> = {
  uploading: {
    label: 'Uploading',
    className: 'bg-muted text-muted-foreground',
    Icon: CircleDashed,
  },
  processing: {
    label: 'Processing',
    className: 'bg-primary/15 text-primary',
    Icon: Loader2,
    spin: true,
  },
  ready: {
    label: 'Ready',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    className: 'bg-destructive/15 text-destructive',
    Icon: XCircle,
  },
}

export function DocStatusBadge({
  status,
}: {
  status: Doc<'documents'>['status']
}) {
  const { label, className, Icon, spin } = config[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        className,
      )}
    >
      <Icon className={cn(spin && 'animate-spin')} size={12} />
      {label}
    </span>
  )
}
