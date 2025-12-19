// src/components/BalanceGrid.js
import React, { useState, useEffect } from 'react';
import { Grid, Wand2, X } from 'lucide-react';
// 1. 新增 getDoc 引入
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";

import { db } from '../config/firebase';
import { MEMBERS } from '../utils/constants';
import { sendNotify, sendLog } from '../utils/helpers';

const BalanceGrid = ({ isOpen, onClose, theme, isDarkMode, currentUser }) => {
  const [gridData, setGridData] = useState({});
  const [loading, setLoading] = useState(true);

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

  const handleCellChange = async (payer, receiver, value) => {
    if (currentUser === '訪客') return; // 🔒 訪客鎖

    const key = `${payer}_${receiver}`;
    const newValue = parseFloat(value) || 0;
    
    // 權限檢查
    const canEdit = payer === currentUser || receiver === currentUser || currentUser === 'Wolf';
    if (!canEdit) return; 

    try {
        // === 修正重點：從資料庫獲取真正的「舊數值」 ===
        // 因為 local state (gridData) 已經被 onChange 修改過了，不能用
        const docRef = doc(db, "settlement_data", "main_grid");
        const docSnap = await getDoc(docRef);
        let oldValue = 0;
        
        if (docSnap.exists()) {
            const serverMatrix = docSnap.data().matrix || {};
            oldValue = parseFloat(serverMatrix[key]) || 0;
        }
        // ============================================

        // 比較數值差異
        if (oldValue !== newValue) {
            const msg = `📝 [帳務修改] ${payer} 對 ${receiver} 的欠款已由 $${oldValue.toLocaleString()} 修改為 $${newValue.toLocaleString()}`;
            sendNotify(msg);
            sendLog(currentUser, "修改餘額表", `${payer} -> ${receiver} : ${oldValue} -> ${newValue}`);
        }

        // 更新資料庫
        // 注意：這裡我們把 local 的修改寫入 database
        // setGridData 其實在 onChange 已經做過了，但這裡再確保一次一致性
        setGridData(prev => ({ ...prev, [key]: newValue }));

        await setDoc(docRef, {
            matrix: { ...gridData, [key]: newValue } // 這裡用 gridData 是安全的，因為我們要儲存的是新狀態
        }, { merge: true });

    } catch (e) {
        console.error("更新失敗", e);
        alert("更新失敗，請檢查網路或權限");
    }
  };

// 輔助函式：將矩陣轉換為文字報表 (如果沒有這個函式也要補上)
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

    // 1. 捕捉劃帳前的狀態
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

    // 2. 捕捉劃帳後的狀態
    const afterReport = generateReport(newMatrix);

    try {
      await setDoc(doc(db, "settlement_data", "main_grid"), { matrix: newMatrix }, { merge: false });
      
      // 3. 組合 Discord 訊息 (這裡是關鍵，必須是這個格式)
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-auto">
      <div className={`w-full max-w-6xl rounded-xl p-6 h-[90vh] flex flex-col ${theme.card}`}>
        <div className={`flex justify-between items-center mb-4 border-b pb-2 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
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

        <div className="flex-1 overflow-auto">
           {loading ? <div className={`p-10 text-center ${theme.subText}`}>載入中...</div> : (
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
           )}
        </div>
        <div className={`mt-2 text-xs ${theme.subText}`}>
           * 說明：表格數字代表「付款人」欠「收款人」的金額。 <br/>
           * 🔒 您只能修改與自己有關的欄位（您是付款人或收款人）。Wolf 擁有所有修改權限。
        </div>
      </div>
    </div>
  );
};

export default BalanceGrid;