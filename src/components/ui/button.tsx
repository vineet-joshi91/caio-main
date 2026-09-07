import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'default' | 'sm'
}

export function Button({
  className,
  size = 'default',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        size === 'default' && 'h-10 px-4 py-2',
        size === 'sm' && 'h-8 px-3 text-xs',
        variant === 'primary' &&
          'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'secondary' &&
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        variant === 'ghost' &&
          'hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      {...props}
    />
  )
}
