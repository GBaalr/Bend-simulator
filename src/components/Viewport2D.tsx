import React, { useRef, useEffect, useState } from 'react'
import { ZoomIn, ZoomOut, Maximize2, AlertTriangle } from 'lucide-react'
import { SheetMetalPart } from '../types/sheetMetal'
import { Punch, Die, MachineEnvelope } from '../types/tooling'
import { StepCollisionResult } from '../types/simulation'
import { computePartKinematics } from '../core/kinematicChain'
import { buildMachineObstacles } from '../core/collisionEngine'

interface Viewport2DProps {
  part: SheetMetalPart
  punch: Punch
  die: Die
  envelope: MachineEnvelope
  activeBendIndex: number
  completedBends: Map<number, number>
  progress: number // 0.0 to 1.0
  orientation: 'FORWARD' | 'REVERSE'
  collisionResult: StepCollisionResult | null
  penetrationDepth: number
  gaugeX: number
  gaugeR: number
  punchYOverride?: number
  sheetTransform?: { x: number; y: number; rotationX?: number; rotationY?: number }
  gaugeOverride?: { x: number; r: number }
  statusMessage?: string
}

export const Viewport2D: React.FC<Viewport2DProps> = ({
  part,
  punch,
  die,
  envelope,
  activeBendIndex,
  completedBends,
  progress,
  orientation,
  collisionResult,
  penetrationDepth,
  gaugeX,
  gaugeR,
  punchYOverride,
  sheetTransform,
  gaugeOverride,
  statusMessage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [scale, setScale] = useState(2.2)
  const [offset, setOffset] = useState({ x: 0, y: 50 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Auto-resize
    const rect = canvas.getBoundingClientRect()
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width
      canvas.height = rect.height
    }

    const w = canvas.width
    const h = canvas.height

    // Clear background
    ctx.fillStyle = '#090d16'
    ctx.fillRect(0, 0, w, h)

    // Center origin
    const centerX = w / 2 + offset.x
    const centerY = h / 2 + offset.y

    // Draw Grid
    ctx.strokeStyle = '#162032'
    ctx.lineWidth = 1
    const gridSize = 25 * scale
    const startX = (centerX % gridSize) - gridSize
    const startY = (centerY % gridSize) - gridSize

    ctx.beginPath()
    for (let x = startX; x < w; x += gridSize) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
    }
    for (let y = startY; y < h; y += gridSize) {
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
    }
    ctx.stroke()

    // Helper transform world (mm) to screen pixels
    // World coordinates: +X is right (rear/gauge), -X is left (front/operator)
    // +Y is UP (punch/ram), -Y is DOWN (die/bed)
    const toScreen = (x: number, y: number) => ({
      x: centerX + x * scale,
      y: centerY - y * scale, // flip Y so +Y is up
    })

    const effectiveGaugeX = gaugeOverride?.x ?? gaugeX
    const effectiveGaugeR = gaugeOverride?.r ?? gaugeR

    // Compute obstacles & kinematics
    const obstacles = buildMachineObstacles(
      punch,
      die,
      envelope,
      part.thickness,
      penetrationDepth,
      progress,
      effectiveGaugeX,
      effectiveGaugeR,
      punchYOverride
    )

    const kinState = computePartKinematics(
      part,
      activeBendIndex,
      completedBends,
      progress,
      orientation,
      penetrationDepth
    )

    // Helper to draw filled & stroked polygon
    const drawPolygon = (
      poly: { x: number; y: number }[],
      fillStyle: string,
      strokeStyle: string,
      lineWidth = 1.5
    ) => {
      if (poly.length < 3) return
      ctx.beginPath()
      const p0 = toScreen(poly[0].x, poly[0].y)
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < poly.length; i++) {
        const p = toScreen(poly[i].x, poly[i].y)
        ctx.lineTo(p.x, p.y)
      }
      ctx.closePath()
      ctx.fillStyle = fillStyle
      ctx.fill()
      ctx.strokeStyle = strokeStyle
      ctx.lineWidth = lineWidth
      ctx.stroke()
    }

    // 1. Draw Machine Frame (Ram and Bed)
    drawPolygon(obstacles.ramPoly, '#1e293b', '#334155', 1)
    drawPolygon(obstacles.bedPoly, '#1e293b', '#334155', 1)

    // 2. Draw Punch Holder
    drawPolygon(obstacles.holderPoly, '#334155', '#475569', 1.5)

    // 3. Draw Die
    drawPolygon(obstacles.diePoly, '#1e293b', '#0284c7', 2)

    // 4. Draw Backgauge Finger
    drawPolygon(obstacles.gaugePoly, '#78350f', '#f59e0b', 2)
    // Label Backgauge
    const gaugeScr = toScreen(effectiveGaugeX + 15, effectiveGaugeR + 15)
    ctx.fillStyle = '#f59e0b'
    ctx.font = '10px monospace'
    ctx.fillText(`X: ${effectiveGaugeX.toFixed(1)} mm`, gaugeScr.x, gaugeScr.y)

    // 5. Draw Punch (Upper Tool)
    drawPolygon(obstacles.punchPoly, '#0f172a', '#38bdf8', 2)

    // 6. Draw Sheet Metal Part Segments with Handling Animation Transform
    const transX = sheetTransform?.x ?? 0
    const transY = sheetTransform?.y ?? 0
    const rotX = sheetTransform?.rotationX ?? 0
    const rotY = sheetTransform?.rotationY ?? 0
    const cosRotY = Math.cos(rotY)
    const cosRotX = Math.cos(rotX)

    const transformPt = (pt: { x: number; y: number }) => ({
      x: pt.x * cosRotY + transX,
      y: pt.y * cosRotX + transY,
    })

    const collidingFlanges = collisionResult?.collidingFlanges ?? []

    kinState.segments.forEach((seg) => {
      const isColliding = collidingFlanges.includes(seg.flangeIndex)
      const fill = isColliding ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.25)'
      const stroke = isColliding ? '#ef4444' : '#38bdf8'
      const transformedPoly = seg.polygon.map(transformPt)
      drawPolygon(transformedPoly, fill, stroke, isColliding ? 2.5 : 2)

      // Label Flange ID & Length at mid-point
      const midX = (seg.p1.x + seg.p2.x) / 2
      const midY = (seg.p1.y + seg.p2.y) / 2
      const midTransformed = transformPt({ x: midX, y: midY })
      const midScr = toScreen(midTransformed.x, midTransformed.y)
      ctx.fillStyle = isColliding ? '#fca5a5' : '#cbd5e1'
      ctx.font = 'bold 9px monospace'
      ctx.fillText(`F${seg.flangeIndex + 1} (${part.flanges[seg.flangeIndex].length})`, midScr.x - 15, midScr.y - 6)
    })

    // 7. Draw Collision Intersections (Red Targets)
    if (collisionResult && collisionResult.hasCollision) {
      collisionResult.collisionPoints.forEach((cp) => {
        const hitScr = toScreen(cp.x, cp.y)

        // Pulsing target circle
        ctx.beginPath()
        ctx.arc(hitScr.x, hitScr.y, 8, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.5)'
        ctx.fill()
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2
        ctx.stroke()

        // Inner white point
        ctx.beginPath()
        ctx.arc(hitScr.x, hitScr.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()

        // Entity Tag
        ctx.fillStyle = '#fca5a5'
        ctx.font = 'bold 10px sans-serif'
        ctx.fillText(`CRASH: ${cp.entity}`, hitScr.x + 12, hitScr.y - 4)
      })
    }

    // 8. Draw Bend Centerline Datum
    const datumTop = toScreen(0, 50)
    const datumBottom = toScreen(0, -die.height - 20)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(datumTop.x, datumTop.y)
    ctx.lineTo(datumBottom.x, datumBottom.y)
    ctx.stroke()
    ctx.setLineDash([])
  }, [
    part,
    punch,
    die,
    envelope,
    activeBendIndex,
    completedBends,
    progress,
    orientation,
    collisionResult,
    penetrationDepth,
    gaugeX,
    gaugeR,
    scale,
    offset,
  ])

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    setScale((prev) => Math.min(6.0, Math.max(0.6, prev * zoomFactor)))
  }

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      dragStart.current = {
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y,
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return
    setOffset({
      x: e.touches[0].clientX - dragStart.current.x,
      y: e.touches[0].clientY - dragStart.current.y,
    })
  }

  const handleTouchEnd = () => setIsDragging(false)

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden cursor-crosshair touch-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Floating HUD Controls */}
      <div className="absolute top-4 left-4 flex items-center space-x-2 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg p-1.5 shadow-lg">
        <button
          onClick={() => setScale((s) => Math.min(6.0, s * 1.2))}
          className="p-1 hover:bg-slate-800 text-slate-300 rounded transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.6, s * 0.8))}
          className="p-1 hover:bg-slate-800 text-slate-300 rounded transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setScale(2.2)
            setOffset({ x: 0, y: 50 })
          }}
          className="p-1 hover:bg-slate-800 text-slate-300 rounded transition"
          title="Reset View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Collision Warning Overlay */}
      {collisionResult && collisionResult.hasCollision && (
        <div className="absolute top-4 right-4 bg-red-950/90 border border-red-600/80 text-red-200 px-3 py-2 rounded-lg flex items-center space-x-2 shadow-xl shadow-red-950/50 animate-pulse">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold block">Collision Detected!</span>
            <span className="text-[11px] text-red-300">
              Hits: {collisionResult.collidingEntities.join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Coordinates / Orientation indicator */}
      <div className="absolute bottom-4 left-4 text-[10px] font-mono text-slate-400 bg-slate-900/80 backdrop-blur border border-slate-800 px-2 py-1 rounded flex items-center space-x-2">
        <span>Orientation: </span>
        <span className="text-cyan-400 font-bold">{orientation}</span>
        <span className="text-slate-600">•</span>
        <span>Stroke: </span>
        <span className="text-cyan-400">{(progress * 100).toFixed(0)}%</span>
      </div>

      {statusMessage && (
        <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur border border-cyan-500/40 text-xs text-white px-3 py-1.5 rounded-xl shadow-2xl pointer-events-none flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-mono text-cyan-200">{statusMessage}</span>
        </div>
      )}
    </div>
  )
}
