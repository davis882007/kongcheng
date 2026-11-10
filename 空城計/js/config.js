/* =========================================================
   config.js — 遊戲設定（可編輯）
   leaderboardUrl：線上排行榜網址（Google Apps Script 部署後的 /exec 網址）
     ‧ 留空 = 只使用「本機排行榜」（存在這台電腦的瀏覽器）
     ‧ 設定方式請看資料夾中的「排行榜設定說明.txt」
   ========================================================= */
window.GAME_CONFIG = {
  leaderboardUrl: 'https://script.google.com/macros/s/AKfycbzkYSnz1UTgGrBbxshmGvZHt_jCp1Ub5UJi58hP8swA7v5cqUQ4-lcdIhBnkrKCu_Fkwg/exec',
  leaderboardTop: 30,       // 顯示前幾名
  keepDays: 7,              // 紀錄保留天數（超過自動刪除）
  certificateTitle: '空城計 智謀大師 成就證書',
  schoolName: ''            // 可填學校／班級名稱，會印在證書上
};
