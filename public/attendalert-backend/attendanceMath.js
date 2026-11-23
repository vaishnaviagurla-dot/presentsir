function calculateStats(attended, total) {
  if (!total || total <= 0) {
    return {
      attended: 0,
      total: 0,
      percentage: 100,
      riskTier: "Safe",
      classesNeeded: 0
    };
  }

  const percentage = Number(((attended / total) * 100).toFixed(2));

  let riskTier = "Critical";
  if (percentage >= 75) {
    riskTier = "Safe";
  } else if (percentage >= 65) {
    riskTier = "Warning";
  }

  // Required consecutive classes: ceil((0.75 * total - attended) / 0.25)
  const classesNeeded =
    percentage >= 75
      ? 0
      : Math.max(0, Math.ceil((0.75 * total - attended) / 0.25));

  return {
    attended,
    total,
    percentage,
    riskTier,
    classesNeeded
  };
}

module.exports = { calculateStats };