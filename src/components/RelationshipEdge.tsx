import { memo, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  type Edge,
  Position,
} from '@xyflow/react';
import type { RelationshipEdgeData } from '../graphUtils';
import type { RelationshipType } from '../types';

type RelationshipEdgeType = Edge<RelationshipEdgeData, 'relationshipEdge'>;

// Colors from design system
const ACCENT_COLOR = 'oklch(0.75 0.15 195)'; // Bright Cyan

// Relationship type colors
const RELATIONSHIP_COLORS: Record<RelationshipType, string> = {
  department_hierarchy: 'oklch(0.55 0.10 195)', // Blue-gray for hierarchy
  person_management: 'oklch(0.50 0.08 270)',    // Purple-gray for management
  manages: 'oklch(0.60 0.15 30)',               // Orange for manages
  influences: 'oklch(0.65 0.12 150)',           // Teal for influences
  depends_on: 'oklch(0.55 0.15 330)',           // Pink for dependencies
  collaborates_with: 'oklch(0.60 0.12 90)',     // Yellow-green for collaboration
  reports_to: 'oklch(0.50 0.08 270)',           // Purple-gray for reports
};

// Create a rectangular step path (no curves)
function getRectangularPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position
): string {
  const isVertical = 
    (sourcePosition === Position.Bottom || sourcePosition === Position.Top) &&
    (targetPosition === Position.Top || targetPosition === Position.Bottom);
  const isHorizontal = 
    (sourcePosition === Position.Left || sourcePosition === Position.Right) &&
    (targetPosition === Position.Left || targetPosition === Position.Right);
  const isHorizontalToVertical = 
    (sourcePosition === Position.Left || sourcePosition === Position.Right) &&
    (targetPosition === Position.Top || targetPosition === Position.Bottom);
  const isVerticalToHorizontal = 
    (sourcePosition === Position.Bottom || sourcePosition === Position.Top) &&
    (targetPosition === Position.Left || targetPosition === Position.Right);

  // Vertical connections (top/bottom handles)
  if (isVertical) {
    const midY = (sourceY + targetY) / 2;
    return `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
  }

  // Horizontal connections (left/right handles)
  if (isHorizontal) {
    const midX = (sourceX + targetX) / 2;
    return `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
  }

  // Side handle to vertical target (e.g., left/right to top)
  if (isHorizontalToVertical) {
    const midX = sourcePosition === Position.Left
      ? sourceX - Math.abs(targetX - sourceX) / 2
      : sourceX + Math.abs(targetX - sourceX) / 2;
    return `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
  }

  // Vertical source to side target
  if (isVerticalToHorizontal) {
    const midY = sourcePosition === Position.Top
      ? sourceY - Math.abs(targetY - sourceY) / 2
      : sourceY + Math.abs(targetY - sourceY) / 2;
    return `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
  }

  // Fallback: straight line
  return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
}

function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelationshipEdgeType>) {
  const [isHovered, setIsHovered] = useState(false);
  
  const edgeType = data?.type || 'department_hierarchy';
  const isImplicit = data?.isImplicit ?? true;
  const note = data?.note;
  const strength = data?.strength;
  
  const baseColor = RELATIONSHIP_COLORS[edgeType];
  
  // Use rectangular step path for clean org-chart style connectors
  const edgePath = getRectangularPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition
  );
  
  const activeColor = selected || isHovered ? ACCENT_COLOR : baseColor;
  
  // Adjust stroke width based on relationship strength
  let baseStrokeWidth = 1.5;
  if (strength === 'high') baseStrokeWidth = 2.5;
  else if (strength === 'low') baseStrokeWidth = 1;
  
  const strokeWidth = isHovered ? baseStrokeWidth + 1.5 : baseStrokeWidth;
  
  // Use dashed lines for non-hierarchical relationships
  const isDashed = !isImplicit && edgeType !== 'department_hierarchy' && edgeType !== 'person_management';
  
  // Calculate label position (midpoint of edge)
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;
  
  return (
    <>
      {/* Glow effect when hovered */}
      {isHovered && (
        <path
          d={edgePath}
          fill="none"
          stroke={ACCENT_COLOR}
          strokeWidth={8}
          strokeLinecap="round"
          style={{
            filter: 'blur(4px)',
            opacity: 0.5,
          }}
        />
      )}
      
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: activeColor,
          strokeWidth,
          strokeDasharray: isDashed ? '5,5' : undefined,
          transition: 'all 200ms ease-out',
        }}
      />
      
      {/* Invisible wider path for easier hovering */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: 'pointer' }}
      />
      
      {/* Edge label with note (shown on hover for explicit relationships) */}
      {(isHovered || selected) && note && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              maxWidth: '200px',
              zIndex: 1000,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>
              {edgeType.replace(/_/g, ' ')}
            </div>
            <div style={{ opacity: 0.9 }}>{note}</div>
            {strength && (
              <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                Strength: {strength}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
