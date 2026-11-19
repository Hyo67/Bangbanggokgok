import { route } from '@/backend/common/route';
import { deleteCategory } from '@/backend/trip/categoryService';

// TripCategory.deleteCategory
export const DELETE = route<{ tripId: string; categoryId: string }>(async (_req, { tripId, categoryId }) => deleteCategory(tripId, categoryId));
