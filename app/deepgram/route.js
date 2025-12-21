import { createClient } from "@deepgram/sdk";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  // Create a temporary key that lasts for 1 minute (enough to start the stream)
  const { result, error } = await deepgram.manage.v1.projects(
    // You can find project_id in deepgram console, or usually just letting the SDK handle it works if you have 1 project
    // If this fails, hardcode your project_id as the first arg
    // For this example, we use a different approach: On-demand credentials
  ).keys.create(process.env.DEEPGRAM_PROJECT_ID, {
    comment: "Temporary key",
    scopes: ["usage:write"],
    time_to_live_in_seconds: 60,
  });
  
  // SIMPLER ALTERNATIVE for MVP:
  // If the above is too complex for setup, we can just proxy the request. 
  // But for this code, we will return the API Key (Not recommended for prod, but fine for local MVP).
  // Ideally, use the Deepgram SDK's "Listen" helper if available, but here is the raw key method for simplicity.
  
  return NextResponse.json({ key: process.env.DEEPGRAM_API_KEY });
}