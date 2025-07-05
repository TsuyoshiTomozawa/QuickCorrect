/**
 * Security-related constants
 */

// List of sensitive keys that should be sanitized in logs
export const SENSITIVE_KEYS = [
  'openAIApiKey',
  'googleGeminiApiKey',
  'anthropicApiKey',
  'apiKey',
  'api_key',
  'api-key',
  'apiSecret',
  'api_secret',
  'api-secret',
  'secret',
  'password',
  'token',
  'accessToken',
  'access_token',
  'access-token',
  'refreshToken',
  'refresh_token',
  'refresh-token'
] as const;

export type SensitiveKey = typeof SENSITIVE_KEYS[number];