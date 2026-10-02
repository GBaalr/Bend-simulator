import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { SheetMetalPart } from '../types/sheetMetal'
import { Punch, Die, MachineEnvelope } from '../types/tooling'
import { StepCollisionResult } from '../types/simulation'
import { computePartKinematics } from '../core/kinematicChain'
import { generatePunchPolygon, generateDiePolygon } from '../core/toolingCatalog'

interface Viewport3DProps {
  part: SheetMetalPart
  punch: Punch
  die: Die
  envelope: MachineEnvelope
  activeBendIndex: number
  completedBends: Map<number, number>
  progress: number
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

export const Viewport3D: React.FC<Viewport3DProps> = ({
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
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

  // Dynamic mesh references
  const sheetGroupRef = useRef<THREE.Group | null>(null)
  const punchMeshRef = useRef<THREE.Mesh | null>(null)
  const dieMeshRef = useRef<THREE.Mesh | null>(null)
  const gaugeMeshRef = useRef<THREE.Mesh | null>(null)

  // Orbit controls state
  const isMouseDown = useRef(false)
  const mousePos = useRef({ x: 0, y: 0 })
  const spherical = useRef({ radius: 700, theta: Math.PI / 4, phi: Math.PI / 3 })

  // Initialize Three.js scene
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0f1d)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 5000)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambientLight)

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight1.position.set(300, 600, 400)
    dirLight1.castShadow = true
    scene.add(dirLight1)

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.6)
    dirLight2.position.set(-400, 200, -300)
    scene.add(dirLight2)

    // Floor Grid
    const grid = new THREE.GridHelper(1500, 30, 0x1e293b, 0x0f172a)
    grid.position.y = -die.height - part.thickness - 200
    scene.add(grid)

    // Groups
    const sheetGroup = new THREE.Group()
    scene.add(sheetGroup)
    sheetGroupRef.current = sheetGroup

    // Animate loop
    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)

      // Update camera position from spherical coordinates
      const r = spherical.current.radius
      const theta = spherical.current.theta
      const phi = spherical.current.phi
      camera.position.x = r * Math.sin(phi) * Math.sin(theta)
      camera.position.y = r * Math.cos(phi)
      camera.position.z = r * Math.sin(phi) * Math.cos(theta)
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
    }
    animate()

    // Resize listener
    const handleResize = () => {
      if (!container || !renderer || !camera) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Mouse Orbit interactions
  const handleMouseDown = (e: React.MouseEvent) => {
    isMouseDown.current = true
    mousePos.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current) return
    const dx = e.clientX - mousePos.current.x
    const dy = e.clientY - mousePos.current.y
    mousePos.current = { x: e.clientX, y: e.clientY }

    spherical.current.theta -= dx * 0.006
    spherical.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.current.phi - dy * 0.006))
  }

  const handleMouseUp = () => (isMouseDown.current = false)

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    spherical.current.radius = Math.max(200, Math.min(2500, spherical.current.radius + e.deltaY * 0.8))
  }

  // Mobile Touch Orbit handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isMouseDown.current = true
      mousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMouseDown.current || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - mousePos.current.x
    const dy = e.touches[0].clientY - mousePos.current.y
    mousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }

    spherical.current.theta -= dx * 0.006
    spherical.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, spherical.current.phi - dy * 0.006))
  }

  const handleTouchEnd = () => {
    isMouseDown.current = false
  }

  // Helper to create 3D extruded geometry from 2D polygon
  const createExtrusion = (poly: { x: number; y: number }[], depth: number) => {
    const shape = new THREE.Shape()
    if (poly.length < 3) return new THREE.BufferGeometry()
    shape.moveTo(poly[0].x, poly[0].y)
    for (let i = 1; i < poly.length; i++) {
      shape.lineTo(poly[i].x, poly[i].y)
    }
    shape.closePath()
    return new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
    })
  }

  // Re-build 3D Meshes when state or progress updates
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const partWidth = part.width || 400
    const toolWidth = Math.max(partWidth + 80, 500)

    // 1. Update Punch Mesh with smooth stroke & ram opening elevation
    if (punchMeshRef.current) scene.remove(punchMeshRef.current)
    const rawPunchPoly = punch.polygon2D ?? generatePunchPolygon(punch)
    const punchGeo = createExtrusion(rawPunchPoly, toolWidth)
    punchGeo.center()
    const punchMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.3,
      metalness: 0.8,
    })
    const punchMesh = new THREE.Mesh(punchGeo, punchMat)
    const effectivePunchY =
      punchYOverride !== undefined ? punchYOverride : -penetrationDepth * progress
    punchMesh.position.set(0, punch.height / 2 + effectivePunchY, 0)
    punchMesh.castShadow = true
    scene.add(punchMesh)
    punchMeshRef.current = punchMesh

    // 2. Update Die Mesh
    if (dieMeshRef.current) scene.remove(dieMeshRef.current)
    const rawDiePoly = die.polygon2D ?? generateDiePolygon(die, part.thickness)
    const dieGeo = createExtrusion(rawDiePoly, toolWidth)
    dieGeo.center()
    const dieMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.7,
    })
    const dieMesh = new THREE.Mesh(dieGeo, dieMat)
    dieMesh.position.set(0, -die.height / 2 - part.thickness, 0)
    dieMesh.receiveShadow = true
    scene.add(dieMesh)
    dieMeshRef.current = dieMesh

    // 3. Update Backgauge Finger Mesh with smooth dynamic positioning
    if (gaugeMeshRef.current) scene.remove(gaugeMeshRef.current)
    const effectiveGaugeX = gaugeOverride?.x ?? gaugeX
    const effectiveGaugeR = gaugeOverride?.r ?? gaugeR
    const gaugeGeo = new THREE.BoxGeometry(40, 50, 40)
    const gaugeMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.5,
      metalness: 0.6,
    })
    const gaugeMesh = new THREE.Mesh(gaugeGeo, gaugeMat)
    gaugeMesh.position.set(effectiveGaugeX + 20, effectiveGaugeR + 25, 0)
    scene.add(gaugeMesh)
    gaugeMeshRef.current = gaugeMesh

    // 4. Update Sheet Metal Part Segments & Apply Realistic Handling Transform (Withdraw / 180° Turn / Insert)
    const sheetGroup = sheetGroupRef.current
    if (!sheetGroup) return
    while (sheetGroup.children.length > 0) {
      sheetGroup.remove(sheetGroup.children[0])
    }

    const transX = sheetTransform?.x ?? 0
    const transY = sheetTransform?.y ?? 0
    const rotX = sheetTransform?.rotationX ?? 0
    const rotY = sheetTransform?.rotationY ?? 0
    sheetGroup.position.set(transX, transY, 0)
    sheetGroup.rotation.set(rotX, rotY, 0)

    const kinState = computePartKinematics(
      part,
      activeBendIndex,
      completedBends,
      progress,
      orientation,
      penetrationDepth
    )

    const hasCollision = collisionResult?.hasCollision ?? false
    const collidingFlanges = collisionResult?.collidingFlanges ?? []

    kinState.segments.forEach((seg) => {
      const isColliding = collidingFlanges.includes(seg.flangeIndex)
      const segGeo = createExtrusion(seg.polygon, partWidth)
      // center Z
      segGeo.translate(0, 0, -partWidth / 2)

      const segMat = new THREE.MeshStandardMaterial({
        color: isColliding ? 0xef4444 : 0x38bdf8,
        emissive: isColliding ? 0x7f1d1d : 0x075985,
        emissiveIntensity: isColliding ? 0.8 : 0.2,
        roughness: 0.25,
        metalness: 0.85,
      })

      const mesh = new THREE.Mesh(segGeo, segMat)
      mesh.castShadow = true
      sheetGroup.add(mesh)
    })
  }, [
    part,
    punch,
    die,
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
  ])

  return (
    <div
      ref={mountRef}
      className="relative w-full h-full bg-slate-950 cursor-grab active:cursor-grabbing select-none touch-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur border border-slate-800 text-[11px] text-slate-300 px-3 py-1.5 rounded-lg shadow-lg pointer-events-none flex items-center space-x-2">
        <span className="text-cyan-400 font-bold">3D Extrusion View</span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-400">Orbit: Drag</span>
      </div>

      {statusMessage && (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur border border-cyan-500/40 text-xs text-white px-3.5 py-1.5 rounded-xl shadow-2xl pointer-events-none flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-mono text-cyan-200">{statusMessage}</span>
        </div>
      )}
    </div>
  )
}
