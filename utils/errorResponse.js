class ErrorResponse extends Error {
  constructor(message, statusCode, success = false, errors = null) {
    super(message);
    this.statusCode = statusCode;   // ✅ must be statusCode
    this.success = success;
    this.errors = errors;
  }
}

module.exports = ErrorResponse;
