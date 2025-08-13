import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

// Update fund request status by actor fid (receiver or sender), using requestId in body
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid } = await params;
    const body = await request.json();
    const { requestId, status } = body as {
      requestId?: string;
      status?: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
    };

    if (!fid) {
      return NextResponse.json(
        { error: "fid parameter is required" },
        { status: 400 }
      );
    }

    if (!requestId || !status) {
      return NextResponse.json(
        { error: "requestId and status are required in body" },
        { status: 400 }
      );
    }

    const validStatuses = ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { fid } });
    if (!user) {
      return NextResponse.json(
        { error: "User not found for provided fid" },
        { status: 404 }
      );
    }

    // Ensure the request exists and is associated with this user (as receiver or sender)
    const requestRecord = await prisma.fundRequest.findUnique({
      where: { id: requestId },
      select: { id: true, senderId: true, receiverId: true },
    });
    if (!requestRecord) {
      return NextResponse.json(
        { error: "Fund request not found" },
        { status: 404 }
      );
    }

    if (
      requestRecord.receiverId !== user.id &&
      requestRecord.senderId !== user.id
    ) {
      return NextResponse.json(
        { error: "Not authorized to update this request" },
        { status: 403 }
      );
    }

    const updatedRequest = await prisma.fundRequest.update({
      where: { id: requestId },
      data: { status },
      include: {
        sender: { select: { id: true, username: true, fid: true } },
        receiver: { select: { id: true, username: true, fid: true } },
      },
    });

    return NextResponse.json({
      message: "Fund request updated successfully",
      fundRequest: updatedRequest,
    });
  } catch (error) {
    console.error("Failed to update fund request by fid:", error);
    return NextResponse.json(
      { error: "Failed to update fund request" },
      { status: 500 }
    );
  }
}
