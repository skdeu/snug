import { useRef, useState, type PointerEvent } from 'react'
import type { Tab } from '../lib/session'
import { basename } from '../lib/paths'

interface TabStripProps {
  tabs: Tab[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onMove: (id: string, toIndex: number) => void
  /** A tab was released beside or outside this strip. */
  onDetach: (id: string) => void
  onNew: () => void
}

/** Pixels the pointer must move before a press becomes a drag. */
const DRAG_START_PX = 6
/** Pixels beyond the strip, above or below, before a release counts as leaving it. */
const LEAVE_STRIP_PX = 40

interface Press {
  id: string
  pointerId: number
  startX: number
  startY: number
  moving: boolean
}

/**
 * Browser-style tabs. Dragging a tab along the strip reorders it. Releasing it away
 * from the strip calls onDetach, which decides whether it stays, joins another
 * Snug window, or becomes a new window.
 *
 * Pointer events are used rather than HTML5 drag-and-drop: Tauri's native file-drop
 * handling takes over HTML5 drags on Windows.
 */
export default function TabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
  onMove,
  onDetach,
  onNew,
}: TabStripProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const press = useRef<Press | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const onPointerDown = (event: PointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0) return
    press.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moving: false,
    }
    // Keep receiving moves and the release even when the pointer leaves the window.
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = press.current
    if (!state || event.pointerId !== state.pointerId) return
    if (!state.moving) {
      const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY)
      if (distance < DRAG_START_PX) return
      state.moving = true
      setDraggingId(state.id)
    }
    const strip = stripRef.current
    if (!strip) return
    // The new slot is the number of other tabs whose middle is left of the pointer.
    const others = [...strip.querySelectorAll<HTMLElement>('[data-tab-id]')].filter(
      (element) => element.dataset.tabId !== state.id,
    )
    const slot = others.filter((element) => {
      const rect = element.getBoundingClientRect()
      return event.clientX > rect.left + rect.width / 2
    }).length
    const current = tabs.findIndex((tab) => tab.id === state.id)
    if (current >= 0 && slot !== current) onMove(state.id, slot)
  }

  const finish = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const state = press.current
    if (!state || event.pointerId !== state.pointerId) return
    press.current = null
    setDraggingId(null)
    // A press without a drag is a click, which selects the tab (see onClick).
    if (cancelled || !state.moving) return
    const strip = stripRef.current?.getBoundingClientRect()
    const leftStrip =
      !strip ||
      event.clientY < strip.top - LEAVE_STRIP_PX ||
      event.clientY > strip.bottom + LEAVE_STRIP_PX ||
      event.clientX < 0 ||
      event.clientX > window.innerWidth
    if (leftStrip) onDetach(state.id)
  }

  return (
    <div className="snug-tabbar" ref={stripRef}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          data-tab-id={tab.id}
          className={[
            'snug-tab',
            tab.id === activeId ? 'active' : '',
            tab.id === draggingId ? 'dragging' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          title={tab.path}
          draggable={false}
          // Without this, dragging the tab's text starts a native text drag and cancels the tab drag.
          onDragStart={(event) => event.preventDefault()}
          onPointerDown={(event) => onPointerDown(event, tab.id)}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => finish(event, false)}
          onPointerCancel={(event) => finish(event, true)}
          onClick={() => onSelect(tab.id)}
          onAuxClick={(event) => {
            // Middle-click closes a tab, as in browsers.
            if (event.button !== 1) return
            event.preventDefault()
            onClose(tab.id)
          }}
        >
          <span className="snug-tab-title">
            {tab.dirty ? '● ' : ''}
            {basename(tab.path)}
          </span>
          <button
            type="button"
            className="snug-tab-close"
            aria-label={`Close ${basename(tab.path)}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onClose(tab.id)
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="snug-new-tab" onClick={onNew} title="Open another note">
        + Open note
      </button>
    </div>
  )
}
