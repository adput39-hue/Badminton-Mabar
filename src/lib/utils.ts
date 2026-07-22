export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (word) => {
    if (word.length <= 1) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}
