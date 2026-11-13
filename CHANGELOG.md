# Changelog

## 0.2.0

- `.env` files open in a table again, with every value hidden and nothing flashing on screen: Show / Hide per row, Show all / Hide all at the bottom, and Edit / Delete / Add that save right away while keeping comments and formatting.
- The text editor with masked values is still available through **Reopen Editor With… → Text Editor**.

## 0.1.1

- Values no longer flash in clear for a moment when a `.env` file is opened or its tab is shown again. Right after VS Code starts they can still show briefly, until syntax highlighting is ready.
- New icon.

## 0.1.0

- `.env` files now open in the normal text editor with their values hidden. Use **Show / Hide** above each variable, or **Show all / Hide all** in the status bar.
- Removed the form-based editor: it rewrote the whole file (dropping comments) and needed Ctrl+S after every change.
