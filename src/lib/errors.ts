import { planLimitMessage } from './plan-limits'

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof Error && error.message.trim()) {
    return planLimitMessage(error.message) ?? error.message
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string' &&
    (error as { message: string }).message.trim()
  ) {
    const { message } = error as { message: string }
    return planLimitMessage(message) ?? message
  }

  return fallback
}
