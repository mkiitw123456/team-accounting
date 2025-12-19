// src/utils/helpers.js
import { 
  DISCORD_NOTIFY_WEBHOOK_URL, 
  DISCORD_LOG_WEBHOOK_URL, 
  EXCHANGE_TYPES, 
  BASE_LISTING_FEE_PERCENT 
} from './constants';

// 安全獲取圖片路徑
export const getMapPath = () => {
  try {
    return (process.env.PUBLIC_URL || '') + '/map.jpg';
  } catch (e) {
    return '/map.jpg';
  }
};

export const MAP_IMAGE_PATH = getMapPath();

// === Discord 輔助函式 ===
export const sendDiscordMessage = async (url, content) => {
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content }),
    });
  } catch (error) {
    console.error("Discord 通知發送失敗", error);
  }
};

export const sendNotify = (msg) => sendDiscordMessage(DISCORD_NOTIFY_WEBHOOK_URL, msg);

export const sendLog = (user, action, detail) => {
  const timestamp = new Date().toLocaleString('zh-TW', { hour12: false });
  const msg = `\`[${timestamp}]\` **${user || '未具名'}** ${action}：${detail}`;
  sendDiscordMessage(DISCORD_LOG_WEBHOOK_URL, msg);
};

// === 日期時間工具 ===
export const formatDate = (isoString) => {
  if (!isoString) return '無紀錄';
  try {
    return new Date(isoString).toLocaleString('zh-TW', {
      month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  } catch (e) { return '日期錯誤'; }
};

export const formatTimeOnly = (isoString) => {
  if (!isoString) return '--:--';
  try {
    return new Date(isoString).toLocaleString('zh-TW', {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  } catch (e) { return '--:--'; }
};

export const formatTimeWithSeconds = (date) => {
  try {
    return date.toLocaleString('zh-TW', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  } catch (e) { return '--:--:--'; }
};

export const getRelativeDay = (dateString) => {
  try {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === -1) return 'yesterday';
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    return 'other';
  } catch (e) { return 'other'; }
};

export const getCurrentDateStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// src/utils/helpers.js

export const getCurrentTimeStr = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0'); // 新增這行
  return `${hours}:${minutes}:${seconds}`; // 改成回傳 時:分:秒
};

// === 其他工具 ===
export const getRandomBrightColor = () => {
  const h = Math.floor(Math.random() * 360);
  const s = 70 + Math.random() * 30; 
  const l = 45 + Math.random() * 15; 
  
  const lDiv = l / 100;
  const a = s * Math.min(lDiv, 1 - lDiv) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = lDiv - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const getYouTubeID = (url) => {
  if (!url) return '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : url; 
};

export const calculateFinance = (price, typeKey, participantCount, manualCost = 0, listingHistory = []) => {
  const p = parseFloat(price) || 0;
  const cost = parseFloat(manualCost) || 0;
  const typeTax = EXCHANGE_TYPES[typeKey]?.tax || 0;
  
  const taxAmount = p * typeTax;

  const totalListingFee = listingHistory.reduce((sum, listingPrice) => {
      return sum + Math.floor((parseFloat(listingPrice) || 0) * BASE_LISTING_FEE_PERCENT);
  }, 0);
  
  const netIncome = Math.floor(p - taxAmount - cost - totalListingFee);
  
  const count = participantCount > 0 ? participantCount : 1;
  
  let rawSplit = Math.floor(netIncome / count);
  const perPersonSplit = Math.floor(rawSplit / 10000) * 10000;

  return { afterTaxPrice: netIncome, perPersonSplit, taxAmount, cost, totalListingFee };
};