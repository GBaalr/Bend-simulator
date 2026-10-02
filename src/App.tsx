import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Header, WorkflowStepId } from './components/Header'
import { SketcherStep } from './components/SketcherStep'
import { ToolingSetupStep } from './components/ToolingSetupStep'
import { SequenceStepView } from './components/SequenceStepView'
import { SimulationStepView } from './components/SimulationStepView'
import { DxfImportModal } from './components/DxfImportModal'
import { MobileConnectModal } from './components/MobileConnectModal'
import { SetupSheetModal } from './components/SetupSheetModal'

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
import {
  computeContinuousMotion,
  getElapsedTimeForStep,
  MotionState,
  PHASE_DURATIONS,
} from './core/motionEngine'

export function App() {
  // Stepped Workflow Mode
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState<WorkflowStepId>('SKETCH')

  // Part & Tooling State
  const [part, setPart] = useState<SheetMetalPart>(SAMPLE_PRESETS.u_channel.part)
  const [material, setMaterial] = useState<Material>(STANDARD_MATERIALS[0])
  const [punch, setPunch] = useState<Punch>(STANDARD_PUNCHES[0]) // default straight punch
  const [die, setDie] = useState<Die>(STANDARD_DIES[1]) // V12
  const [envelope, setEnvelope] = useState<MachineEnvelope>(DEFAULT_MACHINE_ENVELOPE)

  // Simulation State with Continuous Realistic Multi-Step Animation
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [progress, setProgress] = useState(1.0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0)
  const [motionState, setMotionState] = useState<MotionState | null>(null)
  const [isDxfModalOpen, setIsDxfModalOpen] = useState(false)
  const [isSolving, setIsSolving] = useState(false)
  const [isMobileConnectOpen, setIsMobileConnectOpen] = useState(false)
  const [isSetupSheetOpen, setIsSetupSheetOpen] = useState(false)

  const elapsedMsRef = useRef<number>(0)
  const lastTimeRef = useRef<number | null>(null)
  const animRef = useRef<number | null>(null)

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

  // Realistic Continuous Multi-Step Animation Loop
  useEffect(() => {
    if (!isPlaying || !activeSequence || activeSequence.steps.length === 0) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      lastTimeRef.current = null
      return
    }

    lastTimeRef.current = performance.now()

    const stepAnim = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now
      const delta = Math.min(60, now - lastTimeRef.current) * playbackSpeed
      lastTimeRef.current = now

      elapsedMsRef.current += delta

      const motion = computeContinuousMotion(activeSequence, elapsedMsRef.current, 1.0)
      setMotionState(motion)
      setActiveStepIndex(motion.stepIndex)
      setProgress(motion.bendProgress)

      if (motion.isFinished) {
        setIsPlaying(false)
        lastTimeRef.current = null
        return
      }

      animRef.current = requestAnimationFrame(stepAnim)
    }

    animRef.current = requestAnimationFrame(stepAnim)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [isPlaying, activeSequence, playbackSpeed])

  const handleSelectStep = (idx: number) => {
    if (!activeSequence) return
    setIsPlaying(false)
    setActiveStepIndex(idx)
    setProgress(1.0)
    setMotionState(null)
    elapsedMsRef.current =
      getElapsedTimeForStep(activeSequence, idx) + PHASE_DURATIONS.FORMING
  }

  const handleTogglePlay = () => {
    if (!activeSequence || activeSequence.steps.length === 0) return
    if (isPlaying) {
      setIsPlaying(false)
      return
    }

    // If finished or at end, start from beginning
    const isAtEnd =
      activeStepIndex === activeSequence.steps.length - 1 && progress >= 0.99
    if (isAtEnd || motionState?.isFinished) {
      setActiveStepIndex(0)
      setProgress(0.0)
      elapsedMsRef.current = 0
      setMotionState(null)
    } else {
      // Resume from current step progress
      elapsedMsRef.current =
        getElapsedTimeForStep(activeSequence, activeStepIndex) +
        progress * PHASE_DURATIONS.FORMING
    }
    setIsPlaying(true)
  }

  const handleProgressChange = (p: number) => {
    if (!activeSequence) return
    setIsPlaying(false)
    setProgress(p)
    setMotionState(null)
    elapsedMsRef.current =
      getElapsedTimeForStep(activeSequence, activeStepIndex) +
      p * PHASE_DURATIONS.FORMING
  }

  const handleLoadPreset = (key: string) => {
    if (SAMPLE_PRESETS[key]) {
      setPart(SAMPLE_PRESETS[key].part)
      setActiveStepIndex(0)
      setProgress(1.0)
      setIsPlaying(false)
      setMotionState(null)
      elapsedMsRef.current = 0
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
        onOpenSetupSheet={() => setIsSetupSheetOpen(true)}
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
            material={material}
            metrics={metrics}
            punch={punch}
            die={die}
            envelope={envelope}
            sequence={activeSequence}
            delemProgram={delemProgram}
            activeStepIndex={activeStepIndex}
            progress={progress}
            isPlaying={isPlaying}
            onSelectStep={handleSelectStep}
            onTogglePlay={handleTogglePlay}
            onProgressChange={handleProgressChange}
            onOpenSetupSheet={() => setIsSetupSheetOpen(true)}
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
            punchYOverride={motionState?.punchYOverride}
            sheetTransform={motionState?.sheetTransform}
            gaugeOverride={motionState?.gaugeOverride}
            statusMessage={motionState?.statusMessage}
            completedBendsOverride={motionState?.completedBends}
            activeBendIndexOverride={motionState?.activeBendIndex}
            orientationOverride={motionState?.orientation}
            playbackSpeed={playbackSpeed}
            onChangePlaybackSpeed={setPlaybackSpeed}
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

      {/* Shop-Floor Setup Sheet & Test Report Modal */}
      <SetupSheetModal
        isOpen={isSetupSheetOpen}
        onClose={() => setIsSetupSheetOpen(false)}
        part={part}
        material={material}
        punch={punch}
        die={die}
        envelope={envelope}
        metrics={metrics}
        sequence={activeSequence}
        delemProgram={delemProgram}
      />
    </div>
  )
}

export default App
