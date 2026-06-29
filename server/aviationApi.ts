import "dotenv/config";
import type { Plugin } from "vite";
import {
  AirLabsIntegrationError,
  lookupAirLabsFlight,
  searchAirLabsAirports
} from "./integrations/airlabs";

const writeJson = (res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const getQuery = (url: URL) => url.searchParams.get("q")?.trim() ?? "";

const handleAviationApiRequest = async (
  req: { method?: string; url?: string },
  res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void },
  next: () => void
) => {
  const url = new URL(req.url ?? "", "http://localhost");

  if (!url.pathname.startsWith("/api/aviation/")) {
    next();
    return;
  }

  if (req.method !== "GET") {
    writeJson(res, 405, {
      error: {
        code: "method_not_allowed",
        message: "Use GET for aviation search."
      }
    });
    return;
  }

  try {
    const query = getQuery(url);

    if (url.pathname === "/api/aviation/airports") {
      const results = await searchAirLabsAirports(query);
      writeJson(res, 200, { results });
      return;
    }

    if (url.pathname === "/api/aviation/flights") {
      const result = await lookupAirLabsFlight(query);
      writeJson(res, 200, { results: [result] });
      return;
    }

    writeJson(res, 404, {
      error: {
        code: "not_found",
        message: "Unknown aviation API route."
      }
    });
  } catch (error) {
    if (error instanceof AirLabsIntegrationError) {
      writeJson(res, error.status, {
        error: {
          status: error.status,
          code: error.code,
          message: error.message
        }
      });
      return;
    }

    console.error(error);
    writeJson(res, 500, {
      error: {
        code: "aviation_api_error",
        message: "Aviation search failed."
      }
    });
  }
};

export const aviationApiPlugin = (): Plugin => ({
  name: "chronoflight-aviation-api",
  configureServer(server) {
    server.middlewares.use(handleAviationApiRequest);
  },
  configurePreviewServer(server) {
    server.middlewares.use(handleAviationApiRequest);
  }
});
