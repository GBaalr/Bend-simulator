import React, { useState, useMemo, useRef } from 'react'
import {
  X,
  RotateCcw,
  Sliders,
  PenTool,
  Save,
  Check,
  Maximize2,
  Box,
} from 'lucide-react'
import { Die, Point2D } from '../types/tooling'
import { generateDiePolygon } from '../core/toolingCatalog'

interface DieDrafterModalProps {
  isOpen: boolean
  currentDie: Die
  sheetThickness: number
  onClose: () => void
  onSaveDie: (die: Die) => void
}

export const DieDrafterModal: React.FC<DieDrafterModalProps> = ({
  isOpen,
  currentDie,
  sheetThickness,
  onClose,
  onSaveDie,
}) => {
  const [name, setName] = useState(currentDie.name || 'Custom Lower Die')
  const [vOpening, setVOpening] = useState(currentDie.vOpening || 16)
  const [vAngle, setVAngle] = useState(currentDie.vAngle || 88)
  const [height, setHeight] = useState(currentDie.height || 80)
  const [baseWidth, setBaseWidth] = useState(currentDie.baseWidth || 60)
  const [shoulderRadius, setShoulderRadius] = useState(currentDie.shoulderRadius || 1.5)
  const [hasSideRelief, setHasSideRelief] = useState(false)
  const [reliefDepth, setReliefDepth] = useState(15)

  // Custom vertex points for freeform contour editing
  const [customPoints, setCustomPoints] = useState<Point2D[] | null>(null)
  const [draggedVertexIdx, setDraggedVertexIdx] = useState<number | null>(null)

  const svgRef = useRef<SVGSVGElement | null>(null)

  // Generate parametric polygon based on current values
  // Datum: top center of die is at y = -sheetThickness, x = 0
  const parametricPoints = useMemo<Point2D[]>(() => {
    const v = vOpening
    const halfAngleRad = ((vAngle / 2) * Math.PI) / 180
    const vDepth = (v / 2) / Math.tan(halfAngleRad)
    const baseW = baseWidth / 2
    const dieTopY = -sheetThickness
    const dieBottomY = dieTopY - height

    if (hasSideRelief) {
      // Die with side relief pockets to clear swinging flanges
      return [
        { x: -v / 2, y: dieTopY }, // Left V shoulder
        { x: 0, y: dieTopY - vDepth }, // V apex
        { x: v / 2, y: dieTopY }, // Right V shoulder
        { x: baseW * 0.7, y: dieTopY }, // Right shoulder flat
        { x: baseW * 0.7, y: dieTopY - 20 },
        { x: baseW * 0.7 - reliefDepth, y: dieTopY - 35 }, // relief pocket
        { x: baseW, y: dieBottomY + 25 },
        { x: baseW, y: dieBottomY }, // Bottom right
        { x: -baseW, y: dieBottomY }, // Bottom left
        { x: -baseW, y: dieBottomY + 25 },
        { x: -(baseW * 0.7 - reliefDepth), y: dieTopY - 35 }, // left relief pocket
        { x: -baseW * 0.7, y: dieTopY - 20 },
        { x: -baseW * 0.7, y: dieTopY }, // Left shoulder flat
      ]
    }

    return [
      { x: -v / 2, y: dieTopY }, // Left V shoulder
      { x: 0, y: dieTopY - vDepth }, // V Bottom
      { x: v / 2, y: dieTopY }, // Right V shoulder
      { x: baseW, y: dieTopY }, // Top right shoulder
      { x: baseW, y: dieTopY - 20 },
      { x: baseW * 0.9, y: dieBottomY + 15 },
      { x: baseW * 0.9, y: dieBottomY }, // Bottom right
      { x: -baseW * 0.9, y: dieBottomY }, // Bottom left
      { x: -baseW * 0.9, y: dieBottomY + 15 },
      { x: -baseW, y: dieTopY - 20 },
      { x: -baseW, y: dieTopY }, // Top left shoulder
    ]
  }, [vOpening, vAngle, height, baseWidth, sheetThickness, hasSideRelief, reliefDepth])

  const activePoints = customPoints ?? parametricPoints

  // Compute SVG viewBox
  const { viewBox, minX, minY, boxW, boxH } = useMemo(() => {
    let pMinX = -80
    let pMaxX = 80
    let pMinY = -sheetThickness - height - 30
    let pMaxY = 20

    for (const p of activePoints) {
      if (p.x < pMinX) pMinX = p.x - 20
      if (p.x > pMaxX) pMaxX = p.x + 20
      if (p.y < pMinY) pMinY = p.y - 15
      if (p.y > pMaxY) pMaxY = p.y + 15
    }

    const margin = 25
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
  }, [activePoints, height, sheetThickness])

  if (!isOpen) return null

  // Coordinate conversion for vertex dragging
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggedVertexIdx === null || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    const worldX = minX + (screenX / rect.width) * boxW
    const worldY = minY + (screenY / rect.height) * boxH

    const updated = [...(customPoints ?? parametricPoints)]
    updated[draggedVertexIdx] = {
      x: Math.round(worldX * 2) / 2,
      y: Math.min(-sheetThickness, Math.round(worldY * 2) / 2),
    }
    setCustomPoints(updated)
  }

  const handleSave = () => {
    const newId = `die_custom_${Date.now()}`
    const finalDie: Die = {
      id: newId,
      name: name || `Custom V${vOpening} Die`,
      height,
      vOpening,
      vAngle,
      shoulderRadius,
      baseWidth,
      maxTonnage: 1000,
      polygon2D: customPoints ? customPoints : parametricPoints,
    }
    onSaveDie(finalDie)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="h-14 bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Custom Lower Die Drafter (Bottom Base)
                <span className="text-[10px] text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-800">
                  DELEM DA-53T Tooling
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Draw and dimension your exact press brake lower V-die, shoulder widths, and relief pockets.
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

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Sliders & Presets */}
          <div className="w-84 shrink-0 bg-slate-900/90 border-r border-slate-800 p-5 overflow-y-auto space-y-4 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Die Name / Code</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Shop V16 88° Die"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 font-medium text-white text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Quick Templates */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">
                Standard V-Die Templates:
              </span>
              <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px]">
                {[8, 12, 16, 24, 32, 40].map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setVOpening(v)
                      setVAngle(88)
                      setBaseWidth(Math.max(50, v * 3))
                      setHeight(80)
                      setCustomPoints(null)
                    }}
                    className={`py-1.5 rounded border text-center transition ${
                      vOpening === v
                        ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    V = {v}mm
                  </button>
                ))}
              </div>
            </div>

            {/* Main Dimensions */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-3">
              <span className="text-[11px] font-semibold text-slate-200 block border-b border-slate-800/80 pb-1">
                V-Groove & Block Geometry
              </span>

              {/* V Opening Width */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">V-Opening (V):</span>
                  <span className="font-mono text-cyan-300 font-bold">{vOpening} mm</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="80"
                  step="2"
                  value={vOpening}
                  onChange={(e) => {
                    setVOpening(parseFloat(e.target.value))
                    setCustomPoints(null)
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-cyan-500"
                />
              </div>

              {/* V Angle */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">V-Angle (β):</span>
                  <span className="font-mono text-cyan-300 font-bold">{vAngle}°</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="90"
                  step="2"
                  value={vAngle}
                  onChange={(e) => {
                    setVAngle(parseFloat(e.target.value))
                    setCustomPoints(null)
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-cyan-500"
                />
              </div>

              {/* Die Total Height */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Die Height (H):</span>
                  <span className="font-mono text-cyan-300 font-bold">{height} mm</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="160"
                  step="5"
                  value={height}
                  onChange={(e) => {
                    setHeight(parseFloat(e.target.value))
                    setCustomPoints(null)
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-cyan-500"
                />
              </div>

              {/* Die Base Width */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Base Width (W):</span>
                  <span className="font-mono text-cyan-300 font-bold">{baseWidth} mm</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="160"
                  step="5"
                  value={baseWidth}
                  onChange={(e) => {
                    setBaseWidth(parseFloat(e.target.value))
                    setCustomPoints(null)
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-cyan-500"
                />
              </div>
            </div>

            {/* Side Relief Pockets (for clearing swinging reverse bends) */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
                <span className="text-[11px] font-semibold text-slate-200">
                  Side Flange Relief Cutouts
                </span>
                <button
                  onClick={() => {
                    setHasSideRelief(!hasSideRelief)
                    setCustomPoints(null)
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold transition ${
                    hasSideRelief
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {hasSideRelief ? 'ENABLED' : 'STANDARD'}
                </button>
              </div>

              {hasSideRelief && (
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-400">Relief Depth:</span>
                    <span className="font-mono text-cyan-300 font-bold">{reliefDepth} mm</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="40"
                    step="2"
                    value={reliefDepth}
                    onChange={(e) => {
                      setReliefDepth(parseFloat(e.target.value))
                      setCustomPoints(null)
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-cyan-500"
                  />
                </div>
              )}
            </div>

            {customPoints && (
              <div className="flex items-center justify-between bg-amber-950/40 border border-amber-800/80 rounded p-2 text-[11px] text-amber-200">
                <span>Custom vertex dragging active</span>
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
                V-Apex Datum: <strong className="text-cyan-400 font-mono">(0, 0)</strong>
              </span>
              <span>Drag any vertex dot to custom-contour die shoulders and reliefs</span>
            </div>

            {/* SVG Visualizer */}
            <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
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
                  y1={-sheetThickness - height - 20}
                  x2={0}
                  y2={15}
                  stroke="#334155"
                  strokeWidth={0.8}
                  strokeDasharray="3,3"
                />

                {/* Top of Die Reference Line */}
                <line
                  x1={-baseWidth / 2 - 20}
                  y1={-sheetThickness}
                  x2={baseWidth / 2 + 20}
                  y2={-sheetThickness}
                  stroke="#334155"
                  strokeWidth={0.8}
                  strokeDasharray="3,3"
                />

                {/* 1. Die Solid Polygon Body */}
                <polygon
                  points={activePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(14, 165, 233, 0.12)"
                  stroke="#0284c7"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />

                {/* 2. Interactive Vertex Handles */}
                {activePoints.map((p, idx) => (
                  <g key={idx} className="group/die-dot">
                    {/* Hover Ring */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={8}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={1.5}
                      strokeDasharray="2,2"
                      className="opacity-0 group-hover/die-dot:opacity-100 transition-opacity pointer-events-none"
                    />
                    {/* Visible Core */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={4.5}
                      fill="#38bdf8"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      className="pointer-events-none transition-colors group-hover/die-dot:fill-cyan-300"
                    />
                    {/* Generous Hit Target */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={12}
                      fill="transparent"
                      className="cursor-move"
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        setDraggedVertexIdx(idx)
                      }}
                    />
                  </g>
                ))}

                {/* 3. Dimension Annotations */}
                {/* V Opening Width Line */}
                <g>
                  <line
                    x1={-vOpening / 2}
                    y1={-sheetThickness - 8}
                    x2={vOpening / 2}
                    y2={-sheetThickness - 8}
                    stroke="#38bdf8"
                    strokeWidth={1}
                  />
                  <text
                    x={0}
                    y={-sheetThickness - 12}
                    fill="#38bdf8"
                    fontSize={9}
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    V = {vOpening}mm
                  </text>
                </g>

                {/* Die Height Dimension */}
                <g>
                  <line
                    x1={-baseWidth / 2 - 15}
                    y1={-sheetThickness}
                    x2={-baseWidth / 2 - 15}
                    y2={-sheetThickness - height}
                    stroke="#64748b"
                    strokeWidth={1}
                  />
                  <text
                    x={-baseWidth / 2 - 22}
                    y={-sheetThickness - height / 2}
                    fill="#94a3b8"
                    fontSize={9}
                    fontFamily="monospace"
                    textAnchor="middle"
                    transform={`rotate(-90 ${-baseWidth / 2 - 22} ${-sheetThickness - height / 2})`}
                  >
                    H = {height}mm
                  </text>
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-14 bg-slate-950 border-t border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            This die contour will be used for continuous 2D & 3D collision sweeps and V-span forming.
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
              <span>Save & Use Custom Die</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
