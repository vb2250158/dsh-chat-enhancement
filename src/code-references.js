/** Parse explicit local-file Markdown destinations; plain prose never guesses a file. */
export function parseCodeReference(value) {
  if (typeof value !== 'string') return null
  const match = /^(.*)#L([1-9]\d*)(?:-L?([1-9]\d*))?$/u.exec(value)
  if (!match) return null
  let path
  try { path = decodeURIComponent(match[1]).replaceAll('\\', '/') } catch { return null }
  if (!path || /[\u0000-\u001f\u007f]/u.test(path) || path.startsWith('//')) return null
  if (/^[a-z][a-z\d+.-]*:/iu.test(path) && !/^[a-z]:\//iu.test(path)) return null
  const startLine = Number(match[2])
  const endLine = Number(match[3] ?? match[2])
  if (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) || endLine < startLine) return null
  return { path, startLine, endLine }
}

/** Encode the documented session-file resource grammar without resolving files in the browser. */
export function codeReferenceAddress(sessionId, path) {
  const encode = segment => encodeURIComponent(segment).replace(/%3A/giu, ':')
  return `dsh-resource://file/session/${encode(sessionId)}/${path.replaceAll('\\', '/').replace(/^(?:\.\/)+/u, '').split('/').map(encode).join('/')}`
}

/** A transient navigation intent, separate from durable file contents and session history. */
export function createCodeReferenceNavigation(sidebarRight) {
  let snapshot = null
  let revision = 0
  const listeners = new Set()
  return {
    parse: parseCodeReference,
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    open(sessionId, destination) {
      const reference = parseCodeReference(destination)
      if (!reference) return false
      const address = codeReferenceAddress(sessionId, reference.path)
      snapshot = { ...reference, address, revision: ++revision }
      sidebarRight.openResourceIn(sessionId, address, { kind: 'text', params: { line: reference.endLine } })
      for (const listener of listeners) listener()
      return true
    },
    dispose() { snapshot = null; listeners.clear() },
  }
}
