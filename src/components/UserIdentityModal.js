// src/components/UserIdentityModal.js
import React, { useState } from 'react';
import { User, Lock } from 'lucide-react';

import { MEMBERS, MEMBER_PASSWORDS } from '../utils/constants';
import { sendLog } from '../utils/helpers';

const UserIdentityModal = ({ isOpen, onSelectUser, theme }) => {
  const [step, setStep] = useState('SELECT');
  const [tempUser, setTempUser] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleMemberClick = (member) => {
    const savedPassword = MEMBER_PASSWORDS[member];
    if (!savedPassword) {
      alert("尚未提供密碼，請私訊 Wolf 獲取一組四位數密碼。");
      return;
    }
    setTempUser(member);
    setStep('PASSWORD');
    setError('');
    setPassword('');
  };

  const handlePasswordSubmit = () => {
    const correctPassword = MEMBER_PASSWORDS[tempUser];
    if (password === correctPassword) {
      onSelectUser(tempUser);
      sendLog(tempUser, "綁定設備", "登入成功 (新設備綁定)");
    } else {
      setError('密碼錯誤');
      sendLog(tempUser, "登入失敗", "密碼錯誤嘗試");
    }
  };

  const handleBack = () => {
    setStep('SELECT');
    setTempUser(null);
    setPassword('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl ${theme.card} text-center`}>
        {step === 'SELECT' ? (
          <>
            <User size={64} className="mx-auto mb-4 text-blue-500" />
            <h2 className={`text-2xl font-bold mb-2 ${theme.text}`}>歡迎！請問您是哪位成員？</h2>
            <p className={`text-sm mb-6 ${theme.subText}`}>請選擇您的身份以綁定此設備。</p>
            <div className="grid grid-cols-3 gap-3">
              {MEMBERS.map(member => (
                <button
                  key={member}
                  onClick={() => handleMemberClick(member)}
                  className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-transform hover:scale-105 active:scale-95"
                >
                  {member}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <Lock size={64} className="mx-auto mb-4 text-yellow-500" />
            <h2 className={`text-2xl font-bold mb-2 ${theme.text}`}>請輸入密碼</h2>
            <p className={`text-sm mb-4 ${theme.subText}`}>正在驗證身份：<span className="font-bold text-blue-500">{tempUser}</span></p>
            <div className="flex flex-col gap-4">
              <input 
                type="password" 
                maxLength="4"
                placeholder="4位數密碼"
                className={`w-full p-3 rounded-lg text-center text-xl tracking-widest border-2 outline-none ${error ? 'border-red-500' : 'border-gray-300'}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
              {error && <p className="text-red-500 text-sm font-bold animate-pulse">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleBack} className="flex-1 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">返回</button>
                <button onClick={handlePasswordSubmit} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">確認</button>
              </div>
            </div>
          </>
        )}
        <div className={`mt-6 text-xs ${theme.subText}`}>
          * 綁定後，下次開啟網頁無需再次登入。
        </div>
      </div>
    </div>
  );
};

export default UserIdentityModal;