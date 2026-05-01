import dbConnect from '@/lib/mongodb';
import PaintObject from '@/lib/PaintObject';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const floor = parseInt(searchParams.get('floor')) || 1;

  const objects = await PaintObject.find({ floor }).sort({ createdAt: 1 }).lean();
  return Response.json({ success: true, data: objects });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  const body = await req.json();
  const { pixels, floor, paintStartedAt } = body;

  if (!pixels || pixels.length === 0) {
    return Response.json({ success: false, error: 'No pixels provided' }, { status: 400 });
  }

  const startedAt = paintStartedAt ? new Date(paintStartedAt) : new Date();
  const postedAt = new Date();

  const durationMs = postedAt.getTime() - startedAt.getTime();
  const durationSeconds = Math.floor(durationMs / 1000);

  const paintObj = new PaintObject({
    userEmail: session.user.email,
    userName: session.user.name,
    floor: floor || 1,
    pixels,
    paintStartedAt: startedAt,
    postedAt,
    durationMs,
    durationSeconds
  });

  await paintObj.save();

  return Response.json({ success: true, data: paintObj });
}