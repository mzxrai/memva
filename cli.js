#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { spawn } from 'child_process';
import open from 'open';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine the data directory - consistent with app/db/database.ts
const MEMVA_DIR = join(homedir(), '.memva');
const DB_PATH = join(MEMVA_DIR, 'memva-prod.db');

async function checkDatabase() {
  if (!existsSync(DB_PATH)) {
    console.log('Database will be initialized on first startup');
  } else {
    console.log(`Using existing database at ${DB_PATH}`);
  }
}

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

async function findAvailablePort(ports) {
  for (const port of ports) {
    if (await isPortAvailable(port)) {
      return port;
    }
    console.log(`Port ${port} is already in use, trying next...`);
  }
  return null;
}

async function startServer() {
  // Set environment variables
  process.env.NODE_ENV = 'production';
  
  // Try multiple ports if the default is blocked
  const PORTS_TO_TRY = ['7823', '7824', '7825', '7826'];  // MEMVA on phone keypad :)
  let PORT = process.env.PORT;
  
  if (!PORT) {
    // If no port specified, we'll try our list
    const availablePort = await findAvailablePort(PORTS_TO_TRY);
    if (!availablePort) {
      throw new Error(`All ports are in use: ${PORTS_TO_TRY.join(', ')}`);
    }
    PORT = availablePort;
  } else {
    // Check if the user-specified port is available
    if (!(await isPortAvailable(PORT))) {
      throw new Error(`Port ${PORT} is already in use`);
    }
  }
  
  process.env.PORT = PORT;
  
  console.log(`Starting Memva server...`);
  console.log(`Data directory: ${MEMVA_DIR}`);
  console.log(`Server: http://localhost:${PORT}`);
  
  // Check if we have a built version
  const buildPath = join(__dirname, 'build', 'server', 'index.js');
  if (!existsSync(buildPath)) {
    console.error('Production build not found. Building now...');
    console.log('This may take a few minutes on first run...\n');
    
    // Run build
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });
    
    await new Promise((resolve, reject) => {
      buildProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Build failed with code ${code}`));
        } else {
          resolve();
        }
      });
    });
  }
  
  // Start the server using the existing start script
  const serverProcess = spawn('npm', ['run', 'start'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    },
    shell: true
  });
  
  // Wait a moment for the server to start, then open browser
  setTimeout(async () => {
    try {
      const url = `http://localhost:${PORT}`;
      console.log(`\nOpening ${url} in your browser...`);
      await open(url);
    } catch (error) {
      console.error('Failed to open browser:', error);
      console.log(`\nPlease open http://localhost:${PORT} in your browser manually`);
    }
  }, 2000);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    serverProcess.kill('SIGINT');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\nShutting down...');
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });
  
  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
  
  serverProcess.on('close', (code) => {
    if (code !== null && code !== 0) {
      console.error(`Server exited with code ${code}`);
      process.exit(code);
    }
  });
}

async function main() {
  console.log('Welcome to Memva - Session manager\n');
  
  try {
    await checkDatabase();
    await startServer();
  } catch (error) {
    console.error('Failed to start Memva:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();