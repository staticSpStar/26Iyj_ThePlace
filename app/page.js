'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { useSession, signIn, signOut } from "next-auth/react";

const PALETTE = [
  '#FFFFFF', '#E4E4E4', '#888888', '#222222', '#000000',
  '#FFA7D1', '#E50000', '#E59500', '#A06A42', '#E5D900',
  '#94E044', '#02BE01', '#00D3DD', '#0083C7', '#0000EA',
  '#CF6EE4', '#820080', '#FF3904', '#FFB381', '#FFD635'
];

const ADMIN_EMAILS = ['mainforwoo@sasa.hs.kr', 'mojin81@sasa.hs.kr']; // Add your admins here

export default function Home() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.email && ADMIN_EMAILS.includes(session.user.email);

  const [showModal, setShowModal] = useState(false);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const dataCanvasRef = useRef(null);
  const bgImageRef = useRef(null);
  const imageSizeRef = useRef({ width: 1000, height: 1000 });

  const [color, setColorState] = useState(PALETTE[6]);
  const [isPaintMode, setIsPaintModeState] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const [objects, setObjects] = useState([]);
  const [pendingPixels, setPendingPixels] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [floor, setFloor] = useState(1);
  const [isFading, setIsFading] = useState(false);

  const [leaderboardType, setLeaderboardType] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState("personalPixelRanking");
  const [animateBars, setAnimateBars] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);

  const colorRef = useRef('#ff0000');
  const isPaintModeRef = useRef(false);
  const hoverPixelRef = useRef(null);
  const floorRef = useRef(1);
  const paintStartedAtRef = useRef(null);

  const objectsRef = useRef([]);
  const pendingPixelsRef = useRef([]);
  const selectedObjectIdRef = useRef(null);
  const pendingMoveTargetRef = useRef(null);

  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const draggedRef = useRef(false);

  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { floorRef.current = floor; }, [floor]);

  const fetchObjects = useCallback(async () => {
    try {
      const res = await fetch(`/api/paint?floor=${floorRef.current}`);
      const json = await res.json();
      if (json.success) {
        setObjects(json.data);
      }
    } catch(e) {}
  }, []);

  const handleFloorChange = useCallback((newFloor) => {
    if (newFloor < 1 || newFloor > 5 || newFloor === floorRef.current) return;

    setIsFading(true);

    setTimeout(() => {
      setFloor(newFloor);
      floorRef.current = newFloor;
      setPendingPixels([]);
      pendingPixelsRef.current = [];
      setSelectedObjectId(null);
      selectedObjectIdRef.current = null;
      fetchObjects().then(() => {
        setIsFading(false);
      });
    }, 300); // 300ms fade duration
  }, [fetchObjects]);



  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'q' || e.key === 'Q') {
        handleFloorChange(floorRef.current - 1);
      } else if (e.key === 'e' || e.key === 'E') {
        handleFloorChange(floorRef.current + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFloorChange]);

  useEffect(() => {
    fetchObjects();
    const interval = setInterval(fetchObjects, 5000);
    return () => clearInterval(interval);
  }, [fetchObjects]);

  useEffect(() => {
    if (session && !localStorage.getItem('firstLoginCheck')) {
      setShowModal(true);
      localStorage.setItem('firstLoginCheck', 'true');
    }
  }, [session]);

  const clampTransform = useCallback((nx, ny, ns) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: nx, y: ny, scale: ns };

    const { width, height } = imageSizeRef.current;
    const minScale = Math.max(canvas.width / width, canvas.height / height);
    const scale = Math.max(minScale, Math.min(ns, 50));

    // Calculate bounds based on the *actual* scale being applied
    const minX = canvas.width - width * scale;
    const maxX = 0;
    const minY = canvas.height - height * scale;
    const maxY = 0;

    const x = Math.min(Math.max(nx, minX), maxX);
    const y = Math.min(Math.max(ny, minY), maxY);

    return { x, y, scale };
  }, []);

  const resetTransformToImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = imageSizeRef.current;

    const minScale = Math.max(
        canvas.width / width,
        canvas.height / height
    );



    const initScale = minScale;

    const initX = (canvas.width - width * initScale) / 2;
    const initY = (canvas.height - height * initScale) / 2;

    transformRef.current = clampTransform(initX, initY, initScale);
  }, [clampTransform]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dataCanvasRef.current || !bgImageRef.current) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { x, y, scale } = transformRef.current;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const { width, height } = imageSizeRef.current;

    // Draw the background image
    ctx.drawImage(bgImageRef.current, 0, 0, width, height);

    // Draw the painted pixels
    ctx.drawImage(dataCanvasRef.current, 0, 0);

    // Draw pending pixels
    pendingPixelsRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 1, 1);
    });

    // Draw selected highlight
    if (selectedObjectIdRef.current) {
      const obj = objectsRef.current.find(o => o._id === selectedObjectIdRef.current);
      if (obj) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        obj.pixels.forEach(p => {
          ctx.fillRect(p.x, p.y, 1, 1);
        });

        ctx.strokeStyle = 'white';
        const prevLineWidth = ctx.lineWidth;
        ctx.lineWidth = 2 / scale;
        ctx.beginPath();
        obj.pixels.forEach(p => {
          ctx.rect(p.x, p.y, 1, 1);
        });
        ctx.stroke();
        ctx.lineWidth = prevLineWidth;
      }
    }

    if (isPaintModeRef.current && hoverPixelRef.current) {
      ctx.fillStyle = colorRef.current;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(hoverPixelRef.current.x, hoverPixelRef.current.y, 1, 1);
      ctx.globalAlpha = 1.0;

      const prevLineWidth = ctx.lineWidth;
      ctx.lineWidth = 1 / scale;
      ctx.strokeStyle = 'black';
      ctx.strokeRect(hoverPixelRef.current.x, hoverPixelRef.current.y, 1, 1);
      ctx.lineWidth = prevLineWidth;
    }

    ctx.restore();
  }, []);

  const setColor = (c) => {
    setColorState(c);
    colorRef.current = c;
    render();
  };



  const setIsPaintMode = (m) => {
    setIsPaintModeState(m);
    isPaintModeRef.current = m;

    // Paint 모드에 들어가는 순간 = 그림 그리기 시작 시간
    if (m) {
      paintStartedAtRef.current = new Date().toISOString();
    }

    // Paint 모드에서 나가면 임시 픽셀과 시작 시간 초기화
    if (!m) {
      setPendingPixels([]);
      pendingPixelsRef.current = [];
      paintStartedAtRef.current = null;
    }

    render();
  };

  const savePainting = async () => {
    if (pendingPixelsRef.current.length === 0) return;

    try {
      const res = await fetch('/api/paint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pixels: pendingPixelsRef.current,
          floor: floorRef.current,
          paintStartedAt: paintStartedAtRef.current
        })
      });

      const data = await res.json();

      if (data.success) {
        setPendingPixels([]);
        pendingPixelsRef.current = [];
        paintStartedAtRef.current = null;
        setIsPaintMode(false);
        fetchObjects();
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch(e) {
      alert('Error saving painting');
    }
  };

  const deleteSelected = async () => {
    if (!selectedObjectId) return;
    try {
      const res = await fetch(`/api/paint/${selectedObjectId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSelectedObjectId(null);
        selectedObjectIdRef.current = null;
        fetchObjects();
      }
    } catch(e) {}
  };



  const openLeaderboard = async (type) => {
    setLeaderboardType(type);
    setLeaderboardLoading(true);
    setLeaderboardData(null);
    setAnimateBars(false);
    setShowFullLeaderboard(false);

    setActiveLeaderboardTab("personalPixelRanking");

    try {
      const res = await fetch(`/api/leaderboard?type=${type}`);
      const json = await res.json();

      if (json.success) {
        setLeaderboardData(json.data);
        setCurrentUserEmail(json.currentUserEmail || null);

        setTimeout(() => {
          setAnimateBars(true);
        }, 100);
      } else {
        alert(json.error || "리더보드를 불러오지 못했습니다.");
        setLeaderboardType(null);
      }
    } catch (e) {
      alert("리더보드를 불러오는 중 오류가 발생했습니다.");
      setLeaderboardType(null);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const closeLeaderboard = () => {
    setLeaderboardType(null);
    setLeaderboardData(null);
    setAnimateBars(false);
  };

  useEffect(() => {
    if (!leaderboardType) return;

    setAnimateBars(false);
    setShowFullLeaderboard(false);

    const timer = setTimeout(() => {
      setAnimateBars(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [activeLeaderboardTab, leaderboardType]);

  const redrawDataCanvas = useCallback(() => {
    if (!dataCanvasRef.current || !bgImageRef.current) return;
    const { width, height } = imageSizeRef.current;

    dataCanvasRef.current.width = width;
    dataCanvasRef.current.height = height;
    const dctx = dataCanvasRef.current.getContext('2d');
    dctx.clearRect(0, 0, width, height);

    objectsRef.current.forEach(obj => {
      obj.pixels.forEach(p => {
        dctx.fillStyle = p.color;
        dctx.fillRect(p.x, p.y, 1, 1);
      });
    });
  }, []);

  useEffect(() => {
    redrawDataCanvas();
    render();
  }, [objects, redrawDataCanvas, render]);

  const moveToPixel = useCallback((targetFloor, targetX, targetY) => {
    pendingMoveTargetRef.current = {
      floor: targetFloor,
      x: targetX,
      y: targetY
    };

    closeLeaderboard();

    if (targetFloor !== floorRef.current) {
      handleFloorChange(targetFloor);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const targetScale = 18;

    const newX = canvas.width / 2 - targetX * targetScale;
    const newY = canvas.height / 2 - targetY * targetScale;

    transformRef.current = clampTransform(newX, newY, targetScale);
    render();

    pendingMoveTargetRef.current = null;
  }, [handleFloorChange, clampTransform, render]);

  useEffect(() => {
    setIsImageLoaded(false);

    const img = new Image();
    img.src = `/${floor}f.jpg`;

    img.onload = () => {
      bgImageRef.current = img;
      imageSizeRef.current = {
        width: img.width,
        height: img.height
      };

      const { width, height } = imageSizeRef.current;

      const dataCanvas = document.createElement('canvas');
      dataCanvas.width = width;
      dataCanvas.height = height;
      dataCanvasRef.current = dataCanvas;

      resetTransformToImage();

      redrawDataCanvas();
      setIsImageLoaded(true);

      const pendingTarget = pendingMoveTargetRef.current;

      if (
          pendingTarget &&
          pendingTarget.floor === floorRef.current &&
          canvasRef.current
      ) {
        const canvas = canvasRef.current;
        const targetScale = 18;

        const newX = canvas.width / 2 - pendingTarget.x * targetScale;
        const newY = canvas.height / 2 - pendingTarget.y * targetScale;

        transformRef.current = clampTransform(newX, newY, targetScale);
        pendingMoveTargetRef.current = null;
      }

      render();
    };
  }, [floor, redrawDataCanvas, render, resetTransformToImage]);



  useEffect(() => {
    if (!isImageLoaded) return;

    const resize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;

        const { width, height } = imageSizeRef.current;

        // Initial centering
        const { x, y, scale } = transformRef.current;
        if (x === 0 && y === 0 && scale === 1) {
           const minScale = Math.max(canvasRef.current.width / width, canvasRef.current.height / height);
           const initScale = Math.max(1, minScale);
           const initX = (canvasRef.current.width - width * initScale) / 2;
           const initY = (canvasRef.current.height - height * initScale) / 2;
           transformRef.current = clampTransform(initX, initY, initScale);
        } else {
           transformRef.current = clampTransform(x, y, scale);
        }

        render();
      }
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, [render, clampTransform, isImageLoaded]);

  const handlePointerDown = (e) => {
    if (!isImageLoaded) return;

    // Prevent dragging map if clicking on the info tooltip
    if (e.target.closest('.admin-tooltip')) return;

    isDraggingRef.current = true;
    draggedRef.current = false;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    canvasRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (isDraggingRef.current) {
      if (isPaintModeRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const { x, y, scale } = transformRef.current;
        const pixelX = Math.floor((cursorX - x) / scale);
        const pixelY = Math.floor((cursorY - y) / scale);

        const { width, height } = imageSizeRef.current;
        if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
          paintPixel(pixelX, pixelY, colorRef.current);
          if (!hoverPixelRef.current || hoverPixelRef.current.x !== pixelX || hoverPixelRef.current.y !== pixelY) {
            hoverPixelRef.current = { x: pixelX, y: pixelY };
            render();
          }
        }
        draggedRef.current = true;
        return;
      }

      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        draggedRef.current = true;
      }

      const { x, y, scale } = transformRef.current;
      transformRef.current = clampTransform(x + dx, y + dy, scale);
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      render();
      return;
    }

    if (!isImageLoaded) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const { x, y, scale } = transformRef.current;
    const pixelX = Math.floor((cursorX - x) / scale);
    const pixelY = Math.floor((cursorY - y) / scale);

    const { width, height } = imageSizeRef.current;
    if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
      if (!hoverPixelRef.current || hoverPixelRef.current.x !== pixelX || hoverPixelRef.current.y !== pixelY) {
        hoverPixelRef.current = { x: pixelX, y: pixelY };
        render();
      }
    } else {
      if (hoverPixelRef.current) {
        hoverPixelRef.current = null;
        render();
      }
    }
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current || !isImageLoaded) return;
    isDraggingRef.current = false;

    if (!draggedRef.current) {
      // It's a click/tap
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const { x, y, scale } = transformRef.current;
      const pixelX = Math.floor((clickX - x) / scale);
      const pixelY = Math.floor((clickY - y) / scale);

      const { width, height } = imageSizeRef.current;
      if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
        if (isPaintMode) {
          paintPixel(pixelX, pixelY, color);
        } else if (isAdmin) {
          let clickedId = null;
          for (let i = objectsRef.current.length - 1; i >= 0; i--) {
            const obj = objectsRef.current[i];
            if (obj.pixels.find(p => p.x === pixelX && p.y === pixelY)) {
              clickedId = obj._id;
              break;
            }
          }
          if (clickedId !== selectedObjectIdRef.current) {
            setSelectedObjectId(clickedId);
            selectedObjectIdRef.current = clickedId;
            if (clickedId) {
              setTooltipPos({ x: e.clientX, y: e.clientY });
            }
            render();
          }
        }
      }
    }
  };

  const handleWheel = useCallback((e) => {
    if (!isImageLoaded) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const { x, y, scale } = transformRef.current;

    const zoomFactor = 1.1;
    let newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;

    // Apply the max limit before calculating the new translation point
    // to prevent translating to an out-of-bounds position when at max scale.
    newScale = Math.min(newScale, 50);

    const newX = cursorX - (cursorX - x) * (newScale / scale);
    const newY = cursorY - (cursorY - y) * (newScale / scale);

    transformRef.current = clampTransform(newX, newY, newScale);
    render();
  }, [render, clampTransform, isImageLoaded]);

  const handlePointerOut = () => {
    if (hoverPixelRef.current) {
      hoverPixelRef.current = null;
      render();
    }
  };

  const isWhiteBackgroundPixel = (px, py) => {
    if (!bgImageRef.current) return false;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1;
    tempCanvas.height = 1;

    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    tempCtx.drawImage(
        bgImageRef.current,
        px, py, 1, 1,
        0, 0, 1, 1
    );

    const [r, g, b, a] = tempCtx.getImageData(0, 0, 1, 1).data;

    // 거의 흰색도 흰색으로 처리
    return a > 0 && r >= 245 && g >= 245 && b >= 245;
  };

  const paintPixel = (px, py, paintColor) => {
    if (!session) {
      alert('로그인이 필요합니다.');
      return;
    }

    // 1층이 아닐 때는 배경의 흰색 픽셀 위에 색칠 금지
    if (floorRef.current !== 1 && isWhiteBackgroundPixel(px, py)) {
      return;
    }

    const existingIdx = pendingPixelsRef.current.findIndex(p => p.x === px && p.y === py);

    if (existingIdx !== -1) {
      pendingPixelsRef.current[existingIdx].color = paintColor;
    } else {
      pendingPixelsRef.current.push({ x: px, y: py, color: paintColor });
    }

    setPendingPixels([...pendingPixelsRef.current]);
    render();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 text-black font-sans overflow-hidden">
      {/* Top Floating Buttons */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
        <button
            onClick={() => openLeaderboard("user")}
            className="w-12 h-12 bg-white hover:bg-gray-100 text-black border border-gray-200 rounded-full shadow-md font-bold transition-colors flex items-center justify-center text-lg"
            title="리더보드"
        >
          🏆
        </button>

        {isAdmin && (
            <button
                onClick={() => openLeaderboard("admin")}
                className="w-12 h-12 bg-yellow-100 hover:bg-yellow-200 text-black border border-yellow-300 rounded-full shadow-md font-bold transition-colors flex items-center justify-center text-lg"
                title="관리자 리더보드"
            >
              👑
            </button>
        )}

        {session ? (
            <button
                onClick={() => {
                  if (window.confirm('로그아웃 하시겠습니까?')) signOut();
                }}
                className="w-12 h-12 bg-white hover:bg-gray-100 text-black border border-gray-200 rounded-full shadow-md font-bold transition-colors flex items-center justify-center text-xs"
                title="로그아웃"
            >
              {session.user.name?.slice(-3) || 'OUT'}
            </button>
        ) : (
            <button
                onClick={() => signIn('google')}
                className="w-12 h-12 bg-white hover:bg-gray-100 border border-gray-200 rounded-full shadow-md transition-colors flex items-center justify-center"
                title="구글 로그인"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
            </button>
        )}
      </div>

      {/* Floor Slider UI */}
      <div className="absolute top-4 left-4 z-20 flex flex-col items-center gap-2 bg-white/90 backdrop-blur shadow-xl border border-gray-200 p-3 rounded-2xl">
        <span className="text-sm font-bold text-gray-700">층</span>
        <div className="flex flex-col gap-1 items-center bg-gray-100 p-1 rounded-xl">
          {[5, 4, 3, 2, 1].map((f) => (
            <button
              key={f}
              onClick={() => handleFloorChange(f)}
              className={`w-8 h-8 rounded-lg font-bold text-sm transition-colors ${floor === f ? 'bg-blue-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}
              title={`${f}층으로 이동`}
            >
              {f}F
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 mt-1">Q(↓) E(↑)</span>
      </div>

      {showModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-black mx-4">
            <h2 className="text-2xl font-bold mb-5 text-gray-800">⚠ 읽어주세요!</h2>
            <h2 className="mb-5 text-gray-800">The Place에 오신 것을 환영합니다. 아래 사항들을 읽고, The Place를 즐겨주시면 좋겠습니다.</h2>
            <ul className="list-disc pl-5 space-y-3 mb-8 text-gray-600">
              <li>The Place는 SASA의 학생들이 <a className="underline font-bold">자유롭게</a> SASA를 색칠할 수 있는 온라인 공간입니다. SASA의 공간에 여러분들의 용기, 도전, 꿈을 마음껏 표현해주세요.</li>
              <li>그러나 The Place는 접속한 모두가 볼 수 있는 <a className="underline font-bold">공용 캔버스</a>이기도 합니다. 이 사실에 유념하여 이용해주세요.</li>
              <li>모두 확인하였다면, 아래 '확인했습니다' 버튼을 누르고 The Place 이용을 시작해주세요.</li>
            </ul>
            <button onClick={() => setShowModal(false)} className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors shadow-sm">
              확인했습니다
            </button>
          </div>
        </div>
      )}

      {leaderboardType && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-[96vw] h-[90vh] max-w-6xl overflow-hidden text-black flex flex-col">
              <div className="flex items-start justify-between px-5 sm:px-7 py-5 border-b border-gray-100">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                    {leaderboardType === "admin" ? "관리자 리더보드" : "리더보드"}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    The Place 활동 순위
                  </p>
                </div>

                <button
                    onClick={closeLeaderboard}
                    className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 font-bold shrink-0"
                >
                  ✕
                </button>
              </div>

              {leaderboardLoading && (
                  <div className="p-10 text-center text-gray-500">
                    리더보드를 불러오는 중...
                  </div>
              )}

              {!leaderboardLoading && leaderboardData && (
                  <>
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
                        {leaderboardType === "admin" ? (
                            <>
                              <LeaderboardTabButton
                                  id="personalPixelRanking"
                                  label="개인 픽셀"
                                  activeLeaderboardTab={activeLeaderboardTab}
                                  setActiveLeaderboardTab={setActiveLeaderboardTab}
                              />
                              <LeaderboardTabButton
                                  id="personalTimeRanking"
                                  label="개인 시간"
                                  activeLeaderboardTab={activeLeaderboardTab}
                                  setActiveLeaderboardTab={setActiveLeaderboardTab}
                              />
                              <LeaderboardTabButton
                                  id="personalSpeedRanking"
                                  label="픽셀/시간"
                                  activeLeaderboardTab={activeLeaderboardTab}
                                  setActiveLeaderboardTab={setActiveLeaderboardTab}
                              />
                              <LeaderboardTabButton
                                  id="classPixelRanking"
                                  label="반별 픽셀"
                                  activeLeaderboardTab={activeLeaderboardTab}
                                  setActiveLeaderboardTab={setActiveLeaderboardTab}
                              />
                              <LeaderboardTabButton
                                  id="gradePixelRanking"
                                  label="학년별 픽셀"
                                  activeLeaderboardTab={activeLeaderboardTab}
                                  setActiveLeaderboardTab={setActiveLeaderboardTab}
                              />
                              <LeaderboardTabButton
                                  id="floorPixelRanking"
                                  label="층별 픽셀"
                                  activeLeaderboardTab={activeLeaderboardTab}
                                  setActiveLeaderboardTab={setActiveLeaderboardTab}
                              />
                              <LeaderboardTabButton
                                  id="editedPixelRanking"
                                  label="수정 위치"
                                  activeLeaderboardTab={activeLeaderboardTab}
                                  setActiveLeaderboardTab={setActiveLeaderboardTab}
                              />
                            </>
                        ) : (
                            <>
                              <LeaderboardTabButton
                                  id="personalPixelRanking"
                                  label="개인 픽셀"
                                  activeLeaderboardTab={activeLeaderboardTab}
                                  setActiveLeaderboardTab={setActiveLeaderboardTab}
                              />
                              <LeaderboardTabButton
                                  id="classPixelRanking"
                                  label="반별 픽셀"
                                  activeLeaderboardTab={activeLeaderboardTab}
                                  setActiveLeaderboardTab={setActiveLeaderboardTab}
                              />
                              <LeaderboardTabButton
                                  id="gradePixelRanking"
                                  label="학년별 픽셀"
                                  activeLeaderboardTab={activeLeaderboardTab}
                                  setActiveLeaderboardTab={setActiveLeaderboardTab}
                              />
                              <LeaderboardTabButton
                                  id="floorPixelRanking"
                                  label="층별 픽셀"
                                  activeLeaderboardTab={activeLeaderboardTab}
                                  setActiveLeaderboardTab={setActiveLeaderboardTab}
                              />
                            </>
                        )}
                      </div>
                    </div>

                    <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
                      <LeaderboardList
                          items={leaderboardData[activeLeaderboardTab] || []}
                          activeTab={activeLeaderboardTab}
                          animateBars={animateBars}
                          currentUserEmail={currentUserEmail}
                          showFullLeaderboard={showFullLeaderboard}
                          setShowFullLeaderboard={setShowFullLeaderboard}
                          onMoveToPixel={moveToPixel}
                      />
                    </div>
                  </>
              )}
            </div>
          </div>
      )}

      {/* Fade Overlay */}
      <div
        className={`absolute inset-0 z-10 bg-white transition-opacity duration-300 pointer-events-none ${isFading ? 'opacity-100' : 'opacity-0'}`}
      />

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-gray-200"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerOut={handlePointerOut}
          className={`absolute top-0 left-0 w-full h-full touch-none ${isPaintMode ? 'cursor-crosshair' : 'cursor-grab'}`}
        />

        {isAdmin && selectedObjectId && (
          (() => {
            const selectedObject = objects.find(o => o._id === selectedObjectId);
            if (!selectedObject) return null;
            return (
              <div
                className="admin-tooltip absolute z-30 bg-white/95 p-3 rounded-xl shadow-lg border border-gray-200 pointer-events-auto flex flex-col gap-2"
                style={{
                  left: tooltipPos.x + 15,
                  top: tooltipPos.y + 15
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="text-sm">
                  <p><strong>작성자:</strong> {selectedObject.userEmail || '알수없음'}</p>
                  <p><strong>크기:</strong> {selectedObject.pixels.length} 픽셀</p>
                  <p>
                    <strong>시작 시간:</strong>{' '}
                    {selectedObject.paintStartedAt
                        ? new Date(selectedObject.paintStartedAt).toLocaleString()
                        : '기록 없음'}
                  </p>
                  <p>
                    <strong>게시 시간:</strong>{' '}
                    {selectedObject.postedAt
                        ? new Date(selectedObject.postedAt).toLocaleString()
                        : '기록 없음'}
                  </p>
                  <p>
                    <strong>소요 시간:</strong>{' '}
                    {selectedObject.durationSeconds != null
                        ? `${selectedObject.durationSeconds}초`
                        : '기록 없음'}
                  </p>
                </div>
                <button
                  onClick={deleteSelected}
                  className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded font-bold text-xs shadow-sm"
                >
                  이 객체 삭제
                </button>
              </div>
            );
          })()
        )}

        {/* Bottom Panel */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/95 backdrop-blur shadow-xl border border-gray-200 p-4 rounded-3xl z-20">

          {isPaintMode && (
            <button
              onClick={() => setIsPaintMode(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white hover:bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600 shadow-md border border-gray-200 transition-colors"
            >
              ✕
            </button>
          )}

          {isPaintMode && pendingPixels.length > 0 && (
            <button
              onClick={savePainting}
              className="px-6 py-2 rounded-full font-bold transition-colors whitespace-nowrap bg-green-500 hover:bg-green-600 text-white shadow"
            >
              Paint 완료!
            </button>
          )}

          {!isPaintMode && (
            <button
              onClick={() => session ? setIsPaintMode(true) : signIn('google')}
              className="px-8 py-2.5 rounded-full font-bold transition-transform hover:scale-105 active:scale-95 whitespace-nowrap bg-blue-500 text-white shadow-md"
            >
              Paint
            </button>
          )}

          {isPaintMode && (
            <div className="flex flex-wrap gap-2 w-[280px] sm:w-[400px] justify-center animate-in fade-in zoom-in duration-200">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform shadow-sm ${color === c ? 'border-gray-400 scale-125 z-10' : 'border-gray-200 hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaderboardTabButton({
                                id,
                                label,
                                activeLeaderboardTab,
                                setActiveLeaderboardTab
                              }) {
  const active = activeLeaderboardTab === id;

  return (
      <button
          onClick={() => setActiveLeaderboardTab(id)}
          className={`w-full px-3 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${
              active
                  ? "bg-blue-500 text-white shadow-md scale-[1.02]"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
      >
        {label}
      </button>
  );
}

function LeaderboardList({
                           items,
                           activeTab,
                           animateBars,
                           currentUserEmail,
                           showFullLeaderboard,
                           setShowFullLeaderboard,
                           onMoveToPixel
                         }) {
  if (!items || items.length === 0) {
    return (
        <div className="py-12 text-center text-gray-400">
          아직 기록이 없습니다.
        </div>
    );
  }

  const personalTabs = [
    "personalPixelRanking",
    "personalTimeRanking",
    "personalSpeedRanking"
  ];

  const isPersonalTab = personalTabs.includes(activeTab);

  const itemsWithRank = items.map((item, index) => ({
    ...item,
    rank: index + 1
  }));

  const top10 = itemsWithRank.slice(0, 10);

  const myItem =
      currentUserEmail
          ? itemsWithRank.find((item) => {
            if (!item.subLabel) return false;
            return item.subLabel.includes(currentUserEmail);
          })
          : null;

  let visibleItems;

  if (isPersonalTab && !showFullLeaderboard) {
    visibleItems = [...top10];

    if (myItem && myItem.rank > 10) {
      visibleItems.push({
        type: "divider",
        label: "내 순위"
      });
      visibleItems.push(myItem);
    }
  } else {
    visibleItems = itemsWithRank;
  }

  const maxValue = Math.max(
      ...itemsWithRank.map((item) => Number(item.value) || 0),
      1
  );

  return (
      <div className="flex flex-col gap-2">
        {visibleItems.map((item, index) => {
          if (item.type === "divider") {
            return (
                <div
                    key={`divider-${index}`}
                    className="py-2 text-center text-xs font-bold text-gray-400"
                >
                  · · · {item.label} · · ·
                </div>
            );
          }

          return (
              <LeaderboardRow
                  key={`${item.label}-${item.rank}-${index}`}
                  item={item}
                  activeTab={activeTab}
                  maxValue={maxValue}
                  animateBars={animateBars}
                  isMine={
                      currentUserEmail &&
                      item.subLabel &&
                      item.subLabel.includes(currentUserEmail)
                  }
                  onMoveToPixel={onMoveToPixel}
              />
          );
        })}

        {isPersonalTab && itemsWithRank.length > 10 && (
            <div className="pt-4 flex justify-center">
              <button
                  onClick={() => {
                    setShowFullLeaderboard((prev) => !prev);
                  }}
                  className="px-5 py-2 rounded-full bg-gray-900 text-white text-sm font-bold hover:bg-black transition-colors"
              >
                {showFullLeaderboard ? "상위 10명만 보기" : "전체 보기"}
              </button>
            </div>
        )}
      </div>
  );
}

function LeaderboardRow({
                          item,
                          activeTab,
                          maxValue,
                          animateBars,
                          isMine,
                          onMoveToPixel
                        }) {
  const value = Number(item.value) || 0;
  const percent = maxValue > 0 ? (value / maxValue) * 100 : 0;

  const isEditedPixelTab = activeTab === "editedPixelRanking";

  const isPersonalTab =
      activeTab === "personalPixelRanking" ||
      activeTab === "personalTimeRanking" ||
      activeTab === "personalSpeedRanking";

  const rowGridClass = isPersonalTab
      ? "grid-cols-[42px_minmax(90px,170px)_90px_1fr] sm:grid-cols-[56px_minmax(140px,220px)_110px_1fr]"
      : "grid-cols-[34px_minmax(54px,90px)_64px_1fr] sm:grid-cols-[48px_minmax(90px,140px)_90px_1fr]";

  const rowPaddingClass = isPersonalTab
      ? "py-2.5"
      : "py-4 sm:py-5";

  const canMoveToPixel =
      isEditedPixelTab &&
      item.floor != null &&
      item.x != null &&
      item.y != null &&
      onMoveToPixel;

  const medal =
      item.rank === 1
          ? "🥇"
          : item.rank === 2
              ? "🥈"
              : item.rank === 3
                  ? "🥉"
                  : item.rank;

  return (
      <div
          onClick={() => {
            if (canMoveToPixel) {
              onMoveToPixel(item.floor, item.x, item.y);
            }
          }}
          className={`grid ${rowGridClass} items-center gap-2 sm:gap-3 ${rowPaddingClass} transition-colors ${
              isMine ? "bg-blue-50 rounded-2xl px-3 -mx-3" : ""
          } ${
              canMoveToPixel
                  ? "cursor-pointer hover:bg-blue-50 rounded-2xl px-3 -mx-3"
                  : ""
          }`}
          title={canMoveToPixel ? "이 위치로 이동" : undefined}
      >
        <div className="text-center font-black text-gray-700">
          {medal}
        </div>

        <div className="min-w-0">
          <div className="font-bold truncate text-gray-900 text-sm sm:text-base">
            {item.label}
            {isMine && (
                <span className="ml-2 text-xs text-blue-600 font-black">
              ME
            </span>
            )}
          </div>

          {item.subLabel && (
              <div className="text-xs text-gray-400 truncate mt-0.5">
                {item.subLabel}
              </div>
          )}

          {/*{canMoveToPixel && (*/}
          {/*    <div className="hidden sm:block text-xs text-blue-500 font-bold mt-0.5">*/}
          {/*      클릭하면 해당 위치로 이동*/}
          {/*    </div>*/}
          {/*)}*/}
        </div>

        <div className="text-right text-xs sm:text-base font-black text-gray-800 whitespace-nowrap">
          {item.valueText}
        </div>

        <div className="h-5 sm:h-6 bg-gray-100 rounded-full overflow-hidden">
          <div
              className={`h-full rounded-full transition-all ease-out ${
                  item.rank === 1
                      ? "bg-yellow-500"
                      : item.rank === 2
                          ? "bg-slate-400"
                          : item.rank === 3
                              ? "bg-amber-700"
                              : "bg-blue-600"
              }`}
              style={{
                width: animateBars ? `${percent}%` : "0%",
                transitionDuration: "1600ms"
              }}
          />
        </div>
      </div>
  );
}