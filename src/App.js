// src/App.js
import React, { useState, useEffect } from 'react';
// 只保留導航欄(Nav)和全域功能會用到的圖示
import { 
  Calculator, ShieldAlert, Bot, Settings, User, LogOut, Palette, Users 
} from 'lucide-react';

// 只保留 App.js 監聽全域設定需要的 Firebase 功能
import { doc, onSnapshot, setDoc } from "firebase/firestore"; 
import { db } from './config/firebase';
import CharacterListView from './views/CharacterListView';

// 引入常數
import { APP_VERSION } from './utils/constants';
// 引入 Components
import MusicPlayer from './components/MusicPlayer';
import SystemSettingsModal from './components/SystemSettingsModal';
import UserIdentityModal from './components/UserIdentityModal';
import UpdateNotification from './components/UpdateNotification';
import ThemeEditor from './components/ThemeEditor';
// 引入 Views
import AccountingView from './views/AccountingView';
import BossTimerView from './views/BossTimerView';
import AIAssistantView from './components/AIAssistantView'; 

export default function App() {
  const [currentTab, setCurrentTab] = useState('BOSS_TIMER');
  
  // === 修改 1: 預設強制為 true (黑夜模式) ===
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const [dbReady, setDbReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  
  // === 全域設定狀態 ===
  const [globalSettings, setGlobalSettings] = useState({
    appVersion: APP_VERSION,
    mapShowMins: 60,
    mapBlinkMins: 10,
    mapLineGapMins: 2,
    youtubeVideoId: "",
    geminiApiKey: "" 
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // === 主題自定義狀態 ===
  const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);
  const [customTheme, setCustomTheme] = useState(null); 

  // 1. 監聽使用者切換，從 Firebase 讀取個人化主題
  useEffect(() => {
    if (!currentUser || !db) return;

    const localSaved = localStorage.getItem(`theme_${currentUser}`);
    if (localSaved) {
      try { setCustomTheme(JSON.parse(localSaved)); } catch(e){}
    }

    const docRef = doc(db, "user_settings", currentUser);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().theme) {
        setCustomTheme(docSnap.data().theme);
      }
    });

    return () => unsub();
  }, [currentUser, db]);

  // 2. 儲存主題
  const handleSaveTheme = async (newTheme) => {
    setCustomTheme(newTheme);
    setIsThemeEditorOpen(false);
    
    localStorage.setItem(`theme_${currentUser}`, JSON.stringify(newTheme));

    if (currentUser && db) {
      try {
        await setDoc(doc(db, "user_settings", currentUser), { 
          theme: newTheme,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.error("主題雲端備份失敗", e);
        alert("主題僅儲存於本機 (雲端同步失敗)");
      }
    }
  };

  // 3. 產生 CSS Variables
  const getThemeStyles = () => {
    if (!customTheme) return {};
    
    const bgStyle = customTheme.bgType === 'gradient'
      ? `linear-gradient(${customTheme.bgDirection}deg, ${customTheme.bgColor1} ${customTheme.bgPosition}%, ${customTheme.bgColor2} 100%)`
      : customTheme.bgColor1;

    const primaryStyle = customTheme.primaryType === 'gradient'
      ? `linear-gradient(${customTheme.primaryDirection}deg, ${customTheme.primaryColor1}, ${customTheme.primaryColor2})`
      : customTheme.primaryColor1;

    return {
      '--app-bg': bgStyle,
      '--app-text': customTheme.textColor,
      '--app-card-bg': customTheme.cardBgColor,
      '--app-primary': primaryStyle,
      '--card-bg': customTheme.cardItemBg || '#374151', 
      '--card-text': customTheme.cardItemText || '#ffffff'
    };
  };

  // === 版本檢查狀態 ===
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState('');

  useEffect(() => {
    if (db) setDbReady(true);
    
    // User Identity
    const savedUser = localStorage.getItem('accounting_user');
    if (savedUser) {
      setCurrentUser(savedUser);
    } else {
      setIsUserModalOpen(true);
    }

    if (db) {
      const unsub = onSnapshot(doc(db, "system_data", "global_settings"), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setGlobalSettings(data);
          
          if (data.appVersion && data.appVersion !== APP_VERSION) {
            setRemoteVersion(data.appVersion);
            setShowUpdateNotification(true);
          } else {
            setShowUpdateNotification(false);
          }
        }
      });
      return () => unsub();
    }
  }, [db]);

  const handleUserSelect = (user) => {
    setCurrentUser(user);
    localStorage.setItem('accounting_user', user);
    setIsUserModalOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('accounting_user');
    setCurrentUser(null);
    setIsUserModalOpen(true);
  };
  
  const handleRefresh = () => {
    window.location.reload();
  };

  const theme = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-slate-100',
    nav: isDarkMode ? 'bg-gray-800' : 'bg-slate-900',
    text: isDarkMode ? 'text-gray-100' : 'text-gray-800', 
    card: isDarkMode ? 'bg-gray-800' : 'bg-white',
    subText: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    input: isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800',
  };

  return (
    <div 
      className={`min-h-screen font-sans transition-colors duration-300`}
      style={{
        background: customTheme ? 'var(--app-bg)' : undefined,
        color: customTheme ? 'var(--app-text)' : undefined,
        ...getThemeStyles() 
      }}
    >
      <div className={`min-h-screen ${!customTheme ? (isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-slate-100 text-gray-800') : ''}`}> 

        {!dbReady && (
          <div className="bg-red-600 text-white p-2 text-center text-sm font-bold sticky top-0 z-50">
             尚未初始化 Firebase，請檢查金鑰設定！
          </div>
        )}

        <div className="absolute top-0 left-0 p-1 text-[10px] text-gray-500 opacity-50 pointer-events-none z-50">
          {APP_VERSION}
        </div>

        <UpdateNotification 
          show={showUpdateNotification} 
          remoteVersion={remoteVersion} 
          onRefresh={handleRefresh} 
        />

        <nav 
        className="px-4 py-3 shadow-lg sticky top-0 z-40 transition-colors duration-300"
        style={{ background: 'var(--app-card-bg)', color: 'var(--app-text)' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
             <div 
               className="p-2 rounded-lg text-white shadow-md transition-all duration-300"
               style={{ background: 'var(--app-primary)' }}
             >
                {currentTab === 'ACCOUNTING' ? <Calculator size={24} /> : 
                 currentTab === 'BOSS_TIMER' ? <ShieldAlert size={24} /> : 
                 currentTab === 'CHARACTER_LIST' ? <Users size={24} /> :
                 <Bot size={24} />}
             </div>
             {/* 修改文字 1：角色列表 */}
             <h1 className="text-2xl font-bold tracking-wider hidden md:block">
               {currentTab === 'ACCOUNTING' ? '團隊記帳表' : 
                currentTab === 'BOSS_TIMER' ? 'Boss 重生計時' : 
                currentTab === 'CHARACTER_LIST' ? '角色列表' :
                'AI 財務助手'}
             </h1>
             <div className="flex md:hidden rounded-lg p-1" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <button onClick={()=>setCurrentTab('ACCOUNTING')} className={`px-2 py-1 rounded text-xs ${currentTab==='ACCOUNTING'?'bg-blue-600 text-white':''}`}>記帳</button>
                <button onClick={()=>setCurrentTab('BOSS_TIMER')} className={`px-2 py-1 rounded text-xs ${currentTab==='BOSS_TIMER'?'bg-purple-600 text-white':''}`}>Boss</button>
                <button onClick={()=>setCurrentTab('AI_ASSISTANT')} className={`px-2 py-1 rounded text-xs ${currentTab==='AI_ASSISTANT'?'bg-yellow-500 text-white':''}`}>AI</button>
                <button onClick={()=>setCurrentTab('CHARACTER_LIST')} className={`px-2 py-1 rounded text-xs ${currentTab==='CHARACTER_LIST'?'bg-green-600 text-white':''}`}>角色</button>
             </div>
          </div>

          <div className="flex gap-3 items-center">
            
            <button 
              onClick={() => setIsThemeEditorOpen(true)}
              className="p-2 rounded-full hover:bg-black/10 transition-colors"
              title="自定義外觀"
            >
              <Palette size={20} /> 
            </button>

            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-full hover:bg-black/10 transition-colors"
              title="系統全域設定"
            >
              <Settings size={20} />
            </button>

            {currentUser && (
              <div className="flex items-center gap-2 bg-black/10 px-3 py-1 rounded-full text-sm">
                <User size={14}/> {currentUser}
                <button 
                  onClick={handleLogout} 
                  className="ml-2 p-1 bg-red-500/80 hover:bg-red-600 rounded text-white transition-colors" 
                >
                  <LogOut size={12} />
                </button>
              </div>
            )}
            
            <div className="hidden md:flex gap-2 mr-4 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.1)' }}>
               <button 
                 onClick={() => setCurrentTab('ACCOUNTING')}
                 className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-all ${currentTab === 'ACCOUNTING' ? 'bg-blue-600 text-white shadow' : 'hover:bg-white/10 opacity-70'}`}
               >
                 <Calculator size={16}/> 團隊記帳
               </button>
               <button 
                 onClick={() => setCurrentTab('BOSS_TIMER')}
                 className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-all ${currentTab === 'BOSS_TIMER' ? 'bg-purple-600 text-white shadow' : 'hover:bg-white/10 opacity-70'}`}
               >
                 <ShieldAlert size={16}/> Boss 時間
               </button>
               <button 
                 onClick={() => setCurrentTab('AI_ASSISTANT')}
                 className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-all ${currentTab === 'AI_ASSISTANT' ? 'bg-yellow-500 text-white shadow' : 'hover:bg-white/10 opacity-70'}`}
               >
                 <Bot size={16}/> AI 助手
               </button>
               {/* 修改文字 2：角色列表 */}
               <button 
                 onClick={() => setCurrentTab('CHARACTER_LIST')}
                 className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-all ${currentTab === 'CHARACTER_LIST' ? 'bg-green-600 text-white shadow' : 'hover:bg-white/10 opacity-70'}`}
               >
                 <Users size={16}/> 角色列表
               </button>
            </div>
          </div>
        </div>
      </nav>

        <main className="relative h-[calc(100vh-80px)] overflow-hidden">
          <UserIdentityModal 
            isOpen={isUserModalOpen} 
            onSelectUser={handleUserSelect} 
            theme={theme}
          />

          <SystemSettingsModal 
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            theme={theme}
            currentSettings={globalSettings}
            isDarkMode={isDarkMode}
            currentUser={currentUser}
          />

          <ThemeEditor 
            isOpen={isThemeEditorOpen}
            onClose={() => setIsThemeEditorOpen(false)}
            currentTheme={customTheme}
            onSave={handleSaveTheme}
          />
          
          <MusicPlayer 
             videoId={globalSettings.youtubeVideoId}
             isDarkMode={isDarkMode}
          />

          <div className="h-full overflow-y-auto">
            {currentTab === 'ACCOUNTING' ? (
              <AccountingView isDarkMode={isDarkMode} dbReady={dbReady} currentUser={currentUser} />
            ) : currentTab === 'BOSS_TIMER' ? (
              <BossTimerView isDarkMode={isDarkMode} currentUser={currentUser} globalSettings={globalSettings} />
            ) : currentTab === 'CHARACTER_LIST' ? (
              <CharacterListView isDarkMode={isDarkMode} currentUser={currentUser} />
            ) : (
              <div className="p-4 h-full max-w-4xl mx-auto">
                  <AIAssistantView 
                    isDarkMode={isDarkMode} 
                    currentUser={currentUser} 
                    globalSettings={globalSettings}
                    theme={theme}
                  />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}