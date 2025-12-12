'use client'
import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, Wind, Wifi, WifiOff, Bell, BellOff, Flame } from 'lucide-react';

const Home = () => {
  const [sensorData, setSensorData] = useState({
    smoke_level: 0,
    status: 'NORMAL',
    vent_state: 'CLOSED',
    timestamp: new Date().toISOString()
  });
  
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [alerts, setAlerts] = useState<Array<{
    id: number;
    message: string;
    type: string;
    timestamp: string;
  }>>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('--:--:--');
  
  // AWS IoT Configuration
  const [config, setConfig] = useState({
    endpoint: 'a1vzvyrus3qan7-ats.iot.us-west-2.amazonaws.com',
    clientId: 'BEC016-Thing-Group5',
    dataTopic: 'devices/BEC016-Thing-Group5/data',
    commandTopic: 'devices/BEC016-Thing-Group5/commands'
  });

  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Update last update time
  useEffect(() => {
    setLastUpdate(new Date(sensorData.timestamp).toLocaleTimeString());
  }, [sensorData.timestamp]);

  // Poll for data from API
  useEffect(() => {
    setConnectionStatus('connecting');
    const fetchData = async () => {
      try {
        const response = await fetch('/api/iot-data');
        if (response.ok) {
          const data = await response.json();
          if (data.smoke_level !== undefined) {
            const prevStatus = sensorData.status;
            setSensorData({
              smoke_level: data.smoke_level,
              status: data.status,
              vent_state: data.vent_state,
              timestamp: new Date().toISOString()
            });
            
            if (connectionStatus !== 'connected') {
              setConnectionStatus('connected');
              addAlert('Connected to AWS IoT Core', 'success');
            }
            
            if (data.status === 'DANGER' && prevStatus !== 'DANGER') {
              addAlert('🚨 DANGER: High smoke levels detected!', 'danger');
            }
          }
        } else {
          setConnectionStatus('disconnected');
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setConnectionStatus('disconnected');
      }
    };

    // Initial fetch
    fetchData();
    
    // Poll every 3 seconds
    pollInterval.current = setInterval(fetchData, 3000);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, []);

  const addAlert = (message: string, type: string) => {
    const newAlert = {
      id: Date.now() + Math.random(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 5));
  };

  const sendCommand = async (command: 'ON' | 'OFF') => {
    if (connectionStatus !== 'connected') {
      addAlert('Cannot send command: Not connected to AWS', 'error');
      return;
    }

    if (command === 'OFF' && sensorData.status === 'DANGER') {
      addAlert('⚠️ Safety Lock: Cannot close vent during danger', 'warning');
      return;
    }
    
    try {
      const response = await fetch('/api/iot-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish',
          topic: config.commandTopic,
          payload: JSON.stringify({ command })
        })
      });
      
      if (response.ok) {
        addAlert(`Command sent: ${command === 'ON' ? 'Open' : 'Close'} vent`, 'info');
        setSensorData(prev => ({ ...prev, vent_state: command === 'ON' ? 'OPEN' : 'CLOSED' }));
      } else {
        addAlert('Failed to send command', 'error');
      }
    } catch (error) {
      console.error('Error sending command:', error);
      addAlert('Failed to send command', 'error');
    }
  };

  const getSmokeColor = () => {
    if (sensorData.smoke_level > 2000) return 'text-red-600';
    if (sensorData.smoke_level > 1500) return 'text-orange-500';
    return 'text-green-600';
  };

  const getSmokePercentage = () => {
    return Math.min((sensorData.smoke_level / 3000) * 100, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Flame className="w-10 h-10 text-orange-500" />
            <div>
              <h1 className="text-3xl font-bold">Smart Smoke Detector</h1>
              <p className="text-slate-400 text-sm">IoT Monitoring & Control System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500/20 text-green-400' : 
              connectionStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-400' : 
              'bg-red-500/20 text-red-400'
            }`}>
              {connectionStatus === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span className="text-sm font-medium capitalize">{connectionStatus}</span>
            </div>
            
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              Settings
            </button>
          </div>
        </div>

        {/* Configuration Panel */}
        {showConfig && (
          <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
            <h2 className="text-xl font-bold mb-4">AWS IoT Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Endpoint</label>
                <input
                  type="text"
                  value={config.endpoint}
                  onChange={(e) => setConfig({...config, endpoint: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Client ID</label>
                <input
                  type="text"
                  value={config.clientId}
                  readOnly
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Data Topic</label>
                <input
                  type="text"
                  value={config.dataTopic}
                  onChange={(e) => setConfig({...config, dataTopic: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Command Topic</label>
                <input
                  type="text"
                  value={config.commandTopic}
                  onChange={(e) => setConfig({...config, commandTopic: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-4">
              ℹ️ Connection managed through secure API routes. Data refreshes every 3 seconds.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Status Card */}
          <div className="lg:col-span-2">
            <div className={`rounded-2xl p-8 border-2 transition-all ${
              sensorData.status === 'DANGER' 
                ? 'bg-red-500/10 border-red-500 shadow-lg shadow-red-500/20' 
                : 'bg-slate-800 border-slate-700'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">System Status</h2>
                {sensorData.status === 'DANGER' ? (
                  <div className="flex items-center gap-2 text-red-500 animate-pulse">
                    <AlertCircle className="w-6 h-6" />
                    <span className="font-bold text-xl">DANGER</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="w-6 h-6" />
                    <span className="font-bold text-xl">NORMAL</span>
                  </div>
                )}
              </div>

              {/* Smoke Level Display */}
              <div className="mb-8">
                <div className="flex items-end justify-between mb-3">
                  <span className="text-slate-400">Smoke Level</span>
                  <span className={`text-5xl font-bold ${getSmokeColor()}`}>
                    {sensorData.smoke_level}
                  </span>
                </div>
                
                <div className="w-full bg-slate-700 rounded-full h-6 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      sensorData.smoke_level > 2000 ? 'bg-gradient-to-r from-red-600 to-red-500' :
                      sensorData.smoke_level > 1500 ? 'bg-gradient-to-r from-orange-600 to-orange-500' :
                      'bg-gradient-to-r from-green-600 to-green-500'
                    }`}
                    style={{ width: `${getSmokePercentage()}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>0 (Safe)</span>
                  <span>1500 (Caution)</span>
                  <span>2000+ (Danger)</span>
                </div>
              </div>

              {/* Ventilation Control */}
              <div className="bg-slate-900/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Wind className={`w-8 h-8 ${sensorData.vent_state === 'OPEN' ? 'text-blue-400' : 'text-slate-500'}`} />
                    <div>
                      <h3 className="font-bold text-lg">Ventilation System</h3>
                      <p className="text-sm text-slate-400">
                        Status: <span className={sensorData.vent_state === 'OPEN' ? 'text-blue-400' : 'text-slate-400'}>
                          {sensorData.vent_state}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => sendCommand('ON')}
                    disabled={sensorData.vent_state === 'OPEN'}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      sensorData.vent_state === 'OPEN'
                        ? 'bg-blue-500 text-white cursor-not-allowed'
                        : 'bg-slate-700 hover:bg-blue-600 text-white'
                    }`}
                  >
                    Open Vent
                  </button>
                  
                  <button
                    onClick={() => sendCommand('OFF')}
                    disabled={sensorData.vent_state === 'CLOSED'}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      sensorData.vent_state === 'CLOSED'
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    Close Vent
                  </button>
                </div>

                {sensorData.status === 'DANGER' && (
                  <div className="mt-4 flex items-start gap-2 text-sm text-orange-400 bg-orange-500/10 p-3 rounded-lg">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>
                      <strong>Safety Lock Active:</strong> Vent cannot be closed while smoke levels are high.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Alerts Panel */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-bold">Recent Alerts</h2>
              </div>

              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <BellOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No alerts yet</p>
                  </div>
                ) : (
                  alerts.map(alert => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-lg text-sm border ${
                        alert.type === 'danger' ? 'bg-red-500/10 border-red-500/50 text-red-400' :
                        alert.type === 'warning' ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' :
                        alert.type === 'success' ? 'bg-green-500/10 border-green-500/50 text-green-400' :
                        'bg-blue-500/10 border-blue-500/50 text-blue-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex-1">{alert.message}</p>
                        <span className="text-xs opacity-75 whitespace-nowrap">{alert.timestamp}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mt-6">
              <h3 className="font-bold mb-3">System Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Last Update:</span>
                  <span>{lastUpdate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Device:</span>
                  <span>BEC016-Thing-Group5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Region:</span>
                  <span>us-west-2</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;