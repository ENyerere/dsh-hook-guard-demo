import { Context } from 'cordis'
import { describe, expect, it } from 'vitest'

import { apply as guardApply, inject as guardInject, name as guardName } from '#src/index'
import {
  apply as busApply,
  inject as busInject,
  name as busName,
} from 'dsh-hooks-bus'

const busPlugin = { apply: busApply, inject: busInject, name: busName }
const guardPlugin = { apply: guardApply, inject: guardInject, name: guardName }

interface WaterfallCtx {
  waterfall: (name: string, ...args: unknown[]) => Promise<unknown>
}

const allowNext = (): { kind: string } => ({ kind: 'allow' })

async function mountGuard(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(busPlugin, {})
  await ctx.plugin(guardPlugin, undefined)
  return ctx
}

describe('dsh-hook-guard-demo (depended-on path)', () => {
  it('blocks a dangerous command through the real bus', async () => {
    const ctx = await mountGuard()
    const result = await (ctx as unknown as WaterfallCtx).waterfall(
      'tools/pre-execute',
      { callId: 'g1', name: 'pwsh', arguments: { command: 'rm -rf /tmp/x' }, agent: { id: 'sg' } },
      allowNext,
    )
    expect(result).toStrictEqual({
      kind: 'deny',
      reason: 'dangerous command blocked by dsh-hook-guard-demo: rm -rf /tmp/x',
    })
  })

  it('lets safe commands pass', async () => {
    const ctx = await mountGuard()
    const result = await (ctx as unknown as WaterfallCtx).waterfall(
      'tools/pre-execute',
      { callId: 'g2', name: 'pwsh', arguments: { command: 'ls -la' }, agent: { id: 'sg' } },
      allowNext,
    )
    expect(result).toStrictEqual({ kind: 'allow' })
  })

  it.each([
    'rm -r -f /tmp/x',
    'rm -Rf /tmp/x',
    'rm -f -r /tmp/x',
    'rm --recursive --force /tmp/x',
    String.raw`Remove-Item -Recurse -Force C:\Temp\x`,
    String.raw`Remove-Item C:\Temp\x -Recurse`,
    String.raw`rd /s /q C:\Temp\x`,
    String.raw`rmdir /s C:\Temp\x`,
  ])('blocks dangerous variant: %s', async (command) => {
    const ctx = await mountGuard()
    const result = await (ctx as unknown as WaterfallCtx).waterfall(
      'tools/pre-execute',
      { callId: 'gv', name: 'pwsh', arguments: { command }, agent: { id: 'sg' } },
      allowNext,
    )
    expect(result).toStrictEqual({
      kind: 'deny',
      reason: `dangerous command blocked by dsh-hook-guard-demo: ${command}`,
    })
  })

  it.each([
    'rm -f notes.txt', // Force but not recursive: single-file delete passes.
    'rm -r ./old-dir', // Recursive but not forced: the shell would prompt.
    'Remove-Item notes.txt', // No -Recurse.
    String.raw`rmdir C:\Temp\empty`, // Cmd rmdir without /s only removes empty dirs.
  ])('allows non-destructive lookalike: %s', async (command) => {
    const ctx = await mountGuard()
    const result = await (ctx as unknown as WaterfallCtx).waterfall(
      'tools/pre-execute',
      { callId: 'gs', name: 'pwsh', arguments: { command }, agent: { id: 'sg' } },
      allowNext,
    )
    expect(result).toStrictEqual({ kind: 'allow' })
  })

  it('registers through the declarative channel with the manifest label', async () => {
    const ctx = await mountGuard()
    const hooksBus = (ctx as unknown as {
      hooksBus: {
        state: () => { subscriptions: { source: string; label: string; event: string }[] }
      }
    }).hooksBus
    const subscriptions = hooksBus.state().subscriptions
    expect(subscriptions).toMatchObject([
      {
        source: 'declarative',
        label: 'dsh-hook-guard-demo',
        event: 'PreToolUse',
      },
    ])
  })

  it('declares the bus as a hard dependency so a missing bus is reported', () => {
    // The inject declaration turns a missing bus into a clear loader error.
    // Bare Cordis keeps the fiber inert instead of throwing.
    expect(guardInject).toStrictEqual(['hooksBus'])
  })
})
