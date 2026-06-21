export class Result<T, E = Error> {
  private constructor(
    private readonly value: T | null,
    private readonly error: E | null,
    private readonly isSuccess: boolean,
  ) {}

  static success<T>(value: T): Result<T, never> {
    return new Result<T, never>(value, null, true);
  }

  static failure<E>(error: E): Result<never, E> {
    return new Result<never, E>(null, error, false);
  }

  ok(): boolean {
    return this.isSuccess;
  }

  unwrap(): T {
    if (!this.isSuccess || this.value === null) {
      throw new Error("Called unwrap() on a failure Result");
    }
    return this.value;
  }

  unwrapError(): E {
    if (this.isSuccess || this.error === null) {
      throw new Error("Called unwrapError() on a success Result");
    }
    return this.error;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isSuccess && this.value !== null) {
      return Result.success(fn(this.value));
    }
    return Result.failure(this.error as E);
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this.isSuccess && this.value !== null) {
      return fn(this.value);
    }
    return Result.failure(this.error as E);
  }

  fold<R>(onSuccess: (value: T) => R, onFailure: (error: E) => R): R {
    if (this.isSuccess && this.value !== null) {
      return onSuccess(this.value);
    }
    return onFailure(this.error as E);
  }

  static combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const result of results) {
      if (!result.ok()) {
        return Result.failure(result.unwrapError());
      }
      values.push(result.unwrap());
    }
    return Result.success(values);
  }
}
