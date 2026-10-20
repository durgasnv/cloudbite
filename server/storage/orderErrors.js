function conflict(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}
function verifyReplay(existing, proposed) {
  if (existing.requestHash !== proposed.requestHash) {
    throw conflict('Checkout key already used for different order details.');
  }
  return existing;
}
module.exports = { conflict, verifyReplay };
