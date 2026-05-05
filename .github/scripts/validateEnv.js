const fs = require('fs');
const path = require('path');

const envExamplePath = path.join(__dirname, '../../.env example');
if (!fs.existsSync(envExamplePath)) {
  console.log('No ".env example" found, skipping validation.');
  process.exit(0);
}

const exampleContent = fs.readFileSync(envExamplePath, 'utf8');
const expectedKeys = exampleContent
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0 && !line.startsWith('#') && line.includes('='))
  .map(line => line.split('=')[0].trim());

const hasEnv = fs.existsSync(path.join(__dirname, '../../.env'));
if (hasEnv) {
  const envContent = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf8');
  const actualKeys = envContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#') && line.includes('='))
    .map(line => line.split('=')[0].trim());

  const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));
  if (missingKeys.length > 0) {
    console.error(`❌ Missing keys in .env: ${missingKeys.join(', ')}`);
    process.exit(1);
  } else {
    console.log('✅ .env file is fully synced with .env example!');
  }
} else {
  console.log('✅ .env example format is valid.');
  console.log('Expected Keys:', expectedKeys.join(', '));
}
