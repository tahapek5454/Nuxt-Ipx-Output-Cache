import type { ServerResponse } from "http";
import type { ModuleOptions } from "../../module";
import { createCache } from "../utils/cache";

import { CaptureStream } from "../utils/capture-stream";
import { Readable } from "node:stream";

import { sendStream, setHeaders, getHeader } from "h3";
import { defineNitroPlugin, useRuntimeConfig } from "nitropack/runtime";


function extractFormat(url: string): string {
  const formatMatch = url.match(/f(?:ormat)?[_-](\w+)/);
  if (formatMatch?.[1]) {
    return formatMatch[1];
  }
  
  const extMatch = url.match(/\.(\w+)(?:[?&#]|$)/);
  if (extMatch?.[1]) {
    return extMatch[1];
  }
  
  return '';
}

function createCacheKey(path: string, baseURL: string = '/_ipx'): { url: string; format: string; key: string } {
  const url = path
    .replace(new RegExp(`${baseURL}/`, 'g'), '')
    .replace(/,/g, '')
    .replace(/https?:\/\//g, '')
    .replace(/&/g, '-');
  
  const format = extractFormat(path);
  const key = url.replace(/\.[^/.]+$/, `.${format}`);
  return { url, format, key };
}

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig().ipxOutputCache as ModuleOptions;
  const baseUrlFromNuxtImg = ((<any>config).ipxBaseURL) as string;
  const cacheStore = createCache(config.cacheDir!);

  nitroApp.hooks.hook("request", async function (event) {
    if (!event.path.startsWith(`${baseUrlFromNuxtImg}/`)) {
      return;
    }

    const { key, format } = createCacheKey(event.path, baseUrlFromNuxtImg);
    
    if(format === '') {
      return;
    }

    const originalRes = event.node.res;

    if (!getHeader(event, "cache-control")?.includes("ipx-purge")) {
      /** Load from cache if there is any */
      const cached = await cacheStore.get(key);
      if (cached) {
        const readable = Readable.from(cached.buffer);

        setHeaders(event, { ...(<{}>cached.meta), "cache-status": "HIT" });
        originalRes.setHeader = (_key, _val) => originalRes;
        return sendStream(event, readable);
      }
    }
    else{
      await cacheStore.del(key);
    }

    const captureStream = new CaptureStream();

    const originalWrite = originalRes.write.bind(originalRes) as (
      chunk: any,
      encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
      callback?: (error: Error | null | undefined) => void,
    ) => boolean;
    
    const originalEnd = originalRes.end.bind(originalRes) as (
      chunk?: any,
      encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
      callback?: () => void,
    ) => ServerResponse;

    originalRes.write = (
      chunk: any,
      encodingOrCallback?:
        | BufferEncoding
        | ((error: Error | null | undefined) => void),
      callback?: (error: Error | null | undefined) => void,
    ): boolean => {
      captureStream.write(chunk, encodingOrCallback as BufferEncoding, callback);
      return originalWrite(
        chunk,
        encodingOrCallback as BufferEncoding,
        callback,
      );
    };

    originalRes.end = (
      chunk?: any,
      encodingOrCallback?:
        | BufferEncoding
        | ((error: Error | null | undefined) => void),
      callback?: () => void,
    ): ServerResponse => {
      if (chunk){
         captureStream.write(
          chunk,
          encodingOrCallback as BufferEncoding,
          callback,
        );
      }
      
      setHeaders(event, { "cache-status": "MISS" });
      originalEnd(chunk, encodingOrCallback, callback);

      if (originalRes.statusCode !== 200){
        return originalRes;
      }

      const buffer = captureStream.getBuffer();
      const meta = {
        ...originalRes.getHeaders(),
        "content-length": buffer.byteLength,
      };

      setImmediate(() => {
        cacheStore.set(key, { buffer, meta }).catch((err) => {
          console.error('[ipx-cache] Failed to cache:', key, err);
        });
      });

      return originalRes;
    };
  });
});
