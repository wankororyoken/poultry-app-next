# 養鶏管理アプリ 仕様書

## 概要

養鶏農場向けのモバイルファーストな日次作業記録・管理アプリ。
従業員（約8名、うち3名が毎日利用）が鶏舎ごとの採卵数・餌量・死鶏数を記録する。

- **本番URL**: Vercelにデプロイ（GitHub連携で自動デプロイ）
- **リポジトリ**: `wankororyoken/poultry-app-next`
- **設計方針**: 安定性重視、モバイル（iOS Safari）で快適に動作すること

---

## 技術スタック

| 層 | 技術 |
|----|------|
| フロントエンド | Next.js 16 (App Router, TypeScript) |
| スタイリング | Tailwind CSS v4（`@theme inline` でカスタムカラー定義） |
| バックエンド | Supabase (PostgreSQL + RLS) |
| ホスティング | Vercel |
| 状態管理 | React Context（AppContext） |

### カスタムカラーテーマ（ダークモード固定）
```
bg:       #0f1117  surface:  #1a1d27  surface2: #232738
border:   #2e3349  accent:   #f5a623  accent2:  #e8743b
green:    #4caf7d  red:      #e05c5c  blue:     #5b8dee
text:     #eef0f8  text2:    #8b90a8
```

---

## データベース（Supabase PostgreSQL）

### テーブル一覧

#### `workers` — 従業員マスタ
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | |
| name | text | 氏名 |
| is_active | boolean | 有効フラグ |
| created_at | timestamptz | |

#### `rooms` — 鶏舎マスタ
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | |
| name | text | 鶏舎名（例: 1番, 1~3番） |
| sort_order | integer | 表示順 |
| is_active | boolean | 有効フラグ |
| created_at | timestamptz | |

現在の鶏舎: 1~3番, 4番, 6番, 7番, 8番, 9番, 10番（計7棟）

#### `egg_records` — 採卵記録
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | |
| record_date | date | 記録日 |
| period | text | '午前' or '午後' |
| room_id | uuid FK→rooms | |
| count | integer | 採卵数（個） |
| worker_id | uuid FK→workers | |
| created_at | timestamptz | |

UNIQUE制約: `(record_date, period, room_id)`

#### `feed_records` — 給餌記録
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | |
| record_date | date | |
| period | text | '午前' or '午後' |
| room_id | uuid FK→rooms | |
| amount_kg | numeric | 餌量（kg） |
| worker_id | uuid FK→workers | |
| created_at | timestamptz | |

UNIQUE制約: `(record_date, period, room_id)`

#### `dead_records` — 死鶏記録
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | |
| record_date | date | |
| room_id | uuid FK→rooms | |
| count | integer | 死鶏数（羽） |
| worker_id | uuid FK→workers | |
| created_at | timestamptz | |

UNIQUE制約: `(record_date, room_id)`

#### `broken_egg_records` — 破卵記録
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | |
| record_date | date | |
| period | text | '午前' or '午後' |
| count | integer | 破卵数（個） |
| worker_id | uuid FK→workers | |
| created_at | timestamptz | |

UNIQUE制約: `(record_date, period)`

#### `unknown_egg_records` — 不明卵記録
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | |
| record_date | date | |
| room_id | uuid FK→rooms nullable | 該当鶏舎（任意） |
| location | text nullable | 発見場所 |
| location_detail | text nullable | 詳細 |
| worker_id | uuid FK→workers | |
| created_at | timestamptz | |

#### `memos` — メモ
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | |
| record_date | date | |
| room_id | uuid FK→rooms nullable | 対象鶏舎（任意） |
| tab | text | 記録タブ名（'special' など） |
| text | text | 内容 |
| worker_id | uuid FK→workers | |
| created_at | timestamptz | |

#### `feed_defaults` — 規定給餌量
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | |
| room_id | uuid FK→rooms UNIQUE | |
| default_kg | numeric | 1回あたりの規定量（kg） |

#### `flock_settings` — 在籍羽数管理
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | |
| room_id | uuid FK→rooms UNIQUE | |
| start_date | date | 入雛日 |
| initial_count | integer | 入雛羽数 |
| created_at | timestamptz | |

現在羽数 = `initial_count - Σ(dead_records.count WHERE record_date >= start_date)`

#### `announcements` — お知らせ
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | |
| worker_id | uuid FK→workers | 投稿者 |
| text | text | 内容 |
| is_active | boolean | 公開フラグ |
| created_at | timestamptz | |

#### `work_logs` — 作業記録（未使用・将来用）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | |
| record_date | date | |
| room_id | uuid FK→rooms nullable | |
| worker_id | uuid FK→workers | |
| category | text nullable | 作業カテゴリ |
| description | text | 内容 |
| created_at | timestamptz | |

---

## アプリ構成・画面仕様

### グローバル状態（AppContext）
- `currentWorker`: 選択中の従業員（localStorageに `poultry_worker` キーで保存）
- `currentDate`: 選択中の記録日（yyyy-mm-dd形式）
- `rooms`: 有効鶏舎一覧（起動時にSupabaseから取得）
- `workers`: 有効従業員一覧（起動時にSupabaseから取得）

### ヘッダー（全画面共通）
- アプリ名「養鶏管理」（グラデーションテキスト）
- 日付ナビ: `‹ 📅 M/D(曜) ›` で±1日移動、タップでカレンダーピッカー
- 入力者ボタン: タップでモーダルから切り替え

### BottomNav（全画面共通）
タブ: ホーム / 採卵 / 餌 / 死鶏 / 特記 / 集計 / 設定

---

### `/home` — ホーム（ダッシュボード）

**表示内容:**
1. **お知らせ** — `is_active=true` のものを最新5件（有効な場合のみ表示）
2. **今日の状況テーブル** — 鶏舎ごとの当日データ

テーブル列: `鶏舎 | 採卵(個) | 餌(kg) | 餌/卵(g) | 死鶏(羽) | 羽数(羽)*`
※羽数列は flock_settings が存在する場合のみ表示

**指標:**
- **餌/卵(g)**: `餌(kg) × 1000 ÷ 採卵数` — 鶏舎ごと＋全体合計
  - 色分け: ≤200g 🟢 / ≤300g 🟡 / ≤400g 🟠 / 401g+ 🔴
- **産卵率(%)**: `採卵数 ÷ 現在羽数 × 100`（羽数設定がある場合のみ、合計行に表示）
  - 色分け: ≥90% 🟢 / ≥75% 🟡 / <75% 🔴

---

### `/eggs` — 採卵

- 午前/午後タブ切り替え
- 鶏舎ごと2列グリッドで数値入力
- 前日の同時間帯の採卵数をヒント表示
- 入力済みセルは緑ボーダー
- 午前・午後の合計と全体合計を表示
- 保存: upsert（`record_date, period, room_id` でコンフリクト処理）

---

### `/feed` — 餌

- 午前/午後タブ切り替え
- 鶏舎ごと2列グリッドでkg入力（小数対応）
- 「規定量を入力」ボタン（feed_defaults から一括セット）
- 前日の同時間帯の餌量をヒント表示
- 午前・午後の合計と全体合計を表示
- 保存: upsert（`record_date, period, room_id`）

---

### `/dead` — 死鶏

- 鶏舎ごと2列グリッドで羽数入力
- 直近30日の鶏舎ごと累計と総計を表示
- 入力値 > 0 のセルは赤ボーダー
- 保存: upsert（`record_date, room_id`）

---

### `/special` — 特記

**破卵タブ:**
- 午前/午後それぞれの破卵数を入力
- 保存: upsert（`record_date, period`）

**不明卵タブ:**
- 発見場所・対象鶏舎（任意）・詳細（任意）を入力してinsert
- 当日分の一覧表示（削除可能）

**メモタブ:**
- 対象鶏舎（任意）・自由テキストを入力してinsert
- 当日分の一覧表示（削除可能）

---

### `/summary` — 集計

- `‹ YYYY年M月 ›` で月を移動
- **月間サマリーカード**: 採卵合計・餌合計・月間餌/卵・死鶏合計
- **日別テーブル**: 日付(日曜赤/土曜青) | 採卵 | 餌 | 餌/卵 | 死鶏
  - 合計行あり
  - 餌/卵は同じ4段階カラーコード

---

### `/settings` — 設定

**お知らせタブ:**
- 新しいお知らせを投稿（insert）
- 公開中のお知らせ一覧（削除=is_active を false に更新）

**羽数管理タブ:**
- 鶏舎ごとに入雛日・初期羽数を設定
- upsert（`room_id` でコンフリクト処理）・削除対応
- ここで設定するとホームの「現在羽数」「産卵率」が表示される

**規定量タブ:**
- 鶏舎ごとのデフォルト給餌量（kg）を設定
- upsert（`room_id`）
- 餌ページの「規定量を入力」ボタンに反映

---

## 主要なビジネスロジック

### 現在羽数の計算
```
現在羽数 = flock_settings.initial_count
         - Σ(dead_records.count
             WHERE room_id = :room_id
             AND record_date >= flock_settings.start_date
             AND record_date <= :currentDate)
```

### 餌/卵指標（g/個）
```
餌/卵 = (Σ feed_records.amount_kg × 1000) ÷ Σ egg_records.count
```
※当日の全期間（午前+午後）の合計値で計算

### 産卵率（%）
```
産卵率 = (Σ egg_records.count ÷ 現在羽数) × 100
```

---

## セキュリティ

- Supabase RLS（Row Level Security）有効
- フロントエンドからは `anon` キー（publishable）のみ使用
- 認証なし（社内ツールのため、Vercel の Deployment Protection は無効化）
- データはすべて Supabase PostgreSQL に保存（Google Sheets からは移行済み）

---

## iOS Safari 対応

- `env(safe-area-inset-*)` でノッチ・ホームバー対応
- `min-height: 100dvh`（dynamic viewport height）
- BottomNav に `transform: translateZ(0)` でGPUレイヤー固定（タッチ座標ずれ防止）
- `touch-action: manipulation` で300ms遅延を排除
- スクロールには `overscroll-behavior-y: none`

---

## 将来実装予定の機能（未実装）

- 発注計算機能（在庫量・消費速度から自動算出）
- 作業記録（`work_logs` テーブルは作成済み）
- タブバッジ（入力済みドット表示）
- 保存済み値の視覚的区別（読み込み済み値スタイル）
- 集計グラフ（月別トレンド表示）
- 鶏舎・入力者のマスタ管理画面
