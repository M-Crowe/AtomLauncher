export type AccountType = 'microsoft' | 'offline';

export interface Account {
  id: string;
  name: string;
  uuid: string;
  accountType: AccountType;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  skinUrl?: string;
  isActive: boolean;
  xuid?: string;
}

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  message: string;
}

export interface DeviceCodePollResult {
  status: 'pending' | 'success' | 'expired' | 'error';
  message?: string;
  account?: Account;
}
