import { test } from 'node:test';
import assert from 'node:assert';
import { findValues } from '../out/parse.js';

test('findValues hides what dotenv reads as a value, plus commented-out variables', () => {
	const lines = [
		'# Just a comment',
		'#OLD_TOKEN=commented-secret',
		'export TOKEN=abc123 # trailing comment',
		'EMPTY=',
		'PASS=ab#cd',
		'HASH=#abc',
		"SINGLE='a b'",
		'TICK=`x y`',
		'COLON: value',
		'MULTI="line1',
		'# NOT_A_VAR=inside a value',
		'line2"',
		'URL = https://x.y/z?a=1  ',
	];
	for (const eol of ['\n', '\r\n']) {
		const text = lines.join(eol);
		const found = findValues(text).map(v => [v.key, text.slice(v.start, v.end)]);
		assert.deepStrictEqual(found, [
			['OLD_TOKEN', 'commented-secret'],
			['TOKEN', 'abc123'],
			['PASS', 'ab#cd'],
			['HASH', '#abc'],
			['SINGLE', "'a b'"],
			['TICK', '`x y`'],
			['COLON', 'value'],
			['MULTI', ['"line1', '# NOT_A_VAR=inside a value', 'line2"'].join(eol)],
			['URL', 'https://x.y/z?a=1'],
		]);
	}
});
