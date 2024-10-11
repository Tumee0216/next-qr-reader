import React = require('react');
import { useRef, useEffect, useState, useCallback } from 'react';
import jsQR from 'jsqr';

interface ReaderProps {
  onResult: (result: string) => void;
  constraints?: MediaTrackConstraints;
  className?: string;
  scanInterval?: number;
  onError?: (error: Error) => void;
}

const Reader: React.FC<ReaderProps> = ({
  onResult,
  constraints = { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
  className = '',
  scanInterval = 300,
  onError
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const lastResultRef = useRef<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err) {
      console.error('Error accessing the camera:', err);
      onError?.(err instanceof Error ? err : new Error('Failed to access camera'));
    }
  }, [constraints, onError]);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsScanning(false);
  }, []);

  useEffect(() => {
    startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  const scanQRCode = useCallback((timestamp: number) => {
    if (!isScanning || !videoRef.current || !canvasRef.current) {
      requestRef.current = requestAnimationFrame(scanQRCode);
      return;
    }

    if (previousTimeRef.current !== undefined) {
      const deltaTime = timestamp - previousTimeRef.current;
      
      if (deltaTime < scanInterval) {
        requestRef.current = requestAnimationFrame(scanQRCode);
        return;
      }
    }

    previousTimeRef.current = timestamp;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const scale = 0.6;
    const scaledWidth = video.videoWidth * scale;
    const scaledHeight = video.videoHeight * scale;

    if (context && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data !== lastResultRef.current) {
        lastResultRef.current = code.data;
        onResult(code.data);
      }
    }

    requestRef.current = requestAnimationFrame(scanQRCode);
  }, [isScanning, onResult, scanInterval]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(scanQRCode);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [scanQRCode]);

  return (
    <div className={`relative ${className}`}>
      <video 
        ref={videoRef} 
        className="w-full h-auto" 
        playsInline 
        muted
      />
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full opacity-0 pointer-events-none"
      />
    </div>
  );
};

export default Reader;