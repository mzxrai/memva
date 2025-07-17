import { PassThrough } from "node:stream";
import type { AppLoadContext, EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import { JobSystem } from "./workers/index";

// Initialize job system
let jobSystem: JobSystem | null = null;

async function initializeJobSystem() {
  if (!jobSystem) {
    jobSystem = new JobSystem({
      concurrent: 2,
      maxRetries: 3,
      retryDelay: 1000
    });
    
    try {
      await jobSystem.start();
      console.log('✅ Job system started successfully');
      console.log('📋 Registered handlers:', jobSystem.getRegisteredHandlers());
    } catch (error) {
      console.error('❌ Failed to start job system:', error);
    }
  }
}

const ABORT_DELAY = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext?: AppLoadContext
) {
  // Initialize job system on first request
  await initializeJobSystem();
  
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get("user-agent");

    // Ensure requests terminate even if rendering hangs
    const abortHandler = () =>
      shellRendered ? resolve : reject(new Error("Rendering aborted"));
    const timeoutId = setTimeout(abortHandler, ABORT_DELAY);

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter
        context={routerContext}
        url={request.url}
      />,
      {
        onShellReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          console.error(error);
          responseStatusCode = 500;
        },
      }
    );

    clearTimeout(timeoutId);
    if (isbot(userAgent) || routerContext.staticHandlerContext.statusCode !== 200) {
      setTimeout(() => abort(), ABORT_DELAY);
    }
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down job system...');
  if (jobSystem) {
    await jobSystem.stop();
    console.log('✅ Job system stopped');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (jobSystem) {
    await jobSystem.stop();
  }
  process.exit(0);
});