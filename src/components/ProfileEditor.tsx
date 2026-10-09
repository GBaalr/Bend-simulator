import React from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, Layers, Ruler, Weight } from 'lucide-react'
import { SheetMetalPart, Material, BendCalculation } from '../types/sheetMetal'
import { STANDARD_MATERIALS } from '../core/mathEngine'

interface ProfileEditorProps {
  part: SheetMetalPart
  material: Material
  metrics: BendCalculation
  onUpdatePart: (updated: SheetMetalPart) => void
  onUpdateMaterial: (material: Material) => void
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({
  part,
  material,
  metrics,
  onUpdatePart,
  onUpdateMaterial,
}) => {
  const handleFlangeChange = (index: number, newLength: number) => {
    const newFlanges = [...part.flanges]
    newFlanges[index] = { ...newFlanges[index], length: Math.max(0.5, newLength) }
    onUpdatePart({ ...part, flanges: newFlanges })
  }

  const handleBendAngleChange = (index: number, newAngle: number) => {
    const newBends = [...part.bends]
    newBends[index] = { ...newBends[index], angle: Math.max(30, Math.min(170, newAngle)) }
    onUpdatePart({ ...part, bends: newBends })
  }

  const handleBendDirectionToggle = (index: number) => {
    const newBends = [...part.bends]
    const cur = newBends[index].direction
    newBends[index] = { ...newBends[index], direction: cur === 'UP' ? 'DOWN' : 'UP' }
    onUpdatePart({ ...part, bends: newBends })
  }

  const handleAddFlange = () => {
    const newFlangeId = `flange-${part.flanges.length}`
    const newBendId = `bend-${part.bends.length}`
    onUpdatePart({
      ...part,
      flanges: [...part.flanges, { id: newFlangeId, length: 40 }],
      bends: [...part.bends, { id: newBendId, angle: 90, direction: 'UP', radius: 1.5 }],
    })
  }

  const handleRemoveFlange = (index: number) => {
    if (part.flanges.length <= 2) return // keep at least 2 flanges and 1 bend
    const newFlanges = part.flanges.filter((_, i) => i !== index)
    const newBends = part.bends.slice(0, newFlanges.length - 1)
    onUpdatePart({
      ...part,
      flanges: newFlanges,
      bends: newBends,
    })
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 p-4 space-y-4 overflow-y-auto text-xs">
      {/* Title & Material Specs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Part Profile (2D Section)</span>
          </h2>
          <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
            {part.bends.length} Bends
          </span>
        </div>

        {/* Global Part Properties */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Thickness (T)</label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="12"
                value={part.thickness}
                onChange={(e) => onUpdatePart({ ...part, thickness: parseFloat(e.target.value) || 1 })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-100 text-xs font-mono focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">mm</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Bend Width</label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                step="50"
                min="50"
                max="3000"
                value={part.width}
                onChange={(e) => onUpdatePart({ ...part, width: parseFloat(e.target.value) || 100 })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-100 text-xs font-mono focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400">mm</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Material</label>
            <select
              value={material.id}
              onChange={(e) => {
                const found = STANDARD_MATERIALS.find((m) => m.id === e.target.value)
                if (found) {
                  onUpdateMaterial(found)
                  onUpdatePart({ ...part, materialId: found.id })
                }
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-1 text-slate-100 text-[11px] focus:border-cyan-500 focus:outline-none truncate"
            >
              {STANDARD_MATERIALS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name.split(' ')[0]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Calculated Physics Badges */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2 flex items-center space-x-2">
          <Ruler className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-400 block">Flat Blank Length</span>
            <span className="font-mono font-bold text-slate-200">{metrics.flatLength} mm</span>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2 flex items-center space-x-2">
          <Weight className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-400 block">Bending Force</span>
            <span className="font-mono font-bold text-slate-200">{metrics.totalTonnage} Tonnes</span>
          </div>
        </div>
      </div>

      {/* Flanges & Bends List */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300">Flanges & Bend Angles</span>
          <button
            onClick={handleAddFlange}
            className="flex items-center space-x-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium bg-cyan-950/40 border border-cyan-800/60 rounded px-2 py-0.5 transition"
          >
            <Plus className="w-3 h-3" />
            <span>Add Flange</span>
          </button>
        </div>

        <div className="space-y-1.5">
          {part.flanges.map((flange, idx) => (
            <React.Fragment key={flange.id}>
              {/* Flange Row */}
              <div className="flex items-center justify-between bg-slate-950/50 border border-slate-800 rounded-lg px-2.5 py-1.5 hover:border-slate-700 transition">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] flex items-center justify-center font-bold">
                    F{idx + 1}
                  </span>
                  <span className="text-slate-400 text-[11px]">Length:</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="800"
                      value={flange.length}
                      onChange={(e) => handleFlangeChange(idx, parseFloat(e.target.value) || 0.5)}
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="text-slate-400 text-[10px]">mm</span>
                  </div>
                  {part.flanges.length > 2 && (
                    <button
                      onClick={() => handleRemoveFlange(idx)}
                      className="text-slate-500 hover:text-red-400 p-0.5 transition"
                      title="Remove Flange"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Bend Row (Between Flange i and Flange i+1) */}
              {idx < part.bends.length && (
                <div className="ml-4 pl-3 border-l-2 border-dashed border-cyan-800/60 py-0.5 flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-950/80 px-1 rounded border border-cyan-800/40">
                      Bend {idx + 1}
                    </span>
                    <button
                      onClick={() => handleBendDirectionToggle(idx)}
                      className="flex items-center space-x-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-700 transition"
                      title="Toggle Bend Direction"
                    >
                      {part.bends[idx].direction === 'UP' ? (
                        <>
                          <ArrowUp className="w-3 h-3 text-emerald-400" />
                          <span>UP</span>
                        </>
                      ) : (
                        <>
                          <ArrowDown className="w-3 h-3 text-amber-400" />
                          <span>DOWN</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-slate-400 text-[10px]">Angle:</span>
                    <input
                      type="number"
                      step="5"
                      min="30"
                      max="165"
                      value={part.bends[idx].angle}
                      onChange={(e) => handleBendAngleChange(idx, parseFloat(e.target.value) || 90)}
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-cyan-300 text-xs focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="text-slate-400 text-[10px]">°</span>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
