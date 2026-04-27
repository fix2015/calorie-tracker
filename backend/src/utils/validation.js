const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  age: z.number().int().min(10).max(120).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  heightCm: z.number().min(50).max(300).optional(),
  weightKg: z.number().min(20).max(500).optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
  goal: z.enum(['lose', 'maintain', 'gain']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  age: z.number().int().min(10).max(120).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  heightCm: z.number().min(50).max(300).optional(),
  weightKg: z.number().min(20).max(500).optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
  goal: z.enum(['lose', 'maintain', 'gain']).optional(),
});

const manualMealSchema = z.object({
  name: z.string().min(1).max(200),
  calories: z.number().int().min(0).max(10000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(1000),
  consumedAt: z.string().datetime().optional(),
});

module.exports = { registerSchema, loginSchema, updateProfileSchema, manualMealSchema };
