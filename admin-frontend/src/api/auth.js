import api from './client'

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  publicSettings: () => api.get('/setup/public-settings'),
}

export const usersApi = {
  list: (params) => api.get('/users', { params }),
  create: (data) => api.post('/users/', data),
  updateRole: (id, data) => api.put(`/users/${id}/role`, data),
  delete: (id) => api.delete(`/users/${id}`),
}

export const adminApi = {
  stats: () => api.get('/admin/stats'),
  analytics: (period = 'month') => api.get('/admin/analytics', { params: { period } }),
  getSettings: () => api.get('/admin/settings'),
  updateSetting: (key, value) => api.put(`/admin/settings/${key}`, { value }),
  smtpTest: (to) => api.post('/admin/smtp/test', { to }),
  listNewsletters: () => api.get('/admin/newsletters'),
  createNewsletter: (data) => api.post('/admin/newsletters', data),
  previewNewsletter: (data) => api.post('/admin/newsletters/preview', data),
  sendNewsletter: (id) => api.post(`/admin/newsletters/${id}/send`),
  getEmailTemplates: () => api.get('/admin/email-templates'),
  updateEmailTemplate: (event, data) => api.put(`/admin/email-templates/${event}`, data),
  telegramInfo: () => api.get('/admin/telegram'),
  telegramTest: () => api.post('/admin/telegram/test'),
  telegramSetWebhook: (url) => api.post('/admin/telegram/webhook', { url }),
  telegramDeleteWebhook: () => api.delete('/admin/telegram/webhook'),
  telegramUploadInfo: () => api.get('/admin/telegram-upload'),
  telegramUploadSetWebhook: (url) => api.post('/admin/telegram-upload/webhook', { url }),
  telegramUploadDeleteWebhook: () => api.delete('/admin/telegram-upload/webhook'),
  getVpnStatus: () => api.get('/admin/vpn-status'),
  restartBots: () => api.post('/admin/bots/restart', { container: 'sbrw_bots' }),
  getWireguard: () => api.get('/admin/wireguard'),
  saveWireguard: (data) => api.put('/admin/wireguard', data),
  deleteWireguard: () => api.delete('/admin/wireguard'),
  // Multi-config VPN
  listVpnConfigs: () => api.get('/admin/vpn/configs'),
  getVpnConfig: (id) => api.get(`/admin/vpn/configs/${id}`),
  createVpnConfig: (data) => api.post('/admin/vpn/configs', data),
  updateVpnConfig: (id, data) => api.put(`/admin/vpn/configs/${id}`, data),
  deleteVpnConfig: (id) => api.delete(`/admin/vpn/configs/${id}`),
  activateVpnConfig: (id) => api.post(`/admin/vpn/configs/${id}/activate`),
  testVpnConfigs: () => api.post('/admin/vpn/test-configs'),
  // Docker
  listContainers: () => api.get('/admin/docker/containers'),
  restartContainer: (name) => api.post(`/admin/docker/containers/${name}/restart`),
  containerLogs: (name, lines = 200) => api.get(`/admin/docker/containers/${name}/logs`, { params: { lines } }),
  // LLM / AI assistant
  getLLMStatus: () => api.get('/admin/llm/status'),
  testLLM: () => api.post('/admin/llm/test'),
  getOllamaModels: () => api.get('/admin/llm/ollama-models'),
  pullOllamaModel: (model) => api.post('/admin/llm/ollama-models', { model }),
  triggerBookAnalyze: (bookId) => api.post(`/admin/llm/analyze/${bookId}`),
}
