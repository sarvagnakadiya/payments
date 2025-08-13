import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      senderFid,
      receiverFid,
      amount,
      overrideChain,
      overrideToken,
      overrideAddress,
      note,
      expiresAt,
    } = body;

    if (!senderFid || !receiverFid || !amount) {
      return NextResponse.json(
        { error: "senderFid, receiverFid, and amount are required" },
        { status: 400 }
      );
    }

    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({ where: { fid: senderFid } }),
      prisma.user.findUnique({ where: { fid: receiverFid } }),
    ]);

    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }
    if (!receiver) {
      return NextResponse.json(
        { error: "Receiver not found" },
        { status: 404 }
      );
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    const fundRequest = await prisma.fundRequest.create({
      data: {
        senderId: sender.id,
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
          select: { id: true, username: true, fid: true },
        },
        receiver: {
          select: { id: true, username: true, fid: true },
        },
      },
    });

    return NextResponse.json(
      { message: "Fund request created successfully", fundRequest },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create fund request (fid):", error);
    return NextResponse.json(
      { error: "Failed to create fund request" },
      { status: 500 }
    );
  }
}
