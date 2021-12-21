"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const envEditor_1 = require("./envEditor");
function activate(context) {
    // Register our custom editor providers
    context.subscriptions.push(envEditor_1.envEditor.register(context));
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map