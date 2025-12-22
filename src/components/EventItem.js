// src/components/EventItem.js
import React from 'react';
// 1. 加入 Star 元件
import { MapPin, Skull, Clock, RefreshCw, RotateCcw, Star } from 'lucide-react'; 
import { formatTimeWithSeconds } from '../utils/helpers';

const EventItem = ({ 
  event, theme, now, 
  confirmDeleteId, setConfirmDeleteId, 
  handleDeleteEvent, handleOpenEditEvent, 
  handleQuickRefresh, handleUndo, hasUndo, 
  currentUser 
}) => {
  
  // 計算是否逾期超過1分鐘 (60000ms)
  const isOverdue = now && (now - new Date(event.respawnTime) > 60000);

  // 2. 修改星星渲染邏輯：改用 <Star /> 取代 <img>
  const renderStars = (count) => {
    if (!count || count <= 0) return null;
    return (
      <div className="flex gap-0.5 mt-1">
        {[...Array(Math.min(count, 10))].map((_, i) => (
          <Star 
            key={i} 
            size={12} 
            className="text-yellow-500 fill-yellow-500" // 設定黃色並填滿
          />
        ))}
      </div>
    );
  };

  return (
    <div 
      className={`p-3 mb-2 rounded shadow-sm flex justify-between items-center transition-colors relative group
        ${isOverdue ? 'border-4 border-red-600' : 'border-l-4'}`} // 逾期紅框邏輯
      style={{ 
        // 若逾期，左邊框顏色改由 border-red-600 統一控制，否則使用 event.color
        borderLeftColor: isOverdue ? undefined : event.color,
        background: 'var(--card-bg)', // 使用全域變數保持主題一致
        color: 'var(--card-text)',
        cursor: 'pointer' // 加入手型鼠標提示可點擊
      }}
      onClick={() => handleOpenEditEvent(event)} // 點擊整張卡片進入編輯
    >
      <div>
        <div className="font-bold text-sm flex items-center gap-2">
          {event.name}
          {event.mapPos && <MapPin size={12} className="text-blue-500" />}
        </div>
        
        {renderStars(event.stars)}

        <div className="text-xs opacity-70 flex items-center gap-1 mt-1">
          <Skull size={10}/> 亡: {formatTimeWithSeconds(new Date(event.deathTime))}
        </div>
        <div className={`text-lg font-mono font-bold flex items-center gap-1 ${isOverdue ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}>
          <Clock size={14}/> {formatTimeWithSeconds(new Date(event.respawnTime))}
        </div>
      </div>

      {/* 右側按鈕群組 */}
      <div className="flex flex-col gap-2 absolute right-3 top-3">
         
         {/* 快速刷新按鈕 (常駐顯示) */}
         <button 
           onClick={(e) => {
             e.stopPropagation();
             if(currentUser === '訪客') return alert("訪客權限僅供瀏覽");
             // 直接刷新，無須確認
             handleQuickRefresh(event);
           }}
           className="p-1.5 bg-blue-500 text-white rounded-full shadow hover:bg-blue-600 transition-transform active:scale-95"
           title="以當前時間刷新"
         >
           <RefreshCw size={14}/>
         </button>

         {/* 回復按鈕 (有歷史紀錄才顯示) */}
         {hasUndo && (
           <button 
             onClick={(e) => {
               e.stopPropagation();
               if(currentUser === '訪客') return alert("訪客權限僅供瀏覽");
               handleUndo(event);
             }}
             className="p-1.5 bg-gray-500 text-white rounded-full shadow hover:bg-gray-600 transition-transform active:scale-95"
             title="回復上一次時間 (最多3步)"
           >
             <RotateCcw size={14}/>
           </button>
         )}
      </div>
    </div>
  );
};

export default EventItem;