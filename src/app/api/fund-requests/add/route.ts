import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getNeynarUser } from "~/lib/neynar";

// Helper function to auto-create user if they don't exist
async function findOrCreateUser(fid: string) {
  console.log("Looking for user with FID:", fid);

  // First try to find existing user
  const user = await prisma.user.findUnique({
    where: { fid },
  });

  if (user) {
    console.log("User found:", {
      fid: user.fid,
      username: user.username,
      preferredChain: user.preferredChain,
      preferredToken: user.preferredToken,
      preferredAddress: user.preferredAddress,
    });
    return user;
  }

  // User doesn't exist, try to auto-create from Neynar
  console.log(
    "User not found for FID:",
    fid,
    "- attempting auto-create from Neynar"
  );

  try {
    const neynarUser = await getNeynarUser(Number(fid));
    if (!neynarUser) {
      console.log("Neynar user not found for FID:", fid);
      return null;
    }

    const username: string = (neynarUser as any)?.username || `fid_${fid}`;
    const primaryEth: string =
      ((neynarUser as any)?.verified_addresses?.primary?.eth_address as
        | string
        | undefined) || "";

    let createdUser;
    try {
      createdUser = await prisma.user.create({
        data: {
          fid: fid.toString(),
          username,
          usernameSource: "FARCASTER" as any,
          preferredChain: "BASE" as any,
          preferredToken: "USDC" as any,
          preferredAddress: primaryEth || "",
        },
      });
    } catch (err: unknown) {
      const isUniqueConstraintViolation =
        typeof err === "object" &&
        err !== null &&
        (err as any).code === "P2002";

      if (isUniqueConstraintViolation) {
        // Fallback to a unique username suffixing with fid
        const fallbackUsername = `${username}_${fid}`;
        try {
          createdUser = await prisma.user.create({
            data: {
              fid: fid.toString(),
              username: fallbackUsername,
              usernameSource: "FARCASTER" as any,
              preferredChain: "BASE" as any,
              preferredToken: "USDC" as any,
              preferredAddress: primaryEth || "",
            },
          });
        } catch (err2) {
          console.error("Failed to create user with fallback username:", err2);
          // Check if user was created concurrently
          const existingAfterConflict = await prisma.user.findFirst({
            where: { OR: [{ fid: fid.toString() }, { username }] },
          });
          if (!existingAfterConflict) {
            return null;
          }
          createdUser = existingAfterConflict;
        }
      } else {
        console.error("Failed to auto-create user:", err);
        return null;
      }
    }

    console.log("Auto-created user:", {
      fid: createdUser.fid,
      username: createdUser.username,
      preferredChain: createdUser.preferredChain,
      preferredToken: createdUser.preferredToken,
      preferredAddress: createdUser.preferredAddress,
    });

    return createdUser;
  } catch (autoCreateErr) {
    console.error("Error during auto-create flow:", autoCreateErr);
    return null;
  }
}

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

    // Find or create both sender and receiver
    const [sender, receiver] = await Promise.all([
      findOrCreateUser(senderFid),
      findOrCreateUser(receiverFid),
    ]);

    if (!sender) {
      return NextResponse.json(
        { error: "Sender not found and could not be auto-created" },
        { status: 404 }
      );
    }
    if (!receiver) {
      return NextResponse.json(
        { error: "Receiver not found and could not be auto-created" },
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
