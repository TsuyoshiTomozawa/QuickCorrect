// Test script to verify API key sanitization

// Mock sanitization function
function sanitizeSettingsForLogging(settings) {
  if (!settings) return settings;
  
  const sanitized = { ...settings };
  const sensitiveKeys = ['openAIApiKey', 'googleGeminiApiKey', 'anthropicApiKey', 'apiKey', 'api_key'];
  
  for (const key of sensitiveKeys) {
    if (sanitized[key]) {
      // Show only last 4 characters of the key
      const value = String(sanitized[key]);
      sanitized[key] = value.length > 4 
        ? `***${value.slice(-4)}` 
        : '****';
    }
  }
  
  return sanitized;
}

// Test cases
const testSettings = {
  openAIApiKey: 'sk-1234567890abcdefghijklmnop',
  googleGeminiApiKey: 'AIzaSyB123456789012345678901234567890',
  anthropicApiKey: 'sk-ant-api03-1234567890abcdef',
  theme: 'dark',
  language: 'en',
  hotkeyEnabled: true
};

console.log('Original settings:');
console.log(JSON.stringify(testSettings, null, 2));

console.log('\nSanitized settings:');
console.log(JSON.stringify(sanitizeSettingsForLogging(testSettings), null, 2));

// Test edge cases
console.log('\nEdge cases:');
console.log('Short key:', sanitizeSettingsForLogging({ apiKey: '123' }));
console.log('Empty key:', sanitizeSettingsForLogging({ apiKey: '' }));
console.log('Null settings:', sanitizeSettingsForLogging(null));
console.log('Undefined settings:', sanitizeSettingsForLogging(undefined));