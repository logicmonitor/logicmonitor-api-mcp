/**
 * Authentication types and interfaces
 */

export interface AuthResult {
  success: boolean;
  clientId?: string;
  error?: string;
  credentials?: {
    lm_account: string;
    lm_bearer_token: string;
  };
}

export interface AuthContext {
  clientId: string;
  authMode: 'none' | 'bearer';
  credentials: {
    lm_account: string;
    lm_bearer_token: string;
  };
}

export interface AuthValidator {
  validate(token: string): Promise<AuthResult>;
}

