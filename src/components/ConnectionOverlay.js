// src/components/ConnectionOverlay.js
import React from 'react';

const ConnectionOverlay = ({ displayEvents, now, globalSettings }) => {
  if (!displayEvents || displayEvents.length === 0) return null;

  const MAP_LINE_GAP_SECS = globalSettings?.mapLineGapSecs || 120;
  // 讀取設定的字體大小，預設 12px
  const FONT_SIZE = globalSettings?.mapLineFontSize || 12;

  const sorted = [...displayEvents].sort((a, b) => new Date(a.respawnTime) - new Date(b.respawnTime));
  
  const groups = [];
  if (sorted.length > 0) {
    let currentGroup = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = currentGroup[currentGroup.length - 1];
      const diffSecs = Math.abs(new Date(sorted[i].respawnTime) - new Date(prev.respawnTime)) / 1000;
      
      if (diffSecs <= MAP_LINE_GAP_SECS) {
        currentGroup.push(sorted[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [sorted[i]];
      }
    }
    groups.push(currentGroup);
  }

  if (groups.length === 0) return null;
  
  const firstGroupTime = new Date(groups[0][0].respawnTime);
  const diffFromNow = (firstGroupTime - now) / 1000 / 60;
  
  if (diffFromNow > 10) return null;

  const connections = [];
  
  for (let i = 0; i < groups.length - 1; i++) {
    const currentGroup = groups[i];
    const nextGroup = groups[i+1];
    
    currentGroup.forEach(startEvent => {
      if (!startEvent.mapPos) return;
      nextGroup.forEach(endEvent => {
        if (!endEvent.mapPos) return;
        
        const timeDiff = Math.abs(new Date(startEvent.respawnTime) - new Date(endEvent.respawnTime)) / 1000;

        connections.push({
          key: `${startEvent.id}-${endEvent.id}`,
          x1: startEvent.mapPos.x,
          y1: startEvent.mapPos.y,
          x2: endEvent.mapPos.x,
          y2: endEvent.mapPos.y,
          timeDiff: Math.round(timeDiff)
        });
      });
    });
  }

  return (
    <>
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <style>
          {`
            .path-flow {
              animation: dash 1s linear infinite;
            }
            @keyframes dash {
              to {
                stroke-dashoffset: -10;
              }
            }
          `}
        </style>
        {connections.map(conn => (
          <line
            key={conn.key}
            x1={`${conn.x1}%`}
            y1={`${conn.y1}%`}
            x2={`${conn.x2}%`}
            y2={`${conn.y2}%`}
            stroke="rgba(255, 255, 255, 0.6)"
            strokeWidth="2"
            strokeDasharray="5,5"
            className="path-flow"
          />
        ))}
      </svg>

      {connections.map(conn => (
        <div
          key={`label-${conn.key}`}
          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
          style={{
            left: `${(conn.x1 + conn.x2) / 2}%`,
            top: `${(conn.y1 + conn.y2) / 2}%`
          }}
        >
          <span 
            className="bg-black/80 text-white font-mono px-1.5 py-0.5 rounded-full border border-white/30 shadow-lg whitespace-nowrap"
            // === 修改重點：套用動態字體大小 ===
            style={{ fontSize: `${FONT_SIZE}px` }}
          >
            {conn.timeDiff}s
          </span>
        </div>
      ))}
    </>
  );
};

export default ConnectionOverlay;