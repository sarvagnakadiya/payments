import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      senderId,
      receiverUsername,
      amount,
      overrideChain,
      overrideToken,
      overrideAddress,
      note,
      expiresAt,
    } = body;

    // Validate required fields
    if (!senderId || !receiverUsername || !amount) {
      return NextResponse.json(
        { error: "senderId, receiverUsername, and amount are required" },
        { status: 400 }
      );
    }

    // Find the receiver by username
    const receiver = await prisma.user.findUnique({
      where: { username: receiverUsername },
    });

    if (!receiver) {
      return NextResponse.json(
        { error: "Receiver not found" },
        { status: 404 }
      );
    }

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    // Create the fund request
    const fundRequest = await prisma.fundRequest.create({
      data: {
        senderId,
        receiverId: receiver.id,
        amount: parsedAmount,
        overrideChain: overrideChain || null,
        overrideToken: overrideToken || null,
        overrideAddress: overrideAddress || null,
        note: note || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: "PENDING",
      },
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

    return NextResponse.json(
      {
        message: "Fund request created successfully",
        fundRequest,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create fund request:", error);
    return NextResponse.json(
      { error: "Failed to create fund request" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    const type = searchParams.get("type"); // "sent" or "received"

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter is required" },
        { status: 400 }
      );
    }

    // Build the where clause based on type
    const whereClause: any = {};

    if (type === "sent") {
      whereClause.senderId = userId;
    } else if (type === "received") {
      whereClause.receiverId = userId;
    } else {
      // If no type specified, get both sent and received
      whereClause.OR = [{ senderId: userId }, { receiverId: userId }];
    }

    // Add status filter if provided
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
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ fundRequests });
  } catch (error) {
    console.error("Failed to fetch fund requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch fund requests" },
      { status: 500 }
    );
  }
}
