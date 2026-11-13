"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findVariables = exports.findValues = void 0;
exports.decode = decode;
exports.encode = encode;
// dotenv's line grammar (dotenv 18 `parse`) with named groups and the `d` flag for offsets. One change: an unquoted
// value only ends at a `#` preceded by whitespace, so `PASS=ab#cd` hides all of `ab#cd` (over-hiding beats leaking).
const LINE = /(?:^|^)\s*(?:export\s+)?(?<key>[\w.-]+)(?<sep>\s*=\s*?|:\s+?)(?<value>\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|(?:(?!\s+#)[^\r\n])+)?\s*(?:#.*)?(?:$|$)/dgm;
// Commented-out variables (`# KEY=value`) often hold real secrets too: hide the rest of their line.
const COMMENTED = /^[ \t]*#+[ \t]*(?:export[ \t]+)?(?<key>[\w.-]+)[ \t]*(?<sep>=)(?<value>.*)$/dgm;
// VS Code's dotenv grammar colors everything after the first `=` of a non-comment line as a value, and
// package.json makes those tokens transparent. Cover the same lines (e.g. `MY KEY=value`) so each one can be revealed.
const GRAMMAR = /^[ \t]?(?!#)(?<key>.*?)[ \t]?(?<sep>=)(?<value>.*)$/dgm;
function entries(text) {
    const found = [];
    for (const [re, commented] of [[LINE, false], [COMMENTED, true], [GRAMMAR, false]]) {
        for (const m of text.matchAll(re)) {
            const raw = m.groups.value ?? '';
            const at = m.indices.groups;
            const [s, e] = at.value ?? [at.sep[1], at.sep[1]];
            const start = s + raw.length - raw.trimStart().length;
            const end = Math.max(start, e - raw.length + raw.trimEnd().length);
            const lineEnd = m.index + m[0].length;
            // Skip what an earlier match already covers: inside its value (multiline quotes) or on the same line.
            if (found.some(v => start === v.start || (start > v.start && start < v.end) || (v.start >= m.index && v.start <= lineEnd)))
                continue;
            found.push({ key: m.groups.key.replace(/^\s*export\s+/, '').trim(), start, end, commented });
        }
    }
    return found.sort((a, b) => a.start - b.start);
}
/** Every non-empty value to mask, commented-out variables included. */
const findValues = (text) => entries(text).filter(v => v.end > v.start);
exports.findValues = findValues;
/** Every active variable in file order, empty ones included: the rows of the custom view. */
const findVariables = (text) => entries(text).filter(v => !v.commented);
exports.findVariables = findVariables;
/** A raw value as dotenv reads it: surrounding quotes removed, `\n` and `\r` expanded inside double quotes. */
function decode(raw) {
    const v = raw.trim();
    const inner = v.replace(/^(['"`])([\s\S]*)\1$/, '$2');
    return v[0] === '"' ? inner.replace(/\\n/g, '\n').replace(/\\r/g, '\r') : inner;
}
/** A value written so dotenv reads it back unchanged. */
function encode(value) {
    if (/^[^\s'"`#\\]*$/.test(value))
        return value;
    if (!/['\r\n]/.test(value))
        return `'${value}'`;
    if (!value.includes('`'))
        return `\`${value}\``;
    // ponytail: last resort for a value with ', ` and a newline; a `"` inside comes back as `\"`.
    return `"${value.replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`;
}
//# sourceMappingURL=parse.js.map