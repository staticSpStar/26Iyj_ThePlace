import dbConnect from "@/lib/mongodb";
import CanvasNote from "@/lib/CanvasNote";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const ADMIN_EMAILS = ["mainforwoo@sasa.hs.kr", "mojin81@sasa.hs.kr"];

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());
}

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const floor = parseInt(searchParams.get("floor")) || 1;

  const notes = await CanvasNote.find({ floor })
    .sort({ createdAt: 1 })
    .lean();

  return Response.json({
    success: true,
    data: notes,
  });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const email = session.user?.email;

  if (!isAdminEmail(email)) {
    return Response.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  await dbConnect();

  const body = await req.json();

  const floor = parseInt(body.floor) || 1;
  const x = Number(body.x);
  const y = Number(body.y);

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return Response.json(
      { success: false, error: "Invalid coordinates" },
      { status: 400 }
    );
  }

  const note = await CanvasNote.create({
    floor,
    x,
    y,
    title: String(body.title || "").slice(0, 80),
    body: String(body.body || "").slice(0, 1000),
    icon: String(body.icon || "📌").slice(0, 4),
    createdByEmail: email,
    createdByName: session.user?.name || "",
    lastEditedByEmail: email,
    lastEditedAt: new Date(),
  });

  return Response.json({
    success: true,
    data: note,
  });
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const email = session.user?.email;

  if (!isAdminEmail(email)) {
    return Response.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  await dbConnect();

  const body = await req.json();
  const id = body.id;

  if (!id) {
    return Response.json(
      { success: false, error: "id is required" },
      { status: 400 }
    );
  }

  const update = {
    title: String(body.title || "").slice(0, 80),
    body: String(body.body || "").slice(0, 1000),
    icon: String(body.icon || "📌").slice(0, 4),
    lastEditedByEmail: email,
    lastEditedAt: new Date(),
  };

  if (Number.isInteger(Number(body.x))) {
    update.x = Number(body.x);
  }

  if (Number.isInteger(Number(body.y))) {
    update.y = Number(body.y);
  }

  if (Number.isInteger(Number(body.floor))) {
    update.floor = Number(body.floor);
  }

  const note = await CanvasNote.findByIdAndUpdate(id, update, {
    new: true,
  }).lean();

  if (!note) {
    return Response.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );
  }

  return Response.json({
    success: true,
    data: note,
  });
}

export async function DELETE(req) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const email = session.user?.email;

  if (!isAdminEmail(email)) {
    return Response.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json(
      { success: false, error: "id is required" },
      { status: 400 }
    );
  }

  const deleted = await CanvasNote.findByIdAndDelete(id).lean();

  if (!deleted) {
    return Response.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );
  }

  return Response.json({
    success: true,
    data: deleted,
  });
}