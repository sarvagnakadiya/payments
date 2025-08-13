import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get("fid");
    const status = searchParams.get("status");
    const type = searchParams.get("type"); // "sent" or "received"

    if (!fid) {
      return NextResponse.json(
        { error: "fid parameter is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { fid } });
    if (!user) {
      return NextResponse.json(
        { error: "User not found for provided fid" },
        { status: 404 }
      );
    }

    const whereClause: any = {};
    if (type === "sent") {
      whereClause.senderId = user.id;
    } else if (type === "received") {
      whereClause.receiverId = user.id;
    } else {
      whereClause.OR = [{ senderId: user.id }, { receiverId: user.id }];
    }

    if (status) {
      whereClause.status = status;
    }

    const fundRequests = await prisma.fundRequest.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            fid: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            fid: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ fundRequests });
  } catch (error) {
    console.error("Failed to fetch fund requests by fid:", error);
    return NextResponse.json(
      { error: "Failed to fetch fund requests" },
      { status: 500 }
    );
  }
}
