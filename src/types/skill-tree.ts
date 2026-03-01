export interface SkillTreeData {
  tree: string
  classes: CharacterClass[]
  alternate_ascendancies: AlternateAscendancy[]
  groups: Record<string, Group>
  nodes: Record<string, SkillNode>
  extraImages: Record<string, ExtraImage>
  jewelSlots: number[]
  min_x: number
  min_y: number
  max_x: number
  max_y: number
  constants: Constants
  sprites: Record<string, SpriteSheet>
  imageZoomLevels: number[]
  points: Points
}

export interface CharacterClass {
  name: string
  base_str: number
  base_dex: number
  base_int: number
  ascendancies: Ascendancy[]
}

export interface Ascendancy {
  id: string
  name: string
  flavourText?: string
  flavourTextColour?: string
  flavourTextRect?: { x: number; y: number; width: number; height: number }
}

export interface AlternateAscendancy {
  id: string
  name: string
  flavourText?: string
  flavourTextColour?: string
  flavourTextRect?: { x: number; y: number; width: number; height: number }
}

export interface Group {
  x: number
  y: number
  orbits: number[]
  nodes: string[]
  background?: GroupBackground
}

export interface GroupBackground {
  image: string
  isHalfImage?: boolean
}

export interface SkillNode {
  skill?: number
  name?: string
  icon?: string
  inactiveIcon?: string
  activeIcon?: string
  activeEffectImage?: string
  ascendancyName?: string
  isBloodline?: boolean
  isKeystone?: boolean
  isNotable?: boolean
  isMastery?: boolean
  isJewelSocket?: boolean
  isProxy?: boolean
  isMultipleChoice?: boolean
  isMultipleChoiceOption?: boolean
  classStartIndex?: number
  stats?: string[]
  reminderText?: string[]
  flavourText?: string[]
  grantedStrength?: number
  grantedDexterity?: number
  grantedIntelligence?: number
  grantedPassivePoints?: number
  group: number
  orbit: number
  orbitIndex: number
  out: string[]
  in: string[]
  masteryEffects?: MasteryEffect[]
}

export interface MasteryEffect {
  effect: number
  stats: string[]
  reminderText?: string[]
}

export interface ExtraImage {
  x: number
  y: number
  image: string
}

export interface Constants {
  classes: Record<string, number>
  characterAttributes: Record<string, number>
  PSSCentreInnerRadius: number
  skillsPerOrbit: number[]
  orbitRadii: number[]
}

export interface Points {
  totalPoints: number
  ascendancyPoints: number
}

export interface SpriteSheet {
  [zoomLevel: string]: SpriteSheetVariant
}

export interface SpriteSheetVariant {
  filename: string
  w: number
  h: number
  coords: Record<string, SpriteCoord>
}

export interface SpriteCoord {
  x: number
  y: number
  w: number
  h: number
}

// Processed types used at runtime
export interface ProcessedNode {
  id: string
  node: SkillNode
  worldX: number
  worldY: number
  type: NodeType
}

export type NodeType = 'normal' | 'notable' | 'keystone' | 'mastery' | 'jewelSocket' | 'classStart'

export interface ViewportState {
  offsetX: number
  offsetY: number
  zoom: number
  width: number
  height: number
}
