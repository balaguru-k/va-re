const sendResponse = (res, statusCode, message, data = null, error = null) => {
  const response = { message };
  if (data) response.data = data;
  if (error) response.error = error;
  return res.status(statusCode).json(response);
};

const sendSuccess = (res, message, data = null) => sendResponse(res, 200, message, data);
const sendCreated = (res, message, data = null) => sendResponse(res, 201, message, data);
const sendError = (res, statusCode, message, error = null) => sendResponse(res, statusCode, message, null, error);

module.exports = { sendResponse, sendSuccess, sendCreated, sendError };