import api from './client'

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  setupStatus: () => api.get('/setup/status'),
  publicSettings: () => api.get('/setup/public-settings'),
  completeSetup: (data) => api.post('/setup/complete', data),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  resendVerification: () => api.post('/auth/resend-verification'),
  requestPasswordReset: (email) => api.post('/auth/request-password-reset', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  
  verify2FA: (data) => api.post('/auth/2fa/verify', data),
  resend2FA: (session_id) => api.post('/auth/2fa/resend', { session_id }),
  
  totpSetup: () => api.post('/auth/totp/setup'),
  totpEnable: (code) => api.post('/auth/totp/enable', { code }),
  totpDisable: (code) => api.post('/auth/totp/disable', { code }),
  
  telegramStatus: () => api.get('/users/me/telegram'),
  telegramLinkInit: () => api.post('/users/me/telegram/link'),
  telegramUnlink: () => api.delete('/users/me/telegram'),
  telegramToggle2FA: (enable) => api.post('/users/me/telegram/2fa', { enable }),
  
  listSessions: () => api.get('/users/me/sessions'),
  revokeSession: (id) => api.delete(`/users/me/sessions/${id}`),
  revokeOtherSessions: () => api.delete('/users/me/sessions'),
}

export const usersApi = {
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  getPublicProfile: (id) => api.get(`/users/${id}/public`),
  create: (data) => api.post('/users/', data),
  updateMe: (data) => api.put('/users/me', data),
  uploadAvatar: (formData) => api.post('/users/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateRole: (id, data) => api.put(`/users/${id}/role`, data),
  delete: (id) => api.delete(`/users/${id}`),
}

export const chatApi = {
  listRooms: () => api.get('/chat'),
  createRoom: (data) => api.post('/chat', data),
  getRoom: (id) => api.get(`/chat/${id}`),
  deleteRoom: (id) => api.delete(`/chat/${id}`),
  addMember: (roomId, userId) => api.post(`/chat/${roomId}/members`, { user_id: userId }),
  removeMember: (roomId, userId) => api.delete(`/chat/${roomId}/members`, { data: { user_id: userId } }),
  getMessages: (roomId, after) => api.get(`/chat/${roomId}/messages`, { params: after ? { after } : {} }),
  sendMessage: (roomId, data) => api.post(`/chat/${roomId}/messages`, data),
  deleteMessage: (roomId, messageId) => api.delete(`/chat/${roomId}/messages/${messageId}`),
}

export const adminApi = {
  stats: () => api.get('/admin/stats'),
  getSettings: () => api.get('/admin/settings'),
  updateSetting: (key, value) => api.put(`/admin/settings/${key}`, { value }),
  smtpTest: (to) => api.post('/admin/smtp/test', { to }),
  listNewsletters: () => api.get('/admin/newsletters'),
  createNewsletter: (data) => api.post('/admin/newsletters', data),
  previewNewsletter: (data) => api.post('/admin/newsletters/preview', data),
  sendNewsletter: (id) => api.post(`/admin/newsletters/${id}/send`),
  getEmailTemplates: () => api.get('/admin/email-templates'),
  updateEmailTemplate: (event, data) => api.put(`/admin/email-templates/${event}`, data),
}

export const shelvesApi = {
  list: () => api.get('/shelves'),
  get: (id) => api.get(`/shelves/${id}`),
  create: (data) => api.post('/shelves', data),
  delete: (id) => api.delete(`/shelves/${id}`),
  addBook: (shelfId, bookId) => api.post(`/shelves/${shelfId}/books/${bookId}`),
  removeBook: (shelfId, bookId) => api.delete(`/shelves/${shelfId}/books/${bookId}`),
}
