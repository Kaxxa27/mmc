/** Shape of every error response. */
export class ApiErrorResponseDto {
  /** @example 404 */
  statusCode: number;

  /** @example "Not Found" */
  error: string;

  /**
   * Stable, machine-readable error code.
   * @example "GROUP_NOT_FOUND"
   */
  code: string;

  /** @example "Group not found." */
  message: string;

  /** Extra information, e.g. validation messages or `retryAfterSeconds`. */
  details?: object;
}
