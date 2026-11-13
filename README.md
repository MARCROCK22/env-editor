# Env editor

`.env` files (`.env`, `*.env`, `.env.*`) open in a table where every value is hidden.

- **Show / Hide** on each row reveals or hides that value; **Show all / Hide all** at the bottom does it for the whole file.
- **Edit**, **Delete** and **Add** write the file and save it right away, keeping comments, quotes and the order of the file.
- A hidden value is never sent to the view, so it can't flash on screen, not even while VS Code starts.

To edit the raw text, use **Reopen Editor With… → Text Editor**. Values stay masked there too, with Show/Hide above each variable and Show all / Hide all in the status bar, but the text editor can still show them briefly while VS Code starts or on the extra lines of multiline values, under a block cursor, and in other views such as search results or diffs.

![Env editor](./docs/example.png)
