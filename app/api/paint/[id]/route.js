import dbConnect from '@/lib/mongodb';
import PaintObject from '@/lib/PaintObject';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  await dbConnect();
  const deletedObj = await PaintObject.findByIdAndDelete(id);

  if (!deletedObj) {
    return Response.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  return Response.json({ success: true, data: deletedObj });
}
