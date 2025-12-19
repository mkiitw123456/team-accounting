// src/components/AIAssistantView.js
import React, { useState, useEffect, useRef } from 'react';
import { Bot, Sparkles, Send } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, getDoc, doc } from "firebase/firestore";

import { db } from '../config/firebase';

const AIAssistantView = ({ isDarkMode, currentUser, globalSettings, theme }) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好！我是你的記帳助手。我可以幫你查詢誰賣了多少錢、目前的欠款狀況或是最近的交易紀錄。請問有什麼可以幫你的嗎？' }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!globalSettings.geminiApiKey) {
        setMessages(prev => [...prev, { role: 'user', content: input }, { role: 'assistant', content: '⚠️ 請先至「系統全域設定」中設定 Google Gemini API Key 才能使用此功能。' }]);
        setInput("");
        return;
    }

    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput("");
    setLoading(true);

    try {
        const historyItemsQuery = query(collection(db, "history_items"), orderBy("settledAt", "desc"), limit(50));
        const historyDocs = await getDocs(historyItemsQuery);
        const activeDocs = await getDocs(collection(db, "active_items"));
        const gridDoc = await getDoc(doc(db, "settlement_data", "main_grid"));

        const historyData = historyDocs.docs.map(d => {
            const data = d.data();
            return {
                名稱: data.itemName,
                賣家: data.seller,
                價格: data.price,
                參與者: (data.participants || []).map(p=>p.name).join(','),
                時間: data.settledAt ? data.settledAt.split('T')[0] : '未知'
            };
        });

        const activeData = activeDocs.docs.map(d => {
            const data = d.data();
            return {
                名稱: data.itemName,
                賣家: data.seller,
                價格: data.price,
                參與者: (data.participants || []).map(p=>p.name).join(','),
                狀態: '販賣中'
            };
        });

        const gridData = gridDoc.exists() ? gridDoc.data().matrix : {};

        const systemPrompt = `
          你是一個記帳助手。
          請根據以下的 JSON 資料回答使用者的問題。
          請用繁體中文回答，語氣友善。
          
          [目前的欠款狀況 (A_B 代表 A 欠 B 多少錢)]:
          ${JSON.stringify(gridData)}

          [最近 50 筆已出售紀錄]:
          ${JSON.stringify(historyData)}

          [正在販賣中的物品]:
          ${JSON.stringify(activeData)}

          如果資料中沒有答案，請直接說你不知道，不要編造。
          回答請簡潔有力。
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${globalSettings.geminiApiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: systemPrompt + "\n\n使用者問題: " + userMessage }]
                }]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "抱歉，我無法解讀資料。";
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);

    } catch (e) {
        console.error("AI Error:", e);
        setMessages(prev => [...prev, { role: 'assistant', content: `發生錯誤: ${e.message}` }]);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-full rounded-xl overflow-hidden ${theme.card} shadow-xl border-2 border-yellow-500/30`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center gap-3 ${isDarkMode ? 'bg-yellow-900/20 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="bg-yellow-500 p-2 rounded-full text-white shadow-lg">
                <Bot size={24} />
            </div>
            <div>
                <h3 className={`font-bold text-lg ${theme.text}`}>AI 財務助手</h3>
                <p className={`text-xs opacity-60 ${theme.text}`}>Powered by Gemini 1.5 Flash</p>
            </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/5">
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm whitespace-pre-wrap ${
                        msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : `${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-800'} rounded-bl-none`
                    }`}>
                        {msg.content}
                    </div>
                </div>
            ))}
            {loading && (
                <div className="flex justify-start">
                    <div className={`p-3 rounded-2xl rounded-bl-none flex items-center gap-2 ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                        <Sparkles size={16} className="animate-spin text-yellow-500"/>
                        <span className="text-xs opacity-50">AI 正在思考中...</span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    className={`flex-1 p-3 rounded-xl border focus:ring-2 focus:ring-yellow-500 outline-none transition-all ${theme.input}`}
                    placeholder="輸入問題，例如：水野賣了多少錢？"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button 
                    onClick={handleSend}
                    disabled={loading}
                    className={`p-3 rounded-xl bg-yellow-500 text-white hover:bg-yellow-600 transition-colors shadow-lg ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <Send size={20} />
                </button>
            </div>
            <div className="text-[10px] text-center mt-2 opacity-40">
                * AI 回答僅供參考，請以實際表格為準。
            </div>
        </div>
    </div>
  );
};

export default AIAssistantView;