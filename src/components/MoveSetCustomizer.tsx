'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { getAllBannonFighters, getBannonFighter, type BannonFighterProfile } from '../data/bannonRoster';
import {
  getCharacterMoveSet,
  assignMoveToSlot,
  resetMoveSlot,
  resetAllMoveSlots,
  getAvailableMovesForSlot,
  MOVE_SLOT_CONFIG,
  type MoveSlot,
  type CustomizedMoveSet,
} from '../engine/CharacterMoveSetSystem';
import { getMoveById, type BrutalFistMove } from '../engine/BrutalFistMoveCatalog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MoveSetCustomizerProps {
  onClose?: () => void;
  onConfirm?: (characterId: string, moveSet: CustomizedMoveSet) => void;
  initialCharacterId?: string;
}

// ─── Faction Badge ────────────────────────────────────────────────────────────

const FACTION_COLORS: Record<string, string> = {
  alliance:    'bg-blue-900 text-blue-200 border-blue-700',
  corporate:   'bg-red-900 text-red-200 border-red-700',
  chaos:       'bg-purple-900 text-purple-200 border-purple-700',
  independent: 'bg-yellow-900 text-yellow-200 border-yellow-700',
};

function FactionBadge({ alignment }: { alignment: BannonFighterProfile['factionAlignment'] }) {
  const labels: Record<string, string> = {
    alliance: 'Alliance', corporate: 'Corporate', chaos: 'Chaos', independent: 'Independent'
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-mono uppercase tracking-wider ${FACTION_COLORS[alignment]}`}>
      {labels[alignment]}
    </span>
  );
}

// ─── Character Card ───────────────────────────────────────────────────────────

function CharacterCard({
  fighter,
  selected,
  customized,
  onClick,
}: {
  fighter: BannonFighterProfile;
  selected: boolean;
  customized: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all duration-150 ${
        selected
          ? 'border-yellow-500 bg-gray-800 shadow-lg shadow-yellow-900/30'
          : 'border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-800'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`font-bold text-sm ${selected ? 'text-yellow-400' : 'text-white'}`}>
          {fighter.name}
        </span>
        {customized && (
          <span className="text-xs text-green-400 font-mono">✦ CUSTOM</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <FactionBadge alignment={fighter.factionAlignment} />
        <span className="text-xs text-gray-400 font-mono">{fighter.role.split('/')[0].trim()}</span>
      </div>
    </button>
  );
}

// ─── Move Slot Row ────────────────────────────────────────────────────────────

function MoveSlotRow({
  slot,
  label,
  currentMoveId,
  defaultMoveId,
  isCustomized,
  availableMoves,
  onAssign,
  onReset,
}: {
  slot: MoveSlot;
  label: string;
  currentMoveId: string | undefined;
  defaultMoveId: string | undefined;
  isCustomized: boolean;
  availableMoves: BrutalFistMove[];
  onAssign: (slot: MoveSlot, moveId: string) => void;
  onReset: (slot: MoveSlot) => void;
}) {
  const currentMove = currentMoveId ? getMoveById(currentMoveId) : null;

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border ${
      isCustomized ? 'border-green-800 bg-green-950/30' : 'border-gray-800 bg-gray-900/50'
    }`}>
      <div className="w-32 shrink-0">
        <span className="text-xs text-gray-400 font-mono uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <select
          value={currentMoveId ?? ''}
          onChange={e => onAssign(slot, e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 font-mono focus:outline-none focus:border-yellow-500"
        >
          {availableMoves.map(move => (
            <option key={move.id} value={move.id}>
              {move.displayName}
              {move.inputSequence ? ` [${move.inputSequence}]` : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="w-24 shrink-0 text-right">
        {currentMove && (
          <span className="text-xs text-gray-500 font-mono">
            {currentMove.damage > 0 ? `${currentMove.damage}dmg` : '—'}
          </span>
        )}
      </div>
      {isCustomized && (
        <button
          onClick={() => onReset(slot)}
          className="shrink-0 text-xs text-red-400 hover:text-red-300 font-mono px-1"
          title="Reset to default"
        >
          ↺
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MoveSetCustomizer({ onClose, onConfirm, initialCharacterId }: MoveSetCustomizerProps) {
  const fighters = useMemo(() => getAllBannonFighters(), []);
  const [selectedId, setSelectedId] = useState<string>(initialCharacterId ?? fighters[0]?.id ?? '');
  const [moveSets, setMoveSets] = useState<Map<string, CustomizedMoveSet>>(() => {
    const map = new Map<string, CustomizedMoveSet>();
    fighters.forEach(f => {
      const ms = getCharacterMoveSet(f.id);
      if (ms) map.set(f.id, ms);
    });
    return map;
  });
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const selectedFighter = useMemo(() => getBannonFighter(selectedId), [selectedId]);
  const selectedMoveSet = moveSets.get(selectedId);

  const handleAssign = useCallback((slot: MoveSlot, moveId: string) => {
    const updated = assignMoveToSlot(selectedId, slot, moveId);
    if (updated) {
      setMoveSets(prev => new Map(prev).set(selectedId, updated));
    }
  }, [selectedId]);

  const handleReset = useCallback((slot: MoveSlot) => {
    const updated = resetMoveSlot(selectedId, slot);
    if (updated) {
      setMoveSets(prev => new Map(prev).set(selectedId, updated));
    }
  }, [selectedId]);

  const handleResetAll = useCallback(() => {
    const updated = resetAllMoveSlots(selectedId);
    if (updated) {
      setMoveSets(prev => new Map(prev).set(selectedId, updated));
    }
  }, [selectedId]);

  const handleConfirm = useCallback(() => {
    if (selectedMoveSet && onConfirm) {
      onConfirm(selectedId, selectedMoveSet);
    }
  }, [selectedId, selectedMoveSet, onConfirm]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(MOVE_SLOT_CONFIG.map(c => c.category)));
    return ['all', ...cats];
  }, []);

  const filteredSlots = useMemo(() => {
    if (activeCategory === 'all') return MOVE_SLOT_CONFIG;
    return MOVE_SLOT_CONFIG.filter(c => c.category === activeCategory);
  }, [activeCategory]);

  if (!selectedFighter || !selectedMoveSet) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-full max-h-[90vh] bg-gray-950 border border-gray-700 rounded-xl flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-yellow-400 font-mono tracking-wider uppercase">
              Move Set Customizer
            </h1>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              Assign moves from the full catalog to each character slot
            </p>
          </div>
          <div className="flex gap-3">
            {selectedMoveSet.isCustomized && (
              <button
                onClick={handleResetAll}
                className="px-4 py-2 text-sm font-mono text-red-400 border border-red-800 rounded hover:bg-red-900/30 transition-colors"
              >
                Reset All
              </button>
            )}
            {onConfirm && (
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-mono text-black bg-yellow-400 rounded hover:bg-yellow-300 transition-colors font-bold"
              >
                Confirm
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-mono text-gray-400 border border-gray-700 rounded hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* Character List */}
          <div className="w-56 shrink-0 border-r border-gray-800 bg-gray-950 overflow-y-auto p-3 flex flex-col gap-2">
            <p className="text-xs text-gray-600 font-mono uppercase tracking-wider px-1 mb-1">
              Roster ({fighters.length})
            </p>
            {fighters.map(fighter => (
              <CharacterCard
                key={fighter.id}
                fighter={fighter}
                selected={fighter.id === selectedId}
                customized={moveSets.get(fighter.id)?.isCustomized ?? false}
                onClick={() => setSelectedId(fighter.id)}
              />
            ))}
          </div>

          {/* Main Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Character Info */}
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-lg font-bold text-white">{selectedFighter.name}</h2>
                    <FactionBadge alignment={selectedFighter.factionAlignment} />
                    {selectedMoveSet.isCustomized && (
                      <span className="text-xs text-green-400 font-mono">
                        ✦ {selectedMoveSet.customizedSlots.length} slot{selectedMoveSet.customizedSlots.length !== 1 ? 's' : ''} customized
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
                    <span className="text-yellow-600 font-mono">Style: </span>
                    {selectedFighter.fightingStyle}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-2xl mt-1">
                    {selectedFighter.personality}
                  </p>
                </div>
                <div className="shrink-0 grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono">
                  <span className="text-gray-500">HP</span>
                  <span className="text-white">{selectedFighter.hp.toLocaleString()}</span>
                  <span className="text-gray-500">Speed</span>
                  <span className="text-white">{selectedFighter.speed}</span>
                  <span className="text-gray-500">Strength</span>
                  <span className="text-white">{selectedFighter.strength}</span>
                  <span className="text-gray-500">Poise</span>
                  <span className="text-white">{selectedFighter.poise}</span>
                </div>
              </div>
            </div>

            {/* Category Filter */}
            <div className="px-6 py-2 border-b border-gray-800 bg-gray-950 shrink-0 flex gap-2 overflow-x-auto">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 text-xs font-mono rounded uppercase tracking-wide whitespace-nowrap transition-colors ${
                    activeCategory === cat
                      ? 'bg-yellow-500 text-black font-bold' :'text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Move Slots */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
              {filteredSlots.map(slotConfig => {
                const currentMoveId = selectedMoveSet[slotConfig.slot] as string | undefined;
                const defaultMoveId = selectedFighter.defaultMoveSet[slotConfig.slot] as string | undefined;
                const isCustomized = selectedMoveSet.customizedSlots.includes(slotConfig.slot);
                const availableMoves = getAvailableMovesForSlot(slotConfig.slot);

                return (
                  <MoveSlotRow
                    key={slotConfig.slot}
                    slot={slotConfig.slot}
                    label={slotConfig.label}
                    currentMoveId={currentMoveId}
                    defaultMoveId={defaultMoveId}
                    isCustomized={isCustomized}
                    availableMoves={availableMoves}
                    onAssign={handleAssign}
                    onReset={handleReset}
                  />
                );
              })}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
