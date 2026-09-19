import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** primary = cyan outline, accent = amber (Ask ORBIT, AI), ghost = text only. */
  variant?: 'primary' | 'accent' | 'ghost'
  size?: 'sm' | 'md'
} & (
    | { children: ReactNode; iconOnly?: false }
    /** Icon-only buttons have no visible text, so they must have an aria-label. */
    | { children: ReactNode; iconOnly: true; 'aria-label': string }
  )

export function Button({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    iconOnly && styles.iconOnly,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={classes} {...rest} />
}
