/**
 * The standalone consumer that validates the "depended-on" path of
 * dsh-hooks-bus.
 *
 * It declares a hard dependency (`inject: ['hooksBus']`) and loads its
 * subscriptions from its own `package.json` `hooksBus` block through the
 * declarative channel: the handler module path resolves against this package
 * root, and the bus imports it. In a composed profile a missing bus produces
 * a clear loader error instead of a silent no-op.
 *
 * @module dsh-hook-guard-demo
 */

import { readFileSync } from 'node:fs'
import type { Context } from 'cordis'
import type { DeclarativeEntry } from 'dsh-hooks-bus'

/** Cordis plugin name; keep stable after publishing. */
export const name = 'dsh-hook-guard-demo'

/** The bus must be composed; the loader reports a clear error when missing. */
export const inject = ['hooksBus']

interface ManifestLike {
  hooksBus?: {
    subscriptions?: unknown
  }
}

/**
 * Apply the guard: read the declarative manifest and register it with the bus.
 */
export async function apply(ctx: Context): Promise<void> {
  const packageUrl = new URL('../package.json', import.meta.url)
  const manifest = JSON.parse(readFileSync(packageUrl, 'utf8')) as ManifestLike
  const subscriptions = manifest.hooksBus?.subscriptions
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    throw new Error(
      'dsh-hook-guard-demo: package.json hooksBus.subscriptions is missing or empty',
    )
  }
  const dispose = await ctx.hooksBus.declare(
    subscriptions as DeclarativeEntry[],
    { baseUrl: new URL('../', import.meta.url).href },
  )
  ctx.effect(() => dispose)
}
