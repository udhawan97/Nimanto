import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

type Address = { address: string; family: number };
type Response = { status: number; contentType: string; body: Uint8Array; location?: string };

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLocaleLowerCase("en-US");
  if (isIP(normalized) === 4) {
    const octets = normalized.split(".").map(Number);
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && (octets[1] ?? 0) >= 16 && (octets[1] ?? 0) <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 192 && octets[1] === 0 && octets[2] === 0) ||
      (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19)) ||
      (octets[0] === 198 && octets[1] === 51 && octets[2] === 100) ||
      (octets[0] === 203 && octets[1] === 0 && octets[2] === 113) ||
      (octets[0] === 100 && (octets[1] ?? 0) >= 64 && (octets[1] ?? 0) <= 127) ||
      octets[0] === 0 ||
      (octets[0] ?? 0) >= 224
    );
  }
  if (isIP(normalized) === 6) return true;
  return true;
}

async function requestPinned(url: URL, target: Address): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: "GET",
        headers: { accept: "text/html,text/plain;q=0.9", "user-agent": "Nimanto/0.1" },
        lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
        servername: url.hostname,
        timeout: 10_000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.byteLength;
          if (size > 1_000_000) {
            request.destroy(new Error("URL_BODY_TOO_LARGE"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            contentType: String(response.headers["content-type"] ?? ""),
            body: Buffer.concat(chunks),
            ...(response.headers.location ? { location: response.headers.location } : {}),
          });
        });
      },
    );
    request.on("timeout", () => request.destroy(new Error("URL_FETCH_TIMEOUT")));
    request.on("error", reject);
    request.end();
  });
}

function textFromPage(body: Uint8Array, contentType: string): string {
  if (!/^text\/(?:html|plain)(?:;|$)/iu.test(contentType)) throw new Error("URL_CONTENT_TYPE");
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new Error("URL_TEXT_ENCODING");
  }
  if (/text\/plain/iu.test(contentType)) return source.replace(/\s+/gu, " ").trim();
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/\s+/gu, " ")
    .trim();
}

export async function fetchAllowlistedJobPage(
  input: { url: string; allowedHosts: string[] },
  dependencies: {
    resolve?: (hostname: string) => Promise<Address[]>;
    request?: (url: URL, address: Address) => Promise<Response>;
  } = {},
): Promise<{ canonicalUrl: string; text: string; observedAt: string }> {
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    throw new Error("INVALID_SOURCE_URL");
  }
  const allowed = new Set(input.allowedHosts.map((host) => host.toLocaleLowerCase("en-US")));
  if (
    url.protocol !== "https:" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    !allowed.has(url.hostname.toLocaleLowerCase("en-US"))
  ) {
    throw new Error("SOURCE_URL_NOT_ALLOWED");
  }
  const resolver = dependencies.resolve ?? ((hostname) => dnsLookup(hostname, { all: true }));
  const addresses = await resolver(url.hostname);
  if (addresses.length === 0 || addresses.some((address) => isPrivateAddress(address.address))) {
    throw new Error("SOURCE_URL_UNSAFE_ADDRESS");
  }
  const response = await (dependencies.request ?? requestPinned)(url, addresses[0]!);
  if (response.status >= 300 && response.status < 400)
    throw new Error("SOURCE_URL_REDIRECT_BLOCKED");
  if (response.status !== 200) throw new Error(`SOURCE_URL_HTTP_${response.status}`);
  if (response.body.byteLength > 1_000_000) throw new Error("URL_BODY_TOO_LARGE");
  const text = textFromPage(response.body, response.contentType);
  if (text.length < 30) throw new Error("SOURCE_URL_TEXT_REQUIRED");
  return {
    canonicalUrl: url.toString(),
    text: text.slice(0, 200_000),
    observedAt: new Date().toISOString(),
  };
}
