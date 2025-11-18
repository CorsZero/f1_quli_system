const socket = io();

let teams = {};
let currentDriver = null;
let currentTeam = null;
let currentSectorTimes = {
    sector1: null,
    sector2: null,
    sector3: null
};
let currentSectorStatus = {
    sector1: 'waiting',
    sector2: 'waiting',
    sector3: 'waiting'
};
let lapStartTime = null;
let timerInterval = null;

// Elements
const teamSelect = document.getElementById('teamSelect');
const driverSelect = document.getElementById('driverSelect');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const currentSession = document.getElementById('currentSession');
const currentLapDisplay = document.getElementById('currentLapDisplay');
const leaderboard = document.getElementById('leaderboard');
const leaderboardFullscreen = document.getElementById('leaderboardFullscreen');
const liveTimer = document.getElementById('liveTimer');
const liveTimerDisplay = document.getElementById('liveTimerDisplay');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const fullscreenCloseBtn = document.getElementById('fullscreenCloseBtn');
const fullscreenContainer = document.getElementById('fullscreenContainer');
const bgAudio = document.getElementById('bgAudio');
const audioToggle = document.getElementById('audioToggle');
const notificationSound = document.getElementById('notificationSound');
const checkpointSound = document.getElementById('checkpointSound');

// Audio control
let isAudioMuted = false;
let isSessionActive = false;

// Set initial audio button state
audioToggle.textContent = '🔊';

// Play notification sound
function playNotification() {
    notificationSound.currentTime = 0;
    notificationSound.play().catch(e => console.log('Notification play failed:', e));
}

// Play checkpoint sound
function playCheckpoint() {
    checkpointSound.currentTime = 0;
    checkpointSound.play().catch(e => console.log('Checkpoint play failed:', e));
}

// Attempt to start audio on page load
window.addEventListener('load', () => {
    bgAudio.play().catch(e => {
        console.log('Autoplay prevented, waiting for user interaction:', e);
    });
});

// Try to play audio on any user interaction
document.addEventListener('click', () => {
    if (bgAudio.paused) {
        bgAudio.play().catch(e => console.log('Audio play failed:', e));
    }
}, { once: true });

audioToggle.addEventListener('click', () => {
    isAudioMuted = !isAudioMuted;
    
    // Only control background audio if session is not active
    if (!isSessionActive) {
        bgAudio.muted = isAudioMuted;
    }
    
    audioToggle.textContent = isAudioMuted ? '🔇' : '🔊';
    
    if (!isAudioMuted && bgAudio.paused && !isSessionActive) {
        bgAudio.play().catch(e => console.log('Audio play failed:', e));
    }
});

// Fullscreen toggle
fullscreenBtn.addEventListener('click', () => {
    fullscreenContainer.classList.add('active');
    updateFullscreenLeaderboard();
});

fullscreenCloseBtn.addEventListener('click', () => {
    fullscreenContainer.classList.remove('active');
});

// Close fullscreen with ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fullscreenContainer.classList.contains('active')) {
        fullscreenContainer.classList.remove('active');
    }
});

// Initialize
socket.on('initialData', (data) => {
    teams = data.teams;
    populateTeamSelect();
    
    if (data.currentDriver) {
        currentDriver = data.currentDriver;
        currentTeam = data.currentTeam;
        updateSessionDisplay();
    }
    
    if (data.leaderboard && data.leaderboard.length > 0) {
        updateLeaderboard(data.leaderboard);
    }
});

function populateTeamSelect() {
    teamSelect.innerHTML = '<option value="">Select Team</option>';
    Object.keys(teams).forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamSelect.appendChild(option);
    });
}

teamSelect.addEventListener('change', (e) => {
    const team = e.target.value;
    driverSelect.innerHTML = '<option value="">Select Driver</option>';
    
    if (team && teams[team]) {
        playNotification(); // Play notification when team changes
        teams[team].drivers.forEach(driver => {
            const option = document.createElement('option');
            option.value = driver;
            option.textContent = driver;
            driverSelect.appendChild(option);
        });
        driverSelect.disabled = false;
    } else {
        driverSelect.disabled = true;
        startBtn.disabled = true;
    }
});

driverSelect.addEventListener('change', (e) => {
    startBtn.disabled = !e.target.value;
    if (e.target.value) {
        playNotification(); // Play notification when driver changes
    }
});

startBtn.addEventListener('click', async () => {
    const team = teamSelect.value;
    const driver = driverSelect.value;
    
    if (!team || !driver) return;
    
    try {
        const response = await fetch('/api/start-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team, driver })
        });
        
        const data = await response.json();
        if (data.success) {
            currentDriver = driver;
            currentTeam = team;
            isSessionActive = true;
            
            // Mute background audio when session starts
            bgAudio.muted = true;
            
            updateSessionDisplay();
        }
    } catch (error) {
        console.error('Error starting session:', error);
        alert('Failed to start session');
    }
});

stopBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/stop-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        if (data.success) {
            currentDriver = null;
            currentTeam = null;
            isSessionActive = false;
            
            // Unmute background audio when session stops (if user had it unmuted)
            if (!isAudioMuted) {
                bgAudio.muted = false;
            }
            
            updateSessionDisplay();
        }
    } catch (error) {
        console.error('Error stopping session:', error);
    }
});

function updateSessionDisplay() {
    if (currentDriver && currentTeam) {
        teamSelect.disabled = true;
        driverSelect.disabled = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
        currentSession.innerHTML = `
            <strong>Active Session:</strong> ${currentDriver} (${currentTeam})
        `;
        currentSession.style.display = 'block';
        
        // Show waiting lap display
        showLapDisplay();
    } else {
        teamSelect.disabled = false;
        driverSelect.disabled = false;
        startBtn.disabled = !driverSelect.value;
        stopBtn.disabled = true;
        
        currentSession.style.display = 'none';
        currentLapDisplay.innerHTML = '<div class="no-session">No active session</div>';
        
        resetCurrentLap();
    }
}

function showLapDisplay() {
    currentLapDisplay.innerHTML = `
        <div class="active-lap">
            <div class="sector-display">
                <h3>SECTOR 1</h3>
                <div class="sector-time" id="sector1Time">--:--.---</div>
                <div class="sector-bar">
                    <div class="sector-bar-fill waiting" id="sector1Bar"></div>
                </div>
            </div>
            <div class="sector-display">
                <h3>SECTOR 2</h3>
                <div class="sector-time" id="sector2Time">--:--.---</div>
                <div class="sector-bar">
                    <div class="sector-bar-fill waiting" id="sector2Bar"></div>
                </div>
            </div>
            <div class="sector-display">
                <h3>SECTOR 3</h3>
                <div class="sector-time" id="sector3Time">--:--.---</div>
                <div class="sector-bar">
                    <div class="sector-bar-fill waiting" id="sector3Bar"></div>
                </div>
            </div>
        </div>
    `;
}

function resetCurrentLap() {
    currentSectorTimes = { sector1: null, sector2: null, sector3: null };
    currentSectorStatus = { sector1: 'waiting', sector2: 'waiting', sector3: 'waiting' };
    stopTimer();
}

function startTimer() {
    lapStartTime = Date.now();
    liveTimer.style.display = 'flex';
    
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - lapStartTime;
        liveTimerDisplay.textContent = formatTime(elapsed);
    }, 10); // Update every 10ms for smooth display
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    lapStartTime = null;
    liveTimer.style.display = 'none';
    liveTimerDisplay.textContent = '0:00.000';
}

function formatTime(milliseconds) {
    if (!milliseconds) return '--:--.---';
    
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const ms = milliseconds % 1000;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// Socket events
socket.on('sessionStarted', (data) => {
    currentDriver = data.driver;
    currentTeam = data.team;
    isSessionActive = true;
    
    // Mute background audio when session starts
    bgAudio.muted = true;
    
    updateSessionDisplay();
});

socket.on('sessionStopped', () => {
    currentDriver = null;
    currentTeam = null;
    isSessionActive = false;
    
    // Unmute background audio when session stops (if user had it unmuted)
    if (!isAudioMuted) {
        bgAudio.muted = false;
    }
    
    stopTimer();
    updateSessionDisplay();
});

socket.on('lapStarted', (data) => {
    console.log('Lap started', data);
    resetCurrentLap();
    showLapDisplay();
    startTimer();
});

socket.on('sectorComplete', (data) => {
    console.log('Sector complete', data);
    
    // Play checkpoint sound
    playCheckpoint();
    
    const sectorNum = data.sector;
    const timeElement = document.getElementById(`sector${sectorNum}Time`);
    const barElement = document.getElementById(`sector${sectorNum}Bar`);
    
    if (timeElement && barElement) {
        timeElement.textContent = formatTime(data.time);
        barElement.className = `sector-bar-fill ${data.status}`;
        
        currentSectorTimes[`sector${sectorNum}`] = data.time;
        currentSectorStatus[`sector${sectorNum}`] = data.status;
    }
});

socket.on('lapComplete', (data) => {
    console.log('Lap complete', data);
    
    stopTimer();
    
    // Show completion animation or message
    setTimeout(() => {
        resetCurrentLap();
        showLapDisplay();
    }, 2000);
});

socket.on('leaderboardUpdate', (data) => {
    updateLeaderboardWithAnimation(data);
});

let previousLeaderboard = [];

function updateLeaderboardWithAnimation(data) {
    if (!data || data.length === 0) {
        leaderboard.innerHTML = '<div class="no-data">No lap times recorded yet</div>';
        leaderboardFullscreen.innerHTML = '<div class="no-data">No lap times recorded yet</div>';
        previousLeaderboard = [];
        return;
    }
    
    // Play notification sound on leaderboard update
    playNotification();
    
    // Create a map of previous positions
    const previousPositions = {};
    previousLeaderboard.forEach((entry, index) => {
        previousPositions[entry.driverKey] = index;
    });
    
    // Find which drivers changed position
    const changedDrivers = new Set();
    data.forEach((entry, index) => {
        if (previousPositions[entry.driverKey] !== undefined && 
            previousPositions[entry.driverKey] !== index) {
            changedDrivers.add(entry.driverKey);
        }
    });
    
    // If positions changed, animate only the affected rows
    if (changedDrivers.size > 0 && previousLeaderboard.length > 0) {
        // First, mark the rows that will move
        const rows = leaderboard.querySelectorAll('.leaderboard-row');
        rows.forEach(row => {
            const driverKey = row.getAttribute('data-driver-key');
            if (changedDrivers.has(driverKey)) {
                row.classList.add('moving');
            }
        });
        
        // Then update the leaderboard
        setTimeout(() => {
            renderLeaderboard(data);
            updateFullscreenLeaderboard();
            
            // Remove animation class after render
            setTimeout(() => {
                const rows = leaderboard.querySelectorAll('.leaderboard-row');
                rows.forEach(row => {
                    row.classList.remove('moving');
                });
            }, 100);
        }, 300);
    } else {
        renderLeaderboard(data);
        updateFullscreenLeaderboard();
    }
    
    previousLeaderboard = [...data];
}

function renderLeaderboard(data) {
    const html = data.map((entry, index) => {
        const position = index + 1;
        const positionClass = position <= 3 ? `position-${position}` : '';
        const teamColor = teams[entry.team]?.color || '#fff';
        
        return `
            <div class="leaderboard-row ${positionClass}" data-driver-key="${entry.driverKey}">
                <div class="pos">${position}</div>
                <div class="driver-info">
                    <div class="team-color" style="background: ${teamColor}"></div>
                    <div class="driver-details">
                        <div class="driver-name">${entry.driver}</div>
                        <div class="team-name">${entry.team}</div>
                    </div>
                </div>
                <div class="sector">
                    <div class="sector-value">
                        <span class="sector-time-value">${formatTime(entry.sector1)}</span>
                    </div>
                </div>
                <div class="sector">
                    <div class="sector-value">
                        <span class="sector-time-value">${formatTime(entry.sector2)}</span>
                    </div>
                </div>
                <div class="sector">
                    <div class="sector-value">
                        <span class="sector-time-value">${formatTime(entry.sector3)}</span>
                    </div>
                </div>
                <div class="time">${formatTime(entry.bestLap)}</div>
                <div class="laps">${entry.laps}</div>
            </div>
        `;
    }).join('');
    
    leaderboard.innerHTML = html;
}

function updateFullscreenLeaderboard() {
    leaderboardFullscreen.innerHTML = leaderboard.innerHTML;
}

function updateLeaderboard(data) {
    updateLeaderboardWithAnimation(data);
}

// Demo mode functions
async function triggerSensor(sensor) {
    try {
        await fetch('/api/demo-trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sensor })
        });
        // Play checkpoint sound when triggering sensors in demo mode
        playCheckpoint();
    } catch (error) {
        console.error('Error triggering sensor:', error);
    }
}

// Make triggerSensor available globally for demo buttons
window.triggerSensor = triggerSensor;
