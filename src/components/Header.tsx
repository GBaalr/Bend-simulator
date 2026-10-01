import React from 'react'
import { Cpu, FileUp, Sparkles, PenTool, Wrench, ListOrdered, PlayCircle, Smartphone } from 'lucide-react'

export type WorkflowStepId = 'SKETCH' | 'TOOLING' | 'SEQUENCE' | 'SIMULATION'

interface HeaderProps {
  currentWorkflowStep: WorkflowStepId
  onSelectWorkflowStep: (step: WorkflowStepId) => void
  onLoadPreset: (presetKey: string) => void
  onStartBlankPart: () => void
  onOpenDxfModal: () => void
  onOpenMobileConnect: () => void
  onAutoSolve: () => void
  isSolving: boolean
}

import { SAMPLE_PRESETS } from '../core/presets'

export const Header: React.FC<HeaderProps> = ({
  currentWorkflowStep,
  onSelectWorkflowStep,
  onLoadPreset,
  onStartBlankPart,
  onOpenDxfModal,
  onOpenMobileConnect,
  onAutoSolve,
  isSolving,
}) => {
  const steps: {
    id: WorkflowStepId
    label: string
    shortLabel: string
    number: number
    icon: React.ComponentType<{ className?: string }>
  }[] = [
    { id: 'SKETCH', label: '1. Sketch 2D Profile', shortLabel: '1. Sketch', number: 1, icon: PenTool },
    { id: 'TOOLING', label: '2. Tooling Setup', shortLabel: '2. Tools', number: 2, icon: Wrench },
    { id: 'SEQUENCE', label: '3. Sequence & Collision', shortLabel: '3. Sequence', number: 3, icon: ListOrdered },
    { id: 'SIMULATION', label: '4. Simulation & DELEM', shortLabel: '4. Simulation', number: 4, icon: PlayCircle },
  ]

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-20 shrink-0">
      {/* Brand & Machine */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
          <Cpu className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
            BEND<span className="text-cyan-400">SIM</span>
            <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/80 rounded-full">
              DELEM DA-53T
            </span>
          </h1>
          <p className="text-[10px] text-slate-400">Press Brake Forming & Sequence Optimizer</p>
        </div>
      </div>

      {/* Stepped Workflow Pipeline Tabs */}
      <nav className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 space-x-1 overflow-x-auto">
        {steps.map((s) => {
          const isActive = currentWorkflowStep === s.id
          const Icon = s.icon

          return (
            <button
              key={s.id}
              onClick={() => onSelectWorkflowStep(s.id)}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                isActive
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="hidden md:inline">{s.label}</span>
              <span className="md:hidden inline">{s.shortLabel}</span>
            </button>
          )
        })}
      </nav>

      {/* Right Actions: Phone Connect, Presets, Draw Custom Part, DXF Import */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Mobile / Phone Access Modal trigger */}
        <button
          onClick={onOpenMobileConnect}
          className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/80 rounded-lg transition shadow-sm animate-pulse"
          title="Connect phone to simulator via Wi-Fi QR Code"
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="hidden sm:inline">Phone Access</span>
        </button>

        <button
          onClick={onStartBlankPart}
          className="hidden lg:flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition shadow-sm"
          title="Clear canvas and draw a custom part from scratch"
        >
          <PenTool className="w-3.5 h-3.5 text-cyan-400" />
          <span>New Part</span>
        </button>

        <div className="hidden sm:flex items-center space-x-1">
          <select
            className="bg-slate-800/90 text-[11px] text-slate-200 border border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:border-cyan-500 hover:bg-slate-800 transition"
            onChange={(e) => {
              if (e.target.value) onLoadPreset(e.target.value)
            }}
            defaultValue="u_channel"
          >
            {Object.values(SAMPLE_PRESETS).map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onOpenDxfModal}
          className="hidden md:flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
        >
          <FileUp className="w-3.5 h-3.5 text-slate-400" />
          <span>Import DXF</span>
        </button>

        <button
          onClick={onAutoSolve}
          disabled={isSolving}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border border-cyan-400/30 rounded-lg shadow-md shadow-cyan-600/20 transition disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isSolving ? 'Solving...' : 'Solve Sequence'}</span>
          <span className="sm:hidden inline">Solve</span>
        </button>
      </div>
    </header>
  )
}
