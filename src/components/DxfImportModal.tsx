import React, { useState } from 'react'
import { X, Upload, FileCode, AlertCircle, Check } from 'lucide-react'
import { SheetMetalPart } from '../types/sheetMetal'
import { parseDxfProfile } from '../core/dxfImporter'

interface DxfImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportPart: (part: SheetMetalPart) => void
}

export const DxfImportModal: React.FC<DxfImportModalProps> = ({
  isOpen,
  onClose,
  onImportPart,
}) => {
  const [dxfText, setDxfText] = useState('')
  const [thickness, setThickness] = useState(2.0)
  const [width, setWidth] = useState(500)
  const [error, setError] = useState<string | null>(null)
  const [previewPart, setPreviewPart] = useState<SheetMetalPart | null>(null)

  if (!isOpen) return null

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setDxfText(content)
      tryParse(content)
    }
    reader.readAsText(file)
  }

  const tryParse = (text: string) => {
    try {
      const parsed = parseDxfProfile(text, thickness, width)
      setPreviewPart(parsed)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to parse DXF geometry.')
      setPreviewPart(null)
    }
  }

  const handleApply = () => {
    if (previewPart) {
      onImportPart(previewPart)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <FileCode className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Import 2D DXF Profile</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions */}
        <p className="text-xs text-slate-400">
          Upload an AutoCAD / CAD 2D cross-section DXF file. The engine will extract lines/polylines,
          calculate flange lengths, and detect bend angles for simulation.
        </p>

        {/* File Dropzone */}
        <label className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition space-y-2">
          <Upload className="w-8 h-8 text-cyan-400" />
          <span className="text-xs font-medium text-slate-200">
            Click to choose a .DXF file or drag & drop
          </span>
          <span className="text-[10px] text-slate-500">AutoCAD R12, 2000, 2018 DXF files</span>
          <input
            type="file"
            accept=".dxf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Global Dimensions */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Sheet Thickness (mm)</label>
            <input
              type="number"
              step="0.5"
              value={thickness}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 1
                setThickness(val)
                if (dxfText) tryParse(dxfText)
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Bend Length / Width (mm)</label>
            <input
              type="number"
              step="50"
              value={width}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 100
                setWidth(val)
                if (dxfText) tryParse(dxfText)
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center space-x-2 bg-red-950/60 border border-red-800 rounded-lg p-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Parsed Preview */}
        {previewPart && (
          <div className="bg-slate-950 border border-emerald-800/80 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
              <Check className="w-4 h-4" />
              <span>Successfully Extracted Geometry:</span>
            </div>
            <div className="text-slate-300 text-[11px] grid grid-cols-2 gap-2 font-mono">
              <div>Flanges: {previewPart.flanges.length} segments</div>
              <div>Bends: {previewPart.bends.length} bends</div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!previewPart}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg disabled:opacity-40 transition shadow-md shadow-cyan-600/20"
          >
            Load into Simulator
          </button>
        </div>
      </div>
    </div>
  )
}
