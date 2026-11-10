/**
 * 空城計 3D 冒險 —— 線上排行榜（Google Apps Script）
 * 功能：寫入成績、列出前 30 名、超過 7 天的紀錄自動刪除
 * 使用方式請看同資料夾的「排行榜設定說明.txt」
 */
const SHEET_NAME = '排行榜';
const KEEP_DAYS = 7;     // 保留天數
const TOP_N = 30;        // 顯示名次

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sh = getSheet_();
    purgeOld_(sh);
    if (p.action === 'add') {
      const name = String(p.name || '').replace(/[<>]/g, '').slice(0, 12).trim();
      const score = Math.max(0, Math.min(800, parseInt(p.score, 10) || 0));
      const title = String(p.title || '').replace(/[<>]/g, '').slice(0, 10);
      if (name) sh.appendRow([name, score, title, Date.now(), new Date()]);
    }
    out = { ok: true, rows: list_(sh, Math.min(100, parseInt(p.top, 10) || TOP_N)) };
  } catch (err) {
    out = { ok: false, error: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
  const json = JSON.stringify(out);
  const cb = p.callback;
  if (cb && /^[A-Za-z0-9_]+$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); sh.appendRow(['名稱', '分數', '稱號', '時間戳記(ms)', '日期']); }
  return sh;
}

// 刪除超過 KEEP_DAYS 天的紀錄
function purgeOld_(sh) {
  const last = sh.getLastRow(); if (last < 2) return;
  const values = sh.getRange(2, 1, last - 1, 5).getValues();
  const now = Date.now();
  const keep = values.filter(r => now - Number(r[3]) < KEEP_DAYS * 864e5);
  if (keep.length === values.length) return;
  sh.getRange(2, 1, last - 1, 5).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, 5).setValues(keep);
}

function list_(sh, top) {
  const last = sh.getLastRow(); if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 4).getValues()
    .filter(r => r[0] !== '')
    .map(r => ({ name: r[0], score: Number(r[1]), title: r[2], time: Number(r[3]) }))
    .sort((a, b) => b.score - a.score || a.time - b.time)
    .slice(0, top);
}

// （可選）建立每日自動清理的觸發器：在編輯器中選這個函式按「執行」一次即可
function setupDailyPurge() {
  ScriptApp.newTrigger('dailyPurge').timeBased().everyDays(1).atHour(3).create();
}
function dailyPurge() { purgeOld_(getSheet_()); }
