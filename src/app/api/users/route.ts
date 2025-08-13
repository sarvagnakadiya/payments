import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getNeynarUser } from "~/lib/neynar";

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
      return NextResponse.json({
        message: "User already exists",
        user: existingUser,
      });
    }

    // For new users, attempt to fetch preferred address from Neynar (primary ETH)
    let preferredAddress = "";
    try {
      const neynarUser = await getNeynarUser(Number(fid));
      preferredAddress =
        neynarUser?.verified_addresses?.primary?.eth_address ?? "";
    } catch (err) {
      // Swallow errors to avoid blocking user creation if Neynar is unavailable
      preferredAddress = "";
    }

    // Create new user with defaults and inferred preferred address
    try {
      const newUser = await prisma.user.create({
        data: {
          fid: fid.toString(),
          username,
          usernameSource,
          preferredChain: "BASE",
          preferredToken: "USDC",
          preferredAddress,
        },
      });

      return NextResponse.json(
        {
          message: "User created successfully",
          user: newUser,
        },
        { status: 201 }
      );
    } catch (err: unknown) {
      // Handle race conditions or duplicates gracefully
      const isUniqueConstraintViolation =
        typeof err === "object" &&
        err !== null &&
        (err as any).code === "P2002";

      if (isUniqueConstraintViolation) {
        const existingAfterConflict = await prisma.user.findFirst({
          where: {
            OR: [{ fid: fid.toString() }, { username }],
          },
        });

        if (existingAfterConflict) {
          return NextResponse.json({
            message: "User already exists",
            user: existingAfterConflict,
          });
        }

        // If we cannot find it, return a well-formed error
        return NextResponse.json(
          { error: "User already exists but could not be retrieved" },
          { status: 409 }
        );
      }

      throw err;
    }
  } catch (error) {
    console.error("Failed to create/update user:", error);
    return NextResponse.json(
      { error: "Failed to create/update user" },
      { status: 500 }
    );
  }
}
