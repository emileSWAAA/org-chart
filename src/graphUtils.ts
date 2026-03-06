import type { Node, Edge } from '@xyflow/react';
import type { Manifest, Entity, ComputedRelationship, RelationshipType } from './types';

// Type-based colors (hex for React Flow and export compatibility)
const ENTITY_COLORS: Record<Entity['type'], string> = {
  person: '#c05621',      // Warm amber for people
  department: '#2f855a',  // Deep teal for departments
  vendor: '#7c3aed',      // Purple for vendors
};

// Layout constants - compact org chart style
const DEPT_WIDTH = 200;
const DEPT_HEIGHT = 90;
const PERSON_WIDTH = 140;
const PERSON_HEIGHT = 60;
const DEPT_H_GAP = 40;      // Horizontal gap between sibling departments
const DEPT_V_GAP = 30;      // Vertical gap between department and child departments (when no persons)
const PERSON_H_GAP = 15;    // Horizontal gap between persons
const PERSON_V_GAP = 20;    // Vertical gap between person levels
const PERSON_DEPT_GAP = 25; // Gap between department and its persons

export interface EntityNodeData extends Record<string, unknown> {
  entity: Entity;
  label: string;
  entityColor: string;
  isPersonNode: boolean;
  departmentId?: string;
  childPersons?: Entity[];  // For departments: list of persons in this dept
  // Collapse/expand state
  isCollapsed?: boolean;
  hasCollapsedChildren?: boolean;
  collapsedChildCount?: number;
  onToggleCollapse?: (nodeId: string) => void;
  // Search state
  isSearchMatch?: boolean;
  isSearchActive?: boolean;
}

export interface RelationshipEdgeData extends Record<string, unknown> {
  type: RelationshipType;
  note?: string;
  strength?: 'low' | 'medium' | 'high';
  isImplicit?: boolean;
}

interface TreeNode {
  entity: Entity;
  children: TreeNode[];
  width: number;  // Computed width of this subtree
  x: number;      // Computed x position
  y: number;      // Computed y position
}

interface PersonTree {
  entity: Entity;
  children: PersonTree[];
  width: number;
  x: number;
  y: number;
}

export function manifestToFlow(manifest: Manifest): { 
  nodes: Node<EntityNodeData>[]; 
  edges: Edge<RelationshipEdgeData>[];
  relationships: ComputedRelationship[];
} {
  const entities = manifest.entities;
  const explicitRelationships = manifest.relationships || [];
  
  // Separate entities by type
  const departments = entities.filter(e => e.type === 'department');
  const persons = entities.filter(e => e.type === 'person');
  const vendors = entities.filter(e => e.type === 'vendor');
  
  // Group persons by department
  const personsByDept = new Map<string, Entity[]>();
  for (const person of persons) {
    if (person.parentId) {
      const list = personsByDept.get(person.parentId) || [];
      list.push(person);
      personsByDept.set(person.parentId, list);
    }
  }
  
  // Build department tree
  const deptTree = buildDepartmentTree(departments);
  
  // Calculate positions - need to pass personsByDept to account for person tree heights
  calculateDeptTreeWidths(deptTree, personsByDept);
  positionDeptTree(deptTree, 0, 0, personsByDept);
  
  // Generate nodes and edges
  const nodes: Node<EntityNodeData>[] = [];
  const edges: Edge<RelationshipEdgeData>[] = [];
  const relationships: ComputedRelationship[] = [];
  
  // Process department tree
  function processDeptNode(node: TreeNode) {
    const deptPersons = personsByDept.get(node.entity.id) || [];
    const hasPersons = deptPersons.length > 0;
    
    // Add department node
    nodes.push({
      id: node.entity.id,
      type: 'entityNode',
      position: { x: node.x, y: node.y },
        data: {
          entity: node.entity,
          label: node.entity.name,
          entityColor: node.entity.color || ENTITY_COLORS[node.entity.type],
          isPersonNode: false,
          childPersons: deptPersons,
        },
    });
    
    // Add edges to child departments
    // When a department has people, route hierarchy edges from side handles to avoid overlapping the person stack
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const parentCenterX = node.x + DEPT_WIDTH / 2;
      const childCenterX = child.x + DEPT_WIDTH / 2;
      const sourceHandle = hasPersons
        ? childCenterX >= parentCenterX
          ? 'right'
          : 'left'
        : 'bottom';
      edges.push({
        id: `dept-${node.entity.id}-${child.entity.id}`,
        source: node.entity.id,
        target: child.entity.id,
        sourceHandle,
        type: 'relationshipEdge',
        data: { type: 'department_hierarchy', isImplicit: true },
      });
      relationships.push({
        from: node.entity.id,
        to: child.entity.id,
        type: 'department_hierarchy',
        isImplicit: true,
      });
      processDeptNode(child);
    }
    
    // Build and position person tree for this department
    if (deptPersons.length > 0) {
      const personTree = buildPersonTree(deptPersons);
      calculatePersonTreeWidths(personTree);
      
      // Position person tree below the department with adequate spacing
      const personStartY = node.y + DEPT_HEIGHT + PERSON_DEPT_GAP;
      const personTreeWidth = personTree.reduce((sum, root) => sum + root.width, 0) + 
                              (personTree.length - 1) * PERSON_H_GAP;
      let personStartX = node.x + (DEPT_WIDTH - personTreeWidth) / 2;
      
      for (const personRoot of personTree) {
        positionPersonTree(personRoot, personStartX + personRoot.width / 2 - PERSON_WIDTH / 2, personStartY);
        personStartX += personRoot.width + PERSON_H_GAP;
      }
      
      // Add person nodes and edges
      function processPersonNode(pNode: PersonTree, deptId: string) {
        nodes.push({
          id: pNode.entity.id,
          type: 'entityNode',
          position: { x: pNode.x, y: pNode.y },
          data: {
            entity: pNode.entity,
            label: pNode.entity.name,
            entityColor: pNode.entity.color || ENTITY_COLORS[pNode.entity.type],
            isPersonNode: true,
            departmentId: deptId,
          },
        });
        
        for (const child of pNode.children) {
          edges.push({
            id: `person-${pNode.entity.id}-${child.entity.id}`,
            source: pNode.entity.id,
            target: child.entity.id,
            type: 'relationshipEdge',
            data: { type: 'person_management', isImplicit: true },
          });
          relationships.push({
            from: pNode.entity.id,
            to: child.entity.id,
            type: 'person_management',
            isImplicit: true,
          });
          processPersonNode(child, deptId);
        }
      }
      
      for (const personRoot of personTree) {
        // Connect department to top-level persons (those without managers or whose manager is not in this dept)
        if (!personRoot.entity.managerId || !deptPersons.find(p => p.id === personRoot.entity.managerId)) {
          edges.push({
            id: `dept-person-${node.entity.id}-${personRoot.entity.id}`,
            source: node.entity.id,
            target: personRoot.entity.id,
            sourceHandle: 'bottom',
            type: 'relationshipEdge',
            data: { type: 'person_management', isImplicit: true },
          });
        }
        processPersonNode(personRoot, node.entity.id);
      }
    }
  }
  
  for (const root of deptTree) {
    processDeptNode(root);
  }
  
  // Add vendor nodes (positioned to the right of the org chart)
  const maxX = nodes.reduce((max, n) => Math.max(max, n.position.x), 0);
  vendors.forEach((vendor, index) => {
    nodes.push({
      id: vendor.id,
      type: 'entityNode',
      position: { x: maxX + 400, y: 100 + index * 150 },
      data: {
        entity: vendor,
        label: vendor.name,
        entityColor: vendor.color || ENTITY_COLORS[vendor.type],
        isPersonNode: false,
      },
    });
  });
  
  // Add explicit relationships from manifest
  for (const rel of explicitRelationships) {
    const edgeId = `explicit-${rel.type}-${rel.from}-${rel.to}`;
    // Skip if this would duplicate an implicit edge
    const isDuplicate = edges.some(e => 
      e.source === rel.from && 
      e.target === rel.to
    );
    
    if (!isDuplicate) {
      edges.push({
        id: edgeId,
        source: rel.from,
        target: rel.to,
        type: 'relationshipEdge',
        data: { 
          type: rel.type,
          note: rel.note,
          strength: rel.strength,
          isImplicit: false,
        },
      });
    }
    
    relationships.push({
      from: rel.from,
      to: rel.to,
      type: rel.type,
      note: rel.note,
      strength: rel.strength,
      isImplicit: false,
    });
  }
  
  return { nodes, edges, relationships };
}

function buildDepartmentTree(departments: Entity[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  
  // Create nodes for all departments
  for (const dept of departments) {
    nodeMap.set(dept.id, {
      entity: dept,
      children: [],
      width: 0,
      x: 0,
      y: 0,
    });
  }
  
  // Build parent-child relationships
  const roots: TreeNode[] = [];
  for (const dept of departments) {
    const node = nodeMap.get(dept.id)!;
    if (dept.parentId && nodeMap.has(dept.parentId)) {
      nodeMap.get(dept.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  
  return roots;
}

function calculateDeptTreeWidths(nodes: TreeNode[], personsByDept: Map<string, Entity[]>): void {
  function calculate(node: TreeNode): number {
    // Get persons for this department to calculate min width
    const deptPersons = personsByDept.get(node.entity.id) || [];
    const personsWidth = deptPersons.length > 0 
      ? Math.max(DEPT_WIDTH, deptPersons.length * (PERSON_WIDTH + PERSON_H_GAP) - PERSON_H_GAP + 40)
      : DEPT_WIDTH;
    
    if (node.children.length === 0) {
      node.width = Math.max(DEPT_WIDTH, personsWidth);
      return node.width;
    }
    
    let childrenWidth = 0;
    for (const child of node.children) {
      childrenWidth += calculate(child);
    }
    childrenWidth += (node.children.length - 1) * DEPT_H_GAP;
    
    node.width = Math.max(DEPT_WIDTH, personsWidth, childrenWidth);
    return node.width;
  }
  
  for (const root of nodes) {
    calculate(root);
  }
}

// Calculate the height of a person tree (depth * spacing) - compact calculation
function calculatePersonTreeHeight(persons: Entity[]): number {
  if (persons.length === 0) return 0;
  
  const personTree = buildPersonTree(persons);
  
  function getMaxDepth(nodes: PersonTree[], depth: number): number {
    if (nodes.length === 0) return depth;
    let maxDepth = depth;
    for (const node of nodes) {
      const childDepth = getMaxDepth(node.children, depth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
    return maxDepth;
  }
  
  const depth = getMaxDepth(personTree, 1);
  // Just the person nodes height + small gaps between them
  return (depth * PERSON_HEIGHT) + ((depth - 1) * PERSON_V_GAP) + PERSON_DEPT_GAP;
}

function positionDeptTree(nodes: TreeNode[], startX: number, startY: number, personsByDept: Map<string, Entity[]>): void {
  // Position root nodes side by side
  const totalWidth = nodes.reduce((sum, n) => sum + n.width, 0) + (nodes.length - 1) * DEPT_H_GAP;
  let currentX = startX - totalWidth / 2;
  
  for (const root of nodes) {
    positionDeptNode(root, currentX + root.width / 2 - DEPT_WIDTH / 2, startY, personsByDept);
    currentX += root.width + DEPT_H_GAP;
  }
}

function positionDeptNode(node: TreeNode, x: number, y: number, personsByDept: Map<string, Entity[]>): void {
  node.x = x;
  node.y = y;
  
  if (node.children.length === 0) return;
  
  // Calculate the height needed for persons in THIS department
  const deptPersons = personsByDept.get(node.entity.id) || [];
  const personTreeHeight = calculatePersonTreeHeight(deptPersons);
  
  // Calculate children's total width
  let childrenWidth = 0;
  for (const child of node.children) {
    childrenWidth += child.width;
  }
  childrenWidth += (node.children.length - 1) * DEPT_H_GAP;
  
  // Position children below parent, accounting for person tree height
  let childX = x + DEPT_WIDTH / 2 - childrenWidth / 2;
  const childY = y + DEPT_HEIGHT + personTreeHeight + DEPT_V_GAP;
  
  for (const child of node.children) {
    positionDeptNode(child, childX + child.width / 2 - DEPT_WIDTH / 2, childY, personsByDept);
    childX += child.width + DEPT_H_GAP;
  }
}

function buildPersonTree(persons: Entity[]): PersonTree[] {
  const nodeMap = new Map<string, PersonTree>();
  
  // Create nodes for all persons
  for (const person of persons) {
    nodeMap.set(person.id, {
      entity: person,
      children: [],
      width: 0,
      x: 0,
      y: 0,
    });
  }
  
  // Build manager relationships
  const roots: PersonTree[] = [];
  for (const person of persons) {
    const node = nodeMap.get(person.id)!;
    if (person.managerId && nodeMap.has(person.managerId)) {
      nodeMap.get(person.managerId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  
  return roots;
}

function calculatePersonTreeWidths(nodes: PersonTree[]): void {
  function calculate(node: PersonTree): number {
    if (node.children.length === 0) {
      node.width = PERSON_WIDTH;
      return node.width;
    }
    
    let childrenWidth = 0;
    for (const child of node.children) {
      childrenWidth += calculate(child);
    }
    childrenWidth += (node.children.length - 1) * PERSON_H_GAP;
    
    node.width = Math.max(PERSON_WIDTH, childrenWidth);
    return node.width;
  }
  
  for (const root of nodes) {
    calculate(root);
  }
}

function positionPersonTree(node: PersonTree, x: number, y: number): void {
  node.x = x;
  node.y = y;
  
  if (node.children.length === 0) return;
  
  // Calculate children's total width
  let childrenWidth = 0;
  for (const child of node.children) {
    childrenWidth += child.width;
  }
  childrenWidth += (node.children.length - 1) * PERSON_H_GAP;
  
  // Position children centered below parent - height of person card + gap
  let childX = x + PERSON_WIDTH / 2 - childrenWidth / 2;
  const childY = y + PERSON_HEIGHT + PERSON_V_GAP;
  
  for (const child of node.children) {
    positionPersonTree(child, childX + child.width / 2 - PERSON_WIDTH / 2, childY);
    childX += child.width + PERSON_H_GAP;
  }
}
