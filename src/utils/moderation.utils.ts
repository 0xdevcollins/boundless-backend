// Enhanced spam detection with multiple layers
export const checkSpam = async (content: string): Promise<boolean> => {
  // Basic spam patterns
  const spamPatterns = [
    /\b(buy|sell|discount|offer|price|deal|order|purchase)\b/gi,
    /\b(viagra|cialis|pharmacy|medication)\b/gi,
    /\b(casino|gambling|betting|lottery)\b/gi,
    /\b(free|win|winner|prize|reward)\b/gi,
    /\b(click here|visit now|sign up now)\b/gi,
    /\b(make money|earn money|get rich)\b/gi,
    /\b(guaranteed|100%|no risk)\b/gi,
    /https?:\/\/[^\s]+/g, // URLs
  ];

  // Count matches for each pattern
  const matches = spamPatterns.reduce((count, pattern) => {
    const matches = content.match(pattern) || [];
    return count + matches.length;
  }, 0);

  // Check for excessive capitalization
  const capsRatio =
    content.replace(/[^A-Z]/g, "").length / content.replace(/\s/g, "").length;

  // Check for repeated characters
  const repeatedChars = /(.)\1{4,}/g.test(content);

  // Check for excessive punctuation
  const punctuationRatio =
    content.replace(/[^!?.]/g, "").length / content.length;

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\$\d+/g, // Money amounts
    /% \d+/g, // Percentages
    /\b(urgent|limited time|act now)\b/gi,
    /\b(call now|text now|email now)\b/gi,
  ];

  const suspiciousMatches = suspiciousPatterns.reduce((count, pattern) => {
    const matches = content.match(pattern) || [];
    return count + matches.length;
  }, 0);

  // Check for excessive emojis
  const emojiCount = (
    content.match(
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu,
    ) || []
  ).length;
  const emojiRatio = emojiCount / content.length;

  // Calculate spam score
  let spamScore = 0;

  if (matches >= 3) spamScore += 3;
  if (capsRatio > 0.5) spamScore += 2;
  if (repeatedChars) spamScore += 2;
  if (punctuationRatio > 0.1) spamScore += 1;
  if (suspiciousMatches >= 2) spamScore += 2;
  if (emojiRatio > 0.1) spamScore += 1;
  if (content.length > 1000) spamScore += 1;

  // Consider content spam if score is 4 or higher
  return spamScore >= 4;
};

// Filter sensitive content
export const filterSensitiveContent = (content: string): string => {
  const sensitiveWords = [
    "profanity1",
    "profanity2",
    // Add more sensitive words as needed
  ];

  let filteredContent = content;
  sensitiveWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    filteredContent = filteredContent.replace(regex, "*".repeat(word.length));
  });

  return filteredContent;
};

// Check content toxicity level (placeholder for more sophisticated implementation)
export const checkToxicity = async (content: string): Promise<number> => {
  // In a real application, you might want to use a service like
  // Google's Perspective API or TensorFlow.js for toxicity detection
  const toxicityScore = Math.random(); // Placeholder implementation
  return toxicityScore;
};
