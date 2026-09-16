'use client';

import React, { useEffect, useRef } from 'react';

interface FeedbackEvent {
  id: number;
  moveId: string;
  moveName: string;
  damage: number;
  isBlocked: boolean;
  isCounter: boolean;
  player: 'p1' | 'p2';
  x: number; // percentage position
  y: number;
}

interface MoveExecutionFeedbackProps {
  events: FeedbackEvent[];
  onExpire: (id: number) => void;
}

function FeedbackBubble({ event, onExpire }: { event: FeedbackEvent; onExpire: (id: number) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onExpire(event.id), 1200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [event.id, onExpire]);

  const isBlocked = event.isBlocked;
  const isCounter = event.isCounter;

  let label = '';
  let color = '#facc15';
  let size = 'text-lg';

  if (isBlocked) {
    label = 'BLOCKED';
    color = '#94a3b8';
    size = 'text-sm';
  } else if (isCounter) {
    label = 'COUNTER!';
    color = '#f97316';
    size = 'text-xl';
  } else if (event.damage >= 500) {
    label = `${event.damage}`;
    color = '#ef4444';
    size = 'text-2xl';
  } else if (event.damage >= 200) {
    label = `${event.damage}`;
    color = '#f97316';
    size = 'text-xl';
  } else {
    label = `${event.damage}`;
    color = '#facc15';
    size = 'text-lg';
  }

  return (
    <div
      className="absolute pointer-events-none z-50 flex flex-col items-center gap-0.5"
      style={{
        left: `${event.x}%`,
        top: `${event.y}%`,
        transform: 'translate(-50%, -50%)',
        animation: 'feedbackFloat 1.2s ease-out forwards',
      }}
    >
      {/* Move name */}
      <div className="text-[8px] font-mono text-zinc-400 tracking-widest whitespace-nowrap">
        {event.moveName.toUpperCase()}
      </div>
      {/* Damage / label */}
      <div
        className={`font-black font-mono leading-none ${size}`}
        style={{
          color,
          textShadow: `0 0 12px ${color}88, 0 2px 8px rgba(0,0,0,0.8)`,
        }}
      >
        {label}
      </div>
      {/* Counter badge */}
      {isCounter && !isBlocked && (
        <div className="text-[7px] font-black font-mono text-orange-400 tracking-[0.3em] border border-orange-700 px-1 bg-orange-950/60">
          PUNISH
        </div>
      )}
    </div>
  );
}

export default function MoveExecutionFeedback({ events, onExpire }: MoveExecutionFeedbackProps) {
  return (
    <>
      <style>{`
        @keyframes feedbackFloat {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
          20%  { opacity: 1; transform: translate(-50%, -60%) scale(1); }
          80%  { opacity: 0.8; transform: translate(-50%, -80%) scale(0.9); }
          100% { opacity: 0; transform: translate(-50%, -100%) scale(0.8); }
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none z-40">
        {events.map(event => (
          <FeedbackBubble key={event.id} event={event} onExpire={onExpire} />
        ))}
      </div>
    </>
  );
}
