import React, { useState } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCw,
  Eye,
  Box,
  Columns,
  Table,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { EvaluatedSequence, EvaluatedStep } from '../types/simulation'
import { SheetMetalPart } from '../types/sheetMetal'
import { Punch, Die, MachineEnvelope } from '../types/tooling'
import { DelemPartProgram } from '../types/delem'
import { Viewport2D } from './Viewport2D'
import { Viewport3D } from './Viewport3D'
import { DelemTable } from './DelemTable'

interface SimulationStepViewProps {
  part: SheetMetalPart
  punch: Punch
  die: Die
  envelope: MachineEnvelope
  sequence: EvaluatedSequence | null
  delemProgram: DelemPartProgram | null
  activeStepIndex: number
  progress: number
  isPlaying: boolean
  onSelectStep: (idx: number) => void
  onTogglePlay: () => void
  onProgressChange: (p: number) => void
  onToggleOrientation: () => void
  onPrevStep: () => void
  onBackToSketch: () => void
}

export const SimulationStepView: React.FC<SimulationStepViewProps> = ({
  part,
  punch,
  die,
  envelope,
  sequence,
  delemProgram,
  activeStepIndex,
  progress,
  isPlaying,
  onSelectStep,
  onTogglePlay,
  onProgressChange,
  onToggleOrientation,
  onPrevStep,
  onBackToSketch,
}) => {
  const [viewMode, setViewMode] = useState<'2D' | '3D' | 'SPLIT'>('3D')
  const [showDelemTable, setShowDelemTable] = useState(false)

  const currentStep = sequence?.steps[activeStepIndex]

  // Completed bends map
  const completedBends = React.useMemo(() => {
    const map = new Map<number, number>()
    if (!sequence) return map
    for (let i = 0; i < activeStepIndex; i++) {
      const step = sequence.steps[i]
      map.set(step.bendIndex, step.targetAngle)
    }
    return map
  }, [sequence, activeStepIndex])

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Bar inside Step 4 */}
      <div className="min-h-12 bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 z-10 text-xs">
        <div className="flex items-center space-x-2 sm:space-x-3 overflow-x-auto">
          <button
            onClick={onPrevStep}
            className="flex items-center space-x-1 text-slate-400 hover:text-white transition shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400 font-bold shrink-0">
            Step {activeStepIndex + 1}/{sequence?.steps.length}
          </span>
          <span className="text-slate-400 font-mono shrink-0">
            (Bend {currentStep?.bendIndex ? currentStep.bendIndex + 1 : 1}, {currentStep?.targetAngle}°)
          </span>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {/* View mode toggle */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('2D')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition ${
                viewMode === '2D' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>2D</span>
            </button>
            <button
              onClick={() => setViewMode('SPLIT')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition ${
                viewMode === 'SPLIT' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              onClick={() => setViewMode('3D')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition ${
                viewMode === '3D' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D</span>
            </button>
          </div>

          <button
            onClick={() => setShowDelemTable(!showDelemTable)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium transition"
          >
            <Table className="w-3.5 h-3.5 text-cyan-400" />
            <span>DELEM Program Table</span>
            {showDelemTable ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Simulation Viewport */}
      <div className="flex-1 flex overflow-hidden relative">
        {(viewMode === '2D' || viewMode === 'SPLIT') && (
          <div className="flex-1 h-full border-r border-slate-800 relative">
            <Viewport2D
              part={part}
              punch={punch}
              die={die}
              envelope={envelope}
              activeBendIndex={currentStep?.bendIndex ?? 0}
              completedBends={completedBends}
              progress={progress}
              orientation={currentStep?.orientation ?? 'FORWARD'}
              collisionResult={currentStep?.collisionResult ?? null}
              penetrationDepth={currentStep?.ramStrokeY ?? 2.0}
              gaugeX={currentStep?.gaugeX ?? 50}
              gaugeR={currentStep?.gaugeR ?? 0}
            />
          </div>
        )}

        {(viewMode === '3D' || viewMode === 'SPLIT') && (
          <div className="flex-1 h-full relative">
            <Viewport3D
              part={part}
              punch={punch}
              die={die}
              envelope={envelope}
              activeBendIndex={currentStep?.bendIndex ?? 0}
              completedBends={completedBends}
              progress={progress}
              orientation={currentStep?.orientation ?? 'FORWARD'}
              collisionResult={currentStep?.collisionResult ?? null}
              penetrationDepth={currentStep?.ramStrokeY ?? 2.0}
              gaugeX={currentStep?.gaugeX ?? 50}
              gaugeR={currentStep?.gaugeR ?? 0}
            />
          </div>
        )}

        {/* Floating Operator Handling Instruction Banner */}
        {currentStep && (
          <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-800 p-2.5 rounded-xl shadow-xl flex items-center space-x-3 pointer-events-none">
            <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center font-mono font-bold text-cyan-400 text-xs">
              S{activeStepIndex + 1}
            </div>
            <div className="text-xs">
              <span className="font-semibold text-white block">
                Bend {currentStep.bendIndex + 1} ({currentStep.targetAngle}°)
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Orientation: <span className="text-amber-400">{currentStep.orientation}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Playback Controls & Scrubber */}
      <div className="min-h-16 bg-slate-900 border-t border-slate-800 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 z-10">
        {/* Step Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
          <span className="text-xs text-slate-400 font-semibold mr-1 shrink-0">Steps:</span>
          {sequence?.steps.map((step, idx) => (
            <button
              key={idx}
              onClick={() => onSelectStep(idx)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition shrink-0 flex items-center space-x-1 ${
                idx === activeStepIndex
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>{idx + 1}</span>
              <span className="text-[10px] opacity-80">({step.targetAngle}°)</span>
            </button>
          ))}
        </div>

        {/* Center: Play, Next/Prev, Scrub */}
        <div className="flex items-center space-x-3 w-full sm:w-auto sm:flex-1 max-w-md">
          <button
            onClick={() => onSelectStep(Math.max(0, activeStepIndex - 1))}
            disabled={activeStepIndex <= 0}
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 transition"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-9 h-9 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center shadow-lg shadow-cyan-600/30 transition"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={() => onSelectStep(Math.min((sequence?.steps.length ?? 1) - 1, activeStepIndex + 1))}
            disabled={activeStepIndex >= (sequence?.steps.length ?? 1) - 1}
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 transition"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Scrubber slider */}
          <div className="flex-1 flex items-center space-x-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={progress}
              onChange={(e) => onProgressChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <span className="text-[11px] font-mono text-cyan-400 font-bold w-9 text-right">
              {(progress * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Action: Back to Edit */}
        <div>
          <button
            onClick={onBackToSketch}
            className="text-xs text-slate-400 hover:text-cyan-400 transition underline underline-offset-4"
          >
            Edit Profile in Step 1
          </button>
        </div>
      </div>

      {/* Expandable DELEM Table */}
      {showDelemTable && (
        <div className="max-h-72 border-t border-slate-800 overflow-y-auto">
          <DelemTable
            program={delemProgram}
            sequence={sequence}
            activeStepIndex={activeStepIndex}
            onSelectStep={onSelectStep}
          />
        </div>
      )}
    </div>
  )
}
