import React, { useState } from 'react'
import { Wrench, Settings2, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { Punch, Die, MachineEnvelope } from '../types/tooling'
import { STANDARD_PUNCHES, STANDARD_DIES } from '../core/toolingCatalog'

interface ToolingEditorProps {
  punch: Punch
  die: Die
  envelope: MachineEnvelope
  onUpdatePunch: (p: Punch) => void
  onUpdateDie: (d: Die) => void
  onUpdateEnvelope: (e: MachineEnvelope) => void
}

export const ToolingEditor: React.FC<ToolingEditorProps> = ({
  punch,
  die,
  envelope,
  onUpdatePunch,
  onUpdateDie,
  onUpdateEnvelope,
}) => {
  const [showMachineDetails, setShowMachineDetails] = useState(false)

  return (
    <div className="flex flex-col bg-slate-900 border-l border-slate-800 p-4 space-y-4 overflow-y-auto text-xs w-80">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
          <Wrench className="w-4 h-4 text-cyan-400" />
          <span>Tooling & Machine</span>
        </h2>
        <span className="text-[10px] text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.5 rounded font-mono">
          Euro Clamping
        </span>
      </div>

      {/* Punch Section */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">Upper Punch</span>
          <span className="text-[10px] text-slate-400 uppercase font-mono">{punch.type}</span>
        </div>

        {/* Punch Selector */}
        <select
          value={punch.id}
          onChange={(e) => {
            const found = STANDARD_PUNCHES.find((p) => p.id === e.target.value)
            if (found) onUpdatePunch(found)
          }}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
        >
          {STANDARD_PUNCHES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Punch Dimensional Inputs */}
        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Punch Height (H)</label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={punch.height}
                onChange={(e) => onUpdatePunch({ ...punch, height: parseFloat(e.target.value) || 100 })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">mm</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Throat Relief</label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={punch.throatRelief}
                onChange={(e) => onUpdatePunch({ ...punch, throatRelief: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">mm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Die Section */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">Lower Die</span>
          <span className="text-[10px] text-slate-400 font-mono">V = {die.vOpening} mm</span>
        </div>

        {/* Die Selector */}
        <select
          value={die.id}
          onChange={(e) => {
            const found = STANDARD_DIES.find((d) => d.id === e.target.value)
            if (found) onUpdateDie(found)
          }}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
        >
          {STANDARD_DIES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Die Dimensional Inputs */}
        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">V-Opening (V)</label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={die.vOpening}
                onChange={(e) => onUpdateDie({ ...die, vOpening: parseFloat(e.target.value) || 8 })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">mm</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Die Height</label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={die.height}
                onChange={(e) => onUpdateDie({ ...die, height: parseFloat(e.target.value) || 80 })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">mm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Machine Envelope Section (DELEM DA-53T) */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
        <button
          onClick={() => setShowMachineDetails(!showMachineDetails)}
          className="w-full flex items-center justify-between text-left text-slate-300 hover:text-white transition"
        >
          <div className="flex items-center space-x-1.5">
            <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-semibold">{envelope.name}</span>
          </div>
          {showMachineDetails ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </button>

        {showMachineDetails && (
          <div className="pt-2 border-t border-slate-800/80 space-y-2 text-[11px]">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block">Max Tonnage</label>
                <span className="font-mono text-slate-200">{envelope.maxTonnageTonnes} T</span>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">Daylight (Open)</label>
                <span className="font-mono text-slate-200">{envelope.daylight} mm</span>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">Stroke</label>
                <span className="font-mono text-slate-200">{envelope.stroke} mm</span>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">C-Frame Throat</label>
                <span className="font-mono text-slate-200">{envelope.throatDepth} mm</span>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">Backgauge X Range</label>
                <span className="font-mono text-slate-200">
                  {envelope.backgaugeXMin} - {envelope.backgaugeXMax} mm
                </span>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block">Backgauge R Range</label>
                <span className="font-mono text-slate-200">
                  {envelope.backgaugeRMin} - {envelope.backgaugeRMax} mm
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
