import type { Decision } from '../types'

export const DEFAULT_KEYWORDS = [
  'we decided',
  'decided to',
  'decision:',
  'agreed to',
  'going with',
  '裁定',
  'に決めました',
  'と決めました',
  'に決定',
  'を採用します',
  'を採用しました',
]
export const DEFAULT_RECORD_PATH = 'docs/decisions/'
export const DEFAULT_MAX_ITEMS = 20
export const MAX_TEXT = 80

const QUESTION_TAILS = ['？', '?', 'ますか', 'でしょうか']
const RECORD_TOOLS = ['Edit', 'Write', 'MultiEdit']

/** The settings the hooks read, normalized from the manifest's `options`. */
export type Settings = { keywords: string[]; recordPath: string; maxItems: number }

/** A `multiple` string field may arrive as an array or as one string; keep only non-empty strings. */
export function toStringList(value: unknown): string[] {
  return ([] as unknown[]).concat(value as never).filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

export function readSettings(options: Readonly<Record<string, unknown>>): Settings {
  const keywords = toStringList(options.keywords)
  const recordPath = typeof options.record_path === 'string' && options.record_path !== '' ? options.record_path : DEFAULT_RECORD_PATH
  const maxItems = typeof options.max_items === 'number' && options.max_items >= 1 ? Math.floor(options.max_items) : DEFAULT_MAX_ITEMS

  return { keywords: keywords.length > 0 ? keywords : DEFAULT_KEYWORDS, recordPath, maxItems }
}

/** Remove fenced blocks first (so a backtick inside one is not left over), then inline code. */
export function stripCode(text: string): string {
  return text.replace(/```[\s\S]*?(```|$)/g, ' ').replace(/`[^`\n]*`/g, ' ')
}

/** Count characters by code point so an emoji does not shift the cut by one. */
export function clip(text: string, max: number = MAX_TEXT): string {
  const chars = Array.from(text)

  return chars.length > max ? `${chars.slice(0, max - 3).join('')}…` : text
}

function isQuestion(sentence: string): boolean {
  const body = sentence.replace(/[.。\s]+$/, '')

  return QUESTION_TAILS.some(tail => body.endsWith(tail))
}

/** Split on `。`, on `.` followed by whitespace or the end (so `v1.2` stays whole), and on line breaks. */
function splitSentences(text: string): string[] {
  return text.split(/(?<=。)|(?<=\.)(?=\s|$)|\n/)
}

/** Pick the sentences that state a decision, each cut to 80 characters, without duplicates. */
export function extractDecisions(answer: string, keywords: readonly string[] = DEFAULT_KEYWORDS): string[] {
  const found: string[] = []
  const needles = keywords.map(word => word.toLowerCase())

  for (const raw of splitSentences(stripCode(answer))) {
    const sentence = raw.trim()

    // Skip blank lines and lines of punctuation only (rules, a bare "- " bullet).
    if (sentence === '' || !/[\p{L}\p{N}]/u.test(sentence)) {
      continue
    }

    const lower = sentence.toLowerCase()

    if (!needles.some(word => lower.includes(word)) || isQuestion(sentence)) {
      continue
    }

    const text = clip(sentence)

    if (!found.includes(text)) {
      found.push(text)
    }
  }

  return found
}

/** Append to the list (same text is not added twice; the oldest are dropped past `maxItems`). */
export function addDecisions(list: readonly Decision[], texts: readonly string[], at: number, maxItems: number = DEFAULT_MAX_ITEMS): Decision[] {
  const next = [...list]

  for (const text of texts) {
    if (!next.some(item => item.text === text)) {
      next.push({ text, at })
    }
  }

  return next.slice(Math.max(0, next.length - maxItems))
}

/** Is this tool call a write to the decision log? */
export function isRecordWrite(tool: string, filePath: unknown, recordPath: string = DEFAULT_RECORD_PATH): boolean {
  return RECORD_TOOLS.includes(tool) && typeof filePath === 'string' && filePath.includes(recordPath)
}

/** The band's one line; '' when there is nothing to show. */
export function formatBand(list: readonly Decision[]): string {
  if (list.length === 0) {
    return ''
  }

  const heads = list.slice(0, 2).map(item => Array.from(item.text).slice(0, 40).join(''))
  const rest = list.length > 2 ? ` … (+${list.length - 2} more)` : ''

  return `📝 Unrecorded decisions (${list.length}): ${heads.join(' / ')}${rest}`
}

export type DecisionCommand = { kind: 'list' } | { kind: 'clear' } | { kind: 'done'; index: number } | { kind: 'invalid' }

export function parseDecisionArgs(args: string): DecisionCommand {
  const words = args.trim().split(/\s+/).filter(word => word !== '')

  if (words.length === 0) {
    return { kind: 'list' }
  }

  if (words[0] === 'clear' && words.length === 1) {
    return { kind: 'clear' }
  }

  if (words[0] === 'done' && words.length === 2 && /^\d+$/.test(words[1] ?? '')) {
    return { kind: 'done', index: Number(words[1]) }
  }

  return { kind: 'invalid' }
}

export const USAGE = 'Usage: /decisions (list) | /decisions clear (remove all) | /decisions done <n> (remove one)'
export const EMPTY_MESSAGE = 'No unrecorded decisions.'

/** The numbered list for /decisions (1-based, the same numbers `done` takes). */
export function formatList(list: readonly Decision[], recordPath: string = DEFAULT_RECORD_PATH): string {
  if (list.length === 0) {
    return EMPTY_MESSAGE
  }

  return [`Unrecorded decisions (${list.length}) — cleared when ${recordPath} is written`, ...list.map((item, i) => `${i + 1}. ${item.text}`)].join('\n')
}
