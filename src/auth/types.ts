/**
 * Authentication types and interfaces
 */

import type { LMCredentials } from './lmCredentials.js';

export interface AuthResult {
  success: boolean;
  clientId?: string;
  error?: string;
  credentials?: LMCredentials;
}

export interface AuthContext {
  clientId: string;
  authMode: 'none' | 'bearer';
  credentials: LMCredentials;
}

export interface AuthValidator {
  validate(token: string): Promise<AuthResult>;
}
