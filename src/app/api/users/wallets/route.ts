import { NextResponse } from "next/server";
import { getNeynarUser } from "~/lib/neynar";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get("fid");

    if (!fidParam) {
      return NextResponse.json({ error: "fid is required" }, { status: 400 });
    }

    const fid = Number(fidParam);
    if (Number.isNaN(fid)) {
      return NextResponse.json(
        { error: "fid must be a number" },
        { status: 400 }
      );
    }

    const user = await getNeynarUser(fid);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const verified = user.verified_addresses as any;

    const primaryEth: string | undefined = verified?.primary?.eth_address;
    const primarySol: string | undefined = verified?.primary?.sol_address;

    const evmAddresses: string[] = Array.from(
      new Set(
        [
          ...(primaryEth ? [primaryEth] : []),
          ...((verified?.eth_addresses as string[] | undefined) ?? []),
        ].map((a) => a?.toLowerCase?.() ?? a)
      )
    );

    const solanaAddresses: string[] = Array.from(
      new Set([
        ...(primarySol ? [primarySol] : []),
        ...((verified?.sol_addresses as string[] | undefined) ?? []),
      ])
    );

    return NextResponse.json({
      fid: user.fid,
      evmAddresses,
      solanaAddresses,
      primary: {
        evm: primaryEth || null,
        solana: primarySol || null,
      },
    });
  } catch (error) {
    console.error("Failed to fetch Neynar wallets:", error);
    return NextResponse.json(
      { error: "Failed to fetch Neynar wallets" },
      { status: 500 }
    );
  }
}
