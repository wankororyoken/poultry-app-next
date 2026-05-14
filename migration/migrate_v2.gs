// ================================================================
// 養鶏管理アプリ データ移行スクリプト v2.1
// 使い方: runFullMigration() を実行（全削除 → 全移行）
// ================================================================

// ▼ スプレッドシートID（URLの /d/【ここ】/edit 部分）
const SPREADSHEET_ID = '1C5Aa1dZ15utX3jUEZQn17ljTBzlddjUCUmGypfaPf-s';

const SUPABASE_URL = 'https://bkgqbpmumhohrgqybprj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fFtTJahMFgXDzrXF1Mj59A_MP9LaetZ';

// 鶏舎名 → UUID
const ROOM_IDS = {
  '1~3番':  '6a1ce79b-28fe-4aa4-84cf-ff19fd9cbc19',
  '4番':    '061aed33-13ed-447c-b683-02601b6e9a89',
  '6番':    '07e6e909-cc0b-4543-b0f6-53f4414904cd',
  '7番':    'ea7d7136-f2da-44d7-bd71-82aec8231150',
  '8番':    '919a4ef0-e789-432a-bf22-8e47daa50981',
  '9番':    'f744b0d2-005b-41a9-b094-3a4d4598b25b',
  '10番':   'b30d8b49-d86f-4849-8b70-c6aef955e147',
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
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) Logger.log('⚠ シートが見つかりません: ' + name);
  return sheet;
}

function supabaseDelete(table) {
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
  if (records.length === 0) { Logger.log(table + ': 0件（スキップ）'); return 0; }
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
      Logger.log('ERROR ' + table + ' batch ' + i + ': ' + res.getContentText().substring(0, 200));
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
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function getWorkerId(name) { return WORKER_IDS[String(name).trim()] || DEFAULT_WORKER_ID; }
function getRoomId(name)   { return ROOM_IDS[String(name).trim()] || null; }

// ================================================================
// STEP 1: 全データ削除
// ================================================================
function clearAllData() {
  Logger.log('=== 全データ削除開始 ===');
  ['egg_records','feed_records','dead_records',
   'broken_egg_records','unknown_egg_records','memos','announcements'
  ].forEach(function(t) { supabaseDelete(t); });
  Logger.log('=== 全データ削除完了 ===');
}

// ================================================================
// STEP 2: 採卵記録
// シート「採卵記録」: A=日付, B=時間帯, C=鶏舎, D=採卵数, E=入力者
// ================================================================
function migrateEggs() {
  const sheet = getSheet('採卵記録');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const records = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr    = toDateStr(row[0]);
    const period     = String(row[1]).trim();
    const roomName   = String(row[2]).trim();
    const count      = Number(row[3]);
    const workerName = String(row[4]).trim();
    if (!dateStr || !roomName || isNaN(count) || count < 0) continue;
    if (period !== '午前' && period !== '午後') continue;
    const roomId = getRoomId(roomName);
    if (!roomId) { Logger.log('採卵: 不明な鶏舎 [' + roomName + '] 行' + (i+1)); continue; }
    records.push({ record_date: dateStr, period, room_id: roomId, count, worker_id: getWorkerId(workerName) });
  }
  Logger.log('採卵: ' + supabaseInsert('egg_records', records) + '件挿入');
}

// ================================================================
// STEP 3: 餌記録
// シート「餌記録」: A=日付, B=時間帯, C=鶏舎, D=餌の量(kg), E=入力者
// ================================================================
function migrateFeed() {
  const sheet = getSheet('餌記録');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const records = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr    = toDateStr(row[0]);
    const period     = String(row[1]).trim();
    const roomName   = String(row[2]).trim();
    const amount     = Number(row[3]);
    const workerName = String(row[4]).trim();
    if (!dateStr || !roomName || isNaN(amount) || amount <= 0) continue;
    if (period !== '午前' && period !== '午後') continue;
    const roomId = getRoomId(roomName);
    if (!roomId) { Logger.log('餌: 不明な鶏舎 [' + roomName + '] 行' + (i+1)); continue; }
    records.push({ record_date: dateStr, period, room_id: roomId, amount_kg: amount, worker_id: getWorkerId(workerName) });
  }
  Logger.log('餌: ' + supabaseInsert('feed_records', records) + '件挿入');
}

// ================================================================
// STEP 4: 死鶏記録
// シート「死鶏記録」: A=日付, B=鶏舎, C=死鶏数, D=入力者
// ================================================================
function migrateDead() {
  const sheet = getSheet('死鶏記録');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const records = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr    = toDateStr(row[0]);
    const roomName   = String(row[1]).trim();
    const count      = Number(row[2]);
    const workerName = String(row[3]).trim();
    if (!dateStr || !roomName || isNaN(count) || count < 0) continue;
    const roomId = getRoomId(roomName);
    if (!roomId) { Logger.log('死鶏: 不明な鶏舎 [' + roomName + '] 行' + (i+1)); continue; }
    records.push({ record_date: dateStr, room_id: roomId, count, worker_id: getWorkerId(workerName) });
  }
  Logger.log('死鶏: ' + supabaseInsert('dead_records', records) + '件挿入');
}

// ================================================================
// STEP 5: 破卵記録
// シート「破卵記録」: A=日付, B=時間帯, C=破卵数, D=入力者
// ================================================================
function migrateBrokenEggs() {
  const sheet = getSheet('破卵記録');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const records = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr    = toDateStr(row[0]);
    const period     = String(row[1]).trim();
    const count      = Number(row[2]);
    const workerName = String(row[3]).trim();
    if (!dateStr || isNaN(count) || count < 0) continue;
    if (period !== '午前' && period !== '午後') continue;
    records.push({ record_date: dateStr, period, count, worker_id: getWorkerId(workerName) });
  }
  Logger.log('破卵: ' + supabaseInsert('broken_egg_records', records) + '件挿入');
}

// ================================================================
// STEP 6: 不明卵記録
// シート「不明卵記録」: A=日付, B=鶏舎（任意）, C=場所, D=詳細（任意）, E=入力者
// ================================================================
function migrateUnknownEggs() {
  const sheet = getSheet('不明卵記録');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const records = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr    = toDateStr(row[0]);
    const roomName   = String(row[1]).trim();
    const location   = String(row[2]).trim();
    const detail     = String(row[3]).trim();
    const workerName = String(row[4]).trim();
    if (!dateStr || !location) continue;
    const roomId = roomName ? getRoomId(roomName) : null;
    records.push({
      record_date: dateStr,
      room_id: roomId || null,
      location: location,
      location_detail: detail || null,
      worker_id: getWorkerId(workerName),
    });
  }
  Logger.log('不明卵: ' + supabaseInsert('unknown_egg_records', records) + '件挿入');
}

// ================================================================
// STEP 7: メモ記録
// シート「メモ記録」: A=日付, B=鶏舎（任意）, C=内容, D=入力者
// ================================================================
function migrateMemos() {
  const sheet = getSheet('メモ記録');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const records = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr    = toDateStr(row[0]);
    const roomName   = String(row[1]).trim();
    const text       = String(row[2]).trim();
    const workerName = String(row[3]).trim();
    if (!dateStr || !text) continue;
    const roomId = roomName ? getRoomId(roomName) : null;
    records.push({ record_date: dateStr, room_id: roomId || null, tab: 'special', text, worker_id: getWorkerId(workerName) });
  }
  Logger.log('メモ: ' + supabaseInsert('memos', records) + '件挿入');
}

// ================================================================
// STEP 8: お知らせ
// シート「お知らせ」: A=内容, B=入力者
// ================================================================
function migrateAnnouncements() {
  const sheet = getSheet('お知らせ');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const records = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const text       = String(row[0]).trim();
    const workerName = String(row[1]).trim();
    if (!text) continue;
    records.push({ text, worker_id: getWorkerId(workerName), is_active: true });
  }
  Logger.log('お知らせ: ' + supabaseInsert('announcements', records) + '件挿入');
}

// ================================================================
// メイン: 全削除 → 全移行
// ================================================================
function runFullMigration() {
  Logger.log('==============================');
  Logger.log('移行開始: ' + new Date());
  Logger.log('==============================');
  clearAllData();
  migrateEggs();
  migrateFeed();
  migrateDead();
  migrateBrokenEggs();
  migrateUnknownEggs();
  migrateMemos();
  migrateAnnouncements();
  Logger.log('==============================');
  Logger.log('移行完了: ' + new Date());
  Logger.log('==============================');
}
