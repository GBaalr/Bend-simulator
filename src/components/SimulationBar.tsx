import React from 'react'
import { Play, Pause, SkipBack, SkipForward, RotateCw, Eye, Box, Columns } from 'lucide-react'
import { EvaluatedSequence, EvaluatedStep } from '../types/simulation'

interface SimulationBarProps {
  currentStepIndex: number
  totalSteps: number
  progress: number // 0.0 to 1.0
  isPlaying: boolean
  sequence: EvaluatedSequence | null
  viewMode: '2D' | '3D' | 'SPLIT'
  onSelectStep: (index: number) => void
  onTogglePlay: () => void
  onProgressChange: (p: number) => void
  onToggleOrientation: () => void
  onViewModeChange: (mode: '2D' | '3D' | 'SPLIT') => void
}

export const SimulationBar: React.FC<SimulationBarProps> = ({
  currentStepIndex,
  totalSteps,
  progress,
  isPlaying,
  sequence,
  viewMode,
  onSelectStep,
  onTogglePlay,
  onProgressChange,
  onToggleOrientation,
  onViewModeChange,
}) => {
  const currentStep = sequence?.steps[currentStepIndex]

  return (
    <div className="h-20 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between z-20">
      {/* Left: Step Selector Tabs */}
      <div className="flex items-center space-x-2">
        <span className="text-xs font-semibold text-slate-400 mr-1">Steps:</span>
        {sequence &&
          sequence.steps.map((step, idx) => {
            const isCurrent = idx === currentStepIndex
            const hasCollision = step.collisionResult.hasCollision

            return (
              <button
                key={idx}
                onClick={() => onSelectStep(idx)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center space-x-1.5 border ${
                  isCurrent
                    ? 'bg-cyan-950 text-cyan-200 border-cyan-500 shadow-md shadow-cyan-950'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span>S{idx + 1}</span>
                <span className="text-[10px] text-slate-400">({step.targetAngle}°)</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    hasCollision ? 'bg-red-500 shadow-sm shadow-red-500' : 'bg-emerald-500'
                  }`}
                />
              </button>
            )
          })}
      </div>

      {/* Center: Playback & Scrubbing Slider */}
      <div className="flex flex-col items-center space-y-1.5 w-1/3 max-w-md">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onSelectStep(Math.max(0, currentStepIndex - 1))}
            disabled={currentStepIndex <= 0}
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 transition"
            title="Previous Bend Step"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center shadow-lg shadow-cyan-600/30 transition"
            title={isPlaying ? 'Pause' : 'Play Forming Cycle'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={() => onSelectStep(Math.min(totalSteps - 1, currentStepIndex + 1))}
            disabled={currentStepIndex >= totalSteps - 1}
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 transition"
            title="Next Bend Step"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Quick 180° Flip button */}
          <button
            onClick={onToggleOrientation}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition"
            title="Flip Part 180°"
          >
            <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-[11px]">{currentStep?.orientation ?? 'FORWARD'}</span>
          </button>
        </div>

        {/* Progress Slider */}
        <div className="w-full flex items-center space-x-3">
          <span className="text-[10px] text-slate-500 font-mono">0% (Open)</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={progress}
            onChange={(e) => onProgressChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <span className="text-[10px] text-cyan-400 font-mono font-bold w-10 text-right">
            {(progress * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Right: Viewport Mode Switcher */}
      <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
        <button
          onClick={() => onViewModeChange('2D')}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition ${
            viewMode === '2D' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>2D</span>
        </button>
        <button
          onClick={() => onViewModeChange('SPLIT')}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition ${
            viewMode === 'SPLIT' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Columns className="w-3.5 h-3.5" />
          <span>Split</span>
        </button>
        <button
          onClick={() => onViewModeChange('3D')}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition ${
            viewMode === '3D' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>3D</span>
        </button>
      </div>
    </div>
  )
}
