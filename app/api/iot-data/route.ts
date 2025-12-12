import { mqtt, iot, io } from 'aws-iot-device-sdk-v2';
import { certificates } from '@/app/certs';

let connection: mqtt.MqttClientConnection | null = null;
let latestData: any = { 
  smoke_level: 0, 
  status: 'NORMAL', 
  vent_state: 'CLOSED' 
};
let isConnecting = false;

async function ensureConnection() {
  if (connection) {
    return connection;
  }

  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return connection;
  }

  isConnecting = true;

  try {
    console.log('Creating AWS IoT connection...');
    
    const clientBootstrap = new io.ClientBootstrap();
    
    const configBuilder = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder(
      certificates.cert,
      certificates.key
    );
    
    configBuilder.with_clean_session(false);
    configBuilder.with_client_id('BEC016-Thing-Group5-Server-' + Date.now());
    configBuilder.with_endpoint('a1vzvyrus3qan7-ats.iot.us-west-2.amazonaws.com');
    configBuilder.with_keep_alive_seconds(30);
    
    const config = configBuilder.build();
    const client = new mqtt.MqttClient(clientBootstrap);
    connection = client.new_connection(config);
    
    connection.on('connect', () => {
      console.log('✅ Connected to AWS IoT Core');
    });
    
    connection.on('disconnect', () => {
      console.log('❌ Disconnected from AWS IoT Core');
      connection = null;
    });
    
    connection.on('error', (error) => {
      console.error('AWS IoT Error:', error);
    });
    
    // Inside ensureConnection(), replace the subscription block with:

await connection.connect();
console.log('Connection established, subscribing to topic...');

// DON'T await the subscribe - just call it
const topic = 'devices/BEC016-Thing-Group5/data';
console.log(`🔔 Subscribing to: ${topic}`);
console.log(`🔔 Subscribing to: ${topic}`);

connection.subscribe(
  topic,
  mqtt.QoS.AtLeastOnce,
  (receivedTopic, payload) => {
    try {
      console.log('📥 RAW callback triggered! Topic:', receivedTopic);
      const decoded = new TextDecoder('utf8').decode(new Uint8Array(payload));
      console.log('📄 Raw payload:', decoded);
      
      const message = JSON.parse(decoded);
      console.log('📥 Parsed data:', message);
      
      latestData = {
        smoke_level: message.smoke_level || 0,
        status: message.status || 'NORMAL',
        vent_state: message.vent_state || latestData.vent_state || 'CLOSED'
      };
      
      console.log('✅ Updated latestData:', latestData);
    } catch (error) {
      console.error('❌ Error in callback:', error);
    }
  }
).then(() => {
  console.log(`✅ Subscribed to ${topic}`);
}).catch((err) => {
  console.error('❌ Subscribe error:', err);
});

// Add a small delay to let subscription establish
await new Promise(resolve => setTimeout(resolve, 2000));

console.log('Subscription initiated, ready to receive data');
isConnecting = false;
return connection;
    
  } catch (error) {
    console.error('Failed to connect to AWS IoT:', error);
    isConnecting = false;
    connection = null;
    throw error;
  }
}

export async function GET() {
  try {
    await ensureConnection();
    console.log('Returning latest data:', latestData);
    return Response.json(latestData);
  } catch (error) {
    console.error('IoT Data Error:', error);
    return Response.json({ 
      error: String(error),
      smoke_level: 0,
      status: 'ERROR',
      vent_state: 'UNKNOWN'
    }, { status: 500 });
  }
}