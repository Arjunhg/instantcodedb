// HACKATHON: Temporarily disabled auth API
// import { handlers } from "@/auth" // Referring to the auth.ts we just created
// export const { GET, POST } = handlers

// Mock handlers for hackathon demo
export async function GET() {
  return new Response(JSON.stringify({ message: "Auth disabled for hackathon demo" }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST() {
  return new Response(JSON.stringify({ message: "Auth disabled for hackathon demo" }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}