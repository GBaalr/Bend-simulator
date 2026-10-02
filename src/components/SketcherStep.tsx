import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Undo2,
  Magnet,
  Ruler,
  Weight,
  MousePointer,
  PenTool,
  RotateCcw,
} from 'lucide-react'
import { SheetMetalPart, Material, BendCalculation, Flange, Bend } from '../types/sheetMetal'
import { STANDARD_MATERIALS } from '../core/mathEngine'

interface SketcherStepProps {
  part: SheetMetalPart
  material: Material
  metrics: BendCalculation
  onUpdatePart: (p: SheetMetalPart) => void
  onUpdateMaterial: (m: Material) => void
  onNextStep: () => void
  onLoadPreset: (key: string) => void
}

type SketchMode = 'SELECT' | 'DRAW'
type CardinalDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

export const SketcherStep: React.FC<SketcherStepProps> = ({
  part,
  material,
  metrics,
  onUpdatePart,
  onUpdateMaterial,
  onNextStep,
}) => {
  // Modes: SELECT (click to select and edit / drag) vs DRAW (click on grid to add points)
  const [mode, setMode] = useState<SketchMode>('SELECT')
  const [smartSnap, setSmartSnap] = useState(true)

  // Selection states
  const [selectedFlangeIdx, setSelectedFlangeIdx] = useState<number | null>(0)
  const [selectedBendIdx, setSelectedBendIdx] = useState<number | null>(null)

  // Dragging vertex state
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null)

  // Length for directional add
  const [addLength, setAddLength] = useState<number>(40)
  // Hover preview direction
  const [previewDirection, setPreviewDirection] = useState<CardinalDirection | null>(null)

  // Live cursor position in DRAW mode (in SVG world coordinates)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // 1. Calculate 2D coordinates of the finished profile for SVG rendering
  // Standard SVG coordinates: +X is Right, +Y is Down.
  // Direction 'UP' turns counter-clockwise towards negative Y (UP on screen).
  // Direction 'DOWN' turns clockwise towards positive Y (DOWN on screen).
  const profilePoints = useMemo(() => {
    let curX = 0
    let curY = 0
    let curAngleRad = 0 // horizontal towards +X
    const points: { x: number; y: number }[] = [{ x: curX, y: curY }]

    for (let i = 0; i < part.flanges.length; i++) {
      const len = part.flanges[i].length
      curX += len * Math.cos(curAngleRad)
      curY += len * Math.sin(curAngleRad)
      points.push({ x: curX, y: curY })

      if (i < part.bends.length) {
        const bend = part.bends[i]
        const turnDeg = 180 - bend.angle
        // UP turns towards negative Y (screen Up), DOWN turns towards positive Y (screen Down)
        const sign = bend.direction === 'UP' ? -1 : 1
        curAngleRad += (turnDeg * sign * Math.PI) / 180
      }
    }

    return points
  }, [part])

  // Current heading angle of the last flange in screen degrees (0 = Right, 90 = Down, 180 = Left, 270 = Up)
  const lastFlangeHeadingDeg = useMemo(() => {
    let heading = 0
    for (const bend of part.bends) {
      const turn = 180 - bend.angle
      const sign = bend.direction === 'UP' ? -1 : 1
      heading = (heading + sign * turn) % 360
    }
    if (heading < 0) heading += 360
    return Math.round(heading)
  }, [part.bends])

  // Responsive dynamic viewBox calculation based solely on profilePoints (rock-solid, zero shifting on hover)
  const viewBox = useMemo(() => {
    if (profilePoints.length === 0) return '-100 -100 400 300'
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    for (const p of profilePoints) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }

    // Generous padding (85px) to comfortably house compass arrows and ghost lines without shifting viewBox
    const padding = 85
    const w = Math.max(280, maxX - minX + padding * 2)
    const h = Math.max(220, maxY - minY + padding * 2)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`
  }, [profilePoints])

  // Convert Mouse/Touch client coords into SVG viewBox world coordinates
  const clientToSvgCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current
    if (!svg) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const screenCTM = svg.getScreenCTM()
    if (!screenCTM) return null
    const svgPt = pt.matrixTransform(screenCTM.inverse())
    return { x: svgPt.x, y: svgPt.y }
  }

  // Snapping logic
  const snapCoords = (
    rawX: number,
    rawY: number,
    anchor: { x: number; y: number }
  ): { x: number; y: number; length: number; angleRad: number } => {
    let dx = rawX - anchor.x
    let dy = rawY - anchor.y
    let length = Math.hypot(dx, dy)
    let angleRad = Math.atan2(dy, dx)

    if (smartSnap) {
      // Snap length to nearest 5mm
      length = Math.max(10, Math.round(length / 5) * 5)
      // Snap angle to 45° increments (PI/4)
      const snapAngleInc = Math.PI / 4
      angleRad = Math.round(angleRad / snapAngleInc) * snapAngleInc
    }

    return {
      x: anchor.x + length * Math.cos(angleRad),
      y: anchor.y + length * Math.sin(angleRad),
      length,
      angleRad,
    }
  }

  // Mouse Handlers
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = clientToSvgCoords(e.clientX, e.clientY)
    if (!coords) return

    if (draggingVertexIdx !== null && selectedFlangeIdx !== null) {
      // Adjust flange length via dragging
      const vIdx = draggingVertexIdx
      if (vIdx <= 0 || vIdx >= profilePoints.length) return
      const prevPt = profilePoints[vIdx - 1]
      const dx = coords.x - prevPt.x
      const dy = coords.y - prevPt.y
      const newLen = Math.max(10, Math.round(Math.hypot(dx, dy) / (smartSnap ? 5 : 1)) * (smartSnap ? 5 : 1))

      const updatedFlanges = [...part.flanges]
      if (updatedFlanges[vIdx - 1]) {
        updatedFlanges[vIdx - 1] = {
          ...updatedFlanges[vIdx - 1],
          length: newLen,
        }
        onUpdatePart({ ...part, flanges: updatedFlanges })
      }
      return
    }

    if (mode === 'DRAW') {
      const lastPt = profilePoints[profilePoints.length - 1]
      const snapped = snapCoords(coords.x, coords.y, lastPt)
      setCursorPos({ x: snapped.x, y: snapped.y })
    }
  }

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (mode !== 'DRAW') return
    const coords = clientToSvgCoords(e.clientX, e.clientY)
    if (!coords) return

    const lastIdx = profilePoints.length - 1
    const lastPt = profilePoints[lastIdx]
    const snapped = snapCoords(coords.x, coords.y, lastPt)
    if (snapped.length < 5) return

    let newBendAngle = 90
    let newBendDirection: 'UP' | 'DOWN' = 'UP'

    if (profilePoints.length >= 2) {
      const pPrev = profilePoints[lastIdx - 1]
      const prevDx = lastPt.x - pPrev.x
      const prevDy = lastPt.y - pPrev.y
      const curDx = snapped.x - lastPt.x
      const curDy = snapped.y - lastPt.y

      const prevAngle = Math.atan2(prevDy, prevDx)
      const curAngle = Math.atan2(curDy, curDx)
      let diff = curAngle - prevAngle

      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2

      const turnDeg = Math.round((Math.abs(diff) * 180) / Math.PI)
      newBendAngle = Math.max(30, Math.min(170, 180 - turnDeg))
      // In SVG screen coords: diff < 0 is turning CCW towards screen top (UP)
      newBendDirection = diff < 0 ? 'UP' : 'DOWN'
    }

    const newFlange: Flange = {
      id: `flange-${Date.now()}-${part.flanges.length}`,
      length: Math.max(10, Math.round(snapped.length)),
    }

    const newBend: Bend = {
      id: `bend-${Date.now()}-${part.bends.length}`,
      angle: newBendAngle,
      direction: newBendDirection,
      radius: 1.5,
    }

    onUpdatePart({
      ...part,
      flanges: [...part.flanges, newFlange],
      bends: [...part.bends, newBend],
    })
    setSelectedFlangeIdx(part.flanges.length)
    setSelectedBendIdx(null)
  }

  const handleMouseUp = () => {
    setDraggingVertexIdx(null)
  }

  // LOGICAL & VISUAL DIRECTIONAL FLANGE ADDITION
  // Calculates exact bend angle and direction so the added flange points EXACTLY in the chosen screen direction.
  const handleAddFlangeInDirection = (targetDir: CardinalDirection, len: number = addLength) => {
    const currentHeading = lastFlangeHeadingDeg
    const targetHeadings: Record<CardinalDirection, number> = {
      RIGHT: 0,
      DOWN: 90,
      LEFT: 180,
      UP: 270,
    }
    const targetDeg = targetHeadings[targetDir]
    let diffDeg = targetDeg - currentHeading

    while (diffDeg > 180) diffDeg -= 360
    while (diffDeg <= -180) diffDeg += 360

    // If heading in the same direction: extend last flange length smoothly
    if (Math.abs(diffDeg) < 5) {
      const lastIdx = part.flanges.length - 1
      const updated = [...part.flanges]
      updated[lastIdx] = {
        ...updated[lastIdx],
        length: updated[lastIdx].length + len,
      }
      onUpdatePart({ ...part, flanges: updated })
      setSelectedFlangeIdx(lastIdx)
      setSelectedBendIdx(null)
      return
    }

    let bendAngle = 90
    let bendDir: 'UP' | 'DOWN' = 'UP'

    if (Math.abs(diffDeg) >= 175) {
      // 180° return / tight fold
      bendAngle = 30
      bendDir = 'UP'
    } else {
      const turnAngle = Math.abs(diffDeg)
      bendAngle = Math.max(30, Math.min(170, Math.round(180 - turnAngle)))
      // diffDeg < 0 turns counter-clockwise towards negative Y (UP on screen)
      // diffDeg > 0 turns clockwise towards positive Y (DOWN on screen)
      bendDir = diffDeg < 0 ? 'UP' : 'DOWN'
    }

    const newFlange: Flange = {
      id: `flange-${Date.now()}-${part.flanges.length}`,
      length: len,
    }
    const newBend: Bend = {
      id: `bend-${Date.now()}-${part.bends.length}`,
      angle: bendAngle,
      direction: bendDir,
      radius: 1.5,
    }

    onUpdatePart({
      ...part,
      flanges: [...part.flanges, newFlange],
      bends: [...part.bends, newBend],
    })
    setSelectedFlangeIdx(part.flanges.length)
    setSelectedBendIdx(null)
  }

  // DELETE FLANGE
  const handleDeleteFlange = (flangeIdx: number) => {
    if (part.flanges.length <= 1) return
    const newFlanges = part.flanges.filter((_, i) => i !== flangeIdx)
    const newBends = part.bends.slice(0, newFlanges.length - 1)
    onUpdatePart({ ...part, flanges: newFlanges, bends: newBends })
    setSelectedFlangeIdx(Math.max(0, flangeIdx - 1))
    setSelectedBendIdx(null)
  }

  // DELETE BEND
  const handleDeleteBend = (bendIdx: number) => {
    if (part.bends.length === 0) return
    const newBends = part.bends.filter((_, i) => i !== bendIdx)
    const newFlanges = part.flanges.slice(0, newBends.length + 1)
    onUpdatePart({ ...part, flanges: newFlanges, bends: newBends })
    setSelectedFlangeIdx(Math.max(0, bendIdx))
    setSelectedBendIdx(null)
  }

  // UNDO LAST ADDITION
  const handleUndo = () => {
    if (part.flanges.length <= 1) return
    const newFlanges = part.flanges.slice(0, -1)
    const newBends = part.bends.slice(0, -1)
    onUpdatePart({ ...part, flanges: newFlanges, bends: newBends })
    setSelectedFlangeIdx(newFlanges.length - 1)
    setSelectedBendIdx(null)
  }

  // RESET TO BLANK SHEET
  const handleResetBlank = () => {
    onUpdatePart({
      name: 'Custom Sketched Part',
      thickness: part.thickness,
      width: part.width,
      materialId: part.materialId,
      flanges: [{ id: 'f0', length: 50 }],
      bends: [],
    })
    setSelectedFlangeIdx(0)
    setSelectedBendIdx(null)
  }

  // Keyboard Shortcuts: Delete, Undo (Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        handleUndo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBendIdx !== null) {
          e.preventDefault()
          handleDeleteBend(selectedBendIdx)
        } else if (selectedFlangeIdx !== null && part.flanges.length > 1) {
          e.preventDefault()
          handleDeleteFlange(selectedFlangeIdx)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFlangeIdx, selectedBendIdx, part])

  // Ghost Line preview calculations
  const ghostSegment = useMemo(() => {
    if (!previewDirection || profilePoints.length === 0) return null
    const start = profilePoints[profilePoints.length - 1]
    const offsets: Record<CardinalDirection, { dx: number; dy: number }> = {
      UP: { dx: 0, dy: -addLength },
      DOWN: { dx: 0, dy: addLength },
      LEFT: { dx: -addLength, dy: 0 },
      RIGHT: { dx: addLength, dy: 0 },
    }
    const end = {
      x: start.x + offsets[previewDirection].dx,
      y: start.y + offsets[previewDirection].dy,
    }
    return { start, end, dir: previewDirection }
  }, [previewDirection, profilePoints, addLength])

  const endPoint = profilePoints[profilePoints.length - 1] || { x: 0, y: 0 }

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950 select-none">
      {/* LEFT SIDEBAR: Clean, Focused Controls */}
      <div className="w-80 md:w-88 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-800/80 px-2 py-0.5 rounded-full">
            Step 1 of 4
          </span>
          <h2 className="text-sm font-bold text-white mt-1">2D Profile Sketcher</h2>
          <p className="text-[11px] text-slate-400">
            Design sheet profile by extending flanges in any direction or clicking to draw.
          </p>
        </div>

        {/* Sheet Material & Dimensions */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px]">
            <span>Sheet Properties</span>
            <span className="text-cyan-400 font-mono">T = {part.thickness}mm</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Thickness</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="12"
                value={part.thickness}
                onChange={(e) =>
                  onUpdatePart({ ...part, thickness: parseFloat(e.target.value) || 1 })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Width (mm)</label>
              <input
                type="number"
                step="50"
                min="50"
                max="3000"
                value={part.width}
                onChange={(e) =>
                  onUpdatePart({ ...part, width: parseFloat(e.target.value) || 100 })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Material</label>
              <select
                value={material.id}
                onChange={(e) => {
                  const found = STANDARD_MATERIALS.find((m) => m.id === e.target.value)
                  if (found) {
                    onUpdateMaterial(found)
                    onUpdatePart({ ...part, materialId: found.id })
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-1 text-slate-100 text-[11px] focus:border-cyan-500 focus:outline-none"
              >
                {STANDARD_MATERIALS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name.split(' ')[0]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
            <div className="flex items-center space-x-1.5 text-[11px]">
              <Ruler className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-slate-400 font-mono">Blank: <strong className="text-slate-200">{metrics.flatLength}mm</strong></span>
            </div>
            <div className="flex items-center space-x-1.5 text-[11px]">
              <Weight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-slate-400 font-mono">Force: <strong className="text-slate-200">{metrics.totalTonnage}T</strong></span>
            </div>
          </div>
        </div>

        {/* LOGICAL & VISUAL COMPASS D-PAD */}
        <div className="bg-slate-950/70 border border-cyan-800/40 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              Add Next Flange to End
            </span>
            <div className="flex items-center space-x-1 text-[11px] font-mono">
              <span className="text-slate-400">Len:</span>
              <input
                type="number"
                min="10"
                max="500"
                step="5"
                value={addLength}
                onChange={(e) => setAddLength(Math.max(10, parseFloat(e.target.value) || 40))}
                className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-cyan-300 font-bold focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-slate-400">mm</span>
            </div>
          </div>

          {/* Cross Pad */}
          <div className="flex flex-col items-center justify-center py-1">
            {/* UP BUTTON */}
            <button
              onClick={() => handleAddFlangeInDirection('UP')}
              onMouseEnter={() => setPreviewDirection('UP')}
              onMouseLeave={() => setPreviewDirection(null)}
              className="w-24 py-1.5 bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-200 rounded-t-lg border border-slate-700 flex items-center justify-center space-x-1 text-xs font-bold transition shadow-sm"
              title="Add flange extending UPWARDS on screen"
            >
              <ArrowUp className="w-3.5 h-3.5 text-cyan-400 group-hover:text-white" />
              <span>UP</span>
            </button>

            {/* MIDDLE ROW: LEFT, CENTER INDICATOR, RIGHT */}
            <div className="flex items-center space-x-1 my-1">
              <button
                onClick={() => handleAddFlangeInDirection('LEFT')}
                onMouseEnter={() => setPreviewDirection('LEFT')}
                onMouseLeave={() => setPreviewDirection(null)}
                className="w-20 py-2 bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-200 rounded-l-lg border border-slate-700 flex items-center justify-center space-x-1 text-xs font-bold transition shadow-sm"
                title="Add flange extending LEFTWARDS on screen"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
                <span>LEFT</span>
              </button>

              <div className="w-16 h-8 bg-slate-900 border border-slate-800 rounded flex flex-col items-center justify-center text-[9px] font-mono text-slate-400">
                <span>{addLength}mm</span>
              </div>

              <button
                onClick={() => handleAddFlangeInDirection('RIGHT')}
                onMouseEnter={() => setPreviewDirection('RIGHT')}
                onMouseLeave={() => setPreviewDirection(null)}
                className="w-20 py-2 bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-200 rounded-r-lg border border-slate-700 flex items-center justify-center space-x-1 text-xs font-bold transition shadow-sm"
                title="Add flange extending RIGHTWARDS on screen"
              >
                <span>RIGHT</span>
                <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
              </button>
            </div>

            {/* DOWN BUTTON */}
            <button
              onClick={() => handleAddFlangeInDirection('DOWN')}
              onMouseEnter={() => setPreviewDirection('DOWN')}
              onMouseLeave={() => setPreviewDirection(null)}
              className="w-24 py-1.5 bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-200 rounded-b-lg border border-slate-700 flex items-center justify-center space-x-1 text-xs font-bold transition shadow-sm"
              title="Add flange extending DOWNWARDS on screen"
            >
              <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
              <span>DOWN</span>
            </button>
          </div>
        </div>

        {/* INSPECTOR & FLANGE LIST (Unified, Clean) */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">
              Profile Segments ({part.flanges.length})
            </span>
            <button
              onClick={handleResetBlank}
              className="text-[11px] text-slate-400 hover:text-red-400 transition"
              title="Reset profile to single 50mm blank sheet"
            >
              Reset Sheet
            </button>
          </div>

          <div className="space-y-1.5">
            {part.flanges.map((flange, idx) => {
              const isSelected = selectedFlangeIdx === idx && selectedBendIdx === null

              return (
                <React.Fragment key={`flange-row-${idx}`}>
                  {/* Flange Row */}
                  <div
                    onClick={() => {
                      setSelectedFlangeIdx(idx)
                      setSelectedBendIdx(null)
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition text-xs ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-500 text-white'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded bg-slate-800 text-cyan-300 text-[10px] font-mono font-bold flex items-center justify-center">
                        F{idx + 1}
                      </span>
                      <span className="font-medium text-slate-200">Flange {idx + 1}</span>
                    </div>

                    <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        min="5"
                        max="1000"
                        value={flange.length}
                        onChange={(e) => {
                          const updated = [...part.flanges]
                          updated[idx].length = Math.max(5, parseFloat(e.target.value) || 5)
                          onUpdatePart({ ...part, flanges: updated })
                        }}
                        className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-xs focus:border-cyan-500 focus:outline-none text-slate-100"
                      />
                      <span className="text-[10px] text-slate-400">mm</span>

                      {part.flanges.length > 1 && (
                        <button
                          onClick={() => handleDeleteFlange(idx)}
                          className="text-slate-500 hover:text-red-400 p-1 transition"
                          title="Delete Flange"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bend Row (Between Flange idx and Flange idx + 1) */}
                  {idx < part.bends.length && (
                    <div
                      onClick={() => {
                        setSelectedBendIdx(idx)
                        setSelectedFlangeIdx(null)
                      }}
                      className={`ml-4 pl-3 border-l-2 py-1 flex items-center justify-between text-xs cursor-pointer transition ${
                        selectedBendIdx === idx
                          ? 'border-amber-500 bg-amber-950/20 rounded-r'
                          : 'border-cyan-800/40 hover:border-cyan-600'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold text-cyan-400">
                          Bend {idx + 1}
                        </span>
                        {/* Clear Direction Toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const updated = [...part.bends]
                            updated[idx].direction = updated[idx].direction === 'UP' ? 'DOWN' : 'UP'
                            onUpdatePart({ ...part, bends: updated })
                          }}
                          className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border transition flex items-center space-x-0.5 ${
                            part.bends[idx].direction === 'UP'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                              : 'bg-amber-950/80 text-amber-300 border-amber-700'
                          }`}
                          title="Click to toggle bend direction (UP / DOWN)"
                        >
                          {part.bends[idx].direction === 'UP' ? (
                            <>
                              <ArrowUp className="w-2.5 h-2.5" />
                              <span>UP</span>
                            </>
                          ) : (
                            <>
                              <ArrowDown className="w-2.5 h-2.5" />
                              <span>DOWN</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          min="30"
                          max="170"
                          value={part.bends[idx].angle}
                          onChange={(e) => {
                            const updated = [...part.bends]
                            updated[idx].angle = Math.max(30, Math.min(170, parseFloat(e.target.value) || 90))
                            onUpdatePart({ ...part, bends: updated })
                          }}
                          className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-right font-mono text-cyan-300 text-xs focus:border-cyan-500 focus:outline-none"
                        />
                        <span className="text-slate-400 text-[10px]">°</span>

                        <button
                          onClick={() => handleDeleteBend(idx)}
                          className="text-slate-500 hover:text-red-400 p-1 transition"
                          title="Delete Bend"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Primary Proceed Button */}
        <div className="pt-2 border-t border-slate-800">
          <button
            onClick={onNextStep}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-cyan-600/20 transition"
          >
            <span>Proceed to Tooling Setup</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CENTER DRAWING CANVAS: Clean CAD Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Streamlined Top Canvas Toolbar */}
        <div className="h-11 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between z-10">
          <div className="flex items-center space-x-2">
            {/* Mode Switcher */}
            <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setMode('SELECT')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition font-medium ${
                  mode === 'SELECT'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span>Select & Edit</span>
              </button>
              <button
                onClick={() => setMode('DRAW')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition font-medium ${
                  mode === 'DRAW'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Draw on Grid</span>
              </button>
            </div>

            {/* Smart Snap Toggle */}
            <button
              onClick={() => setSmartSnap(!smartSnap)}
              className={`flex items-center space-x-1 px-2 py-1 rounded border text-xs transition ${
                smartSnap
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="Snap to 45° and 5mm increments"
            >
              <Magnet className="w-3.5 h-3.5" />
              <span>Snap (45° / 5mm)</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {part.flanges.length > 1 && (
              <button
                onClick={handleUndo}
                className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs transition"
                title="Undo last flange (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Undo</span>
              </button>
            )}

            <button
              onClick={handleResetBlank}
              className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700 text-xs transition"
              title="Clear to blank sheet"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* SVG Drawing Canvas */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-hidden relative">
          {/* Engineering Background Grid */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #38bdf8 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <svg
            ref={svgRef}
            viewBox={viewBox}
            onMouseMove={handleSvgMouseMove}
            onClick={handleSvgClick}
            onMouseUp={handleMouseUp}
            className={`w-full h-full max-w-4xl max-h-[650px] overflow-visible select-none ${
              mode === 'DRAW' ? 'cursor-crosshair' : 'cursor-default'
            }`}
          >
            <defs>
              <marker
                id="arrow-cyan"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#38bdf8" />
              </marker>
              <marker
                id="arrow-slate"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 2 L 10 5 L 0 8 z" fill="#64748b" />
              </marker>
            </defs>

            {/* Datum origin axes */}
            <line x1={-25} y1={0} x2={25} y2={0} stroke="#334155" strokeWidth={1} strokeDasharray="3,3" />
            <line x1={0} y1={-25} x2={0} y2={25} stroke="#334155" strokeWidth={1} strokeDasharray="3,3" />

            {/* 1. DRAW EXISTING FLANGES */}
            {profilePoints.slice(0, -1).map((p1, idx) => {
              const p2 = profilePoints[idx + 1]
              const isSelected = selectedFlangeIdx === idx && selectedBendIdx === null
              const flange = part.flanges[idx]

              const dx = p2.x - p1.x
              const dy = p2.y - p1.y
              const len = Math.hypot(dx, dy)
              if (len < 1e-4) return null

              const ux = dx / len
              const uy = dy / len
              const nx = -uy * 18
              const ny = ux * 18

              const d1x = p1.x + nx
              const d1y = p1.y + ny
              const d2x = p2.x + nx
              const d2y = p2.y + ny
              const midX = (d1x + d2x) / 2
              const midY = (d1y + d2y) / 2

              return (
                <g key={`flange-geom-${idx}`}>
                  {/* Flange Thick Line */}
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={isSelected ? '#38bdf8' : '#cbd5e1'}
                    strokeWidth={Math.max(part.thickness * 1.5, 4.5)}
                    strokeLinecap="round"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFlangeIdx(idx)
                      setSelectedBendIdx(null)
                    }}
                    className="cursor-pointer hover:stroke-cyan-400 transition-colors"
                  />

                  {/* CAD Dimension Extension Lines */}
                  <line
                    x1={p1.x + nx * 0.2}
                    y1={p1.y + ny * 0.2}
                    x2={p1.x + nx * 1.2}
                    y2={p1.y + ny * 1.2}
                    stroke="#475569"
                    strokeWidth={0.7}
                    strokeDasharray="2,2"
                  />
                  <line
                    x1={p2.x + nx * 0.2}
                    y1={p2.y + ny * 0.2}
                    x2={p2.x + nx * 1.2}
                    y2={p2.y + ny * 1.2}
                    stroke="#475569"
                    strokeWidth={0.7}
                    strokeDasharray="2,2"
                  />

                  {/* CAD Dimension Line */}
                  <line
                    x1={d1x}
                    y1={d1y}
                    x2={d2x}
                    y2={d2y}
                    stroke={isSelected ? '#38bdf8' : '#64748b'}
                    strokeWidth={0.9}
                    markerStart={isSelected ? 'url(#arrow-cyan)' : 'url(#arrow-slate)'}
                    markerEnd={isSelected ? 'url(#arrow-cyan)' : 'url(#arrow-slate)'}
                  />

                  {/* Editable Dimension Callout Badge right on sketch */}
                  <foreignObject
                    x={midX - 22}
                    y={midY - 8.5}
                    width={44}
                    height={17}
                    className="overflow-visible"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFlangeIdx(idx)
                      setSelectedBendIdx(null)
                    }}
                  >
                    <div className="flex items-center justify-center w-full h-full">
                      <input
                        type="number"
                        min="5"
                        max="2000"
                        step="1"
                        value={flange.length}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedFlangeIdx(idx)
                          setSelectedBendIdx(null)
                        }}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          if (!isNaN(val) && val >= 5) {
                            const updated = [...part.flanges]
                            updated[idx] = { ...flange, length: Math.round(val * 10) / 10 }
                            onUpdatePart({ ...part, flanges: updated })
                          }
                        }}
                        className={`w-full h-full text-center font-mono font-bold text-[9px] rounded px-0.5 border transition outline-none cursor-text ${
                          isSelected
                            ? 'bg-sky-950/95 text-cyan-300 border-cyan-400 ring-1 ring-cyan-500/40 shadow-sm'
                            : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:border-slate-500'
                        }`}
                        title="Click to type flange length (mm)"
                      />
                    </div>
                  </foreignObject>
                </g>
              )
            })}

            {/* 2. DRAW BEND DOTS & ANGLE BADGES */}
            {profilePoints.map((p, idx) => {
              const isStart = idx === 0
              const isEnd = idx === profilePoints.length - 1
              const isIntermediate = !isStart && !isEnd
              const isBendSelected = selectedBendIdx === idx - 1

              return (
                <g key={`vertex-dot-${idx}`} className="group/dot">
                  {/* Selection Ring */}
                  {isBendSelected && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={7}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      className="animate-pulse pointer-events-none"
                    />
                  )}

                  {/* Stable hit target for click/drag */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={10}
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isIntermediate) {
                        setSelectedBendIdx(idx - 1)
                        setSelectedFlangeIdx(null)
                      }
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      if (mode === 'SELECT' && idx > 0) {
                        setDraggingVertexIdx(idx)
                        setSelectedFlangeIdx(idx - 1)
                        setSelectedBendIdx(null)
                      }
                    }}
                  />

                  {/* Steady Visible Dot Core */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isStart ? 3.8 : isEnd ? 4.2 : 3.2}
                    fill={isStart ? '#10b981' : isEnd ? '#06b6d4' : isBendSelected ? '#f59e0b' : '#0284c7'}
                    stroke="#ffffff"
                    strokeWidth={1.2}
                    className="pointer-events-none group-hover/dot:stroke-cyan-300 transition-colors"
                  />

                  {/* Clean Editable Angle Badge for Bends */}
                  {isIntermediate && (
                    <foreignObject
                      x={p.x - 19}
                      y={p.y - 22}
                      width={38}
                      height={15}
                      className="overflow-visible"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedBendIdx(idx - 1)
                        setSelectedFlangeIdx(null)
                      }}
                    >
                      <div className="flex items-center justify-center w-full h-full">
                        <input
                          type="number"
                          min="30"
                          max="170"
                          step="1"
                          value={part.bends[idx - 1]?.angle ?? 90}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedBendIdx(idx - 1)
                            setSelectedFlangeIdx(null)
                          }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            if (!isNaN(val) && val >= 30 && val <= 170) {
                              const updated = [...part.bends]
                              updated[idx - 1] = {
                                ...updated[idx - 1],
                                angle: Math.round(val * 10) / 10,
                              }
                              onUpdatePart({ ...part, bends: updated })
                            }
                          }}
                          className={`w-full h-full text-center font-mono font-bold text-[8px] rounded px-0.5 border transition outline-none cursor-text ${
                            isBendSelected
                              ? 'bg-amber-950/95 text-amber-300 border-amber-400 ring-1 ring-amber-500/40'
                              : 'bg-slate-900/90 text-sky-300 border-slate-700 hover:border-slate-500'
                          }`}
                          title="Click to edit bend angle (°)"
                        />
                      </div>
                    </foreignObject>
                  )}
                </g>
              )
            })}

            {/* 3. INTERACTIVE COMPACT ON-CANVAS DIRECTION ARROWS AT END OF SHEET */}
            {mode === 'SELECT' && profilePoints.length > 0 && (
              <g className="cursor-pointer">
                {/* Visual Arrow Pad at Sheet End: UP, DOWN, LEFT, RIGHT */}
                {(
                  [
                    { dir: 'UP', ox: 0, oy: -19, icon: '▲' },
                    { dir: 'DOWN', ox: 0, oy: 19, icon: '▼' },
                    { dir: 'LEFT', ox: -19, oy: 0, icon: '◀' },
                    { dir: 'RIGHT', ox: 19, oy: 0, icon: '▶' },
                  ] as const
                ).map(({ dir, ox, oy, icon }) => (
                  <g
                    key={`oncanvas-arrow-${dir}`}
                    transform={`translate(${endPoint.x + ox}, ${endPoint.y + oy})`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAddFlangeInDirection(dir)
                    }}
                    onMouseEnter={() => setPreviewDirection(dir)}
                    onMouseLeave={() => setPreviewDirection(null)}
                    className="group/arrow cursor-pointer"
                  >
                    {/* Generous hit area preventing mouse drop-offs */}
                    <circle r={11} fill="transparent" />
                    {/* Visible compact arrow button */}
                    <circle
                      r={7}
                      fill="#0f172a"
                      stroke="#06b6d4"
                      strokeWidth={1.0}
                      className="group-hover/arrow:fill-cyan-600 group-hover/arrow:stroke-white transition-colors pointer-events-none"
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={6.5}
                      fontWeight="bold"
                      fill="#38bdf8"
                      style={{ pointerEvents: 'none' }}
                      className="group-hover/arrow:fill-white select-none pointer-events-none"
                    >
                      {icon}
                    </text>
                  </g>
                ))}

                {/* Inline Next Flange Size Input Badge right near the sketch tip */}
                <foreignObject
                  x={endPoint.x + 12}
                  y={endPoint.y - 17}
                  width={36}
                  height={15}
                  className="overflow-visible"
                >
                  <div
                    className="flex items-center space-x-0.5 bg-slate-900/90 border border-cyan-500/70 hover:border-cyan-400 rounded px-1 h-full shadow-sm"
                    title="Length of next flange to add (mm)"
                  >
                    <span className="text-[7.5px] text-cyan-400 font-bold select-none">+</span>
                    <input
                      type="number"
                      min="5"
                      max="500"
                      step="5"
                      value={addLength}
                      onChange={(e) => setAddLength(Math.max(5, parseFloat(e.target.value) || 10))}
                      className="w-5 bg-transparent text-cyan-200 text-center font-mono font-bold text-[8px] outline-none cursor-text"
                    />
                  </div>
                </foreignObject>
              </g>
            )}

            {/* 4. LIVE DASHED GHOST PREVIEW LINE (Strictly pointer-events-none so it never intercepts mouse) */}
            {ghostSegment && (
              <g style={{ pointerEvents: 'none' }} className="animate-pulse">
                <line
                  x1={ghostSegment.start.x}
                  y1={ghostSegment.start.y}
                  x2={ghostSegment.end.x}
                  y2={ghostSegment.end.y}
                  stroke="#22d3ee"
                  strokeWidth={part.thickness * 1.5}
                  strokeDasharray="4,4"
                  strokeLinecap="round"
                  style={{ pointerEvents: 'none' }}
                />
                <circle cx={ghostSegment.end.x} cy={ghostSegment.end.y} r={3.5} fill="#22d3ee" style={{ pointerEvents: 'none' }} />
                <rect
                  x={(ghostSegment.start.x + ghostSegment.end.x) / 2 - 20}
                  y={(ghostSegment.start.y + ghostSegment.end.y) / 2 - 8}
                  width={40}
                  height={15}
                  rx={3}
                  fill="#082f49"
                  stroke="#22d3ee"
                  strokeWidth={1}
                  style={{ pointerEvents: 'none' }}
                />
                <text
                  x={(ghostSegment.start.x + ghostSegment.end.x) / 2}
                  y={(ghostSegment.start.y + ghostSegment.end.y) / 2}
                  fill="#ffffff"
                  fontSize={8}
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ pointerEvents: 'none' }}
                >
                  +{addLength}mm
                </text>
              </g>
            )}

            {/* 5. DRAW LIVE RUBBERBAND LINE IN 'DRAW' MODE */}
            {mode === 'DRAW' && cursorPos && (
              <g className="pointer-events-none">
                <line
                  x1={endPoint.x}
                  y1={endPoint.y}
                  x2={cursorPos.x}
                  y2={cursorPos.y}
                  stroke="#38bdf8"
                  strokeWidth={2}
                  strokeDasharray="3,3"
                />
                <circle cx={cursorPos.x} cy={cursorPos.y} r={4} fill="#38bdf8" />
              </g>
            )}
          </svg>

          {/* Minimal 1-line Canvas Hint Banner */}
          <div className="absolute bottom-3 left-4 text-[10px] text-slate-400 bg-slate-900/80 backdrop-blur border border-slate-800 px-2.5 py-1 rounded-md flex items-center space-x-2 pointer-events-none">
            <span>Click ▲ ▼ ◀ ▶ to add flanges</span>
            <span className="text-slate-600">•</span>
            <span>Hover arrows for live preview</span>
            <span className="text-slate-600">•</span>
            <span>Drag dots to resize</span>
          </div>
        </div>
      </div>
    </div>
  )
}
