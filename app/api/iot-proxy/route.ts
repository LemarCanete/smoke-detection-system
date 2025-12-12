import { mqtt, iot, io } from 'aws-iot-device-sdk-v2';
import { certificates } from '@/app/certs';

let connection: mqtt.MqttClientConnection | null = null;

async function ensureConnection() {
  if (connection) {
    return connection;
  }

  const clientBootstrap = new io.ClientBootstrap();
  
  const configBuilder = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder(
    certificates.cert,
    certificates.key
  );
  
  configBuilder.with_clean_session(false);
  configBuilder.with_client_id('BEC016-Thing-Group5-Proxy-' + Date.now());
  configBuilder.with_endpoint('a1vzvyrus3qan7-ats.iot.us-west-2.amazonaws.com');
  
  const config = configBuilder.build();
  const client = new mqtt.MqttClient(clientBootstrap);
  connection = client.new_connection(config);
  
  await connection.connect();
  console.log('✅ Proxy connected to AWS IoT');
  
  return connection;
}

export async function POST(request: Request) {
  const { action, topic, payload } = await request.json();

  try {
    const conn = await ensureConnection();

    if (action === 'publish') {
      console.log('📤 Publishing to:', topic, payload);
      await conn.publish(topic, payload, mqtt.QoS.AtLeastOnce);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('IoT Proxy Error:', error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}