import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Ruler,
  Weight,
  ArrowRight,
  RotateCcw,
  Check,
  MousePointer,
  PenTool,
  Magnet,
  Undo2,
  X,
  Sliders,
  CheckCircle2,
} from 'lucide-react'
import { SheetMetalPart, Material, BendCalculation, Flange, Bend } from '../types/sheetMetal'
import { STANDARD_MATERIALS } from '../core/mathEngine'
import { SAMPLE_PRESETS } from '../core/presets'

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

export const SketcherStep: React.FC<SketcherStepProps> = ({
  part,
  material,
  metrics,
  onUpdatePart,
  onUpdateMaterial,
  onNextStep,
  onLoadPreset,
}) => {
  // Modes: SELECT (click to select and edit / drag) vs DRAW (click on grid to add points)
  const [mode, setMode] = useState<SketchMode>('SELECT')
  const [snapToAngle, setSnapToAngle] = useState(true) // snap to 45° increments
  const [snapToGrid, setSnapToGrid] = useState(true)   // snap to 5mm increments

  // Selection states
  const [selectedFlangeIdx, setSelectedFlangeIdx] = useState<number | null>(0)
  const [selectedVertexIdx, setSelectedVertexIdx] = useState<number | null>(null)

  // Active anchor dot from which new flanges are drawn
  const [activeAnchorIdx, setActiveAnchorIdx] = useState<number | null>(null)

  // Mobile layout tab toggle: Canvas vs Specs & Flanges
  const [mobileTab, setMobileTab] = useState<'CANVAS' | 'SPECS'>('CANVAS')

  // Direct In-Place Edit Popups
  const [editingDimensionIdx, setEditingDimensionIdx] = useState<number | null>(null)
  const [editingAngleIdx, setEditingAngleIdx] = useState<number | null>(null)
  const [tempDimValue, setTempDimValue] = useState<string>('')

  // Dragging vertex state
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null)

  // Live cursor position in DRAW mode (in SVG world coordinates)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // 1. Calculate 2D coordinates of the finished profile for SVG rendering
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
        const sign = bend.direction === 'UP' ? 1 : -1
        curAngleRad += (turnDeg * sign * Math.PI) / 180
      }
    }

    return points
  }, [part])

  // Effective anchor index: safely clamped within bounds of profilePoints
  const effectiveAnchorIdx = useMemo(() => {
    if (
      activeAnchorIdx === null ||
      activeAnchorIdx < 0 ||
      activeAnchorIdx >= profilePoints.length
    ) {
      return profilePoints.length - 1
    }
    return activeAnchorIdx
  }, [activeAnchorIdx, profilePoints.length])

  // 2. Compute SVG ViewBox: COMPLETELY STABLE!
  // ONLY derived from committed profile points, NEVER from mouse cursor position!
  // This guarantees 0% flickering / zero screen jitter when moving the mouse!
  const { viewBox, minX, minY, w, h } = useMemo(() => {
    if (profilePoints.length === 0) {
      return { viewBox: '-120 -120 240 240', minX: -120, minY: -120, w: 240, h: 240 }
    }
    let pMinX = Infinity
    let pMaxX = -Infinity
    let pMinY = Infinity
    let pMaxY = -Infinity

    for (const p of profilePoints) {
      if (p.x < pMinX) pMinX = p.x
      if (p.x > pMaxX) pMaxX = p.x
      if (p.y < pMinY) pMinY = p.y
      if (p.y > pMaxY) pMaxY = p.y
    }

    // Generous, stable margin
    const margin = 80
    const boxW = Math.max(260, pMaxX - pMinX + margin * 2)
    const boxH = Math.max(260, pMaxY - pMinY + margin * 2)
    const cx = (pMinX + pMaxX) / 2
    const cy = (pMinY + pMaxY) / 2

    return {
      viewBox: `${cx - boxW / 2} ${cy - boxH / 2} ${boxW} ${boxH}`,
      minX: cx - boxW / 2,
      minY: cy - boxH / 2,
      w: boxW,
      h: boxH,
    }
  }, [profilePoints])

  // Convert client mouse/touch event to stable SVG World Coordinates (mm)
  const getSvgCoordinates = (
    e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>
  ): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    let clientX = 0
    let clientY = 0

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX
      clientY = e.changedTouches[0].clientY
    } else if ('clientX' in e) {
      clientX = e.clientX
      clientY = e.clientY
    }

    const screenX = clientX - rect.left
    const screenY = clientY - rect.top

    const worldX = minX + (screenX / rect.width) * w
    const worldY = minY + (screenY / rect.height) * h
    return { x: worldX, y: worldY }
  }

  // Touch Handlers for Mobile / Tablet
  const handleSvgTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    handleSvgMouseMove(e as any)
  }

  const handleSvgTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    const rawPos = getSvgCoordinates(e)
    if (mode === 'DRAW') {
      const anchorPt = profilePoints[effectiveAnchorIdx]
      if (anchorPt) {
        const snapped = snapVector(anchorPt, rawPos)
        setCursorPos({ x: snapped.x, y: snapped.y })
      }
    }
  }

  const handleSvgTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
    if (draggingVertexIdx !== null) {
      setDraggingVertexIdx(null)
    } else if (mode === 'DRAW') {
      handleSvgClick(e as any)
    }
  }

  // Snapping helper for mouse drawing
  const snapVector = (
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): { x: number; y: number; length: number; angleDeg: number } => {
    let dx = to.x - from.x
    let dy = to.y - from.y
    let len = Math.hypot(dx, dy)
    let angleRad = Math.atan2(dy, dx)
    let angleDeg = (angleRad * 180) / Math.PI

    if (snapToAngle) {
      const snapIncrement = 45
      angleDeg = Math.round(angleDeg / snapIncrement) * snapIncrement
      angleRad = (angleDeg * Math.PI) / 180
    }

    if (snapToGrid) {
      len = Math.max(15, Math.round(len / 5) * 5)
    } else {
      len = Math.max(10, Math.round(len))
    }

    return {
      x: from.x + len * Math.cos(angleRad),
      y: from.y + len * Math.sin(angleRad),
      length: len,
      angleDeg: (angleDeg + 360) % 360,
    }
  }

  // Mouse Handlers on Canvas
  const handleSvgMouseMove = (
    e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>
  ) => {
    const rawPos = getSvgCoordinates(e)

    if (mode === 'DRAW') {
      const anchorPt = profilePoints[effectiveAnchorIdx]
      if (anchorPt) {
        const snapped = snapVector(anchorPt, rawPos)
        setCursorPos({ x: snapped.x, y: snapped.y })
      }
    } else if (draggingVertexIdx !== null) {
      // Dragging a vertex: adjust the flange length connected to it
      const vIdx = draggingVertexIdx
      if (vIdx === 0) return // keep datum pinned

      const prevPt = profilePoints[vIdx - 1]
      const snapped = snapVector(prevPt, rawPos)

      const updatedFlanges = [...part.flanges]
      updatedFlanges[vIdx - 1] = {
        ...updatedFlanges[vIdx - 1],
        length: Math.max(10, Math.round(snapped.length)),
      }
      onUpdatePart({ ...part, flanges: updatedFlanges })
    }
  }

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (mode !== 'DRAW') {
      // Clicking empty canvas deselects
      setSelectedVertexIdx(null)
      return
    }

    const rawPos = getSvgCoordinates(e)
    const anchorIdx = effectiveAnchorIdx
    const anchorPt = profilePoints[anchorIdx]
    if (!anchorPt) return

    const snapped = snapVector(anchorPt, rawPos)
    if (snapped.length < 5) return // Ignore accidental zero-distance clicks

    // Create new flange
    const newFlange: Flange = {
      id: `flange-${Date.now()}-${part.flanges.length}`,
      length: Math.max(10, Math.round(snapped.length)),
    }

    // CASE 1: Anchor is at the beginning (Dot 0) -> Prepend flange to start of part
    if (anchorIdx === 0) {
      let newBendAngle = 90
      let newBendDirection: 'UP' | 'DOWN' = 'UP'

      if (profilePoints.length >= 2) {
        const pNext = profilePoints[1]
        // Vector of new flange entering anchorPt (0): from snapped to anchorPt
        const inDx = anchorPt.x - snapped.x
        const inDy = anchorPt.y - snapped.y
        // Vector of existing Flange 0 leaving anchorPt (0): from anchorPt to pNext
        const outDx = pNext.x - anchorPt.x
        const outDy = pNext.y - anchorPt.y

        const inAngle = Math.atan2(inDy, inDx)
        const outAngle = Math.atan2(outDy, outDx)
        let diff = outAngle - inAngle

        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2

        const turnDeg = Math.round((Math.abs(diff) * 180) / Math.PI)
        newBendAngle = Math.max(30, Math.min(170, 180 - turnDeg))
        newBendDirection = diff >= 0 ? 'UP' : 'DOWN'
      }

      const newBend: Bend = {
        id: `bend-${Date.now()}-${part.bends.length}`,
        angle: newBendAngle,
        direction: newBendDirection,
        radius: 1.5,
      }

      onUpdatePart({
        ...part,
        flanges: [newFlange, ...part.flanges],
        bends: [newBend, ...part.bends],
      })
      setActiveAnchorIdx(0)
      setSelectedFlangeIdx(0)
      return
    }

    // CASE 2: Anchor is an intermediate dot -> Insert flange and split bend at anchorIdx
    if (anchorIdx < profilePoints.length - 1) {
      const pPrev = profilePoints[anchorIdx - 1]
      const pNext = profilePoints[anchorIdx + 1]

      // Bend A at anchorPt (between Flange anchorIdx-1 and newFlange)
      const prevDx = anchorPt.x - pPrev.x
      const prevDy = anchorPt.y - pPrev.y
      const curDx = snapped.x - anchorPt.x
      const curDy = snapped.y - anchorPt.y

      const prevAngle = Math.atan2(prevDy, prevDx)
      const curAngle = Math.atan2(curDy, curDx)
      let diffA = curAngle - prevAngle
      while (diffA > Math.PI) diffA -= Math.PI * 2
      while (diffA < -Math.PI) diffA += Math.PI * 2
      const turnDegA = Math.round((Math.abs(diffA) * 180) / Math.PI)
      const bendA_Angle = Math.max(30, Math.min(170, 180 - turnDegA))
      const bendA_Dir: 'UP' | 'DOWN' = diffA >= 0 ? 'UP' : 'DOWN'

      // Bend B at snapped (between newFlange and following Flange anchorIdx)
      const nextDx = pNext.x - anchorPt.x
      const nextDy = pNext.y - anchorPt.y
      const nextAngle = Math.atan2(nextDy, nextDx)
      let diffB = nextAngle - curAngle
      while (diffB > Math.PI) diffB -= Math.PI * 2
      while (diffB < -Math.PI) diffB += Math.PI * 2
      const turnDegB = Math.round((Math.abs(diffB) * 180) / Math.PI)
      const bendB_Angle = Math.max(30, Math.min(170, 180 - turnDegB))
      const bendB_Dir: 'UP' | 'DOWN' = diffB >= 0 ? 'UP' : 'DOWN'

      const bendA: Bend = {
        id: `bend-a-${Date.now()}`,
        angle: bendA_Angle,
        direction: bendA_Dir,
        radius: 1.5,
      }
      const bendB: Bend = {
        id: `bend-b-${Date.now()}`,
        angle: bendB_Angle,
        direction: bendB_Dir,
        radius: 1.5,
      }

      const updatedFlanges = [
        ...part.flanges.slice(0, anchorIdx),
        newFlange,
        ...part.flanges.slice(anchorIdx),
      ]
      const updatedBends = [
        ...part.bends.slice(0, anchorIdx - 1),
        bendA,
        bendB,
        ...part.bends.slice(anchorIdx),
      ]

      onUpdatePart({
        ...part,
        flanges: updatedFlanges,
        bends: updatedBends,
      })
      setActiveAnchorIdx(anchorIdx + 1)
      setSelectedFlangeIdx(anchorIdx)
      return
    }

    // CASE 3: Anchor is at the end (Default append)
    let newBendAngle = 90
    let newBendDirection: 'UP' | 'DOWN' = 'UP'

    if (profilePoints.length >= 2) {
      const pPrev = profilePoints[anchorIdx - 1]
      const prevDx = anchorPt.x - pPrev.x
      const prevDy = anchorPt.y - pPrev.y
      const curDx = snapped.x - anchorPt.x
      const curDy = snapped.y - anchorPt.y

      const prevAngle = Math.atan2(prevDy, prevDx)
      const curAngle = Math.atan2(curDy, curDx)
      let diff = curAngle - prevAngle

      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2

      const turnDeg = Math.round((Math.abs(diff) * 180) / Math.PI)
      newBendAngle = Math.max(30, Math.min(170, 180 - turnDeg))
      newBendDirection = diff >= 0 ? 'UP' : 'DOWN'
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
    setActiveAnchorIdx(part.flanges.length)
    setSelectedFlangeIdx(part.flanges.length)
  }

  // Branch from intermediate vertex: trim tail after vertex and continue drawing
  const handleBranchFromVertex = (vertexIdx: number) => {
    if (vertexIdx <= 0 || vertexIdx >= profilePoints.length - 1) return
    const newFlanges = part.flanges.slice(0, vertexIdx)
    const newBends = part.bends.slice(0, vertexIdx - 1)
    onUpdatePart({ ...part, flanges: newFlanges, bends: newBends })
    setActiveAnchorIdx(newFlanges.length)
    setSelectedFlangeIdx(newFlanges.length - 1)
    setSelectedVertexIdx(null)
    setMode('DRAW')
  }

  const handleMouseUp = () => {
    setDraggingVertexIdx(null)
  }

  // DELETE VERTEX (DOT): Removes the corner point and merges or deletes the connected flange
  const handleDeleteVertex = (vertexIdx: number) => {
    if (profilePoints.length <= 2) {
      // Only 1 flange left, reset to clean 50mm blank
      onUpdatePart({
        ...part,
        flanges: [{ id: 'f0', length: 50 }],
        bends: [],
      })
      setSelectedVertexIdx(null)
      setSelectedFlangeIdx(0)
      return
    }

    if (vertexIdx === 0) {
      // Removing starting point: drop first flange and first bend
      const newFlanges = part.flanges.slice(1)
      const newBends = part.bends.slice(1)
      onUpdatePart({ ...part, flanges: newFlanges, bends: newBends })
      setSelectedVertexIdx(null)
      setSelectedFlangeIdx(0)
      return
    }

    if (vertexIdx === profilePoints.length - 1) {
      // Removing end point: drop trailing flange and bend
      const newFlanges = part.flanges.slice(0, -1)
      const newBends = part.bends.slice(0, -1)
      onUpdatePart({ ...part, flanges: newFlanges, bends: newBends })
      setSelectedVertexIdx(null)
      setSelectedFlangeIdx(newFlanges.length - 1)
      return
    }

    // Removing an intermediate corner point:
    // Merge flange (vertexIdx - 1) and flange (vertexIdx)
    const pBefore = profilePoints[vertexIdx - 1]
    const pAfter = profilePoints[vertexIdx + 1]
    const mergedLength = Math.max(
      15,
      Math.round(Math.hypot(pAfter.x - pBefore.x, pAfter.y - pBefore.y))
    )

    const newBends = part.bends.filter((_, i) => i !== vertexIdx - 1)
    const newFlanges: Flange[] = []

    for (let i = 0; i < part.flanges.length; i++) {
      if (i === vertexIdx - 1) {
        newFlanges.push({ id: `flange-merged-${Date.now()}`, length: mergedLength })
      } else if (i === vertexIdx) {
        // omit merged flange
      } else {
        newFlanges.push(part.flanges[i])
      }
    }

    onUpdatePart({ ...part, flanges: newFlanges, bends: newBends })
    setSelectedVertexIdx(null)
    setSelectedFlangeIdx(Math.max(0, vertexIdx - 1))
  }

  // DELETE FLANGE
  const handleDeleteFlange = (flangeIdx: number) => {
    if (part.flanges.length <= 1) return
    const newFlanges = part.flanges.filter((_, i) => i !== flangeIdx)
    const newBends = part.bends.slice(0, newFlanges.length - 1)
    onUpdatePart({ ...part, flanges: newFlanges, bends: newBends })
    setSelectedFlangeIdx(Math.max(0, flangeIdx - 1))
    setSelectedVertexIdx(null)
  }

  // UNDO LAST POINT IN DRAW MODE
  const handleUndoLastPoint = () => {
    if (part.flanges.length <= 1) {
      onUpdatePart({
        ...part,
        flanges: [{ id: 'f0', length: 50 }],
        bends: [],
      })
      return
    }
    const newFlanges = part.flanges.slice(0, -1)
    const newBends = part.bends.slice(0, -1)
    onUpdatePart({ ...part, flanges: newFlanges, bends: newBends })
    setSelectedFlangeIdx(newFlanges.length - 1)
    setSelectedVertexIdx(null)
  }

  // KEYBOARD SHORTCUTS: Delete / Backspace, Undo (Ctrl+Z), Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing inside an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (mode === 'DRAW') {
          handleUndoLastPoint()
        } else if (selectedVertexIdx !== null) {
          handleDeleteVertex(selectedVertexIdx)
        } else if (selectedFlangeIdx !== null && part.flanges.length > 1) {
          handleDeleteFlange(selectedFlangeIdx)
        }
      } else if (e.key === 'Escape') {
        setMode('SELECT')
        setSelectedVertexIdx(null)
        setEditingDimensionIdx(null)
        setEditingAngleIdx(null)
      } else if (e.key === 'Enter') {
        if (mode === 'DRAW') {
          setMode('SELECT')
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        handleUndoLastPoint()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, selectedVertexIdx, selectedFlangeIdx, part, profilePoints])

  // Direct dimension editing
  const handleSaveDimension = (flangeIdx: number) => {
    const val = parseFloat(tempDimValue)
    if (!isNaN(val) && val >= 5) {
      const updated = [...part.flanges]
      updated[flangeIdx] = { ...updated[flangeIdx], length: Math.round(val) }
      onUpdatePart({ ...part, flanges: updated })
    }
    setEditingDimensionIdx(null)
  }

  const handleSaveAngle = (bendIdx: number, newAngle: number, direction?: 'UP' | 'DOWN') => {
    const updated = [...part.bends]
    updated[bendIdx] = {
      ...updated[bendIdx],
      angle: Math.max(30, Math.min(170, Math.round(newAngle))),
      direction: direction ?? updated[bendIdx].direction,
    }
    onUpdatePart({ ...part, bends: updated })
    setEditingAngleIdx(null)
  }

  // Directional Quick Buttons: Add Flange Right, Up, Left, Down
  const handleQuickAddFlange = (direction: 'RIGHT' | 'UP' | 'LEFT' | 'DOWN', len: number = 40) => {
    const newFlangeId = `flange-${Date.now()}-${part.flanges.length}`
    const newBendId = `bend-${Date.now()}-${part.bends.length}`
    let angle = 90
    let bendDir: 'UP' | 'DOWN' = 'UP'

    if (direction === 'DOWN') {
      bendDir = 'DOWN'
    }

    onUpdatePart({
      ...part,
      flanges: [...part.flanges, { id: newFlangeId, length: len }],
      bends: [...part.bends, { id: newBendId, angle, direction: bendDir, radius: 1.5 }],
    })
    setSelectedFlangeIdx(part.flanges.length)
    setSelectedVertexIdx(null)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 select-none">
      {/* Mobile Tab Switcher (Visible only on small screens < md) */}
      <div className="md:hidden flex items-center bg-slate-900 border-b border-slate-800 p-1.5 space-x-1 shrink-0">
        <button
          onClick={() => setMobileTab('CANVAS')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
            mobileTab === 'CANVAS'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 bg-slate-950 hover:text-white'
          }`}
        >
          🎨 2D Canvas Drawing
        </button>
        <button
          onClick={() => setMobileTab('SPECS')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
            mobileTab === 'SPECS'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 bg-slate-950 hover:text-white'
          }`}
        >
          📐 Specs & Flanges ({part.flanges.length})
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Dimensions & Flange List */}
        <div
          className={`w-full md:w-96 shrink-0 bg-slate-900 border-r border-slate-800 flex-col h-full overflow-y-auto p-4 md:p-5 space-y-4 ${
            mobileTab === 'SPECS' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-800/80 px-2 py-0.5 rounded-full">
              Step 1: Sketch & Dimensions
            </span>
            <h2 className="text-base font-bold text-white mt-1.5">Part 2D Profile Design</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Draw your part on the canvas. Click points to sketch, drag dots, or click dimensions to edit.
            </p>
          </div>

        {/* Mode Switcher Buttons */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-1.5 flex items-center space-x-1">
          <button
            onClick={() => {
              setMode('SELECT')
              setSelectedVertexIdx(null)
            }}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-semibold transition ${
              mode === 'SELECT'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Select & Adjust</span>
          </button>
          <button
            onClick={() => {
              setMode('DRAW')
              setSelectedVertexIdx(null)
            }}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-semibold transition ${
              mode === 'DRAW'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Click-to-Draw</span>
          </button>
        </div>

        {/* Global Sheet Metal Specs */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Sheet Properties</span>
            <span className="text-[10px] text-cyan-400 font-mono">T = {part.thickness} mm</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Thickness (T)</label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  value={part.thickness}
                  onChange={(e) =>
                    onUpdatePart({ ...part, thickness: parseFloat(e.target.value) || 1 })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs font-mono focus:border-cyan-500 focus:outline-none"
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
                  onChange={(e) =>
                    onUpdatePart({ ...part, width: parseFloat(e.target.value) || 100 })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs font-mono focus:border-cyan-500 focus:outline-none"
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
                className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-100 text-[11px] focus:border-cyan-500 focus:outline-none truncate"
              >
                {STANDARD_MATERIALS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name.split(' ')[0]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Blank Calculation Cards */}
          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
            <div className="bg-slate-900 border border-slate-800 rounded p-2 flex items-center space-x-2">
              <Ruler className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block">Flat Blank</span>
                <span className="font-mono font-bold text-slate-200">{metrics.flatLength} mm</span>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded p-2 flex items-center space-x-2">
              <Weight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block">Est. Force</span>
                <span className="font-mono font-bold text-slate-200">{metrics.totalTonnage} T</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Flange Appender (Directional Pad) */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
          <label className="text-[11px] font-semibold text-slate-300 block">
            Add Next Flange to End:
          </label>
          <div className="grid grid-cols-4 gap-1 text-[11px] font-semibold font-mono">
            <button
              onClick={() => handleQuickAddFlange('UP')}
              className="py-1.5 bg-slate-800 hover:bg-cyan-600 hover:text-white rounded border border-slate-700 text-center transition"
            >
              ▲ UP
            </button>
            <button
              onClick={() => handleQuickAddFlange('DOWN')}
              className="py-1.5 bg-slate-800 hover:bg-cyan-600 hover:text-white rounded border border-slate-700 text-center transition"
            >
              ▼ DOWN
            </button>
            <button
              onClick={() => handleQuickAddFlange('RIGHT')}
              className="py-1.5 bg-slate-800 hover:bg-cyan-600 hover:text-white rounded border border-slate-700 text-center transition"
            >
              ▶ RIGHT
            </button>
            <button
              onClick={() => handleQuickAddFlange('LEFT')}
              className="py-1.5 bg-slate-800 hover:bg-cyan-600 hover:text-white rounded border border-slate-700 text-center transition"
            >
              ◀ LEFT
            </button>
          </div>
        </div>

        {/* Flanges & Dots List with Clean Deletion */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              Flanges & Angles ({part.flanges.length})
            </span>
            <button
              onClick={() => {
                onUpdatePart({
                  name: 'Custom Sketched Part',
                  thickness: part.thickness,
                  width: part.width,
                  materialId: part.materialId,
                  flanges: [{ id: 'f0', length: 60 }],
                  bends: [],
                })
                setSelectedFlangeIdx(0)
                setSelectedVertexIdx(null)
                setMode('DRAW')
              }}
              className="text-[11px] text-slate-400 hover:text-red-400 transition"
              title="Clear all bends and draw from scratch"
            >
              Clear to Blank Sheet
            </button>
          </div>

          {/* Dot 0 Origin Selector */}
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/60 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px]">Part Origin:</span>
            <button
              onClick={() => {
                setSelectedVertexIdx(0)
                setSelectedFlangeIdx(null)
                setActiveAnchorIdx(0)
              }}
              className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold border transition ${
                effectiveAnchorIdx === 0
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-emerald-500'
              }`}
              title="Select Dot 0 as starting anchor to draw flanges outward from the start"
            >
              ⚓ Dot 0 (Origin)
            </button>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {part.flanges.map((flange, idx) => (
              <React.Fragment key={`flange-row-${idx}-${flange.id}`}>
                <div
                  onClick={() => {
                    setSelectedFlangeIdx(idx)
                    setSelectedVertexIdx(null)
                  }}
                  className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition ${
                    selectedFlangeIdx === idx
                      ? 'bg-cyan-950/60 border-cyan-500 text-white'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-200 text-[10px] flex items-center justify-center font-bold font-mono">
                      F{idx + 1}
                    </span>
                    <span className="text-xs font-medium">Flange {idx + 1}</span>
                  </div>

                  <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        const updated = [...part.flanges]
                        updated[idx].length = Math.max(5, updated[idx].length - 5)
                        onUpdatePart({ ...part, flanges: updated })
                      }}
                      className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 flex items-center justify-center font-bold text-xs"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="5"
                      max="800"
                      value={flange.length}
                      onChange={(e) => {
                        const updated = [...part.flanges]
                        updated[idx].length = Math.max(5, parseFloat(e.target.value) || 5)
                        onUpdatePart({ ...part, flanges: updated })
                      }}
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-xs focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400">mm</span>
                    <button
                      onClick={() => {
                        const updated = [...part.flanges]
                        updated[idx].length = updated[idx].length + 5
                        onUpdatePart({ ...part, flanges: updated })
                      }}
                      className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 flex items-center justify-center font-bold text-xs"
                    >
                      +
                    </button>

                    {part.flanges.length > 1 && (
                      <button
                        onClick={() => handleDeleteFlange(idx)}
                        className="text-slate-500 hover:text-red-400 p-0.5 transition ml-1"
                        title="Delete Flange (or press Delete key)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {idx < part.bends.length && (
                  <div className="ml-5 pl-3 border-l-2 border-dashed border-cyan-800/60 py-0.5 flex items-center justify-between text-xs">
                    <button
                      onClick={() => {
                        setSelectedVertexIdx(idx + 1)
                        setSelectedFlangeIdx(null)
                        setActiveAnchorIdx(idx + 1)
                      }}
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border transition ${
                        selectedVertexIdx === idx + 1
                          ? 'bg-amber-950 text-amber-300 border-amber-500'
                          : effectiveAnchorIdx === idx + 1 && mode === 'DRAW'
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                          : 'bg-cyan-950/80 text-cyan-400 border-cyan-800/40 hover:border-cyan-500'
                      }`}
                      title="Click to select or set as drawing start dot"
                    >
                      {effectiveAnchorIdx === idx + 1 && mode === 'DRAW' ? '⚓ ' : ''}Bend Dot {idx + 1}
                    </button>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          const updated = [...part.bends]
                          updated[idx].direction = updated[idx].direction === 'UP' ? 'DOWN' : 'UP'
                          onUpdatePart({ ...part, bends: updated })
                        }}
                        className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[10px] border border-slate-700"
                      >
                        {part.bends[idx].direction === 'UP' ? '▲ UP' : '▼ DOWN'}
                      </button>
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
                        onClick={() => handleDeleteVertex(idx + 1)}
                        className="text-slate-500 hover:text-red-400 p-0.5 transition ml-1"
                        title="Delete Bend Dot"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Primary Proceed Button */}
        <div className="pt-2 border-t border-slate-800">
          <button
            onClick={onNextStep}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-cyan-600/20 transition"
          >
            <span>Proceed to Step 2: Tooling Setup</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center Drawing Canvas with Stable CAD Viewport */}
      <div
        className={`flex-1 flex-col h-full overflow-hidden relative ${
          mobileTab === 'CANVAS' ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Canvas Toolbar */}
        <div className="h-12 bg-slate-900/80 border-b border-slate-800 px-6 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-400 font-medium">Drawing Canvas:</span>
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => {
                  setMode('SELECT')
                  setSelectedVertexIdx(null)
                }}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition ${
                  mode === 'SELECT'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span>Select & Adjust</span>
              </button>
              <button
                onClick={() => {
                  setMode('DRAW')
                  setSelectedVertexIdx(null)
                }}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition ${
                  mode === 'DRAW'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Click-to-Draw</span>
              </button>
            </div>

            {/* Quick Actions in Draw Mode */}
            {mode === 'DRAW' && (
              <div className="flex items-center space-x-2 pl-2">
                <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-cyan-950/80 border border-cyan-800 rounded-lg text-xs text-cyan-300 font-mono shadow-sm">
                  <span className="text-slate-400">Anchor:</span>
                  <span className="font-bold text-white bg-cyan-900 px-1.5 py-0.5 rounded text-[11px]">
                    Dot {effectiveAnchorIdx === 0 ? '0 (Start)' : effectiveAnchorIdx === profilePoints.length - 1 ? `${effectiveAnchorIdx} (End)` : effectiveAnchorIdx}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 hidden xl:inline">
                  (Click any dot to change start)
                </span>
                <button
                  onClick={handleUndoLastPoint}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded font-medium transition"
                  title="Undo last added point (Ctrl+Z or Backspace)"
                >
                  <Undo2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Undo Point</span>
                </button>
                <button
                  onClick={() => setMode('SELECT')}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 rounded font-medium transition"
                  title="Finish drawing profile (Enter)"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Finish Drawing</span>
                </button>
              </div>
            )}
          </div>

          {/* Snapping Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSnapToAngle(!snapToAngle)}
              className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded border transition ${
                snapToAngle
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="Snap angles to 45° increments"
            >
              <Magnet className="w-3.5 h-3.5" />
              <span>Snap 45°</span>
            </button>

            <button
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded border transition ${
                snapToGrid
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="Snap lengths to 5mm"
            >
              <Magnet className="w-3.5 h-3.5" />
              <span>Snap 5mm</span>
            </button>
          </div>
        </div>

        {/* Stable Interactive SVG Canvas */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
          {/* Crisp Engineering Grid */}
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
            onTouchStart={handleSvgTouchStart}
            onTouchMove={handleSvgTouchMove}
            onTouchEnd={handleSvgTouchEnd}
            className={`w-full h-full max-w-4xl max-h-[600px] overflow-visible select-none touch-none ${
              mode === 'DRAW' ? 'cursor-crosshair' : 'cursor-default'
            }`}
          >
            <defs>
              <marker
                id="arrow-cyan"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
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

            {/* Datum Axes at (0,0) */}
            <line x1={-30} y1={0} x2={30} y2={0} stroke="#334155" strokeWidth={1} strokeDasharray="3,3" />
            <line x1={0} y1={-30} x2={0} y2={30} stroke="#334155" strokeWidth={1} strokeDasharray="3,3" />

            {/* 1. DRAW EXISTING FLANGES */}
            {profilePoints.slice(0, -1).map((p1, idx) => {
              const p2 = profilePoints[idx + 1]
              const isSelected = selectedFlangeIdx === idx && selectedVertexIdx === null
              const flange = part.flanges[idx]

              const dx = p2.x - p1.x
              const dy = p2.y - p1.y
              const len = Math.hypot(dx, dy)
              if (len < 1e-4) return null

              const ux = dx / len
              const uy = dy / len
              const nx = -uy * 24
              const ny = ux * 24

              const d1x = p1.x + nx
              const d1y = p1.y + ny
              const d2x = p2.x + nx
              const d2y = p2.y + ny
              const midX = (d1x + d2x) / 2
              const midY = (d1y + d2y) / 2

              return (
                <g key={`flange-geom-${idx}`}>
                  {/* Flange Solid Thick Line */}
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={isSelected ? '#38bdf8' : '#cbd5e1'}
                    strokeWidth={Math.max(part.thickness * 1.5, 5)}
                    strokeLinecap="round"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFlangeIdx(idx)
                      setSelectedVertexIdx(null)
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
                    strokeWidth={0.8}
                    strokeDasharray="2,2"
                  />
                  <line
                    x1={p2.x + nx * 0.2}
                    y1={p2.y + ny * 0.2}
                    x2={p2.x + nx * 1.2}
                    y2={p2.y + ny * 1.2}
                    stroke="#475569"
                    strokeWidth={0.8}
                    strokeDasharray="2,2"
                  />

                  {/* CAD Dimension Line with Double Arrows */}
                  <line
                    x1={d1x}
                    y1={d1y}
                    x2={d2x}
                    y2={d2y}
                    stroke={isSelected ? '#38bdf8' : '#64748b'}
                    strokeWidth={1}
                    markerStart={isSelected ? 'url(#arrow-cyan)' : 'url(#arrow-slate)'}
                    markerEnd={isSelected ? 'url(#arrow-cyan)' : 'url(#arrow-slate)'}
                  />

                  {/* Clickable Dimension Callout Badge */}
                  <g
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFlangeIdx(idx)
                      setSelectedVertexIdx(null)
                      setEditingDimensionIdx(idx)
                      setTempDimValue(flange.length.toString())
                    }}
                    className="cursor-pointer group"
                  >
                    <rect
                      x={midX - 28}
                      y={midY - 10}
                      width={56}
                      height={20}
                      rx={4}
                      fill={isSelected ? '#082f49' : '#0f172a'}
                      stroke={isSelected ? '#38bdf8' : '#475569'}
                      strokeWidth={1.2}
                      className="group-hover:stroke-cyan-400 transition"
                    />
                    <text
                      x={midX}
                      y={midY + 3.5}
                      fill={isSelected ? '#38bdf8' : '#e2e8f0'}
                      fontSize={10}
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                      className="select-none pointer-events-none"
                    >
                      {flange.length} mm
                    </text>
                  </g>
                </g>
              )
            })}

            {/* 2. DRAW BEND VERTEX HANDLES & ANGLE BADGES */}
            {profilePoints.map((p, idx) => {
              const isSelectedDot = selectedVertexIdx === idx
              const isAnchorDot = idx === effectiveAnchorIdx
              const isStart = idx === 0
              const isEnd = idx === profilePoints.length - 1
              const isIntermediate = !isStart && !isEnd

              return (
                <g key={`vertex-dot-${idx}`} className="group/dot">
                  {/* Outer selection ring if selected */}
                  {isSelectedDot && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={10}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      className="animate-pulse pointer-events-none"
                    />
                  )}

                  {/* Pulsing Anchor Halo when in DRAW mode */}
                  {isAnchorDot && mode === 'DRAW' && (
                    <>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={13}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth={1.8}
                        strokeDasharray="3,3"
                        className="pointer-events-none"
                      />
                      <g className="pointer-events-none">
                        <rect
                          x={p.x - 26}
                          y={p.y + 11}
                          width={52}
                          height={16}
                          rx={3}
                          fill="#082f49"
                          stroke="#06b6d4"
                          strokeWidth={1}
                        />
                        <text
                          x={p.x}
                          y={p.y + 22.5}
                          fill="#22d3ee"
                          fontSize={8.5}
                          fontWeight="bold"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          ⚓ START
                        </text>
                      </g>
                    </>
                  )}

                  {/* Outer hover ring on mouseover - 100% stable, zero coordinate shift */}
                  {!isSelectedDot && !isAnchorDot && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={9}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={1.5}
                      strokeDasharray="2,2"
                      className="opacity-0 group-hover/dot:opacity-100 transition-opacity pointer-events-none"
                    />
                  )}

                  {/* Vertex Dot Handle (Visible Core) - zero transform, zero flicker */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelectedDot ? 6 : isStart ? 5.5 : isEnd ? 6 : 5}
                    fill={
                      isAnchorDot && mode === 'DRAW'
                        ? '#06b6d4'
                        : isSelectedDot
                        ? '#f59e0b'
                        : isStart
                        ? '#10b981'
                        : isEnd
                        ? '#06b6d4'
                        : '#0284c7'
                    }
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    className="pointer-events-none transition-colors group-hover/dot:stroke-cyan-300"
                  />

                  {/* Rock-solid, generous invisible Hit Target for effortless clicking & dragging */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={16}
                    fill="transparent"
                    className="cursor-pointer touch-none"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedVertexIdx(idx)
                      setSelectedFlangeIdx(null)
                      setActiveAnchorIdx(idx)
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      if (mode === 'SELECT') {
                        setDraggingVertexIdx(idx)
                        setSelectedVertexIdx(idx)
                      }
                      setActiveAnchorIdx(idx)
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation()
                      if (mode === 'SELECT') {
                        setDraggingVertexIdx(idx)
                        setSelectedVertexIdx(idx)
                      }
                      setActiveAnchorIdx(idx)
                    }}
                  />

                  {/* Angle Badge for intermediate vertices */}
                  {isIntermediate && (
                    <g
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingAngleIdx(idx - 1)
                      }}
                      className="cursor-pointer group"
                    >
                      <rect
                        x={p.x - 24}
                        y={p.y - 28}
                        width={48}
                        height={18}
                        rx={4}
                        fill="#0f172a"
                        stroke="#0ea5e9"
                        strokeWidth={1}
                        className="group-hover:stroke-cyan-400 transition"
                      />
                      <text
                        x={p.x}
                        y={p.y - 16}
                        fill="#38bdf8"
                        fontSize={9}
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="middle"
                        className="select-none pointer-events-none"
                      >
                        {part.bends[idx - 1]?.angle}°{' '}
                        {part.bends[idx - 1]?.direction === 'UP' ? '▲' : '▼'}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}

            {/* 3. DRAW LIVE RUBBERBAND LINE WHEN IN 'DRAW' MODE */}
            {mode === 'DRAW' && cursorPos && profilePoints[effectiveAnchorIdx] && (
              <g className="pointer-events-none">
                <line
                  x1={profilePoints[effectiveAnchorIdx].x}
                  y1={profilePoints[effectiveAnchorIdx].y}
                  x2={cursorPos.x}
                  y2={cursorPos.y}
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  strokeDasharray="4,4"
                />
                <circle cx={cursorPos.x} cy={cursorPos.y} r={4.5} fill="#38bdf8" />
                <rect
                  x={(profilePoints[effectiveAnchorIdx].x + cursorPos.x) / 2 - 25}
                  y={(profilePoints[effectiveAnchorIdx].y + cursorPos.y) / 2 - 20}
                  width={50}
                  height={18}
                  rx={3}
                  fill="#0369a1"
                />
                <text
                  x={(profilePoints[effectiveAnchorIdx].x + cursorPos.x) / 2}
                  y={(profilePoints[effectiveAnchorIdx].y + cursorPos.y) / 2 - 8}
                  fill="#ffffff"
                  fontSize={10}
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {Math.round(
                    Math.hypot(
                      cursorPos.x - profilePoints[effectiveAnchorIdx].x,
                      cursorPos.y - profilePoints[effectiveAnchorIdx].y
                    )
                  )}
                  mm
                </text>
              </g>
            )}
          </svg>

          {/* FLOATING ACTION TOOLBAR WHEN A VERTEX (DOT) IS SELECTED */}
          {selectedVertexIdx !== null && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-amber-500/80 rounded-xl px-4 py-2 shadow-2xl z-20 flex items-center space-x-3 text-xs">
              <span className="font-semibold text-amber-300">
                Dot {selectedVertexIdx === 0 ? '0 (Origin)' : selectedVertexIdx === profilePoints.length - 1 ? `${selectedVertexIdx} (End)` : selectedVertexIdx} Selected
              </span>
              <div className="h-4 w-px bg-slate-700" />

              <button
                onClick={() => {
                  setActiveAnchorIdx(selectedVertexIdx)
                  setMode('DRAW')
                }}
                className="flex items-center space-x-1 px-3 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-700 rounded font-semibold transition shadow-sm"
                title="Start drawing a new flange directly from this dot"
              >
                <PenTool className="w-3.5 h-3.5 text-cyan-400" />
                <span>Draw Flange From Here</span>
              </button>

              {selectedVertexIdx > 0 && selectedVertexIdx < profilePoints.length - 1 && (
                <button
                  onClick={() => handleBranchFromVertex(selectedVertexIdx)}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded font-medium transition"
                  title="Trim all flanges after this dot and continue sketching from here"
                >
                  <span>Branch (Trim Tail)</span>
                </button>
              )}

              <button
                onClick={() => handleDeleteVertex(selectedVertexIdx)}
                className="flex items-center space-x-1 px-3 py-1 bg-red-950 hover:bg-red-900 text-red-200 border border-red-700 rounded font-semibold transition"
                title="Delete this point (or press Delete / Backspace key)"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Delete Dot (Del)</span>
              </button>

              <button
                onClick={() => setSelectedVertexIdx(null)}
                className="text-slate-400 hover:text-white p-1"
                title="Deselect"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* FLOATING ACTION TOOLBAR WHEN A FLANGE IS SELECTED */}
          {selectedFlangeIdx !== null && selectedVertexIdx === null && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-cyan-500/80 rounded-xl px-4 py-2 shadow-2xl z-20 flex items-center space-x-3 text-xs">
              <span className="font-semibold text-cyan-300">
                Flange {selectedFlangeIdx + 1} ({part.flanges[selectedFlangeIdx]?.length}mm)
              </span>
              <div className="h-4 w-px bg-slate-700" />
              <button
                onClick={() => {
                  setEditingDimensionIdx(selectedFlangeIdx)
                  setTempDimValue(part.flanges[selectedFlangeIdx].length.toString())
                }}
                className="flex items-center space-x-1 px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-800 rounded font-semibold transition"
              >
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Edit Size</span>
              </button>

              {part.flanges.length > 1 && (
                <button
                  onClick={() => handleDeleteFlange(selectedFlangeIdx)}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-red-950 hover:bg-red-900 text-red-200 border border-red-700 rounded font-semibold transition"
                  title="Delete this flange"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Delete Flange</span>
                </button>
              )}

              <button
                onClick={() => setSelectedFlangeIdx(null)}
                className="text-slate-400 hover:text-white p-1"
                title="Deselect"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Inline Dimension Editing Popup */}
          {editingDimensionIdx !== null && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border-2 border-cyan-500 rounded-xl p-4 shadow-2xl z-30 space-y-3 w-72">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white">
                  Flange {editingDimensionIdx + 1} Length (mm)
                </span>
                <button
                  onClick={() => setEditingDimensionIdx(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="5"
                    max="1000"
                    autoFocus
                    value={tempDimValue}
                    onChange={(e) => setTempDimValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveDimension(editingDimensionIdx)
                      if (e.key === 'Escape') setEditingDimensionIdx(null)
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 font-mono text-cyan-300 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">mm</span>
                </div>
              </div>

              {/* Quick Steppers */}
              <div className="flex items-center justify-between space-x-1">
                {[-20, -10, +10, +20].map((delta) => (
                  <button
                    key={delta}
                    onClick={() => {
                      const cur = parseFloat(tempDimValue) || 10
                      setTempDimValue(Math.max(5, cur + delta).toString())
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded"
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleSaveDimension(editingDimensionIdx)}
                className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg transition"
              >
                Apply Dimension
              </button>
            </div>
          )}

          {/* Inline Angle Editing Popup */}
          {editingAngleIdx !== null && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border-2 border-cyan-500 rounded-xl p-4 shadow-2xl z-30 space-y-3 w-72">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white">
                  Bend {editingAngleIdx + 1} Angle
                </span>
                <button
                  onClick={() => setEditingAngleIdx(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1.5">Common Angles:</label>
                <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                  {[30, 45, 60, 90, 120, 135, 150].map((ang) => (
                    <button
                      key={ang}
                      onClick={() => handleSaveAngle(editingAngleIdx, ang)}
                      className="py-1 bg-slate-800 hover:bg-cyan-600 hover:text-white rounded border border-slate-700 text-slate-200"
                    >
                      {ang}°
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Bend Direction:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      handleSaveAngle(
                        editingAngleIdx,
                        part.bends[editingAngleIdx].angle,
                        'UP'
                      )
                    }
                    className={`py-1.5 rounded text-xs font-semibold border ${
                      part.bends[editingAngleIdx].direction === 'UP'
                        ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    ▲ Bend UP
                  </button>
                  <button
                    onClick={() =>
                      handleSaveAngle(
                        editingAngleIdx,
                        part.bends[editingAngleIdx].angle,
                        'DOWN'
                      )
                    }
                    className={`py-1.5 rounded text-xs font-semibold border ${
                      part.bends[editingAngleIdx].direction === 'DOWN'
                        ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    ▼ Bend DOWN
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Floating Instructions Banner */}
          <div className="absolute bottom-6 left-6 bg-slate-900/90 backdrop-blur border border-slate-800 px-3.5 py-2 rounded-xl shadow-xl flex items-center space-x-3 text-xs">
            {mode === 'DRAW' ? (
              <div className="flex items-center space-x-2 text-cyan-300">
                <PenTool className="w-4 h-4 text-cyan-400" />
                <span>
                  Click on the grid to drop bend points. Press <strong>Backspace</strong> or <strong>Ctrl+Z</strong> to undo. Press <strong>Enter</strong> to finish.
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-slate-300">
                <MousePointer className="w-4 h-4 text-cyan-400" />
                <span>
                  Click any dot to select and delete with <strong>Delete key</strong>. Click <strong>[ XX mm ]</strong> to edit length.
                </span>
              </div>
            )}
          </div>

          {/* Next Step Proceed Button */}
          <div className="absolute bottom-6 right-6">
            <button
              onClick={onNextStep}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-xl shadow-cyan-600/30 flex items-center space-x-2 transition"
            >
              <span>Next: Tooling Setup</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)
}
