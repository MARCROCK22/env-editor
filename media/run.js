//@ts-check

let values = [];
let key_value = {};

(() => {

	// @ts-ignore
	const vscode = acquireVsCodeApi();
	const element = document.getElementById('boxes');

	/**
	 * 
	 * @param {string} id 
	 * @param {[string, string]} param2 
	 */
	function registerDeleteButton(id, [key, value]) {
		key_value[key] = value;
		//element.innerHTML = `${id} XD ${document.getElementById(id).addEventListener}`;
		const atag = document.getElementById(id);
		atag.addEventListener('click', (event) => {
			event.stopImmediatePropagation();
			delete key_value[key];
			values[id.split(" ")[1]] = "";
			values = values.filter(v => v);
			updateContent(values);
			vscode.postMessage({
				type: 'updateView',
				values,
			});
		});
	}
	function registerEditButton(id) {
		const index = id.split(" ")[1];
		//element.innerHTML = `${id} XD ${document.getElementById(id).addEventListener}`;
		const button = document.getElementById(id);
		button.addEventListener('click', (event) => {
			element.innerHTML = `
		<input type="text" id="input-edit-key" value="${values[index][0]}" class="input-box" readonly>
		<input type="text" id="input-edit-value" value="${values[index][1]}" class="input-box">
		<button id="button-save">Save</button>
		`
			const button_save = document.getElementById('button-save');
			button_save.addEventListener('click', (eventt) => {
				const input_edit_value = document.getElementById('input-edit-value');
				const input_edit_key = document.getElementById('input-edit-key');
				// @ts-ignore
				const key = input_edit_key.value;
				// @ts-ignore
				const value = input_edit_value.value;

				if (!key || !value) {
					input_edit_key.style.backgroundColor = "#ff0000";
					input_edit_value.style.backgroundColor = "#ff0000";
					setTimeout(() => {
						input_edit_key.style.backgroundColor = "#ffffff";
						input_edit_value.style.backgroundColor = "#ffffff";
					}, 250);
					return;
				}

				input_edit_key.style.backgroundColor = "#ffffff";
				input_edit_value.style.backgroundColor = "#ffffff";

				key_value[key] = value;
				values[id.split(" ")[1]] = [key, value];
				updateContent(values);
				vscode.postMessage({
					type: 'updateView',
					values,
				});
				eventt.stopImmediatePropagation();
			});
			event.stopImmediatePropagation();
		});
	}

	function updateContent(/** @type {[string, string][]} */ parsed) {
		values = parsed;
		let txt = '';
		for (let index in values) {
			const i = values[index];
			const id = `${index}`;
			const delete_id = `delete ${id}`;
			const edit_id = `edit ${id}`;
			txt += `
			<div class="row">
				<input class="input-box" type="text" value="${i[0]}" readonly>
				<input class="input-box" type="password" value="${i[1]}" readonly>
				<div class="options">
					<a id="${edit_id}" class="edit-button">Edit</a>
					<a id="${delete_id}" class="delete-button">Delete</a>
				</div>
			</div>
			<br>
			`;
		}
		txt += `
		<div class="row">
			<input minlength="1" class="input-box" placeholder="key" id="input-key">
			<input minlength="1" class="input-box" placeholder="value" type="password" id="input-value">
			<div class="options">
				<a class="add-button" id="add-button">Add</a>
			</div>
		</div>
		<br>
		`
		element.innerHTML = txt;

		for (let i = 0; i < values.length; i++) {
			registerDeleteButton(`delete ${i}`, values[i]);
			registerEditButton(`edit ${i}`);
		}

		document.getElementById('add-button').addEventListener('click', () => {
			const input_key = document.getElementById('input-key');
			const input_value = document.getElementById('input-value');
			// @ts-ignore
			const key = input_key.value;
			// @ts-ignore
			const value = input_value.value;
			if (!key || !value || key_value[key]) {
				input_key.style.backgroundColor = '#ff0000';
				input_value.style.backgroundColor = '#ff0000';
				setTimeout(() => {
					input_key.style.backgroundColor = '#ffffff';
					input_value.style.backgroundColor = '#ffffff';
				}, 250);
				return;
			};
			input_key.style.backgroundColor = '#ffffff';
			input_value.style.backgroundColor = '#ffffff';
			key_value[key] = value;
			values.push([key, value]);
			updateContent(values);
			vscode.postMessage({
				type: 'updateView',
				values,
			});
		});
	}

	window.addEventListener('message', (event) => {
		const data = event.data;
		switch (data.type) {
			case 'update': {
				updateContent(data.parsed);
				vscode.setState({ parsed: data.parsed, actualCase: 'update' });
				break;
			}
		}
	});

	// State lets us save information across these re-loads
	const state = vscode.getState();
	if (state) {
		switch (state.actualCase) {
			case 'update':
				updateContent(state.parsed);
				break
			case 'editing':
				updateContent(state.parsed);
				break
		}
	}
})();