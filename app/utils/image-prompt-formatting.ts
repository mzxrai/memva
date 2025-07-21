/**
 * Formats a prompt with image paths for Claude Code
 */
export function formatPromptWithImages(prompt: string, imagePaths: string[]): string {
  if (imagePaths.length === 0) {
    return prompt;
  }

  const imageList = imagePaths.map(p => `- ${p}`).join('\n');
  
  if (prompt.trim()) {
    return `Please review the following images and then respond to my prompt:\n${imageList}\n\n${prompt.trim()}`;
  } else {
    return `Please review the following images:\n${imageList}`;
  }
}