/**
 * Declarative handler for dsh-hook-guard-demo (default export).
 *
 * Loaded by dsh-hooks-bus from the package manifest's `handler` path; receives
 * the PreToolUse event payload and returns a block decision for dangerous
 * shell commands.
 *
 * This is a demo, not a security boundary: the patterns cover the common
 * destructive forms on POSIX shells and Windows (cmd + PowerShell), but a
 * determined command can always be obfuscated past string matching.
 */

/**
 * True when the command runs `rm` with both recursive and force flags, in any
 * spelling: combined (`-rf`, `-fr`, `-Rf`), split (`-r -f`), or long options
 * (`--recursive --force`). Only the first command in a pipeline is inspected.
 */
function isRecursiveForceRm(command) {
  const match = /\brm\b([^|&;]*)/i.exec(command)
  if (match === null) {
    return false
  }
  const args = match[1]
  const short = /(?:^|\s)-([a-z]+)/gi
  let flags = ''
  for (let token = short.exec(args); token !== null; token = short.exec(args)) {
    flags += token[1].toLowerCase()
  }
  const long = /\s--([a-z-]+)/gi
  const longFlags = new Set()
  for (let token = long.exec(args); token !== null; token = long.exec(args)) {
    longFlags.add(token[1].toLowerCase())
  }
  const recursive = flags.includes('r') || longFlags.has('recursive')
  const force = flags.includes('f') || longFlags.has('force')
  return recursive && force
}

const DANGEROUS_PATTERNS = [
  // Windows native recursive delete (PowerShell + cmd).
  /\bRemove-Item\b(?=[^|&;]*\s-Recurse\b)/i,
  /\b(?:rd|rmdir)\s+\/s\b/i,
  /\bdel\s+\/[sq]/i,
  // Disk / system destruction.
  /\bformat\s+[a-z]:/i,
  /\bshutdown\s+\/(s|r)\b/i,
  /\bgit\s+push\s+.*--force\b/i,
]

export default function guard(event) {
  if (event.toolName !== 'pwsh' && event.toolName !== 'bash' && event.toolName !== 'shell') {
    return
  }
  const args = event.args
  const command =
    typeof args === 'object' && args !== null && typeof args.command === 'string'
      ? args.command
      : ''
  if (command === '') {
    return
  }
  if (isRecursiveForceRm(command) || DANGEROUS_PATTERNS.some((pattern) => pattern.test(command))) {
    return {
      action: 'block',
      reason: `dangerous command blocked by dsh-hook-guard-demo: ${command}`,
    }
  }
}
