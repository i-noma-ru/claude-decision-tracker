import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Decision } from '../types'
import { addDecisions, extractDecisions, formatBand, formatList, isRecordWrite, parseDecisionArgs, readSettings, USAGE } from './logic'

// The band reads from $.state, not a module variable: it survives a hot reload, and a write redraws only the band that read it.
const decisions = atom({ plugin: 'decision-tracker', key: 'decisions' } as const, [] as Decision[])

export const register: Register = (on, options) => {
  const settings = readSettings(options)

  on('session.start', async ($, e, next) => {
    const done = await next(e)

    try {
      await $.command.register({
        name: 'decisions',
        description: `List or clear unrecorded decisions (cleared automatically when ${settings.recordPath} is written)`,
        argumentHint: '[clear | done <n>]',
      })
    } catch {
      // A failed registration must not stop the session from starting.
    }

    return done
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)

    // Only the main agent's answers count: not subagents, aborts, errors or refusals.
    if (e.agentId !== undefined || e.reason !== 'answer') {
      return done
    }

    try {
      const found = extractDecisions(e.answer, settings.keywords)

      if (found.length > 0) {
        const at = await $.clock.now()
        await update($, decisions, list => addDecisions(list, found, at, settings.maxItems))
      }
    } catch {
      // Failing to record must not block the reply.
    }

    return done
  })

  // MultiEdit is not in this build's built-in tool table, so compare String(e.tool) instead of using a matcher.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const filePath = 'file_path' in e ? e.file_path : undefined

    if (ran.deny === undefined && ran.isError !== true && isRecordWrite(String(e.tool), filePath, settings.recordPath)) {
      try {
        await update($, decisions, () => [])
      } catch {
        // Failing to clear must not alter the tool's result.
      }
    }

    return ran
  })

  on('command.run', { command: 'decisions' }, async ($, e) => {
    const parsed = parseDecisionArgs(e.args)

    if (parsed.kind === 'invalid') {
      return { text: USAGE }
    }

    if (parsed.kind === 'clear') {
      await update($, decisions, () => [])

      return { text: 'Cleared all unrecorded decisions.' }
    }

    if (parsed.kind === 'done') {
      const list = await read($, decisions)
      const target = list[parsed.index - 1]

      if (target === undefined) {
        return { text: `No decision #${parsed.index} (1–${list.length}).` }
      }

      await update($, decisions, current => current.filter(item => item.text !== target.text))

      return { text: `Removed: ${target.text}` }
    }

    return { text: formatList(await read($, decisions), settings.recordPath) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const line = formatBand(await read($, decisions))

    if (line === '' || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text wrap="truncate-end">{line}</Text>
      </Box>
    )
  })
}
