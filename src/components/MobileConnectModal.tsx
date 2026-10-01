import React, { useState } from 'react'
import { X, Smartphone, Wifi, Copy, Check, ExternalLink, QrCode } from 'lucide-react'

interface MobileConnectModalProps {
  isOpen: boolean
  onClose: () => void
  localIp: string
  port?: number
}

export const MobileConnectModal: React.FC<MobileConnectModalProps> = ({
  isOpen,
  onClose,
  localIp,
  port = 5173,
}) => {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const phoneUrl = `http://${localIp}:${port}/`
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    phoneUrl
  )}&bgcolor=0f172a&color=38bdf8&margin=10`

  const handleCopy = () => {
    navigator.clipboard.writeText(phoneUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="h-14 bg-slate-950 border-b border-slate-800 px-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Connect From Your Phone
              </h3>
              <p className="text-[10px] text-slate-400">Use on any smartphone, iPhone, or tablet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center space-y-5">
          {/* QR Code Container */}
          <div className="p-3 bg-slate-950 border-2 border-cyan-500/50 rounded-2xl shadow-xl shadow-cyan-950/40 relative group">
            <img
              src={qrCodeUrl}
              alt="Scan to open on phone"
              className="w-48 h-48 rounded-xl object-contain"
              onError={(e) => {
                // Fallback placeholder if offline
                e.currentTarget.style.display = 'none'
              }}
            />
            <div className="text-center mt-1.5">
              <span className="text-[10px] text-cyan-400 font-mono font-semibold flex items-center justify-center gap-1">
                <QrCode className="w-3 h-3" />
                Scan with phone camera
              </span>
            </div>
          </div>

          {/* URL Box */}
          <div className="w-full space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 block">
              Or type this URL in your phone's browser:
            </label>
            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2">
              <span className="font-mono text-cyan-300 font-bold text-sm tracking-wide flex-1 truncate select-all">
                {phoneUrl}
              </span>
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                title="Copy URL"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Checklist */}
          <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
            <div className="flex items-start space-x-2">
              <Wifi className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                Make sure your phone is connected to the <strong>same Wi-Fi network</strong> as this PC.
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Touch gestures supported: tap dots to draw, touch and drag to orbit 3D simulation.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 bg-slate-950 border-t border-slate-800 px-5 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg shadow-md transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
