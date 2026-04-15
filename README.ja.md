# slack2md

Slack メッセージを標準 Markdown に変換する bot です。Cloudflare Workers 上で動作します。

[English README](./README.md)

## 機能

- **`/tomd` スラッシュコマンド** — メッセージを Markdown に変換
  - 引数なし：チャンネルの直前メッセージを変換
  - permalink 指定：対象メッセージを変換
  - thread モード：スレッド全体を変換
- **メッセージショートカット** — 右クリックメニューから「Convert to Markdown」
- **Slack mrkdwn → Markdown 変換** — 太字、斜体、取り消し線、リンク、メンション、コードブロック、引用を適切に変換
- **添付ファイル対応** — 画像は `![alt](url)`、ファイルは添付リスト形式
- **スレッド対応** — 親メッセージ＋リプライを構造化ドキュメントとして出力
- **エフェメラル応答** — 変換結果はコマンド実行者のみに表示

## 使い方

### スラッシュコマンド

```
/tomd                              # チャンネルの直前メッセージを変換
/tomd <permalink>                  # 指定メッセージを変換
/tomd thread <permalink>           # スレッド全体を変換
```

### メッセージショートカット

1. メッセージにカーソルを合わせる
2. 「...」（その他のアクション）メニューをクリック
3. **Convert to Markdown** を選択
4. 変換された Markdown がエフェメラルメッセージとして表示される

## セットアップ

### 前提条件

- [Node.js](https://nodejs.org/) (v18 以上)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- Cloudflare アカウント
- アプリをインストールできる Slack ワークスペース

### 1. クローンとインストール

```bash
git clone https://github.com/syuya2036/slack2md.git
cd slack2md
npm install
```

### 2. Slack App の作成

1. [api.slack.com/apps](https://api.slack.com/apps) にアクセスし、**Create New App** > **From scratch** をクリック
2. アプリ名（例：「slack2md」）を入力し、ワークスペースを選択

#### OAuth & Permissions

以下の **Bot Token Scopes** を追加してください：

| スコープ | 用途 |
|---------|------|
| `commands` | スラッシュコマンドの登録 |
| `chat:write` | エフェメラルメッセージの送信 |
| `channels:history` | パブリックチャンネルのメッセージ読み取り |
| `groups:history` | プライベートチャンネルのメッセージ読み取り |
| `im:history` | DM のメッセージ読み取り |
| `mpim:history` | グループ DM のメッセージ読み取り |
| `users:read` | ユーザーメンションの表示名解決 |

アプリをワークスペースにインストールし、**Bot User OAuth Token**（`xoxb-...`）を控えておいてください。

#### スラッシュコマンド

1. **Slash Commands** > **Create New Command**
2. Command: `/tomd`
3. Request URL: `https://<your-worker>.workers.dev/slack/commands`
4. Description: 「Slack メッセージを Markdown に変換」
5. Usage hint: `[thread] [permalink]`

#### Interactivity（インタラクティビティ）

1. **Interactivity & Shortcuts** > トグルを **On**
2. Request URL: `https://<your-worker>.workers.dev/slack/interactivity`
3. **Shortcuts** の下で **Create New Shortcut** > **On messages**
4. Name: `Convert to Markdown`
5. Callback ID: `convert_to_markdown`

#### Signing Secret

**Basic Information** から **Signing Secret** を控えておいてください。

### 3. Workers Secrets の設定

```bash
wrangler secret put SLACK_BOT_TOKEN
# xoxb-... トークンを貼り付け

wrangler secret put SLACK_SIGNING_SECRET
# Signing Secret を貼り付け
```

### 4. デプロイ

```bash
npm run deploy
```

必要に応じて Slack App の Request URL をデプロイした Worker の URL に更新してください。

## ローカル開発

```bash
# .dev.vars にシークレットを設定
cat > .dev.vars << 'EOF'
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-signing-secret
EOF

# ローカル開発サーバーを起動
npm run dev
```

ローカルサーバーを Slack に公開するにはトンネリングツール（`cloudflared tunnel`、ngrok 等）を使用してください。

## テスト

```bash
npm test              # テスト実行
npm run test:watch    # ウォッチモードでテスト実行
npm run typecheck     # TypeScript 型チェック
```

## プロジェクト構成

```
src/
  index.ts                 # Hono アプリのエントリーポイント、ルート、ミドルウェア
  slack/
    types.ts               # Slack ペイロード・Block Kit・API の型定義
    verify.ts              # リクエスト署名検証 (Web Crypto API)
    permalink.ts           # Permalink URL パーサー
    client.ts              # Slack Web API クライアント (fetch ベース)
  handlers/
    slash-command.ts       # /tomd コマンドハンドラー
    shortcut.ts            # メッセージショートカットハンドラー
  markdown/
    converter.ts           # オーケストレーター：データ取得・ユーザー解決・変換呼び出し
    render.ts              # メッセージ本文レンダラー（blocks 優先、text フォールバック）
    rich-text.ts           # Block Kit rich_text レンダラー（リスト、コードブロック、引用）
    transform.ts           # Slack mrkdwn → Markdown 変換・純粋関数（text フォールバック用）
    attachments.ts         # ファイル・画像添付のフォーマット
    thread.ts              # スレッド（親＋返信）のフォーマット
  utils/
    response.ts            # エフェメラル応答ヘルパー
    truncate.ts            # 長文メッセージの切り詰め
```

## 変換ルール

### インラインフォーマット

| Slack | Markdown |
|-------|----------|
| `*太字*` | `**太字**` |
| `_斜体_` | `*斜体*` |
| `~取り消し線~` | `~~取り消し線~~` |
| `` `インラインコード` `` | `` `インラインコード` `` |
| ` ```コードブロック``` ` | ` ```コードブロック``` ` |

### メンション・リンク

| Slack | Markdown |
|-------|----------|
| `<@U123>` | `@表示名` |
| `<#C123\|general>` | `#general` |
| `<!here>` | `@here` |
| `<https://...\|テキスト>` | `[テキスト](https://...)` |
| `>` 引用 | `>` 引用 |

### リスト（Block Kit rich_text 経由）

| Slack | Markdown |
|-------|----------|
| 箇条書きリスト | `- item` |
| 番号付きリスト | `1. item` |
| ネスト箇条書き（indent 1） | `  - item` |
| ネスト番号付き（indent 1） | `  1. item` |
| 深いネスト（indent 2+） | `    - item`（レベルごとに2スペース） |
| 箇条書き/番号付き混在 | 正しく混在出力 |

メッセージに Block Kit `rich_text` ブロックが含まれている場合、正確なリスト構造を使用します。ない場合は `text` フィールドにフォールバックし、`•`（U+2022）を `-` に変換します。

### 添付ファイル

| Slack | Markdown |
|-------|----------|
| 画像添付 | `![ファイル名](url)` |
| ファイル添付 | `- attachment: [ファイル名](url)` |

## thread モードの出力イメージ

```markdown
**@投稿者** — 2024-01-15 14:30 UTC

親メッセージの内容

---

## Replies

---

**@返信者** — 2024-01-15 14:35 UTC

返信メッセージの内容
```

## 既知の制約

- **プライベートファイル URL**：Slack の `url_private` URL はアクセスに認証が必要です。Markdown 出力にはこれらの URL が含まれますが、有効なトークンなしでは Slack 外からアクセスできません。
- **応答の長さ**：Slack のエフェメラルメッセージには文字数制限があります。長いメッセージやスレッドは切り詰められ、その旨が通知されます。将来のバージョンではファイルアップロードでの完全出力に対応予定です。
- **ユーザー解決**：bot がユーザーのプロフィールにアクセスできない場合（削除済みユーザー、外部ユーザー等）、表示名の代わりに生のユーザー ID が表示されます。
- **絵文字**：カスタム絵文字のショートコード（`:custom_emoji:`）はそのまま出力されます。標準 Unicode 絵文字は保持されます。
- **コードブロックの言語検出**：コードブロックは自動言語検出なしで出力されます。ユーザーが指定した言語ヒントがある場合はそのまま保持されます。

## セキュリティに関する注意事項

- すべてのリクエストは Slack の Signing Secret（HMAC-SHA256）で検証されます
- Bot トークンと Signing Secret は Cloudflare Workers Secrets として保存され、コードには含まれません
- メッセージ内容はメモリ上で処理され、永続化されません
- 機密情報のあるチャンネルでの使用に注意してください — エフェメラル応答はコマンド実行者のみに表示されますが、内容は Slack のサーバーと Worker を経由します
- プライベートチャンネルへのアクセスは bot が招待されているかどうかに依存します

## 今後の拡張候補

- `/tomd github` — GitHub-flavored Markdown に最適化した出力
- `/tomd notion` — Notion 貼り付け用に最適化した出力
- 長文コンテンツのスニペット/ファイルアップロード対応
- コードブロックの言語自動検出
- リッチブロック（Block Kit）要素の変換
- カスタム絵文字の解決

## ライセンス

MIT
