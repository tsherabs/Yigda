import { NextResponse } from "next/server";
import { createNDIProofRequest } from "@/lib/ndi";

export const runtime = "nodejs";

export async function POST() {
  try {
    const proof = await createNDIProofRequest();
    return NextResponse.json({ proof, mode: process.env.NDI_MODE || "mock" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "NDI proof request failed." },
      { status: 502 }
    );
  }
}
