import { destroySessionCookie } from "@/lib/auth/session";
import { assertSameOrigin, jsonOk, serverError } from "@/lib/api";

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  try {
    await destroySessionCookie();
    return jsonOk({});
  } catch (error) {
    return serverError("auth/logout", error);
  }
}
