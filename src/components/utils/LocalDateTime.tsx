'use client'

import { formatDate, formatDateLocal, formatDateTimeLocal, formatTime, formatTimeLocal } from '@/lib/utils'
import ClientOnly from './ClientOnly'

interface LocalDateTimeProps {
    dateString: string | undefined
    type?: 'date' | 'time' | 'datetime'
    showDate?: boolean
    className?: string
    options?: Intl.DateTimeFormatOptions
}

/**
 * Component that displays dates and times in the user's local timezone
 * Prevents hydration mismatches by showing UTC on server and local time on client
 */
export default function LocalDateTime({
    dateString,
    type = 'datetime',
    showDate = false,
    className,
    options
}: LocalDateTimeProps) {
    if (!dateString) return <span className={className}>Date unavailable</span>

    // Server-side fallback (UTC) - shows during SSR and until client hydrates
    const serverFallback = () => {
        switch (type) {
            case 'date':
                return formatDate(dateString, options)
            case 'time':
                return formatTime(dateString, showDate)
            case 'datetime':
            default:
                return `${formatDate(dateString)} ${formatTime(dateString)}`
        }
    }

    // Client-side content (Local timezone) - shows after hydration
    const clientContent = () => {
        switch (type) {
            case 'date':
                return formatDateLocal(dateString, options)
            case 'time':
                return formatTimeLocal(dateString, showDate)
            case 'datetime':
            default:
                return formatDateTimeLocal(dateString, options)
        }
    }

    return (
        <span className={className}>
            <ClientOnly fallback={serverFallback()}>
                {clientContent()}
            </ClientOnly>
        </span>
    )
}

// Convenience components for common use cases
export function LocalDate({ dateString, className, options }: Omit<LocalDateTimeProps, 'type'>) {
    return <LocalDateTime dateString={dateString} type="date" className={className} options={options} />
}

export function LocalTime({ dateString, showDate, className }: Omit<LocalDateTimeProps, 'type' | 'options'>) {
    return <LocalDateTime dateString={dateString} type="time" showDate={showDate} className={className} />
}

export function LocalDateTimeFull({ dateString, className, options }: Omit<LocalDateTimeProps, 'type'>) {
    return <LocalDateTime dateString={dateString} type="datetime" className={className} options={options} />
} 