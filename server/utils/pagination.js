const toInt = (value) => Number.parseInt(value, 10);

// Non-numeric input such as ?page=abc falls back to defaults instead of producing NaN.
const parsePagination = (query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const rawPage = toInt(query.page);
  const rawLimit = toInt(query.limit);
  const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(maxLimit, Math.max(1, rawLimit))
    : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
};

module.exports = { parsePagination };
