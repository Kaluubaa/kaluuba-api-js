/**
 * Standardized API Response utility class
 * Ensures consistent response format across the application
 */
class ApiResponse {
  static success(res, data = null, statusCode = 200) {
    return res.status(statusCode).json({
      status: true,
      message: data?.message || 'Operation successful',
      data: data?.data || data,
      timestamp: new Date().toISOString()
    });
  }

  static error(res, message = 'Operation failed', statusCode = 400, details = null) {
    const response = {
      status: false,
      message,
      timestamp: new Date().toISOString()
    };

    if (details) {
      response.details = details;
    }

    return res.status(statusCode).json(response);
  }

  static validationError(res, errors = []) {
    const formattedErrors = errors.reduce((acc, error) => {
      acc[error.field] = error.message;
      return acc;
    }, {});

    return res.status(422).json({
      status: false,
      message: 'Validation failed',
      errors: formattedErrors,
      timestamp: new Date().toISOString()
    });
  }

  static badRequest(res, message = 'Bad request') {
    return this.error(res, message, 400);
  }

  static unauthorized(res, message = 'Unauthorized access') {
    return this.error(res, message, 401);
  }

  static forbidden(res, message = 'Access forbidden') {
    return this.error(res, message, 403);
  }

  static notFound(res, message = 'Resource not found') {
    return this.error(res, message, 404);
  }

  static conflict(res, message = 'Resource conflict', details = null) {
    return this.error(res, message, 409, details);
  }

  static serverError(res, message = 'Internal server error') {
    return this.error(res, message, 500);
  }

  static created(res, data = null) {
    return this.success(res, data, 201);
  }

  static noContent(res) {
    return res.status(204).send();
  }
}

export { ApiResponse };