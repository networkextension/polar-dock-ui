// Fetch the dock's generated OpenAPI 3 spec for the API reference page.

import { request } from "./http.js";

export type OpenAPIOperation = {
  operationId?: string;
  tags?: string[];
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: { type?: string } }>;
  requestBody?: {
    content?: { "application/json"?: { schema?: { properties?: Record<string, { type?: string }>; required?: string[] } } };
  };
  "x-polar-scope"?: string;
  "x-polar-auth"?: string;
};

export type OpenAPISpec = {
  openapi: string;
  info?: { title?: string; version?: string; description?: string };
  servers?: Array<{ url: string }>;
  paths: Record<string, Record<string, OpenAPIOperation>>;
};

export async function fetchOpenAPISpec(): Promise<OpenAPISpec> {
  const res = await request("/api/openapi.json");
  if (!res.ok) throw new Error(`openapi.json -> HTTP ${res.status}`);
  return (await res.json()) as OpenAPISpec;
}
