import { readBody, route } from '@/backend/common/route';
import { deleteExpense, updateExpense } from '@/backend/expense/expenseService';

type Params = { tripId: string; expenseId: string };

// Expense.updateExpense / deleteExpense
export const PATCH = route<Params>(async (req, { tripId, expenseId }) => updateExpense(tripId, expenseId, await readBody(req)));
export const DELETE = route<Params>(async (_req, { tripId, expenseId }) => deleteExpense(tripId, expenseId));
