import yaml from 'js-yaml';
import type { Manifest, Entity, Relationship, RelationshipType } from './types';

export function parseManifest(content: string, filename: string): Manifest {
  let data: unknown;
  
  const extension = filename.toLowerCase().split('.').pop();
  
  if (extension === 'yaml' || extension === 'yml') {
    data = yaml.load(content);
  } else if (extension === 'json') {
    data = JSON.parse(content);
  } else {
    // Try to parse as YAML first (which also handles JSON)
    try {
      data = yaml.load(content);
    } catch {
      data = JSON.parse(content);
    }
  }
  
  return validateManifest(data);
}

function validateManifest(data: unknown): Manifest {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid manifest: expected an object');
  }
  
  const manifest = data as Record<string, unknown>;

  let name: string | undefined;
  if (manifest.name !== undefined) {
    if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
      throw new Error('Invalid manifest: name must be a non-empty string if provided');
    }
    name = manifest.name.trim();
  }
  
  if (!Array.isArray(manifest.entities)) {
    throw new Error('Invalid manifest: entities must be an array');
  }
  
  const entities = manifest.entities.map(validateEntity);
  
  // Parse relationships (optional)
  let relationships: Relationship[] = [];
  if (manifest.relationships !== undefined) {
    if (!Array.isArray(manifest.relationships)) {
      throw new Error('Invalid manifest: relationships must be an array if provided');
    }
    relationships = manifest.relationships.map((rel, idx) => validateRelationship(rel, idx));
  }
  
  // Build entity lookup for validation
  const entityMap = new Map(entities.map(e => [e.id, e]));
  const departments = entities.filter(e => e.type === 'department');
  const persons = entities.filter(e => e.type === 'person');
  
  // Validate department hierarchy
  for (const dept of departments) {
    if (dept.parentId) {
      const parent = entityMap.get(dept.parentId);
      if (!parent) {
        throw new Error(`Department "${dept.name}" references non-existent parent "${dept.parentId}"`);
      }
      if (parent.type !== 'department') {
        throw new Error(`Department "${dept.name}" cannot have a non-department parent`);
      }
    }
  }
  
  // Validate person relationships
  for (const person of persons) {
    if (person.parentId) {
      const dept = entityMap.get(person.parentId);
      if (!dept) {
        throw new Error(`Person "${person.name}" references non-existent department "${person.parentId}"`);
      }
      if (dept.type !== 'department') {
        throw new Error(`Person "${person.name}" must belong to a department, not a "${dept.type}"`);
      }
    }
    
    if (person.managerId) {
      const manager = entityMap.get(person.managerId);
      if (!manager) {
        throw new Error(`Person "${person.name}" references non-existent manager "${person.managerId}"`);
      }
      if (manager.type !== 'person') {
        throw new Error(`Person "${person.name}" must have a person as manager`);
      }
    }
  }
  
  // Check for circular references in department hierarchy
  for (const dept of departments) {
    const visited = new Set<string>();
    let current: Entity | undefined = dept;
    while (current?.parentId) {
      if (visited.has(current.id)) {
        throw new Error(`Circular reference detected in department hierarchy involving "${dept.name}"`);
      }
      visited.add(current.id);
      current = entityMap.get(current.parentId);
    }
  }
  
  // Validate relationships reference valid entities
  for (const rel of relationships) {
    if (!entityMap.has(rel.from)) {
      throw new Error(`Relationship references non-existent entity "${rel.from}" in 'from' field`);
    }
    if (!entityMap.has(rel.to)) {
      throw new Error(`Relationship references non-existent entity "${rel.to}" in 'to' field`);
    }
  }
  
  return { name, entities, relationships };
}

function validateRelationship(data: unknown, index: number): Relationship {
  if (!data || typeof data !== 'object') {
    throw new Error(`Invalid relationship at index ${index}: expected an object`);
  }
  
  const rel = data as Record<string, unknown>;
  
  if (typeof rel.from !== 'string' || !rel.from) {
    throw new Error(`Invalid relationship at index ${index}: 'from' is required`);
  }
  
  if (typeof rel.to !== 'string' || !rel.to) {
    throw new Error(`Invalid relationship at index ${index}: 'to' is required`);
  }
  
  if (typeof rel.type !== 'string' || !rel.type) {
    throw new Error(`Invalid relationship at index ${index}: 'type' is required`);
  }
  
  const validTypes: RelationshipType[] = [
    'manages',
    'influences',
    'depends_on',
    'collaborates_with',
    'reports_to',
    'department_hierarchy',
    'person_management',
  ];
  
  if (!validTypes.includes(rel.type as RelationshipType)) {
    throw new Error(`Invalid relationship at index ${index}: type must be one of ${validTypes.join(', ')}`);
  }
  
  if (rel.note !== undefined && typeof rel.note !== 'string') {
    throw new Error(`Invalid relationship at index ${index}: 'note' must be a string`);
  }
  
  if (rel.strength !== undefined) {
    const validStrengths = ['low', 'medium', 'high'];
    if (!validStrengths.includes(rel.strength as string)) {
      throw new Error(`Invalid relationship at index ${index}: 'strength' must be one of ${validStrengths.join(', ')}`);
    }
  }
  
  return {
    from: rel.from,
    to: rel.to,
    type: rel.type as RelationshipType,
    note: rel.note as string | undefined,
    strength: rel.strength as Relationship['strength'],
    metadata: rel.metadata as Relationship['metadata'],
  };
}

function validateEntity(data: unknown, index: number): Entity {
  if (!data || typeof data !== 'object') {
    throw new Error(`Invalid entity at index ${index}: expected an object`);
  }
  
  const entity = data as Record<string, unknown>;
  
  if (typeof entity.id !== 'string' || !entity.id) {
    throw new Error(`Invalid entity at index ${index}: id is required`);
  }
  
  if (typeof entity.type !== 'string' || !entity.type) {
    throw new Error(`Invalid entity at index ${index}: type is required`);
  }
  
  if (typeof entity.name !== 'string' || !entity.name) {
    throw new Error(`Invalid entity at index ${index}: name is required`);
  }

  if (entity.color !== undefined) {
    if (typeof entity.color !== 'string') {
      throw new Error(`Invalid entity at index ${index}: color must be a string`);
    }
    const hexPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    if (!hexPattern.test(entity.color)) {
      throw new Error(`Invalid entity at index ${index}: color must be hex format like #RRGGBB`);
    }
  }
  
  const validTypes = ['person', 'department', 'vendor'];
  if (!validTypes.includes(entity.type)) {
    throw new Error(`Invalid entity at index ${index}: type must be one of ${validTypes.join(', ')}`);
  }
  
  return {
    id: entity.id,
    type: entity.type as Entity['type'],
    name: entity.name,
    color: entity.color as string | undefined,
    parentId: entity.parentId as string | undefined,
    managerId: entity.managerId as string | undefined,
    metadata: entity.metadata as Entity['metadata'],
  };
}

export async function loadManifestFromFile(file: File): Promise<Manifest> {
  const content = await file.text();
  return parseManifest(content, file.name);
}
