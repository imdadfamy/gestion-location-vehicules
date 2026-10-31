'use client';

import { useEffect, useImperativeHandle, useRef } from 'react';
import type SignaturePad from 'signature_pad';

export type SignatureHandle = {
  isEmpty: () => boolean;
  clear: () => void;
  toBlob: () => Promise<Blob>;
};

const HEIGHT = 180;

/**
 * Zone de signature manuscrite interne (souris, doigt ou stylet) — signature_pad,
 * mêmes réglages que l'application Angular. Le canevas suit la largeur disponible.
 */
export function SignatureField({ ref, label }: { ref: React.Ref<SignatureHandle>; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pad = useRef<SignaturePad | null>(null);

  useImperativeHandle(ref, () => ({
    isEmpty: () => !pad.current || pad.current.isEmpty(),
    clear: () => pad.current?.clear(),
    toBlob: async () => (await fetch(pad.current!.toDataURL('image/png'))).blob(),
  }));

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    const resize = () => {
      const width = element.getBoundingClientRect().width;
      if (!width || !pad.current) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      element.width = Math.floor(width * ratio);
      element.height = HEIGHT * ratio;
      element.getContext('2d')?.scale(ratio, ratio);
      pad.current.clear();
    };
    import('signature_pad').then(({ default: Pad }) => {
      if (disposed) return;
      pad.current = new Pad(element, { minWidth: 0.7, maxWidth: 2.2, penColor: '#102f38' });
      resize();
    });
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
      pad.current?.off();
      pad.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvas}
      aria-label={label}
      className="h-[180px] w-full touch-none rounded-lg border bg-white"
    />
  );
}
