import { PassThrough } from "node:stream";
import type { AppLoadContext, EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import { JobSystem } from "./workers/index";
import { createJob } from "./db/jobs.service";
import { createMaintenanceJob } from "./workers/job-types";

// WARNING: This is a workaround for a memory leak in @anthropic-ai/claude-code SDK
// The SDK adds exit listeners to the process without cleaning them up, causing
// "MaxListenersExceededWarning" after ~11 Claude Code invocations.
// 
// TODO: Remove this workaround when the SDK is fixed to properly manage its event listeners
// Issue: Each call to query() in the SDK adds a new exit listener without removing old ones
// 
// Increasing from default 10 to 30 to handle typical usage patterns
if (typeof process !== 'undefined' && process.setMaxListeners) {
  process.setMaxListeners(30);
}

// Initialize job system
let jobSystem: JobSystem | null = null;

async function initializeJobSystem() {
  if (!jobSystem) {
    jobSystem = new JobSystem({
      concurrent: 20,
      maxRetries: 0,  // No retries - session jobs are stateful
      retryDelay: 1000
    });
    
    try {
      await jobSystem.start();
      
      // Schedule initial maintenance job to clean up expired permissions
      try {
        await createJob(createMaintenanceJob({
          operation: 'cleanup-expired-permissions'
        }));
      } catch (error) {
        console.error('❌ Failed to schedule maintenance job:', error);
      }
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// Graceful shutdown - register handlers only once
// Check if handlers are already registered by looking at listener count
const sigintListeners = process.listenerCount('SIGINT');
const sigtermListeners = process.listenerCount('SIGTERM');

if (sigintListeners === 0) {
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down job system...');
    if (jobSystem) {
      await jobSystem.stop();
      console.log('✅ Job system stopped');
    }
    process.exit(0);
  });
}

if (sigtermListeners === 0) {
  process.on('SIGTERM', async () => {
    if (jobSystem) {
      await jobSystem.stop();
    }
    process.exit(0);
  });
}