import React, { useState } from 'react'
import { Download, Copy, Check, Table, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { DelemPartProgram } from '../types/delem'
import { exportDelemTextReport } from '../core/delemExporter'
import { EvaluatedSequence } from '../types/simulation'

interface DelemTableProps {
  program: DelemPartProgram | null
  sequence: EvaluatedSequence | null
  activeStepIndex: number
  onSelectStep: (idx: number) => void
}

export const DelemTable: React.FC<DelemTableProps> = ({
  program,
  sequence,
  activeStepIndex,
  onSelectStep,
}) => {
  const [copied, setCopied] = useState(false)

  if (!program || !sequence) {
    return (
      <div className="p-4 text-xs text-slate-500 text-center">
        No active sequence available.
      </div>
    )
  }

  const handleCopy = () => {
    const text = exportDelemTextReport(program)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const text = exportDelemTextReport(program)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${program.programName}_DA53T.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-slate-900 border-t border-slate-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Table className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200">
            DELEM DA-53T Numerical CNC Program Table
          </h3>
          <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
            {program.totalSteps} Steps
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded border border-slate-700 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center space-x-1 px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 text-[11px] rounded border border-cyan-800/80 font-medium transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download DA-53T File</span>
          </button>
        </div>
      </div>

      {/* Program Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-[11px] text-left">
          <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
            <tr>
              <th className="px-3 py-2">Step</th>
              <th className="px-3 py-2">Bend #</th>
              <th className="px-3 py-2">Angle (°)</th>
              <th className="px-3 py-2">Y-Stroke (mm)</th>
              <th className="px-3 py-2">X-Gauge (mm)</th>
              <th className="px-3 py-2">R-Axis (mm)</th>
              <th className="px-3 py-2">Force (T)</th>
              <th className="px-3 py-2">Crowning</th>
              <th className="px-3 py-2">Handling</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {program.steps.map((step, idx) => {
              const isActive = idx === activeStepIndex
              const hasCollision = sequence.steps[idx]?.collisionResult.hasCollision

              return (
                <tr
                  key={step.step}
                  onClick={() => onSelectStep(idx)}
                  className={`cursor-pointer transition ${
                    isActive
                      ? 'bg-cyan-950/70 text-cyan-200'
                      : 'hover:bg-slate-800/50 text-slate-300'
                  }`}
                >
                  <td className="px-3 py-2 font-bold flex items-center space-x-1">
                    {isActive && <ChevronRight className="w-3 h-3 text-cyan-400 shrink-0" />}
                    <span>{step.step}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{step.bendNumber}</td>
                  <td className="px-3 py-2 text-cyan-300 font-bold">{step.angle.toFixed(1)}°</td>
                  <td className="px-3 py-2 text-slate-200">{step.yAxis.toFixed(2)}</td>
                  <td className="px-3 py-2 text-amber-300">{step.xAxis.toFixed(1)}</td>
                  <td className="px-3 py-2 text-slate-300">{step.rAxis.toFixed(1)}</td>
                  <td className="px-3 py-2 text-slate-300">{step.forceTonnes.toFixed(1)}</td>
                  <td className="px-3 py-2 text-slate-400">{step.crowning.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        step.partTurn.includes('180')
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.partTurn}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {hasCollision ? (
                      <span className="flex items-center space-x-1 text-red-400 font-sans text-[10px]">
                        <AlertCircle className="w-3 h-3" />
                        <span>Collision</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-emerald-400 font-sans text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Clear</span>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
