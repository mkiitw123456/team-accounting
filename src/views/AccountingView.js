// src/views/AccountingView.js
import React, { useState, useEffect } from 'react';
import { 
  Plus, History, Grid, X, Calculator 
} from 'lucide-react';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, runTransaction, getDoc 
} from "firebase/firestore";

import { db } from '../config/firebase';
import { MEMBERS, EXCHANGE_TYPES } from '../utils/constants';
import { sendLog, sendNotify } from '../utils/helpers';
import ItemCard from '../components/ItemCard';
import BalanceGrid from '../components/BalanceGrid';
// 1. 引入新元件
import CostCalculatorModal from '../components/CostCalculatorModal';

const AccountingView = ({ isDarkMode, dbReady, currentUser }) => {
  const [items, setItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmSettleId, setConfirmSettleId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  
  const [isBalanceGridOpen, setIsBalanceGridOpen] = useState(false);
  // 2. 新增 CostCalculator 狀態
  const [isCostCalcOpen, setIsCostCalcOpen] = useState(false);
  
  const [historyFilter, setHistoryFilter] = useState({ name: '', date: '', dateType: 'created' });
  
  const [formData, setFormData] = useState({
    seller: currentUser || MEMBERS[0], itemName: '', price: '', cost: 0, exchangeType: 'GENERAL', participants: [...MEMBERS] 
  });
  
  useEffect(() => {
    if (currentUser) {
      setFormData(prev => ({ ...prev, seller: currentUser }));
    }
  }, [currentUser]);

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
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽"); // 🔒 訪客鎖
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
    sendLog(currentUser, "新增記帳項目", `${newItem.itemName} ($${newItem.price})`);
    
    setFormData({ seller: currentUser || MEMBERS[0], itemName: '', price: '', cost: 0, exchangeType: 'GENERAL', participants: [...MEMBERS] });
    setIsModalOpen(false); setShowHistory(false);
  };

  const updateItemValue = async (id, field, value) => {
    if (currentUser === '訪客') return; // 🔒 訪客鎖 (輸入框直接不給改)
    if (!db) return;
    await updateDoc(doc(db, "active_items", id), { [field]: value });
  };

  const handleSettleAll = async (item, perPersonSplit) => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽"); // 🔒 訪客鎖
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
      sendNotify(msg);
      sendLog(currentUser, "出售物品", `${item.itemName} (分紅: $${perPersonSplit})`);

      alert(`已出售！每人分紅 $${perPersonSplit} 已加入餘額表。`);

    } catch (e) {
      console.error("Settle transaction failed: ", e);
      alert("出售失敗，請重試");
    }
  };

  const handleDelete = async (id) => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽"); // 🔒 訪客鎖
    if (!db) return;
    try {
      const collectionName = showHistory ? "history_items" : "active_items";
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        alert("找不到該項目，可能已被刪除");
        return;
      }

      const itemData = docSnap.data();

      if (itemData.seller !== currentUser) {
        alert(`權限不足：只有販賣人 (${itemData.seller}) 可以刪除此項目`);
        sendLog(currentUser, "權限不足", `嘗試刪除非本人物品：${itemData.itemName} (賣家: ${itemData.seller})`);
        setConfirmDeleteId(null);
        return;
      }

      await deleteDoc(docRef);
      
      sendLog(currentUser, "刪除記帳項目", `${itemData.itemName} (${showHistory ? '歷史紀錄' : '進行中'})`);
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
          {/* 3. 新增成本試算按鈕 */}
          <button 
            onClick={() => setIsCostCalcOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded text-white shadow hover:opacity-80 transition-opacity bg-orange-500"
          >
            <Calculator size={18}/> 成本試算
          </button>

          <button 
            onClick={() => setIsBalanceGridOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded text-white shadow hover:opacity-80 transition-opacity"
            // 按鈕顏色
            style={{ background: 'var(--app-primary)' }}
          >
            <Grid size={18}/> 餘額表格
          </button>
          <button onClick={() => setShowHistory(!showHistory)} className={`flex items-center gap-2 px-3 py-2 rounded ${showHistory ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            <History size={18}/> {showHistory ? '返回' : '歷史'}
          </button>
          {!showHistory && (
             <button 
                onClick={() => {
                  if(currentUser === '訪客') alert("訪客權限僅供瀏覽");
                  else setIsModalOpen(true);
                }} 
                className={`flex items-center gap-2 px-3 py-2 rounded text-white shadow hover:opacity-80 transition-opacity ${currentUser === '訪客' ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ background: 'var(--app-primary)' }}
             >
               <Plus size={18}/> 新增項目
             </button>
          )}
        </div>
      </div>

      {showHistory && (
        <div 
          className="p-4 rounded mb-6 flex flex-wrap gap-4 items-end shadow-sm transition-colors"
          style={{ background: 'var(--app-card-bg)', color: 'var(--app-text)' }}
        >
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
            currentUser={currentUser}
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
              <div><label className="block text-xs mb-1 opacity-70">販賣人</label><select className={`w-full p-2 rounded border ${theme.input} bg-gray-100 cursor-not-allowed`} value={formData.seller} disabled>{MEMBERS.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
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

      <BalanceGrid 
        isOpen={isBalanceGridOpen} 
        onClose={() => setIsBalanceGridOpen(false)} 
        theme={theme}
        isDarkMode={isDarkMode}
        currentUser={currentUser}
      />
      
      {/* 4. 掛載成本試算 Modal */}
      <CostCalculatorModal 
        isOpen={isCostCalcOpen}
        onClose={() => setIsCostCalcOpen(false)}
        theme={theme}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default AccountingView;