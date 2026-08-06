function getReadingBand(correct) {
  if (correct >= 39) return 9.0
  if (correct >= 37) return 8.5
  if (correct >= 35) return 8.0
  if (correct >= 33) return 7.5
  if (correct >= 30) return 7.0
  if (correct >= 27) return 6.5
  if (correct >= 23) return 6.0
  if (correct >= 19) return 5.5
  if (correct >= 15) return 5.0
  if (correct >= 13) return 4.5
  if (correct >= 10) return 4.0
  if (correct >= 8)  return 3.5
  if (correct >= 6)  return 3.0
  if (correct >= 4)  return 2.5
  return 0
}

function getListeningBand(correct) {
  if (correct >= 39) return 9.0
  if (correct >= 37) return 8.5
  if (correct >= 35) return 8.0
  if (correct >= 32) return 7.5
  if (correct >= 30) return 7.0
  if (correct >= 26) return 6.5
  if (correct >= 23) return 6.0
  if (correct >= 18) return 5.5
  if (correct >= 16) return 5.0
  if (correct >= 13) return 4.5
  if (correct >= 10) return 4.0
  if (correct >= 8)  return 3.5
  if (correct >= 6)  return 3.0
  if (correct >= 4)  return 2.5
  return 0
}

function ieltsOverall(scores) {
  if (!scores || !scores.length) return 0
  const validScores = scores.filter(s => typeof s === 'number' && !isNaN(s))
  if (!validScores.length) return 0

  const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length
  const floored = Math.floor(avg)
  const frac = Math.round((avg - floored) * 100) / 100

  let band = floored
  if (frac >= 0.75) band = floored + 1
  else if (frac >= 0.25) band = floored + 0.5

  return Math.min(9, Math.max(0, band))
}

module.exports = {
  getReadingBand,
  getListeningBand,
  ieltsOverall,
}
