// src/components/BalanceGrid.js
import React, { useState, useEffect, useMemo } from 'react';
import { Grid, Wand2, X, TrendingUp, AlertCircle, Check, DollarSign } from 'lucide-react';
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";

import { db } from '../config/firebase';
import { MEMBERS } from '../utils/constants';
import { sendNotify, sendLog, calculateFinance } from '../utils/helpers'; // 引入計算公式

const BalanceGrid = ({ isOpen, onClose, theme, isDarkMode, currentUser, activeItems = [] }) => {
  const [gridData, setGridData] = useState({});
  const [loading, setLoading] = useState(true);

  // 成員篩選狀態 (預設全選)
  const [selectedForSelling, setSelectedForSelling] = useState(MEMBERS);

  useEffect(() => {
    if (!isOpen || !db) return;
    const unsub = onSnapshot(doc(db, "settlement_data", "main_grid"), (doc) => {
      if (doc.exists()) {
        setGridData(doc.data().matrix || {});
      } else {
        setGridData({});
      }
      setLoading(false);
    });
    return () => unsub();
  }, [isOpen]);

  const toggleMemberSelection = (member) => {
    if (selectedForSelling.includes(member)) {
      setSelectedForSelling(prev => prev.filter(m => m !== member));
    } else {
      setSelectedForSelling(prev => [...prev, member]);
    }
  };

  // === 邏輯修正：將進行中項目的「未來分紅」納入計算 ===
  const sellerSuggestions = useMemo(() => {
    if (!gridData) return [];

    // 1. 先計算「進行中項目」對未來的影響
    // 我們要模擬：如果這些東西都賣掉了，大家的債務會怎麼變？
    const futureAdjustments = {}; 
    // 初始化
    MEMBERS.forEach(m => futureAdjustments[m] = { payable: 0, receivable: 0 });

    activeItems.forEach(item => {
        const seller = item.seller;
        // 計算這一單每人分多少 (引用 helpers 的標準公式)
        const { perPersonSplit } = calculateFinance(
            item.price, 
            item.exchangeType, 
            item.participants?.length || 0, 
            item.cost, 
            item.listingHistory
        );

        if (perPersonSplit > 0 && seller) {
            item.participants.forEach(p => {
                const pName = typeof p === 'string' ? p : p.name; // 相容舊資料
                
                if (pName !== seller) {
                    // 賣家(Ricky) 未來會欠 隊友(水野) 錢
                    if (futureAdjustments[seller]) futureAdjustments[seller].payable += perPersonSplit;
                    // 隊友(水野) 未來會被 賣家(Ricky) 欠錢
                    if (futureAdjustments[pName]) futureAdjustments[pName].receivable += perPersonSplit;
                }
            });
        }
    });

    // 2. 結合「現有表格」與「未來預測」計算分數
    const suggestions = selectedForSelling.map(member => {
      let currentPayable = 0;    // 表格上我欠別人的
      let currentReceivable = 0; // 表格上別人欠我的

      MEMBERS.forEach(other => {
        if (member !== other) {
          currentPayable += (gridData[`${member}_${other}`] || 0);
          currentReceivable += (gridData[`${other}_${member}`] || 0);
        }
      });

      // 總負債 (我欠人的) = 現有 + 未來(進行中項目結算後)
      const totalPayable = currentPayable + (futureAdjustments[member]?.payable || 0);
      
      // 總債權 (人欠我的) = 現有 + 未來(進行中項目結算後)
      const totalReceivable = currentReceivable + (futureAdjustments[member]?.receivable || 0);

      // === 核心公式 ===
      // 分數 = 總債權 - 總負債
      // 正分：別人欠我比較多 -> 我是債權人 -> 建議掛賣 (收現金來平衡)
      // 負分：我欠別人比較多 -> 我是債務人 -> 暫緩掛賣 (避免囤積更多公款)
      const score = totalReceivable - totalPayable;

      return {
        name: member,
        score: score,
        payable: totalPayable,
        receivable: totalReceivable
      };
    });

    // 分數由大到小排序 (越正越該賣)
    return suggestions.sort((a, b) => b.score - a.score);

  }, [gridData, activeItems, selectedForSelling]);

  const handleCellChange = async (payer, receiver, value) => {
    if (currentUser === '訪客') return; 

    const key = `${payer}_${receiver}`;
    const newValue = parseFloat(value) || 0;
    
    const canEdit = payer === currentUser || receiver === currentUser || currentUser === 'Wolf';
    if (!canEdit) return; 

    try {
        const docRef = doc(db, "settlement_data", "main_grid");
        const docSnap = await getDoc(docRef);
        let oldValue = 0;
        
        if (docSnap.exists()) {
            const serverMatrix = docSnap.data().matrix || {};
            oldValue = parseFloat(serverMatrix[key]) || 0;
        }

        if (oldValue !== newValue) {
            const msg = `📝 [帳務修改] ${payer} 對 ${receiver} 的欠款已由 $${oldValue.toLocaleString()} 修改為 $${newValue.toLocaleString()}`;
            sendNotify(msg);
            sendLog(currentUser, "修改餘額表", `${payer} -> ${receiver} : ${oldValue} -> ${newValue}`);
        }

        setGridData(prev => ({ ...prev, [key]: newValue }));

        await setDoc(docRef, {
            matrix: { ...gridData, [key]: newValue }
        }, { merge: true });

    } catch (e) {
        console.error("更新失敗", e);
        alert("更新失敗，請檢查網路或權限");
    }
  };

  const generateReport = (matrix) => {
    const lines = [];
    Object.keys(matrix).forEach(key => {
      const val = matrix[key];
      if (val > 0) {
        const [payer, receiver] = key.split('_');
        lines.push(`${payer.padEnd(4, '　')} ➔ ${receiver.padEnd(4, '　')} : $${val.toLocaleString()}`);
      }
    });
    return lines.length > 0 ? lines.join('\n') : "(無債務)";
  };

  const handleAutoBalance = async () => {
    if (currentUser === '訪客') return alert("訪客權限僅供瀏覽");
    if (!db) return;
    if (!window.confirm("確定要執行「自動劃帳」嗎？\n這將會重新計算並覆蓋目前的表格，將所有複雜的債務簡化為最少筆數。")) return;

    const beforeReport = generateReport(gridData);

    const netBalances = {};
    MEMBERS.forEach(m => netBalances[m] = 0);

    MEMBERS.forEach(payer => {
      MEMBERS.forEach(receiver => {
        if (payer === receiver) return;
        const amount = parseFloat(gridData[`${payer}_${receiver}`]) || 0;
        netBalances[payer] -= amount; 
        netBalances[receiver] += amount; 
      });
    });

    let debtors = []; 
    let creditors = []; 

    MEMBERS.forEach(m => {
      const balance = netBalances[m];
      if (balance < -1) { 
        debtors.push({ name: m, balance: Math.abs(balance) }); 
      } else if (balance > 1) {
        creditors.push({ name: m, balance: balance });
      }
    });

    debtors.sort((a, b) => b.balance - a.balance);
    creditors.sort((a, b) => b.balance - a.balance);

    const newMatrix = {};
    let dIndex = 0;
    let cIndex = 0;

    while (dIndex < debtors.length && cIndex < creditors.length) {
      let debtor = debtors[dIndex];
      let creditor = creditors[cIndex];

      let settleAmount = Math.min(debtor.balance, creditor.balance);
      
      const key = `${debtor.name}_${creditor.name}`;
      newMatrix[key] = (newMatrix[key] || 0) + settleAmount;

      debtor.balance -= settleAmount;
      creditor.balance -= settleAmount;

      if (debtor.balance < 1) dIndex++;
      if (creditor.balance < 1) cIndex++;
    }

    const afterReport = generateReport(newMatrix);

    try {
      await setDoc(doc(db, "settlement_data", "main_grid"), { matrix: newMatrix }, { merge: false });
      
      const discordMsg = `
⚖️ **[自動劃帳報告]** 由 ${currentUser} 執行

**📋 劃帳前 (原始債務):**
\`\`\`text
${beforeReport}
\`\`\`

**✨ 劃帳後 (簡化債務):**
\`\`\`text
${afterReport}
\`\`\`
`;
      sendNotify(discordMsg);
      sendLog(currentUser, "執行自動劃帳", "重置並簡化所有債務");
      alert("劃帳完成！詳細報表已發送至 Discord。");
    } catch (e) {
      console.error("Auto balance failed", e);
      alert("劃帳失敗，請稍後再試。");
    }
  };

  if (!isOpen) return null;

  const tableStyles = {
      headerCell: isDarkMode ? 'bg-gray-700 text-gray-200 border-gray-600' : 'bg-gray-100 text-gray-700 border-gray-300',
      headerCellSticky: isDarkMode ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-gray-50 text-gray-700 border-gray-300',
      totalHeader: isDarkMode ? 'bg-blue-900/50 text-blue-200 border-gray-600' : 'bg-blue-50 text-blue-800 border-gray-300',
      rowHeader: isDarkMode ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-gray-50 text-gray-800 border-gray-300',
      cell: isDarkMode ? 'border-gray-600' : 'border-gray-300',
      input: isDarkMode ? 'text-gray-100' : 'text-gray-800',
      selfCell: isDarkMode ? 'bg-black/50' : 'bg-black/80',
      rowTotal: isDarkMode ? 'bg-blue-900/30 text-blue-400 border-gray-600' : 'bg-blue-50/30 text-blue-600 border-gray-300',
      incomeHeader: isDarkMode ? 'bg-green-900/50 text-green-200 border-gray-600' : 'bg-green-100 text-green-800 border-gray-300',
      incomeLabel: isDarkMode ? 'bg-green-900/30 text-green-200 border-gray-600' : 'bg-green-50/50 text-green-800 border-gray-300',
      incomeCell: isDarkMode ? 'text-green-400 border-gray-600' : 'text-green-600 border-gray-300',
      emptyCorner: isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-200 border-gray-300'
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-hidden">
      <div className={`w-full max-w-6xl rounded-xl p-6 h-[90vh] flex flex-col ${theme.card}`}>
        
        {/* Header */}
        <div className={`flex justify-between items-center mb-4 border-b pb-2 flex-none ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-4">
            <h3 className={`text-xl font-bold flex items-center gap-2 ${theme.text}`}>
              <Grid size={24}/> 成員餘額表 (Excel 模式)
            </h3>
            <button 
              onClick={handleAutoBalance}
              className={`flex items-center gap-2 px-3 py-1 text-sm bg-purple-600 text-white rounded shadow transition-colors ${currentUser === '訪客' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'}`}
              title="重新計算並簡化所有債務"
            >
              <Wand2 size={16}/> 自動劃帳
            </button>
          </div>
          <button onClick={onClose} className={`p-1 rounded ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}><X size={24}/></button>
        </div>

        {/* Content Wrapper: 使用 flex-1 讓表格自動佔據剩餘空間 */}
        <div className="flex-1 flex flex-col overflow-hidden gap-4">
           {loading ? <div className={`p-10 text-center ${theme.subText}`}>載入中...</div> : (
             <>
                {/* 1. 餘額表格 (佔據主要空間，自適應高度) */}
                <div className="flex-1 overflow-auto border rounded relative">
                    <table className="w-full border-collapse min-w-[1000px]">
                    <thead>
                        <tr>
                        <th className={`p-2 border min-w-[100px] sticky top-0 left-0 z-20 font-bold ${tableStyles.headerCell}`}>付款\收款</th>
                        {MEMBERS.map(m => (
                            <th key={m} className={`p-2 border min-w-[100px] sticky top-0 z-10 font-bold ${tableStyles.headerCellSticky}`}>{m}</th>
                        ))}
                        <th className={`p-2 border min-w-[100px] sticky top-0 z-10 font-bold ${tableStyles.totalHeader}`}>總計支出</th>
                        </tr>
                    </thead>
                    <tbody>
                        {MEMBERS.map(payer => {
                        let rowTotal = 0;
                        return (
                            <tr key={payer} className={theme.card}>
                            <th className={`p-2 border sticky left-0 z-10 font-bold ${tableStyles.rowHeader}`}>{payer}</th>
                            {MEMBERS.map(receiver => {
                                const isSelf = payer === receiver;
                                const key = `${payer}_${receiver}`;
                                const val = gridData[key] || 0;
                                if (!isSelf) rowTotal += val;
                                
                                const isRelated = payer === currentUser || receiver === currentUser;
                                const canEdit = isRelated || currentUser === 'Wolf';

                                return (
                                <td key={receiver} className={`p-1 border text-center ${tableStyles.cell} ${isSelf ? tableStyles.selfCell : ''}`}>
                                    {!isSelf && (
                                    <input 
                                        type="number" 
                                        className={`w-full h-full p-1 text-center bg-transparent outline-none font-mono ${tableStyles.input} ${val > 0 ? 'text-red-500 font-bold' : 'opacity-60'} ${!canEdit || currentUser === '訪客' ? 'cursor-not-allowed opacity-30' : ''}`}
                                        value={val === 0 ? '' : val}
                                        placeholder="0"
                                        readOnly={!canEdit || currentUser === '訪客'}
                                        onClick={() => {
                                            if(currentUser === '訪客') return; 
                                            if (!canEdit) {
                                            sendLog(currentUser, "權限不足", `嘗試修改餘額表：${payer} -> ${receiver}`);
                                            alert("權限不足：您只能修改與自己有關的帳務（您是付款人或收款人）");
                                            }
                                        }}
                                        onChange={(e) => {
                                            if (!canEdit || currentUser === '訪客') return;
                                            const v = e.target.value;
                                            setGridData(prev => ({...prev, [key]: v})); 
                                        }}
                                        onBlur={(e) => handleCellChange(payer, receiver, e.target.value)}
                                    />
                                    )}
                                </td>
                                );
                            })}
                            <td className={`p-2 border text-center font-bold ${tableStyles.rowTotal}`}>
                                {rowTotal.toLocaleString()}
                            </td>
                            </tr>
                        );
                        })}
                        <tr className={tableStyles.incomeLabel}>
                            <td className={`p-2 border text-right sticky left-0 z-10 ${tableStyles.incomeHeader}`}>預定收入</td>
                            {MEMBERS.map(receiver => {
                            let colTotal = 0;
                            MEMBERS.forEach(payer => {
                                if (payer !== receiver) {
                                colTotal += parseFloat(gridData[`${payer}_${receiver}`] || 0);
                                }
                            });
                            return <td key={receiver} className={`p-2 border text-center ${tableStyles.incomeCell}`}>{colTotal.toLocaleString()}</td>;
                            })}
                            <td className={`p-2 border ${tableStyles.emptyCorner}`}></td>
                        </tr>
                    </tbody>
                    </table>
                </div>

                {/* 2. 建議掛賣名單區塊 (橫向捲動) */}
                <div className={`p-3 rounded-xl border flex flex-col gap-2 flex-none ${isDarkMode ? 'bg-orange-900/10 border-orange-500/30' : 'bg-orange-50 border-orange-200'}`}>
                    
                    <div className="flex justify-between items-center">
                        <h4 className={`font-bold text-sm flex items-center gap-2 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                            <TrendingUp size={16}/> 建議掛賣順序 (已包含進行中項目試算)
                        </h4>
                        
                        <div className="flex overflow-x-auto gap-1 max-w-[50%] no-scrollbar">
                            {MEMBERS.map(member => (
                                <button
                                    key={member}
                                    onClick={() => toggleMemberSelection(member)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] border whitespace-nowrap transition-all flex items-center gap-1
                                      ${selectedForSelling.includes(member) 
                                        ? 'bg-orange-500 text-white border-orange-500' 
                                        : 'bg-transparent opacity-40 border-gray-500'}`}
                                >
                                    {member}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {sellerSuggestions.length > 0 ? (
                        <div className="flex overflow-x-auto gap-3 pb-1">
                            {sellerSuggestions.map((item, index) => {
                                // 正分 = 債權人 (別人欠我錢) -> 應該賣
                                const shouldSell = item.score > 0;
                                
                                return (
                                    <div key={item.name} className={`flex-none flex items-center gap-2 p-2 rounded-lg border shadow-sm min-w-[140px] relative overflow-hidden transition-all ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} ${index === 0 ? 'ring-2 ring-orange-500/50' : ''}`}>
                                        <div className={`absolute top-0 left-0 px-1.5 text-[9px] font-bold text-white rounded-br ${index === 0 ? 'bg-red-500' : index === 1 ? 'bg-orange-500' : 'bg-gray-500'}`}>
                                            #{index + 1}
                                        </div>
                                        
                                        <div className="flex flex-col ml-1 mt-1">
                                            <span className={`font-bold text-sm leading-none ${theme.text}`}>{item.name}</span>
                                            <span className={`text-[9px] ${shouldSell ? 'text-orange-500 font-bold' : 'opacity-50'}`}>
                                                {shouldSell ? '建議掛賣' : '暫緩掛賣'}
                                            </span>
                                        </div>

                                        <div className="flex flex-col items-end flex-1">
                                            <span className={`font-mono font-bold text-sm ${shouldSell ? 'text-orange-500' : 'text-gray-500'}`}>
                                                {shouldSell ? '+' : ''}{Math.round(item.score/10000)}萬
                                            </span>
                                            <div className="text-[8px] opacity-40 flex flex-col items-end leading-tight">
                                                <span>預計債權: {Math.round(item.receivable/10000)}萬</span>
                                                <span>預計負債: {Math.round(item.payable/10000)}萬</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-xs opacity-50 text-center py-1">
                            請勾選成員以計算建議順序
                        </div>
                    )}
                    <div className="text-[9px] opacity-40 flex justify-between">
                        <span>* 正值: 預計總債權大於總負債，建議賣出變現。</span>
                        <span>* 負值: 預計總負債過高，不宜再賣。</span>
                    </div>
                </div>
             </>
           )}
        </div>
        <div className={`mt-2 text-xs flex-none ${theme.subText}`}>
           * 說明：表格數字代表「付款人」欠「收款人」的金額。 <br/>
           * 🔒 您只能修改與自己有關的欄位（您是付款人或收款人）。Wolf 擁有所有修改權限。
        </div>
      </div>
    </div>
  );
};

export default BalanceGrid;