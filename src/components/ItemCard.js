// src/components/ItemCard.js
import React, { useState } from 'react';
// 移除 Plus icon，因為不再需要手動按 + 號
import { Trash2, CheckCircle, X } from 'lucide-react';
import { EXCHANGE_TYPES, BASE_LISTING_FEE_PERCENT } from '../utils/constants';
import { formatDate, calculateFinance, sendLog } from '../utils/helpers';

const ItemCard = ({ 
  item, isHistory, theme, 
  updateItemValue, handleSettleAll, handleDelete,
  confirmSettleId, setConfirmSettleId, confirmDeleteId, setConfirmDeleteId,
  currentUser
}) => {
  const listingHistory = item.listingHistory || [];
  
  // 用來記錄 Focus 時的價格，以便在 Blur 時比對是否有變更
  const [priceOnFocus, setPriceOnFocus] = useState(item.price);

  const { perPersonSplit, totalListingFee } = calculateFinance(
    item.price, item.exchangeType, item.participants?.length || 0, item.cost, listingHistory
  );

  // === 修改重點 1: 當價格輸入框獲得焦點時，記錄當前數值 ===
  const handlePriceFocus = () => {
    setPriceOnFocus(item.price);
  };

  // === 修改重點 2: 當價格輸入框失去焦點時，若價格有變動，自動新增刊登費紀錄 ===
  const handlePriceBlur = (e) => {
    // 取得當前輸入框的最終數值
    const currentPrice = parseFloat(e.target.value);
    const previousPrice = parseFloat(priceOnFocus);

    // 只有在「數值有效」且「數值確實有改變」時才新增歷史紀錄
    if (!isNaN(currentPrice) && currentPrice !== previousPrice) {
      const newHistory = [...listingHistory, currentPrice];
      updateItemValue(item.id, 'listingHistory', newHistory);
      // 不需要額外呼叫 updateItemValue 更新 price，因為 onChange 已經處理了
      console.log(`價格變更: ${previousPrice} -> ${currentPrice}，已自動新增刊登費。`);
    }
  };

  const removeListingPrice = (index) => {
      const newHistory = listingHistory.filter((_, i) => i !== index);
      updateItemValue(item.id, 'listingHistory', newHistory);
  };
  
  return (
    <div 
      className={`rounded-xl shadow-md border-l-4 p-6 relative transition-colors ${isHistory ? 'border-gray-500 opacity-90' : 'border-blue-500'}`}
      style={{ background: 'var(--card-bg)', color: 'var(--card-text)' }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-1 w-full pr-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded text-xs">{item.seller}</span>
            <h3 className="text-xl font-bold">{item.itemName}</h3>
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
            <button 
              onClick={() => { 
                if (item.seller !== currentUser) {
                  alert(`權限不足：只有販賣人 (${item.seller}) 可以刪除此項目`);
                  sendLog(currentUser, "權限不足", `嘗試刪除非本人物品：${item.itemName} (賣家: ${item.seller})`);
                  return;
                }
                setConfirmDeleteId(item.id); 
                setConfirmSettleId(null); 
              }} 
              className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <Trash2 size={18}/>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 p-4 rounded mb-4 bg-black/5">
        <div className="flex flex-col">
          <span className={`text-xs opacity-70`}>售價 (含稅)</span>
          <div className="text-lg font-bold">
            {/* === 修改重點 3: 解鎖輸入框，加入 onFocus 與 onBlur === */}
            {!isHistory ? (
               <input 
                 type="number" 
                 // 移除 cursor-not-allowed 與 opacity-80，加入 focus 樣式
                 className="bg-transparent w-full border-b border-gray-400/30 outline-none focus:border-blue-500 transition-colors" 
                 value={item.price} 
                 // 保持 onChange 以便即時輸入 (這會觸發 Firestore 更新，但不影響 local 變數)
                 onChange={e => updateItemValue(item.id, 'price', e.target.value)}
                 // 加入 Focus 紀錄舊數值
                 onFocus={handlePriceFocus}
                 // 加入 Blur 比對並新增歷史紀錄
                 onBlur={handlePriceBlur}
                 title="直接修改價格，系統會自動新增一筆刊登費紀錄"
               />
            ) : item.price}
          </div>
          <div className="text-[10px] opacity-60 mt-1">
             稅: {(item.price * (EXCHANGE_TYPES[item.exchangeType]?.tax || 0)).toFixed(0)}
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className={`text-xs opacity-70 flex items-center gap-1`}>
             刊登費 (2%) 
             {/* === 修改重點 4: 移除了原本這裡的 + 號按鈕 === */}
          </span>
          <div className="flex flex-col gap-1 mt-1 max-h-20 overflow-y-auto">
             {listingHistory.map((price, idx) => (
                 <div key={idx} className="flex items-center justify-between text-xs bg-black/10 p-1 rounded">
                    <span>${price} <span className="opacity-60">&rarr; {Math.floor(price * BASE_LISTING_FEE_PERCENT)}</span></span>
                    {/* 保留 X 按鈕以供誤觸時刪除 */}
                    {!isHistory && <button onClick={() => removeListingPrice(idx)} className="text-red-400 hover:text-red-600"><X size={10}/></button>}
                 </div>
             ))}
             {listingHistory.length === 0 && <span className="opacity-40 text-xs">- 無紀錄 -</span>}
          </div>
          <div className="text-[10px] text-blue-500 mt-1 font-bold">總計: {totalListingFee}</div>
        </div>

        <div className="flex flex-col">
          <span className={`text-xs opacity-70`}>額外成本 (手動)</span>
          <div className="flex items-center gap-2">
            {!isHistory ? (
               <input type="number" className={`w-full text-right rounded border bg-transparent border-gray-400 text-sm p-1`} value={item.cost || 0} onChange={e => updateItemValue(item.id, 'cost', e.target.value)}/>
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
               className={`px-2 py-1 rounded border text-xs flex items-center select-none bg-black/10 opacity-80`}>
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
            <button 
              onClick={() => { 
                if (item.seller !== currentUser) {
                  alert(`權限不足：只有販賣人 (${item.seller}) 可以執行此操作`);
                  sendLog(currentUser, "權限不足", `嘗試出售非本人物品：${item.itemName} (賣家: ${item.seller})`);
                  return;
                }
                setConfirmSettleId(item.id); 
                setConfirmDeleteId(null); 
              }} 
              className={`flex items-center gap-2 px-4 py-2 rounded font-bold text-sm bg-blue-600 text-white shadow hover:bg-blue-700`}
            >
              <CheckCircle size={16}/> 已出售
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ItemCard;