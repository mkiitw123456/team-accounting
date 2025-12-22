// src/components/BossTimelinePanel.js
import React, { useState, useEffect } from 'react';
import { X, Settings, Trash2, Clock, Calendar, Loader2 } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from '../config/firebase';
import { formatTimeOnly } from '../utils/helpers';

const BossTimelinePanel = ({ isOpen, onClose, isDarkMode, currentUser }) => {
  const [types, setTypes] = useState([]);
  const [records, setRecords] = useState([]);
  const [now, setNow] = useState(new Date());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);

  const [typeForm, setTypeForm] = useState({ name: '', interval: 60, color: '#FF5733' });
  const [recordForm, setRecordForm] = useState({ typeId: '', deathTime: '', deathDate: '' });

  useEffect(() => {
    if (!isOpen || !db) return;
    const timer = setInterval(() => setNow(new Date()), 60000); 
    setNow(new Date());

    const qTypes = query(collection(db, "timeline_types"), orderBy("interval"));
    const unsubTypes = onSnapshot(qTypes, snap => setTypes(snap.docs.map(d => ({id: d.id, ...d.data()}))));

    const qRecords = query(collection(db, "timeline_records"), orderBy("deathTimestamp", "desc"));
    const unsubRecords = onSnapshot(qRecords, snap => setRecords(snap.docs.map(d => ({id: d.id, ...d.data()}))));

    return () => {
      clearInterval(timer);
      unsubTypes();
      unsubRecords();
    };
  }, [isOpen]);

  const handleAddType = async () => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    if (!typeForm.name || typeForm.interval <= 0) return alert("請輸入名稱與有效分鐘數");
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "timeline_types"), typeForm);
      setTypeForm({ name: '', interval: 60, color: '#FF5733' });
    } catch (error) {
      console.error("Add Type Error:", error);
      alert("新增失敗：" + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteType = async (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    if (!id) return alert("錯誤：找不到該設定的 ID");

    if (window.confirm("刪除此設定將不會刪除已存在的紀錄，確定嗎？")) {
      try {
        await deleteDoc(doc(db, "timeline_types", id));
      } catch (error) {
        console.error("Delete Type Error:", error);
        alert("刪除失敗：" + error.message);
      }
    }
  };

  const handleAddRecord = async () => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    if (!recordForm.typeId || !recordForm.deathDate || !recordForm.deathTime) return alert("資料不完整");
    
    setIsSubmitting(true);
    try {
      const dateTimeStr = `${recordForm.deathDate}T${recordForm.deathTime}`;
      const timestamp = new Date(dateTimeStr).getTime();

      await addDoc(collection(db, "timeline_records"), {
        typeId: recordForm.typeId,
        deathTimestamp: timestamp,
        creator: currentUser,
        createdAt: new Date().getTime()
      });
      setShowRecordModal(false);
    } catch (error) {
      console.error("Add Record Error:", error);
      alert("新增紀錄失敗：" + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async (id) => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    if (window.confirm("確定刪除這條時間線紀錄嗎？")) {
      try {
        await deleteDoc(doc(db, "timeline_records", id));
      } catch (error) {
        console.error("Delete Record Error:", error);
        alert("刪除失敗：" + error.message);
      }
    }
  };

  const calculateMarkers = (targetDate) => {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    let rawMarkers = [];

    records.forEach(record => {
      const type = types.find(t => t.id === record.typeId);
      if (!type) return;

      const intervalMs = type.interval * 60 * 1000;
      let checkTime = record.deathTimestamp;

      if (checkTime < startOfDay.getTime()) {
        const diff = startOfDay.getTime() - checkTime;
        const jumps = Math.floor(diff / intervalMs);
        checkTime += jumps * intervalMs;
      }

      while (checkTime <= endOfDay.getTime() + intervalMs) { 
        if (checkTime >= startOfDay.getTime() && checkTime <= endOfDay.getTime()) {
           const current = new Date(checkTime);
           const totalMinutes = current.getHours() * 60 + current.getMinutes();
           const percent = (totalMinutes / 1440) * 100;
           
           rawMarkers.push({
             id: record.id + '_' + checkTime,
             percent,
             time: formatTimeOnly(current),
             color: type.color,
             name: type.name,
             originalRecordId: record.id,
             interval: type.interval
           });
        }
        checkTime += intervalMs;
      }
    });

    rawMarkers.sort((a, b) => a.percent - b.percent);

    const levels = [ -10, -10, -10, -10 ]; 
    const THRESHOLD = 2.5; 

    const stackedMarkers = rawMarkers.map(marker => {
      let assignedLevel = 0;
      for (let i = 0; i < levels.length; i++) {
        if (marker.percent > levels[i] + THRESHOLD) {
          assignedLevel = i;
          levels[i] = marker.percent;
          break;
        }
        if (i === levels.length - 1) {
          assignedLevel = 0; 
          levels[0] = marker.percent;
        }
      }
      return { ...marker, level: assignedLevel };
    });

    return stackedMarkers;
  };

  if (!isOpen) return null;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todayMarkers = calculateMarkers(today);
  const tomorrowMarkers = calculateMarkers(tomorrow);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentPercent = (currentMinutes / 1440) * 100;

  const highlightHours = [2, 5, 8, 11, 14, 17, 20, 23];

  const TimelineRow = ({ label, markers, showCurrentLine }) => (
    <div className="mb-10 relative">
      <div className="flex justify-between items-end mb-6">
         <h4 className={`font-bold text-lg ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{label}</h4>
      </div>
      
      {/* 刻度尺背景 */}
      {/* === 修改重點：移除 overflow-hidden，讓上方的數字刻度可以顯示 === */}
      <div className={`h-16 w-full relative rounded border ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-100 border-gray-300'}`}> 
        
        {/* 高光時段 (z-0: 最底層) */}
        {highlightHours.map(h => (
           <div 
             key={`hl-${h}`} 
             className="absolute top-0 bottom-0 bg-yellow-500/10 border-x border-yellow-500/20 z-0"
             style={{ left: `${(h/24)*100}%`, width: `${(1/24)*100}%` }}
           />
        ))}

        {/* 小時刻度 (z-10: 確保在背景之上) */}
        {[...Array(25)].map((_, i) => (
          <div key={i} className="absolute top-0 bottom-0 border-l border-gray-400/30 z-10" style={{ left: `${(i/24)*100}%` }}>
             <span className="absolute -top-6 -translate-x-1/2 text-[10px] opacity-70 font-mono font-bold">{i}</span>
          </div>
        ))}

        {/* 現在時間線 (z-20) */}
        {showCurrentLine && (
          <div className="absolute top-[-24px] bottom-[-10px] w-0.5 bg-red-500 z-20 shadow-[0_0_8px_rgba(239,68,68,0.8)] pointer-events-none" 
               style={{ left: `${currentPercent}%` }}>
             <div className="absolute -top-1 -translate-x-1/2 bg-red-500 text-white text-[10px] px-1 rounded font-bold">NOW</div>
          </div>
        )}

        {/* Boss 標記 (z-30) */}
        {markers.map((m, idx) => {
          const height = 25; 
          const top = m.level * 25; 
          return (
            <div 
              key={idx}
              className="absolute w-1.5 z-30 hover:z-40 group cursor-pointer transition-all hover:w-3 hover:brightness-125 border-l border-white/20"
              style={{ left: `${m.percent}%`, backgroundColor: m.color, top: `${top}%`, height: `${height}%` }}
              onClick={() => {
                 if(window.confirm(`要刪除這個 ${m.name} (${m.time}) 的時間線追蹤嗎？`)) {
                   handleDeleteRecord(m.originalRecordId);
                 }
              }}
            >
              <div className={`absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs whitespace-nowrap shadow-lg hidden group-hover:block z-50 pointer-events-none ${isDarkMode ? 'bg-black text-white border border-gray-600' : 'bg-white text-gray-800 border border-gray-300'}`}>
                <div className="font-bold flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{background: m.color}}></div>
                  {m.name}
                </div>
                <div className="font-mono text-center">{m.time} (CD:{m.interval}m)</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`w-full max-w-6xl h-[90vh] rounded-xl flex flex-col shadow-2xl ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-800'}`}>
        <div className="p-4 border-b border-gray-500/30 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <h2 className="text-xl font-bold flex items-center gap-2"><Calendar size={24} className="text-orange-500"/> Boss 時間線 (Timeline)</h2>
             <span className="text-xs opacity-50 border px-2 py-0.5 rounded">獨立系統</span>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setShowTypeModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"><Settings size={14}/> 設定 Boss</button>
             <button onClick={() => {
                const nowStr = new Date();
                setRecordForm({ typeId: types[0]?.id || '', deathDate: nowStr.toISOString().split('T')[0], deathTime: `${String(nowStr.getHours()).padStart(2,'0')}:${String(nowStr.getMinutes()).padStart(2,'0')}` });
                setShowRecordModal(true);
             }} className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"><Clock size={14}/> 設定重生時間</button>
             <button onClick={onClose} className="p-1.5 hover:bg-gray-500/20 rounded"><X size={24}/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
           <TimelineRow label="今天 (Today 24hr)" markers={todayMarkers} showCurrentLine={true} />
           <TimelineRow label="明天 (Tomorrow 24hr)" markers={tomorrowMarkers} showCurrentLine={false} />
           <div className="mt-8 p-4 rounded border border-gray-500/20 bg-gray-500/5 text-sm opacity-70">
              <h5 className="font-bold mb-1">💡 說明：</h5>
              <ul className="list-disc pl-5 space-y-1">
                 <li>系統會自動顯示每小時的刻度。</li>
                 <li>黃色高光區域代表重點時段 (2, 5, 8, 11 點)，時間軸標記會自動分層。</li>
              </ul>
           </div>
        </div>
      </div>
      {/* Modals 略 (保持不變) */}
      {showTypeModal && (
        <div className="absolute inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
           <div className={`w-96 p-6 rounded-lg shadow-xl border ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
              <h3 className="font-bold mb-4 flex justify-between items-center">設定 Boss 類型 <button onClick={()=>setShowTypeModal(false)}><X size={18}/></button></h3>
              <div className="space-y-3">
                 <div><label className="text-xs opacity-70">名稱</label><input type="text" className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} value={typeForm.name} onChange={e=>setTypeForm({...typeForm, name: e.target.value})}/></div>
                 <div><label className="text-xs opacity-70">間隔 (分)</label><input type="number" className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} value={typeForm.interval} onChange={e=>setTypeForm({...typeForm, interval: Number(e.target.value)})}/></div>
                 <div><label className="text-xs opacity-70">顏色</label><input type="color" className="w-full h-10 cursor-pointer rounded" value={typeForm.color} onChange={e=>setTypeForm({...typeForm, color: e.target.value})}/></div>
                 <button onClick={handleAddType} disabled={isSubmitting} className="w-full py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">{isSubmitting ? <Loader2 size={16} className="animate-spin"/> : '新增'}</button>
              </div>
              <div className="mt-6 border-t pt-4 border-gray-500/30">
                 <h4 className="text-xs font-bold mb-2 opacity-70">已存類型：</h4>
                 <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {types.map(t => (
                       <div key={t.id} className="flex justify-between items-center text-sm p-2 hover:bg-black/10 rounded border border-transparent hover:border-gray-500/20"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: t.color}}></div><span>{t.name} ({t.interval}m)</span></div><button onClick={(e)=>handleDeleteType(e, t.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button></div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}
      {showRecordModal && (
        <div className="absolute inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
           <div className={`w-96 p-6 rounded-lg shadow-xl border ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
              <h3 className="font-bold mb-4">設定重生時間</h3>
              <div className="space-y-3">
                 <div>
                    <label className="text-xs opacity-70">選擇 Boss</label>
                    <select className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} value={recordForm.typeId} onChange={e=>setRecordForm({...recordForm, typeId: e.target.value})}><option value="">請選擇...</option>{types.map(t => <option key={t.id} value={t.id} className={isDarkMode?'bg-gray-700':'bg-white'}>{t.name} ({t.interval}m)</option>)}</select>
                 </div>
                 <div className="flex gap-2">
                    <div className="flex-1"><label className="text-xs opacity-70">日期</label><input type="date" className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} value={recordForm.deathDate} onChange={e=>setRecordForm({...recordForm, deathDate: e.target.value})}/></div>
                    <div className="flex-1"><label className="text-xs opacity-70">時間</label><input type="time" className={`w-full p-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} value={recordForm.deathTime} onChange={e=>setRecordForm({...recordForm, deathTime: e.target.value})}/></div>
                 </div>
                 <button onClick={handleAddRecord} disabled={isSubmitting} className="w-full py-2 bg-orange-600 text-white rounded font-bold hover:bg-orange-700 mt-2">{isSubmitting ? <Loader2 size={16} className="animate-spin"/> : '開始追蹤'}</button>
              </div>
              <button onClick={()=>setShowRecordModal(false)} className="mt-4 w-full py-2 bg-gray-500 text-white rounded hover:bg-gray-600">取消</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default BossTimelinePanel;