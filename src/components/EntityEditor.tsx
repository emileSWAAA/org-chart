import { useMemo, useState } from 'react';
import { X, Save, AlertTriangle, ChevronDown, Trash2 } from 'lucide-react';
import type { Entity, Manifest, Relationship, RelationshipType } from '../types';

interface EntityEditorProps {
  open: boolean;
  mode: 'add' | 'edit';
  manifest: Manifest;
  defaultType: Entity['type'];
  initialEntity: Entity | null;
  onCancel: () => void;
  onSave: (entity: Entity, relationships?: Relationship[]) => void;
}

const COLOR_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '#2f855a', label: 'Teal' },
  { value: '#c05621', label: 'Amber' },
  { value: '#3182ce', label: 'Blue' },
  { value: '#805ad5', label: 'Purple' },
  { value: '#dd6b20', label: 'Orange' },
  { value: '#38a169', label: 'Green' },
  { value: '#d53f8c', label: 'Pink' },
  { value: '#718096', label: 'Gray' },
];

export function EntityEditor({
  open,
  mode,
  manifest,
  defaultType,
  initialEntity,
  onCancel,
  onSave,
}: EntityEditorProps) {
  const initType = mode === 'edit' && initialEntity ? initialEntity.type : defaultType;
  const initId = mode === 'edit' && initialEntity ? initialEntity.id : '';
  const initName = mode === 'edit' && initialEntity ? initialEntity.name : '';
  const initColor = mode === 'edit' && initialEntity ? (initialEntity.color || '') : '';
  const initParentId = mode === 'edit' && initialEntity ? (initialEntity.parentId || '') : '';
  const initManagerId = mode === 'edit' && initialEntity ? (initialEntity.managerId || '') : '';
  const initMetadata = (() => {
    if (mode === 'edit' && initialEntity?.metadata && typeof initialEntity.metadata === 'object') {
      const entries = Object.entries(initialEntity.metadata).map(([k, v]) => ({ key: k, value: String(v ?? '') }));
      return entries.length > 0 ? entries : [{ key: '', value: '' }];
    }
    return [{ key: '', value: '' }];
  })();
  const initRelationships = mode === 'edit' && initialEntity
    ? (manifest.relationships || []).filter(r => r.from === initialEntity.id)
    : [];

  const [type, setType] = useState<Entity['type']>(initType);
  const [id, setId] = useState(initId);
  const [name, setName] = useState(initName);
  const [color, setColor] = useState<string>(initColor);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [parentId, setParentId] = useState<string>(initParentId);
  const [managerId, setManagerId] = useState<string>(initManagerId);
  const [metadataRows, setMetadataRows] = useState<Array<{ key: string; value: string }>>(initMetadata);
  const [relationships, setRelationships] = useState<Relationship[]>(initRelationships);
  const [error, setError] = useState<string>('');

  const departments = useMemo(() => manifest.entities.filter(e => e.type === 'department'), [manifest.entities]);
  const persons = useMemo(() => manifest.entities.filter(e => e.type === 'person'), [manifest.entities]);

  const availableManagers = useMemo(() => {
    if (type !== 'person') return persons;
    if (!parentId) return persons;
    return persons.filter(p => p.parentId === parentId);
  }, [persons, parentId, type]);

  const validate = (draft: Entity): string | null => {
    if (!draft.id.trim()) return 'ID is required.';
    if (!draft.name.trim()) return 'Name is required.';

    if (draft.color) {
      const hexPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
      if (!hexPattern.test(draft.color)) return 'Color must be hex like #RRGGBB or #RGB.';
    }

    if (mode === 'add' && manifest.entities.some(e => e.id === draft.id)) {
      return 'ID must be unique.';
    }

    if (draft.type === 'department' && draft.parentId) {
      const parent = departments.find(d => d.id === draft.parentId);
      if (!parent) return 'Parent department does not exist.';
    }

    if (draft.type === 'person') {
      if (!draft.parentId) return 'Department is required for a person.';
      const dept = departments.find(d => d.id === draft.parentId);
      if (!dept) return 'Selected department does not exist.';
      if (draft.managerId) {
        const mgr = persons.find(p => p.id === draft.managerId);
        if (!mgr) return 'Manager does not exist.';
      }
    }

    return null;
  };

  const handleSave = () => {
    const normalizedRows = metadataRows
      .map(({ key, value }) => ({ key: key.trim(), value: value.trim() }))
      .filter(({ key }) => key.length > 0);

    const duplicateKey = normalizedRows.find((row, idx) => normalizedRows.findIndex(r => r.key === row.key) !== idx);
    if (duplicateKey) {
      setError(`Duplicate metadata key: "${duplicateKey.key}"`);
      return;
    }

    const metadata = normalizedRows.length > 0
      ? normalizedRows.reduce<Record<string, string>>((acc, { key, value }) => {
          acc[key] = value;
          return acc;
        }, {})
      : undefined;

    const draft: Entity = {
      id: id.trim(),
      name: name.trim(),
      type,
      color: color.trim() ? color.trim() : undefined,
      parentId: parentId || undefined,
      managerId: managerId || undefined,
      metadata,
    };

    const validationError = validate(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    onSave(draft, relationships);
  };
  
  const addRelationship = () => {
    setRelationships([...relationships, { 
      from: id || initialEntity?.id || '', 
      to: '', 
      type: 'influences' as RelationshipType 
    }]);
  };
  
  const removeRelationship = (index: number) => {
    setRelationships(relationships.filter((_, i) => i !== index));
  };
  
  const updateRelationship = (index: number, field: keyof Relationship, value: string) => {
    const updated = [...relationships];
    updated[index] = { ...updated[index], [field]: value };
    setRelationships(updated);
  };

  return (
    <div
      className="absolute top-4 right-4 bottom-4 w-96 z-50 transition-panel"
      style={{
        transform: open ? 'translateX(0)' : 'translateX(calc(100% + 16px))',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
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
          <div>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                textTransform: 'uppercase',
                color: 'var(--color-fg-muted)',
                letterSpacing: '0.08em',
              }}
            >
              {mode === 'add' ? 'New Entity' : 'Edit Entity'}
            </p>
            <h3
              className="font-semibold"
              style={{ fontFamily: 'var(--font-primary)', fontSize: '16px', color: 'var(--color-fg)' }}
            >
              {mode === 'add' ? 'Create' : 'Update'} {type === 'department' ? 'Department' : 'Person'}
            </h3>
          </div>
          <button
            onClick={onCancel}
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
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div
              className="rounded-lg px-3 py-2 flex items-start gap-2"
              style={{ backgroundColor: 'oklch(0.60 0.22 25 / 0.12)', border: '1px solid oklch(0.60 0.22 25 / 0.4)' }}
            >
              <AlertTriangle size={16} style={{ color: '#d93a3a', marginTop: 2 }} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#d93a3a' }}>{error}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg-muted)' }}>
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Entity['type'])}
                disabled={mode === 'edit'}
                className="w-full px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-secondary)',
                  color: 'var(--color-fg)',
                  fontFamily: 'var(--font-primary)',
                  fontSize: '13px',
                }}
              >
                <option value="department">Department</option>
                <option value="person">Person</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg-muted)' }}>
                Color (optional)
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setColorMenuOpen((v) => !v)}
                    className="w-full px-3 py-2 rounded-lg border flex items-center justify-between gap-3"
                    style={{
                      backgroundColor: 'var(--color-bg)',
                      borderColor: 'var(--color-secondary)',
                      color: 'var(--color-fg)',
                      fontFamily: 'var(--font-primary)',
                      fontSize: '13px',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-10 h-9 rounded-lg border"
                        style={{
                          borderColor: 'var(--color-secondary)',
                          backgroundColor: color.trim() ? color : 'transparent',
                        }}
                        title={color.trim() ? color : 'Default for type'}
                      />
                      <span style={{ color: 'var(--color-fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {color.trim() ? 'Custom color selected' : 'Default for type'}
                      </span>
                    </div>
                    <ChevronDown size={14} />
                  </button>

                  {colorMenuOpen && (
                    <div
                      className="absolute z-10 mt-2 w-full rounded-lg border shadow-lg"
                      style={{ backgroundColor: 'var(--color-bg-light)', borderColor: 'var(--color-secondary)' }}
                    >
                      <button
                        type="button"
                        onClick={() => { setColor(''); setColorMenuOpen(false); }}
                        className="w-full px-3 py-2 flex items-center gap-3 hover:bg-(--color-secondary)"
                        style={{
                          color: 'var(--color-fg)',
                          fontFamily: 'var(--font-primary)',
                          fontSize: '13px',
                        }}
                      >
                        <span
                          className="w-8 h-6 rounded border"
                          style={{ borderColor: 'var(--color-secondary)', backgroundColor: 'transparent' }}
                          title="Default"
                        />
                        <span style={{ color: 'var(--color-fg-muted)' }}>Default for type</span>
                      </button>
                      {COLOR_OPTIONS.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => { setColor(value); setColorMenuOpen(false); }}
                          className="w-full px-3 py-2 flex items-center gap-3 hover:bg-(--color-secondary)"
                          style={{
                            color: 'var(--color-fg)',
                            fontFamily: 'var(--font-primary)',
                            fontSize: '13px',
                          }}
                        >
                          <span
                            className="w-8 h-6 rounded border"
                            style={{ borderColor: 'var(--color-secondary)', backgroundColor: value }}
                            title={label}
                          />
                          <span style={{ color: 'var(--color-fg-muted)' }}>{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-fg-muted)' }}>
                  Choose a swatch; Default inherits the type color.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg-muted)' }}>
              ID
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              disabled={mode === 'edit'}
              className="w-full px-3 py-2 rounded-lg"
              style={{
                backgroundColor: mode === 'edit' ? 'var(--color-secondary)' : 'var(--color-bg)',
                border: '1px solid var(--color-secondary)',
                color: 'var(--color-fg)',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
              }}
              placeholder="unique-id"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg-muted)' }}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg"
              style={{
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-secondary)',
                color: 'var(--color-fg)',
                fontFamily: 'var(--font-primary)',
                fontSize: '13px',
              }}
              placeholder="Display name"
            />
          </div>

          {type === 'department' && (
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg-muted)' }}>
                Parent Department (optional)
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-secondary)',
                  color: 'var(--color-fg)',
                  fontFamily: 'var(--font-primary)',
                  fontSize: '13px',
                }}
              >
                <option value="">No parent</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          )}

          {type === 'person' && (
            <>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg-muted)' }}>
                  Department
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-secondary)',
                    color: 'var(--color-fg)',
                    fontFamily: 'var(--font-primary)',
                    fontSize: '13px',
                  }}
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg-muted)' }}>
                  Manager (optional)
                </label>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-secondary)',
                    color: 'var(--color-fg)',
                    fontFamily: 'var(--font-primary)',
                    fontSize: '13px',
                  }}
                >
                  <option value="">No manager</option>
                  {availableManagers.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Relationships Section */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg-muted)' }}>
              Relationships (optional)
            </label>
            <div className="space-y-3 rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-secondary)' }}>
              {relationships.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-fg-muted)', textAlign: 'center', padding: '8px' }}>
                  No relationships yet
                </p>
              ) : (
                <div className="space-y-2">
                  {relationships.map((rel, index) => (
                    <div key={index} className="space-y-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-light)', border: '1px solid var(--color-secondary)' }}>
                      <div className="flex gap-2">
                        <select
                          value={rel.type}
                          onChange={(e) => updateRelationship(index, 'type', e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded text-xs"
                          style={{
                            backgroundColor: 'var(--color-bg)',
                            border: '1px solid var(--color-secondary)',
                            color: 'var(--color-fg)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          <option value="manages">Manages</option>
                          <option value="influences">Influences</option>
                          <option value="depends_on">Depends On</option>
                          <option value="collaborates_with">Collaborates With</option>
                          <option value="reports_to">Reports To</option>
                        </select>
                        <select
                          value={rel.to}
                          onChange={(e) => updateRelationship(index, 'to', e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded text-xs"
                          style={{
                            backgroundColor: 'var(--color-bg)',
                            border: '1px solid var(--color-secondary)',
                            color: 'var(--color-fg)',
                            fontFamily: 'var(--font-primary)',
                          }}
                        >
                          <option value="">Select target</option>
                          {manifest.entities.filter(e => e.id !== (id || initialEntity?.id)).map((entity) => (
                            <option key={entity.id} value={entity.id}>{entity.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeRelationship(index)}
                          className="px-2 rounded"
                          style={{
                            backgroundColor: 'var(--color-bg)',
                            border: '1px solid var(--color-secondary)',
                            color: 'var(--color-fg-muted)',
                          }}
                          title="Remove relationship"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={rel.note || ''}
                        onChange={(e) => updateRelationship(index, 'note', e.target.value)}
                        placeholder="Note (optional)"
                        className="w-full px-2 py-1.5 rounded text-xs"
                        style={{
                          backgroundColor: 'var(--color-bg)',
                          border: '1px solid var(--color-secondary)',
                          color: 'var(--color-fg)',
                          fontFamily: 'var(--font-primary)',
                        }}
                      />
                      <select
                        value={rel.strength || ''}
                        onChange={(e) => updateRelationship(index, 'strength', e.target.value)}
                        className="w-full px-2 py-1.5 rounded text-xs"
                        style={{
                          backgroundColor: 'var(--color-bg)',
                          border: '1px solid var(--color-secondary)',
                          color: 'var(--color-fg)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        <option value="">Strength (optional)</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={addRelationship}
                className="w-full px-3 py-2 rounded-lg text-xs"
                style={{
                  backgroundColor: 'var(--color-secondary)',
                  border: '1px solid var(--color-secondary)',
                  color: 'var(--color-fg)',
                  fontFamily: 'var(--font-primary)',
                  fontWeight: 600,
                }}
              >
                + Add Relationship
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-fg-muted)' }}>
              Metadata (optional)
            </label>
            <div className="space-y-3 rounded-lg p-3" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-secondary)' }}>
              <div className="space-y-2">
                {metadataRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={row.key}
                      onChange={(e) => {
                        const next = [...metadataRows];
                        next[index] = { ...next[index], key: e.target.value };
                        setMetadataRows(next);
                      }}
                      placeholder="Key"
                      className="col-span-5 px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: 'var(--color-bg-light)',
                        border: '1px solid var(--color-secondary)',
                        color: 'var(--color-fg)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                      }}
                    />
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) => {
                        const next = [...metadataRows];
                        next[index] = { ...next[index], value: e.target.value };
                        setMetadataRows(next);
                      }}
                      placeholder="Value"
                      className="col-span-6 px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: 'var(--color-bg-light)',
                        border: '1px solid var(--color-secondary)',
                        color: 'var(--color-fg)',
                        fontFamily: 'var(--font-primary)',
                        fontSize: '12px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (metadataRows.length === 1) {
                          setMetadataRows([{ key: '', value: '' }]);
                          return;
                        }
                        setMetadataRows(metadataRows.filter((_, i) => i !== index));
                      }}
                      className="col-span-1 h-full flex items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: 'var(--color-bg-light)',
                        border: '1px solid var(--color-secondary)',
                        color: 'var(--color-fg-muted)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '14px',
                      }}
                      title="Remove row"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMetadataRows([...metadataRows, { key: '', value: '' }])}
                  className="px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: 'var(--color-secondary)',
                    border: '1px solid var(--color-secondary)',
                    color: 'var(--color-fg)',
                    fontFamily: 'var(--font-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  + Add row
                </button>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-fg-muted)' }}>
                  Leave blank rows out; keys must be unique.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--color-secondary)' }}
        >
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-2"
            style={{
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-secondary)',
              color: 'var(--color-fg-muted)',
              fontFamily: 'var(--font-primary)',
              fontSize: '13px',
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            className="rounded-lg px-4 py-2 flex items-center gap-2"
            style={{
              backgroundColor: 'var(--color-accent)',
              border: '1px solid var(--color-secondary)',
              color: 'var(--color-bg)',
              fontFamily: 'var(--font-primary)',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <Save size={14} />
            {mode === 'add' ? 'Create' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
