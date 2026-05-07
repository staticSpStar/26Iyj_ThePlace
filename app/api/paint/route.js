import dbConnect from '@/lib/mongodb';
import PaintObject from '@/lib/PaintObject';
import PixelState from '@/lib/PixelState';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const floor = parseInt(searchParams.get('floor')) || 1;
  const mode = searchParams.get('mode') || 'current';

  // 애니메이션/관리자 분석용: 필요할 때만 전체 history 반환
  if (mode === 'history') {
    const objects = await PaintObject.find({ floor })
      .select('pixels floor userEmail userName paintStartedAt postedAt durationMs durationSeconds createdAt updatedAt')
      .sort({ postedAt: 1, createdAt: 1 })
      .lean();

    return Response.json({
      success: true,
      mode: 'history',
      data: objects,
    });
  }

  // 기본 화면용: 현재 최종 픽셀 상태만 반환
  const pixels = await PixelState.find({ floor })
    .select('x y color editCount lastObjectId -_id')
    .lean();

  return Response.json({
    success: true,
    mode: 'current',
    data: [
      {
        _id: `floor-${floor}-current`,
        floor,
        isSnapshot: true,
        pixels,
      },
    ],
  });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return Response.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  await dbConnect();

  const body = await req.json();
  const { pixels, floor, paintStartedAt } = body;

  if (!Array.isArray(pixels) || pixels.length === 0) {
    return Response.json(
      { success: false, error: 'No pixels provided' },
      { status: 400 }
    );
  }

  const targetFloor = floor || 1;

  // 같은 요청 안에서 같은 좌표가 여러 번 들어오면 마지막 색만 반영
  const pixelMap = new Map();

  for (const p of pixels) {
    const x = Number(p.x);
    const y = Number(p.y);

    if (!Number.isInteger(x) || !Number.isInteger(y) || !p.color) {
      continue;
    }

    pixelMap.set(`${x}:${y}`, {
      x,
      y,
      color: p.color,
    });
  }

  const normalizedPixels = Array.from(pixelMap.values());

  if (normalizedPixels.length === 0) {
    return Response.json(
      { success: false, error: 'No valid pixels provided' },
      { status: 400 }
    );
  }

  const startedAt = paintStartedAt ? new Date(paintStartedAt) : new Date();
  const postedAt = new Date();

  const durationMs = postedAt.getTime() - startedAt.getTime();
  const durationSeconds = Math.max(0, Math.floor(durationMs / 1000));

  // 1. 원본 history 저장
  const paintObj = new PaintObject({
    userEmail: session.user.email,
    userName: session.user.name,
    floor: targetFloor,
    pixels: normalizedPixels,
    paintStartedAt: startedAt,
    postedAt,
    durationMs,
    durationSeconds,
  });

  await paintObj.save();

  // 2. 현재 최종 상태 캐시 갱신
  await PixelState.bulkWrite(
    normalizedPixels.map((p) => ({
      updateOne: {
        filter: {
          floor: targetFloor,
          x: p.x,
          y: p.y,
        },
        update: {
          $set: {
            color: p.color,
            lastObjectId: paintObj._id,
            lastEditedBy: session.user.email,
            lastEditedAt: postedAt,
          },
          $inc: {
            editCount: 1,
          },
        },
        upsert: true,
      },
    }))
  );

  return Response.json({
    success: true,
    data: paintObj,
  });
}