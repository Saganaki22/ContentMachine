# ContentMachine

<div align="center">

![ContentMachine](https://img.shields.io/badge/ContentMachine-AI%20ドキュメンタリーパイプライン-blue?style=for-the-badge&logo=film&logoColor=white)

[![License](https://img.shields.io/badge/License-Apache%202.0-green?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![fal.ai](https://img.shields.io/badge/fal.ai-開発中-FF6B35?style=for-the-badge)](https://fal.ai)
[![Replicate](https://img.shields.io/badge/Replicate-テスト済み-000000?style=for-the-badge)](https://replicate.com)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-テスト済み-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-TTS-purple?style=for-the-badge)](https://elevenlabs.io)

## ❤️ プロジェクトを支援する

[![Ko-fi](https://img.shields.io/badge/支援-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/drbaph)
[![Donate](https://img.shields.io/badge/寄付-Stripe-635BFF?logo=stripe&logoColor=white)](https://donate.stripe.com/eVq4gz6pO2SQ6p4bZw6kg0g)

![ContentMachineBanner-jpeg](https://github.com/user-attachments/assets/5a00c422-87de-4773-ad07-fd27892f32d7)

**ひとつのトピックから、完成した YouTube 対応プロジェクトまで——**  
**シネマティックなドキュメンタリー動画を作るオールインワン AI パイプライン。**

[パイプラインの流れ](#パイプラインの流れ) · [モデルと API](#対応モデルと-api) · [実際のコスト](#実際のコスト) · [はじめ方](#はじめ方) · [機能一覧](#機能一覧)

</div>

## 🎥 デモを見る

<p align="center">
  <a href="https://www.youtube.com/watch?v=3BC8OXMzeF4">
    <img src="https://img.shields.io/badge/▶_フルデモを見る-YouTube-FF0000?style=for-the-badge&logo=youtube" alt="YouTube でデモを見る">
  </a>
</p>

[![デモを見る](https://img.youtube.com/vi/3BC8OXMzeF4/maxresdefault.jpg)](https://www.youtube.com/watch?v=3BC8OXMzeF4)

---

> **API ステータス：** **Replicate** と **Gemini** API は実際に検証済みです——この 2 つが動作確認されたパスです。**fal.ai サポートは実装済みですが完全な検証はまだ**です。不具合がある可能性があります。PR 歓迎！

---

## ContentMachine とは？

ContentMachine は、最先端の AI を使ってドキュメンタリー動画制作のワークフロー全体を自動化します。トピックを入力するだけで、あとはすべてお任せ——実際の歴史的ストーリーのリサーチ、シーン構成、画像生成、動画クリップ制作、ナレーションスクリプト執筆、音声合成、YouTube メタデータ、サムネイルまで——すべてをまとめたきれいな ZIP ファイルとして出力します。そのまま動画編集ソフトに持ち込めます。

フルの制作チームなしに高品質なシネマティックコンテンツを作りたい**コンテンツクリエイター、ドキュメンタリー制作者、教育者、愛好家**向けに作られています。スタートページ（ストーリーページ）の詳細設定を展開することで、プロンプトを完全にカスタマイズして自分好みのスタイルに仕上げることができます。

> **個人的なオールインワンパイプラインとして作りました**——ローカルで動かすのに十分シンプルで、AI プロバイダーを柔軟に切り替えられ、1 セッションで公開可能な素材を生成できるほど強力です。

---

## パイプラインの流れ

ContentMachine はステップバイステップで動作し、どの段階でも監視・一時停止・再開できるクリーンな UI を提供します。

```
トピック入力
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  1. ストーリー生成                                    │
│     LLM が映像化ポテンシャルのある                    │
│     実在する歴史的ストーリーを 4 つ提案               │
│     → あなたが 1 つ選ぶ                              │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  2. シーン計画                                        │
│     LLM が完全な映画的ショットリストを構築             │
│     スマートなテンポ：尺は選択した動画モデルに適応     │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  3. 画像生成                                          │
│     シーンごとに 4 バリエーション                     │
│     （全景・近景・ディテール・雰囲気）                 │
│     最良の 1 枚を選択                                 │
│     すべての画像は base64 でプロジェクト JSON に保存  │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  4. 動画生成                                          │
│     画像→動画変換、2 シーンずつ処理                   │
│     複数モデルから選択——最良クリップを選ぶ            │
│     動画 URL はプロジェクト JSON に保存               │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  5. 音声（任意）                                      │
│     ElevenLabs TTS ナレーション + シーンごとの効果音  │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  6. エクスポート                                      │
│     YouTube メタデータ · 複数サムネイル選択           │
│     完全 ZIP：動画 + 画像 + 音声 + スクリプト         │
└─────────────────────────────────────────────────────┘
```

### ビジュアルスタイル

デフォルトの美学は**継ぎ目のない光沢のある磁器マネキン**を使用します——人物は常に時代考証に合った衣装を着用し、関節・台座・支持物は一切見えません。フォトリアルな環境、レイトレーシング、映画的照明。改変された可能性のあるリアルなシーンを描写しないため、YouTube 向けコンテンツクリエイターにとって優れた出発点となります。

ビジュアルスタイルは完全にカスタマイズ可能です：スタートページの**Advanced — Customize System Prompts**を展開すると、任意のキャラクタータイプに合わせた画像プロンプトのルールを編集できます。**キャラクターベース画像**機能（下記参照）と組み合わせることで、すべてのシーンを通じて一貫した見た目を維持できます。

---

## 対応モデルと API

> **注意：** Replicate と Gemini は検証済みのプロバイダーです。fal.ai は開発中です——貢献歓迎。

### LLM——ストーリー・シーン計画・スクリプト・メタデータ

| プロバイダー | モデル |
|---|---|
| **fal.ai** *(開発中)* | Claude 3.5 Sonnet |
| **Gemini（直接接続）** | Gemini 3 Flash *（推奨）*、Gemini 3.1 Pro、Gemini 3 Pro、Gemini 2.5 Flash、Gemini 2.5 Pro |
| **Replicate** | Gemini 2.5 Flash、Gemini 3 Flash、Gemini 3.1 Pro、Claude 3.5 Sonnet |

### 画像生成

| プロバイダー | モデル |
|---|---|
| **fal.ai** *(開発中)* | Flux Pro、Flux 2 Pro、Flux Schnell、Nano Banana Pro、Qwen Image 2512、Z-Image Base、Ideogram V3、SD 3.5 Large |
| **Replicate** | Flux 2 Pro、Flux 1.1 Pro、Nano Banana Pro *（Gemini）*、Imagen 4 |
| **Gemini（直接接続）** | Gemini 3 Pro Image Preview *（ネイティブ 2K 出力）* |

### 動画生成

| プロバイダー | モデル | 備考 |
|---|---|---|
| **fal.ai** *(開発中)* | LTX-2 画像→動画 | 未完全検証 |
| **Replicate** | LTX-2 Pro | AI 生成音声付き、6〜10 秒 |
| **Replicate** | LTX-2 Fast | 6〜20 秒、2 秒ステップ |
| **Replicate** | Kling v3 | 3〜15 秒整数、標準/プロモード、AI 音声 |
| **Replicate** | Kling v2.5 Turbo Pro | 5 秒または 10 秒のみ |

### 音声 / TTS

| プロバイダー | 機能 |
|---|---|
| **ElevenLabs** | シーンごとのナレーション音声合成 + 効果音生成 |
| **ローカル TTS** | 独自ツール（QWEN TTS、Kokoro など）——コストゼロ |

---

## 実際のコスト

> ContentMachine で全工程を制作した **4:30 分のドキュメンタリー動画**のコストは約 **28 ドル** でした。

| コンポーネント | 使用プロバイダー/モデル | 備考 |
|---|---|---|
| ストーリー + シーン計画 + スクリプト | Gemini 3 Flash Preview（Gemini API） | 非常に安い |
| シーン画像 + サムネイル | Nano Banana Pro / gemini-3-image-preview（Replicate） | 中程度 |
| 動画クリップ | LTX-2 Pro（Replicate） | 最大のコスト要因 |
| ナレーター TTS | QWEN TTS（ローカル） | 無料 |

**コスト削減のヒント：**
- LLM に `gemini-2.5-flash`（非プレビュー版）を使用——クォータが高く、レート制限が少ない
- 動画は Replicate LTX-2 Pro の代わりに fal.ai LTX-2 を使用（*fal.ai の完全検証後*）
- 画像に Flux Schnell を使用——より速く安い
- 無料のローカル TTS ツールを使用してオーディオのコストをゼロに
- より長いシーンは Replicate の LTX-2 Fast を使用——似たようなコストで対応可能

---

## はじめ方

### 前提条件

- **Node.js 18+**
- 少なくとも 1 つの LLM プロバイダーと 1 つの画像プロバイダーの API キー

### インストールと実行

```bash
# クローン
git clone https://github.com/Saganaki22/ContentMachine
cd ContentMachine

# 全依存関係をインストール
npm install

# バックエンドとフロントエンドを同時起動
npm run dev
```

アプリは **http://localhost:5173** で動作します。バックエンド API は **http://localhost:3000** です。

### API キーの設定

**設定パネル**（右上の歯車アイコン）を開きます。API キーを貼り付けると、ブラウザの localStorage に保存され、セッション起動時に自動的にバックエンドへ送信されます。ローカル利用に `.env` ファイルは不要です。

| プロバイダー | リンク |
|---|---|
| fal.ai | [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys) |
| Replicate | [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) |
| Gemini | [aistudio.google.com/api-keys](https://aistudio.google.com/api-keys) |
| ElevenLabs | [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys) |

### 本番環境向けビルド

```bash
npm run build
npm run start
```

---

## プロジェクト構造

```
ContentMachine/
├── backend/
│   ├── server.js                Express API サーバー（リクエストボディ 200MB 制限）
│   └── routes/
│       ├── claude.js            LLM：ストーリー・シーン計画・プロンプト・スクリプト・メタデータ
│       ├── images.js            画像生成：fal.ai / Replicate / Gemini
│       ├── videos.js            動画生成 + ステータスポーリング
│       ├── elevenlabs.js        TTS ナレーション + 効果音生成
│       ├── thumbnail.js         サムネイル画像生成
│       ├── export.js            ZIP パッケージング（ブラウザへストリーミング）
│       └── settings.js          API キー管理
│
└── frontend/src/
    ├── pages/
    │   ├── StorySelect.jsx      ステップ 1——トピック入力・ストーリー選択・アスペクト比・キャラクター画像・高度なプロンプト
    │   ├── SceneImages.jsx      ステップ 2——画像生成と選択
    │   ├── VideoGeneration.jsx  ステップ 3——動画生成 + ナレーションスクリプト
    │   ├── AudioGeneration.jsx  ステップ 4——TTS ボイスオーバー（任意）
    │   └── Export.jsx           ステップ 5——サムネイル・メタデータ・ZIP エクスポート
    ├── components/
    │   └── Layout.jsx           ヘッダー・ナビ・設定ドロワー・GitHub リンク・フッター
    ├── store/
    │   └── pipelineStore.js     Zustand グローバルステート + 全非同期アクション
    └── services/
        └── api.js               全バックエンドコール用の Axios クライアント
```

---

## 機能一覧

### 生成
- **6 ステップのガイド付きパイプライン**——ストーリー → シーン → 画像 → 動画 → 音声 → エクスポート
- **シーンごとに 4 種類の画像バリエーション**——全景・近景・ディテール・雰囲気
- **バッチ処理**——画像はシーンごと、動画は 2 つずつ生成
- **モデル対応のシーン計画**——LLM が選択した動画モデルの制約に合わせて許容尺とテンポを自動調整
- **アスペクト比サポート**——16:9（横向き）と 9:16（縦向き/TikTok/Reels）；API パラメーターで渡し、プロンプトには書き込まない
- **解像度は 1080p 固定**——すべての動画モデルで一貫した品質を確保
- **一時停止/再開**——任意のタイミングで安全に停止して後から再開可能
- **個別再生成**——パイプライン全体を再実行せず、任意の画像や動画クリップを再生成
- **全件再生成**——全シーンの画像生成をワンクリックで再実行
- **全選択/全解除**——動画クリップをワンクリックで一括操作
- **個別動画ダウンロード**——カードから任意の動画クリップを直接ダウンロード
- **自動リトライ**——Gemini の 429 レート制限と Replicate の中断を指数バックオフで自動処理
- **JSON 修復**——切り捨てや形式不正の LLM 出力を解析前に自動修復
- **リアルタイムシーン数見積もり**——スタート画面で動画尺を調整すると推定シーン数が即時表示

### 動画モデル（Replicate）
- **LTX-2 Pro**——6/8/10 秒、AI 生成音声付き
- **LTX-2 Fast**——6〜20 秒・2 秒ステップ、AI 生成音声付き
- **Kling v3**——3〜15 秒整数、標準/プロモード、AI 音声、開始画像使用
- **Kling v2.5 Turbo Pro**——5 秒または 10 秒のみ、高速出力、開始画像使用

### プロジェクト管理
- **プロジェクトを JSON で保存**——全画像を base64 として保存（CDN リンク期限切れなし）、動画 URL も保持
- **プロジェクトの読み込み**——画像・動画・選択状態・スクリプトを含むパイプライン状態を完全復元；正しいステップへ自動移動
- **安全な読み込み**——完成済みプロジェクトの読み込みでは新しい API リクエストや課金が発生しない
- **ブラウザ永続化**——Zustand ステートが localStorage によりページリロード後も保持される

> **重要——早めに保存し、速やかにエクスポートしてください：**
>
> Replicate を含む一部の動画プロバイダーは、生成から**数時間以内にサーバーから動画を削除します**。URL が無効になった時点で動画は永久に失われます。セッションを閉じる前に必ず ZIP をエクスポートしてください。
>
> また、**プロジェクト JSON はパイプラインの途中どの時点でも保存できます**——最後まで待つ必要はありません。JSON にはすべての生成済み画像が base64 データとして埋め込まれるため、CDN の期限に関係なく画像はファイル内に永久保存されます。途中で作業を中断する場合は JSON を保存してアプリを閉じ、後から読み込めば中断した箇所から再開できます——画像は再生成されず、読み込み時の API 費用も発生しません。

### API キー
- **localStorage に保存**——毎セッション起動時に自動的にバックエンドへ読み込まれ、再入力不要
- **個別クリアボタン**——赤いクリアボタンで localStorage とバックエンドから対応キーを即座に削除
- **保存前に検証**——テストボタンで保存前に各キーの有効性を確認

### キャラクターベース画像
- **リファレンス画像のアップロード**——スタートページで男性・女性のキャラクターリファレンス画像をそれぞれアップロード可能（JPG・PNG・WebP、最大 10 MB）
- **あらゆるキャラクタースタイルに対応**——磁器マネキン、リアルな人物、アニメキャラクターなど何でも対応；任意のスタイルをオプションの**キャラクタースタイル**テキストフィールドに記述すると、モデルがそれに従います
- **全シーンに送信**——リファレンス画像はすべての画像生成リクエストに含まれ、モデルがキャラクターのプロポーション・トーン・ヘアスタイルを全シーンにわたって維持します
- **シーンの衣装は常に上書き**——各シーンはシーンプランに基づいた時代考証の衣装とポーズを維持；ロックされるのはキャラクターの外見のみです
- **モデルごとの最適配信**——Nano Banana Pro（Replicate・fal）と Gemini にはマルチモーダル入力として実際の画像を送信；他のモデルにはテキストによる一貫性ヒントを代わりに送信
- **「最初からやり直す」でリセット**——新しいプロジェクト開始時にキャラクター画像と説明がクリアされます

### カスタマイズ
- **高度なシステムプロンプト**——スタートページの展開可能なセクションに、7 つのパイプラインステージ（ストーリー選択・シーン計画・画像プロンプト・動画プロンプト・ナレーションスクリプト・YouTube メタデータ・サムネイルプロンプト）の編集可能なテキストエリアを配置
- **デフォルト値の事前表示**——各テキストエリアには現在実際に使われているプロンプトが表示され、何を変更すべきか一目でわかる
- **デフォルトにリセット**——ワンクリックで任意ステージのプロンプトを元に戻す
- **カスタムプロンプトの永続化**——localStorage に保存され、ページリロード後も保持

### エクスポート
- **ZIP エクスポート**——動画・選択画像・音声・サムネイル・ナレーションスクリプト・メタデータ・プロジェクト JSON をまとめてダウンロード
- **複数サムネイル選択**——1 枚または複数のサムネイルを選んでエクスポート
- **サムネイルライトボックス**——任意のサムネイルをクリックしてフルサイズ表示、ライトボックスから選択/解除
- **メタデータなしでもサムネイル生成可能**——メタデータステップをスキップしてもサムネイル生成は動作
- **YouTube メタデータ**——タイトル候補 4 件・SEO 対応の説明文・タグ・チャプタータイムスタンプ——エクスポート前にすべて編集可能

### UI
- **ContentMachine ブランドデザイン**——クリーンなダークモード UI、ヘッダーにステップインジケーター、GitHub リンク常時表示
- **最初からやり直す**——確認ダイアログ付きの赤いボタンで全進捗を安全に削除
- **サンプルトピック**——年代とカテゴリータグ付きのストーリー候補を事前表示
- **ホバー動画プレビュー**——完成した動画クリップはカードグリッド上でホバーするだけで再生
- **動画プロンプトエディター**——再生成前に任意シーンのカメラ動作プロンプトを編集可能

---

## コントリビューション

PR 大歓迎です！特に以下の分野への貢献を求めています：

- **fal.ai の検証**——fal.ai の画像・動画パスをエンドツーエンドでテストし修正
- **新しい動画モデルの追加**——Replicate または fal.ai の追加動画モデルへの対応
- **新しい画像モデルの追加**——画像プロバイダーとモデルリストの拡充
- **デプロイ設定**——Docker・Railway・Render・Fly.io の設定ファイル
- **バグ修正と改善**——使用中に見つけた問題なら何でも

---

## ライセンス

[Apache License 2.0](LICENSE) の下でライセンスされています。

---

<div align="center">

AI で作り、AI コンテンツクリエイターのために。

[![GitHub](https://img.shields.io/badge/GitHub-Saganaki22%2FContentMachine-181717?style=flat-square&logo=github)](https://github.com/Saganaki22/ContentMachine)

</div>
