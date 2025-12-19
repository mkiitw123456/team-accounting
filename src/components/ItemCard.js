// src/components/ItemCard.js
import React from 'react';
import { Trash2, CheckCircle, Plus, X } from 'lucide-react';
import { EXCHANGE_TYPES, BASE_LISTING_FEE_PERCENT } from '../utils/constants';
import { formatDate, calculateFinance, sendLog } from '../utils/helpers';

const ItemCard = ({ 
  item, isHistory, theme, 
  updateItemValue, handleSettleAll, handleDelete,
  confirmSettleId, setConfirmSettleId, confirmDeleteId, setConfirmDeleteId,
  currentUser
}) => {
  const listingHistory = item.listingHistory || [];
  
  const { perPersonSplit, totalListingFee } = calculateFinance(
    item.price, item.exchangeType, item.participants?.length || 0, item.cost, listingHistory
  );

  // === 修改重點：新增刊登費時，同步更新「物品價格」 ===
  const addListingPrice = () => {
      // 提示文字改為輸入「新售價」
      const newPriceStr = prompt("請輸入「重新刊登」的新價格 (系統將自動更新售價並計算2%刊登費):", item.price);
      if (newPriceStr) {
          const priceVal = parseFloat(newPriceStr);
          if (!isNaN(priceVal)) {
              // 1. 加入歷史紀錄
              const newHistory = [...listingHistory, priceVal];
              updateItemValue(item.id, 'listingHistory', newHistory);
              
              // 2. 直接更新主售價 (這會觸發重新計算稅金與淨利)
              updateItemValue(item.id, 'price', priceVal);
          }
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
            {/* === 修改重點：加上 readOnly 與外觀變化，禁止直接修改 === */}
            {!isHistory ? (
               <input 
                 type="number" 
                 className="bg-transparent w-full border-b border-gray-400/30 outline-none cursor-not-allowed opacity-80" 
                 value={item.price} 
                 readOnly 
                 title="請透過右側「刊登費」的 + 號來更新售價"
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
             {!isHistory && (
                 <button onClick={addListingPrice} className="bg-blue-500 text-white rounded-full p-0.5 hover:bg-blue-600 shadow" title="重新刊登 (更新售價)">
                   <Plus size={10}/>
                 </button>
             )}
          </span>
          <div className="flex flex-col gap-1 mt-1 max-h-20 overflow-y-auto">
             {listingHistory.map((price, idx) => (
                 <div key={idx} className="flex items-center justify-between text-xs bg-black/10 p-1 rounded">
                    <span>${price} <span className="opacity-60">&rarr; {Math.floor(price * BASE_LISTING_FEE_PERCENT)}</span></span>
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