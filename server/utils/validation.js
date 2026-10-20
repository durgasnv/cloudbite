function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function positiveInteger(value) {
  if (typeof value !== 'number' &&
      !(typeof value === 'string' && /^\d+$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function nonnegativeNumber(value) {
  if (typeof value !== 'number' &&
      !(typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function validateQuery(query, names) {
  for (const name of names) {
    if (query[name] !== undefined && typeof query[name] !== 'string') {
      throw badRequest(`Invalid ${name}. Supply a single text value.`);
    }
  }
}

module.exports = { badRequest, isRecord, positiveInteger, nonnegativeNumber, validateQuery };
