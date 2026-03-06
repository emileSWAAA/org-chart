// Entity Types
export type EntityType = 'person' | 'department' | 'vendor';

// Relationship Types
export type RelationshipType = 
  | 'manages'           // Direct management relationship
  | 'influences'        // Influence or advisory relationship
  | 'depends_on'        // Dependency relationship
  | 'collaborates_with' // Collaboration relationship
  | 'reports_to'        // Reporting relationship
  | 'department_hierarchy' // Implicit parent-child department relationship
  | 'person_management';   // Implicit person manager relationship

export type RelationshipStrength = 'low' | 'medium' | 'high';

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  color?: string;
  // For departments: parent department ID (null/undefined = root)
  // For persons: department they belong to
  parentId?: string;
  // For persons only: their manager (another person in same department)
  managerId?: string;
  metadata?: Record<string, unknown>;
}

// Explicit relationship definition in manifest
export interface Relationship {
  from: string;
  to: string;
  type: RelationshipType;
  note?: string;
  strength?: RelationshipStrength;
  metadata?: Record<string, unknown>;
}

// Manifest Structure with explicit relationships
export interface Manifest {
  // Optional human-friendly organization name from the manifest
  name?: string;
  entities: Entity[];
  relationships?: Relationship[];
}

// Computed relationship for display purposes (includes implicit and explicit)
export interface ComputedRelationship extends Relationship {
  from: string;
  to: string;
  type: RelationshipType;
  note?: string;
  strength?: RelationshipStrength;
  isImplicit?: boolean; // True if derived from parentId/managerId
}

// UI State Types
export interface SelectedItem {
  type: 'entity';
  data: Entity;
}
