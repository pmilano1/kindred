'use client';

import { Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui';

interface TreeControlsProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export function TreeControls({
  isFullscreen,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: TreeControlsProps) {
  return (
    <div
      className="absolute bottom-4 right-4 z-40 flex gap-1 bg-[var(--card)] rounded-lg shadow-lg border border-[var(--border)] p-1"
      role="toolbar"
      aria-label="Tree view controls"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onZoomIn}
        title="Zoom in"
        aria-label="Zoom in"
        className="h-8 w-8 p-0"
      >
        <ZoomIn className="w-4 h-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onZoomOut}
        title="Zoom out"
        aria-label="Zoom out"
        className="h-8 w-8 p-0"
      >
        <ZoomOut className="w-4 h-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onResetZoom}
        title="Reset zoom"
        aria-label="Reset zoom"
        className="h-8 w-8 p-0"
      >
        <RotateCcw className="w-4 h-4" aria-hidden="true" />
      </Button>
      <div className="w-px bg-[var(--border)]" aria-hidden="true" />
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        className="h-8 w-8 p-0"
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Maximize2 className="w-4 h-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
