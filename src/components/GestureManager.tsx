import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Hands, Results, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

type GestureInitStage = 'permission' | 'mediapipe-load' | 'camera-start' | 'frame-send' | 'results-timeout' | 'unknown';

export interface GestureInitError {
  stage: GestureInitStage;
  title: string;
  message: string;
  detail: string;
}

interface GestureManagerProps {
  onGesture: (type: 'swipe' | 'clench' | 'open' | 'swipeLeft' | 'swipeRight', value: number) => void;
  onSwipeUpdate?: (offset: number) => void;
  onHandsUpdate?: (hands: any[]) => void;
  onError?: (error: GestureInitError) => void;
  debug?: boolean;
}

let globalHandsInstance: Hands | null = null;
let globalCameraInstance: Camera | null = null;

export const GestureManager: React.FC<GestureManagerProps> = ({ onGesture, onSwipeUpdate, onHandsUpdate, onError, debug = false }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const isLoadedRef = useRef(false);
  const hasReportedErrorRef = useRef(false);
  const initTimeoutRef = useRef<number | null>(null);

  const reportError = useCallback((error: GestureInitError, rawError?: unknown) => {
    if (hasReportedErrorRef.current) return;
    hasReportedErrorRef.current = true;
    console.error(`[GestureManager:${error.stage}] ${error.title} - ${error.message}`, rawError ?? error.detail);
    onError?.(error);
  }, [onError]);

  // Tracking state for swipe
  const lastX = useRef<number | null>(null);
  const swipeAccumulator = useRef(0);

  const onResults = useCallback((results: Results) => {
    try {
      if (!canvasRef.current) return;
      const canvasCtx = canvasRef.current.getContext('2d');
      if (!canvasCtx) return;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (!isLoadedRef.current) {
        isLoadedRef.current = true;
        setIsLoaded(true);
        if (initTimeoutRef.current) {
          window.clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = null;
        }
        console.info('[GestureManager] MediaPipe results received, initialization complete');
      }

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        if (onHandsUpdate) {
          onHandsUpdate(results.multiHandLandmarks);
        }

        const landmarks = results.multiHandLandmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        const distance = Math.sqrt(
          Math.pow(thumbTip.x - indexTip.x, 2) +
          Math.pow(thumbTip.y - indexTip.y, 2)
        );

        if (distance < 0.05) {
          onGesture('clench', 1 - (distance / 0.05));
        } else if (distance > 0.15) {
          onGesture('open', Math.min((distance - 0.15) / 0.2, 1));
        } else {
          onGesture('clench', 0);
        }

        if (debug) {
          canvasCtx.fillStyle = '#00FF00';
          results.multiHandLandmarks.forEach(hand => {
            hand.forEach((point) => {
              canvasCtx.beginPath();
              canvasCtx.arc((1 - point.x) * canvasRef.current!.width, point.y * canvasRef.current!.height, 3, 0, 2 * Math.PI);
              canvasCtx.fill();
            });
          });
        }
      } else {
        if (onHandsUpdate) {
          onHandsUpdate([]);
        }
        onGesture('clench', 0);
      }
      canvasCtx.restore();
    } catch (error) {
      reportError({
        stage: 'unknown',
        title: '手势结果处理失败',
        message: '摄像头已启动，但结果处理阶段发生错误。',
        detail: error instanceof Error ? error.message : String(error),
      }, error);
    }
  }, [onGesture, onHandsUpdate, debug, reportError]);

  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  const onResultsRef = useRef(onResults);
  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  useEffect(() => {
    console.info('[GestureManager] Initializing MediaPipe hands');
    try {
      if (!globalHandsInstance) {
        globalHandsInstance = new Hands({
          locateFile: (file) => `/mediapipe/hands/${file}`,
        });

        globalHandsInstance.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }

      globalHandsInstance.onResults((results) => {
        onResultsRef.current(results);
      });

      handsRef.current = globalHandsInstance;
    } catch (error) {
      reportError({
        stage: 'mediapipe-load',
        title: '手势识别模块初始化失败',
        message: '未能加载手势识别所需资源。',
        detail: error instanceof Error ? error.message : String(error),
      }, error);
    }

    initTimeoutRef.current = window.setTimeout(() => {
      if (!isLoadedRef.current) {
        reportError({
          stage: 'results-timeout',
          title: '摄像头初始化超时',
          message: '已等待较长时间，但仍未收到手势识别结果。',
          detail: `video=${Boolean(webcamRef.current?.video)} hands=${Boolean(handsRef.current)} camera=${Boolean(cameraRef.current)}`,
        });
      }
    }, 8000);

    return () => {
      if (initTimeoutRef.current) {
        window.clearTimeout(initTimeoutRef.current);
      }
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [reportError]);

  const handleUserMedia = useCallback(() => {
    console.info('[GestureManager] Webcam stream acquired');
    if (!webcamRef.current?.video) {
      reportError({
        stage: 'camera-start',
        title: '摄像头视频流不可用',
        message: '应用已尝试访问摄像头，但视频对象未就绪。',
        detail: 'webcamRef.current.video is null',
      });
      return;
    }

    try {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current?.video && handsRef.current) {
            try {
              await handsRef.current.send({ image: webcamRef.current.video });
            } catch (error) {
              reportError({
                stage: 'frame-send',
                title: '手势识别处理失败',
                message: '摄像头画面已采集，但识别处理过程中出错。',
                detail: error instanceof Error ? error.message : String(error),
              }, error);
            }
          }
        },
        width: 640,
        height: 480,
      });

      cameraRef.current = camera;
      globalCameraInstance = camera;
      console.info('[GestureManager] Starting camera processing loop');
      const startResult = camera.start();
      Promise.resolve(startResult).catch((error) => {
        reportError({
          stage: 'camera-start',
          title: '摄像头处理管线启动失败',
          message: '应用已拿到摄像头流，但未能启动图像处理。',
          detail: error instanceof Error ? error.message : String(error),
        }, error);
      });
    } catch (error) {
      reportError({
        stage: 'camera-start',
        title: '摄像头初始化失败',
        message: '应用未能启动摄像头处理管线。',
        detail: error instanceof Error ? error.message : String(error),
      }, error);
    }
  }, [reportError]);

  const handleUserMediaError = useCallback((error: string | DOMException) => {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[GestureManager] Webcam access failed', error);
    reportError({
      stage: 'permission',
      title: '摄像头访问失败',
      message: '请检查 macOS 系统设置中的摄像头权限，或确认设备未被其他程序占用。',
      detail,
    }, error);
  }, [reportError]);

  return (
    <div className="fixed bottom-4 right-4 w-48 h-36 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-50 bg-black/20 backdrop-blur-md">
      <Webcam
        ref={webcamRef}
        className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale"
        mirrored
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{ width: 640, height: 480, facingMode: "user" }}
        disablePictureInPicture={true}
        forceScreenshotSourceSize={false}
        imageSmoothing={true}
        onUserMedia={handleUserMedia}
        onUserMediaError={handleUserMediaError}
        screenshotQuality={0.92}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10"
        width={640}
        height={480}
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/50 font-mono uppercase tracking-widest">
          Initializing...
        </div>
      )}
    </div>
  );
};
