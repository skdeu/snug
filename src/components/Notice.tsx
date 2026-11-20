import Icon from './Icon'

interface NoticeProps {
  kind: 'error' | 'info'
  message: string
  /** Without this, the notice has no dismiss button. */
  onDismiss?: () => void
}

/**
 * A message above the note. Errors use the error colour, information uses the accent.
 * Clicking the card or its × dismisses it.
 */
export default function Notice({ kind, message, onDismiss }: NoticeProps) {
  return (
    <div
      className={kind === 'error' ? 'snug-notice snug-error' : 'snug-notice snug-notice-info'}
      role={kind === 'error' ? 'alert' : 'status'}
      onClick={onDismiss}
    >
      <Icon name="info" size={16} />
      <span className="snug-notice-text">{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="snug-notice-close"
          aria-label="Dismiss"
          onClick={(event) => {
            // The × is inside the card, so stop the card's click from firing a second dismiss.
            event.stopPropagation()
            onDismiss()
          }}
        >
          <Icon name="close" size={12} />
        </button>
      )}
    </div>
  )
}
