const BLINK_API = {
  baseUrl: 'https://sgp1.blynk.cloud/external/api',
  token: 'NdwPAgahoSvxVnUgOpKwrH3BN6uJ2nfl',
  pins: {
    temperature: 'v0',
    humidity: 'v1',
    airQuality: 'v2',
    motion: 'v3',
    soilMoisture: 'v4',
    pump: 'v5',
    autoMode: 'v6'
  },
  refreshInterval: 2000
};

let deviceStatus = 'Active';
let autoModeEnabled = false;
let pumpOffEnabled = false;
let isManualPumpToggle = false;
let sensorData = { temperature: 0, humidity: 0, airQuality: 0, motionRaw: '0', soilMoisture: 0, pumpRaw: '0' };
let historicalData = { labels: [], temperature: [], humidity: [], soilMoisture: [], airQuality: [] };
let mainChart;

// Cache DOM elements for better performance
const domCache = {};

function cacheDOMElements() {
  domCache.temperature = document.getElementById('temperature');
  domCache.humidity = document.getElementById('humidity');
  domCache.airQuality = document.getElementById('airQuality');
  domCache.soilMoisture = document.getElementById('soilMoisture');
  domCache.motionIndicator = document.getElementById('motionIndicator');
  domCache.motionStatusText = document.getElementById('motionStatusText');
  domCache.pumpIndicator = document.getElementById('pumpIndicator');
  domCache.pumpStatusText = document.getElementById('pumpStatusText');
  domCache.pumpOffToggle = document.getElementById('pumpOffToggle');
  domCache.pumpToggleLabel = document.getElementById('pumpToggleLabel');
  domCache.autoModeToggle = document.getElementById('autoModeToggle');
  domCache.autoModeLabel = document.getElementById('autoModeLabel');
  domCache.lastSync = document.getElementById('lastSync');
  domCache.statusBadge = document.querySelector('.status-badge');
  domCache.apiStatus = document.getElementById('apiStatus');
  
  // Cache gauge elements
  domCache.tempGauge = document.querySelector('.temp-gauge');
  domCache.humidityGauge = document.querySelector('.humidity-gauge');
  domCache.moistureFill = document.querySelector('.moisture-fill');
  domCache.airqualityFill = document.querySelector('.airquality-fill');
}

let motionWasNotDetected = true;
let pumpWasOff = true;

document.addEventListener('DOMContentLoaded', function() {
  cacheDOMElements();
  showWelcomePopup();
  fetchAllData();
  setInterval(fetchAllData, BLINK_API.refreshInterval);
  generateHistoricalData();
  initializeMainChart();
  setupEventListeners();
});

function showWelcomePopup() {
  var userName = localStorage.getItem('userName');
  if (!userName || userName === 'null' || userName === 'undefined') {
    var userEmail = localStorage.getItem('userEmail');
    if (userEmail) {
      userName = userEmail.split('@')[0];
    } else {
      userName = 'User';
    }
  }
  userName = userName.charAt(0).toUpperCase() + userName.slice(1);
  
  var popup = document.createElement('div');
  popup.id = 'welcomePopup';
  popup.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
  `;
  popup.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #1e293b, #0f172a);
      border: 2px solid #10b981;
      border-radius: 20px;
      padding: 40px 50px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(16, 185, 129, 0.4);
      transform: scale(0.8);
      transition: all 0.3s ease;
      max-width: 90%;
    " id="welcomeModalContent">
      <div style="
        width: 80px;
        height: 80px;
        background: rgba(16, 185, 129, 0.2);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        font-size: 40px;
        color: #10b981;
        animation: welcome-pulse 2s infinite;
      ">
        <i class="fas fa-leaf"></i>
      </div>
      <h2 style="
        color: #10b981;
        font-size: 28px;
        margin-bottom: 15px;
        font-weight: 700;
      ">Welcome, ${userName}!</h2>
      <p style="
        color: #94a3b8;
        font-size: 16px;
        margin-bottom: 25px;
      ">Happy to have you here! 🌱</p>
      <button onclick="closeWelcomePopup()" style="
        background: linear-gradient(135deg, #10b981, #059669);
        border: none;
        color: white;
        padding: 12px 40px;
        font-size: 16px;
        font-weight: 600;
        border-radius: 30px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
      " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(16,185,129,0.6)'" 
         onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 15px rgba(16,185,129,0.4)'">
        Get Started
      </button>
    </div>
  `;
  var style = document.createElement('style');
  style.textContent = `
    @keyframes welcome-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(popup);
  setTimeout(function() {
    popup.style.opacity = '1';
    popup.style.visibility = 'visible';
    var modalContent = document.getElementById('welcomeModalContent');
    if (modalContent) {
      modalContent.style.transform = 'scale(1)';
    }
  }, 100);
  popup.addEventListener('click', function(e) {
    if (e.target === popup) {
      closeWelcomePopup();
    }
  });
}

function closeWelcomePopup() {
  var popup = document.getElementById('welcomePopup');
  if (popup) {
    popup.style.opacity = '0';
    popup.style.visibility = 'hidden';
    setTimeout(function() {
      popup.remove();
    }, 300);
  }
}

function fetchAllData() {
  // Check device connection status
  fetch(BLINK_API.baseUrl + '/isHardwareConnected?token=' + BLINK_API.token)
    .then(function(response) { return response.text(); })
    .then(function(data) {
      deviceStatus = data.trim() === 'true' ? 'Active' : 'Offline';
      updateStatusBadge();
    })
    .catch(function() {
      deviceStatus = 'Offline';
      updateStatusBadge();
    });

  // Fetch all sensor data in PARALLEL for faster response
  Promise.all([
    fetch(BLINK_API.baseUrl + '/get?token=' + BLINK_API.token + '&' + BLINK_API.pins.temperature).then(r => r.text()),
    fetch(BLINK_API.baseUrl + '/get?token=' + BLINK_API.token + '&' + BLINK_API.pins.humidity).then(r => r.text()),
    fetch(BLINK_API.baseUrl + '/get?token=' + BLINK_API.token + '&' + BLINK_API.pins.soilMoisture).then(r => r.text()),
    fetch(BLINK_API.baseUrl + '/get?token=' + BLINK_API.token + '&' + BLINK_API.pins.airQuality).then(r => r.text()),
    fetch(BLINK_API.baseUrl + '/get?token=' + BLINK_API.token + '&' + BLINK_API.pins.motion).then(r => r.text()),
    fetch(BLINK_API.baseUrl + '/get?token=' + BLINK_API.token + '&' + BLINK_API.pins.pump).then(r => r.text())
  ])
  .then(function(results) {
    sensorData.temperature = parseFloat(results[0]) || 0;
    sensorData.humidity = parseFloat(results[1]) || 0;
    sensorData.soilMoisture = parseFloat(results[2]) || 0;
    sensorData.airQuality = parseFloat(results[3]) || 0;
    sensorData.motionRaw = results[4].trim();
    sensorData.pumpRaw = results[5].trim();
    
    // Update all displays
    updateTemperatureDisplay();
    updateHumidityDisplay();
    updateSoilMoistureDisplay();
    updateAirQualityDisplay();
    updateMotionDisplay();
    updatePumpDisplay();
    updateLastSync();
  })
  .catch(function(error) {
    console.error('Error fetching data:', error);
  });
}

function updateStatusBadge() {
  if (!domCache.statusBadge) return;
  if (deviceStatus === 'Active') {
    domCache.statusBadge.className = 'status-badge active';
    domCache.statusBadge.innerHTML = '<span class="status-dot"></span> Active';
    if (domCache.apiStatus) {
      domCache.apiStatus.textContent = 'Active';
      domCache.apiStatus.className = 'api-stat-value active';
    }
  } else {
    domCache.statusBadge.className = 'status-badge offline';
    domCache.statusBadge.innerHTML = '<span class="status-dot"></span> Offline';
    if (domCache.apiStatus) {
      domCache.apiStatus.textContent = 'Offline';
      domCache.apiStatus.className = 'api-stat-value inactive';
    }
  }
}

function updateTemperatureDisplay() {
  if (!domCache.temperature) return;
  var tempVal = parseFloat(sensorData.temperature) || sensorData.temperature;
  domCache.temperature.textContent = tempVal;
  updateCircularGauge(domCache.tempGauge, tempVal);
}

function updateHumidityDisplay() {
  if (!domCache.humidity) return;
  var humidityVal = parseFloat(sensorData.humidity) || sensorData.humidity;
  domCache.humidity.textContent = humidityVal;
  updateCircularGauge(domCache.humidityGauge, humidityVal);
}

function updateCircularGauge(gauge, value) {
  if (gauge) {
    var offset = 251.2 - (value / 100) * 251.2;
    gauge.style.strokeDashoffset = offset;
  }
}

function updateSoilMoistureDisplay() {
  if (!domCache.soilMoisture) return;
  var moistureValue = parseFloat(sensorData.soilMoisture) || sensorData.soilMoisture;
  domCache.soilMoisture.textContent = moistureValue;
  updateProgressBar(domCache.moistureFill, moistureValue);
}

function updateAirQualityDisplay() {
  if (!domCache.airQuality) return;
  var airValue = parseFloat(sensorData.airQuality) || sensorData.airQuality;
  domCache.airQuality.textContent = airValue.toFixed ? airValue.toFixed(2) : airValue;
  var percentage = Math.min((airValue / 1000) * 100, 100);
  updateProgressBar(domCache.airqualityFill, percentage);
}

function updateProgressBar(bar, percentage) {
  if (bar) {
    bar.style.width = percentage + '%';
  }
}

function showAlertPopup(message, type) {
  var existingPopup = document.getElementById('alertPopup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  var popup = document.createElement('div');
  popup.id = 'alertPopup';
  
  var bgColor = type === 'motion' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(59, 130, 246, 0.95)';
  var icon = type === 'motion' ? 'fa-running' : 'fa-water';
  var title = type === 'motion' ? 'Motion Detected!' : 'Pump Activated!';
  
  popup.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 20px 25px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 15px;
    animation: slideIn 0.3s ease, fadeOut 0.3s ease 4s forwards;
    min-width: 300px;
    backdrop-filter: blur(10px);
  `;
  
  popup.innerHTML = `
    <div style="
      width: 50px;
      height: 50px;
      background: rgba(255,255,255,0.25);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      animation: popIn 0.3s ease;
    ">
      <i class="fas ${icon}"></i>
    </div>
    <div>
      <div style="font-weight: 700; font-size: 18px;">${title}</div>
      <div style="font-size: 14px; opacity: 0.95;">${message}</div>
    </div>
    <button onclick="this.parentElement.remove()" style="
      position: absolute;
      top: 8px;
      right: 12px;
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
    " onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">&times;</button>
  `;
  
  var style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes popIn {
      from { transform: scale(0); }
      to { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(popup);
  
  setTimeout(function() {
    if (popup && popup.parentElement) {
      popup.remove();
    }
  }, 5000);
}

function updateMotionDisplay() {
  if (!domCache.motionIndicator || !domCache.motionStatusText) return;
  
  var rawMotionValue = sensorData.motionRaw;
  domCache.motionStatusText.textContent = rawMotionValue;
  var isMotionDetected = rawMotionValue && rawMotionValue !== '0' && rawMotionValue !== 'off' && rawMotionValue !== '';
  
  if (isMotionDetected && motionWasNotDetected) {
    showAlertPopup('Movement detected in the garden area!', 'motion');
    motionWasNotDetected = false;
  } else if (!isMotionDetected) {
    motionWasNotDetected = true;
  }
  
  if (isMotionDetected) {
    domCache.motionIndicator.className = 'status-indicator motion-triggered';
    domCache.motionIndicator.innerHTML = '<i class="fas fa-running"></i>';
    domCache.motionStatusText.className = 'status-text motion-triggered';
  } else {
    domCache.motionIndicator.className = 'status-indicator motion-safe';
    domCache.motionIndicator.innerHTML = '<i class="fas fa-check"></i>';
    domCache.motionStatusText.className = 'status-text motion-safe';
  }
}

function updatePumpDisplay() {
  if (!domCache.pumpIndicator || !domCache.pumpStatusText) return;
  
  var rawPumpValue = sensorData.pumpRaw;
  var isPumpOn = rawPumpValue && rawPumpValue !== '0' && rawPumpValue !== 'off' && rawPumpValue !== '';
  
  if (isPumpOn && pumpWasOff) {
    showAlertPopup('Water pump has been activated!', 'pump');
    pumpWasOff = false;
  } else if (!isPumpOn) {
    pumpWasOff = true;
  }
  
  if (!isManualPumpToggle) {
    if (isPumpOn) {
      domCache.pumpStatusText.textContent = 'PUMP ON';
      domCache.pumpIndicator.className = 'status-indicator pump-on';
      domCache.pumpIndicator.innerHTML = '<i class="fas fa-power-off"></i>';
      domCache.pumpStatusText.className = 'status-text pump-on';
    } else {
      domCache.pumpStatusText.textContent = 'PUMP OFF';
      domCache.pumpIndicator.className = 'status-indicator pump-off';
      domCache.pumpIndicator.innerHTML = '<i class="fas fa-power-off"></i>';
      domCache.pumpStatusText.className = 'status-text pump-off';
    }
    
    if (domCache.pumpOffToggle && !domCache.pumpOffToggle.matches(':active')) {
      domCache.pumpOffToggle.checked = isPumpOn;
    }
    if (domCache.pumpToggleLabel) {
      domCache.pumpToggleLabel.textContent = isPumpOn ? 'PUMP ON' : 'PUMP OFF';
    }
  }
}

function generateHistoricalData() {
  var now = new Date();
  historicalData.labels = [];
  historicalData.temperature = [];
  historicalData.humidity = [];
  historicalData.soilMoisture = [];
  historicalData.airQuality = [];
  for (var i = 23; i >= 0; i--) {
    var time = new Date(now.getTime() - i * 60 * 60 * 1000);
    historicalData.labels.push(time.getHours() + ':00');
    historicalData.temperature.push(28 + Math.random() * 4);
    historicalData.humidity.push(60 + Math.random() * 15);
    historicalData.soilMoisture.push(30 + Math.random() * 10);
    historicalData.airQuality.push(380 + Math.random() * 50);
  }
}

function initializeMainChart() {
  var ctx = document.getElementById('mainChart');
  if (!ctx) return;
  mainChart = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: historicalData.labels,
      datasets: [{
        label: 'Temperature (°C)',
        data: historicalData.temperature,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6
      }, {
        label: 'Humidity (%)',
        data: historicalData.humidity,
        borderColor: '#d4a574',
        backgroundColor: 'rgba(212,165,116,0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6
      }, {
        label: 'Soil Moisture (%)',
        data: historicalData.soilMoisture,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139,92,246,0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6
      }, {
        label: 'Air Quality (ppm)',
        data: historicalData.airQuality,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6,182,212,0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { 
          position: 'top', 
          labels: { 
            color: '#94a3b8', 
            usePointStyle: true, 
            padding: 20,
            font: { size: 11 }
          } 
        }
      },
      scales: {
        x: { 
          grid: { color: 'rgba(16,185,129,0.1)' }, 
          ticks: { color: '#64748b', font: { size: 10 } } 
        },
        y: { 
          grid: { color: 'rgba(16,185,129,0.1)' }, 
          ticks: { color: '#64748b', font: { size: 10 } } 
        }
      }
    }
  });
}

function updateChartRange(range) {
  if (!mainChart) return;
  var labels = [];
  var tempData = [];
  var humidityData = [];
  var moistureData = [];
  var airData = [];
  
  if (range === '24h') {
    labels = historicalData.labels;
    tempData = historicalData.temperature;
    humidityData = historicalData.humidity;
    moistureData = historicalData.soilMoisture;
    airData = historicalData.airQuality;
  } else if (range === '7d') {
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (var i = 0; i < 7; i++) {
      tempData.push(26 + Math.random() * 6);
      humidityData.push(55 + Math.random() * 20);
      moistureData.push(28 + Math.random() * 15);
      airData.push(380 + Math.random() * 60);
    }
  }
  
  mainChart.data.labels = labels;
  mainChart.data.datasets[0].data = tempData;
  mainChart.data.datasets[1].data = humidityData;
  mainChart.data.datasets[2].data = moistureData;
  mainChart.data.datasets[3].data = airData;
  mainChart.update('none');
}

function setupEventListeners() {
  document.querySelectorAll('.time-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.time-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var range = btn.dataset.range;
      generateHistoricalDataForRange(range);
    });
  });
  
  document.querySelectorAll('.chart-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.chart-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      updateChartRange(btn.dataset.range);
    });
  });
  
  if (domCache.autoModeToggle) {
    domCache.autoModeToggle.addEventListener('change', function() {
      autoModeEnabled = this.checked;
      if (domCache.autoModeLabel) {
        domCache.autoModeLabel.textContent = autoModeEnabled ? 'AUTO MODE' : 'MANUAL MODE';
      }
      if (domCache.pumpOffToggle) {
        domCache.pumpOffToggle.disabled = autoModeEnabled;
        var pumpToggleContainer = domCache.pumpOffToggle.closest('.toggle-switch');
        if (pumpToggleContainer) {
          pumpToggleContainer.style.opacity = autoModeEnabled ? '0.5' : '1';
          pumpToggleContainer.style.cursor = autoModeEnabled ? 'not-allowed' : 'pointer';
        }
      }
      sendAutoModeCommand(autoModeEnabled);
    });
  }
  
  if (domCache.pumpOffToggle) {
    domCache.pumpOffToggle.addEventListener('change', function() {
      pumpOffEnabled = this.checked;
      isManualPumpToggle = true;
      sendPumpOffCommand(pumpOffEnabled);
      setTimeout(function() {
        isManualPumpToggle = false;
      }, 2000);
    });
  }
}

function sendAutoModeCommand(enabled) {
  var value = enabled ? '1' : '0';
  fetch(BLINK_API.baseUrl + '/update?token=' + BLINK_API.token + '&pin=' + BLINK_API.pins.autoMode + '&value=' + value)
    .then(function(response) { return response.text(); })
    .then(function(data) {
      console.log('Auto Mode updated:', enabled);
    })
    .catch(function(error) {
      console.error('Error updating Auto Mode:', error);
      if (domCache.autoModeToggle) {
        domCache.autoModeToggle.checked = !enabled;
      }
      if (domCache.autoModeLabel) {
        domCache.autoModeLabel.textContent = !enabled ? 'AUTO MODE' : 'MANUAL MODE';
      }
      autoModeEnabled = !enabled;
    });
}

function sendPumpOffCommand(turnOn) {
  var value = turnOn ? '1' : '0';
  console.log('Sending pump command:', value);
  fetch(BLINK_API.baseUrl + '/update?token=' + BLINK_API.token + '&pin=' + BLINK_API.pins.pump + '&value=' + value)
    .then(function(response) { return response.text(); })
    .then(function(data) {
      console.log('Pump response:', data);
      sensorData.pumpRaw = turnOn ? '1' : '0';
      updatePumpDisplay();
    })
    .catch(function(error) {
      console.error('Error updating Pump:', error);
      if (domCache.pumpOffToggle) {
        domCache.pumpOffToggle.checked = !turnOn;
      }
      pumpOffEnabled = !turnOn;
    });
}

function generateHistoricalDataForRange(range) {
  var dataPoints = (range === '1h') ? 12 : 24;
  historicalData.labels = [];
  historicalData.temperature = [];
  historicalData.humidity = [];
  historicalData.soilMoisture = [];
  historicalData.airQuality = [];
  
  for (var i = dataPoints - 1; i >= 0; i--) {
    var time = new Date();
    time.setHours(time.getHours() - i);
    historicalData.labels.push(time.getHours() + ':00');
    historicalData.temperature.push(26 + Math.random() * 8);
    historicalData.humidity.push(55 + Math.random() * 25);
    historicalData.soilMoisture.push(28 + Math.random() * 15);
    historicalData.airQuality.push(370 + Math.random() * 80);
  }
  
  if (mainChart) updateChartRange('24h');
}

function updateLastSync() {
  if (!domCache.lastSync) return;
  domCache.lastSync.textContent = new Date().toLocaleTimeString();
}

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    window.location.href = 'index.html';
  }
}

function refreshData() {
  fetchAllData();
}

var tokenVisible = false;
var originalToken = 'NdwPAgahoSvxVnUgOpKwrH3BN6uJ2nfl';

document.addEventListener('DOMContentLoaded', function() {
  var toggleTokenBtn = document.querySelector('.toggle-token');
  if (toggleTokenBtn) {
    toggleTokenBtn.addEventListener('click', function() {
      var tokenValue = document.querySelector('.info-value');
      if (!tokenValue) return;
      tokenVisible = !tokenVisible;
      if (tokenVisible) {
        tokenValue.textContent = originalToken;
        toggleTokenBtn.className = 'fas fa-eye toggle-token';
      } else {
        var masked = originalToken.substring(0, 4) + '****' + originalToken.substring(originalToken.length - 4);
        tokenValue.textContent = masked;
        toggleTokenBtn.className = 'fas fa-eye-slash toggle-token';
      }
    });
  }
});

window.BLINK_API = BLINK_API;

