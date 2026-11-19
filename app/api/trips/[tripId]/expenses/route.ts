import { readBody, route } from '@/backend/common/route';
import { createExpense } from '@/backend/expense/expenseService';

// Expense.createExpense (Trip.addExpense)
export const POST = route<{ tripId: string }>(async (req, { tripId }) => createExpense(tripId, await readBody(req)));
