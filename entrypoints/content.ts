import '../src/content';

export default defineContentScript({
    matches: ['http://*/*', 'https://*/*'],
    allFrames: true,
    matchAboutBlank: true,
    main() {
        // Логика content script регистрируется в src/content.ts.
    },
});
