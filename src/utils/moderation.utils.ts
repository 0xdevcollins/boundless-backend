// Simple spam detection based on common patterns
export const checkSpam = async (content: string): Promise<boolean> => {
  const spamPatterns = [
    /\b(buy|sell|discount|offer|price|deal|order|purchase)\b/gi,
    /\b(viagra|cialis|pharmacy|medication)\b/gi,
    /\b(casino|gambling|betting|lottery)\b/gi,
    /\b(free|win|winner|prize|reward)\b/gi,
    /\b(click here|visit now|sign up now)\b/gi,
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

  // Determine if content is likely spam based on multiple factors
  return (
    matches >= 3 || // Multiple spam pattern matches
    capsRatio > 0.5 || // More than 50% caps
    repeatedChars || // Repeated characters
    content.length > 1000 // Very long content
  );
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
