import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Header, WorkflowStepId } from './components/Header'
import { SketcherStep } from './components/SketcherStep'
import { ToolingSetupStep } from './components/ToolingSetupStep'
import { SequenceStepView } from './components/SequenceStepView'
import { SimulationStepView } from './components/SimulationStepView'
import { DxfImportModal } from './components/DxfImportModal'
import { MobileConnectModal } from './components/MobileConnectModal'

import { SheetMetalPart, Material } from './types/sheetMetal'
import { Punch, Die, MachineEnvelope } from './types/tooling'
import { STANDARD_MATERIALS, calculatePartMetrics } from './core/mathEngine'
import {
  STANDARD_PUNCHES,
  STANDARD_DIES,
  DEFAULT_MACHINE_ENVELOPE,
} from './core/toolingCatalog'
import { solveBendSequence } from './core/sequenceSolver'
import { generateDelemProgram } from './core/delemExporter'

import { SAMPLE_PRESETS } from './core/presets'

export function App() {
  // Stepped Workflow Mode
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState<WorkflowStepId>('SKETCH')

  // Part & Tooling State
  const [part, setPart] = useState<SheetMetalPart>(SAMPLE_PRESETS.u_channel.part)
  const [material, setMaterial] = useState<Material>(STANDARD_MATERIALS[0])
  const [punch, setPunch] = useState<Punch>(STANDARD_PUNCHES[0]) // default straight punch
  const [die, setDie] = useState<Die>(STANDARD_DIES[1]) // V12
  const [envelope, setEnvelope] = useState<MachineEnvelope>(DEFAULT_MACHINE_ENVELOPE)

  // Simulation State
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [progress, setProgress] = useState(1.0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isDxfModalOpen, setIsDxfModalOpen] = useState(false)
  const [isSolving, setIsSolving] = useState(false)
  const [isMobileConnectOpen, setIsMobileConnectOpen] = useState(false)

  // Part Metrics
  const metrics = useMemo(() => {
    return calculatePartMetrics(part, material, die)
  }, [part, material, die])

  // Sequence Solver: runs automatically whenever part, punch, or die changes
  const simulationResult = useMemo(() => {
    return solveBendSequence(part, punch, die, envelope)
  }, [part, punch, die, envelope])

  const activeSequence = simulationResult.bestSequence

  // Delem Program Output
  const delemProgram = useMemo(() => {
    if (!activeSequence) return null
    return generateDelemProgram(part, material, activeSequence, punch, die, metrics.flatLength)
  }, [part, material, activeSequence, punch, die, metrics.flatLength])

  // Animation Loop
  const animRef = useRef<number | null>(null)
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }

    let p = progress
    const stepAnim = () => {
      p += 0.015
      if (p >= 1.0) {
        p = 1.0
        setProgress(1.0)
        setIsPlaying(false)
        return
      }
      setProgress(p)
      animRef.current = requestAnimationFrame(stepAnim)
    }

    animRef.current = requestAnimationFrame(stepAnim)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [isPlaying, progress])

  const handleLoadPreset = (key: string) => {
    if (SAMPLE_PRESETS[key]) {
      setPart(SAMPLE_PRESETS[key].part)
      setActiveStepIndex(0)
      setProgress(1.0)
      setIsPlaying(false)
    }
  }

  // Suggestion application handlers
  const handleApplyToolSwap = (punchId: string) => {
    const found = STANDARD_PUNCHES.find((p) => p.id === punchId)
    if (found) {
      setPunch(found)
    }
  }

  const handleApplyFlangeLength = (flangeIndex: number, newLength: number) => {
    const newFlanges = [...part.flanges]
    if (newFlanges[flangeIndex]) {
      newFlanges[flangeIndex] = { ...newFlanges[flangeIndex], length: newLength }
      setPart({ ...part, flanges: newFlanges })
    }
  }

  const handleApplyOrientation = (newOrientation: 'FORWARD' | 'REVERSE') => {
    if (activeSequence && activeSequence.steps[activeStepIndex]) {
      activeSequence.steps[activeStepIndex].orientation = newOrientation
      setPart({ ...part })
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* 4-Step Navigation Header */}
      <Header
        currentWorkflowStep={currentWorkflowStep}
        onSelectWorkflowStep={setCurrentWorkflowStep}
        onLoadPreset={handleLoadPreset}
        onStartBlankPart={() => {
          setPart({
            name: 'Custom Sketched Part',
            thickness: part.thickness,
            width: part.width,
            materialId: part.materialId,
            flanges: [{ id: 'f0', length: 60 }],
            bends: [],
          })
          setActiveStepIndex(0)
          setProgress(1.0)
          setIsPlaying(false)
          setCurrentWorkflowStep('SKETCH')
        }}
        onOpenDxfModal={() => setIsDxfModalOpen(true)}
        onOpenMobileConnect={() => setIsMobileConnectOpen(true)}
        onAutoSolve={() => {
          setIsSolving(true)
          setTimeout(() => {
            setIsSolving(false)
            setCurrentWorkflowStep('SEQUENCE')
          }, 300)
        }}
        isSolving={isSolving}
      />

      {/* Main Content: Guided Stepped Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* STEP 1: Sketch 2D Side View Profile */}
        {currentWorkflowStep === 'SKETCH' && (
          <SketcherStep
            part={part}
            material={material}
            metrics={metrics}
            onUpdatePart={setPart}
            onUpdateMaterial={setMaterial}
            onNextStep={() => setCurrentWorkflowStep('TOOLING')}
            onLoadPreset={handleLoadPreset}
          />
        )}

        {/* STEP 2: Tooling & Machine Setup */}
        {currentWorkflowStep === 'TOOLING' && (
          <ToolingSetupStep
            part={part}
            material={material}
            punch={punch}
            die={die}
            envelope={envelope}
            metrics={metrics}
            onUpdatePunch={setPunch}
            onUpdateDie={setDie}
            onUpdateEnvelope={setEnvelope}
            onNextStep={() => setCurrentWorkflowStep('SEQUENCE')}
            onPrevStep={() => setCurrentWorkflowStep('SKETCH')}
          />
        )}

        {/* STEP 3: Bending Sequence & Collision Diagnostics */}
        {currentWorkflowStep === 'SEQUENCE' && (
          <SequenceStepView
            part={part}
            punch={punch}
            die={die}
            envelope={envelope}
            sequence={activeSequence}
            suggestions={simulationResult.globalSuggestions}
            onApplyToolSwap={handleApplyToolSwap}
            onApplyFlangeLength={handleApplyFlangeLength}
            onApplyOrientation={handleApplyOrientation}
            onNextStep={() => setCurrentWorkflowStep('SIMULATION')}
            onPrevStep={() => setCurrentWorkflowStep('TOOLING')}
          />
        )}

        {/* STEP 4: Animated Simulation & DELEM Code */}
        {currentWorkflowStep === 'SIMULATION' && (
          <SimulationStepView
            part={part}
            punch={punch}
            die={die}
            envelope={envelope}
            sequence={activeSequence}
            delemProgram={delemProgram}
            activeStepIndex={activeStepIndex}
            progress={progress}
            isPlaying={isPlaying}
            onSelectStep={(idx) => {
              setActiveStepIndex(idx)
              setProgress(1.0)
              setIsPlaying(false)
            }}
            onTogglePlay={() => {
              if (progress >= 0.99) setProgress(0.0)
              setIsPlaying(!isPlaying)
            }}
            onProgressChange={(p) => {
              setProgress(p)
              setIsPlaying(false)
            }}
            onToggleOrientation={() => {
              if (activeSequence && activeSequence.steps[activeStepIndex]) {
                const cur = activeSequence.steps[activeStepIndex].orientation
                activeSequence.steps[activeStepIndex].orientation =
                  cur === 'FORWARD' ? 'REVERSE' : 'FORWARD'
                setPart({ ...part })
              }
            }}
            onPrevStep={() => setCurrentWorkflowStep('SEQUENCE')}
            onBackToSketch={() => setCurrentWorkflowStep('SKETCH')}
          />
        )}
      </main>

      {/* DXF Import Modal */}
      <DxfImportModal
        isOpen={isDxfModalOpen}
        onClose={() => setIsDxfModalOpen(false)}
        onImportPart={(imported) => {
          setPart(imported)
          setActiveStepIndex(0)
          setProgress(1.0)
          setIsPlaying(false)
          setCurrentWorkflowStep('SKETCH')
        }}
      />

      {/* Mobile Connect / QR Code Modal */}
      <MobileConnectModal
        isOpen={isMobileConnectOpen}
        onClose={() => setIsMobileConnectOpen(false)}
        localIp="192.168.1.69"
      />
    </div>
  )
}

export default App
