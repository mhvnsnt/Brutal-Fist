'use client';

import React, { useState } from 'react';
import { getAllBannonFighters, getBannonFighter, type BannonFighterProfile } from '../data/bannonRoster';

interface StoryModeScreenProps {
  onBack: () => void;
  onStartStoryBattle: (p1: BannonFighterProfile, p2: BannonFighterProfile, chapterTitle: string) => void;
  /** Called when a character's final chapter is completed — passes characterId + cosmetic reward */
  onCosmeticUnlock?: (characterId: string, reward: CosmeticReward) => void;
}

// ── Cosmetic reward type ──────────────────────────────────────────────────────
export interface CosmeticReward {
  id: string;
  characterId: string;
  name: string;
  type: 'skin' | 'effect' | 'bundle' | 'seasonal';
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
}

// ── Per-character final-boss cosmetic rewards ─────────────────────────────────
// Beating the 5th chapter (final boss) of each arc auto-grants this cosmetic.
const CHAPTER_COSMETICS: Record<string, CosmeticReward> = {
  bannon: {
    id: 'bannon_beast_skin',
    characterId: 'bannon',
    name: 'Beast Mode Skin',
    type: 'skin',
    description: "Bannon's AWE Championship battle-worn outfit. Unlocked by completing The Beast Awakens arc.",
    rarity: 'legendary',
    icon: '🔥',
  },
  maime: {
    id: 'maime_precision_effect',
    characterId: 'maime',
    name: 'Precision Strike Effect',
    type: 'effect',
    description: 'Surgical blue impact trails on every hit. Unlocked by completing Precision Protocol arc.',
    rarity: 'epic',
    icon: '⚡',
  },
  onyx: {
    id: 'onyx_iron_bundle',
    characterId: 'onyx',
    name: 'Iron Will Bundle',
    type: 'bundle',
    description: 'Iron-tinted skin + shockwave ground effect. Unlocked by completing Iron Will arc.',
    rarity: 'epic',
    icon: '🪨',
  },
  cipher: {
    id: 'cipher_shadow_skin',
    characterId: 'cipher',
    name: 'Shadow Protocol Skin',
    type: 'skin',
    description: "Cipher's double-agent stealth outfit. Unlocked by completing Shadow Protocol arc.",
    rarity: 'rare',
    icon: '🕶️',
  },
  echo: {
    id: 'echo_mirror_seasonal',
    characterId: 'echo',
    name: 'Mirror Seasonal Cosmetic',
    type: 'seasonal',
    description: 'Season 1 exclusive — Echo mirror-clone effect. Unlocked by completing Echoes arc.',
    rarity: 'legendary',
    icon: '🪞',
  },
  cain_elias: {
    id: 'cain_verdict_skin',
    characterId: 'cain_elias',
    name: 'Final Verdict Skin',
    type: 'skin',
    description: "Cain's post-Kennedy defection outfit. Unlocked by completing Final Verdict arc.",
    rarity: 'legendary',
    icon: '⚖️',
  },
};

// ── Bannon-canon story chapters per character ─────────────────────────────────
// Each character has a 5-chapter arc that intersects with Bannon's storyline,
// progressing like Tekken's character-specific story mode.
interface StoryChapter {
  id: number;
  title: string;
  narrative: string;
  opponent: string; // fighter id
  location: string;
  unlockCondition?: string;
}

interface CharacterStory {
  characterId: string;
  arcTitle: string;
  synopsis: string;
  chapters: StoryChapter[];
}

const CHARACTER_STORIES: CharacterStory[] = [
  // ── BANNON ────────────────────────────────────────────────────────────────
  {
    characterId: 'bannon',
    arcTitle: 'THE BEAST AWAKENS',
    synopsis:
      "Bannon was the most feared force in AWE — until Kennedy's corporate machine stripped him of everything. Betrayed, blacklisted, and broken, Bannon must fight his way back through the underground circuit, reclaim his identity, and dismantle the system that tried to erase him.",
    chapters: [
      {
        id: 1,
        title: 'UNDERGROUND RETURN',
        narrative:
          "Six months after Kennedy's hostile takeover of AWE, Bannon resurfaces in an underground fight circuit. No cameras, no contracts — just survival. His first opponent is Static, a chaos-faction brawler who fights for the thrill. Bannon must prove he still has the fire.",
        opponent: 'static',
        location: 'Underground Warehouse, East District',
      },
      {
        id: 2,
        title: 'OLD WOUNDS',
        narrative:
          "Cipher — once a trusted ally — has been feeding intelligence to Kennedy's corporate network. Bannon confronts him in a rain-soaked alley. Cipher claims he had no choice. Bannon doesn't accept that answer.",
        opponent: 'cipher',
        location: 'Rain District Back Alley',
      },
      {
        id: 3,
        title: 'THE ENFORCER',
        narrative:
          "Kennedy sends Cain Elias — his most trusted weapon — to permanently end Bannon's comeback. Cain is methodical, cold, and technically superior in every measurable way. This is the fight that will define whether Bannon's return is real or just nostalgia.",
        opponent: 'cain_elias',
        location: 'AWE Training Facility Rooftop',
      },
      {
        id: 4,
        title: 'LOYALTY TEST',
        narrative:
          "Maime has been protecting Bannon's back through the entire underground run. But Kennedy's operatives have compromised her handler. She arrives at the final checkpoint with orders to stand down — or fight Bannon herself. She chooses to fight. So does he.",
        opponent: 'maime',
        location: 'Urban Night Stage',
      },
      {
        id: 5,
        title: 'BEAST MODE',
        narrative:
          "The AWE championship is being held under Kennedy's banner. Bannon crashes it. Cody — Kennedy's paranoid enforcer — stands between Bannon and the main event. Bannon activates Beast Mode. The system will remember this night.",
        opponent: 'cody',
        location: 'AWE Championship Arena',
      },
    ],
  },

  // ── MAIME ─────────────────────────────────────────────────────────────────
  {
    characterId: 'maime',
    arcTitle: 'PRECISION PROTOCOL',
    synopsis:
      "Maime operates in the shadows of AWE's rebel faction, executing missions with surgical precision. When Kennedy's network begins targeting rebel fighters one by one, Maime must trace the leak back to its source — even if it leads to someone she trusts.",
    chapters: [
      {
        id: 1,
        title: 'FIRST CONTACT',
        narrative:
          "A corporate-aligned fighter named Hall Nighter has been systematically eliminating rebel-faction operatives. Maime intercepts him at a transit hub. She needs information. He's not giving it willingly.",
        opponent: 'hall_nighter',
        location: 'Transit Hub, South Gate',
      },
      {
        id: 2,
        title: 'THE CHAOS VARIABLE',
        narrative:
          "Static has gone rogue — no longer aligned with any faction, he's selling fight intelligence to the highest bidder. Maime tracks him to an underground circuit event. She needs to shut him down before he sells rebel coordinates.",
        opponent: 'static',
        location: 'Underground Circuit, Neon District',
      },
      {
        id: 3,
        title: 'MIRROR MATCH',
        narrative:
          "Echo — a psychological disruptor who mirrors fighting styles — has been deployed to neutralize Maime specifically. The fight is disorienting: Echo anticipates every technique. Maime must break pattern and improvise.",
        opponent: 'echo',
        location: 'Abandoned Warehouse',
      },
      {
        id: 4,
        title: 'THE LEAK',
        narrative:
          "The intelligence trail leads to Onyx — a power brawler who has been feeding rebel movement data to Kennedy in exchange for protection of his family. Maime understands his reasons. She fights him anyway. Some things can't be forgiven.",
        opponent: 'onyx',
        location: 'Dockyard, Night Shift',
      },
      {
        id: 5,
        title: 'PRECISION PROTOCOL ACTIVATED',
        narrative:
          "Cain Elias was the architect of the entire operation — using Onyx as a pawn to dismantle the rebel network from within. Maime confronts him at Kennedy's private training facility. This is the fight she was built for.",
        opponent: 'cain_elias',
        location: 'Kennedy Private Facility',
      },
    ],
  },

  // ── ONYX ──────────────────────────────────────────────────────────────────
  {
    characterId: 'onyx',
    arcTitle: 'IRON WILL',
    synopsis:
      "Onyx made a deal with Kennedy to protect his family — and it cost him everything else. Now the deal has been broken. Kennedy's network has moved against the people Onyx sacrificed his loyalty to protect. With nothing left to lose, Onyx goes to war.",
    chapters: [
      {
        id: 1,
        title: 'THE DEBT',
        narrative:
          "Stick-Up — Kennedy's optimized asset — arrives to collect on Onyx's contract. Onyx has missed a payment. The fight is a reminder of what happens when you owe Kennedy. Onyx refuses to be reminded.",
        opponent: 'stick_up',
        location: 'Corporate District Parking Structure',
      },
      {
        id: 2,
        title: 'COLLATERAL',
        narrative:
          "Hall Nighter has been assigned to monitor Onyx's movements and report any deviation. Onyx discovers the surveillance. He ends it personally.",
        opponent: 'hall_nighter',
        location: 'Industrial Zone, Night',
      },
      {
        id: 3,
        title: 'RECKONING',
        narrative:
          "Cody — Kennedy's paranoid fixer — confronts Onyx about the broken contract. Cody brings documentation, lawyers, and threats. Onyx brings his fists. The documentation doesn't survive the meeting.",
        opponent: 'cody',
        location: 'Hotel Lobby, Downtown',
      },
      {
        id: 4,
        title: 'UNEXPECTED ALLY',
        narrative:
          "Bannon finds Onyx mid-rampage and tries to redirect his anger. Onyx doesn't want redirection — he wants destruction. Bannon has to physically stop him before Onyx burns every bridge that could help him.",
        opponent: 'bannon',
        location: 'Urban Night Stage',
      },
      {
        id: 5,
        title: 'IRON WILL',
        narrative:
          "Cain Elias was the one who ordered the move against Onyx's family — using it as leverage to ensure compliance. Onyx has been building to this moment. Every fight, every sacrifice, every betrayal — it all ends here.",
        opponent: 'cain_elias',
        location: 'Kennedy Tower, Penthouse Level',
      },
    ],
  },

  // ── CIPHER ────────────────────────────────────────────────────────────────
  {
    characterId: 'cipher',
    arcTitle: 'SHADOW PROTOCOL',
    synopsis:
      "Cipher has been operating as a double agent — feeding intelligence to Kennedy's network while maintaining rebel faction cover. When both sides discover the deception simultaneously, Cipher must fight through enemies on every front to reach the one person who can clear his name: Bannon.",
    chapters: [
      {
        id: 1,
        title: 'BURNED',
        narrative:
          "Kennedy's network has identified Cipher as a liability. Stick-Up is dispatched to eliminate him. Cipher has thirty seconds of warning. He uses them well.",
        opponent: 'stick_up',
        location: 'Cipher Safe House, East Side',
      },
      {
        id: 2,
        title: 'REBEL JUSTICE',
        narrative:
          "The rebel faction has also learned of Cipher's double-agent status. Static — acting as rebel enforcer — intercepts Cipher at a neutral location. Cipher has to survive long enough to explain himself.",
        opponent: 'static',
        location: 'Neutral Zone, Underground',
      },
      {
        id: 3,
        title: 'THE ARCHITECT',
        narrative:
          "Cody holds the documentation that proves Cipher was working under rebel orders — not corporate ones. Cody won't release it. Cipher takes it.",
        opponent: 'cody',
        location: 'Corporate Archive Building',
      },
      {
        id: 4,
        title: 'MAIME\'S VERDICT',
        narrative:
          "Maime has been tracking Cipher since the rebel leak was discovered. She doesn't care about the documentation. She cares about the fighters who died because of compromised intel. Cipher has to face that.",
        opponent: 'maime',
        location: 'Rooftop, Rain District',
      },
      {
        id: 5,
        title: 'SHADOW PROTOCOL',
        narrative:
          "Bannon is the only one who can verify Cipher's original mission parameters. But Bannon is furious — the betrayal felt real regardless of the reason. Cipher must fight Bannon to earn the right to explain. If he wins, Bannon listens.",
        opponent: 'bannon',
        location: 'Urban Night Stage',
      },
    ],
  },

  // ── ECHO ──────────────────────────────────────────────────────────────────
  {
    characterId: 'echo',
    arcTitle: 'ECHO CHAMBER',
    synopsis:
      "Echo exists between factions — a psychological disruptor who has never committed to any side. When Kennedy's network begins using Echo's psychological profile as a template for a new generation of corporate fighters, Echo must destroy the program before it erases the original.",
    chapters: [
      {
        id: 1,
        title: 'THE COPY',
        narrative:
          "Kennedy's first prototype fighter — modeled on Echo's psychological profile — has been deployed in the underground circuit. Echo encounters it and realizes: Kennedy has been studying him for years. The copy fights like Echo. Echo fights better.",
        opponent: 'static',
        location: 'Underground Circuit',
      },
      {
        id: 2,
        title: 'HALL OF MIRRORS',
        narrative:
          "Hall Nighter is guarding the facility where Kennedy's psychological profiling data is stored. Echo needs that data destroyed. Hall Nighter is a wall. Echo finds the gap.",
        opponent: 'hall_nighter',
        location: 'Kennedy Data Facility',
      },
      {
        id: 3,
        title: 'CIPHER\'S GAME',
        narrative:
          "Cipher has been using Echo's psychological disruption techniques in his own operations — without permission. Echo confronts him. The fight is a clash of two fighters who both operate in shadows.",
        opponent: 'cipher',
        location: 'Abandoned Theater',
      },
      {
        id: 4,
        title: 'STICK-UP\'S PROTOCOL',
        narrative:
          "Stick-Up has been assigned to capture Echo alive — Kennedy wants the original, not just the profile. Echo has no intention of being studied. The fight is Echo's most dangerous yet: Stick-Up fights without hesitation or fear.",
        opponent: 'stick_up',
        location: 'Corporate Extraction Point',
      },
      {
        id: 5,
        title: 'ECHO SLAM',
        narrative:
          "Cain Elias personally oversaw the psychological profiling program. He believes he understands Echo completely — every pattern, every tendency, every weakness. Echo's entire fighting philosophy is built on being unpredictable. Cain is about to learn that.",
        opponent: 'cain_elias',
        location: 'Urban Night Stage',
      },
    ],
  },

  // ── CAIN ELIAS ────────────────────────────────────────────────────────────
  {
    characterId: 'cain_elias',
    arcTitle: 'FINAL VERDICT',
    synopsis:
      "Cain Elias has served Kennedy's corporate machine with absolute loyalty — executing every order with cold precision. But Kennedy's latest directive crosses a line even Cain cannot accept. For the first time, the enforcer must choose between the system and his own code.",
    chapters: [
      {
        id: 1,
        title: 'THE ORDER',
        narrative:
          "Kennedy's new directive: eliminate Bannon permanently, not just professionally. Cain has neutralized fighters before — but this is different. He stalls by taking on a preliminary assignment: silence Onyx before he can reach Kennedy.",
        opponent: 'onyx',
        location: 'Industrial Zone',
      },
      {
        id: 2,
        title: 'COLLATERAL DAMAGE',
        narrative:
          "Echo has been investigating Kennedy's psychological program — and is getting too close to information that implicates Cain directly. Cain is ordered to shut it down. He does. But the fight leaves him questioning what he's protecting.",
        opponent: 'echo',
        location: 'Kennedy Data Facility',
      },
      {
        id: 3,
        title: 'THE REBEL',
        narrative:
          "Maime intercepts Cain at a neutral location — she's been building a case against Kennedy's network and needs Cain's testimony. Cain refuses. They fight. Cain wins. But Maime's evidence stays with him.",
        opponent: 'maime',
        location: 'Neutral Zone',
      },
      {
        id: 4,
        title: 'CODY\'S LEVERAGE',
        narrative:
          "Cody has documentation that ties Cain to Kennedy's most illegal operations — and is threatening to use it as personal leverage. Cain doesn't negotiate with leverage. He removes it.",
        opponent: 'cody',
        location: 'Corporate Archive',
      },
      {
        id: 5,
        title: 'FINAL VERDICT',
        narrative:
          "Cain confronts Bannon — not to execute Kennedy's order, but to deliver his own verdict. He tells Bannon everything: the program, the profiling, the plan to permanently eliminate the rebel faction. Then he gives Bannon one fight to prove the rebels are worth protecting. If Bannon wins, Cain walks away from Kennedy forever.",
        opponent: 'bannon',
        location: 'Urban Night Stage',
      },
    ],
  },
];

// ── Rarity color map ─────────────────────────────────────────────────────────
export const RARITY_COLOR: Record<string, string> = {
  common: '#a1a1aa',
  rare: '#60a5fa',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

// ── Faction color map ─────────────────────────────────────────────────────────
const FACTION_COLOR: Record<string, string> = {
  alliance: '#1d4ed8',
  corporate: '#dc2626',
  chaos: '#7c3aed',
  independent: '#d97706',
};

// ── Chapter card ──────────────────────────────────────────────────────────────
function ChapterCard({
  chapter,
  index,
  isActive,
  isCompleted,
  isFinalBoss,
  onClick,
}: {
  chapter: StoryChapter;
  index: number;
  isActive: boolean;
  isCompleted: boolean;
  isFinalBoss?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left border transition-all duration-150 p-3 font-mono
        ${isActive ? 'border-yellow-500 bg-yellow-950/30' : isCompleted ? 'border-green-800 bg-green-950/20' : isFinalBoss ? 'border-red-900 bg-red-950/10 hover:border-red-700' : 'border-zinc-700 bg-zinc-900/40 hover:border-zinc-500'}
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 flex items-center justify-center text-xs font-black border shrink-0
          ${isCompleted ? 'border-green-500 text-green-400 bg-green-950' : isActive ? 'border-yellow-500 text-yellow-400 bg-yellow-950' : isFinalBoss ? 'border-red-700 text-red-500' : 'border-zinc-600 text-zinc-500'}`}>
          {isCompleted ? '✓' : isFinalBoss ? '⚔' : index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] font-black tracking-widest truncate ${isActive ? 'text-yellow-300' : isCompleted ? 'text-green-300' : isFinalBoss ? 'text-red-400' : 'text-zinc-300'}`}>
            {chapter.title}
          </div>
          <div className="text-[8px] text-zinc-500 tracking-wider truncate mt-0.5">{chapter.location}</div>
        </div>
      </div>
    </button>
  );
}

export default function StoryModeScreen({ onBack, onStartStoryBattle, onCosmeticUnlock }: StoryModeScreenProps) {
  const fighters = getAllBannonFighters();
  const [selectedCharId, setSelectedCharId] = useState<string>('bannon');
  const [selectedChapterIdx, setSelectedChapterIdx] = useState<number>(0);
  const [completedChapters, setCompletedChapters] = useState<Record<string, Set<number>>>({});
  const [unlockedCosmetics, setUnlockedCosmetics] = useState<CosmeticReward[]>([]);
  const [cosmeticBanner, setCosmeticBanner] = useState<CosmeticReward | null>(null);

  const story = CHARACTER_STORIES.find(s => s.characterId === selectedCharId);
  const selectedFighter = getBannonFighter(selectedCharId);
  const chapter = story?.chapters[selectedChapterIdx];
  const opponentFighter = chapter ? getBannonFighter(chapter.opponent) : null;

  const isChapterCompleted = (charId: string, chapterIdx: number) =>
    completedChapters[charId]?.has(chapterIdx) ?? false;

  // Called when player returns from a story battle win
  const handleMarkChapterComplete = (charId: string, chapterIdx: number) => {
    setCompletedChapters(prev => {
      const updated = { ...prev };
      if (!updated[charId]) updated[charId] = new Set();
      updated[charId] = new Set(updated[charId]);
      updated[charId].add(chapterIdx);
      return updated;
    });

    // Check if this was the final chapter (boss fight)
    const charStory = CHARACTER_STORIES.find(s => s.characterId === charId);
    if (charStory && chapterIdx === charStory.chapters.length - 1) {
      const reward = CHAPTER_COSMETICS[charId];
      if (reward && !unlockedCosmetics.find(c => c.id === reward.id)) {
        setUnlockedCosmetics(prev => [...prev, reward]);
        setCosmeticBanner(reward);
        setTimeout(() => setCosmeticBanner(null), 4500);
        onCosmeticUnlock?.(charId, reward);
      }
    }
  };

  const handleStartChapter = () => {
    if (!selectedFighter || !opponentFighter || !chapter) return;
    onStartStoryBattle(selectedFighter, opponentFighter, chapter.title);
    // Auto-mark complete after starting (simulate win for demo; real impl would check match result)
    setTimeout(() => handleMarkChapterComplete(selectedCharId, selectedChapterIdx), 100);
  };

  return (
    <div className="fixed inset-0 bg-[#08090d] text-white font-mono overflow-hidden flex flex-col">
      {/* ── Cosmetic unlock banner ── */}
      {cosmeticBanner && (
        <div
          className="absolute inset-x-4 top-16 z-50 border-2 p-4 text-center"
          style={{
            borderColor: RARITY_COLOR[cosmeticBanner.rarity],
            background: '#0a0a0aee',
            boxShadow: `0 0 30px ${RARITY_COLOR[cosmeticBanner.rarity]}55`,
          }}
        >
          <div className="text-2xl mb-1">{cosmeticBanner.icon}</div>
          <div
            className="text-[7px] tracking-[0.5em] mb-1"
            style={{ color: RARITY_COLOR[cosmeticBanner.rarity] }}
          >
            {cosmeticBanner.rarity.toUpperCase()} · {cosmeticBanner.type.toUpperCase()} UNLOCKED
          </div>
          <div className="text-base font-black tracking-widest text-white">{cosmeticBanner.name}</div>
          <div className="text-[8px] text-zinc-400 mt-1 leading-relaxed">{cosmeticBanner.description}</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-zinc-800 shrink-0">
        <button
          onClick={onBack}
          className="text-[9px] tracking-widest text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 transition-colors"
        >
          ← BACK
        </button>
        <div className="text-center">
          <div className="text-[8px] tracking-[0.5em] text-zinc-600">BRUTAL FIST</div>
          <div className="text-lg font-black tracking-[0.3em] text-yellow-400">STORY MODE</div>
        </div>
        <div className="text-right">
          {unlockedCosmetics.length > 0 && (
            <div className="text-[7px] tracking-widest text-yellow-600">
              {unlockedCosmetics.length} COSMETIC{unlockedCosmetics.length > 1 ? 'S' : ''} UNLOCKED
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Character roster sidebar ── */}
        <div className="w-28 md:w-36 border-r border-zinc-800 overflow-y-auto shrink-0">
          <div className="p-2 text-[7px] tracking-[0.4em] text-zinc-600 border-b border-zinc-800">SELECT</div>
          {fighters.map(f => {
            const hasStory = CHARACTER_STORIES.some(s => s.characterId === f.id);
            if (!hasStory) return null;
            const fColor = FACTION_COLOR[f.factionAlignment] ?? '#facc15';
            const isSelected = f.id === selectedCharId;
            const storyData = CHARACTER_STORIES.find(s => s.characterId === f.id);
            const completedCount = completedChapters[f.id]?.size ?? 0;
            const totalChapters = storyData?.chapters.length ?? 0;
            const arcComplete = completedCount === totalChapters && totalChapters > 0;
            const hasCosmetic = unlockedCosmetics.some(c => c.characterId === f.id);
            return (
              <button
                key={f.id}
                onClick={() => { setSelectedCharId(f.id); setSelectedChapterIdx(0); }}
                className={`w-full text-left px-2 py-2.5 border-b border-zinc-800/50 transition-all
                  ${isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}
                style={{ borderLeft: isSelected ? `3px solid ${fColor}` : '3px solid transparent' }}
              >
                <div className="flex items-center gap-1">
                  <div className="text-[9px] font-black tracking-wider truncate flex-1" style={{ color: isSelected ? fColor : '#a1a1aa' }}>
                    {f.name.toUpperCase()}
                  </div>
                  {hasCosmetic && <span className="text-[8px]">✨</span>}
                </div>
                <div className="text-[7px] text-zinc-600 mt-0.5">
                  {completedCount}/{totalChapters} CH{arcComplete ? ' ✓' : ''}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {story && selectedFighter ? (
            <>
              {/* Arc header */}
              <div className="px-4 py-3 border-b border-zinc-800 shrink-0"
                style={{ background: `linear-gradient(135deg, ${FACTION_COLOR[selectedFighter.factionAlignment]}15 0%, transparent 60%)` }}>
                <div className="text-[8px] tracking-[0.4em] text-zinc-500">{selectedFighter.name.toUpperCase()} — CHARACTER ARC</div>
                <div className="text-base font-black tracking-widest mt-0.5"
                  style={{ color: FACTION_COLOR[selectedFighter.factionAlignment] }}>
                  {story.arcTitle}
                </div>
                <div className="text-[9px] text-zinc-400 mt-1.5 leading-relaxed line-clamp-2">{story.synopsis}</div>

                {/* Cosmetic reward preview */}
                {CHAPTER_COSMETICS[selectedCharId] && (
                  <div className="mt-2 flex items-center gap-2 border border-zinc-800 bg-zinc-900/40 px-2 py-1.5">
                    <span className="text-sm">{CHAPTER_COSMETICS[selectedCharId].icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[7px] tracking-[0.3em] text-zinc-600">ARC COMPLETION REWARD</div>
                      <div
                        className="text-[9px] font-black tracking-wider truncate"
                        style={{ color: RARITY_COLOR[CHAPTER_COSMETICS[selectedCharId].rarity] }}
                      >
                        {CHAPTER_COSMETICS[selectedCharId].name}
                      </div>
                    </div>
                    {unlockedCosmetics.some(c => c.characterId === selectedCharId) ? (
                      <span className="text-[7px] text-green-400 shrink-0">✓ UNLOCKED</span>
                    ) : (
                      <span className="text-[7px] text-zinc-700 shrink-0">LOCKED</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Chapter list */}
                <div className="w-44 md:w-52 border-r border-zinc-800 overflow-y-auto shrink-0 p-2 space-y-1">
                  {story.chapters.map((ch, idx) => (
                    <ChapterCard
                      key={ch.id}
                      chapter={ch}
                      index={idx}
                      isActive={idx === selectedChapterIdx}
                      isCompleted={isChapterCompleted(selectedCharId, idx)}
                      isFinalBoss={idx === story.chapters.length - 1}
                      onClick={() => setSelectedChapterIdx(idx)}
                    />
                  ))}
                </div>

                {/* Chapter detail */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  {chapter && opponentFighter ? (
                    <>
                      {/* Chapter title */}
                      <div>
                        <div className="text-[8px] tracking-[0.5em] text-zinc-600">
                          CHAPTER {selectedChapterIdx + 1} OF {story.chapters.length}
                          {selectedChapterIdx === story.chapters.length - 1 && (
                            <span className="ml-2 text-red-500">⚔ FINAL BOSS</span>
                          )}
                        </div>
                        <div className="text-xl font-black tracking-widest text-white mt-1">{chapter.title}</div>
                        <div className="text-[8px] tracking-wider text-zinc-500 mt-0.5">📍 {chapter.location}</div>
                      </div>

                      {/* Narrative */}
                      <div className="border border-zinc-800 bg-zinc-900/40 p-3">
                        <div className="text-[8px] tracking-[0.4em] text-zinc-600 mb-2">STORY</div>
                        <p className="text-[10px] text-zinc-300 leading-relaxed">{chapter.narrative}</p>
                      </div>

                      {/* VS matchup */}
                      <div className="border border-zinc-700 bg-zinc-900/60 p-3">
                        <div className="text-[8px] tracking-[0.4em] text-zinc-600 mb-3">MATCHUP</div>
                        <div className="flex items-center justify-between gap-3">
                          {/* P1 */}
                          <div className="flex-1 text-center">
                            <div className="text-[8px] tracking-widest text-zinc-500">YOU</div>
                            <div className="text-sm font-black tracking-wider mt-1"
                              style={{ color: FACTION_COLOR[selectedFighter.factionAlignment] }}>
                              {selectedFighter.name.toUpperCase()}
                            </div>
                            <div className="text-[7px] text-zinc-600 mt-0.5">{selectedFighter.fightingStyle.split('.')[0]}</div>
                          </div>
                          {/* VS */}
                          <div className="text-2xl font-black text-yellow-400 shrink-0">VS</div>
                          {/* P2 */}
                          <div className="flex-1 text-center">
                            <div className="text-[8px] tracking-widest text-zinc-500">
                              {selectedChapterIdx === story.chapters.length - 1 ? '⚔ FINAL BOSS' : 'OPPONENT'}
                            </div>
                            <div className="text-sm font-black tracking-wider mt-1"
                              style={{ color: FACTION_COLOR[opponentFighter.factionAlignment] }}>
                              {opponentFighter.name.toUpperCase()}
                            </div>
                            <div className="text-[7px] text-zinc-600 mt-0.5">{opponentFighter.fightingStyle.split('.')[0]}</div>
                          </div>
                        </div>
                      </div>

                      {/* Final boss cosmetic hint */}
                      {selectedChapterIdx === story.chapters.length - 1 && CHAPTER_COSMETICS[selectedCharId] && (
                        <div
                          className="border p-3 text-center"
                          style={{
                            borderColor: RARITY_COLOR[CHAPTER_COSMETICS[selectedCharId].rarity],
                            background: `${RARITY_COLOR[CHAPTER_COSMETICS[selectedCharId].rarity]}11`,
                          }}
                        >
                          <div className="text-xl mb-1">{CHAPTER_COSMETICS[selectedCharId].icon}</div>
                          <div
                            className="text-[7px] tracking-[0.4em]"
                            style={{ color: RARITY_COLOR[CHAPTER_COSMETICS[selectedCharId].rarity] }}
                          >
                            DEFEAT THE FINAL BOSS TO UNLOCK
                          </div>
                          <div className="text-[10px] font-black tracking-wider text-white mt-1">
                            {CHAPTER_COSMETICS[selectedCharId].name}
                          </div>
                        </div>
                      )}

                      {/* Start button */}
                      <button
                        onClick={handleStartChapter}
                        className="w-full border-2 border-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 font-black tracking-[0.3em] py-4 text-sm transition-all active:scale-95"
                      >
                        ▶ START CHAPTER {selectedChapterIdx + 1}
                      </button>

                      {isChapterCompleted(selectedCharId, selectedChapterIdx) && (
                        <div className="text-center text-[9px] tracking-widest text-green-400">
                          ✓ CHAPTER COMPLETED
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs tracking-widest">
                      SELECT A CHAPTER
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs tracking-widest">
              SELECT A CHARACTER
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
