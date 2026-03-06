import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type OnSelectionChangeParams,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng, toSvg } from 'html-to-image';
import { 
  Search, 
  X, 
  Download, 
  Image, 
  FileCode, 
  ArrowDownUp,
  ArrowLeftRight,
  Building2,
  User,
  ChevronDown,
  ChevronUp,
  MapPin,
  ArrowRight,
  Plus,
} from 'lucide-react';
import yaml from 'js-yaml';

import type { Manifest, Entity, RelationshipType, Relationship } from '../types';
import { manifestToFlow, type EntityNodeData } from '../graphUtils';
import { EntityNode } from './EntityNode';
import { RelationshipEdge } from './RelationshipEdge';
import { InspectorPanel } from './InspectorPanel';
import { EntityEditor } from './EntityEditor';

const nodeTypes = {
  entityNode: EntityNode,
};

const edgeTypes = {
  relationshipEdge: RelationshipEdge,
};

type LayoutDirection = 'vertical' | 'horizontal';

// Component to highlight search matches in text
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark 
            key={i}
            style={{ 
              backgroundColor: 'rgba(250, 204, 21, 0.4)', 
              color: 'inherit',
              padding: '0 2px',
              borderRadius: '2px',
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface OrganizationGraphProps {
  manifest: Manifest;
  manifestFilename?: string;
  onUpdateManifest: (next: Manifest) => void;
  onClearManifest: () => void;
}

function OrganizationGraphInner({ manifest, manifestFilename, onUpdateManifest, onClearManifest }: OrganizationGraphProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView, setCenter, getZoom } = useReactFlow();
  
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('vertical');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showRelationshipFilters, setShowRelationshipFilters] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  
  // Relationship type filters - default to only hierarchical
  const [visibleRelationships, setVisibleRelationships] = useState<Set<string>>(
    new Set(['department_hierarchy', 'person_management'])
  );
  
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => manifestToFlow(manifest),
    [manifest]
  );
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'add' | 'edit'>('add');
  const [editorDefaultType, setEditorDefaultType] = useState<Entity['type']>('department');
  const [editorInitialEntity, setEditorInitialEntity] = useState<Entity | null>(null);

  // Reset graph when manifest changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setCollapsedNodes(new Set());
    setEditorOpen(false);
    setEditorInitialEntity(null);
    setEditorMode('add');
  }, [initialNodes, initialEdges, setNodes, setEdges]);
  
  // Count departments and persons for display
  const departmentCount = manifest.entities.filter(e => e.type === 'department').length;
  const personCount = manifest.entities.filter(e => e.type === 'person').length;
  
  // Enhanced search matching logic with detailed results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    
    const results: Array<{
      entity: Entity;
      matchType: 'name' | 'title' | 'metadata';
      matchField: string;
      matchValue: string;
      parentName?: string;
    }> = [];
    
    manifest.entities.forEach(entity => {
      const nameMatch = entity.name.toLowerCase().includes(query);
      const titleMatch = entity.metadata?.title?.toString().toLowerCase().includes(query);
      
      // Find parent name for context
      let parentName: string | undefined;
      if (entity.parentId) {
        const parent = manifest.entities.find(e => e.id === entity.parentId);
        parentName = parent?.name;
      }
      
      if (nameMatch) {
        results.push({
          entity,
          matchType: 'name',
          matchField: 'Name',
          matchValue: entity.name,
          parentName,
        });
      } else if (titleMatch) {
        results.push({
          entity,
          matchType: 'title',
          matchField: 'Title',
          matchValue: entity.metadata?.title as string,
          parentName,
        });
      } else {
        // Search other metadata fields
        if (entity.metadata) {
          for (const [key, value] of Object.entries(entity.metadata)) {
            if (String(value).toLowerCase().includes(query)) {
              results.push({
                entity,
                matchType: 'metadata',
                matchField: key,
                matchValue: String(value),
                parentName,
              });
              break;
            }
          }
        }
      }
    });
    
    // Sort: departments first, then by name
    return results.sort((a, b) => {
      if (a.entity.type !== b.entity.type) {
        return a.entity.type === 'department' ? -1 : 1;
      }
      return a.entity.name.localeCompare(b.entity.name);
    });
  }, [searchQuery, manifest.entities]);
  
  // Simple search matches set for node highlighting
  const searchMatches = useMemo(() => {
    return new Set(searchResults.map(r => r.entity.id));
  }, [searchResults]);
  
  // Reset selected search index when query changes
  useEffect(() => {
    setSelectedSearchIndex(0);
  }, [searchQuery]);
  
  // Navigate to a search result
  const navigateToSearchResult = useCallback((entityId: string) => {
    const node = nodes.find(n => n.id === entityId);
    if (!node) return;
    
    // Expand any collapsed parents
    const entity = manifest.entities.find(e => e.id === entityId);
    if (entity) {
      // Find all parents and uncollapse them
      const parentsToExpand: string[] = [];
      let currentId = entity.parentId || entity.managerId;
      while (currentId) {
        if (collapsedNodes.has(currentId)) {
          parentsToExpand.push(currentId);
        }
        const parent = manifest.entities.find(e => e.id === currentId);
        currentId = parent?.parentId || parent?.managerId;
      }
      
      if (parentsToExpand.length > 0) {
        setCollapsedNodes(prev => {
          const next = new Set(prev);
          parentsToExpand.forEach(id => next.delete(id));
          return next;
        });
      }
    }
    
    // Center on the node
    setTimeout(() => {
      const targetNode = nodes.find(n => n.id === entityId);
      if (targetNode) {
        setCenter(
          targetNode.position.x + (entity?.type === 'department' ? 100 : 70),
          targetNode.position.y + (entity?.type === 'department' ? 45 : 30),
          { zoom: 1.2, duration: 500 }
        );
        setSelectedNodeId(entityId);
        setSelectedEntity(entity || null);
      }
    }, 50);
    
    setShowSearchResults(false);
    searchInputRef.current?.blur();
  }, [nodes, manifest.entities, collapsedNodes, setCenter]);
  
  // Calculate hidden children count for collapsed nodes (only persons)
  const getCollapsedChildCount = useCallback((nodeId: string): number => {
    let count = 0;
    const countPersons = (id: string) => {
      manifest.entities.forEach(e => {
        // Only count persons directly in this department or managed by someone in it
        if ((e.parentId === id || e.managerId === id) && e.type === 'person') {
          count++;
          // Also count persons managed by this person
          countPersons(e.id);
        }
      });
    };
    countPersons(nodeId);
    return count;
  }, [manifest.entities]);
  
  // Toggle collapse handler
  const handleToggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);
  
  // Toggle relationship type visibility
  const toggleRelationshipType = useCallback((relType: RelationshipType) => {
    setVisibleRelationships(prev => {
      const next = new Set(prev);
      if (next.has(relType)) {
        next.delete(relType);
      } else {
        next.add(relType);
      }
      return next;
    });
  }, []);
  
  // Update nodes with search and collapse state
  useEffect(() => {
    const isSearchActive = searchQuery.trim().length > 0;
    
    // Get all nodes that should be hidden due to collapsed parents (only persons)
    const hiddenNodes = new Set<string>();
    const findHiddenPersons = (parentId: string) => {
      manifest.entities.forEach(e => {
        // Only hide persons, not sub-departments
        if ((e.parentId === parentId || e.managerId === parentId) && e.type === 'person') {
          hiddenNodes.add(e.id);
          // Also hide persons managed by this person
          findHiddenPersons(e.id);
        }
      });
    };
    
    collapsedNodes.forEach(nodeId => {
      findHiddenPersons(nodeId);
    });
    
    setNodes(nds => 
      nds.map(node => ({
        ...node,
        hidden: hiddenNodes.has(node.id),
        data: {
          ...node.data,
          isSearchMatch: searchMatches.has(node.id),
          isSearchActive,
          isCollapsed: collapsedNodes.has(node.id),
          hasCollapsedChildren: collapsedNodes.has(node.id),
          collapsedChildCount: collapsedNodes.has(node.id) ? getCollapsedChildCount(node.id) : 0,
          onToggleCollapse: node.data.isPersonNode ? undefined : handleToggleCollapse,
        },
      }))
    );
    
    // Hide edges connected to hidden nodes or filtered by relationship type
    // Exception: always show edges connected to selected entity
    setEdges(eds =>
      eds.map(edge => {
        const isConnectedToSelected = selectedNodeId && 
          (edge.source === selectedNodeId || edge.target === selectedNodeId);
        
        return {
          ...edge,
          hidden: 
            hiddenNodes.has(edge.source) || 
            hiddenNodes.has(edge.target) ||
            (!isConnectedToSelected && edge.data?.type && !visibleRelationships.has(edge.data.type as string)),
        };
      })
    );
  }, [searchQuery, searchMatches, collapsedNodes, visibleRelationships, selectedNodeId, setNodes, setEdges, manifest.entities, getCollapsedChildCount, handleToggleCollapse]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" to focus search
      if (e.key === '/' && !isSearchFocused) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchResults(true);
        return;
      }
      
      // Handle search results navigation when search is focused
      if (isSearchFocused && searchResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedSearchIndex(prev => 
            prev < searchResults.length - 1 ? prev + 1 : prev
          );
          // Scroll into view
          const resultsList = searchResultsRef.current;
          if (resultsList) {
            const items = resultsList.querySelectorAll('[data-search-item]');
            items[Math.min(selectedSearchIndex + 1, searchResults.length - 1)]?.scrollIntoView({ 
              block: 'nearest',
              behavior: 'smooth'
            });
          }
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedSearchIndex(prev => prev > 0 ? prev - 1 : 0);
          // Scroll into view
          const resultsList = searchResultsRef.current;
          if (resultsList) {
            const items = resultsList.querySelectorAll('[data-search-item]');
            items[Math.max(selectedSearchIndex - 1, 0)]?.scrollIntoView({ 
              block: 'nearest',
              behavior: 'smooth'
            });
          }
          return;
        }
        if (e.key === 'Enter' && searchResults[selectedSearchIndex]) {
          e.preventDefault();
          navigateToSearchResult(searchResults[selectedSearchIndex].entity.id);
          return;
        }
      }
      
      // Escape to clear search or close panels
      if (e.key === 'Escape') {
        if (isSearchFocused) {
          if (searchQuery) {
            setSearchQuery('');
            setShowSearchResults(false);
          } else {
            searchInputRef.current?.blur();
            setShowSearchResults(false);
          }
        } else if (selectedEntity) {
          setSelectedEntity(null);
          setSelectedNodeId(null);
        }
        return;
      }
      
      // Arrow key navigation when a node is selected (not in search)
      if (selectedNodeId && !isSearchFocused) {
        const currentNode = nodes.find(n => n.id === selectedNodeId);
        if (!currentNode) return;
        
        let targetNode: Node<EntityNodeData> | undefined;
        
        if (e.key === 'ArrowUp') {
          // Find parent
          const entity = manifest.entities.find(en => en.id === selectedNodeId);
          if (entity?.parentId) {
            targetNode = nodes.find(n => n.id === entity.parentId) as Node<EntityNodeData>;
          } else if (entity?.managerId) {
            targetNode = nodes.find(n => n.id === entity.managerId) as Node<EntityNodeData>;
          }
        } else if (e.key === 'ArrowDown') {
          // Find first child
          const child = manifest.entities.find(e => 
            e.parentId === selectedNodeId || e.managerId === selectedNodeId
          );
          if (child) {
            targetNode = nodes.find(n => n.id === child.id) as Node<EntityNodeData>;
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          // Find siblings
          const entity = manifest.entities.find(en => en.id === selectedNodeId);
          if (entity) {
            const siblings = manifest.entities.filter(e => 
              (e.parentId === entity.parentId && e.type === entity.type) ||
              (e.managerId === entity.managerId && entity.managerId)
            );
            const currentIndex = siblings.findIndex(s => s.id === selectedNodeId);
            const offset = e.key === 'ArrowLeft' ? -1 : 1;
            const targetSibling = siblings[currentIndex + offset];
            if (targetSibling) {
              targetNode = nodes.find(n => n.id === targetSibling.id) as Node<EntityNodeData>;
            }
          }
        } else if (e.key === 'Enter') {
          // Toggle collapse for departments
          const entity = manifest.entities.find(en => en.id === selectedNodeId);
          if (entity?.type === 'department') {
            handleToggleCollapse(selectedNodeId);
          }
        }
        
        if (targetNode && !targetNode.hidden) {
          e.preventDefault();
          setSelectedNodeId(targetNode.id);
          setSelectedEntity(targetNode.data?.entity || null);
          // Center on the selected node
          setCenter(
            targetNode.position.x + 100,
            targetNode.position.y + 50,
            { zoom: getZoom(), duration: 300 }
          );
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, isSearchFocused, nodes, manifest.entities, handleToggleCollapse, setCenter, getZoom, selectedEntity, searchResults, selectedSearchIndex, navigateToSearchResult, searchQuery]);
  
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: OnSelectionChangeParams) => {
    if (selectedNodes.length > 0) {
      const node = selectedNodes[0] as Node<EntityNodeData>;
      setSelectedEntity(node.data?.entity || null);
      setSelectedNodeId(node.id);
      
      // Find all nodes connected to this entity via any relationship
      setTimeout(() => {
        const connectedNodeIds = new Set([node.id]);
        initialEdges.forEach(edge => {
          if (edge.source === node.id) connectedNodeIds.add(edge.target);
          if (edge.target === node.id) connectedNodeIds.add(edge.source);
        });
        
        // Get positions of all connected nodes
        const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id));
        if (connectedNodes.length > 1) {
          const xs = connectedNodes.map(n => n.position.x);
          const ys = connectedNodes.map(n => n.position.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs) + 200; // Add some padding for node width
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys) + 100; // Add some padding for node height
          
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const width = maxX - minX;
          const height = maxY - minY;
          
          // Calculate zoom to fit all connected nodes
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const zoomX = (viewportWidth * 0.8) / width;
          const zoomY = (viewportHeight * 0.8) / height;
          const targetZoom = Math.min(zoomX, zoomY, 1.5); // Max zoom of 1.5
          
          setCenter(centerX, centerY, { zoom: targetZoom, duration: 500 });
        }
      }, 50);
    } else {
      setSelectedEntity(null);
      setSelectedNodeId(null);
      // Reset view to show entire graph
      setTimeout(() => {
        fitView({ padding: 0.3, duration: 500 });
      }, 50);
    }
  }, [initialEdges, nodes, setCenter, fitView]);
  
  const handleCloseInspector = useCallback(() => {
    setSelectedEntity(null);
    setSelectedNodeId(null);
    // Deselect all nodes in React Flow so onSelectionChange doesn't re-set the entity
    setNodes(nds => nds.map(n => ({ ...n, selected: false })));
    // Reset view to show entire graph
    setTimeout(() => {
      fitView({ padding: 0.3, duration: 500 });
    }, 50);
  }, [fitView, setNodes]);

  const openCreate = useCallback((type: Entity['type']) => {
    setEditorDefaultType(type);
    setEditorMode('add');
    setEditorInitialEntity(null);
    setEditorOpen(true);
    setSelectedEntity(null);
    setSelectedNodeId(null);
  }, []);

  const openEdit = useCallback((entity: Entity) => {
    setEditorDefaultType(entity.type);
    setEditorMode('edit');
    setEditorInitialEntity(entity);
    setEditorOpen(true);
  }, []);

  const handleSaveEntity = useCallback((draft: Entity, updatedRelationships?: Relationship[]) => {
    let nextEntities = manifest.entities;
    
    if (editorMode === 'add') {
      nextEntities = [...manifest.entities, draft];
    } else if (editorMode === 'edit') {
      nextEntities = manifest.entities.map((e) => (e.id === draft.id ? draft : e));
    }
    
    // Update relationships
    let nextRelationships = manifest.relationships || [];
    
    if (updatedRelationships) {
      // Remove old relationships where this entity is the source
      nextRelationships = nextRelationships.filter(r => r.from !== draft.id);
      
      // Add updated relationships (filter out invalid ones)
      const validRelationships = updatedRelationships.filter(r => r.to && r.type);
      nextRelationships = [...nextRelationships, ...validRelationships];
    }
    
    onUpdateManifest({ 
      name: manifest.name,
      entities: nextEntities,
      relationships: nextRelationships.length > 0 ? nextRelationships : undefined
    });
    
    setSelectedEntity(draft);
    setSelectedNodeId(draft.id);
    setEditorOpen(false);
  }, [editorMode, manifest, onUpdateManifest]);

  const handleDeleteEntity = useCallback((entity: Entity) => {
    if (!window.confirm(`Delete ${entity.name}? This may remove related items.`)) {
      return;
    }

    let nextEntities = manifest.entities;

    if (entity.type === 'department') {
      const deptIds = new Set<string>();
      const collect = (id: string) => {
        deptIds.add(id);
        manifest.entities.forEach((e) => {
          if (e.type === 'department' && e.parentId === id) {
            collect(e.id);
          }
        });
      };
      collect(entity.id);

      const removedPersons = new Set(
        manifest.entities
          .filter((e) => e.type === 'person' && e.parentId && deptIds.has(e.parentId))
          .map((p) => p.id)
      );

      nextEntities = manifest.entities.filter(
        (e) => !(e.type === 'department' && deptIds.has(e.id)) && !(e.type === 'person' && removedPersons.has(e.id))
      );

      const removedIds = new Set<string>([...deptIds, ...removedPersons]);
      nextEntities = nextEntities.map((e) =>
        e.managerId && removedIds.has(e.managerId)
          ? { ...e, managerId: undefined }
          : e
      );
    } else {
      nextEntities = manifest.entities
        .filter((e) => e.id !== entity.id)
        .map((e) => (e.managerId === entity.id ? { ...e, managerId: undefined } : e));
    }

    // Filter out relationships referencing deleted entities
    const removedIds = new Set(manifest.entities.filter(e => !nextEntities.includes(e)).map(e => e.id));
    const nextRelationships = (manifest.relationships || []).filter(
      r => !removedIds.has(r.from) && !removedIds.has(r.to)
    );

    onUpdateManifest({
      name: manifest.name,
      entities: nextEntities,
      relationships: nextRelationships.length > 0 ? nextRelationships : undefined,
    });
    setSelectedEntity(null);
    setSelectedNodeId(null);
    setEditorOpen(false);
  }, [manifest, onUpdateManifest]);

  const downloadManifest = useCallback(() => {
    try {
      const payload: Record<string, unknown> = {};
      if (manifest.name) payload.name = manifest.name;
      payload.entities = manifest.entities;
      if (manifest.relationships && manifest.relationships.length > 0) {
        payload.relationships = manifest.relationships;
      }
      const serialized = yaml.dump(payload, { noRefs: true });
      const blob = new Blob([serialized], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = manifestFilename || 'manifest.yaml';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export manifest', err);
    }
  }, [manifest, manifestFilename]);
  
  // Export functions
  const exportToPng = useCallback(async () => {
    const element = document.querySelector('.react-flow') as HTMLElement;
    if (!element) return;
    
    try {
      const dataUrl = await toPng(element, {
        backgroundColor: '#0f1419',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = 'org-chart.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export PNG:', err);
    }
    setShowExportMenu(false);
  }, []);
  
  const exportToSvg = useCallback(async () => {
    const element = document.querySelector('.react-flow') as HTMLElement;
    if (!element) return;
    
    try {
      const dataUrl = await toSvg(element, {
        backgroundColor: '#0f1419',
      });
      const link = document.createElement('a');
      link.download = 'org-chart.svg';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export SVG:', err);
    }
    setShowExportMenu(false);
  }, []);
  
  // Layout toggle (simplified - just rotates positions)
  const toggleLayout = useCallback(() => {
    const newDirection = layoutDirection === 'vertical' ? 'horizontal' : 'vertical';
    setLayoutDirection(newDirection);
    
    setNodes(nds => nds.map(node => ({
      ...node,
      position: newDirection === 'horizontal' 
        ? { x: node.position.y * 1.5, y: node.position.x * 0.7 }
        : { x: node.position.y * 0.7, y: node.position.x * 1.5 },
    })));
    
    setTimeout(() => fitView({ padding: 0.3 }), 50);
  }, [layoutDirection, setNodes, fitView]);
  
  // Expand/Collapse all
  const expandAll = useCallback(() => {
    setCollapsedNodes(new Set());
  }, []);
  
  const collapseAll = useCallback(() => {
    const deptIds = manifest.entities
      .filter(e => e.type === 'department')
      .map(e => e.id);
    setCollapsedNodes(new Set(deptIds));
  }, [manifest.entities]);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full relative" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-3">
        <div 
          className="rounded-xl px-4 py-2.5 flex items-center gap-3"
          style={{
            backgroundColor: 'var(--color-bg-light)',
            border: '1px solid var(--color-secondary)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          }}
        >
          <span className="text-xl">📊</span>
          <div>
            <h1 
              className="font-bold"
              style={{ 
                fontFamily: 'var(--font-primary)',
                fontSize: '16px',
                letterSpacing: '-0.02em',
                color: 'var(--color-fg)',
              }}
            >
              {manifest.name || 'Organization Graph'}
            </h1>
            <p 
              style={{ 
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--color-fg-muted)',
              }}
            >
              {departmentCount} departments • {personCount} persons
            </p>
          </div>
        </div>
        
        <button
          onClick={onClearManifest}
          className="rounded-xl px-4 py-2.5 transition-all duration-200 hover:scale-105"
          style={{
            fontFamily: 'var(--font-primary)',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: 'var(--color-bg-light)',
            border: '1px solid var(--color-secondary)',
            color: 'var(--color-fg-muted)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-secondary)';
            e.currentTarget.style.color = 'var(--color-fg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-light)';
            e.currentTarget.style.color = 'var(--color-fg-muted)';
          }}
        >
          Load New File
        </button>

        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={() => openCreate('department')}
            className="rounded-xl px-3 py-2.5 transition-all duration-200 hover:scale-105"
            style={{
              fontFamily: 'var(--font-primary)',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: 'var(--color-bg-light)',
              border: '1px solid var(--color-secondary)',
              color: 'var(--color-fg)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            }}
          >
            <span className="inline-flex items-center gap-1"><Plus size={14} /> Dept</span>
          </button>
          <button
            onClick={() => openCreate('person')}
            className="rounded-xl px-3 py-2.5 transition-all duration-200 hover:scale-105"
            style={{
              fontFamily: 'var(--font-primary)',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: 'var(--color-bg-light)',
              border: '1px solid var(--color-secondary)',
              color: 'var(--color-fg)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            }}
          >
            <span className="inline-flex items-center gap-1"><Plus size={14} /> Person</span>
          </button>
        </div>
      </div>
      
      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
        <div 
          className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200"
          style={{
            width: isSearchFocused || searchQuery ? 400 : 220,
            backgroundColor: 'var(--color-bg-light)',
            border: `1px solid ${isSearchFocused ? 'var(--color-accent)' : 'var(--color-secondary)'}`,
            boxShadow: isSearchFocused 
              ? '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 2px var(--color-accent)33'
              : '0 4px 16px rgba(0, 0, 0, 0.3)',
            borderRadius: showSearchResults && searchResults.length > 0 ? '12px 12px 0 0' : '12px',
          }}
        >
          <Search size={16} style={{ color: isSearchFocused ? 'var(--color-accent)' : 'var(--color-fg-muted)' }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search people, departments... (press /)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => {
              setIsSearchFocused(true);
              setShowSearchResults(true);
            }}
            onBlur={() => {
              setIsSearchFocused(false);
              // Delay hiding results to allow click
              setTimeout(() => setShowSearchResults(false), 200);
            }}
            className="flex-1 bg-transparent outline-none"
            style={{
              fontFamily: 'var(--font-primary)',
              fontSize: '13px',
              color: 'var(--color-fg)',
            }}
          />
          {searchQuery && (
            <>
              <span 
                className="text-xs px-1.5 py-0.5 rounded shrink-0"
                style={{ 
                  backgroundColor: searchResults.length > 0 ? 'var(--color-accent)' : 'var(--color-secondary)',
                  color: searchResults.length > 0 ? 'var(--color-bg)' : 'var(--color-fg-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                }}
              >
                {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
              </span>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className="hover:opacity-70 transition-opacity"
              >
                <X size={14} style={{ color: 'var(--color-fg-muted)' }} />
              </button>
            </>
          )}
        </div>
        
        {/* Search Results Dropdown */}
        {showSearchResults && searchQuery && searchResults.length > 0 && (
          <div 
            ref={searchResultsRef}
            className="rounded-b-xl overflow-hidden"
            style={{
              width: 400,
              maxHeight: 320,
              overflowY: 'auto',
              backgroundColor: 'var(--color-bg-light)',
              border: '1px solid var(--color-secondary)',
              borderTop: 'none',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
          >
            {searchResults.map((result, index) => {
              const isSelected = index === selectedSearchIndex;
              return (
                <div
                  key={result.entity.id}
                  data-search-item
                  onClick={() => navigateToSearchResult(result.entity.id)}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all duration-150"
                  style={{
                    backgroundColor: isSelected ? 'var(--color-secondary)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--color-accent)' : '3px solid transparent',
                  }}
                  onMouseEnter={() => setSelectedSearchIndex(index)}
                >
                  {/* Icon */}
                  <div 
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: result.entity.type === 'department' 
                        ? 'rgba(233, 127, 36, 0.2)' 
                        : 'rgba(50, 166, 143, 0.2)',
                    }}
                  >
                    {result.entity.type === 'department' ? (
                      <Building2 size={16} style={{ color: '#e07b24' }} />
                    ) : (
                      <User size={16} style={{ color: '#32a68f' }} />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span 
                        className="font-semibold truncate"
                        style={{ 
                          fontFamily: 'var(--font-primary)',
                          fontSize: '13px',
                          color: 'var(--color-fg)',
                        }}
                      >
                        <HighlightedText text={result.entity.name} query={searchQuery} />
                      </span>
                      {result.matchType !== 'name' && (
                        <span 
                          className="text-xs px-1.5 py-0.5 rounded shrink-0"
                          style={{ 
                            backgroundColor: 'rgba(250, 204, 21, 0.2)',
                            color: '#facc15',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {result.matchField}
                        </span>
                      )}
                    </div>
                    
                    <div 
                      className="flex items-center gap-2 mt-0.5"
                      style={{ fontSize: '11px', color: 'var(--color-fg-muted)' }}
                    >
                      {typeof result.entity.metadata?.title === 'string' && result.entity.metadata.title && (
                        <span style={{ fontFamily: 'var(--font-mono)' }}>
                          <HighlightedText 
                            text={result.entity.metadata.title} 
                            query={result.matchType === 'title' ? searchQuery : ''} 
                          />
                        </span>
                      )}
                      {result.parentName && (
                        <>
                          {result.entity.metadata?.title ? <span>•</span> : null}
                          <span className="flex items-center gap-1">
                            <MapPin size={10} />
                            {result.parentName}
                          </span>
                        </>
                      )}
                    </div>
                    
                    {result.matchType === 'metadata' && result.matchField !== 'title' && (
                      <div 
                        className="mt-0.5"
                        style={{ fontSize: '10px', color: 'var(--color-fg-muted)', fontFamily: 'var(--font-mono)' }}
                      >
                        {result.matchField}: <HighlightedText text={result.matchValue} query={searchQuery} />
                      </div>
                    )}
                  </div>
                  
                  {/* Navigate arrow */}
                  <ArrowRight size={14} style={{ color: 'var(--color-fg-muted)', opacity: isSelected ? 1 : 0.5 }} />
                </div>
              );
            })}
            
            {/* Keyboard hint */}
            <div 
              className="px-3 py-2 flex items-center justify-center gap-4"
              style={{ 
                borderTop: '1px solid var(--color-secondary)',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--color-fg-muted)', fontFamily: 'var(--font-mono)' }}>
                <kbd className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-secondary)' }}>↑↓</kbd> navigate
              </span>
              <span style={{ fontSize: '10px', color: 'var(--color-fg-muted)', fontFamily: 'var(--font-mono)' }}>
                <kbd className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-secondary)' }}>Enter</kbd> go to
              </span>
              <span style={{ fontSize: '10px', color: 'var(--color-fg-muted)', fontFamily: 'var(--font-mono)' }}>
                <kbd className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-secondary)' }}>Esc</kbd> close
              </span>
            </div>
          </div>
        )}
        
        {/* No results message */}
        {showSearchResults && searchQuery && searchResults.length === 0 && (
          <div 
            className="rounded-b-xl px-4 py-6 text-center"
            style={{
              width: 400,
              backgroundColor: 'var(--color-bg-light)',
              border: '1px solid var(--color-secondary)',
              borderTop: 'none',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
          >
            <Search size={24} style={{ color: 'var(--color-fg-muted)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px', color: 'var(--color-fg-muted)', fontFamily: 'var(--font-primary)' }}>
              No results found for "<strong style={{ color: 'var(--color-fg)' }}>{searchQuery}</strong>"
            </p>
            <p style={{ fontSize: '11px', color: 'var(--color-fg-muted)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
              Try searching by name, title, or department
            </p>
          </div>
        )}
      </div>
      
      {/* Toolbar - Top Right (hidden when inspector/editor panels are open to avoid overlap) */}
      <div 
        className="absolute top-4 right-4 z-50 flex items-center gap-2 transition-all duration-200"
        style={{
          opacity: (selectedEntity || editorOpen) ? 0 : 1,
          pointerEvents: (selectedEntity || editorOpen) ? 'none' : 'auto',
        }}
      >
        {/* Expand/Collapse buttons */}
        <div 
          className="flex items-center rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--color-bg-light)',
            border: '1px solid var(--color-secondary)',
          }}
        >
          <button
            onClick={expandAll}
            className="px-3 py-2 flex items-center gap-1.5 transition-all duration-200 hover:bg-(--color-secondary)"
            title="Expand All"
            style={{ color: 'var(--color-fg-muted)', fontSize: '12px', fontFamily: 'var(--font-primary)' }}
          >
            <ChevronDown size={14} />
            <span>Expand</span>
          </button>
          <div className="w-px h-6" style={{ backgroundColor: 'var(--color-secondary)' }} />
          <button
            onClick={collapseAll}
            className="px-3 py-2 flex items-center gap-1.5 transition-all duration-200 hover:bg-(--color-secondary)"
            title="Collapse All"
            style={{ color: 'var(--color-fg-muted)', fontSize: '12px', fontFamily: 'var(--font-primary)' }}
          >
            <ChevronUp size={14} />
            <span>Collapse</span>
          </button>
        </div>
        
        {/* Layout Toggle */}
        <button
          onClick={toggleLayout}
          className="rounded-xl p-2.5 transition-all duration-200 hover:scale-105"
          title={`Switch to ${layoutDirection === 'vertical' ? 'horizontal' : 'vertical'} layout`}
          style={{
            backgroundColor: 'var(--color-bg-light)',
            border: '1px solid var(--color-secondary)',
            color: 'var(--color-fg-muted)',
          }}
        >
          {layoutDirection === 'vertical' ? (
            <ArrowLeftRight size={18} />
          ) : (
            <ArrowDownUp size={18} />
          )}
        </button>

        {/* Export manifest */}
        <button
          onClick={downloadManifest}
          className="rounded-xl px-3 py-2.5 transition-all duration-200 hover:scale-105"
          title="Download updated manifest"
          style={{
            backgroundColor: 'var(--color-bg-light)',
            border: '1px solid var(--color-secondary)',
            color: 'var(--color-fg-muted)',
            fontFamily: 'var(--font-primary)',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <span className="inline-flex items-center gap-1"><Download size={16} /> Manifest</span>
        </button>
        
        {/* Export Button */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="rounded-xl p-2.5 transition-all duration-200 hover:scale-105"
            title="Export"
            style={{
              backgroundColor: 'var(--color-bg-light)',
              border: '1px solid var(--color-secondary)',
              color: 'var(--color-fg-muted)',
            }}
          >
            <Download size={18} />
          </button>
          
          {showExportMenu && (
            <div 
              className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden"
              style={{
                backgroundColor: 'var(--color-bg-light)',
                border: '1px solid var(--color-secondary)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              }}
            >
              <button
                onClick={exportToPng}
                className="w-full px-4 py-2.5 flex items-center gap-2 transition-all duration-200 hover:bg-(--color-secondary)"
                style={{ color: 'var(--color-fg)', fontSize: '13px', fontFamily: 'var(--font-primary)' }}
              >
                <Image size={16} />
                Export as PNG
              </button>
              <button
                onClick={exportToSvg}
                className="w-full px-4 py-2.5 flex items-center gap-2 transition-all duration-200 hover:bg-(--color-secondary)"
                style={{ color: 'var(--color-fg)', fontSize: '13px', fontFamily: 'var(--font-primary)' }}
              >
                <FileCode size={16} />
                Export as SVG
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Legend and Relationship Filters */}
      <div className="absolute bottom-4 left-4 z-50 flex flex-col gap-2">
        {/* Legend - Compact */}
        <div 
          className="rounded-xl px-3 py-2"
          style={{
            backgroundColor: 'var(--color-bg-light)',
            border: '1px solid var(--color-secondary)',
          }}
        >
          <div
            className="flex items-center gap-3"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}
          >
            <div className="flex items-center gap-1">
              <Building2 size={12} style={{ color: 'var(--color-fg-muted)' }} />
              <span style={{ color: 'var(--color-fg-muted)' }}>Department</span>
            </div>
            <div className="flex items-center gap-1">
              <User size={12} style={{ color: 'var(--color-fg-muted)' }} />
              <span style={{ color: 'var(--color-fg-muted)' }}>Person</span>
            </div>
          </div>
        </div>
        
        {/* Relationship Filter Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowRelationshipFilters(!showRelationshipFilters)}
            className="rounded-xl px-3 py-2 transition-all duration-200 hover:scale-105 w-full"
            style={{
              backgroundColor: 'var(--color-bg-light)',
              border: '1px solid var(--color-secondary)',
              color: 'var(--color-fg)',
              fontFamily: 'var(--font-primary)',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <span className="inline-flex items-center gap-2 w-full justify-between">
              <span className="flex items-center gap-1">
                <ArrowRight size={14} />
                Relationships
              </span>
              {showRelationshipFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>
          
          {showRelationshipFilters && (
            <div 
              className="absolute bottom-full left-0 mb-2 rounded-xl px-3 py-2"
              style={{
                backgroundColor: 'var(--color-bg-light)',
                border: '1px solid var(--color-secondary)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                minWidth: '250px',
              }}
            >
              <div style={{ fontFamily: 'var(--font-primary)', fontSize: '11px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-fg)' }}>
                Show/Hide Relationships
              </div>
              <div className="flex flex-col gap-1.5">
                {(['department_hierarchy', 'person_management', 'manages', 'influences', 'depends_on', 'collaborates_with', 'reports_to'] as RelationshipType[]).map(relType => {
                  const isVisible = visibleRelationships.has(relType);
                  const displayName = relType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  const count = initialEdges.filter(e => e.data?.type === relType).length;
                  
                  if (count === 0) return null;
                  
                  return (
                    <button
                      key={relType}
                      onClick={() => toggleRelationshipType(relType)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded transition-all duration-150"
                      style={{
                        backgroundColor: isVisible ? 'var(--color-secondary)' : 'transparent',
                        color: 'var(--color-fg)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        readOnly
                        style={{ accentColor: 'var(--color-accent)' }}
                      />
                      <span style={{ flex: 1, textAlign: 'left' }}>{displayName}</span>
                      <span style={{ color: 'var(--color-fg-muted)' }}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Graph */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'relationshipEdge',
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={1} 
          color="oklch(0.30 0.02 250)" 
        />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            const data = node.data as EntityNodeData;
            return data?.entityColor || '#7a8694';
          }}
          maskColor="oklch(0.15 0.03 250 / 0.8)"
          pannable
          zoomable
        />
      </ReactFlow>
      
      {/* Inspector Panel */}
      <InspectorPanel
        selectedEntity={selectedEntity}
        manifest={manifest}
        onClose={handleCloseInspector}
        onEdit={openEdit}
        onDelete={handleDeleteEntity}
      />

      <EntityEditor
        key={`${editorMode}-${editorInitialEntity?.id ?? 'new'}-${editorOpen}`}
        open={editorOpen}
        mode={editorMode}
        manifest={manifest}
        defaultType={editorDefaultType}
        initialEntity={editorInitialEntity}
        onCancel={() => setEditorOpen(false)}
        onSave={handleSaveEntity}
      />
      
      {/* Keyboard shortcuts hint */}
      <div 
        className="absolute bottom-4 right-4 z-40"
        style={{ 
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--color-fg-muted)',
        }}
      >
        <kbd 
          className="px-1.5 py-0.5 rounded mr-1"
          style={{ 
            backgroundColor: 'var(--color-bg-light)',
            border: '1px solid var(--color-secondary)',
          }}
        >
          /
        </kbd>
        search • 
        <kbd 
          className="px-1.5 py-0.5 rounded mx-1"
          style={{ 
            backgroundColor: 'var(--color-bg-light)',
            border: '1px solid var(--color-secondary)',
          }}
        >
          ↑↓←→
        </kbd>
        navigate • 
        <kbd 
          className="px-1.5 py-0.5 rounded mx-1"
          style={{ 
            backgroundColor: 'var(--color-bg-light)',
            border: '1px solid var(--color-secondary)',
          }}
        >
          Enter
        </kbd>
        expand/collapse
      </div>
    </div>
  );
}

export function OrganizationGraph(props: OrganizationGraphProps) {
  return (
    <ReactFlowProvider>
      <OrganizationGraphInner {...props} />
    </ReactFlowProvider>
  );
}
