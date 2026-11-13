import * as vscode from 'vscode';
import { decode, encode, findValues, findVariables } from './parse';

// .env files by language (VS Code's built-in `dotenv`) or by name, in case another extension claims them.
const selector: vscode.DocumentSelector = [{ language: 'dotenv' }, { pattern: '**/{.env,*.env,.env.*}' }];
const isEnv = (doc?: vscode.TextDocument): doc is vscode.TextDocument => !!doc && vscode.languages.match(selector, doc) > 0;

// Revealed values per open file, shared by the custom view and the text editor: visible when `allShown` XOR toggled.
// ponytail: memory only, values are hidden again once the file has no open tab or VS Code reloads.
const state = new Map<string, { allShown: boolean; toggled: Set<string> }>();

function isShown(doc: vscode.TextDocument, key: string) {
	const s = state.get(doc.uri.toString());
	return !!s && s.allShown !== s.toggled.has(key);
}

export function activate(context: vscode.ExtensionContext) {
	// The hidden text keeps its width; a zero-width `before` paints one dot per character over it.
	const mask = vscode.window.createTextEditorDecorationType({ opacity: '0' });
	const dotColor = new vscode.ThemeColor('editor.foreground');
	// package.json makes dotenv value tokens transparent so nothing shows before this code runs: revealed values need a color back.
	const reveal = vscode.window.createTextEditorDecorationType({ color: dotColor });
	const lensesChanged = new vscode.EventEmitter<void>();
	const showAll = vscode.window.createStatusBarItem('envEditor.showAll', vscode.StatusBarAlignment.Right);
	const hideAll = vscode.window.createStatusBarItem('envEditor.hideAll', vscode.StatusBarAlignment.Right);
	showAll.name = '.env: Show all';
	showAll.text = '$(eye) Show all';
	showAll.command = 'envEditor.showAll';
	hideAll.name = '.env: Hide all';
	hideAll.text = '$(eye-closed) Hide all';
	hideAll.command = 'envEditor.hideAll';
	const views = new Set<{ doc: vscode.TextDocument; webview: vscode.Webview }>();

	function decorate(editor: vscode.TextEditor) {
		const doc = editor.document;
		const options: vscode.DecorationOptions[] = [];
		const shown: vscode.Range[] = [];
		for (const v of isEnv(doc) ? findValues(doc.getText()) : []) {
			const value = new vscode.Range(doc.positionAt(v.start), doc.positionAt(v.end));
			if (isShown(doc, v.key)) {
				shown.push(value);
				continue;
			}
			// One segment per line, so multiline values (private keys...) are dotted on every line.
			for (let line = value.start.line; line <= value.end.line; line++) {
				const range = doc.lineAt(line).range.intersection(value);
				if (range && !range.isEmpty) {
					const dots = '•'.repeat(range.end.character - range.start.character);
					options.push({ range, renderOptions: { before: { contentText: dots, width: '0', color: dotColor } } });
				}
			}
		}
		editor.setDecorations(mask, options);
		editor.setDecorations(reveal, shown);
	}

	// The custom view only gets a value while it is shown: hidden values never reach the webview.
	function postEntries(doc: vscode.TextDocument) {
		const text = doc.getText();
		const entries = findVariables(text).map(v => isShown(doc, v.key)
			? { key: v.key, shown: true, value: decode(text.slice(v.start, v.end)) }
			: { key: v.key, shown: false });
		for (const view of views) if (view.doc === doc) view.webview.postMessage({ type: 'entries', entries });
	}

	function refresh() {
		vscode.window.visibleTextEditors.forEach(decorate);
		const active = isEnv(vscode.window.activeTextEditor?.document);
		for (const item of [showAll, hideAll]) {
			if (active) item.show();
			else item.hide();
		}
	}

	// VS Code re-asks for CodeLens on open/edit by itself; only a reveal change needs new titles.
	function revealChanged() {
		refresh();
		lensesChanged.fire();
		new Set([...views].map(v => v.doc)).forEach(postEntries);
	}

	function toggle(uri: string, key: string) {
		const s = state.get(uri) ?? { allShown: false, toggled: new Set<string>() };
		if (!s.toggled.delete(key)) s.toggled.add(key);
		state.set(uri, s);
		revealChanged();
	}

	function setAll(doc: vscode.TextDocument | undefined, allShown: boolean) {
		if (isEnv(doc)) state.set(doc.uri.toString(), { allShown, toggled: new Set() });
		revealChanged();
	}

	// Changes from the custom view touch only the affected text and are saved right away (no Ctrl+S).
	async function edit(doc: vscode.TextDocument, change: (e: vscode.WorkspaceEdit) => void) {
		const e = new vscode.WorkspaceEdit();
		change(e);
		if (await vscode.workspace.applyEdit(e)) await doc.save();
	}

	async function onMessage(doc: vscode.TextDocument, webview: vscode.Webview, msg: { type?: string; index?: number; key?: string; value?: string }) {
		const text = doc.getText();
		const key = String(msg.key ?? '').trim();
		const value = String(msg.value ?? '');
		// Rows are addressed by position; if the file changed in between, just redraw instead of editing the wrong line.
		const v = typeof msg.index === 'number' ? findVariables(text)[msg.index] : undefined;
		if ((msg.type === 'set' || msg.type === 'delete') && v?.key !== key) return postEntries(doc);
		switch (msg.type) {
			case 'ready': return postEntries(doc);
			case 'toggle': return toggle(doc.uri.toString(), key);
			case 'showAll': return setAll(doc, true);
			case 'hideAll': return setAll(doc, false);
			case 'set':
				return edit(doc, e => e.replace(doc.uri, new vscode.Range(doc.positionAt(v!.start), doc.positionAt(v!.end)), encode(value)));
			case 'delete': {
				if (await vscode.window.showWarningMessage(`Delete ${key}?`, { modal: true }, 'Delete') !== 'Delete') return;
				// The file may have changed while the dialog was open: locate the row again.
				const now = findVariables(doc.getText())[msg.index!];
				if (now?.key !== key) return postEntries(doc);
				const first = doc.lineAt(doc.positionAt(now.start).line), last = doc.lineAt(doc.positionAt(now.end).line);
				return edit(doc, e => e.delete(doc.uri, new vscode.Range(first.range.start, last.rangeIncludingLineBreak.end)));
			}
			case 'add': {
				if (!/^[\w.-]+$/.test(key)) return webview.postMessage({ type: 'error', message: 'Keys can only use letters, digits, _ . and -' });
				if (findVariables(text).some(x => x.key === key)) return webview.postMessage({ type: 'error', message: `${key} already exists` });
				const eol = doc.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
				const line = `${text && !text.endsWith('\n') ? eol : ''}${key}=${encode(value)}${eol}`;
				return edit(doc, e => e.insert(doc.uri, doc.positionAt(text.length), line));
			}
		}
	}

	function html(webview: vscode.Webview, media: vscode.Uri) {
		const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
		const asset = (file: string) => webview.asWebviewUri(vscode.Uri.joinPath(media, file));
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link rel="stylesheet" href="${asset('editor.css')}">
</head>
<body>
	<main class="list">
		<div id="rows"></div>
		<form id="add" class="row add" autocomplete="off">
			<input id="new-key" placeholder="NEW_KEY" aria-label="New key" spellcheck="false" required>
			<input id="new-value" type="password" placeholder="value" aria-label="New value">
			<span class="actions"><button class="primary">Add</button></span>
		</form>
	</main>
	<p id="empty" class="hint" hidden>No variables yet: add the first one above.</p>
	<p id="error" class="error" role="alert"></p>
	<footer>
		<button id="show-all" class="secondary">Show all</button>
		<button id="hide-all" class="secondary">Hide all</button>
	</footer>
	<script nonce="${nonce}" src="${asset('editor.js')}"></script>
</body>
</html>`;
	}

	context.subscriptions.push(
		mask, reveal, lensesChanged, showAll, hideAll,
		vscode.window.registerCustomEditorProvider('uwu.env', {
			resolveCustomTextEditor(doc, panel) {
				const media = vscode.Uri.joinPath(context.extensionUri, 'media');
				panel.webview.options = { enableScripts: true, localResourceRoots: [media] };
				panel.webview.html = html(panel.webview, media);
				const view = { doc, webview: panel.webview };
				views.add(view);
				panel.onDidDispose(() => views.delete(view));
				panel.webview.onDidReceiveMessage(msg => onMessage(doc, panel.webview, msg));
			},
		}, { supportsMultipleEditorsPerDocument: true }),
		vscode.languages.registerCodeLensProvider(selector, {
			onDidChangeCodeLenses: lensesChanged.event,
			provideCodeLenses: doc => findValues(doc.getText()).map(v => {
				const at = doc.positionAt(v.start);
				const title = isShown(doc, v.key) ? '$(eye-closed) Hide' : '$(eye) Show';
				return new vscode.CodeLens(new vscode.Range(at, at), { title, command: 'envEditor.toggle', arguments: [doc.uri.toString(), v.key] });
			}),
		}),
		vscode.commands.registerCommand('envEditor.toggle', toggle),
		vscode.commands.registerCommand('envEditor.showAll', () => setAll(vscode.window.activeTextEditor?.document, true)),
		vscode.commands.registerCommand('envEditor.hideAll', () => setAll(vscode.window.activeTextEditor?.document, false)),
		vscode.window.onDidChangeVisibleTextEditors(refresh),
		vscode.window.onDidChangeActiveTextEditor(refresh),
		vscode.workspace.onDidOpenTextDocument(refresh),
		vscode.workspace.onDidChangeTextDocument(e => {
			vscode.window.visibleTextEditors.filter(ed => ed.document === e.document).forEach(decorate);
			if ([...views].some(v => v.doc === e.document)) postEntries(e.document);
		}),
		// onDidCloseTextDocument isn't guaranteed when a tab closes: forget reveals of files with no tab left.
		vscode.window.tabGroups.onDidChangeTabs(() => {
			const open = new Set(vscode.window.tabGroups.all.flatMap(g => g.tabs).map(t =>
				t.input instanceof vscode.TabInputText || t.input instanceof vscode.TabInputCustom ? t.input.uri.toString() : ''));
			for (const uri of state.keys()) if (!open.has(uri)) state.delete(uri);
		}),
	);
	refresh();
}
