import React from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  RotateCw,
  Scissors,
  Wrench,
  ShieldAlert,
} from 'lucide-react'
import { Suggestion, Diagnostic, EvaluatedStep } from '../types/simulation'
import { SheetMetalPart } from '../types/sheetMetal'

interface DiagnosticPanelProps {
  currentStep: EvaluatedStep | undefined
  isFeasible: boolean
  allSuggestions: Suggestion[]
  part: SheetMetalPart
  onApplyToolSwap: (punchId: string) => void
  onApplyFlangeLength: (flangeIndex: number, newLength: number) => void
  onApplyOrientation: (orientation: 'FORWARD' | 'REVERSE') => void
}

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({
  currentStep,
  isFeasible,
  allSuggestions,
  part,
  onApplyToolSwap,
  onApplyFlangeLength,
  onApplyOrientation,
}) => {
  const hasStepCollision = currentStep?.collisionResult.hasCollision ?? false
  const diagnostics = currentStep?.diagnostics ?? []

  return (
    <div className="bg-slate-900 border-t border-slate-800 p-4 space-y-3">
      {/* Feasibility Header Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {isFeasible ? (
            <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-3 py-1 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-semibold">Sequence Verified: Collision-Free</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-red-400 bg-red-950/70 border border-red-700/80 px-3 py-1 rounded-lg">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-xs font-semibold">Collision Infeasible: Suggestions Below</span>
            </div>
          )}

          {hasStepCollision && (
            <span className="text-xs text-red-300 font-mono bg-red-900/50 border border-red-800 px-2 py-0.5 rounded">
              Current Step {currentStep?.stepIndex ? currentStep.stepIndex + 1 : 1} Crashes!
            </span>
          )}
        </div>

        <span className="text-[11px] text-slate-400">
          DELEM DA-53T Clearance Check Engine
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Left Column: Diagnostics on Current Step */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <AlertTriangle
                className={`w-3.5 h-3.5 ${hasStepCollision ? 'text-red-400' : 'text-slate-400'}`}
              />
              <span>Interference Analysis</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {diagnostics.length} Issues Found
            </span>
          </div>

          {diagnostics.length === 0 ? (
            <div className="text-slate-400 py-3 text-center text-[11px]">
              No collisions detected on this step. Workpiece clears punch, die, and backgauge cleanly.
            </div>
          ) : (
            <div className="space-y-2">
              {diagnostics.map((diag) => (
                <div
                  key={diag.id}
                  className="bg-red-950/30 border border-red-900/60 rounded p-2.5 space-y-1"
                >
                  <div className="flex items-center justify-between text-red-300 font-medium">
                    <span>{diag.title}</span>
                    <span className="text-[10px] uppercase font-mono px-1 bg-red-900/60 rounded text-red-200">
                      {diag.collidingEntity}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">{diag.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Smart Suggestions & Auto-Fixes */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>Smart Solutions & Fixes</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Actionable Suggestions</span>
          </div>

          {allSuggestions.length === 0 ? (
            <div className="text-slate-400 py-3 text-center text-[11px]">
              Current bending setup is optimal. No geometry or tooling changes needed.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {allSuggestions.map((sugg) => (
                <div
                  key={sugg.id}
                  className="bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 flex items-start justify-between space-x-2 hover:border-cyan-500/50 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-1.5">
                      {sugg.category === 'TOOL_SWAP' && <Wrench className="w-3.5 h-3.5 text-cyan-400" />}
                      {sugg.category === 'PART_DESIGN' && <Scissors className="w-3.5 h-3.5 text-amber-400" />}
                      {sugg.category === 'HANDLING' && <RotateCw className="w-3.5 h-3.5 text-emerald-400" />}
                      <span className="font-semibold text-slate-200 text-xs">{sugg.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{sugg.description}</p>
                  </div>

                  {/* Action Buttons to Apply Suggestions */}
                  <div className="shrink-0 pt-0.5">
                    {sugg.params?.recommendedPunchId && (
                      <button
                        onClick={() => onApplyToolSwap(sugg.params!.recommendedPunchId!)}
                        className="flex items-center space-x-1 px-2 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 rounded text-[10px] font-medium transition"
                      >
                        <span>Apply Tool</span>
                        <ArrowRight className="w-3 h-3" />
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
                          className="flex items-center space-x-1 px-2 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-700 rounded text-[10px] font-medium transition"
                        >
                          <span>Trim Flange</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                    {sugg.params?.recommendedOrientation && (
                      <button
                        onClick={() => onApplyOrientation(sugg.params!.recommendedOrientation!)}
                        className="flex items-center space-x-1 px-2 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 rounded text-[10px] font-medium transition"
                      >
                        <span>Flip Part</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
