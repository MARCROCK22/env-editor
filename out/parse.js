"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findValues = findValues;
// dotenv's line grammar (dotenv 18 `parse`) plus the `d` flag for offsets. One change: an unquoted
// value only ends at a `#` preceded by whitespace, so `PASS=ab#cd` hides all of `ab#cd` (over-hiding beats leaking).
const LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|(?:(?!\s+#)[^\r\n])+)?\s*(?:#.*)?(?:$|$)/dgm;
// Commented-out variables (`# KEY=value`) often hold real secrets too: hide the rest of their line.
const COMMENTED = /^[ \t]*#+[ \t]*(?:export[ \t]+)?([\w.-]+)[ \t]*=(.*)$/dgm;
// VS Code's dotenv grammar colors everything after the first `=` of a non-comment line as a value, and
// package.json makes those tokens transparent. Cover the same lines (e.g. `MY KEY=value`) so each one can be revealed.
const GRAMMAR = /^[ \t]?(?!#)(.*?)[ \t]?=(.*)$/dgm;
/** Every non-empty value of a .env text: its key and [start, end) offsets, quotes included. */
function findValues(text) {
    const values = [];
    for (const m of [...text.matchAll(LINE), ...text.matchAll(COMMENTED), ...text.matchAll(GRAMMAR)]) {
        const raw = m[2];
        if (!raw?.trim())
            continue;
        const [s, e] = m.indices[2];
        const start = s + raw.length - raw.trimStart().length;
        // Already hidden as part of an earlier match (a multiline quoted value, or the same line).
        if (values.some(v => start >= v.start && start < v.end))
            continue;
        values.push({ key: m[1].replace(/^\s*export\s+/, '').trim(), start, end: e - raw.length + raw.trimEnd().length });
    }
    return values.sort((a, b) => a.start - b.start);
}
//# sourceMappingURL=parse.js.map