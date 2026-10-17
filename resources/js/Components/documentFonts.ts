let ready: Promise<unknown> | undefined;

export function documentFontsReady(): Promise<unknown> {
    return ready ??= Promise.all(['normal 400', 'normal 700', 'italic 400', 'italic 700']
        .map(face => document.fonts.load(`${face} 11pt "Document Arial"`)))
        .then(() => document.fonts.ready);
}
