'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input } from '@/components/shared-ui'
import { PlusCircle, X, TrendingUp, CheckCircle, AlertTriangle, DollarSign, Globe } from 'lucide-react'
import { budgetsApi } from '@/lib/api/budgets'
import { analyticsApi } from '@/lib/api/analytics'
import { useAuthStore } from '@/store/auth'
import { useToast } from '@/hooks/use-toast'
import type { BudgetSummary, BudgetItemWithConversion } from '@/lib/shared-types'
import { ProgressBar } from '@/components/ui/progress-bar'

const DEFAULT_CATEGORIES = [
  'Rent', 'Mortgage', 'Groceries', 'Utilities', 'Transport',
  'Healthcare', 'Education', 'Childcare', 'Entertainment',
  'Shopping', 'Insurance', 'Taxes', 'Other'
]

const SUPPORTED_CURRENCIES = [
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'MNT', name: 'Mongolian Tugrik', flag: '🇲🇳' },
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳' },
]

interface BudgetItemEdit {
  id?: string
  category: string
  amount: number
  currency: string
  notes?: string
}

export default function BudgetPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState<BudgetSummary | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [incomeCurrency, setIncomeCurrency] = useState('AUD')
  const [budgetItems, setBudgetItems] = useState<BudgetItemEdit[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [comparison, setComparison] = useState<any[]>([])
  const [totalSpent, setTotalSpent] = useState(0)
  const { toast } = useToast()

  const preferredCurrency = user?.preferredCurrency || 'AUD'

  useEffect(() => {
    loadBudget()
  }, [])

  const loadBudget = async () => {
    setLoading(true)
    try {
      // Try to load current month's budget
      const response = await budgetsApi.getCurrent()
      const currentBudget = response.data.data.budget

      // Get summary with conversions
      const summaryResponse = await budgetsApi.getSummary(currentBudget.id)
      const budgetSummary = summaryResponse.data.data
      setSummary(budgetSummary)

      // Fetch budget comparison (actual spending vs budget)
      await fetchBudgetComparison(budgetSummary)

      // Set edit data
      setMonthlyIncome(currentBudget.monthlyIncome.toString())
      setIncomeCurrency(currentBudget.incomeCurrency)
      setBudgetItems(currentBudget.items.map((item: any) => ({
        id: item.id,
        category: item.category,
        amount: Number(item.amount),
        currency: item.currency,
        notes: item.notes
      })))
    } catch (error: any) {
      // If no budget exists for current month, initialize with defaults
      if (error.response?.status === 404) {
        setBudgetItems(DEFAULT_CATEGORIES.map(cat => ({
          category: cat,
          amount: 0,
          currency: preferredCurrency
        })))
        setMonthlyIncome('0')
        setIncomeCurrency(preferredCurrency)
        setEditMode(true) // Start in edit mode if no budget exists
      } else {
        console.error('Error loading budget:', error)
        toast({
          title: 'Error',
          description: 'Failed to load budget',
          variant: 'destructive'
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchBudgetComparison = async (budgetSummary: BudgetSummary) => {
    try {
      // Create budget map from summary items (in converted currency)
      const budgetMap = budgetSummary.items.reduce((acc, item) => {
        acc[item.category] = item.convertedAmount
        return acc
      }, {} as Record<string, number>)

      // Get start of current month
      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endDate = new Date().toISOString()

      // Fetch comparison from analytics API
      const response = await analyticsApi.getBudgetComparison({
        budget: budgetMap,
        startDate,
        endDate
      })

      const comparisonData = response.data.data.comparison
      setComparison(comparisonData)

      // Calculate total spent
      const total = comparisonData.reduce((sum: number, c: any) => sum + c.actualAmount, 0)
      setTotalSpent(total)
    } catch (error) {
      console.error('Error fetching budget comparison:', error)
      // Don't show error toast - just leave it empty if it fails
    }
  }

  const handleSaveBudget = async () => {
    if (!monthlyIncome || parseFloat(monthlyIncome) <= 0) {
      toast({
        title: 'Income required',
        description: 'Please enter your monthly income',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      // Get current month (first day of month)
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      // Filter out items with 0 amount
      const validItems = budgetItems.filter(item => item.amount > 0)

      // Create or update budget
      const budgetData = {
        monthlyIncome: parseFloat(monthlyIncome),
        incomeCurrency,
        month,
        items: validItems.map(item => ({
          category: item.category,
          amount: item.amount,
          currency: item.currency,
          notes: item.notes
        }))
      }

      let budgetId: string

      if (summary?.budget.id) {
        // Update existing budget
        await budgetsApi.update(summary.budget.id, {
          monthlyIncome: budgetData.monthlyIncome,
          incomeCurrency: budgetData.incomeCurrency
        })

        // Delete all existing items and recreate (simpler than diffing)
        for (const item of summary.items) {
          await budgetsApi.deleteItem(summary.budget.id, item.id)
        }

        // Add new items
        for (const item of budgetData.items) {
          await budgetsApi.addItem(summary.budget.id, item)
        }

        budgetId = summary.budget.id
      } else {
        // Create new budget
        const response = await budgetsApi.create(budgetData)
        budgetId = response.data.data.budget.id
      }

      // Reload budget with conversions
      const summaryResponse = await budgetsApi.getSummary(budgetId)
      setSummary(summaryResponse.data.data)

      setEditMode(false)
      toast({
        title: 'Budget saved!',
        description: 'Your multi-currency budget has been saved successfully.'
      })
    } catch (error: any) {
      console.error('Error saving budget:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to save budget',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const updateBudgetItem = (index: number, field: keyof BudgetItemEdit, value: any) => {
    const newItems = [...budgetItems]
    newItems[index] = { ...newItems[index], [field]: value }
    setBudgetItems(newItems)
  }

  const addCategory = () => {
    if (newCategory.trim()) {
      setBudgetItems([...budgetItems, {
        category: newCategory.trim(),
        amount: 0,
        currency: preferredCurrency
      }])
      setNewCategory('')
    }
  }

  const removeCategory = (index: number) => {
    setBudgetItems(budgetItems.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-muted rounded"></div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg"></div>
          ))}
        </div>
        <div className="h-64 bg-muted rounded-lg"></div>
      </div>
    )
  }

  const totalConverted = summary?.totalConverted || 0
  const incomeConverted = summary?.budget.monthlyIncomeConverted || parseFloat(monthlyIncome || '0')
  const remaining = incomeConverted - totalConverted

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary" />
            Multi-Currency Budget
          </h1>
          <p className="text-muted-foreground">
            Budget in the currencies you actually use - AUD rent, MNT mortgage, USD remittances
          </p>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditMode(false)
                  loadBudget() // Reload to reset changes
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveBudget} disabled={saving}>
                {saving ? 'Saving...' : 'Save Budget'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditMode(true)}>
              Edit Budget
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Monthly Income */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <div className="space-y-2">
                <Input
                  type="number"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                  placeholder="0"
                  className="text-xl font-bold"
                />
                <select
                  value={incomeCurrency}
                  onChange={(e) => setIncomeCurrency(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  {SUPPORTED_CURRENCIES.map(curr => (
                    <option key={curr.code} value={curr.code}>
                      {curr.flag} {curr.code}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-bold">
                  {parseFloat(monthlyIncome || '0').toLocaleString()} {incomeCurrency}
                </div>
                {incomeCurrency !== preferredCurrency && summary && (
                  <div className="text-sm text-muted-foreground">
                    ≈ {incomeConverted.toLocaleString()} {preferredCurrency}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Budget */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalConverted.toLocaleString()} {preferredCurrency}
            </div>
            {summary && Object.keys(summary.totalNative).length > 1 && (
              <div className="text-xs text-muted-foreground mt-1">
                {Object.entries(summary.totalNative).map(([curr, amt]) => (
                  <div key={curr}>{amt.toLocaleString()} {curr}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spent This Month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Spent This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalSpent.toLocaleString()} {preferredCurrency}
            </div>
            <div className="text-sm text-muted-foreground">
              {incomeConverted > 0
                ? `${((totalSpent / incomeConverted) * 100).toFixed(1)}% of income`
                : 'Set income to track percentage'
              }
            </div>
          </CardContent>
        </Card>

        {/* Remaining */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${remaining >= 0 ? 'text-success' : 'text-error'}`}>
              {remaining.toLocaleString()} {preferredCurrency}
            </div>
            <div className="text-sm text-muted-foreground">
              {remaining >= 0 ? 'Under budget' : 'Over budget'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Categories */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Budget Categories</CardTitle>
              <CardDescription>
                {editMode
                  ? 'Set budget amounts in their native currencies'
                  : 'Your multi-currency budget breakdown'
                }
              </CardDescription>
            </div>
            {!editMode && summary && (
              <div className="text-sm text-muted-foreground">
                Displaying in: <strong>{preferredCurrency}</strong>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {editMode ? (
              // Edit Mode - Show currency selectors
              <>
                {budgetItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1 font-medium min-w-[120px]">
                      {item.category}
                    </div>

                    <Input
                      type="number"
                      value={item.amount || ''}
                      onChange={(e) => updateBudgetItem(index, 'amount', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-32"
                    />

                    <select
                      value={item.currency}
                      onChange={(e) => updateBudgetItem(index, 'currency', e.target.value)}
                      className="p-2 border rounded w-24"
                    >
                      {SUPPORTED_CURRENCIES.map(curr => (
                        <option key={curr.code} value={curr.code}>
                          {curr.flag} {curr.code}
                        </option>
                      ))}
                    </select>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCategory(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <div className="flex gap-2 pt-4 border-t">
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Add new category"
                    onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                  />
                  <Button onClick={addCategory} variant="outline">
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              // View Mode - Show conversions with spending progress
              <>
                {summary?.items.map((item: BudgetItemWithConversion) => {
                  const spent = comparison.find((c: any) => c.category === item.category)
                  const spentAmount = spent?.actualAmount || 0
                  const percentUsed = spent?.percentUsed || 0

                  return (
                    <div key={item.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-lg">{item.category}</div>
                        <div className="text-right">
                          <div className="text-xl font-bold">
                            {item.nativeAmount.toLocaleString()} {item.nativeCurrency}
                          </div>
                          {item.nativeCurrency !== preferredCurrency && (
                            <div className="text-sm text-muted-foreground">
                              ≈ {item.convertedAmount.toLocaleString()} {preferredCurrency}
                              <div className="text-xs">
                                Rate: 1 {item.nativeCurrency} = {item.exchangeRate.toFixed(6)} {preferredCurrency}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Spent:</span>
                          <span className="font-medium">
                            {spentAmount.toLocaleString()} {preferredCurrency} ({percentUsed.toFixed(0)}%)
                          </span>
                        </div>
                        <ProgressBar
                          value={spentAmount}
                          max={item.convertedAmount}
                          showPercentage={false}
                        />
                      </div>
                    </div>
                  )
                }) || (
                  <div className="text-center py-8 text-muted-foreground">
                    No budget items yet. Click "Edit Budget" to get started!
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Budget Insights */}
      {summary && !editMode && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Multi-Currency Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <Globe className="h-4 w-4 text-primary mt-0.5" />
                <span>
                  Your budget includes <strong>{Object.keys(summary.totalNative).length}</strong> different currencies.
                  This is automatically converted to {preferredCurrency} for easy tracking.
                </span>
              </div>

              {Object.keys(summary.totalNative).includes('MNT') && (
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>
                    🇲🇳 Your Mongolian Tugrik (MNT) expenses are tracked at current exchange rates.
                    Perfect for managing your Mongolia mortgage!
                  </span>
                </div>
              )}

              {remaining > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-blue-600 mt-0.5" />
                  <span>
                    You have {remaining.toLocaleString()} {preferredCurrency} remaining after budgeted expenses.
                    Great planning!
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
