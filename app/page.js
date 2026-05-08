'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { useSession, signIn, signOut } from "next-auth/react";

const PALETTE = [
  '#FFFFFF', '#E4E4E4', '#888888', '#222222', '#000000',
  '#FFA7D1', '#E50000', '#E59500', '#A06A42', '#E5D900',
  '#94E044', '#02BE01', '#00D3DD', '#0083C7', '#0000EA',
  '#CF6EE4', '#820080', '#FF3904', '#FFB381', '#FFD635'
];

const ADMIN_EMAILS = ['mainforwoo@sasa.hs.kr', 'mojin81@sasa.hs.kr'];

export default function Home() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.email && ADMIN_EMAILS.includes(session.user.email);

  const [showModal, setShowModal] = useState(false);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const dataCanvasRef = useRef(null);
  const bgImageRef = useRef(null);
  const imageSizeRef = useRef({ width: 1000, height: 1000 });
  const palettePanelRef = useRef(null);

  const overlayCanvasRef = useRef(null);
  const pendingCountUpdateRef = useRef(null);

  const [color, setColorState] = useState(PALETTE[6]);
  const [customColor, setCustomColor] = useState("#E50000");
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [isPaintMode, setIsPaintModeState] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isHeatmapMode, setIsHeatmapMode] = useState(false);
  const [isAnimationMode, setIsAnimationMode] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);

  const [pendingPixels, setPendingPixels] = useState([]);
  const [pendingPixelCount, setPendingPixelCount] = useState(0);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [floor, setFloor] = useState(5);
  const [isFading, setIsFading] = useState(false);

  const [leaderboardType, setLeaderboardType] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState("personalPixelRanking");
  const [animateBars, setAnimateBars] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  const [palettePos, setPalettePos] = useState(null);

  const [canvasNotes, setCanvasNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const [isNoteAddMode, setIsNoteAddMode] = useState(false);
  const isNoteAddModeRef = useRef(false);

  const [noteEditor, setNoteEditor] = useState({
    id: null,
    floor: 1,
    x: 0,
    y: 0,
    icon: "📌",
    title: "",
    body: "",
  });

  const colorRef = useRef(PALETTE[6]);
  const isPaintModeRef = useRef(false);
  const isEraserModeRef = useRef(false);
  const isHeatmapModeRef = useRef(false);
  const hoverPixelRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mainRenderRequestRef = useRef(null);
  const overlayRenderRequestRef = useRef(null);
  const renderRequestRef = useRef(null);
  const isAnimationModeRef = useRef(false);
  const animationProgressRef = useRef(0);
  const animationStartedAtRef = useRef(0);
  const animationFrameLoopRef = useRef(null);
  const floorRef = useRef(1);
  const floorChangeTimerRef = useRef(null);
  const paintStartedAtRef = useRef(null);

  const pendingPixelsRef = useRef([]);
  const selectedObjectIdRef = useRef(null);
  const pendingMoveTargetRef = useRef(null);

  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const draggedRef = useRef(false);
  const lastTouchDistanceRef = useRef(0);

  const pointersRef = useRef(new Map());
  const isPinchingRef = useRef(false);
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1);
  const pinchStartCenterRef = useRef({ x: 0, y: 0 });
  const pinchStartTransformRef = useRef({ x: 0, y: 0, scale: 1 });
  const hadMultiTouchRef = useRef(false);

  const [objects, setObjects] = useState([]);
  const objectsRef = useRef([]);

  const [historyObjects, setHistoryObjects] = useState([]);
  const historyObjectsRef = useRef([]);

  const [selectedObject, setSelectedObject] = useState(null);
  const selectedObjectRef = useRef(null);

  const canvasNotesRef = useRef([]);

  const paletteDragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0
  });

  const requestPendingCountUpdate = useCallback(() => {
    if (pendingCountUpdateRef.current) return;

    pendingCountUpdateRef.current = requestAnimationFrame(() => {
      pendingCountUpdateRef.current = null;
      setPendingPixelCount(pendingPixelsRef.current.length);
    });
  }, []);

  const isWhiteBackgroundPixel = useCallback((px, py) => {
    if (!bgImageRef.current) return false;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1;
    tempCanvas.height = 1;

    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return false;

    try {
      tempCtx.drawImage(
          bgImageRef.current,
          px, py, 1, 1,
          0, 0, 1, 1
      );

      const [r, g, b, a] = tempCtx.getImageData(0, 0, 1, 1).data;
      return a > 0 && r >= 245 && g >= 245 && b >= 245;
    } catch (e) {
      return false;
    }
  }, []);

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  useEffect(() => {
    historyObjectsRef.current = historyObjects;
  }, [historyObjects]);

  useEffect(() => {
    floorRef.current = floor;
  }, [floor]);

  const fetchCanvasNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/canvas-note?floor=${floorRef.current}`);
      const json = await res.json();

      if (json.success) {
        setCanvasNotes(json.data);
        canvasNotesRef.current = json.data;
      }
    } catch (e) {}
  }, []);

  const fetchObjects = useCallback(async () => {
    try {
      const res = await fetch(`/api/paint?floor=${floorRef.current}`);
      const json = await res.json();

      if (json.success) {
        setObjects(json.data);
        objectsRef.current = json.data;
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
      fetchCanvasNotes();
    }, [floor, fetchCanvasNotes]);

    useEffect(() => {
    fetchObjects();
    fetchCanvasNotes();

    const interval = setInterval(() => {
      fetchObjects();
      fetchCanvasNotes();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchObjects, fetchCanvasNotes]);

  const fetchHistoryObjects = useCallback(async () => {
    try {
      const res = await fetch(`/api/paint?floor=${floorRef.current}&mode=history`);
      const json = await res.json();

      if (json.success) {
        setHistoryObjects(json.data);
        historyObjectsRef.current = json.data;
        return json.data;
      }
    } catch (e) {}

    return [];
  }, []);

  const handleFloorChange = useCallback((newFloor) => {
    if (newFloor < 1 || newFloor > 5) return;

    if (newFloor === floorRef.current) return;

    if (floorChangeTimerRef.current) {
      clearTimeout(floorChangeTimerRef.current);
      floorChangeTimerRef.current = null;
    }

    floorRef.current = newFloor;

    setIsFading(true);

    floorChangeTimerRef.current = setTimeout(() => {
      setFloor(newFloor);

      setPendingPixels([]);
      pendingPixelsRef.current = [];
      setPendingPixelCount(0);

      setSelectedObjectId(null);
      selectedObjectIdRef.current = null;

      setIsFading(false);

      floorChangeTimerRef.current = null;
    }, 300);
  }, []);

  useEffect(() => {
    canvasNotesRef.current = canvasNotes;
  }, [canvasNotes]);

  useEffect(() => {
    return () => {
      if (floorChangeTimerRef.current) {
        clearTimeout(floorChangeTimerRef.current);
      }
    };
  }, []);

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
    const interval = setInterval(fetchObjects, 30000);
    return () => clearInterval(interval);
  }, [fetchObjects]);

  useEffect(() => {
    fetchObjects();
  }, [floor, fetchObjects]);

  useEffect(() => {
    if (session && !localStorage.getItem('firstLoginCheck1')) {
      setShowHelpModal(true);
      localStorage.setItem('firstLoginCheck1', 'true');
    }
  }, [session]);

  const getFitScale = useCallback((canvas, width, height) => {
    if (!canvas || width <= 0 || height <= 0) return 1;

    return Math.min(
      canvas.width / width,
      canvas.height / height
    );
  }, []);

  const clampTransform = useCallback((nx, ny, ns) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: nx, y: ny, scale: ns };

    const { width, height } = imageSizeRef.current;

    const minScale = getFitScale(canvas, width, height);

    const scale = Math.max(minScale, Math.min(ns, 50));

    const scaledWidth = width * scale;
    const scaledHeight = height * scale;

    let x;
    let y;

    if (scaledWidth <= canvas.width) {
      x = (canvas.width - scaledWidth) / 2;
    } else {
      const minX = canvas.width - scaledWidth;
      const maxX = 0;
      x = Math.min(Math.max(nx, minX), maxX);
    }

    if (scaledHeight <= canvas.height) {
      y = (canvas.height - scaledHeight) / 2;
    } else {
      const minY = canvas.height - scaledHeight;
      const maxY = 0;
      y = Math.min(Math.max(ny, minY), maxY);
    }

    return { x, y, scale };
  }, [getFitScale]);

  const resetTransformToImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = imageSizeRef.current;

    const initScale = getFitScale(canvas, width, height);
    const initX = (canvas.width - width * initScale) / 2;
    const initY = (canvas.height - height * initScale) / 2;

    transformRef.current = clampTransform(initX, initY, initScale);
  }, [clampTransform, getFitScale]);

  const drawHeatmapFromSnapshot = useCallback((ctx, width, height) => {
    const snapshot = objectsRef.current[0];
    const pixels = snapshot?.pixels || [];

    if (pixels.length === 0) return;

    let maxCount = 0;

    pixels.forEach((p) => {
      maxCount = Math.max(maxCount, p.editCount || 0);
    });

    if (maxCount <= 0) return;

    const logMax = Math.log1p(maxCount);

    pixels.forEach((p) => {
      const count = p.editCount || 0;
      if (count <= 0) return;

      const ratio = Math.log1p(count) / logMax;
      const gray = Math.round(255 * (1 - ratio));

      ctx.fillStyle = `rgb(255, ${gray}, ${gray})`;
      ctx.fillRect(p.x, p.y, 1, 1);
    });
  }, []);

  const drawHeatmap = useCallback((ctx, width, height, sourceObjects = historyObjectsRef.current) => {
    const counts = new Map();

    sourceObjects.forEach((obj) => {
      if (!obj.pixels) return;

      obj.pixels.forEach((p) => {
        const key = `${p.x},${p.y}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });

    if (counts.size === 0) return;

    const maxCount = Math.max(...counts.values());

    counts.forEach((count, key) => {
      const [x, y] = key.split(',').map(Number);
      if (x < 0 || y < 0 || x >= width || y >= height) return;

      const ratio = Math.log1p(count) / Math.log1p(maxCount);
      const gray = Math.round(255 * (1 - ratio));

      ctx.fillStyle = `rgb(255, ${gray}, ${gray})`;
      ctx.fillRect(x, y, 1, 1);
    });
  }, []);

  const getObjectTime = (obj) => {
    const time =
      obj.postedAt ||
      obj.createdAt ||
      obj.paintStartedAt ||
      obj.updatedAt ||
      0;

    const parsed = new Date(time).getTime();

    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getSortedObjectsForAnimation = useCallback(() => {
    return [...historyObjectsRef.current].sort((a, b) => {
      const ta = getObjectTime(a);
      const tb = getObjectTime(b);

      if (ta !== tb) return ta - tb;

      return String(a._id || '').localeCompare(String(b._id || ''));
    });
  }, []);

  const drawAnimationFrame = useCallback((ctx, progress) => {
    const sortedObjects = getSortedObjectsForAnimation();

    if (sortedObjects.length === 0) return;

    const visibleCount = Math.max(
      0,
      Math.min(
        sortedObjects.length,
        Math.floor(progress * sortedObjects.length)
      )
    );

    for (let i = 0; i < visibleCount; i++) {
      const obj = sortedObjects[i];

      if (!obj.pixels) continue;

      obj.pixels.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 1, 1);
      });
    }

    const fractionalIndex = progress * sortedObjects.length;
    const currentIndex = Math.floor(fractionalIndex);
    const localAlpha = fractionalIndex - currentIndex;

    const currentObj = sortedObjects[currentIndex];

    if (currentObj?.pixels && localAlpha > 0) {
      const prevAlpha = ctx.globalAlpha;

      ctx.globalAlpha = Math.max(0.15, Math.min(1, localAlpha));
      currentObj.pixels.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 1, 1);
      });

      ctx.globalAlpha = prevAlpha;
    }
  }, [getSortedObjectsForAnimation]);

  const getAnimatedVisibleObjects = useCallback((progress) => {
    const sortedObjects = getSortedObjectsForAnimation();

    if (sortedObjects.length === 0) return [];

    const visibleCount = Math.max(
      0,
      Math.min(
        sortedObjects.length,
        Math.floor(progress * sortedObjects.length)
      )
    );

    return sortedObjects.slice(0, visibleCount);
  }, [getSortedObjectsForAnimation]);

  const drawInsetPixelMarker = (ctx, px, py, fillColor, scale) => {
    const whiteBorder = Math.max(0.055, Math.min(0.15, 0.9 / scale));
    const blackBorder = Math.max(0.055, Math.min(0.13, 0.75 / scale));

    ctx.globalAlpha = 1.0;
    ctx.fillStyle = fillColor;
    ctx.fillRect(px, py, 1, 1);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';

    ctx.fillRect(px, py, 1, whiteBorder); // 위
    ctx.fillRect(px, py + 1 - whiteBorder, 1, whiteBorder); // 아래
    ctx.fillRect(px, py + whiteBorder, whiteBorder, 1 - whiteBorder * 2); // 왼쪽
    ctx.fillRect(
      px + 1 - whiteBorder,
      py + whiteBorder,
      whiteBorder,
      1 - whiteBorder * 2
    );

    const blackInset = whiteBorder;
    const blackSize = 1 - blackInset * 2;

    if (blackSize <= 0) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';

    ctx.fillRect(px + blackInset, py + blackInset, blackSize, blackBorder); // 위
    ctx.fillRect(
      px + blackInset,
      py + blackInset + blackSize - blackBorder,
      blackSize,
      blackBorder
    );
    ctx.fillRect(
      px + blackInset,
      py + blackInset + blackBorder,
      blackBorder,
      blackSize - blackBorder * 2
    );
    ctx.fillRect(
      px + blackInset + blackSize - blackBorder,
      py + blackInset + blackBorder,
      blackBorder,
      blackSize - blackBorder * 2
    );

    const colorInset = whiteBorder + blackBorder;
    const colorSize = 1 - colorInset * 2;

    if (colorSize <= 0) return;

    ctx.fillStyle = fillColor;
    ctx.fillRect(
      px + colorInset,
      py + colorInset,
      colorSize,
      colorSize
    );
  };

  const drawCanvasNoteMarker = (ctx, note, scale) => {
    const x = note.x;
    const y = note.y;

    const r = Math.max(0.9, Math.min(2.2, 18 / scale));

    ctx.save();

    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    ctx.lineWidth = Math.max(0.08, 1.5 / scale);
    ctx.stroke();

    ctx.font = `${Math.max(1.2, Math.min(2.4, 20 / scale))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "black";
    ctx.fillText(note.icon || "📌", x + 0.5, y + 0.5);

    ctx.restore();
  };

  const findCanvasNoteAtPixel = (pixelX, pixelY) => {
    const scale = transformRef.current.scale;

    const hitRadius = Math.max(2, Math.min(8, 18 / scale));

    for (let i = canvasNotesRef.current.length - 1; i >= 0; i--) {
      const note = canvasNotesRef.current[i];

      const dx = pixelX + 0.5 - (note.x + 0.5);
      const dy = pixelY + 0.5 - (note.y + 0.5);

      if (Math.hypot(dx, dy) <= hitRadius) {
        return note;
      }
    }

    return null;
  };

  const renderMain = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dataCanvasRef.current || !bgImageRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1.0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { x, y, scale } = transformRef.current;
    const { width, height } = imageSizeRef.current;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    if (isHeatmapModeRef.current) {
      ctx.globalAlpha = 0.25;
      ctx.drawImage(bgImageRef.current, 0, 0, width, height);
      ctx.globalAlpha = 1.0;

      drawHeatmapFromSnapshot(ctx, width, height);
    } else {
      ctx.drawImage(bgImageRef.current, 0, 0, width, height);

      if (isAnimationModeRef.current) {
        drawAnimationFrame(ctx, animationProgressRef.current);
      } else {
        ctx.drawImage(dataCanvasRef.current, 0, 0);
      }
    }

    ctx.restore();
  }, [drawHeatmapFromSnapshot, drawAnimationFrame]);

  const renderOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1.0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { x, y, scale } = transformRef.current;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    canvasNotesRef.current.forEach((note) => {
      drawCanvasNoteMarker(ctx, note, scale);
    });

    canvasNotesRef.current.forEach((note) => {
      drawCanvasNoteMarker(ctx, note, scale);
    });

    pendingPixelsRef.current.forEach((p) => {
      drawInsetPixelMarker(ctx, p.x, p.y, p.color, scale);
    });

    if (selectedObjectRef.current) {
      const obj = selectedObjectRef.current;

      if (obj?.pixels?.length) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';

        obj.pixels.forEach((p) => {
          ctx.fillRect(p.x, p.y, 1, 1);
        });

        ctx.strokeStyle = 'white';
        const prevLineWidth = ctx.lineWidth;
        ctx.lineWidth = 2 / scale;

        ctx.beginPath();

        obj.pixels.forEach((p) => {
          ctx.rect(p.x, p.y, 1, 1);
        });

        ctx.stroke();
        ctx.lineWidth = prevLineWidth;
      }
    }

    if (hoverPixelRef.current && !isHeatmapModeRef.current) {
      const { x: hx, y: hy } = hoverPixelRef.current;

      if (isPaintModeRef.current) {
        if (floorRef.current === 1 || !isWhiteBackgroundPixel(hx, hy)) {
          if (isEraserModeRef.current) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(hx, hy, 1, 1);

            ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
            const t = Math.max(0.08, Math.min(0.18, 1 / scale));

            ctx.fillRect(hx, hy, 1, t);
            ctx.fillRect(hx, hy + 1 - t, 1, t);
            ctx.fillRect(hx, hy, t, 1);
            ctx.fillRect(hx + 1 - t, hy, t, 1);
          } else {
            drawInsetPixelMarker(ctx, hx, hy, colorRef.current, scale);
          }
        }
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(hx, hy, 1, 1);
      }
    }

    ctx.restore();
  }, [isWhiteBackgroundPixel]);

  const render = useCallback(() => {
    renderMain();
    renderOverlay();
  }, [renderMain, renderOverlay]);

  const requestMainRender = useCallback(() => {
    if (mainRenderRequestRef.current) return;

    mainRenderRequestRef.current = requestAnimationFrame(() => {
      mainRenderRequestRef.current = null;
      renderMain();
    });
  }, [renderMain]);

  const requestOverlayRender = useCallback(() => {
    if (overlayRenderRequestRef.current) return;

    overlayRenderRequestRef.current = requestAnimationFrame(() => {
      overlayRenderRequestRef.current = null;
      renderOverlay();
    });
  }, [renderOverlay]);

  const requestRender = useCallback(() => {
    if (renderRequestRef.current) return;

    renderRequestRef.current = requestAnimationFrame(() => {
      renderRequestRef.current = null;
      renderMain();
      renderOverlay();
    });
  }, [renderMain, renderOverlay]);

  const updateHoverPixelFromClient = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    const cursorX = clientX - rect.left;
    const cursorY = clientY - rect.top;

    const { x, y, scale } = transformRef.current;

    const pixelX = Math.floor((cursorX - x) / scale);
    const pixelY = Math.floor((cursorY - y) / scale);

    const { width, height } = imageSizeRef.current;

    if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
      const prev = hoverPixelRef.current;

      if (prev && prev.x === pixelX && prev.y === pixelY) {
        return prev;
      }

      hoverPixelRef.current = {
        x: pixelX,
        y: pixelY
      };

      requestOverlayRender();

      return {
        x: pixelX,
        y: pixelY
      };
    }

    if (hoverPixelRef.current !== null) {
      hoverPixelRef.current = null;
      requestOverlayRender();
    }

    return null;
  }, [requestOverlayRender]);

  const setColor = (c) => {
    setIsEraserMode(false);
    isEraserModeRef.current = false;

    setColorState(c);
    colorRef.current = c;
    requestOverlayRender();
  };

  const setEraserMode = () => {
    const nextMode = !isEraserModeRef.current;

    setIsEraserMode(nextMode);
    isEraserModeRef.current = nextMode;

    requestOverlayRender();
  };

  const setIsPaintMode = (m) => {
    setIsPaintModeState(m);
    isPaintModeRef.current = m;

    if (m) {
      paintStartedAtRef.current = new Date().toISOString();

      requestAnimationFrame(() => {
        resetPalettePosition();
      });
    }

    if (!m) {
      setPendingPixels([]);
      pendingPixelsRef.current = [];
      setPendingPixelCount(0);

      paintStartedAtRef.current = null;
      setPalettePos(null);
    }

    requestRender();
  };

  const setAnimationMode = async (nextMode) => {
    if (!isAdmin) return;

    if (nextMode) {
      await fetchHistoryObjects();

      setIsPaintMode(false);

      setSelectedObjectId(null);
      selectedObjectIdRef.current = null;
      setSelectedObject(null);
      selectedObjectRef.current = null;

      hoverPixelRef.current = null;

      animationProgressRef.current = 0;
      setAnimationProgress(0);
      animationStartedAtRef.current = performance.now();
    } else {
      animationProgressRef.current = 0;
      setAnimationProgress(0);
    }

    setIsAnimationMode(nextMode);
    isAnimationModeRef.current = nextMode;

    requestRender();
  };

  const setHeatmapMode = async (nextMode) => {
    if (!isAdmin) return;

    if (nextMode) {
      await fetchHistoryObjects();

      setIsPaintMode(false);

      setSelectedObjectId(null);
      selectedObjectIdRef.current = null;
      setSelectedObject(null);
      selectedObjectRef.current = null;

      hoverPixelRef.current = null;
    }

    setIsHeatmapMode(nextMode);
    isHeatmapModeRef.current = nextMode;

    requestRender();
  };

  const handlePaletteHandlePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    const currentLeft = palettePos?.left ?? rect.width / 2;
    const currentTop = palettePos?.top ?? rect.height - 150;

    paletteDragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: currentLeft,
      startTop: currentTop
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const clampPalettePosition = useCallback((left, top) => {
    const container = containerRef.current;
    const panel = palettePanelRef.current;

    if (!container || !panel) {
      return { left, top };
    }

    const containerRect = container.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    const margin = 12;

    const halfWidth = panelRect.width / 2;
    const halfHeight = panelRect.height / 2;

    let minLeft = halfWidth + margin;
    let maxLeft = containerRect.width - halfWidth - margin;

    let minTop = halfHeight + margin;
    let maxTop = containerRect.height - halfHeight - margin;

    if (minLeft > maxLeft) {
      minLeft = containerRect.width / 2;
      maxLeft = containerRect.width / 2;
    }

    if (minTop > maxTop) {
      minTop = containerRect.height / 2;
      maxTop = containerRect.height / 2;
    }

    return {
      left: Math.max(minLeft, Math.min(maxLeft, left)),
      top: Math.max(minTop, Math.min(maxTop, top))
    };
  }, []);

  const handlePaletteHandlePointerMove = (e) => {
    if (!paletteDragRef.current.dragging) return;

    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    const dx = e.clientX - paletteDragRef.current.startX;
    const dy = e.clientY - paletteDragRef.current.startY;

    const nextLeft = paletteDragRef.current.startLeft + dx;
    const nextTop = paletteDragRef.current.startTop + dy;

    setPalettePos(
      clampPalettePosition(nextLeft, nextTop)
    );
  };

  const handlePaletteHandlePointerUp = (e) => {
    paletteDragRef.current.dragging = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const resetPalettePosition = useCallback(() => {
    const container = containerRef.current;

    if (!container) return;

    const rect = container.getBoundingClientRect();

    setPalettePos(
      clampPalettePosition(rect.width / 2, rect.height - 150)
    );
  }, []);

  useEffect(() => {
    const handleResizePalette = () => {
      if (!palettePos) return;

      requestAnimationFrame(() => {
        setPalettePos((prev) => {
          if (!prev) return prev;
          return clampPalettePosition(prev.left, prev.top);
        });
      });
    };

    window.addEventListener('resize', handleResizePalette);

    return () => {
      window.removeEventListener('resize', handleResizePalette);
    };
  }, [palettePos, clampPalettePosition]);

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
        setPendingPixelCount(0);

        paintStartedAtRef.current = null;
        setIsPaintMode(false);
        fetchObjects();
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch (e) {
      alert('Error saving painting');
    }
  };

  const saveCanvasNote = async () => {
    if (!isAdmin) return;

    const method = noteEditor.id ? "PATCH" : "POST";

    try {
      const res = await fetch("/api/canvas-note", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: noteEditor.id,
          floor: noteEditor.floor,
          x: noteEditor.x,
          y: noteEditor.y,
          icon: noteEditor.icon,
          title: noteEditor.title,
          body: noteEditor.body,
        }),
      });

      const json = await res.json();

      if (json.success) {
        const saved = json.data;

        if (method === "POST") {
          const next = [...canvasNotesRef.current, saved];
          canvasNotesRef.current = next;
          setCanvasNotes(next);
        } else {
          const next = canvasNotesRef.current.map((note) =>
            note._id === saved._id ? saved : note
          );

          canvasNotesRef.current = next;
          setCanvasNotes(next);
        }

        setSelectedNote(saved);
        setShowNoteModal(false);

        setIsNoteAddMode(false);
        isNoteAddModeRef.current = false;

        render();
      } else {
        alert(json.error || "설명글 저장 실패");
      }
    } catch (e) {
      alert("설명글 저장 중 오류가 발생했습니다.");
    }
  };

  const deleteCanvasNote = async () => {
    if (!isAdmin || !noteEditor.id) return;

    if (!window.confirm("이 설명글을 삭제할까요?")) return;

    try {
      const res = await fetch(`/api/canvas-note?id=${noteEditor.id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (json.success) {
        const next = canvasNotesRef.current.filter(
          (note) => note._id !== noteEditor.id
        );

        canvasNotesRef.current = next;
        setCanvasNotes(next);

        setSelectedNote(null);
        setShowNoteModal(false);

        render();
      } else {
        alert(json.error || "설명글 삭제 실패");
      }
    } catch (e) {
      alert("설명글 삭제 중 오류가 발생했습니다.");
    }
  };

  const deleteSelected = async () => {
    if (!selectedObjectId) return;

    try {
      const res = await fetch(`/api/paint/${selectedObjectId}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (data.success) {
        setSelectedObjectId(null);
        selectedObjectIdRef.current = null;
        fetchObjects();
      }
    } catch (e) {}
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
    if (!isAnimationMode) {
      if (animationFrameLoopRef.current) {
        cancelAnimationFrame(animationFrameLoopRef.current);
        animationFrameLoopRef.current = null;
      }

      return;
    }

    const duration = 8000;

    const tick = (now) => {
      if (!isAnimationModeRef.current) return;

      const elapsed = now - animationStartedAtRef.current;
      const progress = (elapsed % duration) / duration;

      animationProgressRef.current = progress;

      setAnimationProgress(progress);

      requestRender();

      animationFrameLoopRef.current = requestAnimationFrame(tick);
    };

    animationStartedAtRef.current = performance.now();
    animationFrameLoopRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameLoopRef.current) {
        cancelAnimationFrame(animationFrameLoopRef.current);
        animationFrameLoopRef.current = null;
      }
    };
  }, [isAnimationMode, render]);

  useEffect(() => {
    return () => {
      if (renderRequestRef.current) {
        cancelAnimationFrame(renderRequestRef.current);
        renderRequestRef.current = null;
      }

      if (mainRenderRequestRef.current) {
        cancelAnimationFrame(mainRenderRequestRef.current);
        mainRenderRequestRef.current = null;
      }

      if (overlayRenderRequestRef.current) {
        cancelAnimationFrame(overlayRenderRequestRef.current);
        overlayRenderRequestRef.current = null;
      }

      if (pendingCountUpdateRef.current) {
        cancelAnimationFrame(pendingCountUpdateRef.current);
        pendingCountUpdateRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isAdmin && isHeatmapModeRef.current) {
      setIsHeatmapMode(false);
      isHeatmapModeRef.current = false;
      requestRender();
    }
  }, [isAdmin, render]);

  useEffect(() => {
    const animate = () => {
      if (isPaintModeRef.current) {
        requestRender();
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPaintMode) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPaintMode, render]);

  useEffect(() => {
    if (!leaderboardType) return;

    setAnimateBars(false);
    setShowFullLeaderboard(false);

    const timer = setTimeout(() => {
      setAnimateBars(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [activeLeaderboardTab, leaderboardType]);

  const drawObjectToDataCanvas = useCallback((obj) => {
    if (!dataCanvasRef.current || !obj?.pixels) return;

    const dctx = dataCanvasRef.current.getContext('2d');
    if (!dctx) return;

    obj.pixels.forEach((p) => {
      dctx.fillStyle = p.color;
      dctx.fillRect(p.x, p.y, 1, 1);
    });
  }, []);

  const redrawDataCanvas = useCallback(() => {
    if (!dataCanvasRef.current || !bgImageRef.current) return;

    const { width, height } = imageSizeRef.current;

    dataCanvasRef.current.width = width;
    dataCanvasRef.current.height = height;

    const dctx = dataCanvasRef.current.getContext('2d');
    dctx.clearRect(0, 0, width, height);

    objectsRef.current.forEach((obj) => {
      obj.pixels.forEach((p) => {
        dctx.fillStyle = p.color;
        dctx.fillRect(p.x, p.y, 1, 1);
      });
    });
  }, []);

  useEffect(() => {
    redrawDataCanvas();
    requestRender();
  }, [objects, redrawDataCanvas, requestRender]);

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
    requestRender();

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

      requestRender();
    };
  }, [floor, redrawDataCanvas, render, resetTransformToImage]);

  useEffect(() => {
    if (!isImageLoaded) return;

    const resize = () => {
      if (canvasRef.current && containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        
        canvasRef.current.width = w;
        canvasRef.current.height = h;

        overlayCanvasRef.current.width = w;
        overlayCanvasRef.current.height = h;

        const { width, height } = imageSizeRef.current;
        const { x, y, scale } = transformRef.current;

        if (x === 0 && y === 0 && scale === 1) {
          const initScale = getFitScale(canvasRef.current, width, height);
          const initX = (canvasRef.current.width - width * initScale) / 2;
          const initY = (canvasRef.current.height - height * initScale) / 2;

          transformRef.current = clampTransform(initX, initY, initScale);
        } else {
          transformRef.current = clampTransform(x, y, scale);
        }

        requestRender();
      }
    };

    window.addEventListener('resize', resize);
    resize();

    return () => window.removeEventListener('resize', resize);
  }, [render, clampTransform, isImageLoaded, getFitScale]);

  const handlePointerDown = (e) => {
    if (!isImageLoaded) return;
    if (e.target.closest('.admin-tooltip')) return;

    pointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY
    });

    e.currentTarget.setPointerCapture(e.pointerId);

    if (pointersRef.current.size >= 2) {
      isPinchingRef.current = true;
      isDraggingRef.current = false;
      draggedRef.current = true;
      hadMultiTouchRef.current = true;

      hoverPixelRef.current = null;

      const pts = Array.from(pointersRef.current.values()).slice(0, 2);
      const rect = canvasRef.current.getBoundingClientRect();

      const dist = Math.hypot(
        pts[0].x - pts[1].x,
        pts[0].y - pts[1].y
      );

      const centerX = (pts[0].x + pts[1].x) / 2 - rect.left;
      const centerY = (pts[0].y + pts[1].y) / 2 - rect.top;

      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = transformRef.current.scale;

      pinchStartCenterRef.current = {
        x: centerX,
        y: centerY
      };

      pinchStartTransformRef.current = {
        ...transformRef.current
      };

      requestRender();
      return;
    }

    if (pointersRef.current.size === 1) {
      isDraggingRef.current = true;
      draggedRef.current = false;
      lastMousePosRef.current = {
        x: e.clientX,
        y: e.clientY
      };

      if (isPaintModeRef.current) {
        updateHoverPixelFromClient(e.clientX, e.clientY);
      }
    }
  };

  const handlePointerMove = (e) => {
    if (!isImageLoaded) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!pointersRef.current.has(e.pointerId)) {
      updateHoverPixelFromClient(e.clientX, e.clientY);
      return;
    }

    pointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY
    });

    if (isPinchingRef.current && pointersRef.current.size >= 2) {
      const pts = Array.from(pointersRef.current.values()).slice(0, 2);
      const rect = canvas.getBoundingClientRect();

      const dist = Math.hypot(
        pts[0].x - pts[1].x,
        pts[0].y - pts[1].y
      );

      const currentCenterX = (pts[0].x + pts[1].x) / 2 - rect.left;
      const currentCenterY = (pts[0].y + pts[1].y) / 2 - rect.top;

      const scaleFactor = dist / pinchStartDistRef.current;
      const rawScale = pinchStartScaleRef.current * scaleFactor;

      const { width, height } = imageSizeRef.current;
      const minScale = getFitScale(canvas, width, height);

      const newScale = Math.max(
        minScale,
        Math.min(rawScale, 50)
      );

      const startCenter = pinchStartCenterRef.current;
      const startTransform = pinchStartTransformRef.current;

      const scaleRatio = newScale / startTransform.scale;

      const newX =
        currentCenterX -
        (startCenter.x - startTransform.x) * scaleRatio;

      const newY =
        currentCenterY -
        (startCenter.y - startTransform.y) * scaleRatio;

      transformRef.current = clampTransform(newX, newY, newScale);

      hoverPixelRef.current = null;
      draggedRef.current = true;
      hadMultiTouchRef.current = true;

      requestRender();
      return;
    }

    if (isDraggingRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;

      if (!draggedRef.current && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        draggedRef.current = true;
      }

      if (isPaintModeRef.current) {
        const pixel = updateHoverPixelFromClient(e.clientX, e.clientY);

        if (pixel) {
          paintPixel(pixel.x, pixel.y, colorRef.current);
        }

        lastMousePosRef.current = {
          x: e.clientX,
          y: e.clientY
        };

        requestOverlayRender();
        return;
      } else {
        const { x, y, scale } = transformRef.current;
        transformRef.current = clampTransform(x + dx, y + dy, scale);

        lastMousePosRef.current = {
          x: e.clientX,
          y: e.clientY
        };

        requestRender();
        return;
      }
    }

    updateHoverPixelFromClient(e.clientX, e.clientY);
  };

  const fetchObjectAtPixel = async (targetFloor, x, y) => {
    try {
      const res = await fetch(
        `/api/paint/object-at?floor=${targetFloor}&x=${x}&y=${y}`
      );

      const json = await res.json();

      if (json.success) {
        return json.data;
      }
    } catch (e) {}

    return null;
  };

  const handlePointerUp = async (e) => {
    if (!isImageLoaded) return;

    const wasPinching = isPinchingRef.current;

    pointersRef.current.delete(e.pointerId);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (pointersRef.current.size < 2) {
      isPinchingRef.current = false;
    }

    if (wasPinching || hadMultiTouchRef.current) {
      isDraggingRef.current = false;
      draggedRef.current = true;
      hoverPixelRef.current = null;

      if (pointersRef.current.size === 0) {
        hadMultiTouchRef.current = false;
      }

      requestRender();
      return;
    }

    if (isDraggingRef.current && !draggedRef.current) {
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
        } else {
          if (isAdmin && isNoteAddModeRef.current) {
            setNoteEditor({
              id: null,
              floor: floorRef.current,
              x: pixelX,
              y: pixelY,
              icon: "📌",
              title: "",
              body: "",
            });

            setSelectedNote(null);
            setShowNoteModal(true);

            render();
            return;
          }

          const clickedNote = findCanvasNoteAtPixel(pixelX, pixelY);

          if (clickedNote) {
            setSelectedNote(clickedNote);

            setNoteEditor({
              id: clickedNote._id,
              floor: clickedNote.floor,
              x: clickedNote.x,
              y: clickedNote.y,
              icon: clickedNote.icon || "📌",
              title: clickedNote.title || "",
              body: clickedNote.body || "",
            });

            setShowNoteModal(true);

            render();
            return;
          }

          if (isAdmin && !isHeatmapModeRef.current) {
            let clickedId = null;

            for (let i = objectsRef.current.length - 1; i >= 0; i--) {
              const obj = objectsRef.current[i];

              if (obj.pixels.find((p) => p.x === pixelX && p.y === pixelY)) {
                clickedId = obj._id;
                break;
              }
            }

            if (clickedId !== selectedObjectIdRef.current) {
              setSelectedObjectId(clickedId);
              selectedObjectIdRef.current = clickedId;

              if (clickedId) {
                setTooltipPos({
                  x: e.clientX,
                  y: e.clientY,
                });
              }
            } else {
              setSelectedObjectId(null);
              selectedObjectIdRef.current = null;
            }

            render();
          }
        }
      }
    }

    if (pointersRef.current.size === 0) {
      isDraggingRef.current = false;
      isPinchingRef.current = false;
      hadMultiTouchRef.current = false;
    }

    draggedRef.current = false;
  };

  const handleWheel = useCallback((e) => {
    if (!isImageLoaded) return;

    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y, scale } = transformRef.current;

    if (e.ctrlKey) {
      const rect = canvas.getBoundingClientRect();

      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const zoomFactor = 1.1;

      let newScale = e.deltaY < 0
          ? scale * zoomFactor
          : scale / zoomFactor;

      const { width, height } = imageSizeRef.current;

      const minScale = getFitScale(canvas, width, height);

      newScale = Math.max(minScale, Math.min(newScale, 50));

      const newX = cursorX - (cursorX - x) * (newScale / scale);
      const newY = cursorY - (cursorY - y) * (newScale / scale);

      transformRef.current = clampTransform(newX, newY, newScale);
    } else if (e.shiftKey) {
      const scrollAmount = Math.abs(e.deltaY) > Math.abs(e.deltaX)
          ? e.deltaY
          : e.deltaX;

      const moveAmount = 30;

      const newX = scrollAmount > 0
          ? x - moveAmount
          : x + moveAmount;

      transformRef.current = clampTransform(newX, y, scale);
    } else {
      const scrollAmount = 20;

      const newY = e.deltaY > 0
          ? y - scrollAmount
          : y + scrollAmount;

      transformRef.current = clampTransform(x, newY, scale);
    }

    requestRender();
  }, [requestRender, clampTransform, isImageLoaded, getFitScale]);

  const handlePointerOut = (e) => {
    if (e?.pointerId != null) {
      pointersRef.current.delete(e.pointerId);
    }

    if (pointersRef.current.size < 2) {
      isPinchingRef.current = false;
    }

    if (pointersRef.current.size === 0) {
      isDraggingRef.current = false;
    }

    if (hoverPixelRef.current) {
      hoverPixelRef.current = null;
      requestOverlayRender();
    }
  };

  const paintPixel = (px, py, paintColor, options = {}) => {
    if (!session) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (floorRef.current !== 1 && isWhiteBackgroundPixel(px, py)) {
      return;
    }

    const existingIdx = pendingPixelsRef.current.findIndex(
      (p) => p.x === px && p.y === py
    );

    if (isEraserModeRef.current) {
      if (existingIdx !== -1) {
        pendingPixelsRef.current.splice(existingIdx, 1);

        requestPendingCountUpdate();
        requestOverlayRender();
      }

      return;
    }

    if (existingIdx !== -1) {
      const existingPixel = pendingPixelsRef.current[existingIdx];

      pendingPixelsRef.current[existingIdx] = {
        ...existingPixel,
        color: paintColor
      };
    } else {
      pendingPixelsRef.current.push({
        x: px,
        y: py,
        color: paintColor
      });
    }

    requestPendingCountUpdate();
    requestOverlayRender();
  };

  useEffect(() => {
    const canvas = overlayCanvasRef.current;

    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, {
      passive: false
    });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  return (
      <div className="flex flex-col h-[100dvh] w-full bg-gray-50 text-black font-sans overflow-hidden">
        <div className="absolute top-4 right-4 z-20 flex items-center gap-3">

          <button
              onClick={() => setShowHelpModal(true)}
              className="w-12 h-12 bg-white hover:bg-gray-100 text-black border border-gray-200 rounded-full shadow-md font-black transition-colors flex items-center justify-center text-xl"
              title="사용 설명"
          >
            ?
          </button>

          <button
              onClick={() => openLeaderboard("admin")}
              className="w-12 h-12 bg-white hover:bg-gray-100 text-black border border-gray-200 rounded-full shadow-md font-bold transition-colors flex items-center justify-center text-lg"
              title="통계"
          >
            📊
          </button>

          <button
            onClick={() => setAnimationMode(!isAnimationModeRef.current)}
            className={`h-12 px-4 rounded-full border shadow-md font-bold transition-colors flex items-center justify-center text-xs whitespace-nowrap ${
              isAnimationMode
                ? 'bg-purple-500 text-white border-purple-600 hover:bg-purple-600'
                : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-100'
            }`}
            title="애니메이션 모드 ON/OFF"
          >
            애니메이션 {isAnimationMode ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setHeatmapMode(!isHeatmapModeRef.current)}
            className={`h-12 px-4 rounded-full border shadow-md font-bold transition-colors flex items-center justify-center text-xs whitespace-nowrap ${
              isHeatmapMode
                ? 'bg-red-500 text-white border-red-600 hover:bg-red-600'
                : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-100'
            }`}
            title="히트맵 모드 ON/OFF"
          >
            히트맵 {isHeatmapMode ? 'ON' : 'OFF'}
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                const next = !isNoteAddModeRef.current;

                isNoteAddModeRef.current = next;
                setIsNoteAddMode(next);

                if (next) {
                  setIsPaintMode(false);

                  setSelectedObjectId(null);
                  selectedObjectIdRef.current = null;
                }
              }}
              className={`h-12 px-4 rounded-full border shadow-md font-bold transition-colors flex items-center justify-center text-xs whitespace-nowrap ${
                isNoteAddMode
                  ? "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-100"
              }`}
              title="설명글 추가 모드"
            >
              설명글 {isNoteAddMode ? "ON" : "OFF"}
            </button>
          )}

          {isAdmin && (
            <button
              onClick={async () => {
                if (!window.confirm("PixelState를 재빌드할까요?")) return;

                const res = await fetch(`/api/admin/rebuild-pixel-state`, {
                  method: "POST",
                });

                const json = await res.json();

                if (json.success) {
                  alert(`재빌드 완료: ${json.rebuilt}개 픽셀`);
                  fetchObjects();
                } else {
                  alert(json.error || "재빌드 실패");
                }
              }}
              className="h-12 px-4 rounded-full border shadow-md font-bold bg-black text-white text-xs whitespace-nowrap"
            >
              픽셀 재빌드
            </button>
          )}

          {showNoteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-[92vw] max-w-md p-6 text-black">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-black">
                      {isAdmin ? "캔버스 설명글" : selectedNote?.title || "설명글"}
                    </h2>

                    <p className="text-xs text-gray-400 mt-1">
                      {noteEditor.floor}층 · ({noteEditor.x}, {noteEditor.y})
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setShowNoteModal(false);
                      setSelectedNote(null);
                    }}
                    className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 font-bold shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {isAdmin ? (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-[64px_1fr_1fr] gap-2">
                      <input
                        value={noteEditor.icon}
                        onChange={(e) =>
                          setNoteEditor((prev) => ({
                            ...prev,
                            icon: e.target.value.slice(0, 4),
                          }))
                        }
                        className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-center"
                        maxLength={4}
                        placeholder="📌"
                      />

                      <input
                        type="number"
                        value={noteEditor.x}
                        onChange={(e) =>
                          setNoteEditor((prev) => ({
                            ...prev,
                            x: Number(e.target.value),
                          }))
                        }
                        className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
                        placeholder="x"
                      />

                      <input
                        type="number"
                        value={noteEditor.y}
                        onChange={(e) =>
                          setNoteEditor((prev) => ({
                            ...prev,
                            y: Number(e.target.value),
                          }))
                        }
                        className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
                        placeholder="y"
                      />
                    </div>

                    <input
                      value={noteEditor.title}
                      onChange={(e) =>
                        setNoteEditor((prev) => ({
                          ...prev,
                          title: e.target.value.slice(0, 80),
                        }))
                      }
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
                      placeholder="제목"
                      maxLength={80}
                    />

                    <textarea
                      value={noteEditor.body}
                      onChange={(e) =>
                        setNoteEditor((prev) => ({
                          ...prev,
                          body: e.target.value.slice(0, 1000),
                        }))
                      }
                      className="w-full min-h-[160px] px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="설명글을 입력하세요."
                      maxLength={1000}
                    />

                    <div className="text-[10px] text-right text-gray-400">
                      {noteEditor.body.length}/1000
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={saveCanvasNote}
                        className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold"
                      >
                        저장
                      </button>

                      {noteEditor.id && (
                        <button
                          onClick={deleteCanvasNote}
                          className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-4xl mb-3">
                      {selectedNote?.icon || "📌"}
                    </div>

                    <h3 className="text-lg font-black mb-2">
                      {selectedNote?.title || "제목 없음"}
                    </h3>

                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[100px]">
                      {selectedNote?.body?.trim()
                        ? selectedNote.body
                        : "등록된 설명글이 없습니다."}
                    </div>

                    <button
                      onClick={() => {
                        setShowNoteModal(false);
                        setSelectedNote(null);
                      }}
                      className="mt-6 w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold"
                    >
                      확인
                    </button>
                  </div>
                )}
              </div>
            </div>
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
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                </svg>
              </button>
          )}
        </div>

        <div className="absolute top-4 left-4 z-20 flex flex-col items-center gap-2 bg-white/90 backdrop-blur shadow-xl border border-gray-200 p-3 rounded-2xl">
          <span className="text-sm font-bold text-gray-700">층</span>

          <div className="flex flex-col gap-1 items-center bg-gray-100 p-1 rounded-xl">
            {[5, 4, 3, 2, 1].map((f) => (
                <button
                    key={f}
                    onClick={() => handleFloorChange(f)}
                    className={`w-8 h-8 rounded-lg font-bold text-sm transition-colors ${
                        floor === f
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'text-gray-500 hover:bg-gray-200'
                    }`}
                    title={`${f}층으로 이동`}
                >
                  {f}F
                </button>
            ))}
          </div>

          <span className="text-xs text-gray-400 mt-1">Q(↓) E(↑)</span>
        </div>

        {/*{showModal && (*/}
        {/*    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">*/}
        {/*      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-black mx-4">*/}
        {/*        <h2 className="text-2xl font-bold mb-5 text-gray-800">⚠ 읽어주세요!</h2>*/}

        {/*        <h2 className="mb-5 text-gray-800">*/}
        {/*          The Place에 오신 것을 환영합니다. 아래 사항들을 읽고, The Place를 즐겨주시면 좋겠습니다.*/}
        {/*        </h2>*/}

        {/*        <ul className="list-disc pl-5 space-y-3 mb-8 text-gray-600">*/}
        {/*          <li>*/}
        {/*            The Place는 SASA의 학생들이 <a className="underline font-bold">자유롭게</a> SASA를 색칠할 수 있는 온라인 공간입니다. SASA의 공간에 여러분들의 용기, 도전, 꿈을 마음껏 표현해주세요.*/}
        {/*          </li>*/}
        {/*          <li>*/}
        {/*            그러나 The Place는 접속한 모두가 볼 수 있는 <a className="underline font-bold">공용 캔버스</a>이기도 합니다. 이 사실에 유념하여 이용해주세요. 관리자는 부적절한 그림을 삭제할 수 있습니다!*/}
        {/*          </li>*/}
        {/*          <li>*/}
        {/*            모두 확인하였다면, 아래 '확인했습니다' 버튼을 누르고 The Place 이용을 시작해주세요.*/}
        {/*          </li>*/}
        {/*        </ul>*/}

        {/*        <button*/}
        {/*            onClick={() => setShowModal(false)}*/}
        {/*            className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors shadow-sm"*/}
        {/*        >*/}
        {/*          확인했습니다*/}
        {/*        </button>*/}
        {/*      </div>*/}
        {/*    </div>*/}
        {/*)}*/}

        {showHelpModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-[95vw] max-w-5xl max-h-[85vh] overflow-hidden text-black flex flex-col">
                <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                      이용 안내
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                      The Place
                    </p>
                  </div>

                  <button
                      onClick={() => setShowHelpModal(false)}
                      className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 font-bold shrink-0"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-7">

                  <section>
                    <h3 className="text-xl font-black mb-3 flex items-center gap-2">
                      🏫 캔버스
                    </h3>

                    <ul className="space-y-3 text-gray-700 leading-relaxed list-disc pl-5">
                      <li>
                        The Place의 캔버스는 <strong>학교 공간</strong>입니다.
                      </li>
                      <li>
                        Ctrl + 마우스 휠로 확대/축소, 일반 마우스 휠로 수직 이동, Shift + 마우스 휠로 수평 이동, 드래그로 자유 이동이 가능합니다.
                      </li>
                      <li>
                        화면 왼쪽 위의 층 선택 버튼을 눌러 <strong>1층부터 5층까지</strong> 수직적으로 이동할 수 있습니다.
                      </li>
                      <li>
                        키보드 단축키도 사용할 수 있습니다.
                        <strong> Q</strong> 키를 누르면 아래층으로, <strong>E</strong> 키를 누르면 위층으로 이동합니다.
                      </li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-black mb-3 flex items-center gap-2">
                      📊 통계
                    </h3>

                    <ul className="space-y-3 text-gray-700 leading-relaxed list-disc pl-5">
                      <li>
                        화면 오른쪽 위의 <strong>📊</strong> 플로팅 버튼을 눌러 통계를 확인할 수 있습니다.
                      </li>
                      <li>
                        리더보드에서는 <strong>개인별 픽셀 수</strong>, <strong>개인별 그린 시간</strong>, <strong>개인별 픽셀/시간</strong>, <strong>반별 픽셀 수</strong>,
                        <strong> 학년별 픽셀 수</strong>, <strong>층별 픽셀 수</strong>, <strong>위치별 수정 횟수</strong> 통계를 볼 수 있습니다.
                      </li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-black mb-3 flex items-center gap-2">
                      ⚙️ 추가 기능
                    </h3>

                    <ul className="space-y-3 text-gray-700 leading-relaxed list-disc pl-5">
                      <li>
                        화면 오른쪽 위의 애니메이션 ON/OFF, 히트맵 ON/OFF를 눌러 각 모드를 활성화할 수 있습니다.
                      </li>
                    </ul>
                  </section>
                </div>
              </div>
            </div>
        )}

        {leaderboardType && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-[96vw] h-[90vh] max-w-6xl overflow-hidden text-black flex flex-col">
                <div className="flex items-start justify-between px-5 sm:px-7 py-5 border-b border-gray-100">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                      통계
                    </h2>
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
                          {(
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

        <div
            className={`absolute inset-0 z-10 bg-white transition-opacity duration-300 pointer-events-none ${
                isFading
                    ? 'opacity-100'
                    : 'opacity-0'
            }`}
        />

        <div
            ref={containerRef}
            className="flex-1 relative overflow-hidden bg-gray-200"
            style={{
              touchAction: 'none'
            }}
        >
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full touch-none pointer-events-none"
          />

          <canvas
            ref={overlayCanvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerOut}
            onPointerCancel={handlePointerOut}
            className={`absolute top-0 left-0 w-full h-full touch-none ${
              isPaintMode
                ? 'cursor-crosshair'
                : isDraggingRef.current && !isPaintMode
                  ? 'cursor-grabbing'
                  : 'cursor-grab'
            }`}
          />

          {isAdmin && isAnimationMode && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-black/70 text-white px-4 py-2 rounded-full text-xs font-bold pointer-events-none">
              애니메이션 재생 중 · {Math.round(animationProgress * 100)}%
            </div>
          )}

          {isAdmin && selectedObject && (
            <div
              className="admin-tooltip absolute z-30 bg-white/95 p-3 rounded-xl shadow-lg border border-gray-200 pointer-events-auto flex flex-col gap-2"
              style={{
                left: tooltipPos.x + 15,
                top: tooltipPos.y + 15
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="text-sm">
                <p>
                  <strong>작성자:</strong> {selectedObject.userEmail || '알수없음'}
                </p>

                <p>
                  <strong>크기:</strong> {selectedObject.pixels?.length || 0} 픽셀
                </p>

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
          )}

          <div
            className="absolute z-20 transition-opacity duration-300"
            style={
              isPaintMode && palettePos
                ? {
                    left: palettePos.left,
                    top: palettePos.top,
                    transform: 'translate(-50%, -50%)'
                  }
                : {
                    left: '50%',
                    bottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)',
                    transform: 'translateX(-50%)'
                  }
            }
          >
            <div
              ref={palettePanelRef}
              className={`relative flex items-center justify-center bg-white/90 backdrop-blur-lg shadow-2xl border border-gray-200 rounded-2xl md:rounded-3xl overflow-visible box-border ${
                isPaintMode ? 'p-3' : 'p-2'
              }`}
              style={
                isPaintMode
                  ? {
                      width: 'min(380px, calc(100vw - 1rem))'
                    }
                  : {
                      width: 'fit-content'
                    }
              }
            >
              {isPaintMode && (
                <button
                  type="button"
                  onPointerDown={handlePaletteHandlePointerDown}
                  onPointerMove={handlePaletteHandlePointerMove}
                  onPointerUp={handlePaletteHandlePointerUp}
                  onPointerCancel={handlePaletteHandlePointerUp}
                  className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-white text-gray-700 border border-gray-300 shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing z-30 font-bold"
                  title="팔레트 이동"
                  aria-label="팔레트 이동"
                >
                  ⋮⋮
                </button>
              )}
              {!isPaintMode && (
                  <button
                      onClick={() => session ? setIsPaintMode(true) : signIn('google')}
                      className="px-5 py-3 rounded-full font-bold transition-transform hover:scale-105 active:scale-95 whitespace-nowrap bg-blue-500 text-white shadow-md"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-brush" viewBox="0 0 16 16">
                      <path d="M15.825.12a.5.5 0 0 1 .132.584c-1.53 3.43-4.743 8.17-7.095 10.64a6.1 6.1 0 0 1-2.373 1.534c-.018.227-.06.538-.16.868-.201.659-.667 1.479-1.708 1.74a8.1 8.1 0 0 1-3.078.132 4 4 0 0 1-.562-.135 1.4 1.4 0 0 1-.466-.247.7.7 0 0 1-.204-.288.62.62 0 0 1 .004-.443c.095-.245.316-.38.461-.452.394-.197.625-.453.867-.826.095-.144.184-.297.287-.472l.117-.198c.151-.255.326-.54.546-.848.528-.739 1.201-.925 1.746-.896q.19.012.348.048c.062-.172.142-.38.238-.608.261-.619.658-1.419 1.187-2.069 2.176-2.67 6.18-6.206 9.117-8.104a.5.5 0 0 1 .596.04M4.705 11.912a1.2 1.2 0 0 0-.419-.1c-.246-.013-.573.05-.879.479-.197.275-.355.532-.5.777l-.105.177c-.106.181-.213.362-.32.528a3.4 3.4 0 0 1-.76.861c.69.112 1.736.111 2.657-.12.559-.139.843-.569.993-1.06a3 3 0 0 0 .126-.75zm1.44.026c.12-.04.277-.1.458-.183a5.1 5.1 0 0 0 1.535-1.1c1.9-1.996 4.412-5.57 6.052-8.631-2.59 1.927-5.566 4.66-7.302 6.792-.442.543-.795 1.243-1.042 1.826-.121.288-.214.54-.275.72v.001l.575.575zm-4.973 3.04.007-.005zm3.582-3.043.002.001h-.002z"/>
                    </svg>
                  </button>
              )}

              {isPaintMode && (
                <div className="w-full flex flex-col items-center gap-3 animate-in fade-in duration-300">
                  <div className="flex flex-wrap justify-center gap-1.5 px-1 w-full">
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform shadow-sm ${
                          color === c
                            ? 'border-blue-500 scale-125 z-10'
                            : 'border-white hover:scale-110'
                        }`}
                        style={{
                          backgroundColor: c
                        }}
                        aria-label={`Select color ${c}`}
                      />
                    ))}

                    <label
                      className={`relative w-6 h-6 rounded-full border-2 transition-transform shadow-sm cursor-pointer hover:scale-110 overflow-hidden ${
                        !PALETTE.includes(color)
                          ? 'border-blue-500 scale-125 z-10'
                          : 'border-white'
                      }`}
                      style={{
                        background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)'
                      }}
                      title="직접 색상 선택"
                      aria-label="직접 색상 선택"
                    >
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => {
                          const nextColor = e.target.value.toUpperCase();
                          setCustomColor(nextColor);
                          setColor(nextColor);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={setEraserMode}
                      className={`w-6 h-6 rounded-full border-2 transition-transform shadow-sm hover:scale-110 flex items-center justify-center text-[11px] ${
                        isEraserMode
                          ? 'border-red-500 scale-125 z-10 bg-red-500 text-white'
                          : 'border-white bg-white'
                      }`}
                      title="지우개"
                      aria-label="지우개"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eraser-fill" viewBox="0 0 16 16">
                        <path d="M8.086 2.207a2 2 0 0 1 2.828 0l3.879 3.879a2 2 0 0 1 0 2.828l-5.5 5.5A2 2 0 0 1 7.879 15H5.12a2 2 0 0 1-1.414-.586l-2.5-2.5a2 2 0 0 1 0-2.828zm.66 11.34L3.453 8.254 1.914 9.793a1 1 0 0 0 0 1.414l2.5 2.5a1 1 0 0 0 .707.293H7.88a1 1 0 0 0 .707-.293z"/>
                      </svg>
                    </button>
                  </div>

                  {pendingPixelCount > 0 && (
                    <button
                      onClick={savePainting}
                      className="w-full px-6 py-3 rounded-xl font-bold transition-colors whitespace-nowrap bg-green-500 hover:bg-green-600 text-white shadow-lg"
                    >
                      그리기 완료!
                    </button>
                  )}
                </div>
              )}

              {isPaintMode && (
                  <button
                      onClick={() => setIsPaintMode(false)}
                      className="absolute -top-3 -right-3 w-8 h-8 bg-gray-800 text-white hover:bg-black rounded-full flex items-center justify-center font-bold shadow-lg border-2 border-white transition-colors"
                  >
                    ✕
                  </button>
              )}
            </div>
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

  const myItem = currentUserEmail
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
              isMine
                  ? "bg-blue-50 rounded-2xl px-3 -mx-3"
                  : ""
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