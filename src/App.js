import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Check, X, History, Calculator, Wallet, 
  Sun, Moon, Edit3, Trash2, Clock, Skull, List, Tag, ShieldAlert, RefreshCw, Map as MapIcon, MapPin, ArrowRightLeft, CheckCircle, Grid, Save, Minus, Wand2, Zap, RefreshCcw
} from 'lucide-react';

// === Firebase 引入 ===
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, writeBatch, getDoc, setDoc, runTransaction 
} from "firebase/firestore";

// === 版本號設定 ===
const APP_VERSION = "1215v6-addDiscordBot";

// === Discord Webhook 設定 (請在此填入您的網址) ===
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1450050856094535745/0dvodClTjDzQEc_t5z_cCXNjPTF2wCyilpcWtJJNyX0xGhp4lYcRYOgzOam1IWT9Zqgo"; 

// === Discord 通知輔助函式 ===
const sendDiscordMessage = async (message) => {
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
  } catch (error) {
    console.error("Discord 通知發送失敗", error);
  }
};

// === Firebase 設定檔 ===
const firebaseConfig = {
  apiKey: "AIzaSyCwQjAtEjJGhVv2KuB0HwazdqQ4lhP2I_w",
  authDomain: "nmsl-accounting.firebaseapp.com",
  projectId: "nmsl-accounting",
  storageBucket: "nmsl-accounting.firebasestorage.app",
  messagingSenderId: "623278577938",
  appId: "1:623278577938:web:a7fa005c80168303437bcb",
  measurementId: "G-0B3WN5F2CP"
};

// 初始化 Firebase
let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase 初始化失敗，請檢查設定檔", error);
}

// === 共用常數 ===
const MEMBERS = [
  "水野", "vina", "Avalon", "Ricky", "五十嵐", "水月", "彌砂", "Wolf", "UBS"
];

const EXCHANGE_TYPES = {
  WORLD: { label: '世界', tax: 0.20 },
  GENERAL: { label: '一般', tax: 0.10 }
};

const BASE_LISTING_FEE_PERCENT = 0.02;

// 安全獲取圖片路徑
const getMapPath = () => {
  try {
    return (process.env.PUBLIC_URL || '') + '/map.jpg';
  } catch (e) {
    return '/map.jpg';
  }
};
const MAP_IMAGE_PATH = getMapPath();

// === 工具函式 ===
const formatDate = (isoString) => {
  if (!isoString) return '無紀錄';
  try {
    return new Date(isoString).toLocaleString('zh-TW', {
      month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  } catch (e) { return '日期錯誤'; }
};

const formatTimeOnly = (isoString) => {
  if (!isoString) return '--:--';
  try {
    return new Date(isoString).toLocaleString('zh-TW', {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  } catch (e) { return '--:--'; }
};

const formatTimeWithSeconds = (date) => {
  try {
    return date.toLocaleString('zh-TW', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  } catch (e) { return '--:--:--'; }
};

const getRelativeDay = (dateString) => {
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

const getRandomBrightColor = () => {
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

const getCurrentDateStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentTimeStr = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// 修改: 金額計算邏輯 (納入 listingHistory)
const calculateFinance = (price, typeKey, participantCount, manualCost = 0, listingHistory = []) => {
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

// ==========================================
// Component: ToastNotification (無干擾提示)
// ==========================================
const ToastNotification = ({ message, isVisible }) => {
  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[70] transition-all duration-300 pointer-events-none
      ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
      <div className="bg-green-600 text-white px-6 py-2 rounded-full shadow-lg font-bold flex items-center gap-2">
        <CheckCircle size={18} />
        {message}
      </div>
    </div>
  );
};

// ==========================================
// Component: BalanceGrid (餘額表格 - Excel Style)
// ==========================================
const BalanceGrid = ({ isOpen, onClose, theme, isDarkMode }) => {
  const [gridData, setGridData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !db) return;
    
    const unsub = onSnapshot(doc(db, "settlement_data", "main_grid"), (doc) => {
      if (doc.exists()) {
        setGridData(doc.data().matrix || {});
      } else {
        setGridData({});
      }
      setLoading(false);
    });
    return () => unsub();
  }, [isOpen]);

  const handleCellChange = async (payer, receiver, value) => {
    const key = `${payer}_${receiver}`;
    const newValue = parseFloat(value) || 0;
    
    // 只有當值真的改變時才發送通知，避免誤觸
    if (gridData[key] !== newValue) {
        const msg = `📝 [帳務修改] ${payer} 對 ${receiver} 的欠款已手動修改為 $${newValue.toLocaleString()}`;
        sendDiscordMessage(msg);
    }

    setGridData(prev => ({
      ...prev,
      [key]: newValue
    }));

    if (db) {
       await setDoc(doc(db, "settlement_data", "main_grid"), {
         matrix: { ...gridData, [key]: newValue }
       }, { merge: true });
    }
  };

  const handleAutoBalance = async () => {
    if (!db) return;
    if (!window.confirm("確定要執行「自動劃帳」嗎？\n這將會重新計算並覆蓋目前的表格，將所有複雜的債務簡化為最少筆數。")) return;

    const netBalances = {};
    MEMBERS.forEach(m => netBalances[m] = 0);

    MEMBERS.forEach(payer => {
      MEMBERS.forEach(receiver => {
        if (payer === receiver) return;
        const amount = parseFloat(gridData[`${payer}_${receiver}`]) || 0;
        netBalances[payer] -= amount; 
        netBalances[receiver] += amount; 
      });
    });

    let debtors = []; 
    let creditors = []; 

    MEMBERS.forEach(m => {
      const balance = netBalances[m];
      if (balance < -1) { 
        debtors.push({ name: m, balance: Math.abs(balance) }); 
      } else if (balance > 1) {
        creditors.push({ name: m, balance: balance });
      }
    });

    debtors.sort((a, b) => b.balance - a.balance);
    creditors.sort((a, b) => b.balance - a.balance);

    const newMatrix = {};
    let dIndex = 0;
    let cIndex = 0;

    while (dIndex < debtors.length && cIndex < creditors.length) {
      let debtor = debtors[dIndex];
      let creditor = creditors[cIndex];

      let settleAmount = Math.min(debtor.balance, creditor.balance);
      
      const key = `${debtor.name}_${creditor.name}`;
      newMatrix[key] = (newMatrix[key] || 0) + settleAmount;

      debtor.balance -= settleAmount;
      creditor.balance -= settleAmount;

      if (debtor.balance < 1) dIndex++;
      if (creditor.balance < 1) cIndex++;
    }

    try {
      await setDoc(doc(db, "settlement_data", "main_grid"), {
        matrix: newMatrix
      }, { merge: false });
      
      sendDiscordMessage("⚖️ [系統公告] 已執行「自動劃帳」，全域債務已完成簡化。");
      alert("劃帳完成！債務已簡化。");
    } catch (e) {
      console.error("Auto balance failed", e);
      alert("劃帳失敗，請稍後再試。");
    }
  };

  if (!isOpen) return null;

  const tableStyles = {
      headerCell: isDarkMode ? 'bg-gray-700 text-gray-200 border-gray-600' : 'bg-gray-100 text-gray-700 border-gray-300',
      headerCellSticky: isDarkMode ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-gray-50 text-gray-700 border-gray-300',
      totalHeader: isDarkMode ? 'bg-blue-900/50 text-blue-200 border-gray-600' : 'bg-blue-50 text-blue-800 border-gray-300',
      rowHeader: isDarkMode ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-gray-50 text-gray-800 border-gray-300',
      cell: isDarkMode ? 'border-gray-600' : 'border-gray-300',
      input: isDarkMode ? 'text-gray-100' : 'text-gray-800',
      selfCell: isDarkMode ? 'bg-black/50' : 'bg-black/80',
      rowTotal: isDarkMode ? 'bg-blue-900/30 text-blue-400 border-gray-600' : 'bg-blue-50/30 text-blue-600 border-gray-300',
      incomeHeader: isDarkMode ? 'bg-green-900/50 text-green-200 border-gray-600' : 'bg-green-100 text-green-800 border-gray-300',
      incomeLabel: isDarkMode ? 'bg-green-900/30 text-green-200 border-gray-600' : 'bg-green-50/50 text-green-800 border-gray-300',
      incomeCell: isDarkMode ? 'text-green-400 border-gray-600' : 'text-green-600 border-gray-300',
      emptyCorner: isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-200 border-gray-300'
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-auto">
      <div className={`w-full max-w-6xl rounded-xl p-6 h-[90vh] flex flex-col ${theme.card}`}>
        <div className={`flex justify-between items-center mb-4 border-b pb-2 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-4">
            <h3 className={`text-xl font-bold flex items-center gap-2 ${theme.text}`}>
              <Grid size={24}/> 成員餘額表 (Excel 模式)
            </h3>
            <button 
              onClick={handleAutoBalance}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 shadow transition-colors"
              title="重新計算並簡化所有債務"
            >
              <Wand2 size={16}/> 自動劃帳
            </button>
          </div>
          <button onClick={onClose} className={`p-1 rounded ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}><X size={24}/></button>
        </div>

        <div className="flex-1 overflow-auto">
           {loading ? <div className={`p-10 text-center ${theme.subText}`}>載入中...</div> : (
             <table className="w-full border-collapse min-w-[1000px]">
               <thead>
                 <tr>
                   <th className={`p-2 border min-w-[100px] sticky top-0 left-0 z-20 font-bold ${tableStyles.headerCell}`}>付款\收款</th>
                   {MEMBERS.map(m => (
                     <th key={m} className={`p-2 border min-w-[100px] sticky top-0 z-10 font-bold ${tableStyles.headerCellSticky}`}>{m}</th>
                   ))}
                   <th className={`p-2 border min-w-[100px] sticky top-0 z-10 font-bold ${tableStyles.totalHeader}`}>總計支出</th>
                 </tr>
               </thead>
               <tbody>
                 {MEMBERS.map(payer => {
                   let rowTotal = 0;
                   return (
                     <tr key={payer} className={theme.card}>
                       <th className={`p-2 border sticky left-0 z-10 font-bold ${tableStyles.rowHeader}`}>{payer}</th>
                       {MEMBERS.map(receiver => {
                         const isSelf = payer === receiver;
                         const key = `${payer}_${receiver}`;
                         const val = gridData[key] || 0;
                         if (!isSelf) rowTotal += val;
                         
                         return (
                           <td key={receiver} className={`p-1 border text-center ${tableStyles.cell} ${isSelf ? tableStyles.selfCell : ''}`}>
                             {!isSelf && (
                               <input 
                                 type="number" 
                                 className={`w-full h-full p-1 text-center bg-transparent outline-none font-mono ${tableStyles.input} ${val > 0 ? 'text-red-500 font-bold' : 'opacity-60'}`}
                                 value={val === 0 ? '' : val}
                                 placeholder="0"
                                 onChange={(e) => {
                                    const v = e.target.value;
                                    setGridData(prev => ({...prev, [key]: v})); 
                                 }}
                                 onBlur={(e) => handleCellChange(payer, receiver, e.target.value)}
                               />
                             )}
                           </td>
                         );
                       })}
                       <td className={`p-2 border text-center font-bold ${tableStyles.rowTotal}`}>
                         {rowTotal.toLocaleString()}
                       </td>
                     </tr>
                   );
                 })}
                 <tr className={tableStyles.incomeLabel}>
                    <td className={`p-2 border text-right sticky left-0 z-10 ${tableStyles.incomeHeader}`}>預定收入</td>
                    {MEMBERS.map(receiver => {
                      let colTotal = 0;
                      MEMBERS.forEach(payer => {
                        if (payer !== receiver) {
                          colTotal += parseFloat(gridData[`${payer}_${receiver}`] || 0);
                        }
                      });
                      return <td key={receiver} className={`p-2 border text-center ${tableStyles.incomeCell}`}>{colTotal.toLocaleString()}</td>;
                    })}
                    <td className={`p-2 border ${tableStyles.emptyCorner}`}></td>
                 </tr>
               </tbody>
             </table>
           )}
        </div>
        <div className={`mt-2 text-xs ${theme.subText}`}>
           * 說明：表格數字代表「付款人」欠「收款人」的金額。
           <br/>* 點擊「自動劃帳」會自動將目前表格內所有債務簡化，讓轉帳次數最小化。
        </div>
      </div>
    </div>
  );
};

// ==========================================
// Component: QuickTagPanel (快速標籤面板)
// ==========================================
const QuickTagPanel = ({ 
  isOpen, onClose, bossTemplates, handleAddQuickRecord, isDarkMode, theme 
}) => {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm`}>
      <div className={`w-full max-w-5xl h-[85vh] rounded-xl flex flex-col relative shadow-2xl border-2 ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-white'}`}>
        
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-xl font-bold flex items-center gap-2 ${theme.text}`}>
            <Zap size={24} className="text-yellow-500"/> 快速標籤 (點擊即紀錄)
          </h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-red-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Left: Map */}
          <div className={`flex-1 relative overflow-hidden flex items-center justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
             <div className="relative w-auto h-auto max-w-full max-h-full" style={{ aspectRatio: '1152/851' }}>
                <img src={MAP_IMAGE_PATH} alt="Map" className="w-full h-full block pointer-events-none opacity-80" />
                
                {bossTemplates.filter(t => t.mapPos).map((template, idx) => (
                  <div 
                    key={template.id}
                    onClick={() => handleAddQuickRecord(template)}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group hover:scale-110 transition-transform z-10"
                    style={{ left: `${template.mapPos.x}%`, top: `${template.mapPos.y}%` }}
                    title={`點擊紀錄: ${template.name}`}
                  >
                    <div className="relative">
                      <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: template.color }}></div>
                      {/* Name Label */}
                      <div className={`absolute top-5 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-bold shadow-md
                        ${isDarkMode ? 'bg-black/80 text-white' : 'bg-white/90 text-gray-800'}`}>
                        {template.name}
                      </div>
                    </div>
                  </div>
                ))}
             </div>
             <div className="absolute bottom-4 left-4 text-xs opacity-50 bg-black/30 px-2 py-1 rounded text-white pointer-events-none">
               * 點擊地圖上的點或右側列表皆可快速紀錄
             </div>
          </div>

          {/* Right: List */}
          <div className={`w-full lg:w-72 border-l overflow-y-auto ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
            <div className="p-3">
              <h4 className={`text-sm font-bold mb-3 opacity-70 ${theme.text}`}>Boss 列表</h4>
              <div className="space-y-2">
                {bossTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleAddQuickRecord(template)}
                    className={`w-full text-left p-2 rounded flex items-center gap-2 transition-all active:scale-95
                      ${isDarkMode ? 'hover:bg-gray-800 border border-gray-700' : 'hover:bg-gray-50 border border-gray-100 shadow-sm'}`}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: template.color }}></div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm truncate ${theme.text}`}>{template.name}</div>
                      <div className={`text-xs opacity-60 ${theme.text}`}>CD: {template.respawnMinutes}m</div>
                    </div>
                    <Plus size={16} className="opacity-40"/>
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// ==========================================
// Component: ItemCard (記帳卡片)
// ==========================================
const ItemCard = ({ 
  item, isHistory, theme, 
  updateItemValue, handleSettleAll, handleDelete,
  confirmSettleId, setConfirmSettleId, confirmDeleteId, setConfirmDeleteId
}) => {
  const listingHistory = item.listingHistory || [];
  
  const { afterTaxPrice, perPersonSplit, totalListingFee } = calculateFinance(
    item.price, item.exchangeType, item.participants?.length || 0, item.cost, listingHistory
  );

  const addListingPrice = () => {
      const newPrice = prompt("請輸入該次刊登的「物品價格」(系統將自動計算2%):", item.price);
      if (newPrice) {
          const priceVal = parseFloat(newPrice);
          if (!isNaN(priceVal)) {
              const newHistory = [...listingHistory, priceVal];
              updateItemValue(item.id, 'listingHistory', newHistory);
          }
      }
  };

  const removeListingPrice = (index) => {
      const newHistory = listingHistory.filter((_, i) => i !== index);
      updateItemValue(item.id, 'listingHistory', newHistory);
  };
  
  return (
    <div className={`rounded-xl shadow-md border-l-4 p-6 relative ${theme.card} ${isHistory ? 'border-gray-500 opacity-90' : 'border-blue-500'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-1 w-full pr-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded text-xs">{item.seller}</span>
            <h3 className={`text-xl font-bold ${theme.text}`}>{item.itemName}</h3>
            <span className="px-2 py-0.5 text-xs rounded-full border bg-green-100 text-green-700 border-green-200">
              {EXCHANGE_TYPES[item.exchangeType]?.label || '未知'}
            </span>
          </div>
          {isHistory && <div className="text-xs text-gray-400 flex gap-2"><span>建: {formatDate(item.createdAt)}</span><span>結: {formatDate(item.settledAt)}</span></div>}
        </div>
        
        <div className="absolute top-4 right-4 z-10">
          {confirmDeleteId === item.id ? (
            <div className="flex gap-2 bg-red-50 p-1 rounded border border-red-200">
              <button onClick={() => handleDelete(item.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors">刪除</button>
              <button onClick={() => setConfirmDeleteId(null)} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300 transition-colors">取消</button>
            </div>
          ) : (
            <button onClick={() => { setConfirmDeleteId(item.id); setConfirmSettleId(null); }} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-gray-100 transition-colors"><Trash2 size={18}/></button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-3 gap-4 p-4 rounded mb-4 ${theme.sectionBg}`}>
        <div className="flex flex-col">
          <span className={`text-xs ${theme.subText}`}>售價 (含稅)</span>
          <div className={`text-lg font-bold ${theme.text}`}>
            {!isHistory ? <input type="number" className="bg-transparent w-full border-b border-gray-400 focus:border-blue-500 outline-none" value={item.price} onChange={e => updateItemValue(item.id, 'price', e.target.value)}/> : item.price}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
             稅: {(item.price * (EXCHANGE_TYPES[item.exchangeType]?.tax || 0)).toFixed(0)}
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className={`text-xs ${theme.subText} flex items-center gap-1`}>
             刊登費 (2%) 
             {!isHistory && (
                 <button onClick={addListingPrice} className="bg-blue-500 text-white rounded-full p-0.5 hover:bg-blue-600" title="新增一筆刊登紀錄">
                   <Plus size={10}/>
                 </button>
             )}
          </span>
          <div className="flex flex-col gap-1 mt-1 max-h-20 overflow-y-auto">
             {listingHistory.map((price, idx) => (
                 <div key={idx} className="flex items-center justify-between text-xs bg-black/5 p-1 rounded">
                    <span>${price} <span className="text-gray-400">-> {Math.floor(price * BASE_LISTING_FEE_PERCENT)}</span></span>
                    {!isHistory && <button onClick={() => removeListingPrice(idx)} className="text-red-400 hover:text-red-600"><X size={10}/></button>}
                 </div>
             ))}
             {listingHistory.length === 0 && <span className="text-gray-400 text-xs">- 無紀錄 -</span>}
          </div>
          <div className="text-[10px] text-blue-500 mt-1 font-bold">總計: {totalListingFee}</div>
        </div>

        <div className="flex flex-col">
          <span className={`text-xs ${theme.subText}`}>額外成本 (手動)</span>
          <div className="flex items-center gap-2">
            {!isHistory ? (
               <input type="number" className={`w-full text-right rounded border ${theme.input} text-sm p-1`} value={item.cost || 0} onChange={e => updateItemValue(item.id, 'cost', e.target.value)}/>
            ) : (
              <span className="text-red-400 font-mono">-{item.cost || 0}</span>
            )}
          </div>
          <div className="text-xs text-green-500 mt-2 font-bold border-t pt-1 border-gray-300">
             淨利/人: {perPersonSplit.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {item.participants?.map((p, idx) => (
          <div key={idx} 
               className={`px-2 py-1 rounded border text-xs flex items-center select-none ${theme.card} opacity-80`}>
            {p.name}
          </div>
        ))}
      </div>

      {!isHistory && (
        <div className="mt-4 flex justify-end">
          {confirmSettleId === item.id ? (
            <div className="flex gap-2 items-center flex-wrap justify-end">
              <span className="text-sm text-red-500">將 <b>${perPersonSplit}</b>/人 加入餘額表?</span>
              <button onClick={() => handleSettleAll(item, perPersonSplit)} className="bg-red-500 text-white px-3 py-1 rounded text-sm">確認</button>
              <button onClick={() => setConfirmSettleId(null)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm">取消</button>
            </div>
          ) : (
            <button onClick={() => { setConfirmSettleId(item.id); setConfirmDeleteId(null); }} 
                    className={`flex items-center gap-2 px-4 py-2 rounded font-bold text-sm bg-blue-600 text-white shadow hover:bg-blue-700`}>
              <CheckCircle size={16}/> 已出售
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// Component: EventItem (Boss 時間卡片)
// ==========================================
const EventItem = ({ event, theme, confirmDeleteId, setConfirmDeleteId, handleDeleteEvent, handleOpenEditEvent }) => (
  <div className={`p-3 mb-2 rounded border-l-4 shadow-sm flex justify-between items-center ${theme.card}`} style={{ borderLeftColor: event.color }}>
    <div>
      <div className="font-bold text-sm flex items-center gap-2">
        {event.name}
        {event.mapPos && <MapPin size={12} className="text-blue-500" />}
      </div>
      <div className="text-xs opacity-70 flex items-center gap-1">
        <Skull size={10}/> 亡: {formatTimeOnly(event.deathTime)}
      </div>
      <div className="text-lg font-mono font-bold text-blue-500 flex items-center gap-1">
        <Clock size={14}/> {formatTimeOnly(event.respawnTime)}
      </div>
    </div>
  </div>
);

// ==========================================
// Component: ConnectionOverlay (地圖連線)
// ==========================================
const ConnectionOverlay = ({ displayEvents, now }) => {
  if (!displayEvents || displayEvents.length === 0) return null;

  const sorted = [...displayEvents].sort((a, b) => new Date(a.respawnTime) - new Date(b.respawnTime));
  
  const groups = [];
  if (sorted.length > 0) {
    let currentGroup = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = currentGroup[currentGroup.length - 1];
      const diffMins = Math.abs(new Date(sorted[i].respawnTime) - new Date(prev.respawnTime)) / 1000 / 60;
      
      if (diffMins <= 2) {
        currentGroup.push(sorted[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [sorted[i]];
      }
    }
    groups.push(currentGroup);
  }

  if (groups.length === 0) return null;
  
  const firstGroupTime = new Date(groups[0][0].respawnTime);
  const diffFromNow = (firstGroupTime - now) / 1000 / 60;
  
  if (diffFromNow > 10) return null;

  const lines = [];
  
  for (let i = 0; i < groups.length - 1; i++) {
    const currentGroup = groups[i];
    const nextGroup = groups[i+1];
    
    currentGroup.forEach(startEvent => {
      if (!startEvent.mapPos) return;
      nextGroup.forEach(endEvent => {
        if (!endEvent.mapPos) return;
        
        lines.push(
          <line
            key={`${startEvent.id}-${endEvent.id}`}
            x1={`${startEvent.mapPos.x}%`}
            y1={`${startEvent.mapPos.y}%`}
            x2={`${endEvent.mapPos.x}%`}
            y2={`${endEvent.mapPos.y}%`}
            stroke="rgba(255, 255, 255, 0.6)"
            strokeWidth="2"
            strokeDasharray="5,5"
            className="path-flow"
          />
        );
      });
    });
  }

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
      <style>
        {`
          .path-flow {
            animation: dash 1s linear infinite;
          }
          @keyframes dash {
            to {
              stroke-dashoffset: -10;
            }
          }
        `}
      </style>
      {lines}
    </svg>
  );
};

// ==========================================
// Component: AccountingView
// ==========================================
const AccountingView = ({ isDarkMode, dbReady }) => {
  const [items, setItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmSettleId, setConfirmSettleId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  
  const [isBalanceGridOpen, setIsBalanceGridOpen] = useState(false);
  
  const [historyFilter, setHistoryFilter] = useState({ name: '', date: '', dateType: 'created' });
  
  const [formData, setFormData] = useState({
    seller: MEMBERS[0], itemName: '', price: '', cost: 0, exchangeType: 'GENERAL', participants: [...MEMBERS] 
  });
  const [tempParticipant, setTempParticipant] = useState(MEMBERS[0]);

  useEffect(() => {
    if (!db) return;
    const qItems = query(collection(db, "active_items"), orderBy("createdAt", "desc"));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    const qHistory = query(collection(db, "history_items"), orderBy("settledAt", "desc"));
    const unsubscribeHistory = onSnapshot(qHistory, (snapshot) => {
      setHistoryItems(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });
    return () => { unsubscribeItems(); unsubscribeHistory(); };
  }, [dbReady]);

  const handleAddItem = async () => {
    if (!db) return;
    if (!formData.itemName || !formData.price) { alert("請填寫物品名稱與價格"); return; }
    const finalParticipants = [...new Set([...formData.participants, formData.seller])];
    
    const newItem = {
      ...formData,
      cost: parseFloat(formData.cost) || 0,
      listingHistory: [], 
      participants: finalParticipants.map(p => ({ name: p })),
      isSold: false, createdAt: new Date().toISOString(), settledAt: null 
    };
    await addDoc(collection(db, "active_items"), newItem);
    
    setFormData({ seller: MEMBERS[0], itemName: '', price: '', cost: 0, exchangeType: 'GENERAL', participants: [...MEMBERS] });
    setIsModalOpen(false); setShowHistory(false);
  };

  const updateItemValue = async (id, field, value) => {
    if (!db) return;
    await updateDoc(doc(db, "active_items", id), { [field]: value });
  };

  const handleSettleAll = async (item, perPersonSplit) => {
    if (!db) return;

    try {
      await runTransaction(db, async (transaction) => {
        const gridRef = doc(db, "settlement_data", "main_grid");
        const gridDoc = await transaction.get(gridRef);
        
        let matrix = {};
        if (gridDoc.exists()) {
          matrix = gridDoc.data().matrix || {};
        }

        const seller = item.seller;
        
        item.participants.forEach(p => {
          if (p.name !== seller) {
            const key = `${seller}_${p.name}`; 
            const currentVal = parseFloat(matrix[key]) || 0;
            matrix[key] = currentVal + perPersonSplit;
          }
        });

        transaction.set(gridRef, { matrix }, { merge: true });
      });

      await addDoc(collection(db, "history_items"), { ...item, settledAt: new Date().toISOString() });
      await deleteDoc(doc(db, "active_items", item.id));
      
      setConfirmSettleId(null);
      
      const msg = `💰 [出售通知] \n**${item.seller}** 成功出售了 **${item.itemName}**！\n每人分紅: **$${perPersonSplit.toLocaleString()}**\n(已自動計入餘額表)`;
      sendDiscordMessage(msg);

      alert(`已出售！每人分紅 $${perPersonSplit} 已加入餘額表。`);

    } catch (e) {
      console.error("Settle transaction failed: ", e);
      alert("出售失敗，請重試");
    }
  };

  const handleDelete = async (id) => {
    if (!db) return;
    try {
      if (showHistory) await deleteDoc(doc(db, "history_items", id));
      else await deleteDoc(doc(db, "active_items", id));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Delete failed", error);
      alert("刪除失敗，請稍後再試");
    }
  };

  const removeParticipantFromForm = (name) => {
    setFormData({
      ...formData,
      participants: formData.participants.filter(p => p !== name)
    });
  };

  const theme = {
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: isDarkMode ? 'text-gray-100' : 'text-gray-800', 
    subText: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    input: isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-800',
    sectionBg: isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50',
  };

  const filteredHistory = historyItems.filter(i => {
    if (historyFilter.name && !i.itemName.toLowerCase().includes(historyFilter.name.toLowerCase())) return false;
    if (historyFilter.date) {
      const target = historyFilter.dateType === 'created' ? i.createdAt : i.settledAt;
      if (!target || !target.startsWith(historyFilter.date)) return false;
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-xl font-bold border-l-4 pl-3 ${showHistory ? 'border-gray-500' : 'border-blue-500'} ${theme.text}`}>
          {showHistory ? `歷史紀錄 (${filteredHistory.length})` : `進行中項目 (${items.length})`}
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsBalanceGridOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded bg-purple-600 text-white shadow hover:bg-purple-700"
          >
            <Grid size={18}/> 餘額表格
          </button>
          <button onClick={() => setShowHistory(!showHistory)} className={`flex items-center gap-2 px-3 py-2 rounded ${showHistory ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            <History size={18}/> {showHistory ? '返回' : '歷史'}
          </button>
          {!showHistory && (
             <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded bg-blue-600 text-white shadow hover:bg-blue-700">
               <Plus size={18}/> 新增項目
             </button>
          )}
        </div>
      </div>

      {showHistory && (
        <div className={`p-4 rounded mb-6 flex flex-wrap gap-4 items-end ${isDarkMode ? 'bg-gray-800' : 'bg-white shadow-sm'}`}>
          <div className="flex-1 min-w-[200px]"><label className={`text-xs ${theme.subText}`}>搜尋名稱</label><input type="text" className={`w-full p-2 rounded border ${theme.input}`} value={historyFilter.name} onChange={e=>setHistoryFilter({...historyFilter, name: e.target.value})}/></div>
          <div className="flex-1 min-w-[200px]"><label className={`text-xs ${theme.subText}`}>日期</label><input type="date" className={`w-full p-2 rounded border ${theme.input}`} value={historyFilter.date} onChange={e=>setHistoryFilter({...historyFilter, date: e.target.value})}/></div>
          <button onClick={() => setHistoryFilter({name:'', date:'', dateType:'created'})} className="p-2 bg-gray-200 rounded hover:bg-red-200"><X size={20}/></button>
        </div>
      )}

      <div className="space-y-6">
        {(showHistory ? filteredHistory : items).map(item => (
          <ItemCard 
            key={item.id} 
            item={item} 
            isHistory={showHistory} 
            theme={theme}
            updateItemValue={updateItemValue}
            handleSettleAll={handleSettleAll}
            handleDelete={handleDelete}
            confirmSettleId={confirmSettleId}
            setConfirmSettleId={setConfirmSettleId}
            confirmDeleteId={confirmDeleteId}
            setConfirmDeleteId={setConfirmDeleteId}
          />
        ))}
        {(showHistory ? filteredHistory : items).length === 0 && (
          <div className={`text-center py-20 ${theme.subText}`}>沒有資料</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-2xl rounded-xl p-6 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
            <h3 className="text-xl font-bold mb-4">建立新記帳項目</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="block text-xs mb-1 opacity-70">販賣人</label><select className={`w-full p-2 rounded border ${theme.input}`} value={formData.seller} onChange={e=>setFormData({...formData, seller: e.target.value})}>{MEMBERS.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
              <div><label className="block text-xs mb-1 opacity-70">價格</label><input type="number" className={`w-full p-2 rounded border ${theme.input}`} value={formData.price} onChange={e=>setFormData({...formData, price: e.target.value})}/></div>
              <div><label className="block text-xs mb-1 opacity-70">物品名稱</label><input type="text" className={`w-full p-2 rounded border ${theme.input}`} value={formData.itemName} onChange={e=>setFormData({...formData, itemName: e.target.value})}/></div>
              {/* 改成總成本輸入框 */}
              <div><label className="block text-xs mb-1 opacity-70">額外成本 (手動)</label><input type="number" className={`w-full p-2 rounded border ${theme.input}`} value={formData.cost} onChange={e=>setFormData({...formData, cost: e.target.value})}/></div>
            </div>
            <div className="mb-4 flex gap-2">{Object.keys(EXCHANGE_TYPES).map(k=><button key={k} onClick={()=>setFormData({...formData, exchangeType: k})} className={`flex-1 py-1 rounded border ${formData.exchangeType===k ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 opacity-60'}`}>{EXCHANGE_TYPES[k].label}</button>)}</div>
            <div className="mb-4 pt-4 border-t border-gray-200">
              <div className="flex gap-2 mb-2"><select className={`flex-1 p-2 rounded border ${theme.input}`} value={tempParticipant} onChange={e=>setTempParticipant(e.target.value)}>{MEMBERS.map(m=><option key={m} value={m}>{m}</option>)}</select><button onClick={()=>{if(!formData.participants.includes(tempParticipant))setFormData({...formData, participants:[...formData.participants, tempParticipant]})}} className="bg-green-500 text-white p-2 rounded"><Plus/></button></div>
              <div className="flex flex-wrap gap-2">{formData.participants.map(p=><span key={p} className="bg-gray-100 px-2 py-1 rounded text-sm flex items-center gap-1 text-gray-700">{p}<button onClick={()=>removeParticipantFromForm(p)}><X size={12}/></button></span>)}</div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-gray-700">取消</button>
              <button onClick={handleAddItem} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">建立項目</button>
            </div>
          </div>
        </div>
      )}

      {/* 新的 BalanceGrid Modal (傳入 isDarkMode) */}
      <BalanceGrid 
        isOpen={isBalanceGridOpen} 
        onClose={() => setIsBalanceGridOpen(false)} 
        theme={theme}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

// ==========================================
// Component: BossTimerView
// ==========================================
const BossTimerView = ({ isDarkMode }) => {
  const [bossTemplates, setBossTemplates] = useState([]);
  const [bossEvents, setBossEvents] = useState([]);
  const [now, setNow] = useState(new Date()); 
  const [toastMsg, setToastMsg] = useState(null); // Toast Message State
  
  const [isCreateBossModalOpen, setIsCreateBossModalOpen] = useState(false);
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [isQuickTagOpen, setIsQuickTagOpen] = useState(false); // Quick Tag State

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingBossId, setEditingBossId] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [viewMode, setViewMode] = useState('LIST');

  const [newBossForm, setNewBossForm] = useState({ name: '', respawnMinutes: 60, color: '#FF5733', mapPos: null });
  const [recordForm, setRecordForm] = useState({ 
    templateId: '', timeMode: 'current', specificDate: '', specificTime: ''
  });

  useEffect(() => {
    if (!db) return;
    const unsubTemplates = onSnapshot(collection(db, "boss_templates"), snap => {
      setBossTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const qEvents = query(collection(db, "boss_events"), orderBy("respawnTime", "asc"));
    const unsubEvents = onSnapshot(qEvents, snap => {
      setBossEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubTemplates(); unsubEvents(); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const currentTime = new Date();
      setNow(currentTime);
      bossEvents.forEach(event => {
        const respawnTime = new Date(event.respawnTime);
        const diffMinutes = (currentTime - respawnTime) / 1000 / 60;
        if (diffMinutes > 0.5) {
          if (db) {
            deleteDoc(doc(db, "boss_events", event.id)).catch(err => console.error("Auto delete fail", err));
          }
        }
      });
    }, 1000); 
    return () => clearInterval(timer);
  }, [bossEvents]); 

  // === 同步地圖位置邏輯 ===
  const handleSyncMapPositions = async () => {
    if (!db) return;
    if (!window.confirm("這將會根據目前的 Boss 設定，更新所有進行中計時的地圖位置。\n確定要執行嗎？")) return;

    const batch = writeBatch(db);
    let updateCount = 0;

    bossEvents.forEach(event => {
      const template = bossTemplates.find(t => t.id === event.templateId);
      if (template && template.mapPos) {
        // 如果目前位置不存在，或位置與模板設定不符，就更新
        if (!event.mapPos || event.mapPos.x !== template.mapPos.x || event.mapPos.y !== template.mapPos.y) {
           const docRef = doc(db, "boss_events", event.id);
           batch.update(docRef, { mapPos: template.mapPos });
           updateCount++;
        }
      }
    });

    if (updateCount > 0) {
      try {
        await batch.commit();
        alert(`已更新 ${updateCount} 筆計時的地圖位置！`);
      } catch (e) {
        console.error("Batch update failed", e);
        alert("更新失敗，請稍後再試");
      }
    } else {
      alert("目前所有計時的位置皆為最新。");
    }
  };

  // === Toast Helper ===
  const showToast = (message) => {
    setToastMsg(message);
    setTimeout(() => setToastMsg(null), 2000);
  };

  // === 快速紀錄邏輯 ===
  const handleAddQuickRecord = async (template) => {
    if (!db || !template) return;
    
    const baseTime = new Date();
    const respawnTime = new Date(baseTime.getTime() + template.respawnMinutes * 60000);
    
    const eventData = {
      templateId: template.id,
      name: template.name,
      color: template.color,
      mapPos: template.mapPos || null,
      deathTime: baseTime.toISOString(),
      respawnTime: respawnTime.toISOString(),
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, "boss_events"), eventData);
      showToast(`✅ 已紀錄：${template.name}`); // Trigger Toast
    } catch(e) {
      console.error("Quick add failed", e);
      alert("新增失敗");
    }
  };

  const handleOpenCreateBoss = (bossToEdit = null) => {
    if (bossToEdit) {
      setEditingBossId(bossToEdit.id);
      setNewBossForm({ 
        name: bossToEdit.name, 
        respawnMinutes: bossToEdit.respawnMinutes, 
        color: bossToEdit.color,
        mapPos: bossToEdit.mapPos || null
      });
    } else {
      setEditingBossId(null);
      setNewBossForm({ 
        name: '', 
        respawnMinutes: 60, 
        color: getRandomBrightColor(),
        mapPos: null
      });
    }
    setIsCreateBossModalOpen(true);
  };

  const handleCreateOrUpdateBoss = async () => {
    if (!newBossForm.name) return alert("請輸入 Boss 名稱");
    if (editingBossId) await updateDoc(doc(db, "boss_templates", editingBossId), newBossForm);
    else await addDoc(collection(db, "boss_templates"), newBossForm);
    setIsCreateBossModalOpen(false);
  };

  const handleOpenEditEvent = (event) => {
    setEditingEventId(event.id);
    const dateObj = new Date(event.deathTime);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');

    setRecordForm({
      templateId: event.templateId,
      timeMode: 'specific', 
      specificDate: `${year}-${month}-${day}`,
      specificTime: `${hours}:${minutes}`
    });
    setIsAddRecordModalOpen(true);
  };

  const handleSaveRecord = async () => {
    if (!recordForm.templateId) return alert("請選擇 Boss");
    const template = bossTemplates.find(b => b.id === recordForm.templateId);
    
    let baseTime = new Date();
    if (recordForm.timeMode === 'specific') {
      if (!recordForm.specificDate || !recordForm.specificTime) return alert("請輸入完整的日期與時間");
      baseTime = new Date(`${recordForm.specificDate}T${recordForm.specificTime}`);
    }

    let respawnTime, name, color, mapPos;

    if (template) {
        respawnTime = new Date(baseTime.getTime() + template.respawnMinutes * 60000);
        name = template.name;
        color = template.color;
        mapPos = template.mapPos; 
    } else if (editingEventId) {
        const originalEvent = bossEvents.find(e => e.id === editingEventId);
        if (originalEvent) {
             const originalDuration = new Date(originalEvent.respawnTime) - new Date(originalEvent.deathTime);
             respawnTime = new Date(baseTime.getTime() + originalDuration);
             name = originalEvent.name;
             color = originalEvent.color;
             mapPos = originalEvent.mapPos;
        } else {
            return alert("找不到原始 Boss 設定，無法編輯");
        }
    } else {
        return alert("找不到 Boss 設定 (可能已被刪除)");
    }

    const eventData = {
      templateId: recordForm.templateId,
      name, color, mapPos: mapPos || null,
      deathTime: baseTime.toISOString(),
      respawnTime: respawnTime.toISOString(),
    };

    if (editingEventId) {
        await updateDoc(doc(db, "boss_events", editingEventId), eventData);
    } else {
        eventData.createdAt = new Date().toISOString();
        await addDoc(collection(db, "boss_events"), eventData);
    }

    setIsAddRecordModalOpen(false);
    setEditingEventId(null);
    setRecordForm({ 
        templateId: bossTemplates[0]?.id || '', timeMode: 'current', specificDate: getCurrentDateStr(), specificTime: getCurrentTimeStr() 
    });
  };

  const handleDeleteEvent = async (id) => {
    await deleteDoc(doc(db, "boss_events", id));
    setConfirmDeleteId(null);
  };

  const handleDeleteTemplate = async (id) => {
    if(!window.confirm("確定要刪除這個 Boss 設定嗎？")) return;
    await deleteDoc(doc(db, "boss_templates", id));
  }

  const handleRandomizeColor = () => setNewBossForm({ ...newBossForm, color: getRandomBrightColor() });

  const handleTemplateMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setNewBossForm(prev => ({ ...prev, mapPos: { x, y } }));
  };

  const theme = {
    text: isDarkMode ? 'text-gray-100' : 'text-gray-800',
    subText: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    input: isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800',
  };

  const groupedEvents = {
    yesterday: bossEvents.filter(e => getRelativeDay(e.respawnTime) === 'yesterday'),
    today: bossEvents.filter(e => getRelativeDay(e.respawnTime) === 'today'),
    tomorrow: bossEvents.filter(e => getRelativeDay(e.respawnTime) === 'tomorrow'),
  };

  const displayEvents = bossEvents.filter(e => {
    const diff = (now - new Date(e.respawnTime)) / 1000 / 60;
    return diff <= 0.5; 
  });
  
  const mapDisplayEvents = displayEvents.filter(e => {
    const diff = (new Date(e.respawnTime) - now) / 1000 / 60;
    return diff <= 60; 
  });

  const nextBoss = bossEvents.find(e => new Date(e.respawnTime) > now);

  return (
    <div className="p-4 h-[calc(100vh-80px)] flex flex-col">
      {/* Toast Component */}
      <ToastNotification message={toastMsg} isVisible={!!toastMsg} />

      <div className={`mb-6 p-4 rounded-xl shadow-lg flex flex-col md:flex-row items-center justify-between ${isDarkMode ? 'bg-indigo-900/50 text-white' : 'bg-indigo-600 text-white'}`}>
        <div className="flex items-center gap-4">
          <Clock size={40} className="opacity-80"/>
          <div className="flex flex-col">
            <span className="text-xs opacity-70 font-bold tracking-widest">CURRENT TIME</span>
            <span className="text-3xl font-mono font-bold">{formatTimeWithSeconds(now)}</span>
          </div>
        </div>
        {nextBoss ? (
          <div className="mt-4 md:mt-0 flex items-center gap-3 bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20">
            <span className="text-xs font-bold opacity-70">NEXT BOSS</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" style={{ backgroundColor: nextBoss.color }}></div>
              <span className="text-xl font-bold">{nextBoss.name}</span>
              <span className="font-mono text-lg ml-2">{formatTimeOnly(nextBoss.respawnTime)}</span>
            </div>
          </div>
        ) : (
          <div className="mt-4 md:mt-0 text-white/50 text-sm italic">目前沒有等待中的 Boss</div>
        )}
      </div>

      <div className="flex gap-4 mb-4">
        <button onClick={() => handleOpenCreateBoss()} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded shadow">
          <Plus size={18}/> 建立 Boss
        </button>
        <button onClick={() => { 
          setRecordForm({
            templateId: bossTemplates[0]?.id || '', timeMode: 'current', specificDate: getCurrentDateStr(), specificTime: getCurrentTimeStr(), mapPos: null
          }); 
          setIsAddRecordModalOpen(true); 
        }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded shadow">
          <Tag size={18}/> 新增紀錄
        </button>
        {/* 快速標籤按鈕 */}
        <button onClick={() => setIsQuickTagOpen(true)} className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-white px-4 py-2 rounded shadow">
          <Zap size={18}/> 快速標籤
        </button>

        <div className="ml-auto bg-gray-200 rounded-lg p-1 flex">
           {/* 同步地圖按鈕 */}
           {viewMode === 'MAP' && (
             <button onClick={handleSyncMapPositions} className={`px-3 py-1 rounded flex items-center gap-1 text-sm border-r border-gray-300 text-gray-500 hover:text-blue-500 hover:bg-gray-100`}>
               <RefreshCcw size={14}/> 同步位置
             </button>
           )}
           <button onClick={() => setViewMode('LIST')} className={`px-3 py-1 rounded flex items-center gap-1 text-sm ${viewMode==='LIST' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
             <List size={14}/> 列表
           </button>
           <button onClick={() => setViewMode('MAP')} className={`px-3 py-1 rounded flex items-center gap-1 text-sm ${viewMode==='MAP' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
             <MapIcon size={14}/> 地圖
           </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
        {viewMode === 'LIST' ? (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 h-full overflow-y-auto pb-20">
            {['yesterday', 'today', 'tomorrow'].map(dayKey => (
              <div key={dayKey} className={`rounded-xl p-4 flex flex-col ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50 border'}`}>
                <h3 className={`font-bold mb-3 capitalize text-center py-2 border-b ${theme.text}`}>
                  {dayKey === 'yesterday' ? '昨天' : dayKey === 'today' ? '今天' : '明天'}
                </h3>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {groupedEvents[dayKey].length > 0 ? (
                    groupedEvents[dayKey].map(event => 
                      <EventItem 
                        key={event.id} 
                        event={event} 
                        theme={theme}
                        confirmDeleteId={confirmDeleteId}
                        setConfirmDeleteId={setConfirmDeleteId}
                        handleDeleteEvent={handleDeleteEvent}
                        handleOpenEditEvent={handleOpenEditEvent}
                      />
                    )
                  ) : (
                    <div className="text-center text-sm opacity-40 py-4">無重生紀錄</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`flex-1 relative rounded-xl overflow-hidden shadow-inner flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-200'}`}>
            <div className="relative w-auto h-auto max-w-full max-h-full" style={{ aspectRatio: '1152/851' }}>
               <img src={MAP_IMAGE_PATH} alt="Game Map" className="w-full h-full block" 
                    onError={(e) => { 
                      const parent = e.target.parentElement;
                      if (parent) {
                        e.target.style.display='none'; 
                        parent.classList.add('flex', 'items-center', 'justify-center', 'text-gray-500', 'text-xs', 'bg-gray-300', 'h-64');
                        parent.innerText = '請將 map.jpg 放入 public 資料夾'; 
                      }
                    }} 
               />
               
               <ConnectionOverlay displayEvents={mapDisplayEvents} now={now} />

               {mapDisplayEvents.filter(e => e.mapPos).map((event, index) => {
                 const shouldBlink = (new Date(event.respawnTime) - now) <= 600000;
                 return (
                   <div key={event.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-10"
                        style={{ left: `${event.mapPos.x}%`, top: `${event.mapPos.y}%` }}
                        onClick={() => handleOpenEditEvent(event)} 
                        title="點擊編輯">
                      
                      <div className="relative flex items-center justify-center">
                        {/* 閃爍光環：放在底層，不影響文字顯示 */}
                        {shouldBlink && (
                          <div className="absolute w-full h-full rounded-full animate-ping opacity-75" 
                               style={{ backgroundColor: event.color, transform: 'scale(1.5)' }}>
                          </div>
                        )}
                        
                        {/* 靜態圓圈與編號 */}
                        <div className={`w-5 h-5 rounded-full border-2 border-white shadow-md flex items-center justify-center relative z-10`} style={{ backgroundColor: event.color }}>
                           <span className="text-white text-[10px] font-bold pointer-events-none">{index + 1}</span>
                        </div>
                      </div>

                      {/* 永遠顯示的名稱標籤 (新增) */}
                      <div className={`absolute top-6 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-bold shadow-md z-20 pointer-events-none
                        ${isDarkMode ? 'bg-black/80 text-white' : 'bg-white/90 text-gray-800'}`}>
                        {event.name}
                      </div>

                      {/* 懸停時才顯示的詳細時間 (修改樣式以避免遮擋) */}
                      <div className="absolute top-12 bg-black/90 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none border border-white/20">
                         {index + 1}. {event.name} ({formatTimeOnly(event.respawnTime)})
                      </div>
                   </div>
                 );
               })}
            </div>
          </div>
        )}

        <div className={`w-full lg:w-80 rounded-xl p-4 flex flex-col ${isDarkMode ? 'bg-gray-800' : 'bg-white shadow border'}`}>
          <h3 className={`font-bold mb-3 flex items-center gap-2 ${theme.text}`}>
            <List size={20}/> 重生順序列表
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2">
            {displayEvents.length > 0 ? (
              displayEvents.map(event => (
                <div key={'list'+event.id} className="flex items-center p-2 border-b border-gray-100 last:border-0 relative hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: event.color }}></div>
                    <span className={`text-sm truncate ${theme.text}`} title={event.name}>{event.name}</span>
                  </div>
                  
                  <div className={`w-14 text-right font-mono font-bold ${((new Date(event.respawnTime) - now) <= 600000) ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}>
                    {formatTimeOnly(event.respawnTime)}
                  </div>
                  
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => handleOpenEditEvent(event)} className="text-gray-400 hover:text-blue-500 p-1 rounded" title="編輯">
                      <Edit3 size={14}/>
                    </button>
                    {confirmDeleteId === event.id ? (
                      <button onClick={() => handleDeleteEvent(event.id)} className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded animate-bounce">
                        確認
                      </button>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(event.id)} className="text-gray-400 hover:text-red-500 p-1 rounded" title="刪除">
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center opacity-50 py-4">目前沒有等待中的 Boss</div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
             <h4 className="text-xs font-bold mb-2 opacity-70">Boss 設定列表</h4>
             <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
               {bossTemplates.map(t => (
                 <div key={t.id} className={`text-xs px-2 py-1.5 rounded flex items-center justify-between ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full" style={{backgroundColor: t.color}}></div>
                     <span className={theme.text}>{t.name} ({t.respawnMinutes}m)</span>
                   </div>
                   <div className="flex gap-2">
                     <button onClick={() => handleOpenCreateBoss(t)} className="text-blue-500 hover:text-blue-600"><Edit3 size={12}/></button>
                     <button onClick={() => handleDeleteTemplate(t.id)} className="text-gray-400 hover:text-red-500"><X size={12}/></button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>

      {isCreateBossModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-lg rounded-xl p-6 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
            <h3 className="text-lg font-bold mb-4">{editingBossId ? '編輯 Boss 設定' : '建立 Boss 設定'}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs opacity-70">Boss 名稱</label><input type="text" className={`w-full p-2 rounded border ${theme.input}`} value={newBossForm.name} onChange={e=>setNewBossForm({...newBossForm, name: e.target.value})}/></div>
                <div><label className="text-xs opacity-70">重生時間 (分鐘)</label><input type="number" className={`w-full p-2 rounded border ${theme.input}`} value={newBossForm.respawnMinutes} onChange={e=>setNewBossForm({...newBossForm, respawnMinutes: parseInt(e.target.value)||0})}/></div>
              </div>
              
              <div>
                <label className="text-xs opacity-70">標籤顏色</label>
                <div className="flex gap-2">
                  <input type="color" className="flex-1 h-10 rounded cursor-pointer" value={newBossForm.color} onChange={e=>setNewBossForm({...newBossForm, color: e.target.value})}/>
                  <button onClick={handleRandomizeColor} className="bg-gray-200 text-gray-700 px-3 rounded hover:bg-gray-300" title="隨機顏色"><RefreshCw size={16}/></button>
                </div>
              </div>

              <div>
                <label className="text-xs opacity-70">重生位置 (請直接點擊地圖)</label>
                <div className="relative w-full h-auto bg-gray-200 mt-1 cursor-crosshair rounded overflow-hidden" onClick={handleTemplateMapClick}>
                   <img src={MAP_IMAGE_PATH} alt="Map" className="w-full h-auto block pointer-events-none" 
                        onError={(e) => { 
                          const parent = e.target.parentElement;
                          if (parent) {
                            e.target.style.display='none'; 
                            parent.classList.add('flex', 'items-center', 'justify-center', 'text-gray-500', 'text-xs', 'bg-gray-300', 'h-64');
                            parent.innerText = '請將 map.jpg 放入 public 資料夾'; 
                          }
                        }} 
                   />
                   {newBossForm.mapPos && (
                     <div className="absolute w-4 h-4 bg-red-500 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow"
                          style={{ left: `${newBossForm.mapPos.x}%`, top: `${newBossForm.mapPos.y}%` }}>
                     </div>
                   )}
                </div>
                <div className="text-[10px] text-gray-400 mt-1 text-center">
                  {newBossForm.mapPos ? `已設定位置: ${newBossForm.mapPos.x.toFixed(1)}%, ${newBossForm.mapPos.y.toFixed(1)}%` : '尚未設定位置 (選填)'}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setIsCreateBossModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">取消</button>
              <button onClick={handleCreateOrUpdateBoss} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">{editingBossId ? '更新' : '建立'}</button>
            </div>
          </div>
        </div>
      )}

      {isAddRecordModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-sm rounded-xl p-6 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
            <h3 className="text-lg font-bold mb-4">{editingEventId ? '編輯標籤時間' : '新增 Boss 標籤'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs opacity-70">選擇 Boss</label>
                <select className={`w-full p-2 rounded border ${theme.input}`} value={recordForm.templateId} onChange={e=>setRecordForm({...recordForm, templateId: e.target.value})} disabled={!!editingEventId}>
                  <option value="" disabled>請選擇...</option>
                  {bossTemplates.map(t => <option key={t.id} value={t.id}>{t.name} (CD: {t.respawnMinutes}m)</option>)}
                </select>
              </div>
              
              <div>
                <label className="text-xs opacity-70">死亡時間基準</label>
                {!editingEventId && (
                  <div className="flex gap-2 mt-1 mb-2">
                    <button onClick={()=>setRecordForm({...recordForm, timeMode: 'current'})} className={`flex-1 py-2 rounded text-sm border ${recordForm.timeMode==='current' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 opacity-60'}`}>當前時間</button>
                    <button onClick={()=>setRecordForm({...recordForm, timeMode: 'specific'})} className={`flex-1 py-2 rounded text-sm border ${recordForm.timeMode==='specific' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 opacity-60'}`}>指定時間</button>
                  </div>
                )}
              </div>
              {(recordForm.timeMode === 'specific' || editingEventId) && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs opacity-70">日期</label>
                    <input type="date" className={`w-full p-2 rounded border ${theme.input}`} value={recordForm.specificDate} onChange={e=>setRecordForm({...recordForm, specificDate: e.target.value})}/>
                  </div>
                  <div>
                    <label className="text-xs opacity-70">時間 (24h)</label>
                    <input type="time" className={`w-full p-2 rounded border ${theme.input}`} value={recordForm.specificTime} onChange={e=>setRecordForm({...recordForm, specificTime: e.target.value})}/>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setIsAddRecordModalOpen(false); setEditingEventId(null); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">取消</button>
              <button onClick={handleSaveRecord} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{editingEventId ? '更新' : '建立'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 快速標籤面板 (QuickTagPanel) */}
      <QuickTagPanel 
        isOpen={isQuickTagOpen} 
        onClose={() => setIsQuickTagOpen(false)}
        bossTemplates={bossTemplates}
        handleAddQuickRecord={handleAddQuickRecord}
        isDarkMode={isDarkMode}
        theme={theme}
      />
    </div>
  );
};

export default function App() {
  // 修改: 預設顯示 Boss Timer
  const [currentTab, setCurrentTab] = useState('BOSS_TIMER');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    if (db) setDbReady(true);
    const savedTheme = localStorage.getItem('accounting_theme');
    if (savedTheme) setIsDarkMode(savedTheme === 'dark');
  }, []);

  useEffect(() => {
    localStorage.setItem('accounting_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const theme = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-slate-100',
    nav: isDarkMode ? 'bg-gray-800' : 'bg-slate-900',
    text: isDarkMode ? 'text-gray-100' : 'text-gray-800', 
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${theme.bg} ${theme.text}`}>
      {!dbReady && (
        <div className="bg-red-600 text-white p-2 text-center text-sm font-bold sticky top-0 z-50">
           尚未初始化 Firebase，請檢查金鑰設定！
        </div>
      )}

      {/* Version Label */}
      <div className="absolute top-0 left-0 p-1 text-[10px] text-gray-500 opacity-50 pointer-events-none z-50">
        {APP_VERSION}
      </div>

      <nav className={`${theme.nav} text-white px-4 py-3 shadow-lg sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="bg-blue-500 p-2 rounded-lg">
                {currentTab === 'ACCOUNTING' ? <Calculator size={24} className="text-white" /> : <ShieldAlert size={24} className="text-white" />}
             </div>
             <h1 className="text-2xl font-bold tracking-wider hidden md:block">
               {currentTab === 'ACCOUNTING' ? '團隊記帳表' : 'Boss 重生計時'}
             </h1>
             <div className="flex md:hidden bg-gray-700 rounded-lg p-1">
                <button onClick={()=>setCurrentTab('ACCOUNTING')} className={`px-3 py-1 rounded ${currentTab==='ACCOUNTING'?'bg-blue-600 text-white':'text-gray-300'}`}>記帳</button>
                <button onClick={()=>setCurrentTab('BOSS_TIMER')} className={`px-3 py-1 rounded ${currentTab==='BOSS_TIMER'?'bg-purple-600 text-white':'text-gray-300'}`}>Boss</button>
             </div>
          </div>

          <div className="flex gap-3 items-center">
            <div className="hidden md:flex gap-2 mr-4 bg-gray-700/50 p-1 rounded-lg">
               <button 
                 onClick={() => setCurrentTab('ACCOUNTING')}
                 className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-all ${currentTab === 'ACCOUNTING' ? 'bg-blue-600 text-white shadow' : 'hover:bg-white/10 text-gray-300'}`}
               >
                 <Calculator size={16}/> 團隊記帳
               </button>
               <button 
                 onClick={() => setCurrentTab('BOSS_TIMER')}
                 className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-all ${currentTab === 'BOSS_TIMER' ? 'bg-purple-600 text-white shadow' : 'hover:bg-white/10 text-gray-300'}`}
               >
                 <ShieldAlert size={16}/> Boss 時間
               </button>
            </div>

            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
              {isDarkMode ? <Sun size={20} className="text-yellow-300" /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </nav>

      <main className="relative">
        {currentTab === 'ACCOUNTING' ? (
          <AccountingView isDarkMode={isDarkMode} dbReady={dbReady} />
        ) : (
          <BossTimerView isDarkMode={isDarkMode} />
        )}
      </main>
    </div>
  );
}