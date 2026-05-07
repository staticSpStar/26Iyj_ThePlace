import dbConnect from "@/lib/mongodb";
import PaintObject from "@/lib/PaintObject";
import PixelState from "@/lib/PixelState";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function POST(req) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email || !ADMIN_EMAILS.includes(email)) {
    return Response.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const floorParam = searchParams.get("floor");
  const targetFloor = floorParam ? parseInt(floorParam) : null;

  const filter = targetFloor ? { floor: targetFloor } : {};

  const objects = await PaintObject.find(filter)
    .sort({ postedAt: 1, createdAt: 1 })
    .lean();

  // 중요: PaintObject는 절대 삭제하지 않음
  if (targetFloor) {
    await PixelState.deleteMany({ floor: targetFloor });
  } else {
    await PixelState.deleteMany({});
  }

  const pixelMap = new Map();

  for (const obj of objects) {
    const floor = obj.floor || 1;

    if (!Array.isArray(obj.pixels)) continue;

    for (const p of obj.pixels) {
      const x = Number(p.x);
      const y = Number(p.y);

      if (!Number.isInteger(x) || !Number.isInteger(y) || !p.color) {
        continue;
      }

      const key = `${floor}:${x}:${y}`;
      const prev = pixelMap.get(key);

      pixelMap.set(key, {
        floor,
        x,
        y,
        color: p.color,
        editCount: (prev?.editCount || 0) + 1,
        lastObjectId: obj._id,
        lastEditedBy: obj.userEmail,
        lastEditedAt: obj.postedAt || obj.createdAt || new Date(),
      });
    }
  }

  const states = Array.from(pixelMap.values());

  if (states.length > 0) {
    await PixelState.bulkWrite(
      states.map((state) => ({
        updateOne: {
          filter: {
            floor: state.floor,
            x: state.x,
            y: state.y,
          },
          update: {
            $set: state,
          },
          upsert: true,
        },
      }))
    );
  }

  return Response.json({
    success: true,
    rebuilt: states.length,
    floors: targetFloor ? [targetFloor] : "all",
  });
}