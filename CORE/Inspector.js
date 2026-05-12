// Inspector.js – Core Inspector Singleton for Probe Engine
// @version 1.0.0
// @description Handles the entire inspector panel UI and logic.
// @author Forge™ Open Source Philanthropy

(() => {
    // Wait until globals are ready
    function initWhenReady() {
        if (typeof window.SceneManager === 'undefined' ||
            typeof window.UI === 'undefined' ||
            typeof window.Engine === 'undefined' ||
            typeof window.Persistence === 'undefined') {
            setTimeout(initWhenReady, 50);
            return;
        }

        window.Inspector = {
            pendingAssetAssign: null,

            // Render the entire inspector for the current selection
            render() {
                const c = document.getElementById('inspector-content'),
                      f = document.getElementById('inspector-footer');
                if (!c || !f) return;
                c.innerHTML = '';

                const sel = Array.from(SceneManager.selectedEntityIds);
                if (sel.length === 0) {
                    c.innerHTML = '<div class="text-gray-500 text-center mt-10 text-xs italic">Select an entity</div>';
                    f.classList.add('hidden');
                    return;
                }
                f.classList.remove('hidden');

                const ent = SceneManager.entities.get(sel[0]);
                // Entity name bar
                let h = document.createElement('div');
                h.className = "flex items-center gap-2 mb-2 shrink-0";
                h.innerHTML = `<input type="checkbox" checked class="accent-editor-accent w-auto"> <input type="text" value="${escapeHtml(ent.name)}" class="font-bold text-sm bg-transparent border-b border-transparent focus:border-editor-accent" onchange="SceneManager.entities.get('${ent.id}').name = this.value; UI.renderHierarchy(); Persistence.debouncedSave()">`;
                c.appendChild(h);

                // Iterate components
                for (let key in ent.components) {
                    this.renderComponent(ent, key);
                }
            },

            // Render a single component section
            renderComponent(ent, compKey) {
                const c = document.getElementById('inspector-content');
                const comp = ent.components[compKey];
                const typeName = comp.type || 'Unknown';
                const isCollapsed = comp._collapsed || false;
                const defaultComp = ComponentRegistry[typeName] ? new ComponentRegistry[typeName]() : {};

                let sec = document.createElement('div');
                sec.className = "bg-[#2d2d2d] border border-editor-border rounded mb-2 overflow-hidden shrink-0";

                // Header
                let title = document.createElement('div');
                title.className = "bg-editor-header px-2 py-1.5 font-bold flex justify-between items-center";

                let editBtnHtml = '';
                if (typeName === 'Collider2D') {
                    let isEditingThis = Engine.editColliderState && Engine.editColliderState.compId === compKey;
                    let editColor = isEditingThis ? 'text-yellow-400' : 'text-gray-400 hover:text-white';
                    editBtnHtml = `<button class="${editColor} mr-2" onclick="Engine.toggleEditCollider('${ent.id}', '${compKey}'); Inspector.render();" title="Edit Collider"><i class="fas fa-draw-polygon text-[14px]"></i></button>`;
                }

                title.innerHTML = `
                    <div class="flex items-center cursor-pointer flex-1" onclick="Engine.toggleComponentCollapse('${ent.id}', '${compKey}')">
                        <i id="collapse-icon-${compKey}" class="fas fa-chevron-${isCollapsed ? 'right' : 'down'} w-4 text-[10px] text-gray-400 mr-2"></i>
                        <span><i class="fas fa-puzzle-piece mr-1 text-gray-400"></i> ${escapeHtml(typeName)}</span>
                    </div>
                    <div>${editBtnHtml}${typeName !== 'Transform' ? `<button class="text-red-400 hover:text-white" onclick="delete SceneManager.entities.get('${ent.id}').components['${compKey}']; if(Engine.editColliderState && Engine.editColliderState.compId === '${compKey}') Engine.toggleEditCollider(null, null); Inspector.render(); Persistence.debouncedSave()"><i class="fas fa-times text-[10px]"></i></button>` : ''}</div>
                `;
                sec.appendChild(title);

                // Body
                let body = document.createElement('div');
                body.id = `inspector-body-${compKey}`;
                body.className = `p-2 flex flex-col gap-1.5 ${isCollapsed ? 'hidden' : ''}`;

                // -- Properties --
                for (let prop in comp) {
                    if (['entity','type','uuid','scriptVariables','_forces','_collapsed'].includes(prop)) continue;
                    this.renderProperty(ent, compKey, prop, comp, defaultComp, body);
                }

                // -- Script Variables --
                if (typeName === 'ScriptRef' && comp.scriptVariables && Object.keys(comp.scriptVariables).length > 0) {
                    let sep = document.createElement('div');
                    sep.className = "w-full h-px bg-editor-border my-1";
                    body.appendChild(sep);
                    for (let sVar in comp.scriptVariables) {
                        this.renderScriptVariable(ent, compKey, sVar, comp, body);
                    }
                }

                sec.appendChild(body);
                document.getElementById('inspector-content').appendChild(sec);
            },

            // Render a single property row (improved layout)
            renderProperty(ent, compKey, prop, comp, defaultComp, container) {
                let type = typeof comp[prop];
                let row = document.createElement('div');
                row.className = "flex items-center gap-2 py-0.5";

                // Label (width fixed)
                let label = document.createElement('span');
                label.className = "text-gray-400 text-[11px] capitalize w-20 shrink-0 truncate";
                label.innerText = prop.replace('AssetId', '');
                row.appendChild(label);

                // Value area
                let valueWrap = document.createElement('div');
                valueWrap.className = "flex-1 flex items-center gap-2";

                let updateFn = `let el = document.getElementById('inspector-${compKey}-${prop}'); let v = (el.type==='checkbox')?el.checked:(el.type==='number'?parseFloat(el.value):el.value); let c = SceneManager.entities.get('${ent.id}').components['${compKey}']; c['${prop}'] = v; SceneManager.rebuildQuadtree(); Persistence.debouncedSave(); Inspector.updateLive(SceneManager.entities.get('${ent.id}'));`;

                let inputId = `inspector-${compKey}-${prop}`;

                if (prop === 'shape') {
                    valueWrap.innerHTML = `<select id="${inputId}" class="flex-1 h-6 text-[11px] bg-editor-bg border border-editor-border rounded" onchange="${updateFn}">
                        <option value="box" ${comp[prop]==='box'?'selected':''}>Box</option>
                        <option value="circle" ${comp[prop]==='circle'?'selected':''}>Circle</option>
                        <option value="polygon" ${comp[prop]==='polygon'?'selected':''}>Polygon</option>
                    </select>`;
                }
                else if (prop === 'spriteAssetId') {
                    let images = Object.values(AssetManager.items).filter(a => a.type === 'image');
                    let uploadBtn = `<button class="w-6 h-6 bg-editor-bg border border-editor-border hover:bg-gray-600 rounded text-gray-300 flex items-center justify-center shrink-0 ml-1" title="Upload Image" onclick="Inspector.triggerUpload('${ent.id}','${compKey}','${prop}')"><i class="fas fa-upload text-[10px]"></i></button>`;
                    if (images.length > 3) {
                        valueWrap.innerHTML = `<button class="flex-1 bg-editor-bg border border-editor-border hover:border-editor-accent text-[11px] px-2 h-6 rounded truncate text-left" onclick="Inspector.openAssetSelector('${ent.id}','${compKey}','${prop}','image')">${comp[prop] ? escapeHtml(AssetManager.items[comp[prop]]?.name) || 'Select Image...' : 'Select Image...'}</button>${uploadBtn}`;
                    } else {
                        let opts = images.map(a => `<option value="${a.id}" ${comp[prop]===a.id?'selected':''}>${escapeHtml(a.name)}</option>`).join('');
                        valueWrap.innerHTML = `<select id="${inputId}" class="flex-1 h-6 text-[11px] bg-editor-bg border border-editor-border rounded" onchange="${updateFn}"><option value="">-- None --</option>${opts}</select>${uploadBtn}`;
                    }
                }
                else if (prop === 'scriptAssetId') {
                    let scriptName = comp[prop] && AssetManager.items[comp[prop]] ? AssetManager.items[comp[prop]].name : 'Select Script...';
                    valueWrap.innerHTML = `
                        <div class="flex flex-1 bg-editor-bg border border-editor-border rounded h-6 items-center hover:border-editor-accent group">
                            <div class="flex-1 truncate px-2 text-[11px] cursor-pointer" ondblclick="if('${comp[prop]}') { document.getElementById('script-editor-panel').classList.remove('hidden'); Scripts.openScript('${comp[prop]}'); }" title="Double-click to open script">${escapeHtml(scriptName)}</div>
                            <button class="w-6 h-full border-l border-editor-border hover:bg-gray-600 flex items-center justify-center text-gray-400 group-hover:text-white" onclick="Inspector.openAssetSelector('${ent.id}','${compKey}','${prop}','script')" title="Select Script"><i class="fas fa-ellipsis-h text-[10px]"></i></button>
                        </div>`;
                }
                else if (type === 'number') {
                    let min = -2000, max = 2000, step = 1;
                    if (prop.includes('scale') || prop === 'mass' || prop === 'gravityScale') { min = -10; max = 10; step = 0.1; }
                    if (prop === 'rotation') { min = 0; max = 360; step = 1; }
                    let valStr = Number.isInteger(comp[prop]) ? comp[prop] : comp[prop].toFixed(2);
                    valueWrap.innerHTML = `
                        <input id="${inputId}-range" type="range" class="flex-1 min-w-0 accent-editor-accent h-1.5 cursor-pointer" min="${min}" max="${max}" step="${step}" value="${valStr}" oninput="document.getElementById('${inputId}').value=this.value; ${updateFn}">
                        <input id="${inputId}" type="number" step="${step}" value="${valStr}" class="w-[60px] shrink-0 h-5 px-1 text-[11px] text-right bg-[#3c3c3c] border border-[#333] rounded editor-number-input" onchange="${updateFn}">
                    `;
                }
                else if (type === 'boolean') {
                    valueWrap.innerHTML = `<div class="flex-1"></div><input id="${inputId}" type="checkbox" ${comp[prop] ? 'checked' : ''} onchange="${updateFn}">`;
                }
                else if (type === 'string') {
                    if (prop === 'color' || prop === 'backgroundColor') {
                        valueWrap.innerHTML = `<div class="flex-1"></div><input id="${inputId}" type="color" value="${escapeHtml(String(comp[prop]))}" class="w-[60px] h-5 p-0 border-0 rounded cursor-pointer shrink-0" onchange="${updateFn}">`;
                    } else {
                        valueWrap.innerHTML = `<input id="${inputId}" type="text" value="${escapeHtml(String(comp[prop]))}" class="flex-1 h-6 text-[11px] bg-[#3c3c3c] border border-[#333] rounded px-1" onchange="${updateFn}">`;
                    }
                }

                // Reset button
                let resetBtn = document.createElement('button');
                resetBtn.className = "text-gray-500 hover:text-white shrink-0";
                resetBtn.innerHTML = '<i class="fas fa-undo text-[9px]"></i>';
                resetBtn.title = "Reset Value";
                resetBtn.onclick = () => {
                    comp[prop] = defaultComp[prop];
                    if (prop === 'scriptAssetId') comp.scriptVariables = {};
                    Inspector.render();
                    Persistence.debouncedSave();
                };

                row.appendChild(valueWrap);
                row.appendChild(resetBtn);
                container.appendChild(row);
            },

            // Render a public script variable (similar improved layout)
            renderScriptVariable(ent, compKey, sVar, comp, container) {
                let type = typeof comp.scriptVariables[sVar];
                let row = document.createElement('div');
                row.className = "flex items-center gap-2 py-0.5";

                let label = document.createElement('span');
                label.className = "text-gray-400 text-[11px] capitalize w-20 shrink-0 truncate text-editor-accent";
                label.innerText = sVar;
                row.appendChild(label);

                let valueWrap = document.createElement('div');
                valueWrap.className = "flex-1 flex items-center gap-2";

                let updateFn = `let el = document.getElementById('inspector-sv-${compKey}-${sVar}'); let v = (el.type==='checkbox')?el.checked:(el.type==='number'?parseFloat(el.value):el.value); let c = SceneManager.entities.get('${ent.id}').components['${compKey}']; c.scriptVariables['${sVar}'] = v; Persistence.debouncedSave(); Inspector.updateLive(SceneManager.entities.get('${ent.id}'));`;
                let inputId = `inspector-sv-${compKey}-${sVar}`;

                if (type === 'number') {
                    let min = -2000, max = 2000, step = 0.1;
                    let valStr = Number.isInteger(comp.scriptVariables[sVar]) ? comp.scriptVariables[sVar] : comp.scriptVariables[sVar].toFixed(2);
                    valueWrap.innerHTML = `
                        <input id="${inputId}-range" type="range" class="flex-1 min-w-0 accent-editor-accent h-1.5 cursor-pointer" min="${min}" max="${max}" step="${step}" value="${valStr}" oninput="document.getElementById('${inputId}').value=this.value; ${updateFn}">
                        <input id="${inputId}" type="number" step="${step}" value="${valStr}" class="w-[60px] shrink-0 h-5 px-1 text-[11px] text-right bg-[#3c3c3c] border border-[#333] rounded editor-number-input" onchange="${updateFn}">`;
                }
                else if (type === 'boolean') {
                    valueWrap.innerHTML = `<div class="flex-1"></div><input id="${inputId}" type="checkbox" ${comp.scriptVariables[sVar] ? 'checked' : ''} onchange="${updateFn}">`;
                }
                else if (type === 'string') {
                    valueWrap.innerHTML = `<input id="${inputId}" type="text" value="${escapeHtml(String(comp.scriptVariables[sVar]))}" class="flex-1 h-6 text-[11px] bg-[#3c3c3c] border border-[#333] rounded px-1" onchange="${updateFn}">`;
                }

                let resetBtn = document.createElement('button');
                resetBtn.className = "text-gray-500 hover:text-white shrink-0";
                resetBtn.innerHTML = '<i class="fas fa-undo text-[9px]"></i>';
                resetBtn.title = "Reset Value";
                resetBtn.onclick = () => {
                    if (comp.scriptAssetId && AssetManager.items[comp.scriptAssetId]) {
                        let scriptCode = AssetManager.items[comp.scriptAssetId].data;
                        let className = AssetManager.items[comp.scriptAssetId].name.split('.')[0];
                        try {
                            let factory = new Function(`return (function() { ${scriptCode}; return new ${className}(); })();`);
                            let inst = factory();
                            comp.scriptVariables[sVar] = inst[sVar];
                        } catch(e) {}
                    }
                    Inspector.render();
                    Persistence.debouncedSave();
                };

                row.appendChild(valueWrap);
                row.appendChild(resetBtn);
                container.appendChild(row);
            },

            updateLive(ent) {
                if (!ent) return;
                for (let key in ent.components) {
                    let comp = ent.components[key];
                    for (let prop in comp) {
                        if (prop === 'scriptVariables') {
                            for (let sVar in comp.scriptVariables) {
                                let el = document.getElementById(`inspector-sv-${key}-${sVar}`);
                                if (el && typeof comp.scriptVariables[sVar] === 'number') {
                                    let valStr = Number.isInteger(comp.scriptVariables[sVar]) ? comp.scriptVariables[sVar] : comp.scriptVariables[sVar].toFixed(2);
                                    el.value = valStr;
                                    let range = document.getElementById(`inspector-sv-${key}-${sVar}-range`);
                                    if (range) range.value = valStr;
                                }
                            }
                        } else if (typeof comp[prop] === 'number') {
                            let el = document.getElementById(`inspector-${key}-${prop}`);
                            if (el) {
                                let valStr = Number.isInteger(comp[prop]) ? comp[prop] : comp[prop].toFixed(2);
                                el.value = valStr;
                                let range = document.getElementById(`inspector-${key}-${prop}-range`);
                                if (range) range.value = valStr;
                            }
                        }
                    }
                }
            },

            toggleAddComponentMenu() {
                let m = document.getElementById('add-component-menu');
                m.classList.toggle('hidden');
                if (!m.classList.contains('hidden')) {
                    this.filterComponents();
                    document.getElementById('component-search').focus();
                }
            },

            filterComponents() {
                const searchInput = document.getElementById('component-search');
                const list = document.getElementById('component-list');
                if (!searchInput || !list) return;   // ← safe early exit
            
                let q = searchInput.value.toLowerCase();
                list.innerHTML = '';
                Object.keys(ComponentRegistry).forEach(k => {
                    if (k === 'Transform' || !k.toLowerCase().includes(q)) return;
                    let b = document.createElement('button');
                    b.className = "text-left px-2 py-1.5 hover:bg-editor-accent border-b border-editor-border";
                    b.innerText = k;
                    b.onclick = () => {
                        SceneManager.selectedEntityIds.forEach(id => SceneManager.entities.get(id).AddComponent(k));
                        this.toggleAddComponentMenu();
                        this.render();
                        Persistence.debouncedSave();
                    };
                    list.appendChild(b);
                });
            },

            triggerUpload(entId, compKey, prop) {
                this.pendingAssetAssign = { entId, compKey, prop };
                document.getElementById('inspector-image-upload').click();
            },

            handleImageUpload(e) {
                let files = e.target.files;
                if (!files || files.length === 0 || !this.pendingAssetAssign) return;
                let file = files[0];
                let reader = new FileReader();
                reader.onload = (ev) => {
                    let asset = AssetManager.createAsset(file.name, 'image', ev.target.result, AssetManager.rootId);
                    let { entId, compKey, prop } = this.pendingAssetAssign;
                    SceneManager.entities.get(entId).components[compKey][prop] = asset.id;
                    this.render();
                    Persistence.debouncedSave();
                };
                reader.readAsDataURL(file);
                e.target.value = '';
            },

            openAssetSelector(entId, compKey, prop, assetType = 'image') {
                this.pendingAssetAssign = { entId, compKey, prop };
                let items = Object.values(AssetManager.items).filter(a => a.type === assetType);
                let list = document.getElementById('asset-selector-list');
                if (!list) return;
                list.innerHTML = '';

                let modalTitle = document.querySelector('#asset-selector-modal .font-bold');
                if (modalTitle) modalTitle.innerText = assetType === 'script' ? 'Select Script' : 'Select Image';

                items.forEach(item => {
                    let div = document.createElement('div');
                    div.className = "flex flex-col items-center p-2 border border-editor-border hover:border-editor-accent rounded cursor-pointer bg-editor-bg";
                    let iconHtml = assetType === 'script' ? (item.name.toLowerCase().endsWith('.cs') ? `<i class="fas fa-hashtag text-4xl text-purple-400 mb-2 mt-1"></i>` : `<i class="fas fa-code text-4xl text-blue-400 mb-2 mt-1"></i>`) : `<img src="${item.data}" class="w-16 h-16 object-contain mb-2">`;
                    div.innerHTML = `${iconHtml}
                                     <span class="text-[10px] w-full truncate text-center" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
                                     <span class="text-[8px] text-gray-500 w-full truncate text-center" title="${escapeHtml(AssetManager.getPath(item.parentId).map(p=>p.name).join('/'))}">${escapeHtml(AssetManager.getPath(item.parentId).map(p=>p.name).join('/'))}</span>`;
                    div.onclick = () => {
                        let c = SceneManager.entities.get(entId).components[compKey];
                        c[prop] = item.id;
                        if (assetType === 'script') {
                            // parse public variables
                            let scriptCode = item.data;
                            let className = item.name.split('.')[0];
                            try {
                                let factory = new Function(`return (function() { ${scriptCode}; return new ${className}(); })();`);
                                let inst = factory();
                                c.scriptVariables = c.scriptVariables || {};
                                let newVars = {};
                                for (let k in inst) {
                                    if (typeof inst[k] !== 'function') {
                                        newVars[k] = c.scriptVariables[k] !== undefined ? c.scriptVariables[k] : inst[k];
                                    }
                                }
                                c.scriptVariables = newVars;
                            } catch(e) { console.warn('Script Parse Error', e); }
                        }
                        document.getElementById('asset-selector-modal').classList.add('hidden');
                        this.render();
                        Persistence.debouncedSave();
                    };
                    list.appendChild(div);
                });

                // None option
                let noneDiv = document.createElement('div');
                noneDiv.className = "flex flex-col items-center p-2 border border-editor-border hover:border-editor-accent rounded cursor-pointer bg-editor-bg";
                noneDiv.innerHTML = `<i class="fas fa-times text-4xl text-gray-500 mb-2 mt-1"></i><span class="text-[10px] w-full truncate text-center">None</span>`;
                noneDiv.onclick = () => {
                    let c = SceneManager.entities.get(entId).components[compKey];
                    c[prop] = '';
                    if (assetType === 'script') c.scriptVariables = {};
                    document.getElementById('asset-selector-modal').classList.add('hidden');
                    this.render();
                    Persistence.debouncedSave();
                };
                list.appendChild(noneDiv);

                document.getElementById('asset-selector-modal').classList.remove('hidden');
            },

            // Hook into the existing UI toggle for add component
            hookAddComponentButton() {
                const btn = document.querySelector('#inspector-footer button');
                if (btn) btn.onclick = () => Inspector.toggleAddComponentMenu();
            }
        };

        // Attach to the engine
        // Replace UI.renderInspector and UI.updateInspectorLive
        UI.renderInspector = () => Inspector.render();
        UI.updateInspectorLive = (ent) => Inspector.updateLive(ent);
        UI.toggleAddComponentMenu = () => Inspector.toggleAddComponentMenu();
        UI.filterComponents = () => Inspector.filterComponents();
        UI.triggerInspectorUpload = (a,b,c) => Inspector.triggerUpload(a,b,c);
        UI.handleInspectorImageUpload = (e) => Inspector.handleImageUpload(e);
        UI.openAssetSelector = (a,b,c,d) => Inspector.openAssetSelector(a,b,c,d);

        // Override the file input handler
        const uploadInput = document.getElementById('inspector-image-upload');
        if (uploadInput) uploadInput.onchange = (e) => Inspector.handleImageUpload(e);

        Inspector.hookAddComponentButton();
        EventBus.on('entitySelected', () => Inspector.render()); // Auto-render when an entity is selected
        console.log('[Inspector] Singleton installed');
    }

    document.addEventListener('DOMContentLoaded', initWhenReady);
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initWhenReady();
    }
})();
