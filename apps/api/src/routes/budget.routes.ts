import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { exchangeRateService } from '../services/currency/exchange-rate.service';

const router = Router();

// Validation schemas
const createBudgetSchema = z.object({
  name: z.string().min(1).max(100).default("Main Budget"), // Budget name/scenario
  monthlyIncome: z.number().positive(),
  incomeCurrency: z.string().length(3),
  month: z.string().regex(/^\d{4}-\d{2}-01$/), // YYYY-MM-01 format
  items: z.array(
    z.object({
      category: z.string().min(1),
      amount: z.number().positive(),
      currency: z.string().length(3),
      notes: z.string().optional(),
    })
  ).optional(),
});

const updateBudgetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  monthlyIncome: z.number().positive().optional(),
  incomeCurrency: z.string().length(3).optional(),
});

const budgetItemSchema = z.object({
  category: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  notes: z.string().optional(),
});

// ===== Budget CRUD Routes =====

/**
 * Create a new budget for a specific month
 * POST /api/budgets
 */
router.post('/budgets', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = createBudgetSchema.parse(req.body);

    // Check if budget already exists for this month with this name
    const existing = await prisma.budget.findUnique({
      where: {
        userId_month_name: {
          userId: req.user!.id,
          month: new Date(data.month),
          name: data.name || "Main Budget",
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        error: `Budget "${data.name || "Main Budget"}" already exists for this month. Use PUT to update or choose a different name.`,
      });
    }

    // Create budget with items
    const budget = await prisma.budget.create({
      data: {
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        name: data.name || "Main Budget",
        monthlyIncome: data.monthlyIncome,
        incomeCurrency: data.incomeCurrency,
        month: new Date(data.month),
        items: data.items
          ? {
              create: data.items.map((item) => ({
                category: item.category,
                amount: item.amount,
                currency: item.currency,
                notes: item.notes,
              })),
            }
          : undefined,
      },
      include: {
        items: true,
      },
    });

    res.status(201).json({ data: { budget } });
  } catch (error) {
    console.error('Create budget error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create budget' });
  }
});

/**
 * Get all budgets for the current user
 * GET /api/budgets
 */
router.get('/budgets', authenticate, async (req: AuthRequest, res) => {
  try {
    const budgets = await prisma.budget.findMany({
      where: {
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      },
      include: {
        items: true,
      },
      orderBy: {
        month: 'desc',
      },
    });

    res.json({ data: { budgets } });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

/**
 * Get budget for current month
 * GET /api/budgets/current?name=Main Budget (optional name filter)
 */
router.get('/budgets/current', authenticate, async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const budgetName = (req.query.name as string) || undefined;

    // If name is specified, get that specific budget
    if (budgetName) {
      const budget = await prisma.budget.findUnique({
        where: {
          userId_month_name: {
            userId: req.user!.id,
            month: currentMonth,
            name: budgetName,
          },
        },
        include: {
          items: true,
        },
      });

      if (!budget) {
        return res.status(404).json({ error: `Budget "${budgetName}" not found for current month` });
      }

      return res.json({ data: { budget } });
    }

    // Otherwise, get all budgets for current month
    const budgets = await prisma.budget.findMany({
      where: {
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
        month: currentMonth,
      },
      include: {
        items: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    if (budgets.length === 0) {
      return res.status(404).json({ error: 'No budgets found for current month' });
    }

    // Return the first budget (usually "Main Budget") or all budgets
    res.json({ data: { budget: budgets[0], budgets } });
  } catch (error) {
    console.error('Get current budget error:', error);
    res.status(500).json({ error: 'Failed to fetch current budget' });
  }
});

/**
 * Get a specific budget by ID
 * GET /api/budgets/:id
 */
router.get('/budgets/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const budget = await prisma.budget.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      },
      include: {
        items: true,
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({ data: { budget } });
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
});

/**
 * Update a budget
 * PUT /api/budgets/:id
 */
router.put('/budgets/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = updateBudgetSchema.parse(req.body);

    const budget = await prisma.budget.updateMany({
      where: {
        id: req.params.id,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      },
      data: {
        name: data.name,
        monthlyIncome: data.monthlyIncome,
        incomeCurrency: data.incomeCurrency,
      },
    });

    if (budget.count === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Fetch updated budget
    const updated = await prisma.budget.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });

    res.json({ data: { budget: updated } });
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update budget' });
  }
});

/**
 * Delete a budget
 * DELETE /api/budgets/:id
 */
router.delete('/budgets/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await prisma.budget.deleteMany({
      where: {
        id: req.params.id,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

// ===== Budget Item Routes =====

/**
 * Add an item to a budget
 * POST /api/budgets/:id/items
 */
router.post('/budgets/:id/items', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = budgetItemSchema.parse(req.body);

    // Verify budget ownership
    const budget = await prisma.budget.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const item = await prisma.budgetItem.create({
      data: {
        budgetId: req.params.id,
        category: data.category,
        amount: data.amount,
        currency: data.currency,
        notes: data.notes,
      },
    });

    res.status(201).json({ data: { item } });
  } catch (error) {
    console.error('Add budget item error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to add budget item' });
  }
});

/**
 * Update a budget item
 * PUT /api/budgets/:id/items/:itemId
 */
router.put('/budgets/:id/items/:itemId', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = budgetItemSchema.partial().parse(req.body);

    // Verify budget ownership
    const budget = await prisma.budget.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const item = await prisma.budgetItem.updateMany({
      where: {
        id: req.params.itemId,
        budgetId: req.params.id,
      },
      data: {
        category: data.category,
        amount: data.amount,
        currency: data.currency,
        notes: data.notes,
      },
    });

    if (item.count === 0) {
      return res.status(404).json({ error: 'Budget item not found' });
    }

    const updated = await prisma.budgetItem.findUnique({
      where: { id: req.params.itemId },
    });

    res.json({ data: { item: updated } });
  } catch (error) {
    console.error('Update budget item error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update budget item' });
  }
});

/**
 * Delete a budget item
 * DELETE /api/budgets/:id/items/:itemId
 */
router.delete('/budgets/:id/items/:itemId', authenticate, async (req: AuthRequest, res) => {
  try {
    // Verify budget ownership
    const budget = await prisma.budget.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const result = await prisma.budgetItem.deleteMany({
      where: {
        id: req.params.itemId,
        budgetId: req.params.id,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Budget item not found' });
    }

    res.json({ message: 'Budget item deleted successfully' });
  } catch (error) {
    console.error('Delete budget item error:', error);
    res.status(500).json({ error: 'Failed to delete budget item' });
  }
});

// ===== Budget Summary with Currency Conversion =====

/**
 * Get budget summary with multi-currency conversion
 * GET /api/budgets/:id/summary
 *
 * Returns budget items with both native amounts and converted amounts
 * in the user's preferred currency
 */
router.get('/budgets/:id/summary', authenticate, async (req: AuthRequest, res) => {
  try {
    // Fetch budget with items
    const budget = await prisma.budget.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
        organizationId: req.user!.organizationId,
      },
      include: {
        items: true,
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Get user's preferred currency
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { preferredCurrency: true },
    });

    const preferredCurrency = user?.preferredCurrency || 'AUD';

    // Convert each budget item to preferred currency
    const itemsWithConversion = await Promise.all(
      budget.items.map(async (item) => {
        const details = await exchangeRateService.getConversionDetails(
          Number(item.amount),
          item.currency,
          preferredCurrency
        );

        return {
          ...item,
          amount: Number(item.amount),
          nativeAmount: Number(item.amount),
          nativeCurrency: item.currency,
          convertedAmount: details.convertedAmount,
          convertedCurrency: preferredCurrency,
          exchangeRate: details.exchangeRate,
        };
      })
    );

    // Calculate totals by native currency
    const totalNative: Record<string, number> = {};
    for (const item of budget.items) {
      const currency = item.currency;
      if (!totalNative[currency]) {
        totalNative[currency] = 0;
      }
      totalNative[currency] += Number(item.amount);
    }

    // Calculate total converted amount
    const totalConverted = itemsWithConversion.reduce((sum, item) => sum + item.convertedAmount, 0);

    // Convert monthly income to preferred currency
    const incomeDetails = await exchangeRateService.getConversionDetails(
      Number(budget.monthlyIncome),
      budget.incomeCurrency,
      preferredCurrency
    );

    res.json({
      data: {
        budget: {
          ...budget,
          monthlyIncome: Number(budget.monthlyIncome),
          monthlyIncomeConverted: incomeDetails.convertedAmount,
        },
        items: itemsWithConversion,
        totalNative,
        totalConverted,
        totalCurrency: preferredCurrency,
        remaining: incomeDetails.convertedAmount - totalConverted,
      },
    });
  } catch (error) {
    console.error('Get budget summary error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch budget summary' });
  }
});

export default router;
