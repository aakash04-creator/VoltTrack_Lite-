const net = require('node:net');
const concurrently = require('concurrently');

function portIsAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, () => server.close(() => resolve(true)));
  });
}

function waitForPort(port, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const socket = new net.Socket();
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for port ${port}`));
        } else {
          setTimeout(check, 300);
        }
      });
      socket.connect(port, '127.0.0.1');
    };
    check();
  });
}

async function start() {
  const apiPort = Number(process.env.PORT) || 5000;
  const clientPort = 5173;

  process.env.NODE_ENV = 'development';
  process.env.ELECTRON_START_URL = `http://127.0.0.1:${clientPort}`;
  process.env.VITE_API_URL = process.env.VITE_API_URL || `http://localhost:${apiPort}/api`;

  console.log('⚡ Starting VoltTrack Lite in Desktop Development Mode...');

  const commands = [
    {
      command: `vite --config frontend/vite.config.js --host 127.0.0.1 --port ${clientPort}`,
      name: 'Client',
      prefixColor: 'green',
    },
    {
      command: `node -e "
        const net = require('node:net');
        function wait() {
          const s = new net.Socket();
          s.once('connect', () => {
            s.destroy();
            const { spawn } = require('child_process');
            const electronPath = require('electron');
            const proc = spawn(electronPath, ['.'], { stdio: 'inherit', env: process.env });
            proc.on('close', code => process.exit(code || 0));
          });
          s.once('error', () => {
            s.destroy();
            setTimeout(wait, 400);
          });
          s.connect(${clientPort}, '127.0.0.1');
        }
        wait();
      "`,
      name: 'Electron',
      prefixColor: 'magenta',
    },
  ];

  // Optionally include local backend if requested or needed
  if (process.env.RUN_LOCAL_BACKEND === 'true') {
    commands.unshift({
      command: 'node Backend/index.js',
      name: 'API',
      prefixColor: 'blue',
    });
  }

  const { result } = concurrently(commands, {
    prefix: 'name',
    killOthersOn: ['failure', 'success'],
    restartTries: 0,
  });

  await result;
}

start().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
