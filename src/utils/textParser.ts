// src/utils/textParser.ts
export function cleanMistralOutput(rawText: string): string {
    let safeText = rawText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // Превращаем ** в mark
    safeText = safeText.replace(/\*\*([\s\S]*?)\*\*/g, '<mark>$1</mark>');
    // Уничтожаем одиночные звездочки
    safeText = safeText.replace(/\*/g, '');
    return safeText;
}