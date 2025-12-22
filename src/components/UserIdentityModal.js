// src/components/UserIdentityModal.js
import React from 'react';
import { User, Eye, Shield } from 'lucide-react';
import { MEMBERS } from '../utils/constants';

const UserIdentityModal = ({ isOpen, onSelectUser, theme }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 border ${theme.card} animate-in zoom-in duration-200`}>
        
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 text-white mb-4 shadow-lg ring-4 ring-blue-500/30">
            <Shield size={32} />
          </div>
          <h2 className={`text-2xl font-bold ${theme.text}`}>請選擇您的身分</h2>
          <p className={`text-sm mt-1 opacity-60 ${theme.text}`}>
            系統將根據身分記錄操作歷程
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
          {MEMBERS.map(member => (
            <button
              key={member}
              onClick={() => onSelectUser(member)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98]
                ${theme.input} hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 group`}
            >
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <User size={16} />
              </div>
              <span className="font-bold">{member}</span>
            </button>
          ))}
        </div>

        {/* 分隔線 */}
        <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-500/30"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className={`px-2 opacity-50 ${theme.card.split(' ')[0]}`}>OR</span></div>
        </div>

        {/* 訪客按鈕 */}
        <button
          onClick={() => onSelectUser('訪客')}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-400 text-gray-500 hover:text-gray-700 hover:border-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-all"
        >
          <Eye size={18} />
          <span>我是訪客 (僅瀏覽權限)</span>
        </button>

      </div>
    </div>
  );
};

export default UserIdentityModal;