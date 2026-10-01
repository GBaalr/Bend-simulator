import React, { useState } from 'react'
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Settings,
  ShieldCheck,
  Zap,
  PenTool,
} from 'lucide-react'
import { SheetMetalPart, Material, BendCalculation } from '../types/sheetMetal'
import { Punch, Die, MachineEnvelope } from '../types/tooling'
import { STANDARD_PUNCHES, STANDARD_DIES } from '../core/toolingCatalog'
import { Viewport2D } from './Viewport2D'
import { PunchDrafterModal } from './PunchDrafterModal'
import { DieDrafterModal } from './DieDrafterModal'

interface ToolingSetupStepProps {
  part: SheetMetalPart
  material: Material
  punch: Punch
  die: Die
  envelope: MachineEnvelope
  metrics: BendCalculation
  onUpdatePunch: (p: Punch) => void
  onUpdateDie: (d: Die) => void
  onUpdateEnvelope: (e: MachineEnvelope) => void
  onNextStep: () => void
  onPrevStep: () => void
}

export const ToolingSetupStep: React.FC<ToolingSetupStepProps> = ({
  part,
  punch,
  die,
  envelope,
  metrics,
  onUpdatePunch,
  onUpdateDie,
  onNextStep,
  onPrevStep,
}) => {
  const [isDrafterOpen, setIsDrafterOpen] = useState(false)
  const [isDieDrafterOpen, setIsDieDrafterOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<'catalog' | 'preview'>('catalog')

  // Shortest flange in the part
  const minPartFlange = Math.min(...part.flanges.map((f) => f.length))
  const isFlangeTooShort = minPartFlange < metrics.minFlangeLength
  const isOverTonnage = metrics.totalTonnage > envelope.maxTonnageTonnes

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-950">
      {/* Mobile View Toggle */}
      <div className="flex md:hidden bg-slate-900 border-b border-slate-800 p-1 shrink-0">
        <button
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
            mobileTab === 'catalog'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🔧 Tools & Limits
        </button>
        <button
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
            mobileTab === 'preview'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🔍 2D Fit Preview
        </button>
      </div>

      {/* Left Column: Tooling Catalog Selection */}
      <div
        className={`w-full md:w-96 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-y-auto p-4 md:p-5 space-y-4 md:space-y-5 ${
          mobileTab === 'catalog' ? 'flex' : 'hidden md:flex'
        }`}
      >
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-800/80 px-2 py-0.5 rounded-full">
            Step 2 of 4
          </span>
          <h2 className="text-base font-bold text-white mt-1.5">Tooling & Machine Fit</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select the punch and V-die. Verify machine tonnage and minimum flange safety limits.
          </p>
        </div>

        {/* Punch Selection Cards */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">1. Upper Punch (Top Tool)</span>
            <button
              onClick={() => setIsDrafterOpen(true)}
              className="flex items-center space-x-1 px-2 py-0.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded text-[10px] font-semibold transition"
            >
              <PenTool className="w-3 h-3" />
              <span>Draw Custom Punch</span>
            </button>
          </div>

          <div className="space-y-1.5">
            {/* If current punch is custom (not in standard list), show it pinned at top */}
            {!STANDARD_PUNCHES.some((sp) => sp.id === punch.id) && (
              <div
                className="p-2.5 rounded-lg border bg-cyan-950/70 border-cyan-500 text-white cursor-pointer transition flex items-center justify-between"
                onClick={() => setIsDrafterOpen(true)}
              >
                <div>
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <span>{punch.name}</span>
                    <span className="text-[9px] bg-cyan-900 border border-cyan-700 px-1 rounded text-cyan-200 uppercase font-mono">
                      CUSTOM DRAWN
                    </span>
                  </div>
                  <div className="text-[10px] text-cyan-300 font-mono">
                    H: {punch.height}mm | {punch.angle}° | Relief: {punch.throatRelief}mm (Click to edit)
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              </div>
            )}

            {STANDARD_PUNCHES.map((p) => {
              const isSelected = p.id === punch.id
              return (
                <div
                  key={p.id}
                  onClick={() => onUpdatePunch(p)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-cyan-950/60 border-cyan-500 text-white'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold">{p.name.split(' (')[0]}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Height: {p.height}mm | {p.angle}° | Relief: {p.throatRelief}mm
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Die Selection Cards */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">2. Lower Die (Bottom Base)</span>
            <button
              onClick={() => setIsDieDrafterOpen(true)}
              className="flex items-center space-x-1 px-2 py-0.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded text-[10px] font-semibold transition"
            >
              <PenTool className="w-3 h-3" />
              <span>Draw Custom Die</span>
            </button>
          </div>

          {/* If current die is custom (not in standard list), show it pinned at top */}
          {!STANDARD_DIES.some((sd) => sd.id === die.id) && (
            <div
              className="p-2.5 rounded-lg border bg-cyan-950/70 border-cyan-500 text-white cursor-pointer transition flex items-center justify-between"
              onClick={() => setIsDieDrafterOpen(true)}
            >
              <div>
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  <span>{die.name}</span>
                  <span className="text-[9px] bg-cyan-900 border border-cyan-700 px-1 rounded text-cyan-200 uppercase font-mono">
                    CUSTOM DRAWN
                  </span>
                </div>
                <div className="text-[10px] text-cyan-300 font-mono">
                  V = {die.vOpening}mm | H: {die.height}mm | {die.vAngle}° (Click to edit)
                </div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            {STANDARD_DIES.map((d) => {
              const isSelected = d.id === die.id
              return (
                <div
                  key={d.id}
                  onClick={() => onUpdateDie(d)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-cyan-950/60 border-cyan-500 text-white'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="text-xs font-semibold font-mono">V = {d.vOpening} mm</div>
                  <div className="text-[10px] text-slate-400">
                    H: {d.height}mm | {d.vAngle}°
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Machine Compatibility Checks */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2.5 text-xs">
          <span className="font-semibold text-slate-200 block border-b border-slate-800/80 pb-1">
            Machine Safety & Feasibility
          </span>

          {/* Tonnage Check */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300">Required Tonnage:</span>
            </div>
            <span
              className={`font-mono font-bold ${
                isOverTonnage ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {metrics.totalTonnage} T / {envelope.maxTonnageTonnes} T
            </span>
          </div>

          {/* Minimum Flange Check */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-300">Min. Safe Flange:</span>
            </div>
            <span
              className={`font-mono font-bold ${
                isFlangeTooShort ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {minPartFlange}mm (Min: {metrics.minFlangeLength}mm)
            </span>
          </div>

          {isFlangeTooShort && (
            <div className="text-[10px] text-red-300 bg-red-950/40 border border-red-800 rounded p-1.5">
              Warning: Shortest flange ({minPartFlange}mm) may slip into the {die.vOpening}mm V-die!
              Consider switching to a smaller V-die.
            </div>
          )}
        </div>

        {/* Step Navigation Buttons */}
        <div className="pt-2 border-t border-slate-800 flex items-center space-x-2">
          <button
            onClick={onPrevStep}
            className="flex-1 flex items-center justify-center space-x-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <button
            onClick={onNextStep}
            className="flex-1 flex items-center justify-center space-x-1 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-cyan-600/20 transition"
          >
            <span>Find Sequence</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center 2D Fit Preview Canvas */}
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden relative ${
          mobileTab === 'preview' ? 'flex' : 'hidden md:flex'
        }`}
      >
        <div className="h-12 bg-slate-900/60 border-b border-slate-800 px-6 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Tooling Assembly:</span>
            <span className="text-cyan-400 font-bold">{punch.name}</span>
            <span className="text-slate-500">+</span>
            <span className="text-cyan-400 font-bold">{die.name}</span>
          </div>
          <span className="text-slate-400">Initial Workpiece Lay-in Position</span>
        </div>

        <div className="flex-1 relative">
          <Viewport2D
            part={part}
            punch={punch}
            die={die}
            envelope={envelope}
            activeBendIndex={0}
            completedBends={new Map()}
            progress={0.0}
            orientation="FORWARD"
            collisionResult={null}
            penetrationDepth={2.0}
            gaugeX={60}
            gaugeR={0}
          />
        </div>
      </div>

      {/* Custom Punch Drafter Modal */}
      <PunchDrafterModal
        isOpen={isDrafterOpen}
        currentPunch={punch}
        onClose={() => setIsDrafterOpen(false)}
        onSavePunch={(newPunch) => {
          onUpdatePunch(newPunch)
          setIsDrafterOpen(false)
        }}
      />

      {/* Custom Die / Lower Base Drafter Modal */}
      <DieDrafterModal
        isOpen={isDieDrafterOpen}
        currentDie={die}
        sheetThickness={part.thickness}
        onClose={() => setIsDieDrafterOpen(false)}
        onSaveDie={(newDie) => {
          onUpdateDie(newDie)
          setIsDieDrafterOpen(false)
        }}
      />
    </div>
  )
}
