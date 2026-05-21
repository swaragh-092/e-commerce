import api from './api';

const BlogService = {
  getPublicPosts: async (params) => {
    const response = await api.get('/blogs/posts', { params });
    return response.data;
  },

  getPublicPostBySlug: async (slug) => {
    const response = await api.get(`/blogs/posts/${slug}`);
    return response.data;
  },

  getPublicCategories: async () => {
    const response = await api.get('/blogs/categories');
    return response.data;
  },

  getPublicCategoryBySlug: async (slug) => {
    const response = await api.get(`/blogs/categories/${slug}`);
    return response.data;
  },

  adminCreatePost: async (payload) => {
    const response = await api.post('/blogs/admin/posts', payload);
    return response.data;
  },

  adminUpdatePost: async (id, payload) => {
    const response = await api.put(`/blogs/admin/posts/${id}`, payload);
    return response.data;
  },

  adminDeletePost: async (id) => {
    const response = await api.delete(`/blogs/admin/posts/${id}`);
    return response.data;
  },

  adminGetPosts: async (params) => {
    const response = await api.get('/blogs/admin/posts', { params });
    return response.data;
  },

  adminGetPostById: async (id) => {
    const response = await api.get(`/blogs/admin/posts/${id}`);
    return response.data;
  },

  adminCreateCategory: async (payload) => {
    const response = await api.post('/blogs/categories', payload);
    return response.data;
  },

  adminUpdateCategory: async (id, payload) => {
    const response = await api.put(`/blogs/categories/${id}`, payload);
    return response.data;
  },

  adminDeleteCategory: async (id) => {
    const response = await api.delete(`/blogs/categories/${id}`);
    return response.data;
  },
};

export default BlogService;
