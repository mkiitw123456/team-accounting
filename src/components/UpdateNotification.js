// src/components/UpdateNotification.js
import React from 'react';
import { RefreshCcw } from 'lucide-react';
import { APP_VERSION } from '../utils/constants';

const UpdateNotification = ({ show, remoteVersion, onRefresh }) => {
  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-[bounceIn_0.5s_ease-out]">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 rounded-2xl shadow-2xl border-2 border-white/20 max-w-sm">
        <div className="flex items-start gap-4">
          <div className="bg-white/20 p-2 rounded-full animate-pulse">
             <RefreshCcw size={24} className="text-white"/>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-1">🚀 發現新版本！</h3>
            <p className="text-sm opacity-90 mb-3 leading-relaxed">
              為了確保功能正常與資料同步，請立即更新網頁。
              <br/>
              <span className="text-xs opacity-70 font-mono mt-1 block">
                Local: {APP_VERSION} <br/> New: {remoteVersion}
              </span>
            </p>
            <button 
              onClick={onRefresh} 
              className="w-full bg-white text-blue-700 font-bold py-2 rounded-lg hover:bg-blue-50 transition-colors shadow-md active:scale-95"
            >
              立即重新整理
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;