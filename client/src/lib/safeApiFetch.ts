const serviceUnavailableMessage = "The feed service is temporarily unavailable. Please try again in a moment.";

export async function normalizeApiResponse(response: Response): Promise<Response> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("json") || response.status < 500) return response;

  const body = await response.text();
  const isServiceOutage = response.status === 502 || response.status === 503 || response.status === 504 || /service unavailable|bad gateway|gateway timeout/i.test(body);
  if (!isServiceOutage) {
    return new Response(JSON.stringify([{ error: { json: { message: `The service returned HTTP ${response.status}. Please try again.`, code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: response.status } } } }]), { status: response.status, headers: { "content-type": "application/json" } });
  }

  return new Response(JSON.stringify([{ error: { json: { message: serviceUnavailableMessage, code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: response.status } } } }]), { status: response.status, headers: { "content-type": "application/json" } });
}
