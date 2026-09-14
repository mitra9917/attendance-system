import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

export default function CVPoc() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [referenceDescriptor, setReferenceDescriptor] = useState<Float32Array | null>(null);
  const [matchResult, setMatchResult] = useState<string>('');

  useEffect(() => {
    const loadModels = async () => {
      try {
        setStatus('Loading face-api models...');
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setIsModelLoaded(true);
        setStatus('Models loaded. Please start the camera.');
      } catch (err) {
        console.error(err);
        setStatus('Error loading models.');
      }
    };
    loadModels();
  }, []);

  const startCamera = async () => {
    try {
      setStatus('Starting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setStatus('Camera running.');
        };
      }
    } catch (err) {
      console.error(err);
      setStatus('Error starting camera. Permissions denied?');
    }
  };

  const captureReference = async () => {
    if (!videoRef.current || !isModelLoaded) return;
    setStatus('Capturing reference face...');
    const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
    
    if (detection) {
      setReferenceDescriptor(detection.descriptor);
      setStatus('Reference face captured successfully!');
    } else {
      setStatus('No face detected. Please try again.');
    }
  };

  const startMatching = async () => {
    if (!videoRef.current || !isModelLoaded || !referenceDescriptor) {
      setStatus('Capture a reference face first!');
      return;
    }

    setStatus('Matching...');
    const matchLoop = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

      const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
      
      if (canvasRef.current) {
        const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
        faceapi.matchDimensions(canvasRef.current, displaySize);
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, displaySize.width, displaySize.height);

        if (detection) {
          const resizedDetection = faceapi.resizeResults(detection, displaySize);
          faceapi.draw.drawDetections(canvasRef.current, resizedDetection);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetection);

          // Calculate Euclidean distance
          const distance = faceapi.euclideanDistance(referenceDescriptor, detection.descriptor);
          
          let resultText = `Distance: ${distance.toFixed(2)}`;
          if (distance < 0.4) {
            resultText += ' (HIGH CONFIDENCE - SAME PERSON)';
          } else if (distance < 0.5) {
            resultText += ' (UNCERTAIN)';
          } else {
            resultText += ' (NO MATCH - DIFFERENT PERSON)';
          }
          
          setMatchResult(resultText);
          
          const drawBox = new faceapi.draw.DrawTextField(
             [resultText],
             resizedDetection.detection.box.bottomLeft
          );
          drawBox.draw(canvasRef.current);
        } else {
          setMatchResult('No face detected.');
        }
      }

      requestAnimationFrame(matchLoop);
    };

    matchLoop();
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Phase 4: CV Proof of Concept</h1>
      
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
        <strong>Status:</strong> {status} <br/>
        <strong>Match Result:</strong> {matchResult}
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={startCamera} disabled={!isModelLoaded}>Start Camera</button>
        <button onClick={captureReference} disabled={!isModelLoaded}>Capture Reference</button>
        <button onClick={startMatching} disabled={!referenceDescriptor}>Start Continuous Matching</button>
      </div>

      <div style={{ position: 'relative' }}>
        <video 
          ref={videoRef} 
          style={{ position: 'absolute', top: 0, left: 0 }} 
          muted 
          playsInline
        />
        <canvas 
          ref={canvasRef} 
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}
        />
      </div>
    </div>
  );
}
