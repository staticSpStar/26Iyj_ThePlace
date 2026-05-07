import dbConnect from "@/lib/mongodb";
import PixelState from "@/lib/PixelState";
import PaintObject from "@/lib/PaintObject";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function GET(req) {
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

  const floor = parseInt(searchParams.get("floor")) || 1;
  const x = Number(searchParams.get("x"));
  const y = Number(searchParams.get("y"));

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return Response.json(
      { success: false, error: "Invalid coordinates" },
      { status: 400 }
    );
  }

  const pixelState = await PixelState.findOne({
    floor,
    x,
    y,
  }).lean();

  if (!pixelState?.lastObjectId) {
    return Response.json({
      success: true,
      data: null,
      pixelState: null,
    });
  }

  const object = await PaintObject.findById(pixelState.lastObjectId).lean();

  return Response.json({
    success: true,
    data: object || null,
    pixelState,
  });
}