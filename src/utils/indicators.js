export function getRainbowLabel(position) {
  const labels = [
    "Maximum Bubble",
    "Sell. Seriously, SELL!",
    "FOMO Intensifies",
    "Is This a Bubble?",
    "Still Cheap",
    "Accumulate",
    "Buy",
    "Basically a Fire Sale",
  ];
  return labels[position - 1];
}

export function getFearGreedStatus(value) {
  if (value >= 75) {
    return { text: "Extreme Greed", className: "danger" };
  } else if (value <= 25) {
    return { text: "Extreme Fear", className: "warning" };
  }
  return { text: "Neutral", className: "neutral" };
}

export function getMVRVStatus(value) {
  if (value > 7) {
    return { text: "Market Top Warning", className: "danger" };
  } else if (value < -1) {
    return { text: "Market Bottom Area", className: "warning" };
  }
  return { text: "Neutral", className: "neutral" };
}

export function getPiCycleStatus(value) {
  if (value < 1) {
    return { text: "Cross Imminent", className: "danger" };
  }
  return { text: "No Signal", className: "neutral" };
}

export function getRainbowStatus(position) {
  if (position <= 2) {
    return { text: "Bubble Territory", className: "danger" };
  } else if (position >= 7) {
    return { text: "Accumulation Zone", className: "warning" };
  }
  return { text: "Neutral", className: "neutral" };
}
