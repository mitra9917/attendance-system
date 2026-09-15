import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import { fetchApi } from '../lib/api';
import './FaceEnrollment.css';

export function FaceEnrollment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [student, setStudent] = useState<any>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [isCapturing, setIsCapturing] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 3 captures

  // Load student details
  useEffect(() => {
    fetchApi(`/students/${id}`)
      .then(data => setStudent(data))
      .catch(err => {
        console.error(err);
        setStatus('Error loading student details.');
      });
  }, [id]);

  // Load models and start camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const init = async () => {
      try {
        setStatus('Loading face-api models...');
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setIsModelLoaded(true);
        setStatus('Models loaded. Starting camera...');
        
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              setStatus('Camera running. Position the face and click Capture.');
          };
        }
      } catch (err) {
        console.error(err);
        setStatus('Error during initialization. Permissions denied?');
      }
    };
    
    init();

    return () => {
      // Cleanup camera on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current || !isModelLoaded || !student) return;
    
    setIsCapturing(true);
    setStatus('Capturing sample 1...');
    setProgress(0);
    
    const embeddings: number[][] = [];
    const targetSamples = 3;
    
    try {
      for (let i = 0; i < targetSamples; i++) {
        // Add a slight delay to allow for natural micro-movements
        if (i > 0) {
          setStatus(`Capturing sample ${i + 1}... Please move head slightly.`);
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
        
        if (!detection) {
          throw new Error('No face detected during capture. Please ensure the face is clearly visible.');
        }
        
        // Convert Float32Array to standard array for JSON serialization
        embeddings.push(Array.from(detection.descriptor));
        setProgress(i + 1);
      }
      
      setStatus('Saving face templates...');
      
      await fetchApi(`/students/${id}/faces`, {
        method: 'POST',
        body: JSON.stringify({ embeddings })
      });
      
      setStatus('Face enrollment successful!');
      setTimeout(() => navigate('/register'), 2000);
      
    } catch (err: any) {
      console.error(err);
      setStatus(err.message || 'Error capturing face.');
      setIsCapturing(false);
      setProgress(0);
    }
  };

  return (
    <div className="face-enroll-page">
      <div className="page-header">
        <h1>Face Enrollment</h1>
        {student && <p>Enrolling: <strong>{student.name} ({student.registrationNumber})</strong></p>}
      </div>

      <div className="page-card face-enroll-card">
        <div className="face-enroll-status">
          <strong>Status:</strong> {status}
        </div>

        <div className="face-enroll-video-wrap">
          <video
            ref={videoRef}
            muted
            playsInline
            className="face-enroll-video"
          />
        </div>

        {isCapturing && (
          <p className="face-enroll-progress">Capturing sample {progress} of 3…</p>
        )}

        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          The system will automatically capture 3 samples. Please move your head slightly between captures.
        </p>

        <div className="face-enroll-actions">
          <button
            className="btn btn-primary"
            onClick={handleCapture}
            disabled={!isModelLoaded || isCapturing || !student}
          >
            {isCapturing ? `Capturing (${progress}/3)...` : 'Start Capture'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/register')}
            disabled={isCapturing}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
