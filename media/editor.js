// @ts-check
// The extension sends a value only while it is shown: hidden values never reach this page.
// @ts-ignore: provided by VS Code inside webviews
const vscode = acquireVsCodeApi();
const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const rows = $('rows'), empty = $('empty'), error = $('error');
const newKey = /** @type {HTMLInputElement} */ ($('new-key'));
const newValue = /** @type {HTMLInputElement} */ ($('new-value'));
/** @type {{ key: string, shown: boolean, value?: string }[]} */
let entries = [];
let editing = -1; // index of the row being edited

const post = (/** @type {object} */ message) => vscode.postMessage(message);

function button(/** @type {string} */ label, /** @type {string} */ className, /** @type {() => void} */ onClick, key = '') {
	const b = document.createElement('button');
	b.type = 'button';
	b.className = className;
	b.textContent = label;
	if (key) b.setAttribute('aria-label', `${label} ${key}`);
	b.addEventListener('click', onClick);
	return b;
}

function stopEditing() {
	editing = -1;
	render();
}

function render() {
	rows.replaceChildren(...entries.map((entry, index) => {
		const row = document.createElement('div');
		row.className = 'row';
		const key = document.createElement('span');
		key.className = 'key';
		key.textContent = entry.key;
		const actions = document.createElement('span');
		actions.className = 'actions';
		let value;
		if (index === editing && entry.shown) {
			const multiline = (entry.value ?? '').includes('\n');
			const input = /** @type {HTMLInputElement | HTMLTextAreaElement} */ (document.createElement(multiline ? 'textarea' : 'input'));
			input.value = entry.value ?? '';
			input.spellcheck = false;
			input.setAttribute('aria-label', `Value of ${entry.key}`);
			const save = () => {
				editing = -1;
				post({ type: 'set', index, key: entry.key, value: input.value });
			};
			input.addEventListener('keydown', e => {
				const ke = /** @type {KeyboardEvent} */ (e);
				if (ke.key === 'Escape') stopEditing();
				else if (ke.key === 'Enter' && (!multiline || ke.ctrlKey)) {
					ke.preventDefault();
					save();
				}
			});
			actions.append(button('Save', 'primary', save), button('Cancel', 'link', stopEditing));
			value = input;
			requestAnimationFrame(() => input.focus());
		} else {
			value = document.createElement('span');
			value.className = entry.shown && entry.value ? 'value' : 'value masked';
			value.textContent = !entry.shown ? '••••••••' : entry.value || '(empty)';
			actions.append(
				button(entry.shown ? 'Hide' : 'Show', 'link', () => post({ type: 'toggle', key: entry.key }), entry.key),
				button('Edit', 'link', () => {
					editing = index;
					// A hidden value is fetched first; the reply re-renders this row as an input.
					if (entry.shown) render();
					else post({ type: 'toggle', key: entry.key });
				}, entry.key),
				button('Delete', 'link danger', () => post({ type: 'delete', index, key: entry.key }), entry.key),
			);
		}
		row.append(key, value, actions);
		return row;
	}));
	empty.hidden = entries.length > 0;
}

window.addEventListener('message', ({ data }) => {
	if (data.type === 'entries') {
		entries = data.entries;
		if (editing >= entries.length) editing = -1;
		render();
	} else if (data.type === 'error') {
		error.textContent = data.message;
	}
});

$('add').addEventListener('submit', e => {
	e.preventDefault();
	const key = newKey.value.trim();
	error.textContent = !/^[\w.-]+$/.test(key) ? 'Keys can only use letters, digits, _ . and -'
		: entries.some(x => x.key === key) ? `${key} already exists` : '';
	if (error.textContent) return;
	post({ type: 'add', key, value: newValue.value });
	newKey.value = newValue.value = '';
	newKey.focus();
});
$('show-all').addEventListener('click', () => post({ type: 'showAll' }));
$('hide-all').addEventListener('click', () => post({ type: 'hideAll' }));
post({ type: 'ready' });
