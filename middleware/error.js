const errorHandler = (err, req, res, next) => {
  console.error("🔥 ERROR:", err);

  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    success: false,
    code: statusCode,
    message: err.message || "Server Error",
    errors: err.errors || null,
    timestamp: new Date(),
  });
};

module.exports = errorHandler;
