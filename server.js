import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",  // Allow ESP32 connections
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,        // 60 seconds before considering connection dead
  pingInterval: 25000,       // Send ping every 25 seconds
  upgradeTimeout: 30000,     // 30 seconds for the connection upgrade
  allowEIO3: true,           // Allow older Socket.IO clients
  transports: ['websocket', 'polling']  // Support both WebSocket and polling
});

app.use(express.static('public'));
app.use(express.json());

// F1 2024 Teams and Drivers
const teams = {
  'Red Bull Racing': { color: '#3671C6', drivers: ['Max Verstappen', 'Sergio Perez'] },
  'Ferrari': { color: '#E8002D', drivers: ['Charles Leclerc', 'Carlos Sainz'] },
  'Mercedes': { color: '#27F4D2', drivers: ['Lewis Hamilton', 'George Russell'] },
  'McLaren': { color: '#FF8000', drivers: ['Lando Norris', 'Oscar Piastri'] },
  'Aston Martin': { color: '#229971', drivers: ['Fernando Alonso', 'Lance Stroll'] },
  'Alpine': { color: '#FF87BC', drivers: ['Pierre Gasly', 'Esteban Ocon'] },
  'Williams': { color: '#64C4FF', drivers: ['Alex Albon', 'Logan Sargeant'] },
  'RB': { color: '#6692FF', drivers: ['Yuki Tsunoda', 'Daniel Ricciardo'] },
  'Kick Sauber': { color: '#52E252', drivers: ['Valtteri Bottas', 'Zhou Guanyu'] },
  'Haas': { color: '#B6BABD', drivers: ['Kevin Magnussen', 'Nico Hulkenberg'] }
};

// Session data
let sessionData = {
  currentDriver: null,
  currentTeam: null,
  currentLapStartTime: null,
  sector1Time: null,
  sector2Time: null,
  sector1StartTime: null,
  sector2StartTime: null,
  leaderboard: [],
  driverStats: {}
};

// Global best times
let globalBest = {
  sector1: null,
  sector2: null,
  sector3: null,
  lap: null
};

function handleSensorData(data) {
  const timestamp = Date.now();
  console.log('Sensor data:', data);
  
  if (!sessionData.currentDriver) return;
  
  // Expected format: "S1", "S2", "S3" for sector triggers
  const sensorTrigger = data.trim();
  
  if (sensorTrigger === 'S1') {
    // Start/Finish line - Start new lap or finish current lap
    if (sessionData.currentLapStartTime === null) {
      // Start new lap
      startNewLap(timestamp);
    } else {
      // Complete lap
      completeLap(timestamp);
    }
  } else if (sensorTrigger === 'S2' && sessionData.sector1StartTime !== null) {
    // Sector 1 complete
    completeSector1(timestamp);
  } else if (sensorTrigger === 'S3' && sessionData.sector2StartTime !== null) {
    // Sector 2 complete
    completeSector2(timestamp);
  }
}

function startNewLap(timestamp) {
  sessionData.currentLapStartTime = timestamp;
  sessionData.sector1StartTime = timestamp;
  sessionData.sector1Time = null;
  sessionData.sector2Time = null;
  
  io.emit('lapStarted', {
    driver: sessionData.currentDriver,
    team: sessionData.currentTeam,
    timestamp
  });
  
  console.log(`Lap started for ${sessionData.currentDriver}`);
}

function completeSector1(timestamp) {
  const sector1Time = timestamp - sessionData.sector1StartTime;
  sessionData.sector1Time = sector1Time;
  sessionData.sector2StartTime = timestamp;
  
  const driverKey = `${sessionData.currentTeam}_${sessionData.currentDriver}`;
  const driverStats = sessionData.driverStats[driverKey] || { personalBest: {}, history: [] };
  
  // Determine sector status
  let status = 'yellow'; // Default: slower than personal best
  
  if (!globalBest.sector1 || sector1Time < globalBest.sector1) {
    globalBest.sector1 = sector1Time;
    status = 'purple'; // Global best
  } else if (!driverStats.personalBest.sector1 || sector1Time <= driverStats.personalBest.sector1) {
    status = 'green'; // Personal best
  }
  
  io.emit('sectorComplete', {
    sector: 1,
    time: sector1Time,
    status,
    driver: sessionData.currentDriver,
    team: sessionData.currentTeam
  });
  
  console.log(`Sector 1 complete: ${(sector1Time / 1000).toFixed(3)}s - ${status}`);
}

function completeSector2(timestamp) {
  const sector2Time = timestamp - sessionData.sector2StartTime;
  sessionData.sector2Time = sector2Time;
  
  const driverKey = `${sessionData.currentTeam}_${sessionData.currentDriver}`;
  const driverStats = sessionData.driverStats[driverKey] || { personalBest: {}, history: [] };
  
  let status = 'yellow';
  
  if (!globalBest.sector2 || sector2Time < globalBest.sector2) {
    globalBest.sector2 = sector2Time;
    status = 'purple';
  } else if (!driverStats.personalBest.sector2 || sector2Time <= driverStats.personalBest.sector2) {
    status = 'green';
  }
  
  io.emit('sectorComplete', {
    sector: 2,
    time: sector2Time,
    status,
    driver: sessionData.currentDriver,
    team: sessionData.currentTeam
  });
  
  console.log(`Sector 2 complete: ${(sector2Time / 1000).toFixed(3)}s - ${status}`);
}

function completeLap(timestamp) {
  const sector3Time = timestamp - sessionData.sector2StartTime - sessionData.sector2Time;
  const totalLapTime = timestamp - sessionData.currentLapStartTime;
  
  const driverKey = `${sessionData.currentTeam}_${sessionData.currentDriver}`;
  let driverStats = sessionData.driverStats[driverKey] || { 
    personalBest: {}, 
    history: [],
    driver: sessionData.currentDriver,
    team: sessionData.currentTeam
  };
  
  // Sector 3 status
  let sector3Status = 'yellow';
  if (!globalBest.sector3 || sector3Time < globalBest.sector3) {
    globalBest.sector3 = sector3Time;
    sector3Status = 'purple';
  } else if (!driverStats.personalBest.sector3 || sector3Time <= driverStats.personalBest.sector3) {
    sector3Status = 'green';
  }
  
  io.emit('sectorComplete', {
    sector: 3,
    time: sector3Time,
    status: sector3Status,
    driver: sessionData.currentDriver,
    team: sessionData.currentTeam
  });
  
  // Update personal bests
  if (!driverStats.personalBest.sector1 || sessionData.sector1Time < driverStats.personalBest.sector1) {
    driverStats.personalBest.sector1 = sessionData.sector1Time;
  }
  if (!driverStats.personalBest.sector2 || sessionData.sector2Time < driverStats.personalBest.sector2) {
    driverStats.personalBest.sector2 = sessionData.sector2Time;
  }
  if (!driverStats.personalBest.sector3 || sector3Time < driverStats.personalBest.sector3) {
    driverStats.personalBest.sector3 = sector3Time;
  }
  if (!driverStats.personalBest.lap || totalLapTime < driverStats.personalBest.lap) {
    driverStats.personalBest.lap = totalLapTime;
  }
  
  // Update global best lap
  if (!globalBest.lap || totalLapTime < globalBest.lap) {
    globalBest.lap = totalLapTime;
  }
  
  // Add to history
  driverStats.history.push({
    sector1: sessionData.sector1Time,
    sector2: sessionData.sector2Time,
    sector3: sector3Time,
    lapTime: totalLapTime,
    timestamp: timestamp
  });
  
  sessionData.driverStats[driverKey] = driverStats;
  
  // Update leaderboard
  updateLeaderboard(driverKey, totalLapTime);
  
  io.emit('lapComplete', {
    driver: sessionData.currentDriver,
    team: sessionData.currentTeam,
    sector1: sessionData.sector1Time,
    sector2: sessionData.sector2Time,
    sector3: sector3Time,
    lapTime: totalLapTime,
    isPersonalBest: totalLapTime === driverStats.personalBest.lap,
    isGlobalBest: totalLapTime === globalBest.lap
  });
  
  // Reset for next lap
  sessionData.currentLapStartTime = null;
  sessionData.sector1StartTime = null;
  sessionData.sector2StartTime = null;
  
  console.log(`Lap complete: ${(totalLapTime / 1000).toFixed(3)}s`);
}

function updateLeaderboard(driverKey, lapTime) {
  const stats = sessionData.driverStats[driverKey];
  const existingIndex = sessionData.leaderboard.findIndex(entry => entry.driverKey === driverKey);
  
  const entry = {
    driverKey,
    driver: stats.driver,
    team: stats.team,
    bestLap: stats.personalBest.lap,
    sector1: stats.personalBest.sector1,
    sector2: stats.personalBest.sector2,
    sector3: stats.personalBest.sector3,
    laps: stats.history.length
  };
  
  if (existingIndex >= 0) {
    sessionData.leaderboard[existingIndex] = entry;
  } else {
    sessionData.leaderboard.push(entry);
  }
  
  // Sort by best lap time
  sessionData.leaderboard.sort((a, b) => a.bestLap - b.bestLap);
  
  io.emit('leaderboardUpdate', sessionData.leaderboard);
}

// API Routes
app.get('/api/teams', (req, res) => {
  res.json(teams);
});

app.get('/api/session', (req, res) => {
  res.json({
    currentDriver: sessionData.currentDriver,
    currentTeam: sessionData.currentTeam,
    leaderboard: sessionData.leaderboard,
    globalBest
  });
});

app.post('/api/start-session', (req, res) => {
  const { team, driver } = req.body;
  
  if (!teams[team] || !teams[team].drivers.includes(driver)) {
    return res.status(400).json({ error: 'Invalid team or driver' });
  }
  
  sessionData.currentDriver = driver;
  sessionData.currentTeam = team;
  sessionData.currentLapStartTime = null;
  sessionData.sector1StartTime = null;
  sessionData.sector2StartTime = null;
  
  io.emit('sessionStarted', { driver, team });
  
  res.json({ success: true, driver, team });
});

app.post('/api/stop-session', (req, res) => {
  sessionData.currentDriver = null;
  sessionData.currentTeam = null;
  sessionData.currentLapStartTime = null;
  
  io.emit('sessionStopped');
  
  res.json({ success: true });
});

// Demo mode - simulate sensor triggers
app.post('/api/demo-trigger', (req, res) => {
  const { sensor } = req.body;
  handleSensorData(sensor);
  res.json({ success: true });
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  console.log('Transport:', socket.conn.transport.name);
  
  socket.emit('initialData', {
    teams,
    currentDriver: sessionData.currentDriver,
    currentTeam: sessionData.currentTeam,
    leaderboard: sessionData.leaderboard,
    globalBest
  });
  
  // Handle ESP32 connection
  socket.on('esp32Connected', (data) => {
    console.log('ESP32 device connected:', data);
    socket.emit('esp32Acknowledged', { status: 'connected' });
  });
  
  // Handle sensor triggers from ESP32
  socket.on('sensorTrigger', (data) => {
    console.log('Sensor trigger from ESP32:', data.sensor);
    handleSensorData(data.sensor);
  });
  
  // Handle connection errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, 'Reason:', reason);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });
});

// Handle Socket.IO server events
io.engine.on('connection_error', (err) => {
  console.error('Connection error:', err.req, err.code, err.message, err.context);
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('WebSocket server ready for ESP32 connections');
  console.log('Use demo mode buttons for testing without hardware');
  console.log('\nSocket.IO Configuration:');
  console.log('- Ping Interval: 25 seconds');
  console.log('- Ping Timeout: 60 seconds');
  console.log('- Transports: WebSocket, Polling');
});
