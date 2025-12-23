// src/views/CharacterListView.js
import React, { useState, useEffect } from 'react';
import { 
  Copy, Check, User, Plus, Trash2, Edit3, Save, PlayCircle, Zap, Ticket, GripVertical, X
} from 'lucide-react';
import { 
  doc, onSnapshot, setDoc, runTransaction 
} from "firebase/firestore";
import { db } from '../config/firebase';
import { MEMBERS } from '../utils/constants'; 
import { sendLog } from '../utils/helpers';

// === 定義 8 種職業與圖片路徑 (無顏色設定) ===
// 請確保您的 webp 檔案放在 public/class_icons/ 資料夾內
const CLASS_ICON_BASE_PATH = process.env.PUBLIC_URL + '/class_icons/';

const CLASS_OPTIONS = [
  { id: 'gladiator', label: '劍星', img: 'gladiator.webp' },
  { id: 'templar', label: '守護星', img: 'templar.webp' },
  { id: 'ranger', label: '弓星', img: 'ranger.webp' },
  { id: 'assassin', label: '殺星', img: 'assassin.webp' },
  { id: 'sorcerer', label: '魔導星', img: 'sorcerer.webp' },
  { id: 'spiritmaster', label: '精靈星', img: 'spiritmaster.webp' },
  { id: 'cleric', label: '治癒星', img: 'cleric.webp' },
  { id: 'chanter', label: '護法星', img: 'chanter.webp' },
];

const CharacterListView = ({ isDarkMode, currentUser }) => {
  const [characterData, setCharacterData] = useState({});
  const [selectedMembers, setSelectedMembers] = useState([]); 
  const [isEditMode, setIsEditMode] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [newCharInputs, setNewCharInputs] = useState({});

  // 拖曳狀態
  const [dragItem, setDragItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);

  // 職業選擇 Modal 狀態
  const [classSelector, setClassSelector] = useState({ isOpen: false, member: null, index: null });

  // 1. 讀取資料
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "member_characters", "data"), (docSnap) => {
      if (docSnap.exists()) {
        setCharacterData(docSnap.data());
      } else {
        setCharacterData({});
      }
    });
    return () => unsub();
  }, []);

  // 2. 自動回復機制 (Auto Regen Logic)
  useEffect(() => {
    if (!db) return;

    const checkAndApplyRegen = async () => {
      try {
        await runTransaction(db, async (transaction) => {
          const statusRef = doc(db, "system_data", "regen_status");
          const dataRef = doc(db, "member_characters", "data");
          
          const statusSnap = await transaction.get(statusRef);
          const dataSnap = await transaction.get(dataRef);

          if (!dataSnap.exists()) return;

          let lastTime = 0;
          if (statusSnap.exists()) {
            lastTime = statusSnap.data().lastCheckTime || 0;
          }

          const now = new Date().getTime();
          if (now - lastTime < 60000) return;

          const STAMINA_HOURS = [2, 5, 8, 11, 14, 17, 20, 23]; 
          const TICKET_HOURS = [5, 13, 21];

          let currentData = dataSnap.data();
          let hasChange = false;
          let checkPointer = lastTime > 0 ? lastTime : now - 1;

          const ONE_DAY = 24 * 60 * 60 * 1000;
          if (now - checkPointer > ONE_DAY) {
             checkPointer = now - ONE_DAY;
          }

          let staminaGain = 0;
          let ticketGain = 0;

          let pointerDate = new Date(checkPointer);
          pointerDate.setMinutes(0, 0, 0); 
          
          while (pointerDate.getTime() < now) {
             pointerDate.setTime(pointerDate.getTime() + 3600000); 
             
             const hourTimestamp = pointerDate.getTime();
             const h = pointerDate.getHours(); 

             if (hourTimestamp > lastTime && hourTimestamp <= now) {
                if (STAMINA_HOURS.includes(h)) staminaGain += 15;
                if (TICKET_HOURS.includes(h)) ticketGain += 1;
             }
          }

          if (staminaGain === 0 && ticketGain === 0) {
             transaction.set(statusRef, { lastCheckTime: now }, { merge: true });
             return;
          }

          Object.keys(currentData).forEach(member => {
             const chars = currentData[member];
             if (Array.isArray(chars)) {
               const newChars = chars.map(c => {
                 if (typeof c === 'string') return c; 
                 return {
                   ...c,
                   stamina: Math.min(9999, (parseInt(c.stamina) || 0) + staminaGain), 
                   tickets: Math.min(99, (parseInt(c.tickets) || 0) + ticketGain)
                 };
               });
               currentData[member] = newChars;
               hasChange = true;
             }
          });

          if (hasChange) {
             transaction.set(dataRef, currentData);
             transaction.set(statusRef, { lastCheckTime: now }, { merge: true });
             console.log(`[Regen] 全體回復: 體力+${staminaGain}, 票卷+${ticketGain}`);
          }
        });
      } catch (e) {
        console.error("Auto Regen Failed", e);
      }
    };

    checkAndApplyRegen();
    const interval = setInterval(checkAndApplyRegen, 60000);
    return () => clearInterval(interval);
  }, []); 

  const handleToggleMember = (member) => {
    if (selectedMembers.includes(member)) {
      setSelectedMembers(selectedMembers.filter(m => m !== member));
    } else {
      setSelectedMembers([...selectedMembers, member]);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // 統一更新角色的某個欄位
  const updateCharacterField = async (member, index, field, value) => {
    if (currentUser === '訪客') return;
    
    const currentList = [...(characterData[member] || [])];
    const targetChar = currentList[index];

    let newCharObj = typeof targetChar === 'string' 
      ? { name: targetChar, gear: '', tickets: 0, stamina: 0, custom: 0, note: '', class: null } 
      : { ...targetChar };

    newCharObj[field] = value;
    currentList[index] = newCharObj;

    try {
      await setDoc(doc(db, "member_characters", "data"), {
        [member]: currentList
      }, { merge: true });
    } catch (e) {
      console.error("Update failed", e);
    }
  };

  // === 處理選擇職業 ===
  const handleSelectClass = (classId) => {
    if (classSelector.member && classSelector.index !== null) {
      updateCharacterField(classSelector.member, classSelector.index, 'class', classId);
    }
    setClassSelector({ isOpen: false, member: null, index: null });
  };

  const handleCompleteRun = async (member, index) => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");

    const currentList = [...(characterData[member] || [])];
    const targetChar = currentList[index];
    
    if (typeof targetChar === 'string') return;

    const runs = parseInt(targetChar.custom) || 0;
    if (runs <= 0) return alert("請輸入有效的場次數量 (大於 0)");

    const ticketCost = runs * 1;
    const staminaCost = runs * 80;

    const currentTickets = parseInt(targetChar.tickets) || 0;
    const currentStamina = parseInt(targetChar.stamina) || 0;

    const newTickets = currentTickets - ticketCost;
    const newStamina = currentStamina - staminaCost;

    const newCharObj = {
      ...targetChar,
      tickets: newTickets,
      stamina: newStamina,
      custom: '' 
    };

    currentList[index] = newCharObj;

    try {
      await setDoc(doc(db, "member_characters", "data"), {
        [member]: currentList
      }, { merge: true });
      sendLog(currentUser, "完成場次", `${targetChar.name} 完成 ${runs} 場 (票-${ticketCost}, 體-${staminaCost})`);
      alert(`已扣除 ${runs} 場消耗！\n剩餘票卷: ${newTickets}\n剩餘體力: ${newStamina}`);
    } catch (e) {
      console.error("Complete run failed", e);
      alert("更新失敗");
    }
  };

  const handleAddCharacter = async (member) => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    const nameToAdd = newCharInputs[member]?.trim();
    if (!nameToAdd) return;

    try {
      const currentList = [...(characterData[member] || [])];
      const newCharObj = {
        name: nameToAdd,
        gear: '',
        tickets: 0,
        stamina: 0,
        custom: '',
        note: '',
        class: null 
      };
      
      const newList = [...currentList, newCharObj];

      await setDoc(doc(db, "member_characters", "data"), {
        [member]: newList
      }, { merge: true });
      
      setNewCharInputs(prev => ({ ...prev, [member]: '' })); 
      sendLog(currentUser, "新增角色", `${member}: ${nameToAdd}`);
    } catch (e) {
      console.error("新增失敗", e);
      alert("新增失敗");
    }
  };

  const handleDeleteCharacter = async (member, index) => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    
    const currentList = characterData[member] || [];
    const target = currentList[index];
    const charName = typeof target === 'string' ? target : target.name;

    if (!window.confirm(`確定要刪除 ${member} 的角色 "${charName}" 嗎？`)) return;

    try {
      const newList = currentList.filter((_, i) => i !== index);
      await setDoc(doc(db, "member_characters", "data"), {
        [member]: newList
      }, { merge: true });
      sendLog(currentUser, "刪除角色", `${member}: ${charName}`);
    } catch (e) {
      console.error("刪除失敗", e);
      alert("刪除失敗");
    }
  };

  // === 拖曳排序邏輯 ===
  const handleDragStart = (e, member, index) => {
    if (['INPUT', 'BUTTON', 'SVG', 'PATH', 'IMG'].includes(e.target.tagName)) {
        return; 
    }
    setDragItem({ member, index });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (e, member, index) => {
    if (dragItem && dragItem.member === member) {
        setDragOverItem({ member, index });
    }
  };

  const handleDragEnd = async () => {
    if (!dragItem || !dragOverItem) {
        setDragItem(null);
        setDragOverItem(null);
        return;
    }

    if (dragItem.member === dragOverItem.member) {
        const member = dragItem.member;
        const list = [...(characterData[member] || [])];
        
        const draggedContent = list[dragItem.index];
        list.splice(dragItem.index, 1);
        list.splice(dragOverItem.index, 0, draggedContent);

        setCharacterData(prev => ({ ...prev, [member]: list }));

        try {
            await setDoc(doc(db, "member_characters", "data"), {
                [member]: list
            }, { merge: true });
        } catch (e) {
            console.error("Sort update failed", e);
            alert("排序儲存失敗");
        }
    }

    setDragItem(null);
    setDragOverItem(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-20 relative">
      
      <style>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold border-l-4 pl-3 border-green-500 mb-1" style={{ color: 'var(--app-text)' }}>
            角色列表
          </h2>
          <p className="text-sm opacity-60" style={{ color: 'var(--app-text)' }}>
            管理角色資訊、體力與票卷。每日定時自動補給。
          </p>
        </div>

        <div className="flex gap-2">
           {currentUser && currentUser !== '訪客' && (
             <button 
               onClick={() => setIsEditMode(!isEditMode)}
               className={`flex items-center gap-2 px-3 py-2 rounded text-white shadow transition-all ${isEditMode ? 'bg-green-600' : 'bg-gray-500'}`}
             >
               {isEditMode ? <Save size={16}/> : <Edit3 size={16}/>}
               {isEditMode ? '完成編輯' : '編輯模式'}
             </button>
           )}
        </div>
      </div>

      {/* Member Toggles */}
      <div className="p-4 rounded-xl shadow-sm mb-6 flex flex-wrap gap-2 transition-colors" style={{ background: 'var(--app-card-bg)' }}>
        <button 
          onClick={() => setSelectedMembers(selectedMembers.length === MEMBERS.length ? [] : MEMBERS)}
          className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${selectedMembers.length === MEMBERS.length ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent opacity-60 border-gray-500'}`}
          style={{ color: selectedMembers.length === MEMBERS.length ? 'white' : 'var(--app-text)' }}
        >
          {selectedMembers.length === MEMBERS.length ? '全選' : '全不選'}
        </button>
        <div className="w-px h-6 bg-gray-500/30 mx-2 self-center"></div>
        {MEMBERS.map(member => (
          <button
            key={member}
            onClick={() => handleToggleMember(member)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-all flex items-center gap-1
              ${selectedMembers.includes(member) 
                ? 'bg-blue-500/20 border-blue-500 text-blue-500 font-bold' 
                : 'bg-transparent border-gray-500/50 opacity-50'}`}
            style={{ 
              color: selectedMembers.includes(member) ? (isDarkMode ? '#60a5fa' : '#2563eb') : 'var(--app-text)',
              borderColor: selectedMembers.includes(member) ? (isDarkMode ? '#60a5fa' : '#2563eb') : undefined
            }}
          >
            {selectedMembers.includes(member) && <Check size={12} />}
            {member}
          </button>
        ))}
      </div>

      {/* Character Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {MEMBERS.filter(m => selectedMembers.includes(m)).map(member => {
          const chars = characterData[member] || [];
          
          return (
            <div 
              key={member} 
              className="rounded-xl overflow-hidden shadow-md flex flex-col border border-white/10 transition-colors"
              style={{ background: 'var(--app-card-bg)' }}
            >
              {/* Member Header */}
              <div className="p-3 border-b border-white/10 flex justify-between items-center bg-black/10">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-full bg-blue-500 text-white"><User size={16} /></div>
                  <h3 className="font-bold text-lg" style={{ color: 'var(--app-text)' }}>{member}</h3>
                  <span className="text-xs opacity-50 bg-black/20 px-2 py-0.5 rounded-full" style={{ color: 'var(--app-text)' }}>{chars.length} 角</span>
                </div>
              </div>

              {/* Characters List */}
              <div className="p-3 flex-1 flex flex-col gap-3">
                {chars.length > 0 ? (
                  chars.map((charData, idx) => {
                    const char = typeof charData === 'string' 
                      ? { name: charData, gear: '', tickets: 0, stamina: 0, custom: '', note: '', class: null } 
                      : charData;

                    const isDragging = dragItem && dragItem.member === member && dragItem.index === idx;
                    const isDragOver = dragOverItem && dragOverItem.member === member && dragOverItem.index === idx;

                    // 找出目前的職業設定
                    const currentClass = CLASS_OPTIONS.find(c => c.id === char.class);

                    return (
                      <div 
                        key={idx}
                        draggable={currentUser !== '訪客'}
                        onDragStart={(e) => handleDragStart(e, member, idx)}
                        onDragEnter={(e) => handleDragEnter(e, member, idx)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        
                        className={`flex flex-col gap-2 p-3 rounded border shadow-sm relative group transition-all
                          ${isDragging ? 'opacity-40 border-dashed border-white' : 'bg-black/5 border-white/5'}
                          ${isDragOver ? 'border-blue-500 border-2' : ''}
                          ${currentUser !== '訪客' ? 'cursor-move' : ''}
                        `}
                      >
                        {/* === Row 1: Class | Name | Gear | Copy === */}
                        <div className="flex items-center gap-2">
                          <GripVertical size={14} className="opacity-30 flex-shrink-0" />
                          
                          {/* === 職業圖示按鈕 (純圖片模式) === */}
                          <button
                            onClick={() => {
                                if (currentUser === '訪客') return;
                                setClassSelector({ isOpen: true, member, index: idx });
                            }}
                            onMouseDown={(e) => e.stopPropagation()} 
                            className={`flex items-center justify-center rounded-lg border border-white/10 transition-all hover:brightness-110 active:scale-95 flex-shrink-0 overflow-hidden
                                ${currentClass ? 'w-8 h-8' : 'w-24 h-8 bg-white/5 hover:bg-white/10'}`}
                            // 移除 backgroundColor
                            title={currentClass ? currentClass.label : "點擊設定職業"}
                          >
                             {currentClass ? (
                                 <img 
                                   src={CLASS_ICON_BASE_PATH + currentClass.img} 
                                   alt={currentClass.label} 
                                   className="w-full h-full object-cover"
                                 />
                             ) : (
                                 <span className="text-[10px] opacity-60">點擊選擇職業</span>
                             )}
                          </button>

                          <span className="font-bold text-base flex-1 truncate" style={{ color: 'var(--card-text)' }}>
                            {char.name}
                          </span>
                          
                          <input 
                            type="text" 
                            maxLength={4}
                            placeholder="裝等"
                            className="w-14 text-center text-sm p-1 rounded bg-black/10 border border-white/10 outline-none focus:border-blue-500"
                            style={{ color: 'var(--card-text)' }}
                            value={char.gear || ''}
                            onChange={(e) => updateCharacterField(member, idx, 'gear', e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                          />

                          <button 
                            onClick={() => handleCopy(char.name)}
                            onMouseDown={(e) => e.stopPropagation()} 
                            className={`p-1.5 rounded transition-colors ${copiedId === char.name ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                          >
                            {copiedId === char.name ? <Check size={14}/> : <Copy size={14}/>}
                          </button>

                          {isEditMode && (
                            <button 
                              onClick={() => handleDeleteCharacter(member, idx)}
                              onMouseDown={(e) => e.stopPropagation()} 
                              className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                            >
                              <Trash2 size={14}/>
                            </button>
                          )}
                        </div>

                        {/* === Row 2: Ticket | Stamina | Runs === */}
                        <div className="flex items-center gap-2">
                          {/* Ticket */}
                          <div className="flex items-center gap-1 flex-1 bg-black/10 rounded px-2 py-1 border border-white/5">
                            <Ticket size={12} className="text-yellow-500 flex-shrink-0"/>
                            <input 
                              type="number" 
                              maxLength={2}
                              className="w-full bg-transparent outline-none text-sm text-center font-mono"
                              placeholder="票"
                              style={{ color: 'var(--card-text)' }}
                              value={char.tickets || ''}
                              onChange={(e) => updateCharacterField(member, idx, 'tickets', e.target.value)}
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          </div>

                          {/* Stamina */}
                          <div className="flex items-center gap-1 flex-1 bg-black/10 rounded px-2 py-1 border border-white/5">
                            <Zap size={12} className="text-blue-400 flex-shrink-0"/>
                            <input 
                              type="number" 
                              maxLength={4}
                              className="w-full bg-transparent outline-none text-sm text-center font-mono"
                              placeholder="體力"
                              style={{ color: 'var(--card-text)' }}
                              value={char.stamina || ''}
                              onChange={(e) => updateCharacterField(member, idx, 'stamina', e.target.value)}
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          </div>

                          {/* Custom Runs */}
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              className="w-8 text-center text-sm p-1 rounded bg-black/10 border border-white/10 outline-none"
                              placeholder="" 
                              style={{ color: 'var(--card-text)' }}
                              value={char.custom || ''}
                              onChange={(e) => updateCharacterField(member, idx, 'custom', e.target.value)}
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                            <button 
                              className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-2 py-1.5 rounded flex items-center gap-1 whitespace-nowrap shadow"
                              title={`扣除: ${char.custom||0}票 / ${(char.custom||0)*80}體`}
                              onClick={() => handleCompleteRun(member, idx)}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <PlayCircle size={10}/> 完場
                            </button>
                          </div>
                        </div>

                        {/* === Row 3: Note === */}
                        <div>
                          <input 
                            type="text" 
                            className="w-full text-xs p-1 bg-transparent border-b border-white/10 outline-none focus:border-white/30 placeholder-white/20"
                            placeholder="備註..."
                            style={{ color: 'var(--card-text)' }}
                            value={char.note || ''}
                            onChange={(e) => updateCharacterField(member, idx, 'note', e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                        </div>

                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4 opacity-30 text-sm italic" style={{ color: 'var(--app-text)' }}>
                    尚無角色資料
                  </div>
                )}

                {/* Add New Input */}
                {isEditMode && (
                  <div className="mt-2 flex gap-2 animate-in fade-in">
                    <input 
                      type="text" 
                      placeholder="輸入新角色 ID..."
                      className="flex-1 p-2 text-sm rounded border border-gray-500/30 bg-black/20 outline-none focus:border-blue-500"
                      style={{ color: 'var(--app-text)' }}
                      value={newCharInputs[member] || ''}
                      onChange={(e) => setNewCharInputs({...newCharInputs, [member]: e.target.value})}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCharacter(member)}
                    />
                    <button 
                      onClick={() => handleAddCharacter(member)}
                      className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      disabled={!newCharInputs[member]}
                    >
                      <Plus size={18}/>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* === 職業選擇 Modal (純圖片) === */}
      {classSelector.isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setClassSelector({ isOpen: false, member: null, index: null })}
        >
          <div 
            className={`w-full max-w-sm rounded-xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}
            onClick={(e) => e.stopPropagation()} // 防止點擊內部關閉
          >
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-lg flex items-center gap-2"><User size={20}/> 選擇職業</h3>
               <button onClick={() => setClassSelector({ isOpen: false, member: null, index: null })} className="p-1 rounded hover:bg-gray-500/20"><X size={20}/></button>
            </div>
            
            <div className="grid grid-cols-4 gap-3">
               {CLASS_OPTIONS.map(opt => (
                 <button
                   key={opt.id}
                   onClick={() => handleSelectClass(opt.id)}
                   className="flex flex-col items-center justify-center gap-2 p-2 rounded-lg border border-transparent hover:border-gray-500/30 hover:bg-black/5 transition-all active:scale-95"
                 >
                   <div 
                     className="w-12 h-12 rounded overflow-hidden shadow-lg bg-black/20"
                   >
                     <img 
                       src={CLASS_ICON_BASE_PATH + opt.img} 
                       alt={opt.label} 
                       className="w-full h-full object-cover"
                     />
                   </div>
                   <span className="text-xs font-bold opacity-80">{opt.label}</span>
                 </button>
               ))}
               
               {/* 清除按鈕 */}
               <button
                   onClick={() => handleSelectClass(null)}
                   className="flex flex-col items-center justify-center gap-2 p-2 rounded-lg border border-dashed border-gray-400/50 hover:bg-black/5 transition-all active:scale-95 opacity-60 hover:opacity-100"
               >
                   <div className="w-12 h-12 rounded flex items-center justify-center bg-gray-400/20">
                     <X size={24} className="opacity-50"/>
                   </div>
                   <span className="text-xs font-bold">清除</span>
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CharacterListView;