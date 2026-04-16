export const ROOM_AMBERS_CHANGED_EVENT = 'mia:ambers-changed'

export function notifyAmbersChanged() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(ROOM_AMBERS_CHANGED_EVENT))
}

export function subscribeToAmbersChanged(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const handler = () => callback()
  window.addEventListener(ROOM_AMBERS_CHANGED_EVENT, handler)

  return () => {
    window.removeEventListener(ROOM_AMBERS_CHANGED_EVENT, handler)
  }
}
