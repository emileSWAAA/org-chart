import { useState, useCallback, useEffect } from 'react';
import { FileUpload, OrganizationGraph } from './components';
import { parseManifest } from './manifestParser';
import type { Manifest } from './types';

// Sample manifest for demo purposes - Traditional Org Chart
const SAMPLE_MANIFEST = `name: Acme Corporation

entities:
  # Root Department
  - id: company
    type: department
    name: Acme Corporation
    metadata:
      founded: "2010"
      employees: 150

  # Level 1 Departments (report to company)
  - id: engineering
    type: department
    name: Engineering
    parentId: company
    metadata:
      headcount: 45
      budget: "$5M"
      
  - id: sales
    type: department
    name: Sales
    parentId: company
    metadata:
      headcount: 30
      quota: "$20M"
      
  - id: operations
    type: department
    name: Operations
    parentId: company
    metadata:
      headcount: 25

  # Level 2 Departments
  - id: frontend
    type: department
    name: Frontend Team
    parentId: engineering
    metadata:
      headcount: 15
      
  - id: backend
    type: department
    name: Backend Team
    parentId: engineering
    metadata:
      headcount: 20
      
  - id: sales_na
    type: department
    name: North America Sales
    parentId: sales
    metadata:
      region: "NA"
      
  - id: sales_eu
    type: department
    name: Europe Sales
    parentId: sales
    metadata:
      region: "EU"

  # Persons in Company (C-Suite)
  - id: ceo
    type: person
    name: Jane Doe
    parentId: company
    metadata:
      title: "CEO"
      email: jane.doe@acme.com

  # Persons in Engineering
  - id: cto
    type: person
    name: John Smith
    parentId: engineering
    metadata:
      title: "CTO"
      email: john.smith@acme.com
      
  - id: eng_lead
    type: person
    name: Alice Chen
    parentId: engineering
    managerId: cto
    metadata:
      title: "Engineering Lead"

  # Persons in Frontend
  - id: fe_lead
    type: person
    name: Bob Wilson
    parentId: frontend
    metadata:
      title: "Frontend Lead"
      
  - id: fe_dev1
    type: person
    name: Carol Davis
    parentId: frontend
    managerId: fe_lead
    metadata:
      title: "Senior Developer"
      
  - id: fe_dev2
    type: person
    name: Dan Brown
    parentId: frontend
    managerId: fe_lead
    metadata:
      title: "Developer"

  # Persons in Backend
  - id: be_lead
    type: person
    name: Eve Martinez
    parentId: backend
    metadata:
      title: "Backend Lead"
      
  - id: be_dev1
    type: person
    name: Frank Lee
    parentId: backend
    managerId: be_lead
    metadata:
      title: "Senior Developer"

  # Persons in Sales
  - id: vp_sales
    type: person
    name: Sarah Johnson
    parentId: sales
    metadata:
      title: "VP Sales"
      email: sarah.j@acme.com

  # Persons in NA Sales
  - id: sales_mgr_na
    type: person
    name: Mike Taylor
    parentId: sales_na
    metadata:
      title: "Sales Manager NA"
      
  - id: sales_rep1
    type: person
    name: Nancy White
    parentId: sales_na
    managerId: sales_mgr_na
    metadata:
      title: "Account Executive"

  # Persons in Operations
  - id: ops_dir
    type: person
    name: Oscar Green
    parentId: operations
    metadata:
      title: "Operations Director"
`;

function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestFilename, setManifestFilename] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const handleFileLoaded = useCallback((content: string, filename: string) => {
    try {
      const parsed = parseManifest(content, filename);
      setManifest(parsed);
      setManifestFilename(filename || 'manifest.yaml');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse manifest');
    }
  }, []);
  
  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);
  
  const handleLoadSample = useCallback(() => {
    try {
      const parsed = parseManifest(SAMPLE_MANIFEST, 'sample.yaml');
      setManifest(parsed);
      setManifestFilename('sample.yaml');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse sample manifest');
    }
  }, []);

  // Auto-load manifest when launched via CLI with --file or --yaml
  useEffect(() => {
    if (import.meta.env.VITE_AUTOLOAD === 'true') {
      fetch('/_autoload.yaml')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch autoload manifest');
          return res.text();
        })
        .then(content => {
          const parsed = parseManifest(content, 'autoload.yaml');
          setManifest(parsed);
          setManifestFilename('autoload.yaml');
        })
        .catch(e => {
          setError(e instanceof Error ? e.message : 'Failed to auto-load manifest');
        });
    }
  }, []);
  
  const handleClearManifest = useCallback(() => {
    setManifest(null);
    setManifestFilename('');
    setError(null);
  }, []);

  const handleUpdateManifest = useCallback((next: Manifest) => {
    setManifest(next);
  }, []);
  
  // Show graph if manifest is loaded
  if (manifest) {
    return (
      <OrganizationGraph 
        manifest={manifest} 
        manifestFilename={manifestFilename || 'manifest.yaml'}
        onUpdateManifest={handleUpdateManifest}
        onClearManifest={handleClearManifest}
      />
    );
  }
  
  // Show upload screen
  return (
    <div 
      className="w-full h-full flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="max-w-lg w-full mx-4">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">📊</div>
          <h1 
            className="mb-3"
            style={{ 
              fontFamily: 'var(--font-primary)',
              fontSize: '28px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--color-fg)',
            }}
          >
            Organization Graph
          </h1>
          <p 
            style={{ 
              fontFamily: 'var(--font-primary)',
              fontSize: '15px',
              color: 'var(--color-fg-muted)',
              lineHeight: 1.6,
            }}
          >
            Visualize organizational structures, hierarchies, and relationships from a simple manifest file
          </p>
        </div>
        
        {/* Error Display */}
        {error && (
          <div 
            className="mb-6 rounded-lg p-4"
            style={{
              backgroundColor: 'oklch(0.60 0.22 25 / 0.15)',
              border: '1px solid oklch(0.60 0.22 25 / 0.3)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span>⚠️</span>
              <span 
                style={{ 
                  fontFamily: 'var(--font-primary)',
                  fontWeight: 600,
                  color: '#d93a3a',
                }}
              >
                Error loading manifest
              </span>
            </div>
            <p 
              style={{ 
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: '#d93a3a',
              }}
            >
              {error}
            </p>
          </div>
        )}
        
        {/* File Upload */}
        <FileUpload 
          onFileLoaded={handleFileLoaded}
          onError={handleError}
        />
        
        {/* Sample Button */}
        <div className="mt-6 text-center">
          <button
            onClick={handleLoadSample}
            className="transition-hover"
            style={{
              fontFamily: 'var(--font-primary)',
              fontSize: '14px',
              color: 'oklch(0.75 0.15 195)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            Load sample organization →
          </button>
        </div>
        
        {/* Features */}
        <div className="mt-12 grid grid-cols-2 gap-4">
          {[
            { icon: '📊', title: 'Hierarchical Layout', desc: 'Auto-organized tree structure' },
            { icon: '🎨', title: 'Entity Styling', desc: 'Distinct looks for people and departments' },
            { icon: '🔍', title: 'Interactive', desc: 'Click to inspect details' },
            { icon: '📁', title: 'Local Files', desc: 'JSON & YAML support' },
          ].map(({ icon, title, desc }) => (
            <div 
              key={title}
              className="rounded-lg p-4"
              style={{
                backgroundColor: 'var(--color-bg-light)',
                border: '1px solid var(--color-secondary)',
              }}
            >
              <span className="text-2xl">{icon}</span>
              <h3 
                className="mt-2"
                style={{ 
                  fontFamily: 'var(--font-primary)',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--color-fg)',
                }}
              >
                {title}
              </h3>
              <p 
                style={{ 
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--color-fg-muted)',
                }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
