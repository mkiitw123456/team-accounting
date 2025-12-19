// src/components/ThemeEditor.js
import React, { useState, useEffect } from 'react';
import { Palette, X, Save, RotateCcw } from 'lucide-react';

const ThemeEditor = ({ isOpen, onClose, currentTheme, onSave }) => {
  // 預設主題
  const defaultTheme = {
    bgType: 'solid',
    bgColor1: '#0f172a',
    bgColor2: '#1e293b',
    bgDirection: 135,
    bgPosition: 50,

    primaryType: 'solid',
    primaryColor1: '#2563eb',
    primaryColor2: '#4f46e5',
    primaryDirection: 90,

    textColor: '#ffffff',
    cardBgColor: '#1f2937', // 全站容器背景 (例如 Modal)
    
    // === 新增：卡片與列表項目專用 ===
    cardItemBg: '#374151', // 列表項目背景 (gray-700)
    cardItemText: '#ffffff' // 列表項目文字
  };

  const [theme, setTheme] = useState(currentTheme || defaultTheme);

  useEffect(() => {
    if (currentTheme) setTheme(currentTheme);
  }, [currentTheme]);

  if (!isOpen) return null;

  const handleChange = (key, val) => {
    setTheme(prev => ({ ...prev, [key]: val }));
  };

  const resetTheme = () => {
    setTheme(defaultTheme);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-end pointer-events-none">
      <div className="h-full w-80 bg-white dark:bg-gray-900 shadow-2xl pointer-events-auto overflow-y-auto border-l border-gray-200 dark:border-gray-700 flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
          <h3 className="font-bold flex items-center gap-2 dark:text-white">
            <Palette size={18} className="text-purple-500"/> 外觀主題設定
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-400">
            <X size={20}/>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 flex-1">
          
          {/* 1. 背景設定 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">全站背景 (Background)</h4>
            
            <div className="flex gap-2 text-sm bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <button onClick={()=>handleChange('bgType', 'solid')} className={`flex-1 py-1 rounded ${theme.bgType==='solid' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500'}`}>單色</button>
              <button onClick={()=>handleChange('bgType', 'gradient')} className={`flex-1 py-1 rounded ${theme.bgType==='gradient' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500'}`}>漸層</button>
            </div>

            <div className="flex items-center gap-2">
              <input type="color" value={theme.bgColor1} onChange={e=>handleChange('bgColor1', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0"/>
              <span className="text-xs text-gray-500">主色</span>
            </div>

            {theme.bgType === 'gradient' && (
              <div className="space-y-2 pl-2 border-l-2 border-purple-500/30">
                <div className="flex items-center gap-2">
                  <input type="color" value={theme.bgColor2} onChange={e=>handleChange('bgColor2', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0"/>
                  <span className="text-xs text-gray-500">漸層色</span>
                </div>
                <div>
                  <label className="text-xs text-gray-500 flex justify-between">方向: {theme.bgDirection}°</label>
                  <input type="range" min="0" max="360" value={theme.bgDirection} onChange={e=>handleChange('bgDirection', e.target.value)} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 flex justify-between">漸層量: {theme.bgPosition}%</label>
                  <input type="range" min="0" max="100" value={theme.bgPosition} onChange={e=>handleChange('bgPosition', e.target.value)} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                </div>
              </div>
            )}
          </div>

          <hr className="dark:border-gray-700"/>

          {/* 2. 按鈕主色 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">按鈕與強調色 (Buttons)</h4>
            
            <div className="flex gap-2 text-sm bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <button onClick={()=>handleChange('primaryType', 'solid')} className={`flex-1 py-1 rounded ${theme.primaryType==='solid' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500'}`}>單色</button>
              <button onClick={()=>handleChange('primaryType', 'gradient')} className={`flex-1 py-1 rounded ${theme.primaryType==='gradient' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500'}`}>漸層</button>
            </div>

            <div className="flex items-center gap-2">
              <input type="color" value={theme.primaryColor1} onChange={e=>handleChange('primaryColor1', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0"/>
              <span className="text-xs text-gray-500">主色</span>
            </div>

            {theme.primaryType === 'gradient' && (
              <div className="space-y-2 pl-2 border-l-2 border-blue-500/30">
                <div className="flex items-center gap-2">
                  <input type="color" value={theme.primaryColor2} onChange={e=>handleChange('primaryColor2', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0"/>
                  <span className="text-xs text-gray-500">漸層色</span>
                </div>
                <div>
                  <label className="text-xs text-gray-500 flex justify-between">方向: {theme.primaryDirection}°</label>
                  <input type="range" min="0" max="360" value={theme.primaryDirection} onChange={e=>handleChange('primaryDirection', e.target.value)} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                </div>
              </div>
            )}
          </div>

          <hr className="dark:border-gray-700"/>

          {/* 3. 卡片與列表 (新增區塊) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">卡片與列表 (Cards)</h4>
            <div className="flex items-center justify-between">
              <span className="text-sm dark:text-gray-300">項目背景色</span>
              <input type="color" value={theme.cardItemBg || '#374151'} onChange={e=>handleChange('cardItemBg', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0"/>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm dark:text-gray-300">項目文字色</span>
              <input type="color" value={theme.cardItemText || '#ffffff'} onChange={e=>handleChange('cardItemText', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0"/>
            </div>
          </div>

          <hr className="dark:border-gray-700"/>

          {/* 4. 其他文字 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">其他 (Global)</h4>
            <div className="flex items-center justify-between">
              <span className="text-sm dark:text-gray-300">全站文字顏色</span>
              <input type="color" value={theme.textColor} onChange={e=>handleChange('textColor', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0"/>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm dark:text-gray-300">主要容器背景</span>
              <input type="color" value={theme.cardBgColor} onChange={e=>handleChange('cardBgColor', e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0"/>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between gap-2">
           <button onClick={resetTheme} className="px-3 py-2 text-sm text-gray-500 hover:text-red-500 flex items-center gap-1">
             <RotateCcw size={14}/> 重置
           </button>
           <button onClick={() => onSave(theme)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold flex items-center justify-center gap-2">
             <Save size={16}/> 儲存並套用
           </button>
        </div>

      </div>
    </div>
  );
};

export default ThemeEditor;