import os from 'os';
import net from 'net';
import { query as dbQuery } from '../config/db.js';
import { RoomServiceClient } from 'livekit-server-sdk';
import { config } from '../config/livekit.js';

const apiHost = config.livekit.url.replace("ws://", "http://").replace("wss://", "https://");
const roomService = new RoomServiceClient(apiHost, config.livekit.apiKey, config.livekit.apiSecret);

let startCpu = getCpuUsage();

function getCpuUsage() {
  const cpus = os.cpus();
  let totalUser = 0;
  let totalSystem = 0;
  let totalIdle = 0;
  
  cpus.forEach(cpu => {
    totalUser += cpu.times.user;
    totalSystem += cpu.times.sys;
    totalIdle += cpu.times.idle;
  });

  const total = totalUser + totalSystem + totalIdle;
  return { user: totalUser, system: totalSystem, total };
}

const checkPort = (port, host = '127.0.0.1') => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.connect(port, host);
  });
};

export const startMetricsMonitor = (io) => {
  console.log('[MONITOR] Telemetry Monitor Service Initialized.');

  setInterval(async () => {
    try {
      // Calculate real CPU usage percentage
      const endCpu = getCpuUsage();
      const idleDifference = endCpu.total - startCpu.total;
      const userDifference = endCpu.user - startCpu.user;
      const sysDifference = endCpu.system - startCpu.system;
      
      let cpuPercent = 0;
      if (idleDifference > 0) {
        cpuPercent = ((userDifference + sysDifference) / idleDifference) * 100;
      }
      cpuPercent = Math.min(Math.max(cpuPercent, 0), 100);
      
      // Update starting point
      startCpu = endCpu;

      // Memory metrics
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memPercent = ((totalMem - freeMem) / totalMem) * 100;

      // Active rooms query (fetch live rooms from LiveKit, fallback to DB if offline)
      let activeSessions = 0;
      try {
        const rooms = await roomService.listRooms();
        activeSessions = rooms.length;
      } catch (lkErr) {
        try {
          const sessRes = await dbQuery("SELECT COUNT(*) FROM sessions WHERE status = 'active'");
          activeSessions = parseInt(sessRes.rows[0].count) || 0;
        } catch (dbErr) {
          // DB might be reconnecting/offline
        }
      }

      // Check key microservice port health
      const services = {
        db: await checkPort(5433),
        redis: await checkPort(6379),
        livekit: await checkPort(7880),
        searxng: await checkPort(8081),
        qdrant: await checkPort(6333),
        securelytix: await checkPort(8080),
        mem0: await checkPort(8770)
      };

      // Emit telemetry to all connected socket operators
      io.emit('system_metrics', {
        cpu: parseFloat(cpuPercent.toFixed(1)),
        memory: parseFloat(memPercent.toFixed(1)),
        activeSessions,
        services,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      // Graceful error logging
    }
  }, 3000);
};
