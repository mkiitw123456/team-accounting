// src/views/CasinoView.js
import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp } from "firebase/firestore"; 
import { db } from '../config/firebase'; // 確保路徑正確
import { Dice5, Coins, Users, AlertCircle } from 'lucide-react';

// === 設定輪盤參數 ===
const CARD_WIDTH = 80; // 每個格子的寬度 (px)
const VISIBLE_CARDS = 7; // 視窗內可見格子數 (為了置中計算)
// 15個格子: 1綠, 7紅, 7黑 (穿插排列)
// 0=Green, 1=Red, 2=Black...
const WHEEL_SEQUENCE = [
  { color: 'green', label: '0', val: 0 },
  { color: 'red', label: '1', val: 1 }, { color: 'black', label: '2', val: 2 },
  { color: 'red', label: '3', val: 3 }, { color: 'black', label: '4', val: 4 },
  { color: 'red', label: '5', val: 5 }, { color: 'black', label: '6', val: 6 },
  { color: 'red', label: '7', val: 7 }, { color: 'black', label: '8', val: 8 },
  { color: 'red', label: '9', val: 9 }, { color: 'black', label: '10', val: 10 },
  { color: 'red', label: '11', val: 11 }, { color: 'black', label: '12', val: 12 },
  { color: 'red', label: '13', val: 13 }, { color: 'black', label: '14', val: 14 },
];

// 為了做出無限捲動效果，我們將陣列重複多次
const REPEAT_COUNT = 20; 
const FULL_WHEEL = Array(REPEAT_COUNT).fill(WHEEL_SEQUENCE).flat();

// === 偽隨機數產生器 (確保所有人同一分鐘看到同樣結果) ===
const mulberry32 = (a) => {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

const CasinoView = ({ isDarkMode, currentUser }) => {
  // === 狀態管理 ===
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState('BETTING'); // BETTING, READY, SPINNING, RESULT
  const [gameId, setGameId] = useState(''); // 以分鐘為單位的 ID
  
  // 輪盤動畫
  const [wheelOffset, setWheelOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [resultIndex, setResultIndex] = useState(null);

  // 下注
  const [bets, setBets] = useState({ red: '', green: '', black: '' });
  const [currentRoundBets, setCurrentRoundBets] = useState([]);
  
  // 樣式
  const theme = {
    text: isDarkMode ? 'text-gray-100' : 'text-gray-800',
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    input: isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800',
  };

  // 1. 主要計時器 Loop
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      
      const currentSeconds = new Date(now).getSeconds();
      const currentGameId = Math.floor(now / 60000).toString(); // 每分鐘一個 ID
      
      setSeconds(currentSeconds);
      if (gameId !== currentGameId) setGameId(currentGameId);

      // 階段控制邏輯
      if (currentSeconds >= 0 && currentSeconds < 30) {
        if (phase !== 'BETTING') {
            setPhase('BETTING');
            setIsTransitioning(false); // 重置動畫設定
            setWheelOffset(0); // 回歸原點(視覺上)
        }
      } else if (currentSeconds >= 30 && currentSeconds < 35) {
        if (phase !== 'READY') setPhase('READY');
      } else if (currentSeconds >= 35 && currentSeconds < 55) {
        if (phase !== 'SPINNING') {
          setPhase('SPINNING');
          triggerSpin(currentGameId); // 觸發旋轉
        }
      } else {
        if (phase !== 'RESULT') setPhase('RESULT');
      }
    }, 500); // 0.5秒檢查一次

    return () => clearInterval(timer);
  }, [phase, gameId]);

  // 2. 監聽 Firebase 下注資料
  useEffect(() => {
    if (!db || !gameId) return;
    // 監聽 active_bets 集合，並篩選當前 gameId
    const q = query(
        collection(db, "casino_bets"), 
        where("gameId", "==", gameId),
        orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const betsData = snapshot.docs.map(doc => doc.data());
        setCurrentRoundBets(betsData);
    });
    return () => unsubscribe();
  }, [gameId]);

  // 3. 計算並執行旋轉
  const triggerSpin = (seedKey) => {
    // 使用 gameId (seedKey) 作為隨機種子，確保所有人結果一樣
    const seed = parseInt(seedKey);
    const rng = mulberry32(seed);
    const randomVal = rng(); // 0 ~ 1 之間的固定隨機數
    
    // 決定贏家是誰 (0 ~ 14)
    const winnerIndexInSequence = Math.floor(randomVal * 15);
    setResultIndex(winnerIndexInSequence);

    // 計算滑動距離
    // 我們要滑動到陣列的中後段，確保有足夠的長度旋轉
    // 目標是讓 FULL_WHEEL[targetIndex] 停在中間
    // 假設停在第 10 組的 sequence 位置
    const targetRound = Math.floor(REPEAT_COUNT / 2) + 2; 
    const targetIndex = (targetRound * 15) + winnerIndexInSequence;
    
    // 微調偏移量，讓指針指在格子中間 (並加入一點點隨機偏移讓它看起來自然，這裡先固定置中)
    // 容器中心點
    const containerCenter = window.innerWidth / 2; // 或固定容器寬度
    
    // 計算 translateX
    // 移動距離 = (目標格子的index * 格子寬) - (視窗一半) + (格子一半)
    // 為了讓它由右至左，我們是用負值
    const spinDistance = (targetIndex * CARD_WIDTH);
    
    // 加上一點點隨機雜訊(同樣基於種子)，讓指針不會永遠指在正中間
    const noise = (rng() * 40) - 20; 

    setIsTransitioning(true); // 開啟 CSS transition
    setWheelOffset(spinDistance + noise);
  };

  // 4. 下注功能
  const handlePlaceBet = async () => {
    if (currentUser === '訪客') return alert("訪客無法下注");
    if (phase !== 'BETTING') return alert("現在停止下注！");
    
    const r = parseInt(bets.red) || 0;
    const g = parseInt(bets.green) || 0;
    const b = parseInt(bets.black) || 0;
    
    if (r === 0 && g === 0 && b === 0) return alert("請輸入金額");

    try {
        await addDoc(collection(db, "casino_bets"), {
            gameId: gameId,
            user: currentUser,
            betRed: r,
            betGreen: g,
            betBlack: b,
            createdAt: serverTimestamp()
        });
        setBets({ red: '', green: '', black: '' }); // 清空輸入
    } catch (e) {
        console.error("下注失敗", e);
        alert("下注失敗");
    }
  };

  // 輔助：取得某個 index 的顏色
  const getColor = (i) => {
     return WHEEL_SEQUENCE[i % 15].color;
  };
  
  // 輔助：取得文字顏色 class
  const getBgColorClass = (color) => {
      if (color === 'red') return 'bg-red-600';
      if (color === 'black') return 'bg-gray-900';
      return 'bg-green-600';
  }

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden ${theme.text}`}>
      
      {/* === 上方輪盤區 === */}
      <div className="relative w-full h-40 bg-gray-800 border-b-4 border-yellow-500 shadow-xl overflow-hidden flex items-center justify-center">
        
        {/* 倒數計時與狀態文字 (浮動顯示) */}
        <div className="absolute top-2 z-20 bg-black/50 px-4 py-1 rounded-full text-white font-mono font-bold backdrop-blur-sm border border-white/20">
            {phase === 'BETTING' && <span className="text-green-400">開放下注: {30 - seconds}s</span>}
            {phase === 'READY' && <span className="text-yellow-400 animate-pulse">準備開始...</span>}
            {phase === 'SPINNING' && <span className="text-red-400">開獎中...</span>}
            {phase === 'RESULT' && <span className="text-blue-400">結算中</span>}
        </div>

        {/* 黃色基準線 (指針) */}
        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-yellow-400 z-10 shadow-[0_0_10px_rgba(250,204,21,0.8)] transform -translate-x-1/2"></div>
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[15px] border-t-yellow-400 z-20"></div>

        {/* 捲動軌道 */}
        <div 
            className="flex items-center h-full"
            style={{
                // 為了讓指針指在中間，我們需要初始位移視窗的一半
                transform: `translateX(calc(50vw - ${CARD_WIDTH/2}px - ${wheelOffset}px))`,
                transition: isTransitioning ? 'transform 8s cubic-bezier(0.1, 0.8, 0.1, 1)' : 'none',
                willChange: 'transform'
            }}
        >
            {FULL_WHEEL.map((item, idx) => (
                <div 
                    key={idx} 
                    className={`flex-shrink-0 flex items-center justify-center border-r border-white/20 text-white font-bold text-2xl shadow-inner relative`}
                    style={{ width: `${CARD_WIDTH}px`, height: '100%' }}
                >   
                    <div className={`absolute inset-1 rounded-lg ${getBgColorClass(item.color)} flex items-center justify-center border border-white/10`}>
                        {item.val}
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* === 顯示開獎結果 (只在結果階段顯示) === */}
      {phase === 'RESULT' && resultIndex !== null && (
         <div className="bg-blue-600 text-white text-center py-2 font-bold animate-bounce shadow-lg z-10">
             🎉 本期開出：
             <span className={`mx-2 px-3 py-1 rounded ${getBgColorClass(WHEEL_SEQUENCE[resultIndex].color)}`}>
                 {WHEEL_SEQUENCE[resultIndex].val} ({WHEEL_SEQUENCE[resultIndex].color.toUpperCase()})
             </span>
         </div>
      )}

      {/* === 下方操作區 === */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
         <div className="max-w-4xl mx-auto">
            
            {/* 下注輸入框區 */}
            <div className={`p-6 rounded-xl shadow-lg mb-6 ${theme.card}`}>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Coins className="text-yellow-500"/> 下注區 
                    <span className="text-xs opacity-60 font-normal ml-2">(倍率: 綠x14, 紅x2, 黑x2)</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    {/* 紅色 */}
                    <div>
                        <label className="block text-sm font-bold text-red-500 mb-1">RED (紅)</label>
                        <input 
                            type="number" 
                            className={`w-full p-3 rounded-lg border-2 border-red-500/30 focus:border-red-500 outline-none text-center font-mono text-lg ${theme.input}`}
                            placeholder="0"
                            value={bets.red}
                            onChange={(e)=>setBets({...bets, red: e.target.value})}
                            disabled={phase !== 'BETTING'}
                        />
                    </div>
                     {/* 綠色 */}
                     <div>
                        <label className="block text-sm font-bold text-green-500 mb-1">GREEN (綠)</label>
                        <input 
                            type="number" 
                            className={`w-full p-3 rounded-lg border-2 border-green-500/30 focus:border-green-500 outline-none text-center font-mono text-lg ${theme.input}`}
                            placeholder="0"
                            value={bets.green}
                            onChange={(e)=>setBets({...bets, green: e.target.value})}
                            disabled={phase !== 'BETTING'}
                        />
                    </div>
                    {/* 黑色 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-500 mb-1">BLACK (黑)</label>
                        <input 
                            type="number" 
                            className={`w-full p-3 rounded-lg border-2 border-gray-500/30 focus:border-gray-500 outline-none text-center font-mono text-lg ${theme.input}`}
                            placeholder="0"
                            value={bets.black}
                            onChange={(e)=>setBets({...bets, black: e.target.value})}
                            disabled={phase !== 'BETTING'}
                        />
                    </div>

                    <button 
                        onClick={handlePlaceBet}
                        disabled={phase !== 'BETTING'}
                        className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all
                            ${phase === 'BETTING' 
                                ? 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105' 
                                : 'bg-gray-400 cursor-not-allowed'}`}
                    >
                        {phase === 'BETTING' ? '確認下注' : '等待下一局'}
                    </button>
                </div>
            </div>

            {/* 即時下注列表 */}
            <div className={`rounded-xl shadow overflow-hidden ${theme.card}`}>
                <div className="p-3 border-b border-gray-200/20 bg-black/5 flex items-center justify-between">
                    <h4 className="font-bold flex items-center gap-2"><Users size={18}/> 本局玩家下注</h4>
                    <span className="text-xs opacity-60">Game ID: {gameId}</span>
                </div>
                <div className="max-h-60 overflow-y-auto p-2 space-y-2">
                    {currentRoundBets.length === 0 ? (
                        <div className="text-center py-8 opacity-40 flex flex-col items-center">
                            <AlertCircle size={32} className="mb-2"/>
                            尚無人下注
                        </div>
                    ) : (
                        currentRoundBets.map((bet, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded bg-black/5 border border-white/5">
                                <div className="font-bold">{bet.user}</div>
                                <div className="flex gap-3 text-sm font-mono">
                                    {bet.betRed > 0 && <span className="text-red-500 font-bold">紅: ${bet.betRed}</span>}
                                    {bet.betGreen > 0 && <span className="text-green-500 font-bold">綠: ${bet.betGreen}</span>}
                                    {bet.betBlack > 0 && <span className="text-gray-400 font-bold">黑: ${bet.betBlack}</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

         </div>
      </div>
    </div>
  );
};

export default CasinoView;