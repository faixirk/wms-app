const ENDPOINTS = {
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_VERIFY_OTP_PASS: '/auth/verify-otp-pass',
  AUTH_RESET_PASSWORD: '/auth/reset-password',
  AUTH_VERIFY_EMAIL: '/auth/verify-email',
  AUTH_VERIFY_OTP: '/auth/verify-otp',
  WORKSPACES: '/workspaces',
  WORKSPACE_MEMBERS: (workspaceId: string) => `/workspaces/${workspaceId}/members`,

  // Chat APIs
  CHATS_LIST: '/v2/chats',
  CHAT_MESSAGES: '/v2/chats/{chatId}/messages',
  CHAT_MESSAGES_DYNAMIC: (chatId: string) => `/v2/chats/${chatId}/messages`,
  CHAT_CREATE: '/v2/chats',
  CHAT_READ: '/v2/chats/{chatId}/read',
  CHAT_READ_DYNAMIC: (chatId: string) => `/v2/chats/${chatId}/read`,

  // S3 Upload APIs
  PRESIGNED_URL: '/s3/presignedurl',
  DIRECT_UPLOAD: '/s3/upload',
};

export default ENDPOINTS;
