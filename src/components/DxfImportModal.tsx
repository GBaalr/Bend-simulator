import React, { useState } from 'react'
import { X, Upload, FileCode, AlertCircle, Check, Info } from 'lucide-react'
import { SheetMetalPart } from '../types/sheetMetal'
import { parseDxfProfile } from '../core/dxfImporter'
import { parseStepProfile } from '../core/stepImporter'

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
  const [fileContent, setFileContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileType, setFileType] = useState<'dxf' | 'step' | 'sldprt' | null>(null)
  const [thickness, setThickness] = useState(2.0)
  const [width, setWidth] = useState(500)
  const [error, setError] = useState<string | null>(null)
  const [solidworksHelp, setSolidworksHelp] = useState(false)
  const [previewPart, setPreviewPart] = useState<SheetMetalPart | null>(null)

  if (!isOpen) return null

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setSolidworksHelp(false)
    setPreviewPart(null)
    const file = e.target.files?.[0]
    if (!file) return

    const name = file.name.toLowerCase()
    setFileName(file.name)

    if (name.endsWith('.sldprt')) {
      setFileType('sldprt')
      setSolidworksHelp(true)
      return
    }

    const isStep = name.endsWith('.step') || name.endsWith('.stp')
    const type = isStep ? 'step' : 'dxf'
    setFileType(type)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setFileContent(content)
      tryParse(content, type)
    }
    reader.readAsText(file)
  }

  const tryParse = (content: string, type: 'dxf' | 'step') => {
    try {
      let parsed: SheetMetalPart
      if (type === 'step') {
        parsed = parseStepProfile(content, thickness, width)
      } else {
        parsed = parseDxfProfile(content, thickness, width)
      }
      setPreviewPart(parsed)
      setError(null)
    } catch (err: any) {
      setError(err.message || `Failed to parse ${type.toUpperCase()} CAD geometry.`)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <FileCode className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Import CAD / SolidWorks File</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions */}
        <p className="text-xs text-slate-400 leading-relaxed">
          Upload a 2D or 3D sheet metal profile exported from <span className="text-cyan-300 font-semibold">SolidWorks</span>, <span className="text-slate-200">AutoCAD</span>, or <span className="text-slate-200">Inventor</span>. Supports <span className="text-slate-200 font-mono">.DXF</span> and <span className="text-slate-200 font-mono">.STEP / .STP</span> formats.
        </p>

        {/* File Dropzone */}
        <label className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition space-y-2">
          <Upload className="w-8 h-8 text-cyan-400" />
          <span className="text-xs font-medium text-slate-200">
            Click to choose .DXF, .STEP, .STP or .SLDPRT
          </span>
          <span className="text-[10px] text-slate-500">
            SolidWorks DXF/STEP • AutoCAD DXF R12-2024 • ISO-10303 STEP
          </span>
          <input
            type="file"
            accept=".dxf,.step,.stp,.sldprt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* SolidWorks .SLDPRT Direct Export Guide */}
        {solidworksHelp && (
          <div className="bg-cyan-950/40 border border-cyan-800 rounded-lg p-3 text-xs text-cyan-200 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-cyan-300">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>SolidWorks Part ({fileName}) Detected</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Because <span className="font-mono text-cyan-300">.sldprt</span> is a proprietary binary format, SolidWorks provides instant 1-click export to standard CAD:
            </p>
            <div className="bg-slate-950/80 rounded p-2.5 space-y-1.5 text-[11px] font-mono border border-slate-800">
              <div>
                <span className="text-cyan-400 font-bold">1. Universal 3D:</span> In SolidWorks, click <span className="text-white">File → Save As → STEP AP214 (.step)</span>
              </div>
              <div>
                <span className="text-cyan-400 font-bold">2. 2D Profile:</span> Right-click the sheet metal face/flat pattern → <span className="text-white">Export to DXF/DWG</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Drop the exported <span className="text-cyan-300">.step</span> or <span className="text-cyan-300">.dxf</span> file here and it will load immediately!
            </p>
          </div>
        )}

        {/* Global Dimensions */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Sheet Thickness (mm)</label>
            <input
              type="number"
              step="0.5"
              min="0.1"
              value={thickness}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 1
                setThickness(val)
                if (fileContent && fileType && fileType !== 'sldprt') {
                  tryParse(fileContent, fileType)
                }
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Bend Length / Width (mm)</label>
            <input
              type="number"
              step="50"
              min="1"
              value={width}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 100
                setWidth(val)
                if (fileContent && fileType && fileType !== 'sldprt') {
                  tryParse(fileContent, fileType)
                }
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
              <span>Successfully Extracted Geometry ({fileName}):</span>
            </div>
            <div className="text-slate-300 text-[11px] grid grid-cols-2 gap-2 font-mono">
              <div>Flanges: {previewPart.flanges.length} segments (lengths: {previewPart.flanges.map(f => `${f.length}mm`).join(', ')})</div>
              <div>Bends: {previewPart.bends.length} bends ({previewPart.bends.map(b => `${b.angle}° ${b.direction}`).join(', ')})</div>
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
