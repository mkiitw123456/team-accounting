// src/views/BossTimerView.js
import React, { useState, useEffect } from 'react';
import { 
  Clock, Plus, Tag, Zap, RefreshCcw, List, Map as MapIcon, Edit3, Trash2, RefreshCw, X, Star, Calendar 
} from 'lucide-react';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, writeBatch 
} from "firebase/firestore";

import { db } from '../config/firebase';
import { 
  MAP_IMAGE_PATH, sendLog, formatTimeWithSeconds, formatTimeOnly, getRelativeDay, 
  getRandomBrightColor, getCurrentDateStr, getCurrentTimeStr 
} from '../utils/helpers';
import ToastNotification from '../components/ToastNotification';
import EventItem from '../components/EventItem';
import ConnectionOverlay from '../components/ConnectionOverlay';
import QuickTagPanel from '../components/QuickTagPanel';
// 1. 引入新元件
import BossTimelinePanel from '../components/BossTimelinePanel';

const BossTimerView = ({ isDarkMode, currentUser, globalSettings }) => {
  const [bossTemplates, setBossTemplates] = useState([]);
  const [bossEvents, setBossEvents] = useState([]);
  const [now, setNow] = useState(new Date()); 
  const [toastMsg, setToastMsg] = useState(null); 
  
  // 結構: { eventId: [{deathTime, respawnTime}, ...] }
  const [undoHistory, setUndoHistory] = useState({});

  const [isCreateBossModalOpen, setIsCreateBossModalOpen] = useState(false);
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [isQuickTagOpen, setIsQuickTagOpen] = useState(false); 
  // 2. 新增 Timeline 狀態
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingBossId, setEditingBossId] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [viewMode, setViewMode] = useState('LIST');

  const [newBossForm, setNewBossForm] = useState({ name: '', respawnMinutes: 60, color: '#FF5733', mapPos: null, stars: 0 });
  const [recordForm, setRecordForm] = useState({ 
    templateId: '', timeMode: 'current', specificDate: '', specificTime: ''
  });

  const MAP_SHOW_MINS = globalSettings?.mapShowMins || 60;
  const MAP_BLINK_MINS = globalSettings?.mapBlinkMins || 10;

  const theme = {
    text: isDarkMode ? 'text-gray-100' : 'text-gray-800',
    subText: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    input: isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800',
  };

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
    }, 1000); 
    return () => clearInterval(timer);
  }, [bossEvents]); 

  const handleSyncMapPositions = async () => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    if (!db) return;
    if (!window.confirm("這將會根據目前的 Boss 設定，更新所有進行中計時的地圖位置。\n確定要執行嗎？")) return;

    const batch = writeBatch(db);
    let updateCount = 0;

    bossEvents.forEach(event => {
      const template = bossTemplates.find(t => t.id === event.templateId);
      if (template && template.mapPos) {
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
        sendLog(currentUser, "同步位置", `更新了 ${updateCount} 筆計時`);
        alert(`已更新 ${updateCount} 筆計時的地圖位置！`);
      } catch (e) {
        console.error("Batch update failed", e);
        alert("更新失敗，請稍後再試");
      }
    } else {
      alert("目前所有計時的位置皆為最新。");
    }
  };

  const showToast = (message) => {
    setToastMsg(message);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const handleAddQuickRecord = async (template) => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    if (!db || !template) return;
    
    const baseTime = new Date();
    const respawnTime = new Date(baseTime.getTime() + template.respawnMinutes * 60000);
    
    const eventData = {
      templateId: template.id,
      name: template.name,
      color: template.color,
      mapPos: template.mapPos || null,
      stars: template.stars || 0,
      deathTime: baseTime.toISOString(),
      respawnTime: respawnTime.toISOString(),
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, "boss_events"), eventData);
      sendLog(currentUser, "快速紀錄", `${template.name}`);
      showToast(`✅ 已紀錄：${template.name}`);
    } catch(e) {
      console.error("Quick add failed", e);
      alert("新增失敗");
    }
  };

  const handleQuickRefresh = async (event) => {
    if (!db) return;
    const template = bossTemplates.find(t => t.id === event.templateId);
    if (!template) return alert("找不到原始 Boss 設定 (可能已被刪除)，無法計算 CD");

    const currentState = {
      deathTime: event.deathTime,
      respawnTime: event.respawnTime
    };

    setUndoHistory(prev => {
      const eventHistory = prev[event.id] || [];
      const newHistory = [currentState, ...eventHistory].slice(0, 3); 
      return { ...prev, [event.id]: newHistory };
    });

    const baseTime = new Date();
    const respawnTime = new Date(baseTime.getTime() + template.respawnMinutes * 60000);

    try {
      await updateDoc(doc(db, "boss_events", event.id), {
        deathTime: baseTime.toISOString(),
        respawnTime: respawnTime.toISOString()
      });
      sendLog(currentUser, "快速刷新", `${event.name}`);
      showToast(`🔄 已刷新：${event.name}`);
    } catch(e) {
      console.error(e);
      alert("刷新失敗");
    }
  };

  const handleUndo = async (event) => {
    if (!db) return;
    const history = undoHistory[event.id];
    if (!history || history.length === 0) return alert("沒有可回復的紀錄");

    const previousState = history[0]; 

    try {
      await updateDoc(doc(db, "boss_events", event.id), {
        deathTime: previousState.deathTime,
        respawnTime: previousState.respawnTime
      });

      setUndoHistory(prev => ({
        ...prev,
        [event.id]: prev[event.id].slice(1)
      }));

      sendLog(currentUser, "回復時間", `${event.name}`);
      showToast(`zk 已回復：${event.name}`); 
    } catch(e) {
      console.error(e);
      alert("回復失敗");
    }
  };

  const handleOpenCreateBoss = (bossToEdit = null) => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    if (bossToEdit) {
      setEditingBossId(bossToEdit.id);
      setNewBossForm({ 
        name: bossToEdit.name, 
        respawnMinutes: bossToEdit.respawnMinutes, 
        color: bossToEdit.color,
        mapPos: bossToEdit.mapPos || null,
        stars: bossToEdit.stars || 0
      });
    } else {
      setEditingBossId(null);
      setNewBossForm({ 
        name: '', 
        respawnMinutes: 60, 
        color: getRandomBrightColor(),
        mapPos: null,
        stars: 0
      });
    }
    setIsCreateBossModalOpen(true);
  };

  const handleCreateOrUpdateBoss = async () => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    if (!newBossForm.name) return alert("請輸入 Boss 名稱");
    if (editingBossId) {
        await updateDoc(doc(db, "boss_templates", editingBossId), newBossForm);
        sendLog(currentUser, "修改Boss設定", newBossForm.name);
    } else {
        await addDoc(collection(db, "boss_templates"), newBossForm);
        sendLog(currentUser, "新增Boss設定", newBossForm.name);
    }
    setIsCreateBossModalOpen(false);
  };

  const handleOpenEditEvent = (event) => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    setEditingEventId(event.id);
    const dateObj = new Date(event.deathTime);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    setRecordForm({
      templateId: event.templateId,
      timeMode: 'specific', 
      specificDate: `${year}-${month}-${day}`,
      specificTime: `${hours}:${minutes}:${seconds}`
    });
    setIsAddRecordModalOpen(true);
  };

  const handleSaveRecord = async () => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    if (!recordForm.templateId) return alert("請選擇 Boss");
    const template = bossTemplates.find(b => b.id === recordForm.templateId);
    
    let baseTime = new Date();
    if (recordForm.timeMode === 'specific') {
      if (!recordForm.specificDate || !recordForm.specificTime) return alert("請輸入完整的日期與時間");
      baseTime = new Date(`${recordForm.specificDate}T${recordForm.specificTime}`);
    }

    let respawnTime, name, color, mapPos, stars;

    if (template) {
        respawnTime = new Date(baseTime.getTime() + template.respawnMinutes * 60000);
        name = template.name;
        color = template.color;
        mapPos = template.mapPos;
        stars = template.stars || 0; 
    } else if (editingEventId) {
        const originalEvent = bossEvents.find(e => e.id === editingEventId);
        if (originalEvent) {
             const originalDuration = new Date(originalEvent.respawnTime) - new Date(originalEvent.deathTime);
             respawnTime = new Date(baseTime.getTime() + originalDuration);
             name = originalEvent.name;
             color = originalEvent.color;
             mapPos = originalEvent.mapPos;
             stars = originalEvent.stars || 0;
        } else {
            return alert("找不到原始 Boss 設定，無法編輯");
        }
    } else {
        return alert("找不到 Boss 設定 (可能已被刪除)");
    }

    const eventData = {
      templateId: recordForm.templateId,
      name, color, mapPos: mapPos || null,
      stars: stars || 0,
      deathTime: baseTime.toISOString(),
      respawnTime: respawnTime.toISOString(),
    };

    if (editingEventId) {
        await updateDoc(doc(db, "boss_events", editingEventId), eventData);
        sendLog(currentUser, "修改時間紀錄", name);
    } else {
        eventData.createdAt = new Date().toISOString();
        await addDoc(collection(db, "boss_events"), eventData);
        sendLog(currentUser, "手動新增紀錄", name);
    }

    setIsAddRecordModalOpen(false);
    setEditingEventId(null);
    setRecordForm({ 
        templateId: bossTemplates[0]?.id || '', timeMode: 'current', specificDate: getCurrentDateStr(), specificTime: getCurrentTimeStr() 
    });
  };

  const handleDeleteEvent = async (id) => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    try {
        const event = bossEvents.find(e => e.id === id);
        await deleteDoc(doc(db, "boss_events", id));
        sendLog(currentUser, "刪除時間紀錄", event?.name || '未知');
        setConfirmDeleteId(null);
    } catch(e) {
        console.error(e);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    if(!window.confirm("確定要刪除這個 Boss 設定嗎？")) return;
    try {
        const t = bossTemplates.find(b => b.id === id);
        await deleteDoc(doc(db, "boss_templates", id));
        sendLog(currentUser, "刪除Boss設定", t?.name || '未知');
    } catch(e) {
        console.error(e);
    }
  }

  const handleRandomizeColor = () => setNewBossForm({ ...newBossForm, color: getRandomBrightColor() });

  const handleTemplateMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setNewBossForm(prev => ({ ...prev, mapPos: { x, y } }));
  };

  const groupedEvents = {
    yesterday: bossEvents.filter(e => getRelativeDay(e.respawnTime) === 'yesterday'),
    today: bossEvents.filter(e => getRelativeDay(e.respawnTime) === 'today'),
    tomorrow: bossEvents.filter(e => getRelativeDay(e.respawnTime) === 'tomorrow'),
  };

  const displayEvents = bossEvents.sort((a, b) => new Date(a.respawnTime) - new Date(b.respawnTime));
  
  const mapDisplayEvents = displayEvents.filter(e => {
    const diff = (new Date(e.respawnTime) - now) / 1000 / 60;
    return diff <= MAP_SHOW_MINS; 
  });

  const nextBoss = bossEvents.filter(e => new Date(e.respawnTime) > now).sort((a, b) => new Date(a.respawnTime) - new Date(b.respawnTime))[0];

  return (
    <div className="p-4 h-[calc(100vh-80px)] flex flex-col">
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
        <button 
          onClick={() => handleOpenCreateBoss()} 
          className={`flex items-center gap-2 text-white px-4 py-2 rounded shadow transition-opacity ${currentUser === '訪客' ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
          style={{ background: 'var(--app-primary)' }}
        >
          <Plus size={18}/> 建立 Boss
        </button>
        <button 
          onClick={() => { 
            if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
            setRecordForm({
              templateId: bossTemplates[0]?.id || '', timeMode: 'current', specificDate: getCurrentDateStr(), specificTime: getCurrentTimeStr(), mapPos: null
            }); 
            setIsAddRecordModalOpen(true); 
          }} 
          className={`flex items-center gap-2 text-white px-4 py-2 rounded shadow transition-opacity ${currentUser === '訪客' ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
          style={{ background: 'var(--app-primary)' }}
        >
          <Tag size={18}/> 新增紀錄
        </button>
        
        <button 
           onClick={() => currentUser === '訪客' ? alert("訪客權限僅供瀏覽") : setIsQuickTagOpen(true)} 
           className={`flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded shadow ${currentUser === '訪客' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-yellow-400'}`}
        >
          <Zap size={18}/> 快速標籤
        </button>

        <div className="ml-auto bg-gray-200 rounded-lg p-1 flex">
           {/* 3. 在這裡加入時間線按鈕 */}
           <button onClick={() => setIsTimelineOpen(true)} className={`px-3 py-1 rounded flex items-center gap-1 text-sm border-r border-gray-300 text-gray-500 hover:text-orange-500 hover:bg-gray-100`}>
             <Calendar size={14}/> 時間線
           </button>

           <button onClick={handleSyncMapPositions} className={`px-3 py-1 rounded flex items-center gap-1 text-sm border-r border-gray-300 text-gray-500 hover:text-blue-500 hover:bg-gray-100`}>
             <RefreshCcw size={14}/> 同步位置
           </button>
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
              <div 
                key={dayKey} 
                className="rounded-xl p-4 flex flex-col border border-white/10 transition-colors"
                style={{ background: 'var(--app-card-bg)', color: 'var(--app-text)' }}
              >
                <h3 className={`font-bold mb-3 capitalize text-center py-2 border-b ${theme.text}`}>
                  {dayKey === 'yesterday' ? '昨天' : dayKey === 'today' ? '今天' : dayKey === 'tomorrow' ? '明天' : '其他'}
                </h3>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {groupedEvents[dayKey].length > 0 ? (
                    groupedEvents[dayKey].map(event => {
                      const template = bossTemplates.find(t => t.id === event.templateId);
                      const currentStars = template ? (template.stars || 0) : (event.stars || 0);
                      
                      return (
                        <EventItem 
                          key={event.id} 
                          event={{ ...event, stars: currentStars }} 
                          theme={theme}
                          now={now} 
                          confirmDeleteId={confirmDeleteId}
                          setConfirmDeleteId={setConfirmDeleteId}
                          handleDeleteEvent={handleDeleteEvent}
                          handleOpenEditEvent={handleOpenEditEvent}
                          handleQuickRefresh={handleQuickRefresh}
                          handleUndo={handleUndo} 
                          hasUndo={undoHistory[event.id]?.length > 0} 
                          currentUser={currentUser}
                        />
                      );
                    })
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
               
               <ConnectionOverlay displayEvents={mapDisplayEvents} now={now} globalSettings={globalSettings} />

               {mapDisplayEvents.filter(e => e.mapPos).map((event, index) => {
                 const shouldBlink = (new Date(event.respawnTime) - now) <= (MAP_BLINK_MINS * 60 * 1000);
                 return (
                   <div key={event.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-10"
                        style={{ left: `${event.mapPos.x}%`, top: `${event.mapPos.y}%` }}
                        onClick={() => handleOpenEditEvent(event)} 
                        title="點擊編輯">
                      
                      <div className="relative flex items-center justify-center">
                        {shouldBlink && (
                          <div className="absolute w-full h-full rounded-full animate-ping opacity-75" 
                               style={{ backgroundColor: event.color, transform: 'scale(1.5)' }}>
                          </div>
                        )}
                        <div className={`w-5 h-5 rounded-full border-2 border-white shadow-md flex items-center justify-center relative z-10`} style={{ backgroundColor: event.color }}>
                           <span className="text-white text-[10px] font-bold pointer-events-none">{index + 1}</span>
                        </div>
                      </div>

                      <div className={`absolute top-6 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-bold shadow-md z-20 pointer-events-none
                        ${isDarkMode ? 'bg-black/80 text-white' : 'bg-white/90 text-gray-800'}`}>
                        {event.name}
                      </div>

                      <div className="absolute top-12 bg-black/90 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none border border-white/20">
                         {index + 1}. {event.name} ({formatTimeWithSeconds(new Date(event.respawnTime))})
                      </div>
                   </div>
                 );
               })}
            </div>
          </div>
        )}

        <div 
          className="w-full lg:w-80 rounded-xl p-4 flex flex-col shadow border border-white/10 transition-colors"
          style={{ background: 'var(--app-card-bg)', color: 'var(--app-text)' }}
        >
          <h3 className={`font-bold mb-3 flex items-center gap-2 ${theme.text}`}>
            <List size={20}/> 重生順序列表
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2">
            {displayEvents.length > 0 ? (
              displayEvents.map(event => (
                <div 
                  key={'list'+event.id} 
                  className="flex items-center p-2 mb-1 rounded relative transition-colors border-b border-white/5"
                  style={{ background: 'var(--card-bg)', color: 'var(--card-text)' }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: event.color }}></div>
                    <span className={`text-sm truncate ${theme.text}`} title={event.name}>{event.name}</span>
                  </div>
                  
                  <div className={`w-28 mr-2 text-right font-mono font-bold ${((new Date(event.respawnTime) - now) <= (MAP_BLINK_MINS * 60 * 1000)) ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}>
                    {formatTimeWithSeconds(new Date(event.respawnTime))}
                  </div>
                  
                  <div className="flex gap-1">
                    <button onClick={() => handleOpenEditEvent(event)} className={`text-gray-400 p-1 rounded ${currentUser === '訪客' ? 'opacity-30' : 'hover:text-blue-500'}`} title="編輯">
                      <Edit3 size={14}/>
                    </button>
                    {confirmDeleteId === event.id ? (
                      <button onClick={() => handleDeleteEvent(event.id)} className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded animate-bounce">
                        確認
                      </button>
                    ) : (
                      <button onClick={() => currentUser === '訪客' ? alert("訪客權限僅供瀏覽") : setConfirmDeleteId(event.id)} className={`text-gray-400 p-1 rounded ${currentUser === '訪客' ? 'opacity-30' : 'hover:text-red-500'}`} title="刪除">
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
                 <div 
                   key={t.id} 
                   className="text-xs px-2 py-1.5 rounded flex items-center justify-between mb-1"
                   style={{ background: 'var(--card-bg)', color: 'var(--card-text)' }}
                 >
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full" style={{backgroundColor: t.color}}></div>
                     <span className={theme.text}>{t.name} ({t.respawnMinutes}m)</span>
                   </div>
                   <div className="flex gap-2">
                     <button onClick={() => handleOpenCreateBoss(t)} className={`text-blue-500 ${currentUser === '訪客' ? 'opacity-30' : 'hover:text-blue-600'}`}><Edit3 size={12}/></button>
                     <button onClick={() => handleDeleteTemplate(t.id)} className={`text-gray-400 ${currentUser === '訪客' ? 'opacity-30' : 'hover:text-red-500'}`}><X size={12}/></button>
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
                <label className="text-xs opacity-70">星級 (0-10)</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="10" className={`w-20 p-2 rounded border ${theme.input}`} value={newBossForm.stars} onChange={e=>setNewBossForm({...newBossForm, stars: parseInt(e.target.value)||0})}/>
                  <div className="flex gap-0.5">
                    {[...Array(Math.min(newBossForm.stars || 0, 10))].map((_, i) => <Star key={i} size={12} className="fill-yellow-500 text-yellow-500"/>)}
                  </div>
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
                    <input type="time" step="1" className={`w-full p-2 rounded border ${theme.input}`} value={recordForm.specificTime} onChange={e=>setRecordForm({...recordForm, specificTime: e.target.value})}/>
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

      <QuickTagPanel 
        isOpen={isQuickTagOpen} 
        onClose={() => setIsQuickTagOpen(false)}
        bossTemplates={bossTemplates}
        handleAddQuickRecord={handleAddQuickRecord}
        isDarkMode={isDarkMode}
        theme={theme}
      />
      
      {/* 4. 在這裡掛載新元件 */}
      <BossTimelinePanel 
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        isDarkMode={isDarkMode}
        currentUser={currentUser}
      />
    </div>
  );
};

export default BossTimerView;