import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function GET(request: Request) {
  const apiKey = process.env.NEYNAR_API_KEY;
  const { searchParams } = new URL(request.url);
  const fids = searchParams.get("fids");

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Neynar API key is not configured. Please add NEYNAR_API_KEY to your environment variables.",
      },
      { status: 500 }
    );
  }

  if (!fids) {
    return NextResponse.json(
      { error: "FIDs parameter is required" },
      { status: 400 }
    );
  }

  try {
    const neynar = new NeynarAPIClient({ apiKey });
    const fidsArray = fids.split(",").map((fid) => parseInt(fid.trim()));

    const { users } = await neynar.fetchBulkUsers({
      fids: fidsArray,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      {
        error:
          "Failed to fetch users. Please check your Neynar API key and try again.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fid, username, usernameSource = "FARCASTER" } = body;

    // Validate required fields
    if (!fid || !username) {
      return NextResponse.json(
        { error: "FID and username are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ fid: fid.toString() }, { username }],
      },
    });

    if (existingUser) {
      // Update existing user if needed
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fid: fid.toString(),
          username,
          usernameSource,
          // Keep existing preferences if they exist
          preferredChain: existingUser.preferredChain,
          preferredToken: existingUser.preferredToken,
          preferredAddress: existingUser.preferredAddress,
        },
      });

      return NextResponse.json({
        message: "User updated successfully",
        user: updatedUser,
      });
    }

    // Create new user with default preferences
    const newUser = await prisma.user.create({
      data: {
        fid: fid.toString(),
        username,
        usernameSource,
        preferredChain: "ETHEREUM", // Default chain
        preferredToken: "USDC", // Default token
        preferredAddress: "", // Will be set when user connects wallet
      },
    });

    return NextResponse.json(
      {
        message: "User created successfully",
        user: newUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create/update user:", error);
    return NextResponse.json(
      { error: "Failed to create/update user" },
      { status: 500 }
    );
  }
}
