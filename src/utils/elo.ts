/**
 * Calculate new ELO ratings after a game
 * K-factor: determines how much ratings change per game (32 is standard)
 */
export function calculateEloRating(
  winnerRating: number,
  loserRating: number,
  isDraw: boolean = false,
  kFactor: number = 32
): { newWinnerRating: number; newLoserRating: number } {
  // Expected scores
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

  let actualWinner: number;
  let actualLoser: number;

  if (isDraw) {
    actualWinner = 0.5;
    actualLoser = 0.5;
  } else {
    actualWinner = 1;
    actualLoser = 0;
  }

  // New ratings
  const newWinnerRating = Math.round(winnerRating + kFactor * (actualWinner - expectedWinner));
  const newLoserRating = Math.round(loserRating + kFactor * (actualLoser - expectedLoser));

  return {
    newWinnerRating,
    newLoserRating,
  };
}

/**
 * Get rating range for matchmaking
 */
export function getRatingRange(rating: number, range: number = 200): { min: number; max: number } {
  return {
    min: rating - range,
    max: rating + range,
  };
}
