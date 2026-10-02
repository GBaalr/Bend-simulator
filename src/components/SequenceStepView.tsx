import React, { useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  RotateCw,
  Scissors,
  Wrench,
  ShieldCheck,
  ShieldAlert,
  Play,
} from 'lucide-react'
import { EvaluatedSequence, EvaluatedStep, Suggestion } from '../types/simulation'
import { SheetMetalPart } from '../types/sheetMetal'
import { Punch, Die, MachineEnvelope } from '../types/tooling'
import { Viewport2D } from './Viewport2D'

interface SequenceStepViewProps {
  part: SheetMetalPart
  punch: Punch
  die: Die
  envelope: MachineEnvelope
  sequence: EvaluatedSequence | null
  suggestions: Suggestion[]
  onApplyToolSwap: (punchId: string) => void
  onApplyFlangeLength: (flangeIndex: number, newLength: number) => void
  onApplyOrientation: (orientation: 'FORWARD' | 'REVERSE') => void
  onNextStep: () => void
  onPrevStep: () => void
}

export const SequenceStepView: React.FC<SequenceStepViewProps> = ({
  part,
  punch,
  die,
  envelope,
  sequence,
  suggestions,
  onApplyToolSwap,
  onApplyFlangeLength,
  onApplyOrientation,
  onNextStep,
  onPrevStep,
}) => {
  const [inspectedStepIdx, setInspectedStepIdx] = useState(0)
  const [mobileTab, setMobileTab] = useState<'sequence' | 'preview'>('sequence')

  const isFeasible = sequence?.isValid ?? false
  const inspectedStep = sequence?.steps[inspectedStepIdx]

  // Completed bends map for preview of inspected step
  const completedBends = React.useMemo(() => {
    const map = new Map<number, number>()
    if (!sequence) return map
    for (let i = 0; i < inspectedStepIdx; i++) {
      const step = sequence.steps[i]
      map.set(step.bendIndex, step.targetAngle)
    }
    return map
  }, [sequence, inspectedStepIdx])

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-950">
      {/* Mobile Tab Switcher */}
      <div className="flex md:hidden bg-slate-900 border-b border-slate-800 p-1 shrink-0">
        <button
          onClick={() => setMobileTab('sequence')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
            mobileTab === 'sequence'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          📋 Steps & Collision
        </button>
        <button
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
            mobileTab === 'preview'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🔍 Step Preview
        </button>
      </div>

      {/* Left Column: Sequence Cards & Suggestions */}
      <div
        className={`w-full md:w-[420px] shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-y-auto p-4 md:p-5 space-y-4 ${
          mobileTab === 'sequence' ? 'flex' : 'hidden md:flex'
        }`}
      >
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-800/80 px-2 py-0.5 rounded-full">
            Step 3 of 4
          </span>
          <h2 className="text-base font-bold text-white mt-1.5">
            Bending Sequence & Collision Solver
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            The algorithm evaluated all sequence permutations and orientations to find a collision-free path.
          </p>
        </div>

        {/* Feasibility Result Banner */}
        <div
          className={`p-3.5 rounded-xl border flex items-start space-x-3 ${
            isFeasible
              ? 'bg-emerald-950/50 border-emerald-700/80 text-emerald-200'
              : 'bg-red-950/50 border-red-700/80 text-red-200'
          }`}
        >
          {isFeasible ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="text-xs space-y-0.5">
            <span className="font-bold block text-sm">
              {isFeasible ? 'Collision-Free Sequence Found!' : 'Collisions Detected'}
            </span>
            <p className="text-[11px] opacity-90">
              {isFeasible
                ? `Successfully verified all ${sequence?.steps.length} bends without any tool or machine collisions. Flips required: ${sequence?.flipCount}.`
                : 'Tooling or geometry collisions prevent forming this part in the current setup. Review the recommendations below to solve it.'}
            </p>
          </div>
        </div>

        {/* Sequence Steps Timeline Cards */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300 block">
            Calculated Step Sequence (Click to inspect):
          </span>

          <div className="space-y-1.5">
            {sequence?.steps.map((step, idx) => {
              const isSelected = idx === inspectedStepIdx
              const hasCollision = step.collisionResult.hasCollision

              return (
                <div
                  key={idx}
                  onClick={() => setInspectedStepIdx(idx)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-cyan-950/70 border-cyan-500 text-white shadow-md'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs ${
                        hasCollision
                          ? 'bg-red-900 text-red-200'
                          : isSelected
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <span>Bend {step.bendIndex + 1}</span>
                        <span className="text-cyan-400 font-mono">({step.targetAngle}°)</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Y: {step.ramStrokeY}mm | X: {step.gaugeX}mm | Turn: {step.orientation}
                      </div>
                    </div>
                  </div>

                  <div>
                    {hasCollision ? (
                      <span className="text-[10px] font-semibold text-red-400 bg-red-950 px-2 py-0.5 rounded border border-red-800">
                        Collision
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        Clear
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Suggestions & Solutions when Infeasible */}
        {suggestions.length > 0 && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center space-x-1.5 text-amber-400 text-xs font-semibold">
              <Lightbulb className="w-4 h-4" />
              <span>Recommended Solutions:</span>
            </div>

            <div className="space-y-2">
              {suggestions.map((sugg) => (
                <div
                  key={sugg.id}
                  className="bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 space-y-1.5"
                >
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200">
                    {sugg.category === 'TOOL_SWAP' && <Wrench className="w-3.5 h-3.5 text-cyan-400" />}
                    {sugg.category === 'PART_DESIGN' && <Scissors className="w-3.5 h-3.5 text-amber-400" />}
                    {sugg.category === 'HANDLING' && <RotateCw className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{sugg.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{sugg.description}</p>

                  <div className="pt-1">
                    {sugg.params?.recommendedPunchId && (
                      <button
                        onClick={() => onApplyToolSwap(sugg.params!.recommendedPunchId!)}
                        className="px-3 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 rounded text-xs font-semibold transition"
                      >
                        Apply Recommended Tool
                      </button>
                    )}
                    {sugg.params?.recommendedFlangeLength !== undefined &&
                      sugg.params?.flangeIndex !== undefined && (
                        <button
                          onClick={() =>
                            onApplyFlangeLength(
                              sugg.params!.flangeIndex!,
                              sugg.params!.recommendedFlangeLength!
                            )
                          }
                          className="px-3 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-700 rounded text-xs font-semibold transition"
                        >
                          Auto-Trim Flange to Safe Length
                        </button>
                      )}
                    {sugg.params?.recommendedOrientation && (
                      <button
                        onClick={() => onApplyOrientation(sugg.params!.recommendedOrientation!)}
                        className="px-3 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 rounded text-xs font-semibold transition"
                      >
                        Apply 180° Flip
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step Navigation */}
        <div className="pt-2 border-t border-slate-800 flex items-center space-x-2">
          <button
            onClick={onPrevStep}
            className="flex-1 flex items-center justify-center space-x-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Tooling</span>
          </button>
          <button
            onClick={onNextStep}
            className="flex-1 flex items-center justify-center space-x-1 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-cyan-600/20 transition"
          >
            <span>Watch 3D Simulation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center 2D Step Verification Preview */}
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden relative ${
          mobileTab === 'preview' ? 'flex' : 'hidden md:flex'
        }`}
      >
        <div className="h-12 bg-slate-900/60 border-b border-slate-800 px-6 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Inspecting Step:</span>
            <span className="text-cyan-400 font-bold">
              Step {inspectedStepIdx + 1} of {sequence?.steps.length}
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300">
              Bend {inspectedStep?.bendIndex ? inspectedStep.bendIndex + 1 : 1} (
              {inspectedStep?.targetAngle}°)
            </span>
          </div>
        </div>

        <div className="flex-1 relative">
          <Viewport2D
            part={part}
            punch={punch}
            die={die}
            envelope={envelope}
            activeBendIndex={inspectedStep?.bendIndex ?? 0}
            completedBends={completedBends}
            progress={1.0}
            orientation={inspectedStep?.orientation ?? 'FORWARD'}
            collisionResult={inspectedStep?.collisionResult ?? null}
            penetrationDepth={inspectedStep?.ramStrokeY ?? 2.0}
            gaugeX={inspectedStep?.gaugeX ?? 50}
            gaugeR={inspectedStep?.gaugeR ?? 0}
          />
        </div>
      </div>
    </div>
  )
}
