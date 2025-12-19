// src/components/ConnectionOverlay.js
import React from 'react';

const ConnectionOverlay = ({ displayEvents, now, globalSettings }) => {
  if (!displayEvents || displayEvents.length === 0) return null;

  const MAP_LINE_GAP_SECS = globalSettings?.mapLineGapSecs || 120;
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

  const lines = [];
  
  for (let i = 0; i < groups.length - 1; i++) {
    const currentGroup = groups[i];
    const nextGroup = groups[i+1];
    
    currentGroup.forEach(startEvent => {
      if (!startEvent.mapPos) return;
      nextGroup.forEach(endEvent => {
        if (!endEvent.mapPos) return;
        
        lines.push(
          <line
            key={`${startEvent.id}-${endEvent.id}`}
            x1={`${startEvent.mapPos.x}%`}
            y1={`${startEvent.mapPos.y}%`}
            x2={`${endEvent.mapPos.x}%`}
            y2={`${endEvent.mapPos.y}%`}
            stroke="rgba(255, 255, 255, 0.6)"
            strokeWidth="2"
            strokeDasharray="5,5"
            className="path-flow"
          />
        );
      });
    });
  }

  return (
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
      {lines}
    </svg>
  );
};

export default ConnectionOverlay;