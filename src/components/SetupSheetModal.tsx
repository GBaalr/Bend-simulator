import React, { useState } from 'react'
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Wrench,
  ShieldCheck,
  FileText,
  Cpu,
} from 'lucide-react'
import { SheetMetalPart, Material, BendCalculation } from '../types/sheetMetal'
import { Punch, Die, MachineEnvelope } from '../types/tooling'
import { EvaluatedSequence } from '../types/simulation'
import { DelemPartProgram } from '../types/delem'
import { exportDelemTextReport } from '../core/delemExporter'
import { calculateSpringback } from '../core/mathEngine'

interface SetupSheetModalProps {
  isOpen: boolean
  onClose: () => void
  part: SheetMetalPart
  material: Material
  punch: Punch
  die: Die
  envelope: MachineEnvelope
  metrics: BendCalculation
  sequence: EvaluatedSequence | null
  delemProgram: DelemPartProgram | null
}

export const SetupSheetModal: React.FC<SetupSheetModalProps> = ({
  isOpen,
  onClose,
  part,
  material,
  punch,
  die,
  envelope,
  metrics,
  sequence,
  delemProgram,
}) => {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  const handleCopyNC = () => {
    if (!delemProgram) return
    const text = exportDelemTextReport(delemProgram)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadReport = () => {
    if (!delemProgram) return
    const text = exportDelemTextReport(delemProgram)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${part.name.replace(/\s+/g, '_')}_Setup_Sheet_DA53T.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasAnyCollision = !sequence?.isValid || (sequence?.steps.some((s) => s.collisionResult.hasCollision) ?? false)
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn">
      {/* Modal Container */}
      <div className="bg-slate-900 border border-slate-750 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:w-full print:max-w-none print:max-h-none print:bg-white print:text-black">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Shop-Floor Setup Sheet & Test Report</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  DELEM DA-53T Ready
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Part: <span className="text-slate-200 font-medium">{part.name}</span> • Generated {dateStr}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
              title="Print shop floor work instruction sheet"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Print Sheet</span>
            </button>

            <button
              onClick={handleCopyNC}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
              title="Copy DELEM NC program to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
              <span>{copied ? 'Copied!' : 'Copy NC'}</span>
            </button>

            <button
              onClick={handleDownloadReport}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow transition"
              title="Download DA-53T CNC file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body (Also Printable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 print:p-0 print:overflow-visible text-slate-200 print:text-black">
          {/* Printable Header only visible when printing */}
          <div className="hidden print:block border-b-2 border-black pb-4 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold uppercase tracking-wider">Press Brake Operator Setup Sheet</h1>
                <p className="text-xs text-gray-600">DELEM DA-53T Numerical Controller • Generated: {dateStr}</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold">Part: {part.name}</p>
                <p>Material: {material.name} (T={part.thickness}mm)</p>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 print:border-gray-300 print:bg-gray-50">
            <div className="flex items-center space-x-3">
              {hasAnyCollision ? (
                <div className="w-7 h-7 rounded-lg bg-red-950/80 border border-red-700/80 flex items-center justify-center text-red-400 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-700/80 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              <div>
                <span className="text-xs font-bold block text-white print:text-black">
                  {hasAnyCollision
                    ? 'Sequence Infeasible: Collision Warning Detected'
                    : 'Verified Safe: 100% Collision-Free Sequence'}
                </span>
                <span className="text-[11px] text-slate-400 print:text-gray-600">
                  {sequence?.steps.length ?? 0} Bends • Total Developed Blank: {metrics.flatLength} mm • Total Required Tonnage: {metrics.totalTonnage} Tonnes
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 print:border-gray-400 print:bg-white print:text-black">
                Thickness: {part.thickness} mm
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 print:border-gray-400 print:bg-white print:text-black">
                Width: {part.width} mm
              </span>
            </div>
          </div>

          {/* Cards Grid: Part Specs & Tooling Setup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Part & Material Specification Card */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 print:border-gray-300 print:bg-white">
              <div className="flex items-center space-x-2 text-xs font-bold text-cyan-400 print:text-black border-b border-slate-800/80 print:border-gray-200 pb-2">
                <Layers className="w-4 h-4" />
                <span>Part & Material Specifications</span>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Material</span>
                  <span className="font-semibold text-slate-200 print:text-black">{material.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Tensile / Yield (Rm / Re)</span>
                  <span className="font-semibold text-slate-200 print:text-black">{material.tensileStrength} / {material.yieldStrength} MPa</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Developed Flat Length</span>
                  <span className="font-semibold text-cyan-300 print:text-black font-mono">{metrics.flatLength} mm</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Total Bend Deduction (BD)</span>
                  <span className="font-semibold text-slate-200 print:text-black font-mono">{metrics.bendDeduction} mm</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Neutral K-Factor</span>
                  <span className="font-semibold text-slate-200 print:text-black font-mono">{metrics.kFactor}</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Min Safe Flange Length</span>
                  <span className="font-semibold text-amber-300 print:text-black font-mono">{metrics.minFlangeLength} mm</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Predicted Springback (Δθ)</span>
                  <span className="font-semibold text-cyan-300 print:text-black font-mono">{metrics.springbackDeg ?? 1.5}°</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Compensated Overbend Target</span>
                  <span className="font-semibold text-emerald-400 print:text-black font-mono">{metrics.overbendAngle ?? 88.5}°</span>
                </div>
              </div>
            </div>

            {/* Tooling & Press Setup Card */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 print:border-gray-300 print:bg-white">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 print:text-black border-b border-slate-800/80 print:border-gray-200 pb-2">
                <Wrench className="w-4 h-4" />
                <span>Tooling & Machine Station</span>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Upper Punch Tool</span>
                  <span className="font-semibold text-slate-200 print:text-black">{punch.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Punch Tip Radius / Angle</span>
                  <span className="font-semibold text-slate-200 print:text-black font-mono">R{punch.tipRadius} mm • {punch.angle}°</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Lower V-Die Tool</span>
                  <span className="font-semibold text-slate-200 print:text-black">{die.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">V-Die Opening / Angle</span>
                  <span className="font-semibold text-slate-200 print:text-black font-mono">V{die.vOpening} mm • {die.vAngle}°</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Machine Model / Controller</span>
                  <span className="font-semibold text-slate-200 print:text-black">{envelope.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Max Machine Tonnage</span>
                  <span className="font-semibold text-slate-200 print:text-black font-mono">{envelope.maxTonnageTonnes} Tonnes</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Daylight / Stroke</span>
                  <span className="font-semibold text-slate-200 print:text-black font-mono">{envelope.daylight} / {envelope.stroke} mm</span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600 block text-[10px] uppercase font-mono">Throat Depth</span>
                  <span className="font-semibold text-slate-200 print:text-black font-mono">{envelope.throatDepth} mm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Full Bending Sequence Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white print:text-black uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400 print:text-black" />
                <span>Numerical Step-by-Step Sequence Table</span>
              </h3>
              <span className="text-[11px] text-slate-400 print:text-gray-600 font-mono">
                {sequence?.steps.length ?? 0} Operations
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 print:border-gray-400">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 print:bg-gray-100 print:text-black font-mono text-[10px] uppercase border-b border-slate-800 print:border-gray-300">
                  <tr>
                    <th className="px-3 py-2.5">Step</th>
                    <th className="px-3 py-2.5">Bend #</th>
                    <th className="px-3 py-2.5">Nominal Angle</th>
                    <th className="px-3 py-2.5">Springback (Δθ)</th>
                    <th className="px-3 py-2.5">Overbend Target</th>
                    <th className="px-3 py-2.5">Orientation</th>
                    <th className="px-3 py-2.5">X-Gauge (mm)</th>
                    <th className="px-3 py-2.5">R-Height (mm)</th>
                    <th className="px-3 py-2.5">Y-Stroke (mm)</th>
                    <th className="px-3 py-2.5">Force (Tonnes)</th>
                    <th className="px-3 py-2.5">Clearance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 print:divide-gray-300 font-mono text-[11px]">
                  {sequence?.steps.map((step, idx) => {
                    const sb = calculateSpringback(
                      step.targetAngle,
                      part.bends[step.bendIndex]?.radius ?? 1.5,
                      part.thickness,
                      material
                    )
                    const hasCol = step.collisionResult.hasCollision

                    return (
                      <tr key={idx} className="hover:bg-slate-800/30 print:hover:bg-transparent">
                        <td className="px-3 py-2.5 font-bold text-white print:text-black">
                          S{idx + 1}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 print:text-gray-700">
                          B{step.bendIndex + 1}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-cyan-300 print:text-black">
                          {step.targetAngle.toFixed(1)}°
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 print:text-gray-700">
                          {sb.springbackDeg.toFixed(1)}°
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-emerald-400 print:text-black">
                          {sb.overbendAngleDeg.toFixed(1)}°
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              step.orientation === 'REVERSE'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 print:bg-transparent print:border-none print:text-black'
                                : 'bg-slate-800 text-slate-300 print:bg-transparent print:text-black'
                            }`}
                          >
                            {step.orientation}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-amber-300 print:text-black">
                          {step.gaugeX.toFixed(1)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 print:text-black">
                          {step.gaugeR.toFixed(1)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200 print:text-black">
                          {step.ramStrokeY.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 print:text-black">
                          {step.tonnageTonnes.toFixed(1)}
                        </td>
                        <td className="px-3 py-2.5">
                          {hasCol ? (
                            <span className="inline-flex items-center space-x-1 text-red-400 font-sans text-[10px] font-semibold">
                              <AlertTriangle className="w-3 h-3" />
                              <span>COLLISION</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-emerald-400 font-sans text-[10px] font-semibold">
                              <ShieldCheck className="w-3 h-3" />
                              <span>CLEAR</span>
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

          {/* DELEM NC Code Raw Block */}
          {delemProgram && (
            <div className="space-y-2 print:break-before-page">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 print:text-gray-700 uppercase font-mono">
                  DELEM DA-53T G-Code Program Data
                </span>
                <button
                  onClick={handleCopyNC}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 transition print:hidden"
                >
                  {copied ? 'Copied to Clipboard' : 'Copy G-Code Block'}
                </button>
              </div>
              <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-mono text-cyan-200/90 overflow-x-auto max-h-48 print:max-h-none print:bg-gray-50 print:border-gray-400 print:text-black">
                {exportDelemTextReport(delemProgram)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between print:hidden">
          <span className="text-[11px] text-slate-400">
            Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 text-[10px]">Ctrl+P</kbd> or click Print Sheet for physical printout.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
