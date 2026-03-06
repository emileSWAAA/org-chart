import { useRef, useCallback, useState } from 'react';

interface FileUploadProps {
  onFileLoaded: (content: string, filename: string) => void;
  onError: (error: string) => void;
}

export function FileUpload({ onFileLoaded, onError }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const validExtensions = ['.json', '.yaml', '.yml'];
    const extension = '.' + file.name.toLowerCase().split('.').pop();
    
    if (!validExtensions.includes(extension)) {
      onError('Please upload a JSON or YAML file');
      return;
    }
    
    try {
      const content = await file.text();
      onFileLoaded(content, file.name);
    } catch {
      onError('Failed to read file');
    }
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileLoaded, onError]);
  
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    
    const file = event.dataTransfer.files?.[0];
    if (file) {
      const input = fileInputRef.current;
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }, []);
  
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);
  
  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);
  
  return (
    <div
      className="rounded-xl p-8 text-center cursor-pointer transition-all duration-150"
      style={{
        border: `2px dashed ${isDragging ? 'oklch(0.75 0.15 195)' : 'var(--color-secondary)'}`,
        backgroundColor: isDragging ? 'oklch(0.75 0.15 195 / 0.1)' : 'var(--color-bg-light)',
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = 'oklch(0.75 0.15 195)';
          e.currentTarget.style.backgroundColor = 'oklch(0.75 0.15 195 / 0.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = 'var(--color-secondary)';
          e.currentTarget.style.backgroundColor = 'var(--color-bg-light)';
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.yaml,.yml"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div className="text-4xl mb-4">📁</div>
      <h3 
        className="mb-2"
        style={{ 
          fontFamily: 'var(--font-primary)',
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--color-fg)',
        }}
      >
        Drop your manifest file here
      </h3>
      <p 
        className="mb-4"
        style={{ 
          fontFamily: 'var(--font-primary)',
          fontSize: '14px',
          color: 'var(--color-fg-muted)',
        }}
      >
        or click to browse
      </p>
      <p 
        style={{ 
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--color-fg-muted)',
        }}
      >
        Supports JSON and YAML formats
      </p>
    </div>
  );
}
