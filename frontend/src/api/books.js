import api from './client'
import { useAppStore } from '../store/appStore'

export const booksApi = {
  list: (params) => api.get('/books', { params }),
  recent: (limit = 12) => api.get('/books/recent', { params: { limit } }),
  popular: (limit = 12) => api.get('/books/popular', { params: { limit } }),
  topRated: (limit = 12) => api.get('/books/top-rated', { params: { limit } }),
  get: (id) => api.get(`/books/${id}`),
  upload: (formData, onProgress) =>
    api.post('/books/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    }),
  // Extract metadata from a book file and search online for enrichment
  extractMetadata: (formData) =>
    api.post('/books/metadata-search', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 20000,
    }),
  // Search online by title / authors without file
  searchMetadata: (params) => api.get('/books/metadata-search', { params }),
  // Trigger AI analysis (review + metadata suggestions) for an existing book
  triggerAIAnalyze: (id) => api.post(`/books/${id}/analyze`, {}, { timeout: 10000 }),
  update: (id, data) => api.put(`/books/${id}`, data),
  delete: (id) => api.delete(`/books/${id}`),
  // Format conversion can take a while on large books
  convert: (id, targetFormat) =>
    api.post(`/books/${id}/convert`, { target_format: targetFormat }, { timeout: 300000 }),
  uploadCover: (id, formData) =>
    api.post(`/books/${id}/cover`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getProgress: (id) => api.get(`/books/${id}/progress`),
  saveProgress: (id, data) => api.post(`/books/${id}/progress`, data),
  rate: (id, data) => api.post(`/books/${id}/rate`, data),
  getMyRating: (id) => api.get(`/books/${id}/rate`),
  deleteMyRating: (id) => api.delete(`/books/${id}/rate`),
  deleteRatingById: (bookId, ratingId) => api.delete(`/books/${bookId}/ratings/${ratingId}`),
  getRatings: (id) => api.get(`/books/${id}/ratings`),
  listFiles: (id) => api.get(`/books/${id}/files`),
  addFile: (id, formData, onProgress) =>
    api.post(`/books/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    }),
  updateFileLabel: (id, fileId, version_label) => api.patch(`/books/${id}/files/${fileId}`, { version_label }),
  deleteFile: (id, fileId) => api.delete(`/books/${id}/files/${fileId}`),
  uploadMedia: (formData) => api.post('/upload/media', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  downloadUrl: (id, fmt) => `${import.meta.env.VITE_API_URL || '/api'}/books/${id}/download/${fmt}`,
  readUrl: (id, fmt = 'epub') => `${import.meta.env.VITE_API_URL || '/api'}/books/${id}/read?fmt=${fmt}`,
  getAnnotations: (id) => api.get(`/books/${id}/annotations`),
  createAnnotation: (id, data) => api.post(`/books/${id}/annotations`, data),
  updateAnnotation: (id, annotationId, data) => api.patch(`/books/${id}/annotations/${annotationId}`, data),
  deleteAnnotation: (id, annotationId) => api.delete(`/books/${id}/annotations/${annotationId}`),
  getComments: (id) => api.get(`/books/${id}/comments`),
  createComment: (id, data) => api.post(`/books/${id}/comments`, data),
  updateComment: (id, commentId, data) => api.patch(`/books/${id}/comments/${commentId}`, data),
  deleteComment: (id, commentId) => api.delete(`/books/${id}/comments/${commentId}`),
  getBookTOC: (id) => api.get(`/books/${id}/toc`),
  createAudioBook: (data) => api.post('/books/create-audio', data),
  getAudioChapters: (id) => api.get(`/books/${id}/audio`),
  uploadAudioChapter: (id, formData, onProgress) =>
    api.post(`/books/${id}/audio`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    }),
  deleteAudioChapter: (bookId, chapterId) => api.delete(`/books/${bookId}/audio/${chapterId}`),
  getAudioProgress: (bookId) => api.get(`/books/${bookId}/audio/progress`),
  saveAudioProgress: (bookId, data) => api.post(`/books/${bookId}/audio/progress`, data),
  audioStreamUrl: (bookId, chapterId) => {
    const base = `${import.meta.env.VITE_API_URL || '/api'}/books/${bookId}/audio/${chapterId}/stream`
    const token = useAppStore.getState().accessToken
    return token ? `${base}?token=${token}` : base
  },
}

export const authorsApi = {
  list: (params) => api.get('/authors', { params }),
  get: (id) => api.get(`/authors/${id}`),
  books: (id) => api.get(`/authors/${id}/books`),
  update: (id, data) => api.put(`/authors/${id}`, data),
}

export const seriesApi = {
  list: (params) => api.get('/series', { params }),
  get: (id) => api.get(`/series/${id}`),
  books: (id) => api.get(`/series/${id}/books`),
  subscription: (id) => api.get(`/series/${id}/subscription`),
  subscribe: (id) => api.post(`/series/${id}/subscription`),
  unsubscribe: (id) => api.delete(`/series/${id}/subscription`),
}

export const tagsApi = {
  list: (params) => api.get('/tags', { params }),
}
