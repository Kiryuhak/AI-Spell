// src/utils/textParser.test.ts
import { cleanMistralOutput } from './textParser';

describe('Парсер ответов нейросети', () => {
    test('должен превращать двойные звездочки в тег mark', () => {
        const input = "Привет, **мир**!";
        const expected = "Привет, <mark>мир</mark>!";
        expect(cleanMistralOutput(input)).toBe(expected);
    });

    test('должен удалять случайный курсив (одиночные звездочки)', () => {
        const input = "Это *случайный* курсив и **исправленное** слово";
        const expected = "Это случайный курсив и <mark>исправленное</mark> слово";
        expect(cleanMistralOutput(input)).toBe(expected);
    });

    test('должен экранировать опасные HTML теги', () => {
        const input = "<script>alert(1)</script> **текст**";
        const expected = "&lt;script&gt;alert(1)&lt;/script&gt; <mark>текст</mark>";
        expect(cleanMistralOutput(input)).toBe(expected);
    });
});