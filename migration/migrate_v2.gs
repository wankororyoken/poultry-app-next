// ================================================================
// 養鶏管理アプリ データ移行スクリプト v2
// 使い方:
//   1. GASエディタに貼り付ける
//   2. runFullMigration() を実行（全削除 → 全移行）
//   ※ シート名・列番号は実際のスプレッドシートに合わせて調整
// ================================================================

const SUPABASE_URL = 'https://bkgqbpmumhohrgqybprj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fFtTJahMFgXDzrXF1Mj59A_MP9LaetZ';

// 鶏舎名 → UUID（スプレッドシートの表記ゆれも含めてマッピング）
const ROOM_IDS = {
  '1~3番': '6a1ce79b-28fe-4aa4-84cf-ff19fd9cbc19',
  '4番':   '061aed33-13ed-447c-b683-02601b6e9a89',
  '6番':   '07e6e909-cc0b-4543-b0f6-53f4414904cd',
  '7番':   'ea7d7136-f2da-44d7-bd71-82aec8231150',
  '8番':   '919a4ef0-e789-432a-bf22-8e47daa50981',
  '9番':   'f744b0d2-005b-41a9-b094-3a4d4598b25b',
  '10番':  'b30d8b49-d86f-4849-8b70-c6aef955e147',
  // 隔離部屋（スプレッドシートの表記に合わせて複数登録）
  '隔離部屋': 'a8358953-bedd-4f23-944a-7a44d90e7f12',
  '隔離室':   'a8358953-bedd-4f23-944a-7a44d90e7f12',
  '隔離':     'a8358953-bedd-4f23-944a-7a44d90e7f12',
};

// 入力者名 → UUID
const WORKER_IDS = {
  'その他': '7349a947-ef9c-4bc3-84bd-67d0df5a19ec',
  '山下':   'c3a532d5-3eba-4545-b749-32b5e33a52ee',
  '徳永':   'f9e43c26-7241-435b-aab6-72ed678a8bed',
  '末廣':   '27ed3ab0-c6d1-447e-9984-98440a15ed09',
  '森山':   '17537b3c-3093-4e8a-b765-135013e49d25',
  '田口':   'dfdddf3e-df63-4567-84de-fedc06bac228',
  '重吉':   'cd4ed438-f75d-4bd0-8114-17fe394cb3c2',
  '養鶏班': '40d3f098-d0dc-452e-9a84-a71c17ac7f65',
};
const DEFAULT_WORKER_ID = WORKER_IDS['養鶏班'];

// ----------------------------------------------------------------
// ユーティリティ
// ----------------------------------------------------------------
function supabaseDelete(table) {
  // record_date または created_at が存在する行を全削除
  // RLSがanon許可設定になっている前提
  const url = SUPABASE_URL + '/rest/v1/' + table + '?id=not.is.null';
  const res = UrlFetchApp.fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    muteHttpExceptions: true,
  });
  Logger.log(table + ' DELETE: ' + res.getResponseCode());
}

function supabaseInsert(table, records) {
  if (records.length === 0) return 0;
  // 500件ずつバッチ処理
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      payload: JSON.stringify(batch),
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    if (code !== 200 && code !== 201) {
      Logger.log('ERROR ' + table + ' batch ' + i + ': ' + res.getContentText());
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
}

function toDateStr(date) {
  if (!date) return null;
  const d = (date instanceof Date) ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function getWorkerId(name) {
  return WORKER_IDS[name] || DEFAULT_WORKER_ID;
}

function getRoomId(name) {
  return ROOM_IDS[name] || null;
}

// ================================================================
// STEP 1: 全データ削除
// ================================================================
function clearAllData() {
  Logger.log('=== 全データ削除開始 ===');
  const tables = [
    'egg_records',
    'feed_records',
    'dead_records',
    'broken_egg_records',
    'unknown_egg_records',
    'memos',
    'announcements',
  ];
  tables.forEach(function(t) { supabaseDelete(t); });
  Logger.log('=== 全データ削除完了 ===');
}

// ================================================================
// STEP 2: 採卵データ移行
// ================================================================
function migrateEggs() {
  // シート名「採卵」を想定
  // 列構成（前回の移行で使ったものに合わせて調整）:
  //   A: 日付, B: 午前/午後, C: 鶏舎名, D: 採卵数, E: 入力者
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('採卵') || ss.getSheetByName('卵');
  if (!sheet) { Logger.log('採卵シートが見つかりません'); return; }

  const data = sheet.getDataRange().getValues();
  const records = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr = toDateStr(row[0]);
    const period  = String(row[1]).trim();   // 午前 or 午後
    const roomName = String(row[2]).trim();
    const count   = Number(row[3]);
    const workerName = String(row[4]).trim();

    if (!dateStr || !period || !roomName || isNaN(count) || count < 0) continue;
    if (period !== '午前' && period !== '午後') continue;
    const roomId = getRoomId(roomName);
    if (!roomId) { Logger.log('不明な鶏舎: ' + roomName); continue; }

    records.push({
      record_date: dateStr,
      period: period,
      room_id: roomId,
      count: count,
      worker_id: getWorkerId(workerName),
    });
  }

  const n = supabaseInsert('egg_records', records);
  Logger.log('採卵: ' + n + '件挿入');
}

// ================================================================
// STEP 3: 餌データ移行
// ================================================================
function migrateFeed() {
  // シート名「餌」を想定
  //   A: 日付, B: 午前/午後, C: 鶏舎名, D: 餌量(kg), E: 入力者
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('餌') || ss.getSheetByName('給餌');
  if (!sheet) { Logger.log('餌シートが見つかりません'); return; }

  const data = sheet.getDataRange().getValues();
  const records = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr  = toDateStr(row[0]);
    const period   = String(row[1]).trim();
    const roomName = String(row[2]).trim();
    const amount   = Number(row[3]);
    const workerName = String(row[4]).trim();

    if (!dateStr || !period || !roomName || isNaN(amount) || amount <= 0) continue;
    if (period !== '午前' && period !== '午後') continue;
    const roomId = getRoomId(roomName);
    if (!roomId) { Logger.log('不明な鶏舎: ' + roomName); continue; }

    records.push({
      record_date: dateStr,
      period: period,
      room_id: roomId,
      amount_kg: amount,
      worker_id: getWorkerId(workerName),
    });
  }

  const n = supabaseInsert('feed_records', records);
  Logger.log('餌: ' + n + '件挿入');
}

// ================================================================
// STEP 4: 死鶏データ移行
// ================================================================
function migrateDead() {
  // シート名「死鶏」を想定
  //   A: 日付, B: 鶏舎名, C: 死鶏数, D: 入力者
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('死鶏') || ss.getSheetByName('死亡');
  if (!sheet) { Logger.log('死鶏シートが見つかりません'); return; }

  const data = sheet.getDataRange().getValues();
  const records = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr  = toDateStr(row[0]);
    const roomName = String(row[1]).trim();
    const count    = Number(row[2]);
    const workerName = String(row[3]).trim();

    if (!dateStr || !roomName || isNaN(count) || count < 0) continue;
    const roomId = getRoomId(roomName);
    if (!roomId) { Logger.log('不明な鶏舎: ' + roomName); continue; }

    records.push({
      record_date: dateStr,
      room_id: roomId,
      count: count,
      worker_id: getWorkerId(workerName),
    });
  }

  const n = supabaseInsert('dead_records', records);
  Logger.log('死鶏: ' + n + '件挿入');
}

// ================================================================
// STEP 5: 破卵データ移行
// ================================================================
function migrateBrokenEggs() {
  // シート名「破卵」を想定
  //   A: 日付, B: 午前/午後, C: 破卵数, D: 入力者
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('破卵');
  if (!sheet) { Logger.log('破卵シートが見つかりません（スキップ）'); return; }

  const data = sheet.getDataRange().getValues();
  const records = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr = toDateStr(row[0]);
    const period  = String(row[1]).trim();
    const count   = Number(row[2]);
    const workerName = String(row[3]).trim();

    if (!dateStr || !period || isNaN(count) || count < 0) continue;
    if (period !== '午前' && period !== '午後') continue;

    records.push({
      record_date: dateStr,
      period: period,
      count: count,
      worker_id: getWorkerId(workerName),
    });
  }

  const n = supabaseInsert('broken_egg_records', records);
  Logger.log('破卵: ' + n + '件挿入');
}

// ================================================================
// STEP 6: メモ移行
// ================================================================
function migrateMemos() {
  // シート名「メモ」を想定
  //   A: 日付, B: 鶏舎名（空欄可）, C: 内容, D: 入力者
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('メモ');
  if (!sheet) { Logger.log('メモシートが見つかりません（スキップ）'); return; }

  const data = sheet.getDataRange().getValues();
  const records = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr  = toDateStr(row[0]);
    const roomName = String(row[1]).trim();
    const text     = String(row[2]).trim();
    const workerName = String(row[3]).trim();

    if (!dateStr || !text) continue;
    const roomId = roomName ? getRoomId(roomName) : null;

    records.push({
      record_date: dateStr,
      room_id: roomId,
      tab: 'special',
      text: text,
      worker_id: getWorkerId(workerName),
    });
  }

  const n = supabaseInsert('memos', records);
  Logger.log('メモ: ' + n + '件挿入');
}

// ================================================================
// STEP 7: お知らせ移行
// ================================================================
function migrateAnnouncements() {
  // シート名「お知らせ」を想定
  //   A: 内容, B: 入力者, C: 日付
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('お知らせ');
  if (!sheet) { Logger.log('お知らせシートが見つかりません（スキップ）'); return; }

  const data = sheet.getDataRange().getValues();
  const records = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const text       = String(row[0]).trim();
    const workerName = String(row[1]).trim();

    if (!text) continue;

    records.push({
      text: text,
      worker_id: getWorkerId(workerName),
      is_active: true,
    });
  }

  const n = supabaseInsert('announcements', records);
  Logger.log('お知らせ: ' + n + '件挿入');
}

// ================================================================
// メイン: 全削除 → 全移行
// ================================================================
function runFullMigration() {
  Logger.log('==============================');
  Logger.log('移行開始: ' + new Date());
  Logger.log('==============================');

  // 1. 全データ削除
  clearAllData();

  // 2. 各データ移行
  migrateEggs();
  migrateFeed();
  migrateDead();
  migrateBrokenEggs();
  migrateMemos();
  migrateAnnouncements();

  Logger.log('==============================');
  Logger.log('移行完了: ' + new Date());
  Logger.log('==============================');
}
