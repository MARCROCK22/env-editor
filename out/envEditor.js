"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envEditor = void 0;
const vscode = require("vscode");
const util_1 = require("./util");
const dotenv = require("dotenv");
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
class envEditor {
    constructor(context) {
        this.context = context;
    }
    static register(context) {
        const provider = new envEditor(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(envEditor.viewType, provider);
        return providerRegistration;
    }
    /**
     * Called when our custom editor is opened.
     *
     *
     */
    async resolveCustomTextEditor(document, webviewPanel, _token) {
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
                    this.updateFile(document, e.values.map((x) => x.join('=')).join('\n'));
                    return;
            }
        });
        updateWebview();
    }
    /**
     * Get the static html used for the editor webviews.
     */
    getHtmlForWebview(webview) {
        // Local path to script and css for the webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'run.js'));
        const styles = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'styles.css'));
        // Use a nonce to whitelist which scripts can be run
        const nonce = (0, util_1.getNonce)();
        return /* html */ `
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
    updateFile(document, value) {
        return this.updateTextDocument(document, value);
    }
    getDocument(document) {
        const text = document.getText();
        return text;
    }
    updateTextDocument(document, str) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), str);
        this.webviewPanel.webview.postMessage({
            type: 'update',
            text: str,
            parsed: Object.entries(dotenv.parse(document.getText()))
        });
        return vscode.workspace.applyEdit(edit);
    }
}
exports.envEditor = envEditor;
envEditor.viewType = 'uwu.env';
envEditor.scratchCharacters = ['😸', '😹', '😺', '😻', '😼', '😽', '😾', '🙀', '😿', '🐱'];
//# sourceMappingURL=envEditor.js.map