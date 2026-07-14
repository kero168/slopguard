# slopguard

**「AI生成っぽい低品質PR」に対する、レビュー労力のシグナルを提示するツール。**
GitHub Action + CLI として動作し、メンテナーが「どのPRから、どれだけ注意深くレビューするか」を
決める手助けをします — 誰かを断罪することなく。

[English README is here / 英語版READMEはこちら](./README.md)

---

## 判定ではなく、シグナルを

人気リポジトリのメンテナーは、新しい種類のコントリビューションに直面しています。
数分で量産された、もっともらしい大型PR。テンプレートそのままの説明文。テストなし。
そうしたPRを1本レビューするコストは、作る側のコストを大きく上回ります。
この**非対称性**こそが問題であって、AIそのものが問題なのではありません。

slopguard は「このPRはAIが書いたか?」という問いに**あえて答えません**。
その問いは一般には答えられないうえ、公の場で外したときの被害が大きすぎるからです。
善意のコントリビューターへの誤った疑いは、その人を燃やし、プロジェクトの評判を毀損し、
メンテナーの時間をさらに奪う炎上を招きます。「検出器」型のツールは、
この失敗モードを構造的に抱えています。

そこで、設計上の約束を次のように定めています。

- **slopguard が採点するのはレビュー労力であって、人ではありません。**
  出力は「このPRは早めに・意識的に見る価値がありそうです。理由はこれです」であり、
  「このPRはAIスロップです」では決してありません。
- **スコアのすべての点数に、人間が読んで反論できる理由が付きます。** 不透明な判定はしません。
- **デフォルトでは何もブロックしません。** 終了コードは常に0、必須チェックなし、
  コメント投稿もオプトインするまで無効です。スコアによるゲーティングは可能ですが、
  明示的に非推奨としています([FAQ](./docs/faq.md)参照)。
- **AI支援によるコントリビューション自体は歓迎される前提です。** このツールが可視化するのは
  「レビューされていない労力の非対称性」— テストなしの巨大diff、Issue参照なし、
  定型文 — であり、これらはLLM以前から存在し、単に量産が安くなっただけのパターンです。

ゴールは一つ: **AIを弾くのではなく、メンテナーのレビュー時間を守ること。**

## 何を見ているか

3つのグループの重み付きヒューリスティックを組み合わせ、0〜100の
アテンションスコアと理由リストを出力します。重み・しきい値・既知の弱点まで含めた
詳細は [docs/signals.md](./docs/signals.md) を参照してください。

| グループ | シグナル |
| --- | --- |
| **diff統計** | `oversized-diff`(巨大一括diff)、`generated-code-ratio`(ロックファイル/バンドル/minify済み/`@generated` ファイルがdiffを占める比率)、`missing-tests`(テスト変更なし)、`unrelated-files`(無関係な領域への波及) |
| **PR本文** | `boilerplate-body`(テンプレ/AI定型文パターン)、`missing-issue-reference`(Issue参照欠落)、`missing-verification-steps`(検証手順欠落)、`sparse-body`(本文ほぼ空) |
| **貢献者コンテキスト** | `first-contribution-large-change`(このリポジトリへの初コントリビューション **かつ** 巨大変更の組み合わせ — 「新規貢献者であること」単体では決して発火しません) |

レベル: `low`(20未満)· `moderate`(20〜44)· `elevated`(45〜69)· `high`(70以上)。
`high` の意味は「早めに・意識的にレビューする価値がある」— それ以上でも以下でもありません。

## CLI

```console
$ npm install -g slopguard
```

入力は GitHub CLI がそのまま出力するものです:

```console
$ gh api repos/OWNER/REPO/pulls/482 > pr.json
$ gh api -H "Accept: application/vnd.github.diff" repos/OWNER/REPO/pulls/482 > pr.diff
$ slopguard --pr pr.json --diff pr.diff
```

その他の出力形式:

```console
$ slopguard --pr pr.json --diff pr.diff --format json | jq .score
$ slopguard --pr pr.json --diff pr.diff --format markdown > comment.md
```

全フラグは [docs/cli.md](./docs/cli.md) を参照してください。

## GitHub Action

```yaml
# .github/workflows/slopguard.yml
name: SlopGuard
on:
  pull_request:
    types: [opened, edited, synchronize]

permissions:
  contents: read
  pull-requests: write # dry-run を無効にした後にのみ必要

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: kero168/slopguard@v0.1.0
        with:
          # デフォルトは true: レポートはジョブサマリーのみに出力されます。
          # 実トラフィックでスコア傾向を確認し、調整に納得してから false に。
          dry-run: 'true'
```

Action が**あえて dry-run から始まる**のは仕様です。1〜2週間、実際のPRでスコアを観察し、
必要なら重みを調整してから、コメント投稿のノイズに見合うかを判断してください。
フォークPRの権限まわりの注意点は [docs/action.md](./docs/action.md) にあります。

## LLM連携(オプトイン)

完全にオプトインであり、**なくても slopguard は完結します**:

```console
$ export ANTHROPIC_API_KEY=...   # または OPENAI_API_KEY
$ slopguard --pr pr.json --diff pr.diff --llm auto
```

モデルにはヒューリスティックの結果・本文・(切り詰めた)diffが渡され、
短いトリアージメモと、最大でも数点しか加算されない bounded な concern 値が返ります。
SDK依存なしの素の `fetch` で呼び出し、失敗時はレポート内のノートに降格するだけです。
diff内容を第三者に送ることになるプライバシー上の注意も含め、
[docs/llm.md](./docs/llm.md) を参照してください。

## 設定

すべての重み・しきい値・レベル境界はJSONで上書きできます:

```json
{
  "weights": { "missing-tests": 0, "boilerplate-body": 24 },
  "thresholds": { "oversizedLinesLow": 800 },
  "levels": { "high": 80 }
}
```

```console
$ slopguard --pr pr.json --diff pr.diff --config .slopguard.json
```

重みを `0` にするとそのシグナルは無効になります。詳細は
[docs/configuration.md](./docs/configuration.md)。

## 正直な制約

- これらは**ヒューリスティック**です。丁寧な人間のPRが引っかかることも
  (大規模なvendor更新、正当な広域リファクタリング)、悪意ある送り手が
  すり抜けることもあります。スコアは注意の優先順位付けであり、レビューの代替にはなりません。
- `missing-verification-steps` はキーワードベースです。根拠のない「fully tested」でも
  通過します。隠さず明記しています。
- 定型文パターンは v0.1 時点で英語中心です。
- 大規模な公開コーパスに対するキャリブレーションはまだ行っていません。デフォルトの重みは
  根拠を持った初期値であり、実例による改善のために
  [シグナルフィードバック用のIssueテンプレート](./.github/ISSUE_TEMPLATE/signal_feedback.yml)
  を用意しています。

## プロジェクト情報

- [ARCHITECTURE.md](./ARCHITECTURE.md) — 構成の全体像
- [CONTRIBUTING.md](./CONTRIBUTING.md) — 開発環境、シグナルの追加方法
- [GOVERNANCE.md](./GOVERNANCE.md) · [MAINTAINERS.md](./MAINTAINERS.md)
- [SECURITY.md](./SECURITY.md) · [SUPPORT.md](./SUPPORT.md)
- [ROADMAP.md](./ROADMAP.md) · [CHANGELOG.md](./CHANGELOG.md)

## ライセンス

[MIT](./LICENSE) © kero168
