// src/components/SystemSettingsModal.js
import React, { useState, useEffect } from 'react';
import { 
  Settings, X, RefreshCcw, Lock, Sparkles, Map as MapIcon, Music, Save 
} from 'lucide-react';
import { doc, setDoc } from "firebase/firestore";

// 注意這裡的路徑是 ../config 和 ../utils
import { db } from '../config/firebase';
import { APP_VERSION } from '../utils/constants';
import { sendLog, getYouTubeID } from '../utils/helpers';

const SystemSettingsModal = ({ isOpen, onClose, theme, currentSettings, isDarkMode, currentUser }) => {
  const [localSettings, setLocalSettings] = useState({
    appVersion: APP_VERSION,
    mapShowMins: 60,
    mapBlinkMins: 10,
    mapLineGapSecs: 120, 
    youtubeVideoId: "",
    geminiApiKey: "" 
  });

  useEffect(() => {
    if (currentSettings) {
      setLocalSettings(currentSettings);
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
      sendLog(currentUser, "修改系統設定", `版本:${cleanSettings.appVersion}, 音樂:${cleanSettings.youtubeVideoId}`);
      alert("設定已儲存！");
      onClose();
    } catch (e) {
      console.error(e);
      alert("儲存失敗");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className={`w-full max-w-lg p-6 rounded-xl shadow-2xl ${theme.card} max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center mb-6 border-b pb-2 border-gray-600">
          <h3 className={`text-xl font-bold flex items-center gap-2 ${theme.text}`}>
            <Settings size={24} /> 系統全域設定
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-red-500 hover:text-white transition-colors"><X size={24}/></button>
        </div>

        <div className="space-y-6">
          <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
            <h4 className="font-bold text-blue-500 mb-2 flex items-center gap-2">
              <RefreshCcw size={16}/> 版本號控管
              {currentUser !== 'Wolf' && <span className="text-xs text-red-400 bg-red-900/20 px-2 py-0.5 rounded ml-2 flex items-center gap-1"><Lock size={10}/> 權限不足</span>}
            </h4>
            <p className={`text-xs mb-3 opacity-70 ${theme.text}`}>* 修改此號碼與使用者當前版本不同時，會跳出更新提示。</p>
            <div className="flex items-center gap-3">
              <label className={`text-sm w-24 font-bold ${theme.text}`}>雲端版本</label>
              <input 
                type="text" 
                className={`flex-1 p-2 rounded border ${theme.input} ${currentUser !== 'Wolf' ? 'opacity-50 cursor-not-allowed' : ''}`}
                value={localSettings.appVersion || ''}
                onChange={(e) => setLocalSettings({...localSettings, appVersion: e.target.value})}
                disabled={currentUser !== 'Wolf'}
                title={currentUser !== 'Wolf' ? "只有 Wolf 可以修改此欄位" : ""}
              />
            </div>
            <div className="text-xs text-right mt-1 opacity-50">您的本機版本: {APP_VERSION}</div>
          </div>

          <div className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-500/30">
             <h4 className="font-bold text-yellow-500 mb-2 flex items-center gap-2"><Sparkles size={16}/> AI 設定 (Gemini)</h4>
             <p className={`text-xs mb-3 opacity-70 ${theme.text}`}>* 填入 Google Gemini API Key 以啟用智慧問答功能。</p>
             <div className="flex flex-col gap-2">
               <input 
                 type="password" 
                 placeholder="API Key (例如: AIzaSy...)"
                 className={`w-full p-2 rounded border ${theme.input}`}
                 value={localSettings.geminiApiKey || ''}
                 onChange={(e) => setLocalSettings({...localSettings, geminiApiKey: e.target.value})}
               />
             </div>
          </div>

          <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
            <h4 className="font-bold text-purple-500 mb-4 flex items-center gap-2"><MapIcon size={16}/> Boss 地圖參數</h4>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className={`text-sm w-32 ${theme.text}`}>顯示範圍 (分)</label>
                <input 
                  type="number" 
                  className={`w-24 p-2 rounded border ${theme.input}`}
                  value={localSettings.mapShowMins || 60}
                  onChange={(e) => setLocalSettings({...localSettings, mapShowMins: Number(e.target.value)})}
                />
                <span className="text-xs opacity-50">重生前 N 分鐘顯示</span>
              </div>

              <div className="flex items-center gap-3">
                <label className={`text-sm w-32 ${theme.text}`}>閃爍提示 (分)</label>
                <input 
                  type="number" 
                  className={`w-24 p-2 rounded border ${theme.input}`}
                  value={localSettings.mapBlinkMins || 10}
                  onChange={(e) => setLocalSettings({...localSettings, mapBlinkMins: Number(e.target.value)})}
                />
                <span className="text-xs opacity-50">重生前 N 分鐘開始閃爍</span>
              </div>

              <div className="flex items-center gap-3">
                <label className={`text-sm w-32 ${theme.text}`}>連線群組 (秒)</label>
                <input 
                  type="number" 
                  className={`w-24 p-2 rounded border ${theme.input}`}
                  value={localSettings.mapLineGapSecs || 120} 
                  onChange={(e) => setLocalSettings({...localSettings, mapLineGapSecs: Number(e.target.value)})}
                />
                <span className="text-xs opacity-50">間隔 N 秒內視為同一組</span>
              </div>
            </div>
          </div>

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
               <span className="text-xs opacity-50">* 更新後，所有在線成員的播放器會同步載入此影片。</span>
             </div>
          </div>

        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">取消</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold flex items-center gap-2">
            <Save size={18}/> 儲存設定
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemSettingsModal;