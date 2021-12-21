import * as vscode from 'vscode';
import { getNonce } from './util';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Provider for cat scratch editors.
 * 
 * Cat scratch editors are used for `.cscratch` files, which are just json files.
 * To get started, run this extension and open an empty `.cscratch` file in VS Code.
 * 
 * This provider demonstrates:
 * 
 * - Setting up the initial webview for a custom editor.
 * - Loading scripts and styles in a custom editor.
 * - Synchronizing changes between a text document and a custom editor.
 */
export class envEditor implements vscode.CustomTextEditorProvider {
	private webviewPanel?: vscode.WebviewPanel;

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new envEditor(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(envEditor.viewType, provider);
		return providerRegistration;
	}

	private static readonly viewType = 'uwu.env';

	private static readonly scratchCharacters = ['😸', '😹', '😺', '😻', '😼', '😽', '😾', '🙀', '😿', '🐱'];

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	/**
	 * Called when our custom editor is opened.
	 * 
	 * 
	 */
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		this.webviewPanel = webviewPanel;
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		function updateWebview() {
			webviewPanel.webview.postMessage({
				type: 'update',
				text: document.getText(),
				parsed: Object.entries(dotenv.parse(document.getText()))
			});
		}

		// Hook up event handlers so that we can synchronize the webview with the text document.
		//
		// The text document acts as our model, so we have to sync change in the document to our
		// editor and sync changes in the editor back to the document.
		// 
		// Remember that a single text document can also be shared between multiple custom
		// editors (this happens for example when you split a custom editor)

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				updateWebview();
			}
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'updateView':
					this.updateFile(document, e.values.map((x: string[]) => x.join('=')).join('\n'));
					return;
			}
		});

		updateWebview();
	}

	/**
	 * Get the static html used for the editor webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to script and css for the webview
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'run.js'));

		const styles = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'styles.css'));

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();
		return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styles}" rel="stylesheet" />

				<title>Cat Scratch</title>
			</head>
			<body>
				<div id="boxes" class="boxes"></div>
				<script src="${scriptUri}" nonce="${nonce}"></script>
				<!--<button id="reload" class="reload">Reload</button>-->
			</body>
			</html>`;
	}

	private updateFile(document: vscode.TextDocument, value: string) {
		return this.updateTextDocument(document, value);
	}

	private getDocument(document: vscode.TextDocument): string {
		const text = document.getText();
		return text;
	}
	private updateTextDocument(document: vscode.TextDocument, str: string) {
		const edit = new vscode.WorkspaceEdit();

		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			str
		);
		this.webviewPanel!.webview.postMessage({
			type: 'update',
			text: str,
			parsed: Object.entries(dotenv.parse(document.getText()))
		});
		return vscode.workspace.applyEdit(edit);
	}
}
