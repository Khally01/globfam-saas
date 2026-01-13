import { api } from '../api';

export interface CreateBudgetDto {
  monthlyIncome: number;
  incomeCurrency: string;
  month: string; // YYYY-MM-01 format
  items?: CreateBudgetItemDto[];
}

export interface UpdateBudgetDto {
  monthlyIncome?: number;
  incomeCurrency?: string;
}

export interface CreateBudgetItemDto {
  category: string;
  amount: number;
  currency: string;
  notes?: string;
}

export interface UpdateBudgetItemDto {
  category?: string;
  amount?: number;
  currency?: string;
  notes?: string;
}

export const budgetsApi = {
  /**
   * Create a new budget for a specific month
   */
  create: (data: CreateBudgetDto) =>
    api.post('/api/budgets', data),

  /**
   * Get all budgets for the current user
   */
  getAll: () =>
    api.get('/api/budgets'),

  /**
   * Get budget for current month
   */
  getCurrent: () =>
    api.get('/api/budgets/current'),

  /**
   * Get a specific budget by ID
   */
  getById: (id: string) =>
    api.get(`/api/budgets/${id}`),

  /**
   * Update a budget
   */
  update: (id: string, data: UpdateBudgetDto) =>
    api.put(`/api/budgets/${id}`, data),

  /**
   * Delete a budget
   */
  delete: (id: string) =>
    api.delete(`/api/budgets/${id}`),

  // Budget Items
  /**
   * Add an item to a budget
   */
  addItem: (budgetId: string, item: CreateBudgetItemDto) =>
    api.post(`/api/budgets/${budgetId}/items`, item),

  /**
   * Update a budget item
   */
  updateItem: (budgetId: string, itemId: string, data: UpdateBudgetItemDto) =>
    api.put(`/api/budgets/${budgetId}/items/${itemId}`, data),

  /**
   * Delete a budget item
   */
  deleteItem: (budgetId: string, itemId: string) =>
    api.delete(`/api/budgets/${budgetId}/items/${itemId}`),

  // Summary with conversions
  /**
   * Get budget summary with multi-currency conversion
   * Returns items with both native amounts and converted amounts
   */
  getSummary: (budgetId: string) =>
    api.get(`/api/budgets/${budgetId}/summary`),
};
