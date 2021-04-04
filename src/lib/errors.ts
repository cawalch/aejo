export class AejoError extends Error {
  constructor(message: string) {
    super(message)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AejoError)
    }
    this.name = "AejoError"
  }
}

export class ValidationError extends AejoError {
  constructor(message: string, public context: unknown) {
    super(message)
    this.name = "ValidationError"
    this.context = context
  }
}
