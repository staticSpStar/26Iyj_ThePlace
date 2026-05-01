import dbConnect from "@/lib/mongodb";
import PaintObject from "@/lib/PaintObject";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getStudentInfoByEmail } from "@/lib/studentInfo";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

function sortDesc(arr, key) {
  return arr.sort((a, b) => b[key] - a[key]);
}

function toArrayFromMap(map, valueKey) {
  return Object.entries(map).map(([label, value]) => ({
    label,
    [valueKey]: value
  }));
}

export async function GET(req) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "user";

  const isAdmin =
      session?.user?.email &&
      ADMIN_EMAILS.includes(session.user.email);

  if (type === "admin" && !isAdmin) {
    return Response.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
    );
  }

  const objects = await PaintObject.find({}).lean();

  const personalMap = {};
  const classPixelMap = {};
  const gradePixelMap = {};
  const floorPixelMap = {};
  const editedPixelMap = {};

  for (const obj of objects) {
    const email = obj.userEmail || "unknown";
    const student = getStudentInfoByEmail(email);

    const pixelCount = obj.pixels?.length || 0;
    const durationSeconds = obj.durationSeconds || 0;
    const floor = obj.floor || 1;

    if (!personalMap[email]) {
      personalMap[email] = {
        email,
        name: student.name || obj.userName || email,
        studentId: student.studentId,
        grade: student.grade,
        classNo: student.classNo,
        classLabel: student.classLabel,
        pixelCount: 0,
        durationSeconds: 0
      };
    }

    personalMap[email].pixelCount += pixelCount;
    personalMap[email].durationSeconds += durationSeconds;

    const classLabel = student.classLabel || "미상";
    const gradeLabel =
        student.grade && student.grade !== "미상"
            ? `${student.grade}학년`
            : "미상";

    classPixelMap[classLabel] =
        (classPixelMap[classLabel] || 0) + pixelCount;

    gradePixelMap[gradeLabel] =
        (gradePixelMap[gradeLabel] || 0) + pixelCount;

    const floorLabel = `${floor}층`;
    floorPixelMap[floorLabel] =
        (floorPixelMap[floorLabel] || 0) + pixelCount;

    if (Array.isArray(obj.pixels)) {
      for (const p of obj.pixels) {
        const key = `${floor}:${p.x}:${p.y}`;
        editedPixelMap[key] = (editedPixelMap[key] || 0) + 1;
      }
    }
  }

  const personal = Object.values(personalMap).map((person) => {
    const pixelsPerSecond =
        person.durationSeconds > 0
            ? person.pixelCount / person.durationSeconds
            : 0;

    return {
      ...person,
      pixelsPerSecond,
      durationText: `${person.durationSeconds}초`
    };
  });

  const personalPixelRanking = sortDesc(
      [...personal],
      "pixelCount"
  ).map((p) => ({
    label: p.name,
    subLabel: p.studentId ? `${p.studentId} · ${p.email}` : p.email,
    value: p.pixelCount,
    valueText: `${p.pixelCount}픽셀`
  }));

  const personalTimeRanking = sortDesc(
      [...personal],
      "durationSeconds"
  ).map((p) => ({
    label: p.name,
    subLabel: p.studentId ? `${p.studentId} · ${p.email}` : p.email,
    value: p.durationSeconds,
    valueText: `${p.durationSeconds}초`
  }));

  const personalSpeedRanking = sortDesc(
      [...personal],
      "pixelsPerSecond"
  ).map((p) => ({
    label: p.name,
    subLabel: p.studentId ? `${p.studentId} · ${p.email}` : p.email,
    value: p.pixelsPerSecond,
    valueText: `${p.pixelsPerSecond.toFixed(2)}픽셀/초`
  }));

  const classPixelRanking = sortDesc(
      toArrayFromMap(classPixelMap, "pixelCount"),
      "pixelCount"
  ).map((item) => ({
    label: item.label,
    value: item.pixelCount,
    valueText: `${item.pixelCount}픽셀`
  }));

  const gradePixelRanking = sortDesc(
      toArrayFromMap(gradePixelMap, "pixelCount"),
      "pixelCount"
  ).map((item) => ({
    label: item.label,
    value: item.pixelCount,
    valueText: `${item.pixelCount}픽셀`
  }));

  const floorPixelRanking = sortDesc(
      toArrayFromMap(floorPixelMap, "pixelCount"),
      "pixelCount"
  ).map((item) => ({
    label: item.label,
    value: item.pixelCount,
    valueText: `${item.pixelCount}픽셀`
  }));

  const editedPixelRanking = Object.entries(editedPixelMap)
      .map(([key, count]) => {
        const [floor, x, y] = key.split(":");

        return {
          label: `${floor}층 (${x}, ${y})`,
          value: count,
          valueText: `${count}회 수정`,
          floor: Number(floor),
          x: Number(x),
          y: Number(y)
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 50);

  const userLeaderboard = {
    personalPixelRanking,
    classPixelRanking,
    gradePixelRanking,
    floorPixelRanking
  };

  const adminLeaderboard = {
    ...userLeaderboard,
    personalTimeRanking,
    personalSpeedRanking,
    editedPixelRanking
  };

  return Response.json({
    success: true,
    type,
    currentUserEmail: session?.user?.email || null,
    data: type === "admin" ? adminLeaderboard : userLeaderboard
  });
}