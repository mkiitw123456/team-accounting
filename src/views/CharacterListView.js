// src/views/CharacterListView.js
import React, { useState, useEffect } from 'react';
import { 
  Copy, Check, User, Plus, Trash2, Edit3, Save, Database 
} from 'lucide-react';
import { 
  doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove 
} from "firebase/firestore";
import { db } from '../config/firebase';
import { MEMBERS } from '../utils/constants'; // 確保這檔案存在
import { sendLog } from '../utils/helpers';

const CharacterListView = ({ isDarkMode, currentUser }) => {
  const [characterData, setCharacterData] = useState({});
  const [selectedMembers, setSelectedMembers] = useState(MEMBERS); // 預設全選
  const [isEditMode, setIsEditMode] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [newCharInputs, setNewCharInputs] = useState({}); // 儲存各成員的新增輸入框內容

  // 圖片中的初始資料 (用於一鍵匯入)
  const INITIAL_DATA_FROM_IMAGE = {
    "Avalon": ["成都[艾萊]", "成都壞女人[艾萊]", "成都大師姊[艾萊]", "天族肉便器[艾萊]", "成都小壞蛋[艾萊]", "重慶[艾萊]", "天族小迷妹[艾萊]", "成都小迷妹[艾萊]"],
    "Ricky": ["Hoshiyomi[艾萊]", "箭箭箭[艾萊]", "出貨小高手[艾萊]", "魔族小仙女[艾萊]", "傳統美德[艾萊]", "失業補助[艾萊]", "情緒價值[艾萊]", "雜燴兔[艾萊]"],
    "水野": ["朝花[艾萊]", "朝草[艾萊]", "暮花[艾萊]", "暮草[艾萊]", "夕花[艾萊]", "夕草[艾萊]", "晨花[艾萊]", "晨草[艾萊]"],
    "vina": ["靡[艾萊]", "綴[艾萊]", "鷥[艾萊]", "我不要跑主線[艾萊]", "䪰[艾萊]", "阿哈最後一只啦[艾萊]", "辣雞麵要配唐心蛋[艾萊]", "x936[艾萊]"],
    "Wolf": ["MrAirWolf[艾萊]", "FarmerWolf1[艾萊]", "FarmerWolf2[艾萊]", "FarmerWolf3[艾萊]"],
    "UBS": ["怂那把卡拿[伊斯]", "怂那马萨卡[伊斯]", "压力马斯内[伊斯]", "亚路加内噶[伊斯]", "所累哇多卡纳[伊斯]", "蛇喰夢子[艾萊]", "私密马赛[伊斯]", "牙白一[伊斯]"],
    "水月": ["沙奈躲避球[艾萊]", "有紀[艾萊]", "你忙吧[艾萊]", "椰蛋樹蘭叫[艾萊]", "小拉達手槍[艾萊]"],
    "五十嵐": ["金呷[艾萊]", "靜靜品鑑[艾萊]", "細細品劍[艾萊]", "穗弓垣[艾萊]"],
    "彌砂": [], // 圖片中沒看到，留空
    "訪客": []
  };

  useEffect(() => {
    if (!db) return;
    // 監聽 member_characters 集合中的 data 文件
    const unsub = onSnapshot(doc(db, "member_characters", "data"), (docSnap) => {
      if (docSnap.exists()) {
        setCharacterData(docSnap.data());
      } else {
        // 如果文件不存在，設為空物件
        setCharacterData({});
      }
    });
    return () => unsub();
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

  const handleAddCharacter = async (member) => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    const nameToAdd = newCharInputs[member]?.trim();
    if (!nameToAdd) return;

    try {
      const docRef = doc(db, "member_characters", "data");
      // 使用 arrayUnion 加入陣列，若文件不存在則建立
      await setDoc(docRef, {
        [member]: arrayUnion(nameToAdd)
      }, { merge: true });
      
      setNewCharInputs(prev => ({ ...prev, [member]: '' })); // 清空輸入框
      sendLog(currentUser, "新增角色", `${member}: ${nameToAdd}`);
    } catch (e) {
      console.error("新增失敗", e);
      alert("新增失敗");
    }
  };

  const handleDeleteCharacter = async (member, charName) => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    if (!window.confirm(`確定要刪除 ${member} 的角色 "${charName}" 嗎？`)) return;

    try {
      const docRef = doc(db, "member_characters", "data");
      await updateDoc(docRef, {
        [member]: arrayRemove(charName)
      });
      sendLog(currentUser, "刪除角色", `${member}: ${charName}`);
    } catch (e) {
      console.error("刪除失敗", e);
      alert("刪除失敗");
    }
  };

  // 一鍵匯入初始資料
  const handleImportInitialData = async () => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    if (!window.confirm("這將會覆寫/合併目前的資料庫內容為圖片中的預設值，確定要執行嗎？")) return;
    
    try {
      await setDoc(doc(db, "member_characters", "data"), INITIAL_DATA_FROM_IMAGE, { merge: true });
      alert("匯入成功！");
      sendLog(currentUser, "系統操作", "匯入初始角色資料");
    } catch (e) {
      console.error(e);
      alert("匯入失敗");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-20">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 
            className="text-2xl font-bold border-l-4 pl-3 border-green-500 mb-1"
            style={{ color: 'var(--app-text)' }}
          >
            角色 ID 名錄
          </h2>
          <p className="text-sm opacity-60" style={{ color: 'var(--app-text)' }}>
            勾選成員以檢視其分身 ID，點擊卡片即可複製。
          </p>
        </div>

        <div className="flex gap-2">
           {/* 管理功能區 */}
           {currentUser && currentUser !== '訪客' && (
             <>
               {/* 只有當資料庫是空的時候，或者你想強制匯入時才顯示這個按鈕 */}
               {Object.keys(characterData).length === 0 && (
                 <button 
                   onClick={handleImportInitialData}
                   className="flex items-center gap-2 px-3 py-2 rounded bg-yellow-600 text-white shadow hover:bg-yellow-700"
                 >
                   <Database size={16}/> 匯入預設資料
                 </button>
               )}

               <button 
                 onClick={() => setIsEditMode(!isEditMode)}
                 className={`flex items-center gap-2 px-3 py-2 rounded text-white shadow transition-all ${isEditMode ? 'bg-green-600' : 'bg-gray-500'}`}
               >
                 {isEditMode ? <Save size={16}/> : <Edit3 size={16}/>}
                 {isEditMode ? '完成編輯' : '編輯模式'}
               </button>
             </>
           )}
        </div>
      </div>

      {/* Member Toggles */}
      <div 
        className="p-4 rounded-xl shadow-sm mb-6 flex flex-wrap gap-2 transition-colors"
        style={{ background: 'var(--app-card-bg)' }}
      >
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

      {/* Character Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  <div className="p-1.5 rounded-full bg-blue-500 text-white">
                    <User size={16} />
                  </div>
                  <h3 className="font-bold text-lg" style={{ color: 'var(--app-text)' }}>{member}</h3>
                  <span className="text-xs opacity-50 bg-black/20 px-2 py-0.5 rounded-full" style={{ color: 'var(--app-text)' }}>
                    {chars.length} 角
                  </span>
                </div>
              </div>

              {/* Characters Grid */}
              <div className="p-3 flex-1 flex flex-col gap-2">
                {chars.length > 0 ? (
                  chars.map((charName, idx) => (
                    <div 
                      key={idx}
                      className="group flex items-center justify-between p-2 rounded transition-colors relative hover:pl-3"
                      style={{ background: 'var(--card-bg)', color: 'var(--card-text)' }}
                    >
                      <span className="font-mono text-sm truncate select-all">{charName}</span>
                      
                      <div className="flex items-center gap-1">
                        {isEditMode ? (
                          <button 
                            onClick={() => handleDeleteCharacter(member, charName)}
                            className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16}/>
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleCopy(charName)}
                            className={`p-1.5 rounded transition-colors flex items-center gap-1 ${copiedId === charName ? 'bg-green-500 text-white' : 'hover:bg-white/10 text-gray-400 hover:text-white'}`}
                            title="複製名稱"
                          >
                            {copiedId === charName ? <Check size={16}/> : <Copy size={16}/>}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 opacity-30 text-sm italic" style={{ color: 'var(--app-text)' }}>
                    尚無角色資料
                  </div>
                )}

                {/* Add New Character Input */}
                {isEditMode && (
                  <div className="mt-2 flex gap-2 animate-in fade-in slide-in-from-top-2">
                    <input 
                      type="text" 
                      placeholder="輸入 ID..."
                      className="flex-1 p-2 text-sm rounded border border-gray-500/30 bg-black/20 outline-none focus:border-blue-500 transition-colors"
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
    </div>
  );
};

export default CharacterListView;