// src/components/CostCalculatorModal.js
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calculator, ArrowRight, DollarSign, RefreshCw } from 'lucide-react';
import { EXCHANGE_TYPES } from '../utils/constants';

const CostCalculatorModal = ({ isOpen, onClose, theme, isDarkMode }) => {
  // 初始列表：預設給一列空的
  const [items, setItems] = useState([
    { id: Date.now(), name: '', qty: 1, price: 0 }
  ]);
  
  // 設定參數
  const [profitMargin, setProfitMargin] = useState(10); // 預設 10% 利潤
  const [exchangeType, setExchangeType] = useState('GENERAL'); // 預設一般交易所

  // 計算結果
  const [totalCost, setTotalCost] = useState(0);
  const [targetNetIncome, setTargetNetIncome] = useState(0);
  const [suggestedPrice, setSuggestedPrice] = useState(0);

  // 當輸入改變時，重新計算
  useEffect(() => {
    // 1. 計算總成本
    const cost = items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.price)), 0);
    setTotalCost(cost);

    // 2. 計算目標淨收入 (總成本 * (1 + 利潤%))
    // 例如成本 100，利潤 10% -> 目標拿回 110
    const net = Math.ceil(cost * (1 + (profitMargin / 100)));
    setTargetNetIncome(net);

    // 3. 反推建議售價
    // 公式：售價 - 稅金 - 刊登費 = 淨收入
    // 售價 * (1 - 稅率 - 0.02) = 淨收入
    // 售價 = 淨收入 / (1 - 稅率 - 0.02)
    const taxRate = EXCHANGE_TYPES[exchangeType]?.tax || 0;
    const listingFeeRate = 0.02; // 固定 2%
    const divisor = 1 - taxRate - listingFeeRate;

    if (divisor > 0 && cost > 0) {
      setSuggestedPrice(Math.ceil(net / divisor));
    } else {
      setSuggestedPrice(0);
    }

  }, [items, profitMargin, exchangeType]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), name: '', qty: 1, price: 0 }]);
  };

  const handleRemoveItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleReset = () => {
    if(window.confirm('確定要清空所有項目嗎？')) {
      setItems([{ id: Date.now(), name: '', qty: 1, price: 0 }]);
      setProfitMargin(10);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-4xl h-[85vh] rounded-xl shadow-2xl flex flex-col ${theme.card} border border-gray-500/30`}>
        
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <h3 className={`text-xl font-bold flex items-center gap-2 ${theme.text}`}>
            <Calculator size={24} className="text-orange-500"/> 成本試算與定價工具
          </h3>
          <div className="flex gap-2">
            <button onClick={handleReset} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500" title="重置">
                <RefreshCw size={20}/>
            </button>
            <button onClick={onClose} className="p-2 rounded hover:bg-red-500 hover:text-white transition-colors">
                <X size={24}/>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            
            {/* Left: Material List */}
            <div className="flex-1 p-6 overflow-y-auto border-r border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h4 className={`font-bold opacity-70 ${theme.text}`}>原料清單 (成本)</h4>
                    <button onClick={handleAddItem} className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
                        <Plus size={14}/> 新增項目
                    </button>
                </div>

                <div className="space-y-3">
                    {items.map((item, index) => (
                        <div key={item.id} className={`flex items-center gap-2 p-2 rounded ${isDarkMode ? 'bg-black/20' : 'bg-gray-50'}`}>
                            <span className="text-xs opacity-50 w-6 text-center">{index + 1}.</span>
                            <input 
                                type="text" 
                                placeholder="物品名稱"
                                className={`flex-1 p-2 rounded border text-sm ${theme.input}`}
                                value={item.name}
                                onChange={e => updateItem(item.id, 'name', e.target.value)}
                            />
                            <div className="flex items-center gap-1">
                                <span className="text-xs opacity-50">數量</span>
                                <input 
                                    type="number" 
                                    min="1"
                                    className={`w-20 p-2 rounded border text-sm text-center ${theme.input}`}
                                    value={item.qty}
                                    onChange={e => updateItem(item.id, 'qty', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs opacity-50">單價</span>
                                <input 
                                    type="number" 
                                    min="0"
                                    className={`w-24 p-2 rounded border text-sm text-right ${theme.input}`}
                                    value={item.price}
                                    onChange={e => updateItem(item.id, 'price', e.target.value)}
                                />
                            </div>
                            <div className={`w-24 text-right font-mono font-bold text-sm ${theme.subText}`}>
                                ${(item.qty * item.price).toLocaleString()}
                            </div>
                            <button onClick={() => handleRemoveItem(item.id)} className="p-2 text-gray-400 hover:text-red-500">
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    ))}
                </div>

                <div className={`mt-6 p-4 rounded-lg flex justify-between items-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <span className="font-bold opacity-70">總成本 (Total Cost)</span>
                    <span className="text-2xl font-mono font-bold text-blue-500">${totalCost.toLocaleString()}</span>
                </div>
            </div>

            {/* Right: Calculator Settings & Result */}
            <div className={`w-full lg:w-96 p-6 flex flex-col gap-6 ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50/50'}`}>
                
                {/* Settings */}
                <div className="space-y-4">
                    <h4 className={`font-bold opacity-70 border-b pb-2 ${theme.text}`}>定價參數設定</h4>
                    
                    <div>
                        <label className={`block text-xs mb-1.5 font-bold ${theme.subText}`}>交易稅率 (Exchange Type)</label>
                        <div className="flex gap-2">
                            {Object.keys(EXCHANGE_TYPES).map(typeKey => (
                                <button
                                    key={typeKey}
                                    onClick={() => setExchangeType(typeKey)}
                                    className={`flex-1 py-2 rounded text-sm border transition-all
                                        ${exchangeType === typeKey 
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                            : 'bg-transparent border-gray-300 opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    {EXCHANGE_TYPES[typeKey].label} ({(EXCHANGE_TYPES[typeKey].tax * 100).toFixed(0)}%)
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className={`block text-xs mb-1.5 font-bold ${theme.subText}`}>
                             預期利潤率 (Profit Margin)
                        </label>
                        <div className="relative">
                            <input 
                                type="number" 
                                className={`w-full p-3 rounded-lg border text-lg font-bold text-center ${theme.input} ${profitMargin < 0 ? 'text-red-500' : 'text-green-500'}`}
                                value={profitMargin}
                                onChange={e => setProfitMargin(parseFloat(e.target.value) || 0)}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-50 font-bold">%</span>
                        </div>
                        <p className="text-[10px] mt-1 text-center opacity-50">
                            * 設定 10% 代表您希望淨賺成本的 1.1 倍
                        </p>
                    </div>
                </div>

                {/* Calculation Flow */}
                <div className={`flex-1 flex flex-col justify-center space-y-2 py-4`}>
                    <div className="flex justify-between items-center text-sm opacity-60">
                        <span>原始總成本</span>
                        <span className="font-mono">${totalCost.toLocaleString()}</span>
                    </div>
                    
                    <div className="flex justify-center text-gray-400"><Plus size={16}/></div>

                    <div className="flex justify-between items-center text-sm font-bold text-green-500">
                        <span>預期淨利 ({profitMargin}%)</span>
                        <span className="font-mono">+${(targetNetIncome - totalCost).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-center text-gray-400"><ArrowRight size={16}/></div>
                    
                    <div className={`p-3 rounded border flex justify-between items-center ${isDarkMode ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
                        <span className="font-bold text-green-600">目標淨收入 (入袋)</span>
                        <span className="font-mono font-bold text-xl text-green-600">${targetNetIncome.toLocaleString()}</span>
                    </div>
                </div>

                {/* Final Result */}
                <div className={`p-5 rounded-xl shadow-lg border-2 ${isDarkMode ? 'bg-gray-900 border-orange-500' : 'bg-white border-orange-500'}`}>
                    <h5 className="text-center text-sm font-bold opacity-70 mb-2 text-orange-500 uppercase tracking-widest">
                        建議刊登價格
                    </h5>
                    <div className="flex justify-center items-center gap-1 text-4xl font-black text-orange-500 mb-2">
                        <DollarSign size={28} strokeWidth={3}/>
                        {suggestedPrice.toLocaleString()}
                    </div>
                    
                    <div className="space-y-1 text-[10px] opacity-60 text-center border-t border-gray-500/20 pt-2 mt-2">
                        <div className="flex justify-between">
                            <span>- 交易稅 ({exchangeType === 'WORLD' ? '20%' : '10%'})</span>
                            <span>${Math.floor(suggestedPrice * EXCHANGE_TYPES[exchangeType]?.tax).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>- 刊登費 (2%)</span>
                            <span>${Math.floor(suggestedPrice * 0.02).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold text-green-500 pt-1">
                            <span>= 實際入袋</span>
                            <span>${(suggestedPrice - Math.floor(suggestedPrice * EXCHANGE_TYPES[exchangeType]?.tax) - Math.floor(suggestedPrice * 0.02)).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default CostCalculatorModal;