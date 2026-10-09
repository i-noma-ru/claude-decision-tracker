import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import type { Decision } from '../types'
import { addDecisions, EMPTY_MESSAGE, extractDecisions, formatBand, parseDecisionArgs } from '../hooks/logic'

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const
const TURN = { durationMs: 0, isAborted: false, turnId: 't1', reason: 'answer' } as const
const DEFAULT_LOG = '/home/me/project/docs/decisions/x.md'
const OTHER_FILE = '/home/me/project/src/app.ts'
const CUSTOM_LOG = '/home/me/project/notes/log.md'

async function listed($: Engine): Promise<string> {
  return (await $.command.run({ ...RUN, command: 'decisions', args: '' })).text ?? ''
}

// 1. An English decision sentence is kept (defaults)
test('keeps an English decision sentence', () => {
  expect(extractDecisions('We decided to use pnpm.')).toEqual(['We decided to use pnpm.'])
})

// 2. A Japanese decision sentence is kept (defaults)
test('keeps a Japanese decision sentence', () => {
  expect(extractDecisions('P1 は既定値のままと裁定しました。')).toEqual(['P1 は既定値のままと裁定しました。'])
})

// 3. Questions are not kept (negative)
test('does not keep a question', () => {
  expect(extractDecisions('Which one should we pick?')).toEqual([])
  expect(extractDecisions('Have we decided to ship?')).toEqual([])
  expect(extractDecisions('どちらに決めますか。')).toEqual([])
})

// Negative: code blocks and inline code are ignored; the match ignores case; `v1.2` is not split
test('ignores code, matches case-insensitively, keeps dotted versions whole', () => {
  expect(extractDecisions('Run this.\n```\necho "we decided"\n```\n`decision:` is a word.')).toEqual([])
  expect(extractDecisions('WE DECIDED to pin v1.2 of the linter. Next step is unrelated.')).toEqual(['WE DECIDED to pin v1.2 of the linter.'])
})

// Duplicates collapse to one; the list honours maxItems
test('collapses duplicates and caps the list', () => {
  const found = extractDecisions('Going with option A.\nGoing with option A.')

  expect(found).toEqual(['Going with option A.'])
  expect(addDecisions([{ text: 'Going with option A.', at: 1 }], found, 2)).toHaveLength(1)
  expect(addDecisions([{ text: 'one', at: 1 }, { text: 'two', at: 2 }], ['three'], 3, 2).map(item => item.text)).toEqual(['two', 'three'])
})

// A sentence over 80 characters is cut to 77 + …
test('cuts a long sentence to 77 characters and an ellipsis', () => {
  const long = `${'a'.repeat(76)} agreed to it.`
  const [text] = extractDecisions(long)

  expect(Array.from(long).length).toBe(90)
  expect(text).toBe(`${'a'.repeat(76)} …`)
  expect(Array.from(text ?? '').length).toBe(78)
})

// turn.complete fills the list (a subagent's answer does not); observed through /decisions
test('turn.complete adds a decision to the list', async ($, on) => {
  mock.clock(on)
  on('turn.complete', () => ({ text: '' }))

  expect(await listed($)).toBe(EMPTY_MESSAGE)

  await $.turn.complete({ ...TURN, answer: 'We decided to use pnpm.' })
  await $.turn.complete({ ...TURN, answer: 'Agreed to drop yarn.', agentId: 'agent-1' })

  const shown = await listed($)

  expect(shown.startsWith('Unrecorded decisions (1) — cleared when ')).toBe(true)
  expect(shown.endsWith('\n1. We decided to use pnpm.')).toBe(true)
})

// 4. Non-default keywords: 'verdict:' is kept, 'we decided' is not
test('custom keywords replace the defaults', { options: { keywords: ['verdict:'] } }, async ($, on) => {
  mock.clock(on)
  on('turn.complete', () => ({ text: '' }))

  await $.turn.complete({ ...TURN, answer: 'We decided to use pnpm.' })

  expect(await listed($)).toBe(EMPTY_MESSAGE)

  await $.turn.complete({ ...TURN, answer: 'verdict: keep it' })

  expect(await listed($)).toContain('1. verdict: keep it')
})

// Default record_path: a Write to the decision log clears, a Write elsewhere does not
test('a write to the default log clears the list; another file does not', async ($, on) => {
  mock.clock(on)
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ result: {} }))

  await $.turn.complete({ ...TURN, answer: 'Decision: ship on Friday.' })
  await $.tool.call({ tool: 'Write', file_path: OTHER_FILE, content: 'x' })

  expect(await listed($)).toContain('1. Decision: ship on Friday.')

  await $.tool.call({ tool: 'Write', file_path: DEFAULT_LOG, content: 'x' })

  expect(await listed($)).toBe(EMPTY_MESSAGE)
})

// 5. Non-default record_path: notes/log.md clears, the default log path does not
test('custom record_path decides which write clears', { options: { record_path: 'notes/log.md' } }, async ($, on) => {
  mock.clock(on)
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ result: {} }))

  await $.turn.complete({ ...TURN, answer: 'We agreed to rename the module.' })
  await $.tool.call({ tool: 'Write', file_path: DEFAULT_LOG, content: 'x' })

  expect(await listed($)).toContain('1. We agreed to rename the module.')

  await $.tool.call({ tool: 'Write', file_path: CUSTOM_LOG, content: 'x' })

  expect(await listed($)).toBe(EMPTY_MESSAGE)
})

// 6. /decisions clear answers { text } and empties the list
test('/decisions clear empties the list', async ($, on) => {
  mock.clock(on)
  on('turn.complete', () => ({ text: '' }))

  await $.turn.complete({ ...TURN, answer: 'Going with the monorepo.' })

  const done = await $.command.run({ ...RUN, command: 'decisions', args: 'clear' })

  expect(done.text).toBe('Cleared all unrecorded decisions.')
  expect(await listed($)).toBe(EMPTY_MESSAGE)
})

// 7. Band text (pure): two heads of 40 characters, then (+k more); argument parsing
test('band shows two heads of 40 characters and a (+k more) tail', () => {
  const list: Decision[] = [
    { text: `${'x'.repeat(50)}.`, at: 1 },
    { text: 'Going with B.', at: 2 },
    { text: 'Going with C.', at: 3 },
  ]

  expect(formatBand([])).toBe('')
  expect(formatBand(list.slice(0, 1))).toBe(`📝 Unrecorded decisions (1): ${'x'.repeat(40)}`)
  expect(formatBand(list)).toBe(`📝 Unrecorded decisions (3): ${'x'.repeat(40)} / Going with B. … (+1 more)`)
  expect(parseDecisionArgs('')).toEqual({ kind: 'list' })
  expect(parseDecisionArgs('done 2')).toEqual({ kind: 'done', index: 2 })
  expect(parseDecisionArgs('foo')).toEqual({ kind: 'invalid' })
})
