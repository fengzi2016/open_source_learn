
export function getInlineCode(match) {
    const start = match.indexOf('>') + 1;
    const end = match.lastIndexOf('<');
    return match.substring(start, end);
}

// Detect whether browser supports `<script type=module>` or not
export function isModuleScriptSupported() {
    const s = document.createElement('script');
    return 'noModule' in s;
}