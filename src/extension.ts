import * as vscode from 'vscode';
import { findValues } from './parse';

// .env files by language (VS Code's built-in `dotenv`) or by name, in case another extension claims them.
const selector: vscode.DocumentSelector = [{ language: 'dotenv' }, { pattern: '**/{.env,*.env,.env.*}' }];
const isEnv = (doc?: vscode.TextDocument): doc is vscode.TextDocument => !!doc && vscode.languages.match(selector, doc) > 0;

// Revealed values per open file: a key is visible when `allShown` XOR it was toggled.
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
	const lensesChanged = new vscode.EventEmitter<void>();
	const showAll = vscode.window.createStatusBarItem('envEditor.showAll', vscode.StatusBarAlignment.Right);
	const hideAll = vscode.window.createStatusBarItem('envEditor.hideAll', vscode.StatusBarAlignment.Right);
	showAll.name = '.env: Show all';
	showAll.text = '$(eye) Show all';
	showAll.command = 'envEditor.showAll';
	hideAll.name = '.env: Hide all';
	hideAll.text = '$(eye-closed) Hide all';
	hideAll.command = 'envEditor.hideAll';

	function decorate(editor: vscode.TextEditor) {
		const doc = editor.document;
		const options: vscode.DecorationOptions[] = [];
		for (const v of isEnv(doc) ? findValues(doc.getText()) : []) {
			if (isShown(doc, v.key)) continue;
			const value = new vscode.Range(doc.positionAt(v.start), doc.positionAt(v.end));
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
	}

	function setAll(allShown: boolean) {
		const doc = vscode.window.activeTextEditor?.document;
		if (isEnv(doc)) state.set(doc.uri.toString(), { allShown, toggled: new Set() });
		revealChanged();
	}

	context.subscriptions.push(
		mask, lensesChanged, showAll, hideAll,
		vscode.languages.registerCodeLensProvider(selector, {
			onDidChangeCodeLenses: lensesChanged.event,
			provideCodeLenses: doc => findValues(doc.getText()).map(v => {
				const at = doc.positionAt(v.start);
				const title = isShown(doc, v.key) ? '$(eye-closed) Hide' : '$(eye) Show';
				return new vscode.CodeLens(new vscode.Range(at, at), { title, command: 'envEditor.toggle', arguments: [doc.uri.toString(), v.key] });
			}),
		}),
		vscode.commands.registerCommand('envEditor.toggle', (uri: string, key: string) => {
			const s = state.get(uri) ?? { allShown: false, toggled: new Set<string>() };
			if (!s.toggled.delete(key)) s.toggled.add(key);
			state.set(uri, s);
			revealChanged();
		}),
		vscode.commands.registerCommand('envEditor.showAll', () => setAll(true)),
		vscode.commands.registerCommand('envEditor.hideAll', () => setAll(false)),
		vscode.window.onDidChangeVisibleTextEditors(refresh),
		vscode.window.onDidChangeActiveTextEditor(refresh),
		vscode.workspace.onDidOpenTextDocument(refresh),
		vscode.workspace.onDidChangeTextDocument(e => vscode.window.visibleTextEditors.filter(ed => ed.document === e.document).forEach(decorate)),
		// onDidCloseTextDocument isn't guaranteed when a tab closes: forget reveals of files with no tab left.
		vscode.window.tabGroups.onDidChangeTabs(() => {
			const open = new Set(vscode.window.tabGroups.all.flatMap(g => g.tabs).map(t => t.input instanceof vscode.TabInputText ? t.input.uri.toString() : ''));
			for (const uri of state.keys()) if (!open.has(uri)) state.delete(uri);
		}),
	);
	refresh();
}
