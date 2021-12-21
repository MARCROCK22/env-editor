import * as vscode from 'vscode';
import { envEditor } from './envEditor';

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor providers
	context.subscriptions.push(envEditor.register(context));
}