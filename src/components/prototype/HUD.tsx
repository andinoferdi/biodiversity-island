"use client";

import { useEffect, useRef, useState } from "react";
import { type TimeScale, CRITICAL_LEVEL, NEED_MAX, liveAnimals } from "./simulation";
import { SPECIES_BY_ID, getSpecies, type AnimalSpawn } from "./species";
import { type GraphicQuality } from "./IslandScene";

// Web Audio API Synthesizer for tactile feedback
function playSound(type: "click" | "hover" | "alarm" | "success") {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === "click") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === "hover") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.006, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.02);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.02);
    } else if (type === "alarm") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(260, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === "success") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.setValueAtTime(900, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {
    // blocked or not supported
  }
}

// Grounded T-Rex Skull Circle Logo
function JurassicParkLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 100 100" fill="none" className="text-yellow-500 shrink-0">
      <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="41" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
      {/* T-Rex silhouette */}
      <path
        d="M38 32 C38 32, 58 29, 65 33 C72 37, 74 43, 74 49 C74 52, 69 53, 69 53 L76 58 C76 58, 73 63, 64 63 C58 63, 55 60, 52 59 L52 64 L46 64 L46 58 C41 58, 36 54, 34 49 C32 44, 34 40, 38 32 Z M50 40 C48 40, 47 42, 48 43 C49 44, 51 43, 50 40 Z"
        fill="currentColor"
        className="opacity-90"
      />
      <line x1="14" y1="52" x2="86" y2="52" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

// Hazard Yellow/Black Stripes Accent
function HazardStripes() {
  return (
    <div 
      className="h-1.5 w-full"
      style={{
        backgroundImage: "repeating-linear-gradient(45deg, #f2bf30, #f2bf30 6px, #1a1f26 6px, #1a1f26 12px)"
      }}
    />
  );
}

const SPECIES_BIO_METADATA: Record<string, {
  scientificName: string;
  classification: "Carnivore" | "Herbivore";
  threatLevel: "Minimal" | "Low" | "Moderate" | "High";
  icon: string;
  enclosureRequirements: string;
}> = {
  deer: {
    scientificName: "Cervus Megaloceros",
    classification: "Herbivore",
    threatLevel: "Minimal",
    icon: "🦌",
    enclosureRequirements: "Standard Forest Fencing",
  },
  wolf: {
    scientificName: "Canis Lycaon Prime",
    classification: "Carnivore",
    threatLevel: "High",
    icon: "🐺",
    enclosureRequirements: "Heavy Steel Enclosure // Level 2 Containment",
  },
  hawk: {
    scientificName: "Pterodactylus Dimorphodon",
    classification: "Carnivore",
    threatLevel: "Moderate",
    icon: "🦅",
    enclosureRequirements: "Aviary Mesh Grid // Level 1 Containment",
  },
  horse: {
    scientificName: "Equus Ferus Prehistorica",
    classification: "Herbivore",
    threatLevel: "Low",
    icon: "🐎",
    enclosureRequirements: "Open Grassland Fencing",
  },
  duck: {
    scientificName: "Anatosuchus Minor",
    classification: "Herbivore",
    threatLevel: "Minimal",
    icon: "🦆",
    enclosureRequirements: "Waterbank Terrarium",
  },
  rabbit: {
    scientificName: "Microceratus Minimus",
    classification: "Herbivore",
    threatLevel: "Minimal",
    icon: "🐇",
    enclosureRequirements: "Low Concrete Barriers",
  },
  fish: {
    scientificName: "Coelacanth Vorax",
    classification: "Herbivore",
    threatLevel: "Minimal",
    icon: "🐟",
    enclosureRequirements: "River Containment Grate",
  },
};

// Isolated sub-component to ensure coordinate updates only trigger local re-renders
function RadarMap({
  population,
  selectedId,
  setSelectedId,
}: {
  population: AnimalSpawn[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}) {
  const [positions, setPositions] = useState<Record<string, { x: number; z: number }>>({});

  useEffect(() => {
    const updatePositions = () => {
      const nextPositions: Record<string, { x: number; z: number }> = {};
      liveAnimals.forEach((val, key) => {
        nextPositions[key] = { x: val.x, z: val.z };
      });
      setPositions(nextPositions);
    };

    updatePositions();
    // Poll every 1000ms (1 fps) for real-time smoothness with near-zero overhead
    const interval = setInterval(updatePositions, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-56 h-56 rounded-full border border-slate-700 relative overflow-hidden bg-slate-950 flex items-center justify-center">
      {/* Rotating Sweeper Line */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          background: 'conic-gradient(from 0deg at 50% 50%, rgba(242, 191, 48, 0.08) 0deg, rgba(242, 191, 48, 0) 90deg)',
          animation: 'radar-sweep 6s linear infinite',
          borderRadius: '50%'
        }}
      />
      
      {/* Grid layout */}
      <div className="absolute inset-0 border border-slate-800/60 rounded-full scale-[0.75] pointer-events-none" />
      <div className="absolute inset-0 border border-slate-800/60 rounded-full scale-[0.5] pointer-events-none" />
      <div className="absolute top-0 bottom-0 left-[50%] w-px bg-slate-800/60 pointer-events-none" />
      <div className="absolute left-0 right-0 top-[50%] h-px bg-slate-800/60 pointer-events-none" />

      {/* Real-time Blips mapped directly to active coordinate state */}
      {population.map((spawn) => {
        const meta = SPECIES_BIO_METADATA[spawn.speciesId];
        const isCarnivore = meta && meta.classification === "Carnivore";
        const isSelected = selectedId === spawn.id;
        
        const pos = positions[spawn.id] || { x: spawn.x, z: spawn.z };
        const scaleFactor = 16.5; 
        const left = 112 + (pos.x * scaleFactor);
        const top = 112 + (pos.z * scaleFactor);

        return (
          <button
            key={spawn.id}
            onClick={() => {
              setSelectedId(spawn.id);
              playSound("click");
            }}
            onMouseEnter={() => playSound("hover")}
            className={`absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer z-30 group ${
              isCarnivore 
                ? "bg-red-500 shadow-[0_0_6px_#ef4444] border border-red-200" 
                : "bg-yellow-500 shadow-[0_0_6px_#f2bf30] border border-yellow-200"
            } ${isSelected ? "ring-2 ring-white animate-pulse scale-125" : "hover:scale-150"}`}
            style={{
              left: `${left}px`,
              top: `${top}px`,
            }}
            title={spawn.label}
          >
            {isSelected && (
              <span className="absolute -inset-2 border border-white rounded-full animate-ping pointer-events-none" />
            )}
            <span className="absolute left-3.5 top-0 hidden group-hover:block bg-slate-900 border border-slate-700 text-slate-200 text-[8px] font-mono py-0.5 px-1 rounded whitespace-nowrap z-50">
              {spawn.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function HUD({
  selectedId,
  setSelectedId,
  timeScale,
  setTimeScale,
  graphicQuality,
  setGraphicQuality,
  isRaining,
  setIsRaining,
  isCloudy,
  setIsCloudy,
  isFoggy,
  setIsFoggy,
  isPOV,
  setIsPOV,
  vitals,
  population,
}: {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  timeScale: TimeScale;
  setTimeScale: (v: TimeScale) => void;
  graphicQuality: GraphicQuality;
  setGraphicQuality: (v: GraphicQuality) => void;
  isRaining: boolean;
  setIsRaining: (v: boolean) => void;
  isCloudy: boolean;
  setIsCloudy: (v: boolean) => void;
  isFoggy: boolean;
  setIsFoggy: (v: boolean) => void;
  isPOV: boolean;
  setIsPOV: (v: boolean) => void;
  vitals: { x: number; z: number; hunger: number; thirst: number; status: string; biome: string };
  population: AnimalSpawn[];
}) {
  const selectedSpawn = selectedId ? population.find((s) => s.id === selectedId) : undefined;
  const selectedSpecies = selectedSpawn ? getSpecies(selectedSpawn.speciesId) : undefined;
  const bioMeta = selectedSpawn ? SPECIES_BIO_METADATA[selectedSpawn.speciesId] : undefined;

  const [activeTab, setActiveTab] = useState<"map" | "species" | "controls">("map");
  const [isHudVisible, setIsHudVisible] = useState(true);

  // Filter count
  const carnivoresCount = population.filter(s => {
    const m = SPECIES_BIO_METADATA[s.speciesId];
    return m && m.classification === "Carnivore";
  }).length;

  const hasCriticallyHungry = selectedId && (vitals.hunger >= CRITICAL_LEVEL || vitals.thirst >= CRITICAL_LEVEL);
  const isHuntingState = selectedId && (vitals.status === "Hunting" || vitals.status === "Fleeing");
  const isUnderThreat = hasCriticallyHungry || isHuntingState;

  // Sound alarm beep when threat is active
  useEffect(() => {
    if (!isUnderThreat) return;
    const interval = setInterval(() => {
      playSound("alarm");
    }, 2200);
    return () => clearInterval(interval);
  }, [isUnderThreat]);

  if (!isHudVisible) {
    return (
      <button
        type="button"
        onClick={() => {
          playSound("click");
          setIsHudVisible(true);
        }}
        className="absolute left-6 top-6 z-30 flex items-center gap-2 border border-yellow-500/40 bg-[#161a22]/90 hover:bg-[#1a212e] text-yellow-500 hover:text-yellow-400 px-3 py-1.5 rounded font-orbitron font-bold text-[9px] tracking-widest shadow-lg transition-all duration-150"
      >
        👁️ RESTORE TAC-HUD CONSOLE
      </button>
    );
  }

  return (
    <>
      <style>{`
        @keyframes radar-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .font-orbitron {
          font-family: var(--font-orbitron), monospace;
        }
        .font-rajdhani {
          font-family: var(--font-rajdhani), sans-serif;
        }
      `}</style>

      {/* TOP CONTROL DECK HEADER */}
      <div className="absolute left-0 right-0 top-0 z-20 flex h-14 items-center justify-between border-b border-yellow-600/30 bg-[#161a22] px-6 font-rajdhani shadow-lg">
        {/* Left Brand Area */}
        <div className="flex items-center gap-3">
          <JurassicParkLogo />
          <div className="flex flex-col">
            <span className="font-orbitron text-xs font-bold uppercase tracking-[0.2em] text-yellow-500">
              BIODIVERSITY ISLAND
            </span>
            <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
              Tactical containment & monitoring console
            </span>
          </div>
        </div>

        {/* Center Warning State */}
        <div className="flex items-center justify-center">
          {isUnderThreat ? (
            <div className="flex items-center gap-2.5 px-6 py-1 border border-red-600 bg-red-950/90 text-red-200 font-orbitron text-[10px] font-bold tracking-widest rounded animate-pulse">
              <span>⚠️ CONTAINER ALERT:</span>
              <span className="uppercase text-[9px]">
                {isHuntingState 
                  ? "ACTIVE ASSET CHASE IN PROGRESS" 
                  : "CRITICAL VITALS DETECTED"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-1 border border-emerald-800/40 bg-emerald-950/30 text-emerald-400 font-mono text-[9px] tracking-wider uppercase rounded">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>ALL SECTORS SECURE</span>
            </div>
          )}
        </div>

        {/* Right Info */}
        <div className="flex items-center gap-5 text-right text-slate-400 text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-500 uppercase tracking-wider">TOTAL ASSETS</span>
            <span className="text-yellow-500 font-bold text-xs">{population.length} units</span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-500 uppercase tracking-wider">CONTAINMENT STATE</span>
            <span className="text-emerald-400 font-bold text-xs uppercase">ONLINE</span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <button
            type="button"
            onClick={() => {
              playSound("click");
              setIsHudVisible(false);
            }}
            className="border border-yellow-500/30 hover:border-yellow-400 bg-yellow-950/10 hover:bg-yellow-500/10 text-yellow-500 hover:text-yellow-400 px-2 py-1 rounded text-[8.5px] font-mono tracking-widest uppercase transition-all duration-150"
          >
            ❌ HIDE HUD
          </button>
        </div>
      </div>

      {/* OPERATIONS CONTROL WORKSPACE (LEFT PANEL) */}
      <div className="absolute left-6 top-[72px] bottom-6 z-20 w-80 flex flex-col font-rajdhani">
        
        {/* Navigation Tabs */}
        <div className="flex bg-[#161a22] border-t border-x border-slate-700/60 rounded-t overflow-hidden">
          {(["map", "species", "controls"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                playSound("click");
                setActiveTab(tab);
              }}
              onMouseEnter={() => playSound("hover")}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-150 border-b-2 ${
                activeTab === tab
                  ? "bg-[#1f2633] text-yellow-500 border-yellow-500"
                  : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-white/5"
              }`}
            >
              {tab === "map" && "GPS MAP"}
              {tab === "species" && "SPECIES INDEX"}
              {tab === "controls" && "CONTROLS"}
            </button>
          ))}
        </div>

        {/* Panel Container */}
        <div className="flex-1 bg-[#161a22]/95 border-x border-b border-slate-700/60 p-4 flex flex-col overflow-hidden shadow-2xl">
          
          {/* TAB 1: RADAR / MAP LOCATOR */}
          {activeTab === "map" && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Radar Circle */}
              <div className="flex flex-col items-center mb-3">
                <span className="text-[8px] text-slate-500 uppercase tracking-wider mb-2 self-start font-mono">
                  GPS UNIT SECTOR COORDINATES (ISLA NUBLAR)
                </span>
                
                <RadarMap
                  population={population}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                />
              </div>

              {/* Asset list */}
              <div className="flex-1 flex flex-col min-h-0 border-t border-slate-800 pt-3">
                <div className="text-[8px] text-slate-500 uppercase tracking-wider mb-2 flex justify-between font-mono">
                  <span>ACTIVE BIO-UNITS INDEX</span>
                  <span className="text-red-400 font-bold">CARNIVORES: {carnivoresCount}</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-108">
                  {population.map((spawn) => {
                    const meta = SPECIES_BIO_METADATA[spawn.speciesId];
                    const isSelected = selectedId === spawn.id;
                    const isCarnivore = meta && meta.classification === "Carnivore";
                    
                    return (
                      <div
                        key={spawn.id}
                        onClick={() => {
                          setSelectedId(spawn.id);
                          playSound("click");
                        }}
                        className={`flex items-center justify-between p-2 border cursor-pointer transition-all duration-150 rounded ${
                          isSelected
                            ? "bg-slate-800 border-yellow-500/70 text-slate-100"
                            : "bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[11px]">{meta?.icon ?? "🧬"}</span>
                          <div className="flex flex-col">
                            <span className="font-orbitron text-[9px] font-bold tracking-wider">
                              {spawn.label.toUpperCase()}
                            </span>
                            <span className="text-[8px] opacity-60">
                              {meta?.scientificName || "Prehistoric Specimen"}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[7px] px-1 py-0.5 rounded font-mono font-bold ${
                          isCarnivore 
                            ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                            : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                        }`}>
                          {isCarnivore ? "CARNIVORE" : "HERBIVORE"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SPECIES INDEX */}
          {activeTab === "species" && (
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              <span className="text-[8px] text-slate-500 uppercase tracking-wider block font-mono border-b border-slate-800 pb-1.5">
                DATABASE TAXONOMY CATALOG
              </span>

              {Object.entries(SPECIES_BIO_METADATA).map(([key, item]) => {
                const spec = SPECIES_BY_ID.get(key);
                return (
                  <div key={key} className="bg-slate-900/60 border border-slate-800 p-2.5 rounded">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{item.icon}</span>
                        <div>
                          <h4 className="font-orbitron text-[10px] font-bold text-slate-200 tracking-wider">
                            {key.toUpperCase()}
                          </h4>
                          <p className="text-[8px] italic text-yellow-500">{item.scientificName}</p>
                        </div>
                      </div>
                      <span className={`text-[7.5px] font-bold uppercase ${
                        item.classification === "Carnivore" ? "text-red-400" : "text-yellow-500"
                      }`}>
                        {item.classification}
                      </span>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-2.5 text-[8.5px] border-t border-slate-800/40 pt-2 text-slate-400">
                      <div>
                        <dt className="text-slate-500 uppercase text-[7px] font-mono">ENCLOSURE REQ</dt>
                        <dd className="font-medium text-slate-300 mt-0.5">{item.enclosureRequirements}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 uppercase text-[7px] font-mono">BASE THREAT LEVEL</dt>
                        <dd className="font-semibold text-slate-300 mt-0.5 uppercase">{item.threatLevel}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 uppercase text-[7px] font-mono">HABITAT</dt>
                        <dd className="font-medium text-slate-300 mt-0.5 uppercase">{spec?.habitat || "N/A"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 uppercase text-[7px] font-mono">DIET SPECS</dt>
                        <dd className="font-medium text-slate-300 mt-0.5 uppercase">{spec?.diet || "N/A"}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: CLIMATE & SPEED CONTROLS */}
          {activeTab === "controls" && (
            <div className="flex-1 space-y-4">
              <span className="text-[8px] text-slate-500 uppercase tracking-wider block font-mono border-b border-slate-800 pb-1.5">
                ISLAND CLIMATE AND ENGINE SETTINGS
              </span>

              {/* Speed controls */}
              <div className="space-y-1.5">
                <span className="text-[8.5px] uppercase tracking-wider text-slate-400 font-mono">ENGINE SIM TIME</span>
                <div className="flex border border-slate-700 bg-black/40 overflow-hidden rounded">
                  {([
                    { scale: 0 as TimeScale, label: "PAUSED" },
                    { scale: 1 as TimeScale, label: "1X RATE" },
                    { scale: 4 as TimeScale, label: "4X RUN" },
                  ]).map((opt) => {
                    const active = timeScale === opt.scale;
                    return (
                      <button
                        key={opt.scale}
                        onClick={() => {
                          playSound("click");
                          setTimeScale(opt.scale);
                        }}
                        className={`flex-1 py-1.5 text-[8px] font-orbitron font-bold transition-all duration-150 tracking-wider ${
                          active
                            ? "bg-[#1f2633] text-yellow-500 border-b border-yellow-500 font-bold"
                            : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Render controls */}
              <div className="space-y-1.5">
                <span className="text-[8.5px] uppercase tracking-wider text-slate-400 font-mono">RENDER RESOLUTION</span>
                <div className="flex border border-slate-700 bg-black/40 overflow-hidden rounded">
                  {([
                    { quality: "low" as GraphicQuality, label: "LOW RESOLUTION" },
                    { quality: "medium" as GraphicQuality, label: "STANDARD" },
                    { quality: "high" as GraphicQuality, label: "TACTICAL HD" },
                  ]).map((opt) => {
                    const active = graphicQuality === opt.quality;
                    return (
                      <button
                        key={opt.quality}
                        onClick={() => {
                          playSound("click");
                          setGraphicQuality(opt.quality);
                        }}
                        className={`flex-1 py-1.5 text-[8px] font-orbitron font-bold transition-all duration-150 tracking-wider ${
                          active
                            ? "bg-[#1f2633] text-yellow-500 border-b border-yellow-500 font-bold"
                            : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Climate triggers */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[8.5px] uppercase tracking-wider text-slate-400 font-mono">ENVIRONMENTAL TRIGGERS</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { active: isRaining, toggle: () => setIsRaining(!isRaining), label: "RAIN SYSTEM", icon: "🌧️" },
                    { active: isCloudy, toggle: () => setIsCloudy(!isCloudy), label: "CLOUDS", icon: "☁️" },
                    { active: isFoggy, toggle: () => setIsFoggy(!isFoggy), label: "FOG BANK", icon: "🌫️" },
                  ].map(({ active, toggle, label, icon }) => (
                    <button
                      key={label}
                      onClick={() => {
                        playSound("click");
                        toggle();
                      }}
                      className={`flex flex-col items-center justify-center gap-1 border p-2 text-[8px] font-mono transition-all duration-150 rounded ${
                        active
                          ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                          : "border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                      }`}
                    >
                      <span className="text-xs">{icon}</span>
                      <span className="uppercase tracking-wider font-bold text-[7.5px]">{label}</span>
                      <div
                        className={`h-1.5 w-1.5 rounded-full mt-1 ${
                          active ? "bg-yellow-400 shadow-[0_0_6px_rgba(242,191,48,0.6)]" : "bg-slate-800"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SELECTED ASSET TELEMETRY (RIGHT DOSSIER PANEL) */}
      {selectedSpawn && selectedSpecies && bioMeta && (
        <div className="absolute right-6 top-[72px] bottom-6 z-20 w-80 flex flex-col font-rajdhani">
          
          {/* Header Tab */}
          <div className="bg-[#161a22] border-t border-x border-slate-700/60 rounded-t overflow-hidden">
            <div className="bg-slate-800/80 px-4 py-2 flex items-center justify-between border-b border-slate-700/40">
              <span className="font-orbitron text-[9px] font-bold uppercase tracking-wider text-slate-200">
                ASSET ENCLOSURE STATUS // {selectedSpawn.id.toUpperCase()}
              </span>
              <span className={`font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 border ${
                isUnderThreat
                  ? "border-red-500/40 text-red-400 bg-red-950/30 animate-pulse"
                  : "border-yellow-500/30 text-yellow-500 bg-yellow-950/20"
              }`}>
                {vitals.status.toUpperCase()}
              </span>
            </div>
            <HazardStripes />
          </div>

          {/* Dossier Body */}
          <div className="flex-1 bg-[#161a22]/95 border-x border-b border-slate-700/60 p-4 flex flex-col justify-between overflow-y-auto shadow-2xl">
            
            <div className="space-y-4">
              {/* Species Bio Card */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl bg-slate-900 border border-slate-800 p-1.5 rounded">
                    {bioMeta.icon}
                  </span>
                  <div>
                    <h2 className="font-orbitron text-xs font-black tracking-wider text-slate-100">
                      {selectedSpecies.name.toUpperCase()}
                    </h2>
                    <p className="text-[9px] italic text-yellow-500 font-mono">
                      {bioMeta.scientificName}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[7px] text-slate-500 uppercase tracking-wider font-mono">THREAT</span>
                  <span className={`font-orbitron text-[9.5px] font-bold uppercase tracking-wider ${
                    bioMeta.threatLevel === "High" 
                      ? "text-red-500" 
                      : bioMeta.threatLevel === "Moderate"
                      ? "text-yellow-600"
                      : "text-emerald-400"
                  }`}>
                    {bioMeta.threatLevel}
                  </span>
                </div>
              </div>

              {/* Technical specs grid */}
              <div className="bg-slate-900/40 border border-slate-800/60 p-3 rounded space-y-3 font-mono">
                <dl className="grid grid-cols-2 gap-x-2 gap-y-2.5 text-[9.5px]">
                  <div>
                    <dt className="text-slate-500 uppercase text-[7px]">CURRENT BIOME</dt>
                    <dd className="font-bold text-slate-200 mt-0.5">{vitals.biome.toUpperCase()}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 uppercase text-[7px]">GPS COORDINATES</dt>
                    <dd className="font-bold text-slate-200 mt-0.5">X: {Math.round(vitals.x)}, Z: {Math.round(vitals.z)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 uppercase text-[7px]">CLASSIFICATION</dt>
                    <dd className="font-bold text-slate-200 mt-0.5 uppercase">{bioMeta.classification}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 uppercase text-[7px]">DIET REQUIREMENT</dt>
                    <dd className="font-bold text-slate-200 mt-0.5 uppercase text-[9px]">{selectedSpecies.diet}</dd>
                  </div>
                  {selectedSpecies.predatorOf && (
                    <div className="col-span-2">
                      <dt className="text-slate-500 uppercase text-[7px]">PREDATION TARGETS</dt>
                      <dd className="font-bold text-red-400 mt-0.5 uppercase text-[8.5px]">
                        {selectedSpecies.predatorOf
                          .map((id) => SPECIES_BY_ID.get(id)?.name ?? id)
                          .join(", ")}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Vitals Progress Bars */}
              <div className="space-y-3.5 pt-2">
                
                {/* Hunger Need */}
                <div>
                  <div className="flex justify-between text-[9px] font-mono font-bold">
                    <span className="text-slate-400 uppercase tracking-wider">DIETARY CALORIES NEED</span>
                    <span className={vitals.hunger >= CRITICAL_LEVEL ? "text-red-500 animate-pulse font-bold" : "text-yellow-500"}>
                      {Math.round(vitals.hunger)}%
                    </span>
                  </div>
                  <div className="relative mt-1 h-3 w-full bg-slate-950 border border-slate-800 rounded-sm overflow-hidden p-[1px]">
                    <div
                      className={`h-full transition-all duration-300 ${
                        vitals.hunger >= CRITICAL_LEVEL 
                          ? "bg-red-600 shadow-[0_0_6px_#ef4444]" 
                          : "bg-yellow-500"
                      }`}
                      style={{ width: `${(vitals.hunger / NEED_MAX) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Thirst Need */}
                <div>
                  <div className="flex justify-between text-[9px] font-mono font-bold">
                    <span className="text-slate-400 uppercase tracking-wider">LIQUID DEHYDRATION RATIO</span>
                    <span className={vitals.thirst >= CRITICAL_LEVEL ? "text-red-500 animate-pulse font-bold" : "text-yellow-500"}>
                      {Math.round(vitals.thirst)}%
                    </span>
                  </div>
                  <div className="relative mt-1 h-3 w-full bg-slate-950 border border-slate-800 rounded-sm overflow-hidden p-[1px]">
                    <div
                      className={`h-full transition-all duration-300 ${
                        vitals.thirst >= CRITICAL_LEVEL 
                          ? "bg-red-600 shadow-[0_0_6px_#ef4444]" 
                          : "bg-yellow-500"
                      }`}
                      style={{ width: `${(vitals.thirst / NEED_MAX) * 100}%` }}
                    />
                  </div>
                </div>

              </div>

            </div>

            {/* Action buttons */}
            <div className="mt-6 space-y-2 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => {
                  playSound("click");
                  setIsPOV(!isPOV);
                }}
                className={`w-full py-2 rounded font-orbitron font-bold text-[9px] tracking-widest border transition-all duration-150 ${
                  isPOV
                    ? "border-red-600 bg-red-950/30 text-red-400"
                    : "border-slate-700 text-slate-300 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-800/80"
                }`}
              >
                {isPOV ? "✖ DISABLE POV OPTIC FEED" : "📡 ENGAGE POV OPTIC FEED"}
              </button>

              <button
                type="button"
                onClick={() => {
                  playSound("click");
                  setSelectedId(null);
                  setIsPOV(false);
                }}
                className="w-full border border-slate-700 bg-slate-900/50 py-2 rounded font-orbitron font-bold text-[9px] tracking-widest text-slate-400 transition-all duration-150 uppercase hover:border-slate-600 hover:text-slate-300"
              >
                DESELECT SPECIMEN
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FOOTER BAR */}
      <div className="absolute left-6 right-6 bottom-4 z-20 flex h-7 items-center justify-between border border-slate-700/60 bg-[#161a22] px-4 font-mono text-[9px] text-slate-500 rounded shadow-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
            <span>GPS SATELLITE CONNECTION STATUS: SECURE</span>
          </div>
          <span className="text-slate-700">|</span>
          <span className="tracking-wider uppercase">
            LOCATION FIELD: SECTOR 4 ENCLOSURES (ISLA NUBLAR)
          </span>
          <span className="text-slate-700">|</span>
          <span>
            POPULATION: <span className="text-yellow-500 font-bold ml-1">{population.length}</span>
          </span>
        </div>
        
        <div className="flex items-center gap-5">
          <span>
            ENGINE: <span className="text-yellow-500 font-bold">{timeScale === 0 ? "PAUSED" : `${timeScale}X`}</span>
          </span>
          <span>
            RENDER: <span className="text-yellow-500 font-bold">{graphicQuality.toUpperCase()}</span>
          </span>
        </div>
      </div>
    </>
  );
}
