// src/components/MusicPlayer.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  Music, Volume2, VolumeX, Play, Pause, ChevronDown, Repeat 
} from 'lucide-react';

const MusicPlayer = ({ videoId, isDarkMode }) => {
  const [player, setPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isReady, setIsReady] = useState(false);

  // 本地設定狀態
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoop, setIsLoop] = useState(false);

  const isLoopRef = useRef(isLoop);

  // 1. 初始化讀取 LocalStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('accounting_player_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.volume !== undefined) setVolume(parsed.volume);
        if (parsed.isMuted !== undefined) setIsMuted(parsed.isMuted);
        if (parsed.isLoop !== undefined) {
          setIsLoop(parsed.isLoop);
          isLoopRef.current = parsed.isLoop;
        }
      } catch (e) {
        console.error("讀取播放器設定失敗", e);
      }
    }
  }, []);

  // 2. 儲存設定到 LocalStorage
  useEffect(() => {
    const settings = { volume, isMuted, isLoop };
    localStorage.setItem('accounting_player_settings', JSON.stringify(settings));
    isLoopRef.current = isLoop;
  }, [volume, isMuted, isLoop]);

  // 3. 載入 YouTube API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // 4. 初始化播放器
  useEffect(() => {
    if (videoId && window.YT && window.YT.Player) {
      if (player) {
        player.loadVideoById(videoId);
        return;
      }

      const newPlayer = new window.YT.Player('youtube-player', {
        height: '0',
        width: '0',
        videoId: videoId,
        playerVars: {
          'autoplay': 0, 
          'controls': 0,
          'rel': 0,
          'playsinline': 1
        },
        events: {
          'onReady': (event) => {
             setIsReady(true);
             if (isMuted) event.target.mute();
             else event.target.unMute();
             event.target.setVolume(volume);
          },
          'onStateChange': (event) => {
             setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
             if (event.data === 0) { // ENDED
               if (isLoopRef.current) {
                 event.target.playVideo();
               }
             }
          }
        }
      });
      setPlayer(newPlayer);
    } else if (videoId) {
       const interval = setInterval(() => {
         if (window.YT && window.YT.Player) {
           clearInterval(interval);
           setPlayer(null); // Trigger re-render
         }
       }, 500);
       return () => clearInterval(interval);
    }
  }, [videoId]);

  const togglePlay = () => {
    if (!player || !isReady) return;
    if (isPlaying) player.pauseVideo();
    else player.playVideo();
  };

  const toggleMute = () => {
    if (!player || !isReady) return;
    if (isMuted) player.unMute();
    else player.mute();
    setIsMuted(!isMuted);
  };

  const toggleLoop = () => {
    setIsLoop(!isLoop);
  };

  const handleVolumeChange = (e) => {
    const val = parseInt(e.target.value);
    setVolume(val);
    if (player && isReady) {
      player.setVolume(val);
      if (val > 0 && isMuted) {
         player.unMute();
         setIsMuted(false);
      }
    }
  };

  if (!videoId) return null;

  return (
    <div className={`fixed bottom-4 left-4 z-40 transition-all duration-300 shadow-xl rounded-lg border overflow-hidden
      ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}
      ${isMinimized ? 'w-10 h-10 rounded-full' : 'w-64 p-3'}
    `}>
      <div id="youtube-player" className="hidden"></div>

      {isMinimized ? (
        <button onClick={() => setIsMinimized(false)} className="w-full h-full flex items-center justify-center hover:bg-gray-200/20 rounded-full">
           <Music size={20} className={isPlaying ? 'animate-pulse text-green-500' : 'text-gray-400'}/>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
           <div className="flex justify-between items-center border-b pb-1 border-gray-500/20">
             <span className="text-xs font-bold flex items-center gap-1"><Music size={14}/> 音樂播放器</span>
             <button onClick={() => setIsMinimized(true)}><ChevronDown size={16}/></button>
           </div>
           
           <div className="flex items-center gap-2 justify-center py-1">
             <button onClick={togglePlay} className={`p-2 rounded-full transition-colors ${isPlaying ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`} title={isPlaying ? "暫停" : "播放"}>
                {isPlaying ? <Pause size={16}/> : <Play size={16}/>}
             </button>
             
             <button onClick={toggleMute} className={`p-2 rounded-full transition-colors ${isMuted ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-700'}`} title="靜音/取消靜音">
                {isMuted ? <VolumeX size={16}/> : <Volume2 size={16}/>}
             </button>

             <button onClick={toggleLoop} className={`p-2 rounded-full transition-colors ${isLoop ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`} title="循環播放">
                <Repeat size={16}/>
             </button>
           </div>

           <div className="flex items-center gap-2">
             <Volume2 size={12} className="opacity-50"/>
             <input 
               type="range" min="0" max="100" value={volume} 
               onChange={handleVolumeChange}
               className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
             />
           </div>
           <div className="text-[10px] opacity-60 text-center truncate">
             ID: {videoId}
           </div>
        </div>
      )}
    </div>
  );
};

export default MusicPlayer;