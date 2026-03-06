import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Building2, User, ChevronDown, ChevronRight, Users } from 'lucide-react';
import type { EntityNodeData } from '../graphUtils';

type EntityNodeType = Node<EntityNodeData, 'entityNode'>;

// Get initials from a name (e.g., "John Smith" -> "JS")
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Determine if text should be dark or light based on background color
function getContrastColor(hexColor: string): 'dark' | 'light' {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? 'dark' : 'light';
}

// Utility to adjust color brightness
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

export interface EntityNodeExtraProps {
  isCollapsed?: boolean;
  onToggleCollapse?: (nodeId: string) => void;
  isSearchMatch?: boolean;
  isSearchActive?: boolean;
  hasCollapsedChildren?: boolean;
  collapsedChildCount?: number;
}

function EntityNodeComponent({ 
  data, 
  selected, 
  id,
}: NodeProps<EntityNodeType>) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const nodeRef = useRef<HTMLDivElement>(null);
  const { entity, entityColor, isPersonNode, isCollapsed, isSearchMatch, isSearchActive, hasCollapsedChildren, collapsedChildCount, onToggleCollapse } = data;
  
  const contrastMode = getContrastColor(entityColor);
  const textColor = contrastMode === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)';
  const subtextColor = contrastMode === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.75)';
  
  // Dimmed state when search is active but this node doesn't match
  const isDimmed = isSearchActive && !isSearchMatch;
  
  // Update tooltip position when hovered
  useEffect(() => {
    if (isHovered && nodeRef.current) {
      const rect = nodeRef.current.getBoundingClientRect();
      setTooltipPosition({
        x: rect.right + 12,
        y: rect.top,
      });
    }
  }, [isHovered]);
  
  const handleCollapseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleCollapse) {
      onToggleCollapse(id);
    }
  }, [id, onToggleCollapse]);
  
  // Render tooltip in a portal to escape React Flow's z-index constraints
  const renderTooltip = () => {
    if (!isHovered || !entity.metadata || Object.keys(entity.metadata).length === 0) {
      return null;
    }
    
    return createPortal(
      <div 
        className="fixed rounded-xl p-3 pointer-events-none"
        style={{
          left: tooltipPosition.x,
          top: tooltipPosition.y,
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-secondary)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          minWidth: 200,
          animation: 'fadeSlideIn 180ms ease-out',
          zIndex: 99999,
        }}
      >
        <div className="flex items-center gap-2 mb-2 pb-2" style={{ borderBottom: '1px solid var(--color-secondary)' }}>
          {isPersonNode ? (
            <User size={14} style={{ color: 'var(--color-accent)' }} />
          ) : (
            <Building2 size={14} style={{ color: 'var(--color-accent)' }} />
          )}
          <span 
            className="uppercase tracking-wider"
            style={{ 
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-fg-muted)',
            }}
          >
            {entity.type}
          </span>
        </div>
        {Object.entries(entity.metadata).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-4 py-1" style={{ fontSize: '12px' }}>
            <span style={{ color: 'var(--color-fg-muted)', fontFamily: 'var(--font-primary)' }}>{key}:</span>
            <span style={{ color: 'var(--color-fg)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{String(value)}</span>
          </div>
        ))}
      </div>,
      document.body
    );
  };
  
  return (
    <div
      ref={nodeRef}
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        opacity: isDimmed ? 0.3 : 1,
        transition: 'opacity 200ms ease-out',
      }}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-2! h-2! -top-1! border-0! opacity-0!"
        style={{ background: 'transparent' }}
      />
      
      {/* Person Node - 140px wide × 60px tall */}
      {isPersonNode && (
        <div
          className={`
            rounded-xl transition-all duration-200
            ${selected ? 'ring-2 ring-offset-2 ring-offset-transparent ring-(--color-accent)' : ''}
            ${isSearchMatch && !selected ? 'search-match-highlight' : ''}
          `}
          style={{ 
            width: 140,
            height: 60,
            background: `linear-gradient(135deg, ${entityColor} 0%, ${adjustColor(entityColor, -15)} 100%)`,
            boxShadow: isHovered 
              ? `0 0 24px ${entityColor}66, 0 8px 24px rgba(0, 0, 0, 0.4)` 
              : isSearchMatch 
                ? `0 0 20px rgba(250, 204, 21, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3)`
                : '0 4px 16px rgba(0, 0, 0, 0.3)',
            transform: isHovered ? 'scale(1.03)' : isSearchMatch ? 'scale(1.02)' : 'scale(1)',
          }}
        >
          <div className="h-full flex items-center gap-2 px-3 py-2">
            {/* Avatar with initials */}
            <div 
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs"
              style={{
                backgroundColor: contrastMode === 'dark' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.2)',
                color: textColor,
                border: `2px solid ${contrastMode === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.3)'}`,
              }}
            >
              {getInitials(entity.name)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div 
                className="font-semibold leading-tight truncate"
                style={{ 
                  fontFamily: 'var(--font-primary)',
                  fontSize: '12px',
                  color: textColor,
                }}
              >
                {entity.name}
              </div>
              {entity.metadata?.title != null && (
                <div 
                  className="truncate leading-tight mt-0.5"
                  style={{ 
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    color: subtextColor,
                  }}
                >
                  {entity.metadata.title as string}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Department Node - 200px wide × 90px tall */}
      {!isPersonNode && (
        <div
          className={`
            rounded-xl transition-all duration-200 relative
            ${selected ? 'ring-2 ring-offset-2 ring-offset-transparent ring-(--color-accent)' : ''}
            ${isSearchMatch && !selected ? 'search-match-highlight' : ''}
          `}
          style={{ 
            width: 200,
            height: 90,
            background: `linear-gradient(135deg, ${entityColor} 0%, ${adjustColor(entityColor, -15)} 100%)`,
            boxShadow: isHovered 
              ? `0 0 24px ${entityColor}66, 0 8px 24px rgba(0, 0, 0, 0.4)` 
              : isSearchMatch 
                ? `0 0 20px rgba(250, 204, 21, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3)`
                : '0 4px 16px rgba(0, 0, 0, 0.3)',
            transform: isHovered ? 'scale(1.02)' : isSearchMatch ? 'scale(1.01)' : 'scale(1)',
          }}
        >
          {/* Collapse/Expand Button */}
          {onToggleCollapse && (
            <button
              onClick={handleCollapseClick}
              className="absolute -right-2 -bottom-2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
              style={{
                backgroundColor: 'var(--color-bg)',
                border: '2px solid var(--color-secondary)',
                color: 'var(--color-fg)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
              }}
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
          )}
          
          {/* Collapsed indicator badge */}
          {hasCollapsedChildren && collapsedChildCount && collapsedChildCount > 0 && (
            <div
              className="absolute -right-1 -top-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-bg)',
                fontSize: '10px',
                minWidth: '20px',
                textAlign: 'center',
              }}
            >
              +{collapsedChildCount}
            </div>
          )}
          
          <div className="h-full flex flex-col items-center justify-center px-4 py-3">
            {/* Icon */}
            <div 
              className="flex items-center justify-center mb-1.5"
              style={{ color: textColor }}
            >
              <Building2 size={24} strokeWidth={1.5} />
            </div>
            
            <div 
              className="font-bold text-center leading-tight"
              style={{ 
                fontFamily: 'var(--font-primary)',
                fontSize: '14px',
                color: textColor,
              }}
            >
              {entity.name}
            </div>
            
            {entity.metadata?.headcount != null && (
              <div 
                className="flex items-center gap-1 mt-1"
                style={{ 
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: subtextColor,
                }}
              >
                <Users size={12} />
                <span>{String(entity.metadata.headcount)} people</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Side handles for department hierarchy edges when persons are present */}
      {!isPersonNode && (
        <>
          <Handle
            type="source"
            position={Position.Left}
            id="left"
            className="w-2! h-2! -left-1! border-0! opacity-0!"
            style={{ background: 'transparent' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            className="w-2! h-2! -right-1! border-0! opacity-0!"
            style={{ background: 'transparent' }}
          />
        </>
      )}
      
      {/* Render tooltip via portal */}
      {renderTooltip()}
      
      {/* Bottom source handle for hierarchy edges */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="bottom"
        className="w-2! h-2! -bottom-1! border-0! opacity-0!"
        style={{ background: 'transparent' }}
      />
      
      <style>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateX(-5px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes searchPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.7), 0 0 20px rgba(250, 204, 21, 0.5);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(250, 204, 21, 0), 0 0 30px rgba(250, 204, 21, 0.3);
          }
        }
        
        .search-match-highlight {
          animation: searchPulse 2s ease-in-out infinite;
          outline: 2px solid rgba(250, 204, 21, 0.8);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}

export const EntityNode = memo(EntityNodeComponent);
