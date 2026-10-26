require('dotenv').config({ path: '.env.local' });
const { ModelGateway } = require('./packages/model-gateway/src/index');
const config = require('./config/providers.json');

async function test() {
  console.log('Testing FreeLLMAPI connection...');
  console.log('Base URL:', config.providers.freellmapi.baseUrl);
  console.log('Model:', config.providers.freellmapi.model);
  
  const gateway = new ModelGateway(config);
  const provider = gateway.getProviderForTask('audit');
  
  if (!provider) {
    console.error('No provider for audit task');
    process.exit(1);
  }
  
  try {
    const res = await provider.complete({
      model: 'auto',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Respond in French briefly.' },
        { role: 'user', content: 'Dis juste "OK" si tu es bien connecté.' }
      ],
      temperature: 0.1,
      maxTokens: 10,
    });
    console.log('Response:', res.content);
    console.log('Provider:', res.provider);
    console.log('Latency:', res.latencyMs, 'ms');
    console.log('Cost:', res.cost);
    console.log('\n✅ FreeLLMAPI connection successful!');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

test();
