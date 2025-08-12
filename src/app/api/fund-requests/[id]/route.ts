import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error:
            "Invalid status. Must be one of: PENDING, ACCEPTED, REJECTED, EXPIRED",
        },
        { status: 400 }
      );
    }

    // Update the fund request
    const updatedRequest = await prisma.fundRequest.update({
      where: { id },
      data: { status },
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
    });

    return NextResponse.json({
      message: "Fund request updated successfully",
      fundRequest: updatedRequest,
    });
  } catch (error) {
    console.error("Failed to update fund request:", error);
    return NextResponse.json(
      { error: "Failed to update fund request" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const fundRequest = await prisma.fundRequest.findUnique({
      where: { id },
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
    });

    if (!fundRequest) {
      return NextResponse.json(
        { error: "Fund request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ fundRequest });
  } catch (error) {
    console.error("Failed to fetch fund request:", error);
    return NextResponse.json(
      { error: "Failed to fetch fund request" },
      { status: 500 }
    );
  }
}
