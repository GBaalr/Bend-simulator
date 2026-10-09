import React, { useState, useMemo, useRef } from 'react'
import {
  X,
  Check,
  RotateCcw,
  Sparkles,
  Wrench,
  Maximize2,
  Sliders,
  PenTool,
  Save,
  HelpCircle,
} from 'lucide-react'
import { Punch, Point2D } from '../types/tooling'
import { generatePunchPolygon } from '../core/toolingCatalog'

interface PunchDrafterModalProps {
  isOpen: boolean
  currentPunch: Punch
  onClose: () => void
  onSavePunch: (punch: Punch) => void
}

export const PunchDrafterModal: React.FC<PunchDrafterModalProps> = ({
  isOpen,
  currentPunch,
  onClose,
  onSavePunch,
}) => {
  const [name, setName] = useState(currentPunch.name || 'Custom Shop Punch')
  const [height, setHeight] = useState(currentPunch.height || 120)
  const [angle, setAngle] = useState(currentPunch.angle || 88)
  const [tipRadius, setTipRadius] = useState(currentPunch.tipRadius || 0.8)
  const [hasThroatRelief, setHasThroatRelief] = useState(currentPunch.throatRelief > 0)
  const [throatRelief, setThroatRelief] = useState(currentPunch.throatRelief || 55)
  const [throatHeight, setThroatHeight] = useState(currentPunch.throatHeight || 60)
  const [shankWidth, setShankWidth] = useState(currentPunch.shankWidth || 13)

  // Custom vertex points for freeform editing
  const [customPoints, setCustomPoints] = useState<Point2D[] | null>(null)
  const [draggedVertexIdx, setDraggedVertexIdx] = useState<number | null>(null)

  const svgRef = useRef<SVGSVGElement | null>(null)

  // Generate parametric polygon based on current slider values
  const parametricPoints = useMemo<Point2D[]>(() => {
    let pType: Punch['type'] = 'straight'
    if (hasThroatRelief) {
      pType = throatRelief > 65 ? 'deep_gooseneck' : 'gooseneck'
    } else if (angle <= 35) {
      pType = 'acute'
    }

    const tempPunch: Punch = {
      id: 'preview',
      name,
      type: pType,
      height,
      angle,
      tipRadius,
      throatRelief: hasThroatRelief ? throatRelief : 0,
      throatHeight: hasThroatRelief ? throatHeight : 0,
      shankWidth,
      maxTonnage: 800,
    }
    return generatePunchPolygon(tempPunch)
  }, [name, height, angle, tipRadius, hasThroatRelief, throatRelief, throatHeight, shankWidth])

  // Active display points (either custom dragged or parametric)
  const activePoints = customPoints ?? parametricPoints

  // Compute SVG viewBox
  const { viewBox, minX, minY, boxW, boxH } = useMemo(() => {
    let pMinX = -80
    let pMaxX = 80
    let pMinY = -10
    let pMaxY = height + 30

    for (const p of activePoints) {
      if (p.x < pMinX) pMinX = p.x - 20
      if (p.x > pMaxX) pMaxX = p.x + 20
      if (p.y < pMinY) pMinY = p.y - 15
      if (p.y > pMaxY) pMaxY = p.y + 20
    }

    const margin = 30
    const w = pMaxX - pMinX + margin * 2
    const h = pMaxY - pMinY + margin * 2
    const cx = (pMinX + pMaxX) / 2
    const cy = (pMinY + pMaxY) / 2

    return {
      viewBox: `${cx - w / 2} ${cy - h / 2} ${w} ${h}`,
      minX: cx - w / 2,
      minY: cy - h / 2,
      boxW: w,
      boxH: h,
    }
  }, [activePoints, height])

  if (!isOpen) return null

  // Coordinate conversion for vertex dragging
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggedVertexIdx === null || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    // Convert to SVG world coords
    const worldX = minX + (screenX / rect.width) * boxW
    // Note: SVG Y is inverted (+Y is UP in our coordinate system)
    const worldY = minY + (screenY / rect.height) * boxH

    // Don't drag tip (vertex 0 is always tip at 0,0)
    if (draggedVertexIdx === 0) return

    const updated = [...(customPoints ?? parametricPoints)]
    updated[draggedVertexIdx] = {
      x: Math.round(worldX * 2) / 2,
      y: Math.max(5, Math.round(worldY * 2) / 2),
    }
    setCustomPoints(updated)
  }

  const handleSave = () => {
    const newId = `punch_custom_${Date.now()}`
    let pType: Punch['type'] = 'straight'
    if (hasThroatRelief) {
      pType = throatRelief > 65 ? 'deep_gooseneck' : 'gooseneck'
    } else if (angle <= 35) {
      pType = 'acute'
    }

    const finalPunch: Punch = {
      id: newId,
      name: name || 'Custom Drawn Punch',
      type: pType,
      height,
      angle,
      tipRadius,
      throatRelief: hasThroatRelief ? throatRelief : 0,
      throatHeight: hasThroatRelief ? throatHeight : 0,
      shankWidth,
      maxTonnage: 800,
      polygon2D: customPoints ? customPoints : parametricPoints,
    }
    onSavePunch(finalPunch)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="h-14 bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Custom Punch Drafter (Top Tool)
                <span className="text-[10px] text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-800">
                  DELEM DA-53T Tooling
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Draw and dimension your shop's exact upper punch profile to ensure 100% accurate collision detection.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left Controls, Center Interactive Canvas */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Dimensions & Presets */}
          <div className="w-84 shrink-0 bg-slate-900/90 border-r border-slate-800 p-5 overflow-y-auto space-y-4 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Punch Name / Tool Code</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My P-130 Gooseneck"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 font-medium text-white text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Quick Templates */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">
                Start from Standard Shape:
              </span>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                <button
                  onClick={() => {
                    setHasThroatRelief(false)
                    setAngle(88)
                    setHeight(105)
                    setCustomPoints(null)
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-left transition"
                >
                  Straight 88°
                </button>
                <button
                  onClick={() => {
                    setHasThroatRelief(true)
                    setThroatRelief(55)
                    setThroatHeight(60)
                    setAngle(88)
                    setHeight(120)
                    setCustomPoints(null)
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-left transition"
                >
                  Gooseneck
                </button>
                <button
                  onClick={() => {
                    setHasThroatRelief(false)
                    setAngle(30)
                    setHeight(105)
                    setCustomPoints(null)
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-left transition"
                >
                  Acute 30°
                </button>
                <button
                  onClick={() => {
                    setHasThroatRelief(true)
                    setThroatRelief(20)
                    setThroatHeight(40)
                    setAngle(86)
                    setHeight(105)
                    setCustomPoints(null)
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-left transition"
                >
                  Sash 86°
                </button>
              </div>
            </div>

            {/* Basic Tool Dimensions */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-3">
              <span className="text-[11px] font-semibold text-slate-200 block border-b border-slate-800/80 pb-1">
                Main Dimensions
              </span>

              {/* Working Height */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Total Height (H):</span>
                  <span className="font-mono text-cyan-300 font-bold">{height} mm</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="250"
                  step="5"
                  value={height}
                  onChange={(e) => {
                    setHeight(parseFloat(e.target.value))
                    setCustomPoints(null)
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-cyan-500"
                />
              </div>

              {/* Tip Angle */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Tip Angle (α):</span>
                  <span className="font-mono text-cyan-300 font-bold">{angle}°</span>
                </div>
                <input
                  type="range"
                  min="26"
                  max="90"
                  step="2"
                  value={angle}
                  onChange={(e) => {
                    setAngle(parseFloat(e.target.value))
                    setCustomPoints(null)
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-cyan-500"
                />
              </div>

              {/* Tip Radius */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Tip Radius (R):</span>
                  <span className="font-mono text-cyan-300 font-bold">{tipRadius} mm</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="5.0"
                  step="0.2"
                  value={tipRadius}
                  onChange={(e) => {
                    setTipRadius(parseFloat(e.target.value))
                    setCustomPoints(null)
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-cyan-500"
                />
              </div>
            </div>

            {/* Gooseneck / Throat Relief Pocket */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
                <span className="text-[11px] font-semibold text-slate-200">
                  Throat Relief Pocket
                </span>
                <button
                  onClick={() => {
                    setHasThroatRelief(!hasThroatRelief)
                    setCustomPoints(null)
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold transition ${
                    hasThroatRelief
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {hasThroatRelief ? 'ENABLED' : 'NONE'}
                </button>
              </div>

              {hasThroatRelief && (
                <>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400">Relief Depth:</span>
                      <span className="font-mono text-cyan-300 font-bold">{throatRelief} mm</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="120"
                      step="5"
                      value={throatRelief}
                      onChange={(e) => {
                        setThroatRelief(parseFloat(e.target.value))
                        setCustomPoints(null)
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-cyan-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-400">Relief Height:</span>
                      <span className="font-mono text-cyan-300 font-bold">{throatHeight} mm</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="120"
                      step="5"
                      value={throatHeight}
                      onChange={(e) => {
                        setThroatHeight(parseFloat(e.target.value))
                        setCustomPoints(null)
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-cyan-500"
                    />
                  </div>
                </>
              )}
            </div>

            {customPoints && (
              <div className="flex items-center justify-between bg-amber-950/40 border border-amber-800/80 rounded p-2 text-[11px] text-amber-200">
                <span>Freeform vertex dragging active</span>
                <button
                  onClick={() => setCustomPoints(null)}
                  className="text-cyan-400 hover:underline flex items-center gap-1 font-mono text-[10px]"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset to Sliders
                </button>
              </div>
            )}
          </div>

          {/* Center Column: Interactive Canvas & Freeform Vertex Dragging */}
          <div className="flex-1 flex flex-col h-full bg-slate-950 relative select-none">
            {/* Canvas Header */}
            <div className="h-10 bg-slate-900/60 border-b border-slate-800 px-6 flex items-center justify-between text-xs text-slate-400">
              <span>
                Tip Datum: <strong className="text-cyan-400 font-mono">(0, 0)</strong>
              </span>
              <span>Drag any vertex dot to fine-tune your punch body contours</span>
            </div>

            {/* SVG Visualizer */}
            <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
              {/* Grid Background */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle, #38bdf8 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />

              <svg
                ref={svgRef}
                viewBox={viewBox}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={() => setDraggedVertexIdx(null)}
                onMouseLeave={() => setDraggedVertexIdx(null)}
                className="w-full h-full max-w-xl max-h-[550px] overflow-visible"
              >
                {/* Centerline Axis */}
                <line
                  x1={0}
                  y1={-15}
                  x2={0}
                  y2={height + 25}
                  stroke="#334155"
                  strokeWidth={0.8}
                  strokeDasharray="3,3"
                />

                {/* Ground Zero (Tip Datum Line) */}
                <line
                  x1={-70}
                  y1={0}
                  x2={70}
                  y2={0}
                  stroke="#334155"
                  strokeWidth={0.8}
                  strokeDasharray="3,3"
                />

                {/* 1. Punch Solid Polygon Body */}
                <polygon
                  points={activePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(14, 165, 233, 0.15)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />

                {/* 2. Interactive Vertex Handles */}
                {activePoints.map((p, idx) => (
                  <g key={idx} className="group/punch-dot">
                    {/* Hover Ring (only for draggable vertices) */}
                    {idx !== 0 && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={8}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth={1.5}
                        strokeDasharray="2,2"
                        className="opacity-0 group-hover/punch-dot:opacity-100 transition-opacity pointer-events-none"
                      />
                    )}

                    {/* Visible Core */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={idx === 0 ? 5 : 4.5}
                      fill={idx === 0 ? '#10b981' : '#0284c7'}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="pointer-events-none transition-colors group-hover/punch-dot:stroke-cyan-300"
                    />

                    {idx === 0 && (
                      <text
                        x={p.x}
                        y={p.y - 8}
                        fill="#10b981"
                        fontSize={8}
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="middle"
                        className="pointer-events-none"
                      >
                        TIP (0,0)
                      </text>
                    )}

                    {/* Generous Hit Target */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={12}
                      fill="transparent"
                      className={idx === 0 ? 'cursor-not-allowed' : 'cursor-move'}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        if (idx !== 0) {
                          setDraggedVertexIdx(idx)
                        }
                      }}
                    />
                  </g>
                ))}

                {/* 3. Dimension Annotations */}
                {/* Total Height line */}
                <g>
                  <line
                    x1={-60}
                    y1={0}
                    x2={-60}
                    y2={height}
                    stroke="#64748b"
                    strokeWidth={1}
                  />
                  <text
                    x={-68}
                    y={height / 2}
                    fill="#94a3b8"
                    fontSize={9}
                    fontFamily="monospace"
                    textAnchor="middle"
                    transform={`rotate(-90 -68 ${height / 2})`}
                  >
                    H = {height}mm
                  </text>
                </g>

                {/* Throat Relief Dimension */}
                {hasThroatRelief && throatRelief > 0 && (
                  <g>
                    <line
                      x1={0}
                      y1={throatHeight}
                      x2={-throatRelief}
                      y2={throatHeight}
                      stroke="#f59e0b"
                      strokeWidth={1}
                      strokeDasharray="2,2"
                    />
                    <text
                      x={-throatRelief / 2}
                      y={throatHeight - 4}
                      fill="#f59e0b"
                      fontSize={8}
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      Relief: {throatRelief}mm
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-14 bg-slate-950 border-t border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            This tool contour will be used for continuous 2D & 3D collision sweeps.
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-600/25 flex items-center space-x-1.5 transition"
            >
              <Save className="w-4 h-4" />
              <span>Save & Use Custom Punch</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
