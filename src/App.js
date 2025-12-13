import React, { useState, useEffect } from 'react';
import { 
  Plus, Check, X, History, Users, Calculator, Wallet, 
  ArrowRight, Sun, Moon, Edit3, Trash2, Search, Filter, Calendar,
  Clock, Skull, List, Tag, ShieldAlert, RefreshCw
} from 'lucide-react';

// === Firebase 引入 ===
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy 
} from "firebase/firestore";

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
  // 直接初始化，移除之前的判斷式
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

// === 工具函式 ===
const formatDate = (isoString) => {
  if (!isoString) return '無紀錄';
  return new Date(isoString).toLocaleString('zh-TW', {
    month: '2-digit', day: '2-digit', 
    hour: '2-digit', minute: '2-digit', hour12: false
  });
};

const formatTimeOnly = (isoString) => {
  if (!isoString) return '--:--';
  return new Date(isoString).toLocaleString('zh-TW', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });
};

const formatTimeWithSeconds = (date) => {
  return date.toLocaleString('zh-TW', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
};

const getRelativeDay = (dateString) => {
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
};

// 產生隨機亮色 (HSL -> Hex)
const getRandomBrightColor = () => {
  const h = Math.floor(Math.random() * 360);
  const s = 70 + Math.random() * 30; // 70-100% 飽和度
  const l = 45 + Math.random() * 15; // 45-60% 亮度
  
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

// 計算記帳財務
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

// ==========================================
// Component: 記帳視圖 (AccountingView)
// ==========================================
const AccountingView = ({ isDarkMode, dbReady }) => {
  const [items, setItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmSettleId, setConfirmSettleId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  
  const [historyFilter, setHistoryFilter] = useState({ name: '', date: '', dateType: 'created' });
  const [formData, setFormData] = useState({
    seller: MEMBERS[0], itemName: '', price: '', listingCount: 1, exchangeType: 'GENERAL', participants: [] 
  });
  const [tempParticipant, setTempParticipant] = useState(MEMBERS[0]);

  useEffect(() => {
    if (!db) return;
    const qItems = query(collection(db, "active_items"), orderBy("createdAt", "desc"));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const qHistory = query(collection(db, "history_items"), orderBy("settledAt", "desc"));
    const unsubscribeHistory = onSnapshot(qHistory, (snapshot) => {
      setHistoryItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubscribeItems(); unsubscribeHistory(); };
  }, [dbReady]);

  const handleAddItem = async () => {
    if (!db) return;
    if (!formData.itemName || !formData.price) { alert("請填寫物品名稱與價格"); return; }
    // 確保賣家在參與者名單中
    const finalParticipants = [...new Set([...formData.participants, formData.seller])];
    
    const newItem = {
      ...formData,
      participants: finalParticipants.map(p => ({ name: p, isSettled: false })),
      isSold: false, createdAt: new Date().toISOString(), settledAt: null 
    };
    await addDoc(collection(db, "active_items"), newItem);
    setFormData({ seller: MEMBERS[0], itemName: '', price: '', listingCount: 1, exchangeType: 'GENERAL', participants: [] });
    setIsModalOpen(false); setShowHistory(false);
  };

  const toggleParticipantSettled = async (itemId, pName, currentParticipants) => {
    if (!db) return;
    const updated = currentParticipants.map(p => p.name === pName ? { ...p, isSettled: !p.isSettled } : p);
    await updateDoc(doc(db, "active_items", itemId), { participants: updated });
  };

  const updateItemValue = async (id, field, value) => {
    if (!db) return;
    await updateDoc(doc(db, "active_items", id), { [field]: value });
  };

  const handleSettleAll = async (item) => {
    if (!db) return;
    await addDoc(collection(db, "history_items"), { ...item, settledAt: new Date().toISOString() });
    await deleteDoc(doc(db, "active_items", item.id));
    setConfirmSettleId(null);
  };

  const handleDelete = async (id) => {
    if (!db) return;
    if (showHistory) await deleteDoc(doc(db, "history_items", id));
    else await deleteDoc(doc(db, "active_items", id));
    setConfirmDeleteId(null);
  };

  const theme = {
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-white',
    text: isDarkMode ? 'text-gray-100' : 'text-gray-800',
    subText: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    input: isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-800',
    sectionBg: isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50',
  };

  const ItemCard = ({ item, isHistory }) => {
    const { afterTaxPrice, perPersonSplit, totalTaxRate, listingFeeRate } = calculateFinance(
      item.price, item.exchangeType, item.participants.length, item.listingCount
    );
    const isAllSettled = item.participants.every(p => p.isSettled);

    return (
      <div className={`rounded-xl shadow-md border-l-4 p-6 relative ${theme.card} ${isHistory ? 'border-gray-500 opacity-90' : 'border-blue-500'}`}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col gap-1 w-full pr-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded text-xs">{item.seller}</span>
              <h3 className={`text-xl font-bold ${theme.text}`}>{item.itemName}</h3>
              <span className="px-2 py-0.5 text-xs rounded-full border bg-green-100 text-green-700 border-green-200">
                {EXCHANGE_TYPES[item.exchangeType].label}
              </span>
            </div>
            {isHistory && <div className="text-xs text-gray-400 flex gap-2"><span>建: {formatDate(item.createdAt)}</span><span>結: {formatDate(item.settledAt)}</span></div>}
          </div>
          <div className="absolute top-4 right-4">
            {confirmDeleteId === item.id ? (
              <div className="flex gap-2 bg-red-50 p-1 rounded border border-red-200">
                <button onClick={() => handleDelete(item.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded">刪除</button>
                <button onClick={() => setConfirmDeleteId(null)} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">取消</button>
              </div>
            ) : (
              <button onClick={() => { setConfirmDeleteId(item.id); setConfirmSettleId(null); }} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={18}/></button>
            )}
          </div>
        </div>

        <div className={`grid grid-cols-3 gap-4 p-4 rounded mb-4 ${theme.sectionBg}`}>
          <div className="flex flex-col">
            <span className={`text-xs ${theme.subText}`}>售價</span>
            <div className={`text-lg font-bold ${theme.text}`}>
              {!isHistory ? <input type="number" className="bg-transparent w-20 border-b border-gray-400 focus:border-blue-500 outline-none" value={item.price} onChange={e => updateItemValue(item.id, 'price', e.target.value)}/> : item.price}
            </div>
          </div>
          <div className="flex flex-col">
            <span className={`text-xs ${theme.subText}`}>稅後 ({(totalTaxRate*100).toFixed(0)}%)</span>
            <div className="text-lg font-bold text-blue-500">{afterTaxPrice.toLocaleString()}</div>
            {!isHistory && <div className="text-xs flex items-center gap-1">刊登 <input type="number" min="1" className={`w-8 text-center rounded border ${theme.input}`} value={item.listingCount} onChange={e => updateItemValue(item.id, 'listingCount', e.target.value)}/>次</div>}
          </div>
          <div className="flex flex-col">
            <span className={`text-xs ${theme.subText}`}>每人</span>
            <div className="text-lg font-bold text-green-500">{perPersonSplit.toLocaleString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {item.participants.map((p, idx) => (
            <div key={idx} onClick={() => !isHistory && toggleParticipantSettled(item.id, p.name, item.participants)} 
                 className={`p-2 rounded border text-sm flex justify-between items-center cursor-pointer select-none ${p.isSettled ? 'bg-green-50 border-green-200 text-green-800' : `${theme.card} hover:opacity-80`}`}>
              <span>{p.name}</span>
              {p.isSettled && <Check size={14}/>}
            </div>
          ))}
        </div>

        {!isHistory && (
          <div className="mt-4 flex justify-end">
            {confirmSettleId === item.id ? (
              <div className="flex gap-2 items-center">
                <span className="text-sm text-red-500">確認結算?</span>
                <button onClick={() => handleSettleAll(item)} className="bg-red-500 text-white px-3 py-1 rounded text-sm">是</button>
                <button onClick={() => setConfirmSettleId(null)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm">否</button>
              </div>
            ) : (
              <button onClick={() => { setConfirmSettleId(item.id); setConfirmDeleteId(null); }} disabled={!isAllSettled} 
                      className={`flex items-center gap-2 px-4 py-2 rounded font-bold text-sm ${isAllSettled ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                <Wallet size={16}/> 結算歸檔
              </button>
            )}
          </div>
        )}
      </div>
    );
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
          <button onClick={() => setShowHistory(!showHistory)} className={`flex items-center gap-2 px-3 py-2 rounded ${showHistory ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            <History size={18}/> {showHistory ? '返回' : '歷史'}
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded bg-blue-600 text-white shadow hover:bg-blue-700">
            <Plus size={18}/> 新增項目
          </button>
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
          <ItemCard key={item.id} item={item} isHistory={showHistory} />
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
              <div><label className="block text-xs mb-1 opacity-70">刊登次數</label><input type="number" min="1" className={`w-full p-2 rounded border ${theme.input}`} value={formData.listingCount} onChange={e=>setFormData({...formData, listingCount: parseInt(e.target.value)||1})}/></div>
            </div>
            <div className="mb-4 flex gap-2">{Object.keys(EXCHANGE_TYPES).map(k=><button key={k} onClick={()=>setFormData({...formData, exchangeType: k})} className={`flex-1 py-1 rounded border ${formData.exchangeType===k ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 opacity-60'}`}>{EXCHANGE_TYPES[k].label}</button>)}</div>
            <div className="mb-4 pt-4 border-t border-gray-200">
              <div className="flex gap-2 mb-2"><select className={`flex-1 p-2 rounded border ${theme.input}`} value={tempParticipant} onChange={e=>setTempParticipant(e.target.value)}>{MEMBERS.map(m=><option key={m} value={m}>{m}</option>)}</select><button onClick={()=>{if(!formData.participants.includes(tempParticipant))setFormData({...formData, participants:[...formData.participants, tempParticipant]})}} className="bg-green-500 text-white p-2 rounded"><Plus/></button></div>
              <div className="flex flex-wrap gap-2">{formData.participants.map(p=><span key={p} className="bg-gray-100 px-2 py-1 rounded text-sm flex items-center gap-1 text-gray-700">{p}<button onClick={()=>setFormData({...formData, participants: formData.participants.filter(x=>x!==p)})}><X size={12}/></button></span>)}</div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-gray-700">取消</button>
              <button onClick={handleAddItem} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">建立項目</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// Component: Boss 計時器視圖 (BossTimerView)
// ==========================================
const BossTimerView = ({ isDarkMode }) => {
  const [bossTemplates, setBossTemplates] = useState([]);
  const [bossEvents, setBossEvents] = useState([]);
  const [now, setNow] = useState(new Date()); 
  
  const [isCreateBossModalOpen, setIsCreateBossModalOpen] = useState(false);
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingBossId, setEditingBossId] = useState(null);

  const [newBossForm, setNewBossForm] = useState({ name: '', respawnMinutes: 60, color: '#FF5733' });
  const [recordForm, setRecordForm] = useState({ templateId: '', timeMode: 'current', specificDate: '', specificTime: '' });

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

  // 時鐘與自動刪除機制
  useEffect(() => {
    const timer = setInterval(() => {
      const currentTime = new Date();
      setNow(currentTime);

      // 自動刪除過期 5 分鐘以上的 Boss 標籤
      bossEvents.forEach(event => {
        const respawnTime = new Date(event.respawnTime);
        const diffMinutes = (currentTime - respawnTime) / 1000 / 60;
        
        // 只有當超過 5 分鐘，且尚未被刪除時
        if (diffMinutes > 5) {
          if (db) {
            deleteDoc(doc(db, "boss_events", event.id)).catch(err => console.error("Auto delete fail", err));
          }
        }
      });
    }, 1000); 

    return () => clearInterval(timer);
  }, [bossEvents]); 

  const handleOpenCreateBoss = (bossToEdit = null) => {
    if (bossToEdit) {
      setEditingBossId(bossToEdit.id);
      setNewBossForm({ 
        name: bossToEdit.name, 
        respawnMinutes: bossToEdit.respawnMinutes, 
        color: bossToEdit.color 
      });
    } else {
      setEditingBossId(null);
      setNewBossForm({ 
        name: '', 
        respawnMinutes: 60, 
        color: getRandomBrightColor() 
      });
    }
    setIsCreateBossModalOpen(true);
  };

  const handleCreateOrUpdateBoss = async () => {
    if (!newBossForm.name) return alert("請輸入 Boss 名稱");
    if (editingBossId) {
      await updateDoc(doc(db, "boss_templates", editingBossId), newBossForm);
    } else {
      await addDoc(collection(db, "boss_templates"), newBossForm);
    }
    setIsCreateBossModalOpen(false);
  };

  const handleAddRecord = async () => {
    if (!recordForm.templateId) return alert("請選擇 Boss");
    const template = bossTemplates.find(b => b.id === recordForm.templateId);
    if (!template) return;

    let baseTime = new Date();
    if (recordForm.timeMode === 'specific') {
      if (!recordForm.specificDate || !recordForm.specificTime) return alert("請輸入完整的日期與時間");
      baseTime = new Date(`${recordForm.specificDate}T${recordForm.specificTime}`);
    }

    const respawnTime = new Date(baseTime.getTime() + template.respawnMinutes * 60000);

    const newEvent = {
      templateId: template.id,
      name: template.name,
      color: template.color,
      deathTime: baseTime.toISOString(),
      respawnTime: respawnTime.toISOString(),
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, "boss_events"), newEvent);
    setIsAddRecordModalOpen(false);
  };

  const handleDeleteEvent = async (id) => {
    await deleteDoc(doc(db, "boss_events", id));
    setConfirmDeleteId(null);
  };

  const handleDeleteTemplate = async (id) => {
    if(!window.confirm("確定要刪除這個 Boss 設定嗎？")) return;
    await deleteDoc(doc(db, "boss_templates", id));
  }

  const handleRandomizeColor = () => {
    setNewBossForm({ ...newBossForm, color: getRandomBrightColor() });
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

  // 顯示所有尚未被自動刪除的事件 (包含未來的，以及剛剛過期還沒滿5分鐘的)
  const displayEvents = bossEvents.filter(e => {
    const diff = (now - new Date(e.respawnTime)) / 1000 / 60;
    return diff <= 5; 
  });

  // 計算下一個即將出現的 Boss (必須是未來時間)
  const nextBoss = bossEvents.find(e => new Date(e.respawnTime) > now);

  const EventItem = ({ event }) => (
    <div className={`p-3 mb-2 rounded border-l-4 shadow-sm flex justify-between items-center ${theme.card}`} style={{ borderLeftColor: event.color }}>
      <div>
        <div className="font-bold text-sm">{event.name}</div>
        <div className="text-xs opacity-70 flex items-center gap-1">
          <Skull size={10}/> 亡: {formatTimeOnly(event.deathTime)}
        </div>
        <div className="text-lg font-mono font-bold text-blue-500 flex items-center gap-1">
          <Clock size={14}/> {formatTimeOnly(event.respawnTime)}
        </div>
      </div>
      {confirmDeleteId === event.id ? (
        <button onClick={() => handleDeleteEvent(event.id)} className="bg-red-500 text-white text-xs px-2 py-1 rounded">確認</button>
      ) : (
        <button onClick={() => setConfirmDeleteId(event.id)} className="text-gray-400 hover:text-red-500"><X size={16}/></button>
      )}
    </div>
  );

  return (
    <div className="p-4 h-[calc(100vh-80px)] flex flex-col">
      
      {/* 頂部儀表板：時鐘與 Next Boss */}
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
          <div className="mt-4 md:mt-0 text-white/50 text-sm italic">
            目前沒有等待中的 Boss
          </div>
        )}
      </div>

      {/* 工具列 */}
      <div className="flex gap-4 mb-4">
        <button onClick={() => handleOpenCreateBoss()} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded shadow">
          <Plus size={18}/> 建立 Boss
        </button>
        <button onClick={() => { 
          setRecordForm({
            templateId: bossTemplates[0]?.id || '', 
            timeMode: 'current',
            specificDate: getCurrentDateStr(),
            specificTime: getCurrentTimeStr()
          }); 
          setIsAddRecordModalOpen(true); 
        }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded shadow">
          <Tag size={18}/> 新增標籤 (紀錄死亡)
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
        {/* 時間軸 */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 h-full overflow-y-auto pb-20">
          {['yesterday', 'today', 'tomorrow'].map(dayKey => (
            <div key={dayKey} className={`rounded-xl p-4 flex flex-col ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50 border'}`}>
              <h3 className={`font-bold mb-3 capitalize text-center py-2 border-b ${theme.text}`}>
                {dayKey === 'yesterday' ? '昨天' : dayKey === 'today' ? '今天' : '明天'}
              </h3>
              <div className="flex-1 overflow-y-auto space-y-2">
                {groupedEvents[dayKey].length > 0 ? (
                  groupedEvents[dayKey].map(event => <EventItem key={event.id} event={event} />)
                ) : (
                  <div className="text-center text-sm opacity-40 py-4">無重生紀錄</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 右側列表 (顯示所有未刪除的標籤) */}
        <div className={`w-full lg:w-80 rounded-xl p-4 flex flex-col ${isDarkMode ? 'bg-gray-800' : 'bg-white shadow border'}`}>
          <h3 className={`font-bold mb-3 flex items-center gap-2 ${theme.text}`}>
            <List size={20}/> 重生順序列表
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2">
            {displayEvents.length > 0 ? (
              displayEvents.map(event => (
                <div key={'list'+event.id} className="flex items-center justify-between p-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: event.color }}></div>
                    <span className={`text-sm ${theme.text}`}>{event.name}</span>
                  </div>
                  {/* 過期變紅並閃爍 */}
                  <span className={`font-mono font-bold ${new Date(event.respawnTime) < now ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}>
                    {formatTimeOnly(event.respawnTime)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center opacity-50 py-4">目前沒有等待中的 Boss</div>
            )}
          </div>
          
          {/* Boss 模板列表 */}
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

      {/* Modal: 建立/編輯 Boss */}
      {isCreateBossModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-sm rounded-xl p-6 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
            <h3 className="text-lg font-bold mb-4">{editingBossId ? '編輯 Boss' : '建立 Boss'}</h3>
            <div className="space-y-4">
              <div><label className="text-xs opacity-70">Boss 名稱</label><input type="text" className={`w-full p-2 rounded border ${theme.input}`} value={newBossForm.name} onChange={e=>setNewBossForm({...newBossForm, name: e.target.value})}/></div>
              <div><label className="text-xs opacity-70">重生時間 (分鐘)</label><input type="number" className={`w-full p-2 rounded border ${theme.input}`} value={newBossForm.respawnMinutes} onChange={e=>setNewBossForm({...newBossForm, respawnMinutes: parseInt(e.target.value)||0})}/></div>
              <div>
                <label className="text-xs opacity-70">標籤顏色</label>
                <div className="flex gap-2">
                  <input type="color" className="flex-1 h-10 rounded cursor-pointer" value={newBossForm.color} onChange={e=>setNewBossForm({...newBossForm, color: e.target.value})}/>
                  <button onClick={handleRandomizeColor} className="bg-gray-200 text-gray-700 px-3 rounded hover:bg-gray-300" title="隨機顏色"><RefreshCw size={16}/></button>
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

      {/* Modal: 新增標籤 (紀錄死亡) */}
      {isAddRecordModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-sm rounded-xl p-6 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
            <h3 className="text-lg font-bold mb-4">新增 Boss 標籤 (死亡紀錄)</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs opacity-70">選擇 Boss</label>
                <select className={`w-full p-2 rounded border ${theme.input}`} value={recordForm.templateId} onChange={e=>setRecordForm({...recordForm, templateId: e.target.value})}>
                  <option value="" disabled>請選擇...</option>
                  {bossTemplates.map(t => <option key={t.id} value={t.id}>{t.name} (CD: {t.respawnMinutes}m)</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs opacity-70">死亡時間基準</label>
                <div className="flex gap-2 mt-1">
                  <button onClick={()=>setRecordForm({...recordForm, timeMode: 'current'})} className={`flex-1 py-2 rounded text-sm border ${recordForm.timeMode==='current' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 opacity-60'}`}>當前時間</button>
                  <button onClick={()=>setRecordForm({...recordForm, timeMode: 'specific'})} className={`flex-1 py-2 rounded text-sm border ${recordForm.timeMode==='specific' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 opacity-60'}`}>指定時間</button>
                </div>
              </div>
              {recordForm.timeMode === 'specific' && (
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
              <button onClick={() => setIsAddRecordModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">取消</button>
              <button onClick={handleAddRecord} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">建立標籤</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// Main Application (Layout & Routing)
// ==========================================
export default function App() {
  const [currentTab, setCurrentTab] = useState('ACCOUNTING');
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

      {/* 頂部導航 */}
      <nav className={`${theme.nav} text-white px-4 py-3 shadow-lg sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
             <div className="bg-blue-500 p-2 rounded-lg">
                {currentTab === 'ACCOUNTING' ? <Calculator size={24} className="text-white" /> : <ShieldAlert size={24} className="text-white" />}
             </div>
             <h1 className="text-2xl font-bold tracking-wider hidden md:block">
               {currentTab === 'ACCOUNTING' ? '團隊記帳表' : 'Boss 重生計時'}
             </h1>
             {/* 手機版標題切換 */}
             <div className="flex md:hidden bg-gray-700 rounded-lg p-1">
                <button onClick={()=>setCurrentTab('ACCOUNTING')} className={`px-3 py-1 rounded ${currentTab==='ACCOUNTING'?'bg-blue-600 text-white':'text-gray-300'}`}>記帳</button>
                <button onClick={()=>setCurrentTab('BOSS_TIMER')} className={`px-3 py-1 rounded ${currentTab==='BOSS_TIMER'?'bg-purple-600 text-white':'text-gray-300'}`}>Boss</button>
             </div>
          </div>

          <div className="flex gap-3 items-center">
            {/* 電腦版分頁按鈕 */}
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

      {/* 主內容區塊 */}
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