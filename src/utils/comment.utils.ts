import User from "../models/user.model";
import mongoose from "mongoose";

// Validate comment content
export const validateContent = (content: string): string | null => {
  if (!content) {
    return "Content is required";
  }

  if (content.length < 1) {
    return "Content must not be empty";
  }

  if (content.length > 5000) {
    return "Content must not exceed 5000 characters";
  }

  return null;
};

// Extract mentions from content
export const extractMentions = async (
  content: string,
): Promise<mongoose.Types.ObjectId[]> => {
  const mentionRegex = /@(\w+)/g;
  const mentions = content.match(mentionRegex) || [];
  const usernames = mentions.map((mention) => mention.slice(1));

  if (usernames.length === 0) {
    return [];
  }

  const users = await User.find({
    username: { $in: usernames },
  }).select("_id");

  return users.map((user) => user._id);
};

// Parse markdown content
export const parseMarkdown = (content: string): string => {
  // This is a simple example. In a real application, you might want to use
  // a markdown library like marked or markdown-it with proper sanitization
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold
    .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italic
    .replace(/`(.*?)`/g, "<code>$1</code>") // Inline code
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>") // Code block
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>') // Links
    .replace(/\n/g, "<br>"); // Line breaks
};
