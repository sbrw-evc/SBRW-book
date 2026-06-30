import api from './client'

export const booksApi = {
  list: (params) => api.get('/books', { params }),
  delete: (id) => api.delete(`/books/${id}`),
  toggleVisibility: (id, isPublic) => api.patch(`/books/${id}/visibility`, { is_public: isPublic }),
}
