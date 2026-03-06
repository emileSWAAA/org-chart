import type { Entity, Manifest } from '../types';

interface InspectorPanelProps {
  selectedEntity: Entity | null;
  manifest: Manifest;
  onClose: () => void;
  onEdit: (entity: Entity) => void;
  onDelete: (entity: Entity) => void;
}

const entityTypeIcons: Record<string, string> = {
  person: '👤',
  department: '🏢',
};

export function InspectorPanel({ 
  selectedEntity, 
  manifest,
  onClose,
  onEdit,
  onDelete,
}: InspectorPanelProps) {
  const isOpen = !!selectedEntity;
  
  const getEntityById = (id: string) => manifest.entities.find(e => e.id === id);
  
  const getChildDepartments = (deptId: string) => 
    manifest.entities.filter(e => e.type === 'department' && e.parentId === deptId);
  
  const getDepartmentPersons = (deptId: string) =>
    manifest.entities.filter(e => e.type === 'person' && e.parentId === deptId);
  
  const getManagedPersons = (personId: string) =>
    manifest.entities.filter(e => e.type === 'person' && e.managerId === personId);
  
  const getManager = (managerId: string | undefined) =>
    managerId ? getEntityById(managerId) : undefined;
  
  const getDepartment = (parentId: string | undefined) =>
    parentId ? getEntityById(parentId) : undefined;
  
  return (
    <div 
      className="absolute top-4 right-4 bottom-4 w-80 z-50 transition-panel"
      style={{
        transform: isOpen ? 'translateX(0)' : 'translateX(calc(100% + 16px))',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      <div 
        className="h-full rounded-xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--color-bg-light)',
          border: '1px solid var(--color-secondary)',
          boxShadow: '0 8px 32px oklch(0 0 0 / 0.4)',
        }}
      >
        <div 
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--color-secondary)' }}
        >
          <h3 
            className="font-semibold"
            style={{ 
              fontFamily: 'var(--font-primary)',
              fontSize: '16px',
              color: 'var(--color-fg)',
            }}
          >
            {selectedEntity?.type === 'department' ? 'Department Details' : 'Person Details'}
          </h3>
          <div className="flex items-center gap-2">
            {selectedEntity && (
              <>
                <button
                  onClick={() => onEdit(selectedEntity)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-hover"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--color-fg-muted)',
                    border: '1px solid var(--color-secondary)',
                  }}
                  title="Edit"
                >
                  ✎
                </button>
                <button
                  onClick={() => onDelete(selectedEntity)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-hover"
                  style={{
                    backgroundColor: 'transparent',
                    color: '#d93a3a',
                    border: '1px solid var(--color-secondary)',
                  }}
                  title="Delete"
                >
                  Del
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-hover"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--color-fg-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-secondary)';
                e.currentTarget.style.color = 'var(--color-fg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-fg-muted)';
              }}
            >
              X
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5">
          {selectedEntity?.type === 'department' && (
            <DepartmentDetails 
              entity={selectedEntity} 
              childDepartments={getChildDepartments(selectedEntity.id)}
              persons={getDepartmentPersons(selectedEntity.id)}
              parentDepartment={getDepartment(selectedEntity.parentId)}
            />
          )}
          
          {selectedEntity?.type === 'person' && (
            <PersonDetails 
              entity={selectedEntity} 
              department={getDepartment(selectedEntity.parentId)}
              manager={getManager(selectedEntity.managerId)}
              managedPersons={getManagedPersons(selectedEntity.id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DepartmentDetails({ 
  entity, 
  childDepartments,
  persons,
  parentDepartment,
}: { 
  entity: Entity;
  childDepartments: Entity[];
  persons: Entity[];
  parentDepartment: Entity | undefined;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{entityTypeIcons.department}</span>
          <span 
            className="uppercase tracking-wider"
            style={{ 
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-fg-muted)',
            }}
          >
            department
          </span>
        </div>
        <h4 
          className="mb-1"
          style={{ 
            fontFamily: 'var(--font-primary)',
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--color-fg)',
          }}
        >
          {entity.name}
        </h4>
        <p 
          style={{ 
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--color-fg-muted)',
          }}
        >
          ID: {entity.id}
        </p>
      </div>
      
      {parentDepartment && (
        <div>
          <label 
            className="block mb-2 uppercase tracking-wider"
            style={{ 
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-fg-muted)',
            }}
          >
            Parent Department
          </label>
          <div 
            className="rounded-lg p-3 flex items-center gap-3"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            <span className="text-base">{entityTypeIcons.department}</span>
            <div className="flex-1 min-w-0">
              <div 
                className="truncate"
                style={{ 
                  fontFamily: 'var(--font-primary)',
                  fontSize: '13px',
                  color: 'var(--color-fg)',
                }}
              >
                {parentDepartment.name}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {entity.metadata && Object.keys(entity.metadata).length > 0 && (
        <div>
          <label 
            className="block mb-2 uppercase tracking-wider"
            style={{ 
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-fg-muted)',
            }}
          >
            Metadata
          </label>
          <div 
            className="rounded-lg p-3 space-y-2"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            {Object.entries(entity.metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between py-1">
                <span 
                  style={{ 
                    fontFamily: 'var(--font-primary)',
                    fontSize: '12px',
                    color: 'var(--color-fg-muted)',
                  }}
                >
                  {key}
                </span>
                <span 
                  style={{ 
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--color-fg)',
                  }}
                >
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {childDepartments.length > 0 && (
        <div>
          <label 
            className="block mb-2 uppercase tracking-wider"
            style={{ 
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-fg-muted)',
            }}
          >
            Sub-Departments ({childDepartments.length})
          </label>
          <div className="space-y-2">
            {childDepartments.map((dept) => (
              <div 
                key={dept.id}
                className="rounded-lg p-3 flex items-center gap-3"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <span className="text-base">{entityTypeIcons.department}</span>
                <div className="flex-1 min-w-0">
                  <div 
                    className="truncate"
                    style={{ 
                      fontFamily: 'var(--font-primary)',
                      fontSize: '13px',
                      color: 'var(--color-fg)',
                    }}
                  >
                    {dept.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {persons.length > 0 && (
        <div>
          <label 
            className="block mb-2 uppercase tracking-wider"
            style={{ 
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-fg-muted)',
            }}
          >
            Members ({persons.length})
          </label>
          <div className="space-y-2">
            {persons.map((person) => (
              <div 
                key={person.id}
                className="rounded-lg p-3 flex items-center gap-3"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <span className="text-base">{entityTypeIcons.person}</span>
                <div className="flex-1 min-w-0">
                  <div 
                    className="truncate"
                    style={{ 
                      fontFamily: 'var(--font-primary)',
                      fontSize: '13px',
                      color: 'var(--color-fg)',
                    }}
                  >
                    {person.name}
                  </div>
                  {person.metadata?.title != null && (
                    <div 
                      className="truncate"
                      style={{ 
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        color: 'var(--color-fg-muted)',
                      }}
                    >
                      {person.metadata.title as string}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PersonDetails({ 
  entity, 
  department,
  manager,
  managedPersons,
}: { 
  entity: Entity;
  department: Entity | undefined;
  manager: Entity | undefined;
  managedPersons: Entity[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{entityTypeIcons.person}</span>
          <span 
            className="uppercase tracking-wider"
            style={{ 
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-fg-muted)',
            }}
          >
            person
          </span>
        </div>
        <h4 
          className="mb-1"
          style={{ 
            fontFamily: 'var(--font-primary)',
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--color-fg)',
          }}
        >
          {entity.name}
        </h4>
        <p 
          style={{ 
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--color-fg-muted)',
          }}
        >
          ID: {entity.id}
        </p>
      </div>
      
      {department && (
        <div>
          <label 
            className="block mb-2 uppercase tracking-wider"
            style={{ 
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-fg-muted)',
            }}
          >
            Department
          </label>
          <div 
            className="rounded-lg p-3 flex items-center gap-3"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            <span className="text-base">{entityTypeIcons.department}</span>
            <div className="flex-1 min-w-0">
              <div 
                className="truncate"
                style={{ 
                  fontFamily: 'var(--font-primary)',
                  fontSize: '13px',
                  color: 'var(--color-fg)',
                }}
              >
                {department.name}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {manager && (
        <div>
          <label 
            className="block mb-2 uppercase tracking-wider"
            style={{ 
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-fg-muted)',
            }}
          >
            Reports To
          </label>
          <div 
            className="rounded-lg p-3 flex items-center gap-3"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            <span className="text-base">{entityTypeIcons.person}</span>
            <div className="flex-1 min-w-0">
              <div 
                className="truncate"
                style={{ 
                  fontFamily: 'var(--font-primary)',
                  fontSize: '13px',
                  color: 'var(--color-fg)',
                }}
              >
                {manager.name}
              </div>
              {manager.metadata?.title != null && (
                <div 
                  className="truncate"
                  style={{ 
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--color-fg-muted)',
                  }}
                >
                  {manager.metadata.title as string}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {entity.metadata && Object.keys(entity.metadata).length > 0 && (
        <div>
          <label 
            className="block mb-2 uppercase tracking-wider"
            style={{ 
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-fg-muted)',
            }}
          >
            Metadata
          </label>
          <div 
            className="rounded-lg p-3 space-y-2"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            {Object.entries(entity.metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between py-1">
                <span 
                  style={{ 
                    fontFamily: 'var(--font-primary)',
                    fontSize: '12px',
                    color: 'var(--color-fg-muted)',
                  }}
                >
                  {key}
                </span>
                <span 
                  style={{ 
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--color-fg)',
                  }}
                >
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {managedPersons.length > 0 && (
        <div>
          <label 
            className="block mb-2 uppercase tracking-wider"
            style={{ 
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--color-fg-muted)',
            }}
          >
            Direct Reports ({managedPersons.length})
          </label>
          <div className="space-y-2">
            {managedPersons.map((person) => (
              <div 
                key={person.id}
                className="rounded-lg p-3 flex items-center gap-3"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <span className="text-base">{entityTypeIcons.person}</span>
                <div className="flex-1 min-w-0">
                  <div 
                    className="truncate"
                    style={{ 
                      fontFamily: 'var(--font-primary)',
                      fontSize: '13px',
                      color: 'var(--color-fg)',
                    }}
                  >
                    {person.name}
                  </div>
                  {person.metadata?.title != null && (
                    <div 
                      className="truncate"
                      style={{ 
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        color: 'var(--color-fg-muted)',
                      }}
                    >
                      {person.metadata.title as string}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
