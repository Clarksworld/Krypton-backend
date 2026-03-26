import { ZodSchema } from "zod";
import { ApiError } from "./errors";

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join(", ");
    throw new ApiError(message, 422);
  }
  return result.data;
}
