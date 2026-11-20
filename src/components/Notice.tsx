// Copyright 2026 Sanjaykumar Sagadevan Vijayakumar
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
