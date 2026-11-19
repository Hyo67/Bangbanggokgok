import { readBody, route } from '@/backend/common/route';
import { reorderExpenses } from '@/backend/expense/expenseService';

export const PUT = route<{ tripId: string }>(async (req, { tripId }) => reorderExpenses(tripId, await readBody(req)));
