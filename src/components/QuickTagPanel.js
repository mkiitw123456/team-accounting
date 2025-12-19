// src/components/QuickTagPanel.js
import React from 'react';
import { Zap, X, Plus } from 'lucide-react';
import { MAP_IMAGE_PATH } from '../utils/helpers';

const QuickTagPanel = ({ 
  isOpen, onClose, bossTemplates, handleAddQuickRecord, isDarkMode, theme 
}) => {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm`}>
      <div className={`w-full max-w-5xl h-[85vh] rounded-xl flex flex-col relative shadow-2xl border-2 ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-white'}`}>
        
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h3 className={`text-xl font-bold flex items-center gap-2 ${theme.text}`}>
            <Zap size={24} className="text-yellow-500"/> 快速標籤 (點擊即紀錄)
          </h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-red-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Left: Map */}
          <div className={`flex-1 relative overflow-hidden flex items-center justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
             <div className="relative w-auto h-auto max-w-full max-h-full" style={{ aspectRatio: '1152/851' }}>
                <img src={MAP_IMAGE_PATH} alt="Map" className="w-full h-full block pointer-events-none opacity-80" />
                
                {bossTemplates.filter(t => t.mapPos).map((template, idx) => (
                  <div 
                    key={template.id}
                    onClick={() => handleAddQuickRecord(template)}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group hover:scale-110 transition-transform z-10"
                    style={{ left: `${template.mapPos.x}%`, top: `${template.mapPos.y}%` }}
                    title={`點擊紀錄: ${template.name}`}
                  >
                    <div className="relative">
                      <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: template.color }}></div>
                      {/* Name Label */}
                      <div className={`absolute top-5 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-bold shadow-md
                        ${isDarkMode ? 'bg-black/80 text-white' : 'bg-white/90 text-gray-800'}`}>
                        {template.name}
                      </div>
                    </div>
                  </div>
                ))}
             </div>
             <div className="absolute bottom-4 left-4 text-xs opacity-50 bg-black/30 px-2 py-1 rounded text-white pointer-events-none">
               * 點擊地圖上的點或右側列表皆可快速紀錄
             </div>
          </div>

          {/* Right: List */}
          <div className={`w-full lg:w-72 border-l overflow-y-auto ${isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
            <div className="p-3">
              <h4 className={`text-sm font-bold mb-3 opacity-70 ${theme.text}`}>Boss 列表</h4>
              <div className="space-y-2">
                {bossTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleAddQuickRecord(template)}
                    className={`w-full text-left p-2 rounded flex items-center gap-2 transition-all active:scale-95
                      ${isDarkMode ? 'hover:bg-gray-800 border border-gray-700' : 'hover:bg-gray-50 border border-gray-100 shadow-sm'}`}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: template.color }}></div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm truncate ${theme.text}`}>{template.name}</div>
                      <div className={`text-xs opacity-60 ${theme.text}`}>CD: {template.respawnMinutes}m</div>
                    </div>
                    <Plus size={16} className="opacity-40"/>
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default QuickTagPanel;