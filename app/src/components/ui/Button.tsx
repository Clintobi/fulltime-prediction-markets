// Buttons per DESIGN_BRIEF.md §7.2 — solid pills. Ink is the workhorse (Family's
// move); `accent` is reserved for the single most important commit action.
import { ArrowRight } from './Mascots'

type Variant = 'primary' | 'secondary' | 'accent' | 'primary-on-dark'
type Size = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-black shadow-card-sm hover:shadow-card',
  'primary-on-dark': 'bg-white text-ink hover:bg-white/90',
  secondary: 'bg-transparent text-ink border border-hairline hover:bg-surface hover:border-ink/20',
  accent: 'bg-accent text-accent-ink hover:bg-accent-dim',
}

const sizes: Record<Size, string> = {
  md: 'text-sm px-5 py-2.5',
  lg: 'text-[15px] px-6 py-3',
}

type CommonProps = {
  variant?: Variant
  size?: Size
  withArrow?: boolean
  className?: string
  children: React.ReactNode
}

export function Button({
  href,
  variant = 'primary',
  size = 'md',
  withArrow = false,
  className = '',
  children,
  ...rest
}: CommonProps &
  ({ href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) ) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`
  return (
    <a href={href} className={cls} {...rest}>
      {children}
      {withArrow && <ArrowRight className="w-4 h-4" />}
    </a>
  )
}

export function ButtonAction({
  onClick,
  variant = 'primary',
  size = 'md',
  withArrow = false,
  className = '',
  disabled,
  type = 'button',
  children,
}: CommonProps & {
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
      {withArrow && <ArrowRight className="w-4 h-4" />}
    </button>
  )
}
