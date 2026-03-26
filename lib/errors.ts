import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(error: unknown) {
  if (error instanceof ApiError) {
    return err(error.message, error.statusCode);
  }
  console.error(error);
  return err("Internal server error", 500);
}
