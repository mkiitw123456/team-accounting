// src/components/SystemSettingsModal.js
import React, { useState, useEffect } from 'react';
import { 
  Settings, X, RefreshCcw, Lock, Sparkles, Map as MapIcon, Music, Save, Type, GitBranch 
} from 'lucide-react';
import { doc, setDoc } from "firebase/firestore";
import { db } from '../config/firebase';
import { APP_VERSION } from '../utils/constants';
import { getYouTubeID } from '../utils/helpers';

const SystemSettingsModal = ({ isOpen, onClose, theme, currentSettings, isDarkMode, currentUser }) => {
  const [localSettings, setLocalSettings] = useState({
    appVersion: APP_VERSION,
    mapShowMins: 60,
    mapBlinkMins: 10,
    mapLineGapSecs: 120, 
    mapLineFontSize: 12,
    youtubeVideoId: "",
    geminiApiKey: "" 
  });

  useEffect(() => {
    if (currentSettings) {
      setLocalSettings({
        mapLineFontSize: 12, // 確保舊資料有預設值
        ...currentSettings
      });
    }
  }, [currentSettings]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!db) return;
    try {
      const cleanSettings = {
          ...localSettings,
          youtubeVideoId: getYouTubeID(localSettings.youtubeVideoId)
      };

      await setDoc(doc(db, "system_data", "global_settings"), cleanSettings, { merge: true });
      alert("設定已儲存！");
      onClose();
    } catch (e) {
      console.error("Save failed", e);
      alert("儲存失敗");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[90vh] ${theme.card}`}>
        
        <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-xl font-bold flex items-center gap-2 ${theme.text}`}>
            <Settings size={24} /> 系統全域設定
          </h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* 地圖與計時設定 */}
          <div className="space-y-4 border-b border-gray-500/30 pb-6">
            <h4 className={`font-bold flex items-center gap-2 ${theme.text}`}><MapIcon size={18}/> 地圖與計時</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`text-xs opacity-70 block mb-1 ${theme.text}`}>地圖顯示範圍 (分鐘)</label>
                <input 
                  type="number" 
                  className={`w-full p-2 rounded border ${theme.input}`}
                  value={localSettings.mapShowMins}
                  onChange={(e) => setLocalSettings({...localSettings, mapShowMins: Number(e.target.value)})}
                />
                <span className="text-xs opacity-50">重生前後 N 分鐘內顯示</span>
              </div>
              
              <div>
                <label className={`text-xs opacity-70 block mb-1 ${theme.text}`}>快重生閃爍 (分鐘)</label>
                <input 
                  type="number" 
                  className={`w-full p-2 rounded border ${theme.input}`}
                  value={localSettings.mapBlinkMins}
                  onChange={(e) => setLocalSettings({...localSettings, mapBlinkMins: Number(e.target.value)})}
                />
                <span className="text-xs opacity-50">剩 N 分鐘開始閃爍</span>
              </div>

              <div>
                <label className={`text-xs opacity-70 block mb-1 ${theme.text}`}>連線判定秒數 (秒)</label>
                <input 
                  type="number" 
                  className={`w-full p-2 rounded border ${theme.input}`}
                  value={localSettings.mapLineGapSecs}
                  onChange={(e) => setLocalSettings({...localSettings, mapLineGapSecs: Number(e.target.value)})}
                />
                <span className="text-xs opacity-50">間隔 N 秒內視為同一組</span>
              </div>

              <div>
                <label className={`text-xs opacity-70 block mb-1 ${theme.text}`}>連線文字大小 (px)</label>
                <div className="flex items-center gap-2">
                  <Type size={16} className="opacity-50"/>
                  <input 
                    type="number" 
                    min="8" max="36"
                    className={`w-full p-2 rounded border ${theme.input}`}
                    value={localSettings.mapLineFontSize || 12}
                    onChange={(e) => setLocalSettings({...localSettings, mapLineFontSize: Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 音樂設定 */}
          <div className="p-4 bg-green-900/20 rounded-lg border border-green-500/30">
             <h4 className="font-bold text-green-500 mb-4 flex items-center gap-2"><Music size={16}/> 背景音樂設定</h4>
             <div className="flex flex-col gap-2">
               <label className={`text-sm ${theme.text}`}>YouTube 網址或 ID</label>
               <input 
                 type="text" 
                 placeholder="例如: dQw4w9WgXcQ"
                 className={`w-full p-2 rounded border ${theme.input}`}
                 value={localSettings.youtubeVideoId || ''}
                 onChange={(e) => setLocalSettings({...localSettings, youtubeVideoId: e.target.value})}
               />
               <span className="text-xs opacity-50">system_data/global_settings (全域同步)</span>
             </div>
          </div>

          {/* API 設定 */}
          <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
             <h4 className="font-bold text-purple-400 mb-4 flex items-center gap-2"><Sparkles size={16}/> Gemini AI 設定</h4>
             <div className="flex flex-col gap-2">
               <label className={`text-sm ${theme.text}`}>Google Gemini API Key</label>
               <div className="flex gap-2">
                 <input 
                   type="password" 
                   className={`flex-1 p-2 rounded border ${theme.input}`}
                   value={localSettings.geminiApiKey || ''}
                   onChange={(e) => setLocalSettings({...localSettings, geminiApiKey: e.target.value})}
                   placeholder="AIzaSy..."
                 />
                 <Lock size={16} className="opacity-50 mt-3"/>
               </div>
               <span className="text-xs opacity-50 text-purple-300">* 用於啟用 AI 記帳助手功能</span>
             </div>
          </div>

          {/* === 修改重點：把版本控管改回輸入框 === */}
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-gray-100 border-gray-300'}`}>
             <h4 className={`font-bold mb-3 flex items-center gap-2 ${theme.text}`}><GitBranch size={16}/> 版本控管 (Version Control)</h4>
             <div className="flex flex-col gap-2">
               <label className={`text-sm ${theme.text}`}>APP 版本號 (當前本地: {APP_VERSION})</label>
               <input 
                 type="text" 
                 className={`w-full p-2 rounded border ${theme.input}`}
                 value={localSettings.appVersion || ''}
                 onChange={(e) => setLocalSettings({...localSettings, appVersion: e.target.value})}
                 placeholder="輸入新版本號以觸發通知 (例: 1220v2)"
               />
               <span className="text-xs opacity-50 text-red-400">* 修改此欄位並儲存後，所有版本號不同的使用者都會收到更新通知。</span>
             </div>
          </div>

        </div>

        <div className="p-4 border-t flex justify-end gap-3 bg-black/5 dark:bg-black/20">
          <button onClick={onClose} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">取消</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 shadow-lg">
            <Save size={18}/> 儲存設定
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemSettingsModal;