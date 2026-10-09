# claude-decision-tracker

A small plugin ("mod") for Claude Code's terminal UI that keeps the decisions mentioned in Claude's replies in a band above the prompt until they are written to your decision log.

日本語の説明は [README.ja.md](README.ja.md) にあります。

## When to use

- When you and Claude settle things during a session ("we decided to use pnpm", "going with option B") and you want to write them down later, but by then they have scrolled away.
- When your project keeps a decision log in files (for example `docs/decisions/`) and the rule is "record it right away".

Not for you if you run Claude non-interactively (`claude -p`).

## What it looks like

After a reply that contains a decision sentence, a band appears above the prompt:

```
📝 Unrecorded decisions (2): We decided to use pnpm for the m… / Going with option B for the cache … 
```

Press the band to open every decision in full (numbered, wrapped to the width); press it again to fold it back to one line. It stays there, across turns, until an `Edit`, `Write` or `MultiEdit` to a path containing `record_path` succeeds. `/decisions` lists the items with numbers, `/decisions done 2` removes one, `/decisions clear` removes all.

## Requirements

- Built on Claude Code's plugin hooks ("mods") API, which is in early access and may change between versions.
- Developed and tested with Claude Code 2.1.295 on macOS.
- Windows is untested.

## Install

```
claude plugin marketplace add i-noma-ru/claude-decision-tracker
claude plugin install decision-tracker@claude-decision-tracker
```

Or for one session only, from a clone:

```
claude --plugin-dir /path/to/claude-decision-tracker
```

## Configuration

All settings have defaults. Change them with `/plugin configure decision-tracker@claude-decision-tracker` or in `/config`.

| Setting | Default | Meaning |
| --- | --- | --- |
| `keywords` | `we decided`, `decided to`, `decision:`, `agreed to`, `going with`, and six Japanese phrases (裁定, に決めました, と決めました, に決定, を採用します, を採用しました) | A sentence containing one of these (case-insensitive) is kept. |
| `record_path` | `docs/decisions/` | A successful Edit, Write or MultiEdit to a path containing this text clears the band. |
| `max_items` | 20 | Oldest items are dropped beyond this count. |

## How it works

- At the end of each of Claude's turns, the reply is split into sentences (at `.`, `。` and line breaks) with code blocks and inline code removed. Sentences containing a keyword are kept, cut to 80 characters. Questions (ending in `?`, `？`, `ますか`, `でしょうか`) are skipped so "which should we decide on?" is not mistaken for a decision. Duplicates are kept once.
- Subagent replies and turns that ended in an abort or error are ignored.
- Items live in the session state: they survive a reload of the mod and are gone when the session ends.

## What the plugin reads

The text of each finished reply, and the `file_path` and result of `Edit` / `Write` calls. It reads no files and sends nothing anywhere.

## Tests

```
claude plugin validate .
claude plugin test .
```

## Notes

- Written with AI assistance (Claude Code).
- Companion mods by the same author: [claude-supervisor-pane](https://github.com/i-noma-ru/claude-supervisor-pane), [claude-confirm-gate](https://github.com/i-noma-ru/claude-confirm-gate). Each is independent.

## License

MIT. See [LICENSE](LICENSE).
