import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import {
  Eye,
  User,
  Search,
  RotateCcw,
  Target,
  Layers,
  Sparkles,
  Activity,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react'
import { SheetMetalPart, Material } from '../types/sheetMetal'
import { Punch, Die, MachineEnvelope } from '../types/tooling'
import { StepCollisionResult } from '../types/simulation'
import { computePartKinematics } from '../core/kinematicChain'
import { generatePunchPolygon, generateDiePolygon } from '../core/toolingCatalog'
import { calculateSpringback, calculateBendingTonnage } from '../core/mathEngine'
import { checkInstantCollision } from '../core/collisionEngine'

export type CameraPreset = 'ISOMETRIC' | 'OPERATOR' | 'TOOLING' | 'SIDE_PROFILE' | 'BACKGAUGE'

interface Viewport3DProps {
  part: SheetMetalPart
  material?: Material
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
  material,
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
  const ramMovingGroupRef = useRef<THREE.Group | null>(null)
  const punchMeshRef = useRef<THREE.Mesh | null>(null)
  const dieMeshRef = useRef<THREE.Mesh | null>(null)
  const gaugeGroupRef = useRef<THREE.Group | null>(null)
  const machineStaticGroupRef = useRef<THREE.Group | null>(null)
  const pistonRodsRef = useRef<{ left: THREE.Mesh; right: THREE.Mesh } | null>(null)

  // Camera animation & orbit state
  const [activeCameraPreset, setActiveCameraPreset] = useState<CameraPreset>('ISOMETRIC')
  const [isHudMinimized, setIsHudMinimized] = useState(false)
  const isMouseDown = useRef(false)
  const mousePos = useRef({ x: 0, y: 0 })
  const currentSpherical = useRef({ radius: 750, theta: Math.PI / 4, phi: Math.PI / 3 })
  const targetSpherical = useRef({ radius: 750, theta: Math.PI / 4, phi: Math.PI / 3 })
  const currentLookAt = useRef(new THREE.Vector3(0, -10, 0))
  const targetLookAt = useRef(new THREE.Vector3(0, -10, 0))

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

  // Camera Preset Switcher
  const applyCameraPreset = (preset: CameraPreset) => {
    setActiveCameraPreset(preset)
    const effectiveGaugeX = gaugeOverride?.x ?? gaugeX

    switch (preset) {
      case 'OPERATOR':
        // Front-facing ergonomic view from operator eye level looking down into tooling gap
        targetSpherical.current = { radius: 760, theta: -Math.PI / 2, phi: Math.PI / 2.7 }
        targetLookAt.current.set(0, 20, 0)
        break
      case 'TOOLING':
        // Focused macro close-up centered directly on punch tip, V-die opening, and sheet bend line
        targetSpherical.current = { radius: 260, theta: -Math.PI / 2.5, phi: Math.PI / 2.3 }
        targetLookAt.current.set(0, 0, 0)
        break
      case 'SIDE_PROFILE':
        // True side cross-section along the Z-axis (tooling length) inspecting throat clearance
        targetSpherical.current = { radius: 850, theta: 0, phi: Math.PI / 2 }
        targetLookAt.current.set(100, 40, 0)
        break
      case 'BACKGAUGE':
        // Rear angle inspecting sheet contact against backgauge stop fingers
        targetSpherical.current = { radius: 660, theta: Math.PI / 1.35, phi: Math.PI / 2.8 }
        targetLookAt.current.set(effectiveGaugeX, 20, 0)
        break
      case 'ISOMETRIC':
      default:
        // Classical 3D engineering isometric hero view
        targetSpherical.current = { radius: 850, theta: Math.PI / 4, phi: Math.PI / 3 }
        targetLookAt.current.set(40, 30, 0)
        break
    }
  }

  // Initialize Three.js Scene, Lighting, & Machine Structural Framework
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0c1220) // Deep clean engineering studio canvas
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 8000)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.32 // Bright, crystal clear industrial illumination
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // --- High-End Multi-Point Industrial Studio Lighting Rig ---
    // 1. Natural Ambient Fill (Soft sky daylight & ground slate bounce)
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 1.3)
    scene.add(hemiLight)

    // 2. High-Bay Overhead Lighting (Wide shadow-casting directional light)
    const overheadLight = new THREE.DirectionalLight(0xffffff, 2.0)
    overheadLight.position.set(200, 950, 300)
    overheadLight.castShadow = true
    overheadLight.shadow.mapSize.width = 2048
    overheadLight.shadow.mapSize.height = 2048
    overheadLight.shadow.camera.near = 50
    overheadLight.shadow.camera.far = 2400
    overheadLight.shadow.camera.left = -750
    overheadLight.shadow.camera.right = 750
    overheadLight.shadow.camera.top = 750
    overheadLight.shadow.camera.bottom = -750
    overheadLight.shadow.bias = -0.0004
    scene.add(overheadLight)

    // 3. Tooling Area LED Worklight (Bright, focused down into the V-die and punch gap)
    const toolingLight = new THREE.DirectionalLight(0xffffff, 2.5)
    toolingLight.position.set(-50, 450, 450)
    scene.add(toolingLight)

    // 4. Rear Backgauge & Throat Illumination (Lights up rear sheet flange & stop fingers)
    const rearGaugeLight = new THREE.DirectionalLight(0xe2e8f0, 1.5)
    rearGaugeLight.position.set(450, 350, -250)
    scene.add(rearGaugeLight)

    // 5. Left Side Profile Fill (Ensures clear visibility inside the C-frame throat cutout)
    const sideThroatLight = new THREE.DirectionalLight(0x93c5fd, 1.25)
    sideThroatLight.position.set(-600, 200, 0)
    scene.add(sideThroatLight)

    // 6. Specular Rim Light (Crisp edge highlights on sheet metal and precision ground tooling)
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2)
    rimLight.position.set(-350, 500, -500)
    scene.add(rimLight)

    // Floor Grid & Ground Plane
    const floorY = -part.thickness - die.height - 45 - 320
    const grid = new THREE.GridHelper(2200, 44, 0x334155, 0x1e293b)
    grid.position.y = floorY
    scene.add(grid)

    const groundGeo = new THREE.PlaneGeometry(3200, 3200)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0c1220,
      roughness: 0.85,
      metalness: 0.15,
    })
    const groundMesh = new THREE.Mesh(groundGeo, groundMat)
    groundMesh.rotation.x = -Math.PI / 2
    groundMesh.position.y = floorY - 0.5
    groundMesh.receiveShadow = true
    scene.add(groundMesh)

    // Groups
    const machineStaticGroup = new THREE.Group()
    scene.add(machineStaticGroup)
    machineStaticGroupRef.current = machineStaticGroup

    const ramMovingGroup = new THREE.Group()
    scene.add(ramMovingGroup)
    ramMovingGroupRef.current = ramMovingGroup

    const gaugeGroup = new THREE.Group()
    scene.add(gaugeGroup)
    gaugeGroupRef.current = gaugeGroup

    const sheetGroup = new THREE.Group()
    scene.add(sheetGroup)
    sheetGroupRef.current = sheetGroup

    // Continuous Animation Loop with Smooth Camera Lerp
    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)

      // Smooth Lerp Camera Spherical Coordinates & LookAt target
      const lerpSpeed = 0.085
      const s = currentSpherical.current
      const ts = targetSpherical.current
      s.radius += (ts.radius - s.radius) * lerpSpeed
      s.theta += (ts.theta - s.theta) * lerpSpeed
      s.phi += (ts.phi - s.phi) * lerpSpeed

      const cl = currentLookAt.current
      const tl = targetLookAt.current
      cl.x += (tl.x - cl.x) * lerpSpeed
      cl.y += (tl.y - cl.y) * lerpSpeed
      cl.z += (tl.z - cl.z) * lerpSpeed

      // Update camera position from spherical coords
      camera.position.x = s.radius * Math.sin(s.phi) * Math.sin(s.theta) + cl.x
      camera.position.y = s.radius * Math.cos(s.phi) + cl.y
      camera.position.z = s.radius * Math.sin(s.phi) * Math.cos(s.theta) + cl.z
      camera.lookAt(cl.x, cl.y, cl.z)

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

  // Mouse Orbit interactions (updates targetSpherical directly for 60fps tracking)
  const handleMouseDown = (e: React.MouseEvent) => {
    isMouseDown.current = true
    mousePos.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current) return
    const dx = e.clientX - mousePos.current.x
    const dy = e.clientY - mousePos.current.y
    mousePos.current = { x: e.clientX, y: e.clientY }

    targetSpherical.current.theta -= dx * 0.0055
    targetSpherical.current.phi = Math.max(
      0.08,
      Math.min(Math.PI / 2 - 0.04, targetSpherical.current.phi - dy * 0.0055)
    )
  }

  const handleMouseUp = () => (isMouseDown.current = false)

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    targetSpherical.current.radius = Math.max(
      180,
      Math.min(2200, targetSpherical.current.radius + e.deltaY * 0.75)
    )
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

    targetSpherical.current.theta -= dx * 0.0055
    targetSpherical.current.phi = Math.max(
      0.08,
      Math.min(Math.PI / 2 - 0.04, targetSpherical.current.phi - dy * 0.0055)
    )
  }

  const handleTouchEnd = () => {
    isMouseDown.current = false
  }

  // Re-build 3D Meshes, Machine Structure, Tooling, and Sheet when state updates
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const partWidth = part.width || 400
    const toolWidth = Math.max(partWidth + 120, 600)
    const frameSpanZ = toolWidth + 110 // Distance between left and right C-frames

    // Materials
    const darkMachineMat = new THREE.MeshStandardMaterial({
      color: 0x273549, // Powder-coated industrial machine slate
      roughness: 0.45,
      metalness: 0.35,
    })
    const machineBlueMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8, // Vibrant machine hydraulic blue
      roughness: 0.32,
      metalness: 0.68,
    })
    const chromePistonMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0.98,
    })
    const punchSteelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Ground tool steel with bright sheen
      roughness: 0.22,
      metalness: 0.90,
    })
    const dieSteelMat = new THREE.MeshStandardMaterial({
      color: 0x64748b, // Hardened ground die block steel
      roughness: 0.24,
      metalness: 0.88,
    })
    const clampBarMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // Machined clamp rail steel
      roughness: 0.38,
      metalness: 0.70,
    })
    const ramMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Heavy forged ram apron plate
      roughness: 0.35,
      metalness: 0.65,
    })

    // 1. Static Machine Structural Frame (Side Columns, Cylinders, Lower Bed, Backgauge Rail)
    // 1. Static Machine Structural Frame (Side Columns, Cylinders, Lower Bed, Die Rail Holder)
    const staticGroup = machineStaticGroupRef.current
    if (staticGroup) {
      while (staticGroup.children.length > 0) staticGroup.remove(staticGroup.children[0])

      const dieRailH = envelope.dieRailHeight || 55
      const dieRailW = envelope.dieRailWidth || 95
      const dieBaseY = -part.thickness - die.height
      const floorY = -part.thickness - die.height - dieRailH - 320

      // Lower Die Rail / Table Adapter (Height: 55mm, Width: 95mm with 13mm centering groove)
      const dieRailGeo = new THREE.BoxGeometry(dieRailW, dieRailH, toolWidth + 20)
      const dieRailMesh = new THREE.Mesh(dieRailGeo, clampBarMat)
      dieRailMesh.position.set(0, dieBaseY - dieRailH / 2, 0)
      dieRailMesh.receiveShadow = true
      dieRailMesh.castShadow = true
      staticGroup.add(dieRailMesh)

      // Die Clamping Side Locking Screws along the rail
      const screwGeo = new THREE.CylinderGeometry(5, 5, 12, 12)
      screwGeo.rotateZ(Math.PI / 2)
      const screwSpacing = 160
      const numScrews = Math.floor(toolWidth / screwSpacing)
      for (let i = -numScrews / 2; i <= numScrews / 2; i++) {
        const screwMesh = new THREE.Mesh(screwGeo, chromePistonMat)
        screwMesh.position.set(-dieRailW / 2 - 4, dieBaseY - dieRailH / 2, i * screwSpacing)
        staticGroup.add(screwMesh)
      }

      // Main Lower Bed / Table (under die rail)
      const bedGeo = new THREE.BoxGeometry(envelope.bedWidth || 160, 320, toolWidth + 80)
      const bedMesh = new THREE.Mesh(bedGeo, darkMachineMat)
      bedMesh.position.set(0, dieBaseY - dieRailH - 160, 0)
      bedMesh.receiveShadow = true
      bedMesh.castShadow = true
      staticGroup.add(bedMesh)

      // Left and Right C-Frame Upright Columns with authentic 350mm deep throat cutout (DELEM DA-53T factory specs)
      const createCFrameMesh = (zPos: number) => {
        const frameShape = new THREE.Shape()
        const frontX = -180
        const throatRearX = envelope.throatDepth || 350
        const columnBackX = 650
        const bottomY = floorY
        const topY = 560
        const throatBottomY = -die.height - part.thickness - dieRailH - 10
        const throatTopY = 360

        frameShape.moveTo(frontX, bottomY)
        frameShape.lineTo(columnBackX, bottomY)
        frameShape.lineTo(columnBackX, topY)
        frameShape.lineTo(0, topY)
        frameShape.lineTo(frontX, topY - 140)
        frameShape.lineTo(frontX, throatTopY)
        // Authentic C-Frame throat cutout
        frameShape.lineTo(throatRearX, throatTopY)
        frameShape.lineTo(throatRearX, throatBottomY)
        frameShape.lineTo(frontX, throatBottomY)
        frameShape.closePath()

        const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
          depth: 65,
          bevelEnabled: true,
          bevelThickness: 3,
          bevelSize: 3,
        })
        frameGeo.translate(0, 0, -65 / 2)
        const frameMesh = new THREE.Mesh(frameGeo, darkMachineMat)
        frameMesh.position.set(0, 0, zPos)
        frameMesh.castShadow = true
        frameMesh.receiveShadow = true
        return frameMesh
      }

      staticGroup.add(createCFrameMesh(-frameSpanZ / 2))
      staticGroup.add(createCFrameMesh(frameSpanZ / 2))

      // Top Crossbeam connecting side columns
      const topBeamGeo = new THREE.BoxGeometry(640, 90, frameSpanZ + 65)
      const topBeamMesh = new THREE.Mesh(topBeamGeo, darkMachineMat)
      topBeamMesh.position.set(230, 515, 0)
      topBeamMesh.castShadow = true
      staticGroup.add(topBeamMesh)

      // Hydraulic Cylinders Y1 & Y2 (Mounted atop columns)
      const createCylinderMesh = (zPos: number) => {
        const cylGroup = new THREE.Group()
        const barrelGeo = new THREE.CylinderGeometry(42, 42, 200, 24)
        const barrelMesh = new THREE.Mesh(barrelGeo, machineBlueMat)
        barrelMesh.position.set(0, 0, 0)
        barrelMesh.castShadow = true
        cylGroup.add(barrelMesh)

        // Top cylinder cap & pressure manifold
        const capGeo = new THREE.CylinderGeometry(48, 48, 25, 24)
        const capMesh = new THREE.Mesh(capGeo, darkMachineMat)
        capMesh.position.set(0, 110, 0)
        cylGroup.add(capMesh)

        cylGroup.position.set(0, 460, zPos)
        return cylGroup
      }

      staticGroup.add(createCylinderMesh(-frameSpanZ / 2))
      staticGroup.add(createCylinderMesh(frameSpanZ / 2))

      // Rear Backgauge Transverse Guide Rail (R-Axis support)
      const rBeamGeo = new THREE.BoxGeometry(70, 35, frameSpanZ)
      const rBeamMesh = new THREE.Mesh(rBeamGeo, clampBarMat)
      rBeamMesh.position.set(260, 20, 0)
      rBeamMesh.castShadow = true
      staticGroup.add(rBeamMesh)
    }

    // 2. Moving Upper Ram Assembly (Ram Apron Beam, Quick-Clamp Intermediates, Piston Rods, Punch)
    const effectivePunchY =
      punchYOverride !== undefined ? punchYOverride : -penetrationDepth * progress

    const ramGroup = ramMovingGroupRef.current
    if (ramGroup) {
      while (ramGroup.children.length > 0) ramGroup.remove(ramGroup.children[0])

      ramGroup.position.set(0, effectivePunchY, 0)

      const clampH = envelope.clampHolderHeight || 120
      const clampW = envelope.clampHolderWidth || 100

      // Main Upper Ram Apron Beam (heavy moving steel plate)
      const ramBeamGeo = new THREE.BoxGeometry(envelope.ramWidth || 160, 280, toolWidth + 50)
      const ramBeamMesh = new THREE.Mesh(ramBeamGeo, ramMat)
      ramBeamMesh.position.set(0, punch.height + clampH + 120, 0)
      ramBeamMesh.castShadow = true
      ramGroup.add(ramBeamMesh)

      // Promecam European Intermediate Quick-Clamp Holders
      // Height 120mm, Width 100mm, gripping the 20mm punch tang
      const clampHolderGeo = new THREE.BoxGeometry(clampW, clampH, toolWidth + 10)
      const clampHolderMesh = new THREE.Mesh(clampHolderGeo, clampBarMat)
      clampHolderMesh.position.set(0, punch.height + clampH / 2 - 20, 0)
      clampHolderMesh.castShadow = true
      ramGroup.add(clampHolderMesh)

      // Fast-clamping levers and crowning wedge adjustment indicators spaced along the ram
      const leverGeo = new THREE.BoxGeometry(12, 45, 16)
      const leverMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Distinctive blue quick-clamp lever
        roughness: 0.3,
        metalness: 0.7,
      })
      const clampSpacing = 150
      const numClamps = Math.floor(toolWidth / clampSpacing)
      for (let i = -numClamps / 2; i <= numClamps / 2; i++) {
        const leverMesh = new THREE.Mesh(leverGeo, leverMat)
        leverMesh.position.set(-clampW / 2 - 4, punch.height + 25, i * clampSpacing)
        leverMesh.rotation.z = 0.2
        ramGroup.add(leverMesh)

        // Wedge adjustment access socket
        const socketGeo = new THREE.CylinderGeometry(6, 6, 8, 16)
        socketGeo.rotateZ(Math.PI / 2)
        const socketMesh = new THREE.Mesh(socketGeo, chromePistonMat)
        socketMesh.position.set(-clampW / 2 - 2, punch.height + 65, i * clampSpacing)
        ramGroup.add(socketMesh)
      }

      // Chrome Hydraulic Piston Rods (Extend down from cylinders into moving ram)
      const createPistonRod = (zPos: number) => {
        const rodGeo = new THREE.CylinderGeometry(22, 22, 260, 24)
        const rodMesh = new THREE.Mesh(rodGeo, chromePistonMat)
        rodMesh.position.set(0, punch.height + clampH + 250, zPos)
        rodMesh.castShadow = true
        return rodMesh
      }
      const leftRod = createPistonRod(-frameSpanZ / 2)
      const rightRod = createPistonRod(frameSpanZ / 2)
      ramGroup.add(leftRod)
      ramGroup.add(rightRod)
      pistonRodsRef.current = { left: leftRod, right: rightRod }

      // Laser Safety Light Curtain (Sensors on ram ends)
      const sensorGeo = new THREE.BoxGeometry(30, 70, 25)
      const sensorMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.7 })
      const leftSensor = new THREE.Mesh(sensorGeo, sensorMat)
      leftSensor.position.set(0, punch.height / 2, -toolWidth / 2 - 25)
      const rightSensor = new THREE.Mesh(sensorGeo, sensorMat)
      rightSensor.position.set(0, punch.height / 2, toolWidth / 2 + 25)
      ramGroup.add(leftSensor)
      ramGroup.add(rightSensor)

      // Twin optical laser beams running across bed between safety sensors under punch tip
      const laserMat = new THREE.LineBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.85,
      })
      const laserGeo1 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-2, -1, -toolWidth / 2 - 20),
        new THREE.Vector3(-2, -1, toolWidth / 2 + 20),
      ])
      const laserGeo2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(2, -1, -toolWidth / 2 - 20),
        new THREE.Vector3(2, -1, toolWidth / 2 + 20),
      ])
      ramGroup.add(new THREE.Line(laserGeo1, laserMat))
      ramGroup.add(new THREE.Line(laserGeo2, laserMat))

      // Upper Punch Tooling Mesh (Tip EXACTLY at (0,0,0) in ram coordinates)
      const rawPunchPoly = punch.polygon2D ?? generatePunchPolygon(punch)
      const punchGeo = createExtrusion(rawPunchPoly, toolWidth)
      punchGeo.translate(0, 0, -toolWidth / 2) // Center ONLY along Z-axis
      const punchMesh = new THREE.Mesh(punchGeo, punchSteelMat)
      punchMesh.position.set(0, 0, 0) // Exact alignment: tip at (0, 0, 0)
      punchMesh.castShadow = true
      ramGroup.add(punchMesh)
      punchMeshRef.current = punchMesh
    }

    // 3. Lower Die Tooling Mesh (Stationary: top shoulders at y = -part.thickness, V-center at x = 0)
    if (dieMeshRef.current) scene.remove(dieMeshRef.current)
    const rawDiePoly = die.polygon2D ?? generateDiePolygon(die, part.thickness)
    const dieGeo = createExtrusion(rawDiePoly, toolWidth)
    dieGeo.translate(0, 0, -toolWidth / 2) // Center ONLY along Z-axis
    const dieMesh = new THREE.Mesh(dieGeo, dieSteelMat)
    dieMesh.position.set(0, 0, 0) // Exact alignment: top shoulders at -T, V-opening at x = 0
    dieMesh.receiveShadow = true
    dieMesh.castShadow = true
    scene.add(dieMesh)
    dieMeshRef.current = dieMesh

    // 4. Backgauge Finger Mechanism (Dynamic positioning along X and R axes with 3-tier stop fingers)
    const gaugeGroup = gaugeGroupRef.current
    if (gaugeGroup) {
      while (gaugeGroup.children.length > 0) gaugeGroup.remove(gaugeGroup.children[0])

      const effectiveGaugeX = gaugeOverride?.x ?? gaugeX
      const effectiveGaugeR = gaugeOverride?.r ?? gaugeR

      // Dual Backgauge Stops (Left & Right finger carriers)
      const fingerSpacingZ = Math.min(toolWidth * 0.45, 180)
      const fingerMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b, // Hardened tool-steel stop face
        roughness: 0.32,
        metalness: 0.78,
      })
      const carriageMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.5,
        metalness: 0.6,
      })

      const createFinger = (zOffset: number) => {
        const fg = new THREE.Group()

        // 3-Tier Stepped Stop Finger Profile:
        // Tier 0: Front face at x = 0 (15mm high)
        const tier0Geo = new THREE.BoxGeometry(15, 18, 28)
        const tier0Mesh = new THREE.Mesh(tier0Geo, fingerMat)
        tier0Mesh.position.set(effectiveGaugeX + 7.5, effectiveGaugeR + 9, zOffset)
        tier0Mesh.castShadow = true
        fg.add(tier0Mesh)

        // Tier 1: Step 1 drop at x = 15mm (15mm high drop)
        const tier1Geo = new THREE.BoxGeometry(25, 32, 28)
        const tier1Mesh = new THREE.Mesh(tier1Geo, fingerMat)
        tier1Mesh.position.set(effectiveGaugeX + 27.5, effectiveGaugeR + 16, zOffset)
        tier1Mesh.castShadow = true
        fg.add(tier1Mesh)

        // Tier 2: Step 2 drop at x = 40mm (full body block)
        const tier2Geo = new THREE.BoxGeometry(35, 45, 28)
        const tier2Mesh = new THREE.Mesh(tier2Geo, fingerMat)
        tier2Mesh.position.set(effectiveGaugeX + 57.5, effectiveGaugeR + 22.5, zOffset)
        tier2Mesh.castShadow = true
        fg.add(tier2Mesh)

        // Carriage slide arm extending to rear ballscrew rail
        const armGeo = new THREE.BoxGeometry(140, 25, 22)
        const armMesh = new THREE.Mesh(armGeo, carriageMat)
        armMesh.position.set(effectiveGaugeX + 130, effectiveGaugeR + 15, zOffset)
        armMesh.castShadow = true
        fg.add(armMesh)

        // Micro-adjustment knurled brass knob
        const knobGeo = new THREE.CylinderGeometry(8, 8, 16, 16)
        const knobMesh = new THREE.Mesh(knobGeo, fingerMat)
        knobMesh.rotation.z = Math.PI / 2
        knobMesh.position.set(effectiveGaugeX + 205, effectiveGaugeR + 15, zOffset)
        fg.add(knobMesh)

        return fg
      }

      gaugeGroup.add(createFinger(-fingerSpacingZ))
      gaugeGroup.add(createFinger(fingerSpacingZ))
    }

    // 5. Workpiece Sheet Metal Segments with Authentic Rigid Transformations
    const sheetGroup = sheetGroupRef.current
    if (sheetGroup) {
      while (sheetGroup.children.length > 0) sheetGroup.remove(sheetGroup.children[0])

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

      // Live dynamic collision check at the current animation progress
      const liveCheck = checkInstantCollision(
        part,
        activeBendIndex,
        completedBends,
        progress,
        orientation,
        punch,
        die,
        envelope,
        penetrationDepth,
        gaugeOverride?.x ?? gaugeX ?? 50,
        gaugeOverride?.r ?? gaugeR ?? 0
      )

      const liveCollidingFlanges = liveCheck.hasCollision
        ? Array.from(new Set(liveCheck.collisionPoints.map((c) => c.flangeIndex)))
        : []

      const staticCollidingFlanges = collisionResult?.collidingFlanges ?? []
      const collidingFlangeSet = new Set([...liveCollidingFlanges, ...staticCollidingFlanges])

      kinState.segments.forEach((seg) => {
        const isColliding = collidingFlangeSet.has(seg.flangeIndex)
        const segGeo = createExtrusion(seg.polygon, partWidth)
        segGeo.translate(0, 0, -partWidth / 2) // Center along Z-axis

        // High-end PBR cold-rolled sheet steel material with crisp anisotropic highlights
        const segMat = new THREE.MeshStandardMaterial({
          color: isColliding ? 0xef4444 : 0x38bdf8,
          emissive: isColliding ? 0x7f1d1d : 0x0284c7,
          emissiveIntensity: isColliding ? 0.9 : 0.16,
          roughness: 0.18,
          metalness: 0.88,
        })

        const mesh = new THREE.Mesh(segGeo, segMat)
        mesh.castShadow = true
        mesh.receiveShadow = true
        sheetGroup.add(mesh)
      })
    }
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

  // Real-Time Dynamic CNC Telemetry Calculations
  const activeBend = part.bends[activeBendIndex]
  const targetAngle = activeBend?.angle ?? 90
  const currentAngle = 180 - progress * (180 - targetAngle)
  const effectivePunchY =
    punchYOverride !== undefined
      ? punchYOverride
      : progress > 0
        ? (1 - progress) * 25 - penetrationDepth
        : 25
  const effectiveGaugeX = gaugeOverride?.x ?? gaugeX
  const effectiveGaugeR = gaugeOverride?.r ?? gaugeR

  const totalTonnageCalc = calculateBendingTonnage(
    part.thickness,
    part.width,
    die.vOpening,
    material?.tensileStrength ?? 420
  )
  const currentTonnageLoad =
    progress > 0.05
      ? Math.round(totalTonnageCalc.totalTonnes * Math.min(1.0, progress * 1.05) * 10) / 10
      : 0.0

  const defaultMat: Material = material ?? {
    id: 'mild_steel_s235',
    name: 'Mild Steel (S235)',
    tensileStrength: 420,
    yieldStrength: 235,
    defaultKFactor: 0.38,
    description: '',
  }
  const springback = calculateSpringback(
    targetAngle,
    activeBend?.radius ?? 1.5,
    part.thickness,
    defaultMat
  )

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
      {/* Top Bar: View Badge & Camera Angle Quick-Switchers */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10 gap-2">
        {/* Left Badges: View & Real Tooling Dimensions Inspector */}
        <div className="flex flex-col space-y-1.5 pointer-events-auto">
          <div className="bg-slate-900/90 backdrop-blur border border-slate-800 text-[11px] text-slate-300 px-3 py-1.5 rounded-xl shadow-lg flex items-center space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-400 font-bold">Industrial 3D Workcell View</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">Drag to Orbit • Scroll to Zoom</span>
          </div>

          <div className="bg-slate-950/85 backdrop-blur border border-slate-800/80 px-3 py-1 rounded-lg text-[10px] font-mono text-slate-400 flex items-center space-x-2 shadow">
            <span>Punch: <strong className="text-slate-200">{punch.name.split(' ')[0]}</strong> (H={punch.height}mm, {punch.angle}°, R{punch.tipRadius})</span>
            <span className="text-slate-700">|</span>
            <span>Die: <strong className="text-slate-200">{die.name.split(' ')[0]}</strong> (H={die.height}mm, V={die.vOpening}mm)</span>
            <span className="text-slate-700">|</span>
            <span>Throat: <strong className="text-cyan-300">380mm</strong></span>
          </div>
        </div>

        {/* Right Camera Quick-Angle Toolbar (Tactile, Glowing Buttons) */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-800 p-1 rounded-xl shadow-2xl flex items-center space-x-1">
          <button
            onClick={() => applyCameraPreset('ISOMETRIC')}
            title="Isometric 3D View"
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
              activeCameraPreset === 'ISOMETRIC'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Isometric</span>
          </button>

          <button
            onClick={() => applyCameraPreset('OPERATOR')}
            title="Operator Eye-Level View"
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
              activeCameraPreset === 'OPERATOR'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Operator</span>
          </button>

          <button
            onClick={() => applyCameraPreset('SIDE_PROFILE')}
            title="Side Clearance Profile View (90° Cross-Section)"
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
              activeCameraPreset === 'SIDE_PROFILE'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Side Profile</span>
          </button>

          <button
            onClick={() => applyCameraPreset('TOOLING')}
            title="Tooling Tip & V-Die Macro Close-Up"
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
              activeCameraPreset === 'TOOLING'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tooling Close-Up</span>
          </button>

          <button
            onClick={() => applyCameraPreset('BACKGAUGE')}
            title="Rear Backgauge Stop View"
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 ${
              activeCameraPreset === 'BACKGAUGE'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Backgauge</span>
          </button>

          <button
            onClick={() => applyCameraPreset('ISOMETRIC')}
            title="Reset Camera View"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Operator Status Pill Overlay */}
      {statusMessage && (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur border border-cyan-500/40 text-xs text-white px-3.5 py-1.5 rounded-xl shadow-2xl pointer-events-none flex items-center space-x-2 z-10">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-mono text-cyan-200">{statusMessage}</span>
        </div>
      )}

      {/* Real-Time CNC Digital Telemetry HUD (DELEM DA-53T Style) */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-750 p-3 rounded-2xl shadow-2xl w-72 text-xs select-none">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono font-bold text-white text-[11px] uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>CNC Live Telemetry</span>
            </span>
          </div>
          <button
            onClick={() => setIsHudMinimized(!isHudMinimized)}
            className="text-slate-400 hover:text-white p-0.5 rounded transition cursor-pointer"
            title={isHudMinimized ? 'Expand Telemetry' : 'Minimize Telemetry'}
          >
            {isHudMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {!isHudMinimized && (
          <div className="space-y-2.5">
            {/* Axis Position Readout Grid */}
            <div className="grid grid-cols-3 gap-1.5 font-mono text-center">
              <div className="bg-slate-950/80 border border-slate-800 p-1.5 rounded-lg">
                <span className="text-[9px] text-slate-400 block font-bold">Y-AXIS (RAM)</span>
                <span className={`text-xs font-bold ${effectivePunchY <= 0 ? 'text-red-400' : 'text-cyan-400'}`}>
                  {effectivePunchY > 0 ? `+${effectivePunchY.toFixed(1)}` : effectivePunchY.toFixed(2)}
                  <span className="text-[9px] font-normal text-slate-500 ml-0.5">mm</span>
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-1.5 rounded-lg">
                <span className="text-[9px] text-slate-400 block font-bold">X-GAUGE</span>
                <span className="text-xs font-bold text-amber-300">
                  {effectiveGaugeX.toFixed(1)}
                  <span className="text-[9px] font-normal text-slate-500 ml-0.5">mm</span>
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-1.5 rounded-lg">
                <span className="text-[9px] text-slate-400 block font-bold">R-AXIS</span>
                <span className="text-xs font-bold text-slate-300">
                  {effectiveGaugeR.toFixed(1)}
                  <span className="text-[9px] font-normal text-slate-500 ml-0.5">mm</span>
                </span>
              </div>
            </div>

            {/* Forming Angle & Overbend Display */}
            <div className="bg-slate-950/80 border border-slate-800 p-2 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Current Bend Angle:</span>
                <span className="font-bold text-cyan-300 text-sm">{currentAngle.toFixed(1)}°</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Target: <strong className="text-white">{targetAngle.toFixed(1)}°</strong></span>
                <span>Δθ: <strong className="text-cyan-400">+{springback.springbackDeg.toFixed(1)}°</strong></span>
                <span>Overbend: <strong className="text-emerald-400">{springback.overbendAngleDeg.toFixed(1)}°</strong></span>
              </div>
            </div>

            {/* Bending Load / Tonnage Gauge */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Forming Load:</span>
                </span>
                <span className="font-bold text-slate-200">
                  {currentTonnageLoad} / {totalTonnageCalc.totalTonnes} Tonnes
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-amber-500 to-red-500 transition-all duration-75"
                  style={{
                    width: `${totalTonnageCalc.totalTonnes > 0 ? Math.min(100, (currentTonnageLoad / totalTonnageCalc.totalTonnes) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
