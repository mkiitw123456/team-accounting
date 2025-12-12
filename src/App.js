import React, { useState, useEffect } from 'react';
import { 
  Plus, Check, X, History, Users, Calculator, Wallet, 
  ArrowRight, Sun, Moon, Edit3, Trash2, Search, Filter, Calendar
} from 'lucide-react';

// === Firebase 引入 ===
// 如果你在本地開發，請記得執行 npm install firebase
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy 
} from "firebase/firestore";

// === Firebase 設定檔 (請填入你的設定) ===
// 這裡的資料需要從 Firebase Console 取得
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
  // 簡單檢查是否已填入 key，避免初始化錯誤
  if (firebaseConfig.apiKey !== "請填入你的_apiKey") {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
} catch (error) {
  console.error("Firebase 初始化失敗，請檢查設定檔", error);
}

const MEMBERS = [
  "水野", "vina", "Avalon", "Ricky", "五十嵐", "水月", "彌砂", "Wolf", "UBS"
];

const EXCHANGE_TYPES = {
  WORLD: { label: '世界', tax: 0.20 },
  GENERAL: { label: '一般', tax: 0.10 }
};

const BASE_LISTING_FEE_PERCENT = 0.02;

const formatDate = (isoString) => {
  if (!isoString) return '無紀錄';
  return new Date(isoString).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit', 
    hour: '2-digit', minute: '2-digit'
  });
};

const calculateFinance = (price, typeKey, participantCount, listingCount = 1) => {
  const p = parseFloat(price) || 0;
  const lCount = parseInt(listingCount) || 1;
  const typeTax = EXCHANGE_TYPES[typeKey]?.tax || 0;
  
  const listingFeeRate = lCount * BASE_LISTING_FEE_PERCENT;
  const totalTaxRate = listingFeeRate + typeTax;
  
  const afterTaxPrice = Math.floor(p * (1 - totalTaxRate));
  const count = participantCount > 0 ? participantCount : 1;
  const perPersonSplit = Math.floor(afterTaxPrice / count);

  return { afterTaxPrice, perPersonSplit, totalTaxRate, listingFeeRate };
};

// 獨立卡片元件
const ItemCard = ({ 
  item, 
  isHistory = false, 
  theme, 
  isDarkMode,
  updateItemValue,
  toggleParticipantSettled,
  handleSettleAll,
  handleDelete,
  confirmSettleId,
  setConfirmSettleId,
  confirmDeleteId,
  setConfirmDeleteId
}) => {
  const { afterTaxPrice, perPersonSplit, totalTaxRate, listingFeeRate } = calculateFinance(
    item.price, 
    item.exchangeType, 
    item.participants.length,
    item.listingCount
  );

  const isAllParticipantsSettled = item.participants.every(p => p.isSettled);

  return (
    <div className={`rounded-xl shadow-md border-l-4 p-6 transition-all hover:shadow-lg relative ${theme.card} ${
      isHistory ? 'border-gray-500 opacity-90' : 'border-blue-500'
    }`}>
      {/* 頂部區域 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div className="flex flex-col gap-1 pr-8 w-full">
           <div className="flex flex-wrap items-center gap-3">
              <div className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-md text-sm">
                {item.seller}
              </div>
              <h3 className={`text-xl font-bold ${theme.text}`}>{item.itemName}</h3>
              <span className={`px-2 py-0.5 text-xs rounded-full border ${
                item.exchangeType === 'WORLD' 
                ? 'bg-purple-100 text-purple-700 border-purple-200' 
                : 'bg-green-100 text-green-700 border-green-200'
              }`}>
                {EXCHANGE_TYPES[item.exchangeType].label}
              </span>
              {isHistory && (
                <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full border border-orange-200">
                  刊登 {item.listingCount || 1} 次
                </span>
              )}
           </div>
           
           {isHistory && (
             <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1">
               <span className="flex items-center gap-1"><Calendar size={10}/> 建立: {formatDate(item.createdAt)}</span>
               <span className="flex items-center gap-1"><Check size={10}/> 結算: {formatDate(item.settledAt)}</span>
             </div>
           )}
        </div>

        {/* 刪除按鈕 */}
        <div className="absolute top-4 right-4 flex items-center">
          {confirmDeleteId === item.id ? (
            <div className="flex items-center gap-2 bg-red-50 p-1 rounded-lg border border-red-200 animate-fadeIn mr-2 z-10">
              <span className="text-xs text-red-600 font-bold ml-1">確定刪除?</span>
              <button 
                onClick={() => handleDelete(item.id)}
                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
              >
                是
              </button>
              <button 
                onClick={() => setConfirmDeleteId(null)}
                className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
              >
                否
              </button>
            </div>
          ) : (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteId(item.id);
                setConfirmSettleId(null);
              }}
              className={`p-2 rounded-full transition-colors ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'
              }`}
              title="刪除此項目"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 財務資訊區塊 */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg mb-4 ${theme.sectionBg}`}>
        <div className="flex flex-col">
          <span className={`text-xs ${theme.subText} mb-1 flex items-center gap-1`}>
            {!isHistory && <Edit3 size={10} />}
            原始販售價格
          </span>
          <div className={`text-lg font-semibold flex items-center ${theme.text}`}>
            <span className="text-sm mr-1">$</span>
            {isHistory ? (
                parseInt(item.price).toLocaleString()
            ) : (
              <input 
                type="number"
                value={item.price}
                onChange={(e) => updateItemValue(item.id, 'price', e.target.value)}
                className={`w-full max-w-[120px] rounded px-2 py-0.5 border-b-2 border-transparent hover:border-blue-400 focus:border-blue-500 outline-none bg-transparent transition-colors`}
                placeholder="0"
              />
            )}
          </div>
        </div>

        <div className="flex flex-col relative">
            <div className="absolute top-0 right-0 flex flex-col items-end gap-1">
              <div className={`text-[10px] ${isDarkMode ? 'text-gray-300 bg-gray-600' : 'text-gray-500 bg-white'} px-1 border rounded shadow-sm`}>
                總扣除: -{(totalTaxRate * 100).toFixed(0)}%
              </div>
            </div>

          <span className={`text-xs ${theme.subText} mb-1`}>稅後價格 (淨利)</span>
          <div className="text-lg font-semibold text-blue-600 flex items-center">
            <span className="text-sm mr-1">$</span>
            {afterTaxPrice.toLocaleString()}
          </div>
          {!isHistory && (
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className={theme.subText}>刊登次數:</span>
                <input 
                  type="number" 
                  min="1"
                  value={item.listingCount || 1}
                  onChange={(e) => updateItemValue(item.id, 'listingCount', e.target.value)}
                  className={`w-12 text-center rounded border ${theme.input} text-xs py-0.5`}
                />
                <span className="text-[10px] text-orange-500">
                  (-{(listingFeeRate * 100).toFixed(0)}%)
                </span>
              </div>
          )}
        </div>

        <div className="flex flex-col">
          <span className={`text-xs ${theme.subText} mb-1`}>每人預計收益 ({item.participants.length}人)</span>
          <div className="text-lg font-semibold text-green-600 flex items-center">
            <span className="text-sm mr-1">$</span>
            {perPersonSplit.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 參與人員名單 */}
      <div className="space-y-2">
        <h4 className={`text-sm font-medium ${theme.subText} flex items-center gap-2`}>
          <Users size={16} />
          參與人員分配狀況
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {item.participants.map((p, idx) => (
            <div 
              key={idx}
              // 點擊區域優化：整個區塊均可點擊
              onClick={() => !isHistory && toggleParticipantSettled(item.id, p.name, item.participants)}
              className={`flex items-center justify-between p-2 rounded border text-sm transition-all select-none ${
                !isHistory ? 'cursor-pointer active:scale-95 hover:bg-opacity-80' : ''
              } ${
                p.isSettled 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' 
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="font-medium">{p.name}</span>
              {!isHistory ? (
                <div 
                  className={`p-1 rounded-full transition-colors ${
                    p.isSettled 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  <Check size={14} />
                </div>
              ) : (
                  p.isSettled && <Check size={14} className="text-green-500" />
              )}
            </div>
          ))}
          {item.participants.length === 0 && (
            <span className={`text-sm ${theme.subText} italic`}>無參與人員</span>
          )}
        </div>
      </div>

      {/* 底部按鈕區 */}
      {!isHistory && (
        <div className={`mt-6 flex justify-end pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
            {confirmSettleId === item.id ? (
              <div className="flex items-center gap-2 animate-fadeIn">
                <span className="text-sm text-red-600 font-medium">確認全部結算並移除?</span>
                <button 
                  onClick={() => handleSettleAll(item)}
                  className="px-3 py-1.5 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                >
                  是
                </button>
                <button 
                  onClick={() => setConfirmSettleId(null)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
                >
                  否
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setConfirmSettleId(item.id);
                  setConfirmDeleteId(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isAllParticipantsSettled
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed hover:bg-gray-200'
                }`}
                disabled={!isAllParticipantsSettled} 
                title={!isAllParticipantsSettled ? "請先將所有人員標記為已結算" : ""}
              >
                <Wallet size={18} />
                全部結算歸檔
              </button>
            )}
        </div>
      )}
    </div>
  );
};

export default function AccountingApp() {
  const [items, setItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmSettleId, setConfirmSettleId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  const [historyFilter, setHistoryFilter] = useState({
    name: '',
    date: '',
    dateType: 'created'
  });

  const [formData, setFormData] = useState({
    seller: MEMBERS[0],
    itemName: '',
    price: '',
    listingCount: 1,
    exchangeType: 'GENERAL',
    participants: [] 
  });

  const [tempParticipant, setTempParticipant] = useState(MEMBERS[0]);

  // 1. 初始化資料監聽 (Firebase Listener)
  useEffect(() => {
    // 檢查 DB 是否初始化成功
    if (!db) return;
    setDbReady(true);

    // 監聽「進行中」的項目 (集合名稱: active_items)
    // 注意：需在 Firebase Console 建立索引 (Index) 才能支援 orderBy 查詢
    // 如果出現 requires an index 錯誤，請查看 Console 連結
    const qItems = query(collection(db, "active_items"), orderBy("createdAt", "desc"));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setItems(list);
    }, (error) => {
      console.error("監聽進行中項目失敗:", error);
    });

    // 監聽「歷史紀錄」的項目 (集合名稱: history_items)
    const qHistory = query(collection(db, "history_items"), orderBy("settledAt", "desc"));
    const unsubscribeHistory = onSnapshot(qHistory, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistoryItems(list);
    }, (error) => {
       console.error("監聽歷史紀錄失敗:", error);
    });

    return () => {
      unsubscribeItems();
      unsubscribeHistory();
    };
  }, []);

  // 2. 主題 LocalStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('accounting_theme');
    if (savedTheme) setIsDarkMode(savedTheme === 'dark');
  }, []);

  useEffect(() => {
    localStorage.setItem('accounting_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // === 資料庫操作函式 ===

  const handleAddItem = async () => {
    if (!db) { alert("尚未設定 Firebase Config，無法新增！"); return; }
    if (!formData.itemName || !formData.price) { alert("請填寫物品名稱與價格"); return; }
    
    const newItem = {
      ...formData,
      isSold: false,
      participants: formData.participants.map(p => ({
        name: p,
        isSettled: false
      })),
      createdAt: new Date().toISOString(),
      settledAt: null 
    };

    try {
      await addDoc(collection(db, "active_items"), newItem);
      
      setFormData({
        seller: MEMBERS[0],
        itemName: '',
        price: '',
        listingCount: 1,
        exchangeType: 'GENERAL',
        participants: []
      });
      setIsModalOpen(false);
      setShowHistory(false); // 自動返回進行中頁面
    } catch (e) {
      console.error("新增失敗:", e);
      alert("新增失敗，請檢查網路或權限");
    }
  };

  const toggleParticipantSettled = async (itemId, pName, currentParticipants) => {
    if (!db) return;
    const updatedParticipants = currentParticipants.map(p => 
      p.name === pName ? { ...p, isSettled: !p.isSettled } : p
    );
    const itemRef = doc(db, "active_items", itemId);
    await updateDoc(itemRef, { participants: updatedParticipants });
  };

  const updateItemValue = async (id, field, value) => {
    if (!db) return;
    const itemRef = doc(db, "active_items", id);
    await updateDoc(itemRef, { [field]: value });
  };

  const handleSettleAll = async (item) => {
    if (!db) return;
    const settledItem = { 
      ...item, 
      settledAt: new Date().toISOString() 
    };
    try {
      await addDoc(collection(db, "history_items"), settledItem);
      await deleteDoc(doc(db, "active_items", item.id));
      setConfirmSettleId(null);
    } catch (e) {
      console.error("結算失敗:", e);
    }
  };

  const handleDelete = async (id) => {
    if (!db) return;
    try {
      if (showHistory) {
         await deleteDoc(doc(db, "history_items", id));
      } else {
         await deleteDoc(doc(db, "active_items", id));
      }
      setConfirmDeleteId(null);
    } catch (e) {
      console.error("刪除失敗:", e);
    }
  };
  
  const handleDeleteHistory = async (id) => {
    if (!db) return;
    await deleteDoc(doc(db, "history_items", id));
    setConfirmDeleteId(null);
  };

  // === UI 邏輯 ===

  const addParticipantToForm = () => {
    if (!formData.participants.includes(tempParticipant)) {
      setFormData({
        ...formData,
        participants: [...formData.participants, tempParticipant]
      });
    }
  };

  const removeParticipantFromForm = (name) => {
    setFormData({
      ...formData,
      participants: formData.participants.filter(p => p !== name)
    });
  };

  const clearHistoryFilter = () => {
    setHistoryFilter({ name: '', date: '', dateType: 'created' });
  };

  const getFilteredHistoryItems = () => {
    let result = [...historyItems];
    if (historyFilter.name) {
      result = result.filter(i => i.itemName.toLowerCase().includes(historyFilter.name.toLowerCase()));
    }
    if (historyFilter.date) {
      result = result.filter(i => {
        const targetTime = historyFilter.dateType === 'created' ? i.createdAt : i.settledAt;
        if (!targetTime) return false;
        return targetTime.startsWith(historyFilter.date);
      });
    }
    return result; 
  };

  const theme = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-slate-100',
    nav: isDarkMode ? 'bg-gray-800' : 'bg-slate-900',
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-white',
    text: isDarkMode ? 'text-gray-100' : 'text-gray-800',
    subText: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    input: isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-800',
    sectionBg: isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50',
  };

  const displayedHistory = getFilteredHistoryItems();

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${theme.bg} ${theme.text}`}>
      {/* 設定檔警告 */}
      {!dbReady && (
        <div className="bg-red-600 text-white p-2 text-center text-sm font-bold">
           尚未設定 Firebase API Key，請打開程式碼填入 firebaseConfig 物件！
        </div>
      )}

      {/* 頂部導航 */}
      <nav className={`${theme.nav} text-white p-4 shadow-lg sticky top-0 z-20 transition-colors duration-300`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="bg-blue-500 p-2 rounded-lg">
                <Calculator size={24} className="text-white" />
             </div>
             <h1 className="text-2xl font-bold tracking-wider">團隊記帳表</h1>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              {isDarkMode ? <Sun size={20} className="text-yellow-300" /> : <Moon size={20} />}
            </button>
            <button 
               onClick={() => setShowHistory(!showHistory)}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                 showHistory ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-slate-300'
               }`}
            >
              <History size={18} />
              {showHistory ? '返回列表' : '歷史紀錄'}
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg shadow-blue-900/50 transition-all transform hover:scale-105 active:scale-95"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">新增項目</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {!showHistory && (
           <div className="mb-6 flex items-center justify-between">
              <h2 className={`text-xl font-bold border-l-4 border-blue-500 pl-3 ${isDarkMode ? 'text-gray-200' : 'text-slate-700'}`}>目前進行中項目 ({items.length})</h2>
           </div>
        )}

        {showHistory && (
           <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold border-l-4 border-gray-500 pl-3 ${isDarkMode ? 'text-gray-200' : 'text-slate-700'}`}>歷史歸檔紀錄 ({displayedHistory.length})</h2>
              </div>
              <div className={`p-4 rounded-xl shadow-sm flex flex-wrap items-end gap-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="flex-1 min-w-[200px] space-y-1">
                  <label className={`text-xs font-medium ${theme.subText} flex items-center gap-1`}>
                    <Search size={12}/> 搜尋物品名稱
                  </label>
                  <input 
                    type="text" 
                    placeholder="輸入關鍵字..."
                    className={`w-full p-2 rounded border outline-none focus:ring-2 focus:ring-blue-500 ${theme.input}`}
                    value={historyFilter.name}
                    onChange={(e) => setHistoryFilter({...historyFilter, name: e.target.value})}
                  />
                </div>
                <div className="flex-1 min-w-[200px] flex gap-2">
                  <div className="flex-1 space-y-1">
                     <label className={`text-xs font-medium ${theme.subText} flex items-center gap-1`}>
                        <Filter size={12}/> 日期篩選類型
                     </label>
                     <select 
                        className={`w-full p-2 rounded border outline-none focus:ring-2 focus:ring-blue-500 ${theme.input}`}
                        value={historyFilter.dateType}
                        onChange={(e) => setHistoryFilter({...historyFilter, dateType: e.target.value})}
                     >
                       <option value="created">建立時間</option>
                       <option value="settled">結算時間</option>
                     </select>
                  </div>
                  <div className="flex-1 space-y-1">
                     <label className={`text-xs font-medium ${theme.subText} flex items-center gap-1`}>
                        <Calendar size={12}/> 選擇日期
                     </label>
                     <input 
                       type="date"
                       className={`w-full p-2 rounded border outline-none focus:ring-2 focus:ring-blue-500 ${theme.input}`}
                       value={historyFilter.date}
                       onChange={(e) => setHistoryFilter({...historyFilter, date: e.target.value})}
                     />
                  </div>
                </div>
                <button 
                  onClick={clearHistoryFilter}
                  className={`p-2.5 rounded hover:bg-red-500 hover:text-white transition-colors ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}
                >
                  <X size={20} />
                </button>
              </div>
           </div>
        )}

        <div className="space-y-6">
          {showHistory ? (
             displayedHistory.length > 0 ? (
              displayedHistory.map(item => (
                 <ItemCard 
                   key={item.id} 
                   item={item} 
                   isHistory={true}
                   theme={theme}
                   isDarkMode={isDarkMode}
                   handleDelete={handleDeleteHistory}
                   confirmDeleteId={confirmDeleteId}
                   setConfirmDeleteId={setConfirmDeleteId}
                   setConfirmSettleId={setConfirmSettleId}
                 />
               ))
             ) : (
               <div className={`text-center py-20 rounded-xl shadow-sm ${theme.card} ${theme.subText}`}>
                 {historyItems.length > 0 ? (
                   <>
                     <Search size={48} className="mx-auto mb-4 opacity-30" />
                     <p>沒有符合搜尋條件的紀錄</p>
                     <button onClick={clearHistoryFilter} className="text-blue-500 hover:underline mt-2">清除篩選</button>
                   </>
                 ) : (
                   <>
                     <History size={48} className="mx-auto mb-4 opacity-30" />
                     <p>尚無歷史紀錄</p>
                   </>
                 )}
               </div>
             )
          ) : (
             items.length > 0 ? (
               items.map(item => (
                 <ItemCard 
                   key={item.id} 
                   item={item} 
                   theme={theme}
                   isDarkMode={isDarkMode}
                   updateItemValue={updateItemValue}
                   toggleParticipantSettled={toggleParticipantSettled}
                   handleSettleAll={handleSettleAll}
                   handleDelete={handleDelete}
                   confirmSettleId={confirmSettleId}
                   setConfirmSettleId={setConfirmSettleId}
                   confirmDeleteId={confirmDeleteId}
                   setConfirmDeleteId={setConfirmDeleteId}
                 />
               ))
             ) : (
               <div className={`text-center py-20 rounded-xl shadow-sm border border-dashed ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-white'} ${theme.subText}`}>
                 <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-slate-50'}`}>
                    <Plus size={32} className="opacity-30" />
                 </div>
                 <p className="text-lg">目前沒有進行中的記帳項目</p>
                 <button 
                   onClick={() => setIsModalOpen(true)}
                   className="mt-4 text-blue-500 hover:underline"
                 >
                   立即新增一筆
                 </button>
               </div>
             )
          )}
        </div>
      </main>

      {/* 新增項目 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleIn transition-colors`}>
            <div className={`sticky top-0 px-6 py-4 border-b flex justify-between items-center z-10 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <h3 className="text-xl font-bold">建立新記帳項目</h3>
              <button onClick={() => setIsModalOpen(false)} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Row 1: 販賣人 & 價格 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className={`text-sm font-medium block ${theme.subText}`}>販賣人</label>
                  <select 
                    className={`w-full p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${theme.input}`}
                    value={formData.seller}
                    onChange={(e) => setFormData({...formData, seller: e.target.value})}
                  >
                    {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={`text-sm font-medium block ${theme.subText}`}>販售價格</label>
                  <input 
                    type="number" 
                    placeholder="輸入金額..."
                    className={`w-full p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${theme.input}`}
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                  />
                </div>
              </div>

              {/* Row 2: 物品名稱 & 刊登次數 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className={`text-sm font-medium block ${theme.subText}`}>物品名稱</label>
                  <input 
                    type="text" 
                    placeholder="例如：高級水晶..."
                    className={`w-full p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${theme.input}`}
                    value={formData.itemName}
                    onChange={(e) => setFormData({...formData, itemName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-sm font-medium block ${theme.subText}`}>刊登次數 (收取 {formData.listingCount * 2}% 手續費)</label>
                  <div className="flex items-center gap-4">
                     <button 
                       onClick={() => setFormData({...formData, listingCount: Math.max(1, formData.listingCount - 1)})}
                       className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xl ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                     >
                       -
                     </button>
                     <input 
                       type="number" 
                       min="1"
                       className={`flex-1 p-3 text-center rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${theme.input}`}
                       value={formData.listingCount}
                       onChange={(e) => setFormData({...formData, listingCount: parseInt(e.target.value) || 1})}
                     />
                     <button 
                       onClick={() => setFormData({...formData, listingCount: formData.listingCount + 1})}
                       className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xl ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                     >
                       +
                     </button>
                  </div>
                </div>
              </div>

              {/* Row 3: 交易所類型 */}
               <div className="space-y-2">
                  <label className={`text-sm font-medium block ${theme.subText}`}>交易所類型</label>
                  <div className={`flex gap-4 p-1 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    {Object.keys(EXCHANGE_TYPES).map((typeKey) => (
                      <button
                        key={typeKey}
                        onClick={() => setFormData({...formData, exchangeType: typeKey})}
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                          formData.exchangeType === typeKey 
                            ? `${isDarkMode ? 'bg-gray-600 text-blue-300' : 'bg-white text-blue-600'} shadow-sm` 
                            : `${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
                        }`}
                      >
                        {EXCHANGE_TYPES[typeKey].label} (稅 {(EXCHANGE_TYPES[typeKey].tax * 100 + formData.listingCount * 2).toFixed(0)}%)
                      </button>
                    ))}
                  </div>
                </div>

              {/* Row 4: 參與人員 */}
              <div className={`space-y-2 border-t pt-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                <label className={`text-sm font-medium flex justify-between items-center ${theme.subText}`}>
                  <span>參與人員清單</span>
                  <span className={`text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-50 text-blue-500'}`}>目前: {formData.participants.length} 人</span>
                </label>
                
                <div className="flex gap-2">
                  <select 
                     className={`flex-1 p-2 rounded-lg ${theme.input}`}
                     value={tempParticipant}
                     onChange={(e) => setTempParticipant(e.target.value)}
                  >
                     {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <button 
                    onClick={addParticipantToForm}
                    className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg flex items-center justify-center w-12 transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                <div className={`flex flex-wrap gap-2 mt-3 min-h-[50px] p-3 rounded-lg border border-dashed ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
                  {formData.participants.length === 0 && <span className={`text-sm ${theme.subText}`}>尚未新增參與人員...</span>}
                  {formData.participants.map((p, idx) => (
                    <span key={idx} className={`px-3 py-1 rounded-full text-sm flex items-center gap-2 shadow-sm ${isDarkMode ? 'bg-gray-600 text-gray-200 border-gray-500' : 'bg-white border-gray-200 text-gray-700 border'}`}>
                      {p}
                      <button 
                        onClick={() => removeParticipantFromForm(p)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {formData.price && (
                <div className={`p-4 rounded-lg flex items-center justify-between text-sm border ${isDarkMode ? 'bg-indigo-900/30 border-indigo-800 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-900'}`}>
                  <div className="flex flex-col">
                     <span className="opacity-70">預計每人收益:</span>
                     <span className="font-bold text-lg">
                        ${calculateFinance(formData.price, formData.exchangeType, formData.participants.length, formData.listingCount).perPersonSplit.toLocaleString()}
                     </span>
                  </div>
                  <ArrowRight className="opacity-30" />
                   <div className="flex flex-col text-right">
                     <span className="opacity-70">稅後總額:</span>
                     <span className="font-bold">
                        ${calculateFinance(formData.price, formData.exchangeType, formData.participants.length, formData.listingCount).afterTaxPrice.toLocaleString()}
                     </span>
                  </div>
                </div>
              )}

            </div>

            <div className={`p-6 border-t rounded-b-2xl flex justify-end gap-3 ${isDarkMode ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
              <button 
                onClick={() => setIsModalOpen(false)}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                取消
              </button>
              <button 
                onClick={handleAddItem}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/50 font-medium transition-colors"
              >
                建立項目
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out forwards; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: ${isDarkMode ? '#1f2937' : '#f1f5f9'}; }
        ::-webkit-scrollbar-thumb { background: ${isDarkMode ? '#4b5563' : '#cbd5e1'}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${isDarkMode ? '#6b7280' : '#94a3b8'}; }
      `}</style>
    </div>
  );
}