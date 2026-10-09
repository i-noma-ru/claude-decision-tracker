# claude-decision-tracker

Claude Code のターミナル画面で使う小さなプラグイン（MOD）です。Claude の返答に出てきた「決めたこと」を入力欄の上の帯に溜め、決定の記録先に書き込むまで消しません。

English: [README.md](README.md)

画面に出る文言は英語です。

## 使いどころ

- 作業の途中で Claude と決めたこと（「pnpm に決めました」「案 B で行く」）を、あとで書こうと思っているうちに流れてしまうとき。
- 決定の記録をファイル（例: `docs/decisions/`）に残す決まりがあり、「決めたら即記録」を守りたいとき。

向かないとき: 画面の無い実行（`claude -p`）。

## 動くとこう見える

決定の文を含む返答のあと、入力欄の上に帯が出ます。

```
📝 Unrecorded decisions (2): We decided to use pnpm for the m… / Going with option B for the cache …
```

帯はターンをまたいで残り、`record_path` を含むパスへの `Edit`／`Write`／`MultiEdit` が成功すると消えます。`/decisions` で番号つきの一覧、`/decisions done 2` で 1 件だけ消す、`/decisions clear` で全部消す。

## 動作条件

- Claude Code のプラグインフック（MOD）API を使っています。この API は早期提供の段階で、版によって変わる可能性があります。
- Claude Code 2.1.295・macOS で開発・確認しました。
- Windows は確認していません。

## 導入

```
claude plugin marketplace add i-noma-ru/claude-decision-tracker
claude plugin install decision-tracker@claude-decision-tracker
```

クローンして、そのセッションだけ読み込むこともできます。

```
claude --plugin-dir /path/to/claude-decision-tracker
```

## 設定

すべて既定値があります。変えるときは `/plugin configure decision-tracker@claude-decision-tracker` か `/config` で。

| 設定 | 既定 | 意味 |
| --- | --- | --- |
| `keywords` | `we decided`・`decided to`・`decision:`・`agreed to`・`going with` と、日本語の「裁定」「に決めました」「と決めました」「に決定」「を採用します」「を採用しました」 | この語を含む文を拾います（大小文字は区別しません）。 |
| `record_path` | `docs/decisions/` | この文字列を含むパスへの Edit／Write／MultiEdit が成功したら帯を消します。 |
| `max_items` | 20 | これを超えたら古いものから落とします。 |

## 動き

- Claude のターンが終わるたび、返答をコードブロックと行内コードを除いて文（`.`・`。`・改行）に分け、語を含む文を 80 字までで残します。疑問文（`?`・`？`・「ますか」「でしょうか」で終わる文）は「どちらに決めますか」を決定と誤認しないよう拾いません。同じ文は 1 回だけ。
- サブエージェントの返答と、中断・エラーで終わったターンは見ません。
- 溜めた項目はセッションの状態に置くので、MOD の再読み込みでは消えず、セッションが終わると消えます。

## 読むもの

終わった返答の本文と、`Edit`／`Write`／`MultiEdit` の `file_path` と結果。ファイルは読まず、どこにも送りません。

## テスト

```
claude plugin validate .
claude plugin test .
```

## 補足

- AI（Claude Code）の支援を受けて書いています。
- 同じ作者の MOD: [claude-supervisor-pane](https://github.com/i-noma-ru/claude-supervisor-pane)・[claude-confirm-gate](https://github.com/i-noma-ru/claude-confirm-gate)。それぞれ独立しています。

## ライセンス

MIT です。[LICENSE](LICENSE) を参照してください。
