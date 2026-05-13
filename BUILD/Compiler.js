// Compiler.js - Probe Engine Game Compiler Singleton
// @version 1.0.0
// @developer Probe Engine Team
// @description Compiles Probe Engine projects into standalone HTML5 games with splash screen, scene switching, and platform installers.

(function () {
    'use strict';

    // ============================================================
    //  PROBE COMPILER SINGLETON
    // ============================================================
    window.ProbeCompiler = {

        compile: async function (exportData, currentEngineHtml) {
            console.log('[ProbeCompiler] Compiling game:', exportData.appName);

            try {
                // Fetch the yellow satellite PNG and convert to base64
                let logoDataUrl = null;
                try {
                    const response = await fetch('https://raw.githubusercontent.com/F-O-R-G-E-Open-Source-Philanthropy/Probe-Engine/main/IMG%27s/yellow_satellite.png');
                    if (response.ok) {
                        const blob = await response.blob();
                        logoDataUrl = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                    } else {
                        console.warn('[ProbeCompiler] Could not fetch logo, proceeding without it.');
                    }
                } catch (e) {
                    console.warn('[ProbeCompiler] Logo fetch failed, proceeding without it.', e);
                }

                const compiledHTML = this.buildStandaloneHTML(exportData, logoDataUrl);
                this.triggerDownload(
                    (exportData.appName || 'MyGame').replace(/[^a-zA-Z0-9_-]/g, '_') + '.html',
                    compiledHTML,
                    'text/html'
                );

                if (exportData.platforms && exportData.platforms.linux) {
                    this.generateLinuxInstaller(exportData);
                }
                if (exportData.platforms && exportData.platforms.windows) {
                    this.generateWindowsInstaller(exportData);
                }

                console.log('[ProbeCompiler] Compilation complete!');
                if (typeof window.Toast !== 'undefined' && window.Toast.show) {
                    window.Toast.show('Game exported successfully!', 'success');
                }
            } catch (err) {
                console.error('[ProbeCompiler] Compilation failed:', err);
                if (typeof window.Toast !== 'undefined' && window.Toast.show) {
                    window.Toast.show('Export failed: ' + err.message, 'error');
                }
            }
        },

        buildStandaloneHTML: function (exportData, logoDataUrl = null) {
            const appName = exportData.appName || 'My Game';
            const splashDuration = exportData.splashDuration || 3.0;
            const companyLogoId = exportData.companyLogoId || '';
            const appIconId = exportData.appIcon || '';
            const sceneIds = exportData.scenes || [];
            const assets = exportData.assets || {};
            const extensions = exportData.extensions || {};

            let companyLogoDataURL = '';
            if (companyLogoId && assets[companyLogoId] && assets[companyLogoId].type === 'image') {
                companyLogoDataURL = assets[companyLogoId].data || '';
            }

            let appIconDataURL = '';
            if (appIconId && assets[appIconId] && assets[appIconId].type === 'image') {
                appIconDataURL = assets[appIconId].data || '';
            }

            const sceneDataArray = [];
            const sceneNameMap = {};
            if (sceneIds.length > 0) {
                sceneIds.forEach((sceneAssetId, idx) => {
                    const sceneAsset = assets[sceneAssetId];
                    if (sceneAsset && sceneAsset.type === 'scene') {
                        try {
                            const sceneData = JSON.parse(sceneAsset.data);
                            sceneData._assetId = sceneAssetId;
                            sceneData._name = sceneAsset.name.replace('.scenes', '');
                            sceneDataArray.push(sceneData);
                            sceneNameMap[sceneData._name] = idx;
                            sceneNameMap[sceneAsset.name] = idx;
                            sceneNameMap[sceneAsset.name.replace('.scenes', '')] = idx;
                        } catch (e) {
                            console.warn('[ProbeCompiler] Failed to parse scene:', sceneAsset.name);
                        }
                    }
                });
            }

            if (sceneDataArray.length === 0) {
                sceneDataArray.push({
                    _assetId: 'default',
                    _name: 'Default',
                    name: 'Default',
                    entities: []
                });
                sceneNameMap['Default'] = 0;
            }

            const runtimeJS = this.buildRuntimeEngine(assets, extensions, sceneDataArray, sceneNameMap, {
                appName: appName,
                splashDuration: splashDuration,
                companyLogoDataURL: companyLogoDataURL,
                appIconDataURL: appIconDataURL,
                hasCompanyLogo: !!companyLogoDataURL
            });

            // Build the logo element: use the PNG base64 if available, otherwise show nothing
            const logoHTML = logoDataUrl
                ? `<img src="${logoDataUrl}" alt="Probe Engine" style="width:120px; height:120px; object-fit:contain;">`
                : '';

            const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>${this.escapeHTML(appName)}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 512 512%22><path fill=%230e639c d=%22M478.7 33.3c-20.4-20.4-53.5-20.4-73.9 0L247.5 190.5 220 163c-14.6-14.6-38.3-14.6-52.9 0L17 312.7c-21.8 21.8-21.8 57.3 0 79.1l80.3 80.3c21.8 21.8 57.3 21.8 79.1 0l149.7-150.1c14.6-14.6 14.6-38.3 0-52.9l-27.5-27.5 157.2-157.2c20.4-20.4 20.4-53.5 0-73.9l-22.9-22.9zM207.2 249l25.8 25.8c4.2 4.2 4.2 11 0 15.2l-149.7 150.1c-6.8 6.8-17.9 6.8-24.7 0l-80.3-80.3c-6.8-6.8-6.8-17.9 0-24.7L128 185.4c4.2-4.2 11-4.2 15.2 0l25.8 25.8c-28.4 46-21.5 110 20.3 149.2 4.9 4.6 12.3 4.2 16.7-.8l.2-.2c4.4-4.6 4-11.9-.8-16.7C171.1 312.3 165.7 261 207.2 249z%22/></svg>">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: #000; font-family: 'Segoe UI', system-ui, sans-serif; }
        
        #game-canvas {
            display: block;
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 1;
        }

        #splash-overlay {
            position: fixed;
            inset: 0;
            z-index: 1000;
            background: #0a0a0f;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transition: opacity 0.6s ease-out;
        }
        #splash-overlay.fade-out {
            opacity: 0;
            pointer-events: none;
        }
        .splash-probe-logo {
            width: 120px;
            height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
            filter: drop-shadow(0 0 30px rgba(14, 99, 156, 0.6));
            animation: logo-pulse 2s ease-in-out infinite;
        }
        .splash-probe-logo img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        @keyframes logo-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
        }
        .splash-probe-text {
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 3px;
            color: #eab308;
            text-shadow: 0 0 20px rgba(234, 179, 8, 0.5);
            animation: text-glow 2s ease-in-out infinite;
            margin-top: 10px;
        }
        @keyframes text-glow {
            0%, 100% { text-shadow: 0 0 20px rgba(234, 179, 8, 0.5); }
            50% { text-shadow: 0 0 40px rgba(234, 179, 8, 0.8), 0 0 60px rgba(234, 179, 8, 0.4); }
        }
        .splash-company-logo {
            max-width: 300px;
            max-height: 150px;
            object-fit: contain;
            animation: fade-in-up 0.8s ease-out;
        }
        @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .splash-separator {
            width: 60px;
            height: 2px;
            background: rgba(255,255,255,0.2);
            border-radius: 1px;
            margin: 10px 0;
        }
        .splash-loader {
            margin-top: 30px;
            width: 200px;
            height: 3px;
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
            overflow: hidden;
        }
        .splash-loader-bar {
            height: 100%;
            background: #0e639c;
            border-radius: 2px;
            animation: loader-progress var(--splash-duration) linear forwards;
        }
        @keyframes loader-progress {
            from { width: 0%; }
            to { width: 100%; }
        }
    </style>
</head>
<body>
    <div id="splash-overlay">
        <div class="splash-probe-logo">${logoHTML}</div>
        <div class="splash-probe-text">Probe Engine</div>
        <div id="splash-company-section" style="display:none; flex-direction:column; align-items:center; gap:16px;">
            <div class="splash-separator"></div>
            <img id="splash-company-logo-img" class="splash-company-logo" src="" alt="Company Logo" style="display:none;">
        </div>
        <div class="splash-loader">
            <div class="splash-loader-bar" style="--splash-duration: ${splashDuration}s;"></div>
        </div>
    </div>

    <canvas id="game-canvas"></canvas>

    <script>
${runtimeJS}
    </script>
</body>
</html>`;

            return html;
        },

        buildRuntimeEngine: function (assets, extensions, sceneDataArray, sceneNameMap, config) {
            const assetsJSON = JSON.stringify(assets);
            const extensionsJSON = JSON.stringify(extensions);
            const sceneDataArrayJSON = JSON.stringify(sceneDataArray);
            const sceneNameMapJSON = JSON.stringify(sceneNameMap);

            const runtimeCode = `
// ================================================================
//  PROBE ENGINE RUNTIME - Compiled Game
// ================================================================
(function() {
    'use strict';

    window.IS_EXPORTED_GAME = true;
    window._splashDone = false;
    window._gameReady = false;
    window._currentSceneIndex = 0;

    var EMBEDDED_ASSETS = ${assetsJSON};
    var EMBEDDED_EXTENSIONS = ${extensionsJSON};
    var EMBEDDED_SCENES = ${sceneDataArrayJSON};
    var SCENE_NAME_MAP = ${sceneNameMapJSON};
    var GAME_CONFIG = ${JSON.stringify(config)};

    function generateUUID() {
        return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    class Vector2 { constructor(x, y) { this.x = x || 0; this.y = y || 0; } add(v) { return new Vector2(this.x + v.x, this.y + v.y); } mult(s) { return new Vector2(this.x * s, this.y * s); } }
    const Mathf = { Clamp: function(v, min, max) { return Math.max(min, Math.min(max, v)); }, Lerp: function(a, b, t) { return a + (b - a) * t; }, Abs: Math.abs };
    window.Mathf = Mathf;
    window.Vector2 = Vector2;

    const Time = { time: 0, deltaTime: 0, frameCount: 0, lastTime: performance.now(), update: function(now) { var dt = (now - this.lastTime) / 1000; this.lastTime = now; this.deltaTime = Math.min(dt, 0.033); this.time += this.deltaTime; this.frameCount++; } };
    window.Time = Time;

    const Input = {
        keys: new Map(), keysDown: new Map(), keysUp: new Map(),
        mousePosition: new Vector2(0, 0), mouseButtons: new Map(), scrollDelta: 0,
        init: function() {
            var self = this;
            window.addEventListener('keydown', function(e) {
                if (!self.keys.get(e.code)) self.keysDown.set(e.code, true);
                self.keys.set(e.code, true);
            });
            window.addEventListener('keyup', function(e) { self.keys.set(e.code, false); self.keysUp.set(e.code, true); });
            window.addEventListener('mousemove', function(e) { self.mousePosition.x = e.clientX; self.mousePosition.y = e.clientY; });
            window.addEventListener('mousedown', function(e) { self.mouseButtons.set(e.button, true); });
            window.addEventListener('mouseup', function(e) { self.mouseButtons.set(e.button, false); });
            window.addEventListener('wheel', function(e) { self.scrollDelta = e.deltaY; }, { passive: true });
        },
        update: function() { this.keysDown.clear(); this.keysUp.clear(); this.scrollDelta = 0; },
        GetKey: function(code) { return !!this.keys.get(code); },
        GetKeyDown: function(code) { return !!this.keysDown.get(code); },
        GetKeyUp: function(code) { return !!this.keysUp.get(code); }
    };
    Input.init();
    window.Input = Input;

    class QuadtreeNode {
        constructor(bounds, level, maxObjects, maxLevels) {
            this.bounds = bounds; this.level = level || 0; this.maxObjects = maxObjects || 10; this.maxLevels = maxLevels || 4;
            this.objects = []; this.nodes = [];
        }
        clear() { this.objects = []; for (var i = 0; i < this.nodes.length; i++) this.nodes[i].clear(); this.nodes = []; }
        split() { var subW = this.bounds.w / 2, subH = this.bounds.h / 2, x = this.bounds.x, y = this.bounds.y; this.nodes[0] = new QuadtreeNode({x: x+subW, y: y, w: subW, h: subH}, this.level+1); this.nodes[1] = new QuadtreeNode({x: x, y: y, w: subW, h: subH}, this.level+1); this.nodes[2] = new QuadtreeNode({x: x, y: y+subH, w: subW, h: subH}, this.level+1); this.nodes[3] = new QuadtreeNode({x: x+subW, y: y+subH, w: subW, h: subH}, this.level+1); }
        getIndex(rect) { var index = -1, vMid = this.bounds.x + (this.bounds.w / 2), hMid = this.bounds.y + (this.bounds.h / 2); var tQuad = (rect.y < hMid && rect.y + rect.h < hMid), bQuad = (rect.y > hMid); if (rect.x < vMid && rect.x + rect.w < vMid) { if (tQuad) index = 1; else if (bQuad) index = 2; } else if (rect.x > vMid) { if (tQuad) index = 0; else if (bQuad) index = 3; } return index; }
        insert(obj) { if (this.nodes.length) { var idx = this.getIndex(obj.bounds); if (idx !== -1) { this.nodes[idx].insert(obj); return; } } this.objects.push(obj); if (this.objects.length > this.maxObjects && this.level < this.maxLevels) { if (!this.nodes.length) this.split(); var i = 0; while (i < this.objects.length) { var idx2 = this.getIndex(this.objects[i].bounds); if (idx2 !== -1) this.nodes[idx2].insert(this.objects.splice(i, 1)[0]); else i++; } } }
        retrieve(returnObjects, rect) { var idx = this.getIndex(rect); if (idx !== -1 && this.nodes.length) this.nodes[idx].retrieve(returnObjects, rect); else if (this.nodes.length) for (var i = 0; i < this.nodes.length; i++) this.nodes[i].retrieve(returnObjects, rect); returnObjects.push.apply(returnObjects, this.objects); return returnObjects; }
    }

    class Component { constructor(entity) { this.entity = entity; this.type = this.constructor.name; } }
    class Transform extends Component { constructor(entity) { super(entity); this.x = 0; this.y = 0; this.rotation = 0; this.scaleX = 1; this.scaleY = 1; } }
    class SpriteRenderer extends Component { constructor(entity) { super(entity); this.spriteAssetId = ''; this.color = '#ffffff'; this.width = 50; this.height = 50; } }
    class Collider2D extends Component { constructor(entity) { super(entity); this.shape = 'box'; this.width = 50; this.height = 50; this.radius = 25; this.points = "0,-25 25,25 -25,25"; this.isTrigger = false; } }
    class Rigidbody2D extends Component { constructor(entity) { super(entity); this.mass = 1; this.gravityScale = 1; this.isKinematic = false; this.velocity = { x: 0, y: 0 }; this._forces = { x: 0, y: 0 }; } AddForce(x, y, mode) { if (this.isKinematic) return; var unitScale = 100; if (mode === 'Impulse') { this.velocity.x += (x * unitScale) / this.mass; this.velocity.y += (y * unitScale) / this.mass; } else { this._forces.x += x * unitScale; this._forces.y += y * unitScale; } } }
    class ScriptRef extends Component { constructor(entity) { super(entity); this.scriptAssetId = ''; this.scriptVariables = {}; } }
    class Camera2D extends Component { constructor(entity) { super(entity); this.zoom = 1; this.orthoSize = 5; this.backgroundColor = '#000000'; } }

    const ComponentRegistry = { Transform, SpriteRenderer, Collider2D, Rigidbody2D, ScriptRef, Camera2D };

    class GameObject {
        constructor(name) { this.id = generateUUID(); this.name = name || "Entity"; this.active = true; this.parent = null; this.children = []; this.components = {}; this.scriptInstances = {}; this.AddComponent('Transform'); }
        AddComponent(type) { if (ComponentRegistry[type]) { var comp = new ComponentRegistry[type](this); var uuid = generateUUID(); comp.uuid = uuid; if (type === 'Collider2D') { var sr = this.GetComponent('SpriteRenderer'); if (sr) { comp.width = sr.width; comp.height = sr.height; comp.radius = Math.max(sr.width, sr.height) / 2; } } this.components[uuid] = comp; return comp; } return null; }
        GetComponent(type) { for (var id in this.components) if (this.components[id].type === type) return this.components[id]; return null; }
        GetComponents(type) { var res = []; for (var id in this.components) if (this.components[id].type === type) res.push(this.components[id]); return res; }
        get transform() { return this.GetComponent('Transform'); }
        getBounds() { var t = this.transform, sr = this.GetComponent('SpriteRenderer'), colliders = this.GetComponents('Collider2D'); var w = sr ? sr.width : 50; var h = sr ? sr.height : 50; if (!sr && colliders.length > 0) { w = 0; h = 0; colliders.forEach(function(c) { if (c.shape === 'circle') { w = Math.max(w, c.radius * 2); h = Math.max(h, c.radius * 2); } else { w = Math.max(w, c.width); h = Math.max(h, c.height); } }); } var aw = w * Math.abs(t.scaleX), ah = h * Math.abs(t.scaleY); return { x: t.x - aw / 2, y: t.y - ah / 2, w: aw, h: ah }; }
        toJSON() { var compData = {}; for (var k in this.components) { var c = this.components[k]; var obj = {}; for (var key in c) if (key !== 'entity') obj[key] = c[key]; compData[k] = obj; } return { id: this.id, name: this.name, parent: this.parent, children: this.children.slice(), components: compData }; }
        static fromJSON(data) { var obj = new GameObject(data.name); obj.id = data.id; obj.parent = data.parent; obj.children = data.children || []; obj.components = {}; for (var k in data.components) { var cData = data.components[k]; if (ComponentRegistry[cData.type]) { var comp = new ComponentRegistry[cData.type](obj); for (var key in cData) comp[key] = cData[key]; comp.uuid = k; obj.components[k] = comp; } } return obj; }
    }
    window.GameObject = GameObject;

    const AssetManager = { items: EMBEDDED_ASSETS, imageCache: {}, getImage: function(id) { if (!id || !this.items[id] || this.items[id].type !== 'image') return null; if (!this.imageCache[id]) { var img = new Image(); img.src = this.items[id].data; this.imageCache[id] = img; } return this.imageCache[id]; }, getChildren: function(parentId) { var result = []; for (var k in this.items) if (this.items[k].parentId === parentId) result.push(this.items[k]); return result; } };

    const SceneManager = {
        name: 'Default', entities: new Map(), rootEntities: [], quadtree: new QuadtreeNode({ x: -5000, y: -5000, w: 10000, h: 10000 }), _allSceneData: EMBEDDED_SCENES,
        clear: function() { this.entities.clear(); this.rootEntities = []; this.rebuildQuadtree(); },
        load: function(data) { this.clear(); if (data) this.name = data.name || 'Untitled'; if (data && data.entities) { var self = this; data.entities.forEach(function(edata) { var obj = GameObject.fromJSON(edata); self.entities.set(obj.id, obj); if (!obj.parent) self.rootEntities.push(obj.id); }); } this.rebuildQuadtree(); },
        loadScene: function(sceneName) { var idx = SCENE_NAME_MAP[sceneName]; if (idx === undefined) return false; var sceneData = this._allSceneData[idx]; if (!sceneData) return false; this.entities.forEach(function(e) { e.scriptInstances = {}; }); this.load(sceneData); window._currentSceneIndex = idx; return true; },
        loadSceneByIndex: function(idx) { if (idx < 0 || idx >= this._allSceneData.length) return false; var sceneData = this._allSceneData[idx]; this.entities.forEach(function(e) { e.scriptInstances = {}; }); this.load(sceneData); window._currentSceneIndex = idx; return true; },
        getSceneNames: function() { return Object.keys(SCENE_NAME_MAP); },
        addEntity: function(name, parentId) { var obj = new GameObject(name); this.entities.set(obj.id, obj); if (parentId && this.entities.has(parentId)) { obj.parent = parentId; this.entities.get(parentId).children.push(obj.id); } else { this.rootEntities.push(obj.id); } this.rebuildQuadtree(); return obj; },
        rebuildQuadtree: function() { this.quadtree.clear(); var self = this; this.entities.forEach(function(e) { if (e.active) self.quadtree.insert({ bounds: e.getBounds(), entity: e }); }); }
    };
    window.SceneManager = SceneManager;

    const GameCamera = {
        getActiveCamera: function() { var camEnt = null; SceneManager.entities.forEach(function(e) { if (e.GetComponent('Camera2D')) camEnt = e; }); return camEnt; },
        getView: function(canvasWidth, canvasHeight, targetRatio) { var camEnt = this.getActiveCamera(); var camComp = camEnt ? camEnt.GetComponent('Camera2D') : null; var cx = camEnt ? camEnt.transform.x : 0; var cy = camEnt ? camEnt.transform.y : 0; var cz = camComp ? camComp.zoom : 1; var bg = camComp ? camComp.backgroundColor : '#000000'; var canvasRatio = canvasWidth / canvasHeight; var drawW = canvasWidth, drawH = canvasHeight; if (canvasRatio > targetRatio) drawW = canvasHeight * targetRatio; else drawH = canvasWidth / targetRatio; var offsetX = (canvasWidth - drawW) / 2; var offsetY = (canvasHeight - drawH) / 2; return { cx: cx, cy: cy, cz: cz, bg: bg, drawW: drawW, drawH: drawH, offsetX: offsetX, offsetY: offsetY, viewRect: { x: cx - (drawW / 2) / cz, y: cy - (drawH / 2) / cz, w: drawW / cz, h: drawH / cz } }; }
    };

    const Renderer = {
        canvas: null, ctx: null, aspectRatio: 16/9,
        init: function() { this.canvas = document.getElementById('game-canvas'); if (!this.canvas) { this.canvas = document.createElement('canvas'); this.canvas.id = 'game-canvas'; document.body.appendChild(this.canvas); } this.ctx = this.canvas.getContext('2d'); this.resize(); var self = this; window.addEventListener('resize', function() { self.resize(); }); },
        resize: function() { if (!this.canvas) return; this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; },
        renderSprite: function(ctx, sr) { var img = AssetManager.getImage(sr.spriteAssetId); if (img) { ctx.drawImage(img, -sr.width / 2, -sr.height / 2, sr.width, sr.height); if (sr.color !== '#ffffff' && sr.color !== '#fff') { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = sr.color; ctx.globalAlpha = 0.5; ctx.fillRect(-sr.width / 2, -sr.height / 2, sr.width, sr.height); ctx.globalAlpha = 1.0; ctx.globalCompositeOperation = 'source-over'; } } else { ctx.fillStyle = sr.color || '#ff00ff'; ctx.fillRect(-sr.width / 2, -sr.height / 2, sr.width, sr.height); } },
        render: function() { if (!this.canvas || !this.ctx) return; var ctx = this.ctx; var w = this.canvas.width; var h = this.canvas.height; var view = GameCamera.getView(w, h, this.aspectRatio); ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h); ctx.save(); ctx.beginPath(); ctx.rect(view.offsetX, view.offsetY, view.drawW, view.drawH); ctx.clip(); ctx.fillStyle = view.bg; ctx.fillRect(view.offsetX, view.offsetY, view.drawW, view.drawH); ctx.translate(view.offsetX + view.drawW / 2, view.offsetY + view.drawH / 2); ctx.scale(view.cz, view.cz); ctx.translate(-view.cx, -view.cy); var visible = []; SceneManager.quadtree.retrieve(visible, view.viewRect); visible.sort(function(a, b) { return (a.entity.transform.y + (a.entity.GetComponent('SpriteRenderer') ? a.entity.GetComponent('SpriteRenderer').height / 2 : 0)) - (b.entity.transform.y + (b.entity.GetComponent('SpriteRenderer') ? b.entity.GetComponent('SpriteRenderer').height / 2 : 0)); }); var self = this; visible.forEach(function(node) { var e = node.entity; if (!e.active) return; var t = e.transform; var sr = e.GetComponent('SpriteRenderer'); if (!sr) return; ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.rotation * Math.PI / 180); ctx.scale(t.scaleX, t.scaleY); self.renderSprite(ctx, sr); ctx.restore(); }); ctx.restore(); }
    };

    const GravitySystem = { gravity: 9.8 * 100, update: function(dt) { SceneManager.entities.forEach(function(e) { if (!e.active) return; var rb = e.GetComponent('Rigidbody2D'); if (rb && !rb.isKinematic) rb.velocity.y += this.gravity * rb.gravityScale * dt; }, this); } };

    const PhysicsSystem = {
        update: function() {
            var checked = new Set(); var allEntities = []; SceneManager.entities.forEach(function(e) { if (e.active) allEntities.push(e); });
            for (var i = 0; i < allEntities.length; i++) {
                var entA = allEntities[i]; var colsA = entA.GetComponents('Collider2D'); var rbA = entA.GetComponent('Rigidbody2D'); if (colsA.length === 0) continue;
                var boundsA = entA.getBounds(); var potentialCollisions = []; SceneManager.quadtree.retrieve(potentialCollisions, boundsA);
                for (var j = 0; j < potentialCollisions.length; j++) {
                    var entB = potentialCollisions[j].entity; if (entA.id === entB.id) continue; var pairKey = entA.id < entB.id ? entA.id + '|' + entB.id : entB.id + '|' + entA.id; if (checked.has(pairKey)) continue; checked.add(pairKey);
                    var colsB = entB.GetComponents('Collider2D'); if (colsB.length === 0) continue; var rbB = entB.GetComponent('Rigidbody2D');
                    for (var ci = 0; ci < colsA.length; ci++) for (var cj = 0; cj < colsB.length; cj++) {
                        var overlap = this.checkOverlap(entA, colsA[ci], entB, colsB[cj]); if (overlap) { if (colsA[ci].isTrigger || colsB[cj].isTrigger) { this.fireTriggerEvent(entA, colsA[ci], entB, colsB[cj]); continue; } this.resolveCollision(entA, colsA[ci], rbA, entB, colsB[cj], rbB, overlap); } else this.checkTriggerExit(entA, colsA[ci], entB, colsB[cj]);
                    }
                }
            }
        }, _triggerStates: {},
        checkOverlap: function(entA, colA, entB, colB) { var bA = this.getAABB(entA, colA), bB = this.getAABB(entB, colB); if (bA.x < bB.x + bB.w && bA.x + bA.w > bB.x && bA.y < bB.y + bB.h && bA.y + bA.h > bB.y) { var overlapX = Math.min(bA.x + bA.w - bB.x, bB.x + bB.w - bA.x); var overlapY = Math.min(bA.y + bA.h - bB.y, bB.y + bB.h - bA.y); return { x: overlapX, y: overlapY, a: bA, b: bB }; } return null; },
        getAABB: function(ent, col) { var t = ent.transform, sx = Math.abs(t.scaleX), sy = Math.abs(t.scaleY); if (col.shape === 'circle') { var r = col.radius * Math.max(sx, sy); return { x: t.x - r, y: t.y - r, w: r * 2, h: r * 2 }; } else { var hw = (col.width / 2) * sx, hh = (col.height / 2) * sy; return { x: t.x - hw, y: t.y - hh, w: hw * 2, h: hh * 2 }; } },
        resolveCollision: function(entA, colA, rbA, entB, colB, rbB, overlap) { var pushAxis = overlap.x < overlap.y ? 'x' : 'y'; var pushAmount = Math.min(overlap.x, overlap.y) / 2; var totalMass = (rbA && !rbA.isKinematic ? rbA.mass : 0) + (rbB && !rbB.isKinematic ? rbB.mass : 0); if (totalMass === 0) return; var ratioA = (rbA && !rbA.isKinematic) ? (totalMass - (rbB && !rbB.isKinematic ? rbB.mass : 0)) / totalMass : 0; var ratioB = (rbB && !rbB.isKinematic) ? (totalMass - (rbA && !rbA.isKinematic ? rbA.mass : 0)) / totalMass : 0; if (pushAxis === 'x') { var signX = (entA.transform.x < entB.transform.x) ? -1 : 1; if (rbA && !rbA.isKinematic) { entA.transform.x += signX * pushAmount * ratioA; rbA.velocity.x *= -0.3; } if (rbB && !rbB.isKinematic) { entB.transform.x -= signX * pushAmount * ratioB; rbB.velocity.x *= -0.3; } } else { var signY = (entA.transform.y < entB.transform.y) ? -1 : 1; if (rbA && !rbA.isKinematic) { entA.transform.y += signY * pushAmount * ratioA; rbA.velocity.y *= -0.3; } if (rbB && !rbB.isKinematic) { entB.transform.y -= signY * pushAmount * ratioB; rbB.velocity.y *= -0.3; } } },
        fireTriggerEvent: function(entA, colA, entB, colB) { var key = entA.id + '|' + colA.uuid + '|' + entB.id + '|' + colB.uuid; if (!this._triggerStates[key]) { this._triggerStates[key] = true; this.callScriptTrigger(entA, 'onTriggerEnter', entB); this.callScriptTrigger(entB, 'onTriggerEnter', entA); } },
        checkTriggerExit: function(entA, colA, entB, colB) { var key = entA.id + '|' + colA.uuid + '|' + entB.id + '|' + colB.uuid; if (this._triggerStates[key]) { var overlap = this.checkOverlap(entA, colA, entB, colB); if (!overlap) { delete this._triggerStates[key]; this.callScriptTrigger(entA, 'onTriggerExit', entB); this.callScriptTrigger(entB, 'onTriggerExit', entA); } } },
        callScriptTrigger: function(entity, methodName, otherEntity) { if (!entity.scriptInstances) return; for (var sid in entity.scriptInstances) { var inst = entity.scriptInstances[sid]; if (inst && typeof inst[methodName] === 'function') try { inst[methodName](otherEntity); } catch(e) {} } }
    };

    const ScriptEngine = { initEntityScripts: function(entity) { if (!entity.scriptInstances) entity.scriptInstances = {}; var srefs = entity.GetComponents('ScriptRef'); var self = this; srefs.forEach(function(sref) { if (!sref.scriptAssetId) return; var asset = AssetManager.items[sref.scriptAssetId]; if (!asset || asset.type !== 'script') return; if (entity.scriptInstances[sref.scriptAssetId]) return; var scriptCode = asset.data; var className = asset.name.split('.')[0]; try { var factory = new Function('return (function() { ' + scriptCode + '; return new ' + className + '(); })();'); entity.scriptInstances[sref.scriptAssetId] = factory(); if (sref.scriptVariables) for (var vKey in sref.scriptVariables) if (entity.scriptInstances[sref.scriptAssetId].hasOwnProperty(vKey)) entity.scriptInstances[sref.scriptAssetId][vKey] = sref.scriptVariables[vKey]; if (typeof entity.scriptInstances[sref.scriptAssetId].start === 'function') entity.scriptInstances[sref.scriptAssetId].start(entity); } catch(e) { console.warn('[ScriptEngine] Error initializing script ' + asset.name + ':', e); } }); }, updateAll: function(dt) { SceneManager.entities.forEach(function(entity) { if (!entity.active) return; ScriptEngine.initEntityScripts(entity); for (var sid in entity.scriptInstances) { var inst = entity.scriptInstances[sid]; if (inst && typeof inst.update === 'function') try { inst.update(entity, dt); } catch(e) {} } }); } };

    const ExtensionsRuntime = { modules: {}, activeModules: {}, init: function() { var extData = EMBEDDED_EXTENSIONS; for (var name in extData) { var mod = extData[name]; if (typeof mod === 'string') this.modules[name] = { code: mod, active: true }; else this.modules[name] = mod; if (this.modules[name].active) this.evaluateModule(name, this.modules[name]); } }, evaluateModule: function(name, mod) { try { var code = typeof mod === 'string' ? mod : mod.code; var blob = new Blob([code], { type: 'application/javascript' }); var url = URL.createObjectURL(blob); var script = document.createElement('script'); script.src = url; script.onload = function() { URL.revokeObjectURL(url); }; document.head.appendChild(script); this.activeModules[name] = true; } catch(e) { console.warn('[Extensions] Error loading:', name, e); } }, updateAll: function(dt) { if (window.Probe && window.Probe.modules) { for (var k in window.Probe.modules) { var modDef = window.Probe.modules[k]; if (modDef && modDef.active && typeof modDef.update === 'function') SceneManager.entities.forEach(function(ent) { if (ent.active) try { modDef.update(ent, dt, window); } catch(e) {} }); } } } };
    window.Probe = window.Probe || { modules: {} };
    window.Probe.registerModule = function(name, def) { window.Probe.modules[name] = def; if (def && def.init) try { def.init(window); } catch(e) {} };

    const GameLoop = { isRunning: false, rafId: null, start: function() { if (this.isRunning) return; this.isRunning = true; var self = this; this.rafId = requestAnimationFrame(function(t) { self.tick(t); }); }, stop: function() { this.isRunning = false; if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; } }, tick: function(now) { if (!this.isRunning) return; Time.update(now); ExtensionsRuntime.updateAll(Time.deltaTime); ScriptEngine.updateAll(Time.deltaTime); GravitySystem.update(Time.deltaTime); SceneManager.entities.forEach(function(entity) { if (!entity.active) return; var rb = entity.GetComponent('Rigidbody2D'); if (rb && !rb.isKinematic) { if (rb._forces) { rb.velocity.x += (rb._forces.x / rb.mass) * Time.deltaTime; rb.velocity.y += (rb._forces.y / rb.mass) * Time.deltaTime; rb._forces.x = 0; rb._forces.y = 0; } entity.transform.x += rb.velocity.x * Time.deltaTime; entity.transform.y += rb.velocity.y * Time.deltaTime; } }); SceneManager.rebuildQuadtree(); PhysicsSystem.update(); Renderer.render(); Input.update(); var self = this; this.rafId = requestAnimationFrame(function(t) { self.tick(t); }); } };

    const SplashController = { init: function() { var overlay = document.getElementById('splash-overlay'); var companySection = document.getElementById('splash-company-section'); var companyLogoImg = document.getElementById('splash-company-logo-img'); var config = GAME_CONFIG; var probeSplashDuration = 1.8; var totalDuration = config.splashDuration || 3.0; if (config.hasCompanyLogo && config.companyLogoDataURL) { companySection.style.display = 'flex'; companyLogoImg.src = config.companyLogoDataURL; companyLogoImg.style.display = 'block'; setTimeout(function() { document.getElementById('splash-probe-section').style.display = 'none'; companySection.style.display = 'flex'; }, probeSplashDuration * 1000); setTimeout(function() { SplashController.finish(overlay); }, totalDuration * 1000); } else { companySection.style.display = 'none'; setTimeout(function() { SplashController.finish(overlay); }, Math.max(probeSplashDuration, totalDuration) * 1000); } }, finish: function(overlay) { overlay.classList.add('fade-out'); window._splashDone = true; setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 700); SplashController.startGame(); }, startGame: function() { ExtensionsRuntime.init(); if (EMBEDDED_SCENES.length > 0) { SceneManager.load(EMBEDDED_SCENES[0]); window._currentSceneIndex = 0; } Renderer.init(); Renderer.resize(); GameLoop.start(); } };

    function boot() { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else SplashController.init(); }
    boot();
})();`;

            return runtimeCode;
        },

        triggerDownload: function (filename, content, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        },

        generateLinuxInstaller: function (exportData) {
            const appName = exportData.appName || 'MyGame';
            const safeName = appName.replace(/[^a-zA-Z0-9_-]/g, '_');
            const htmlContent = this.buildStandaloneHTML(exportData); // installers work without logo (will show empty)
            const htmlBase64 = this.utf8ToBase64(htmlContent);
            const installerScript = `#!/bin/bash
set -e
APP_NAME="${appName}"
SAFE_NAME="${safeName}"
INSTALL_DIR="$HOME/.local/share/\\${SAFE_NAME}"
DESKTOP_FILE="$HOME/.local/share/applications/\\${SAFE_NAME}.desktop"
BIN_PATH="$HOME/.local/bin/\\${SAFE_NAME}"

mkdir -p "\\${INSTALL_DIR}" "$HOME/.local/share/applications" "$HOME/.local/bin"

echo "\\${SAFE_NAME}.html being written..."
echo "${htmlBase64}" | base64 -d > "\\${INSTALL_DIR}/\\${SAFE_NAME}.html"

cat > "\\${DESKTOP_FILE}" << DESKTOPEOF
[Desktop Entry]
Version=1.0
Type=Application
Name=\\${APP_NAME}
Exec=xdg-open \\${INSTALL_DIR}/\\${SAFE_NAME}.html
Terminal=false
Categories=Game;
DESKTOPEOF

cat > "\\${BIN_PATH}" << BINEOF
#!/bin/bash
xdg-open "\\${INSTALL_DIR}/\\${SAFE_NAME}.html"
BINEOF
chmod +x "\\${BIN_PATH}"

echo "✅ \\${APP_NAME} installed!"`;
            this.triggerDownload(safeName + '_install.sh', installerScript, 'application/x-sh');
        },

        generateWindowsInstaller: function (exportData) {
            const appName = exportData.appName || 'MyGame';
            const safeName = appName.replace(/[^a-zA-Z0-9_-]/g, '_');
            const installerScript = `@echo off
setlocal enabledelayedexpansion
set "APP_NAME=${appName}"
set "SAFE_NAME=${safeName}"
set "INSTALL_DIR=%USERPROFILE%\\AppData\\Local\\%SAFE_NAME%"
set "DESKTOP_DIR=%USERPROFILE%\\Desktop"
set "START_MENU_DIR=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\%SAFE_NAME%"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%START_MENU_DIR%" mkdir "%START_MENU_DIR%"

if exist "%~dp0%SAFE_NAME%.html" (
    copy /Y "%~dp0%SAFE_NAME%.html" "%INSTALL_DIR%\\%SAFE_NAME%.html"
) else (
    echo ERROR: %SAFE_NAME%.html not found alongside installer!
    pause
    exit /b 1
)

powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%DESKTOP_DIR%\\%APP_NAME%.lnk'); $SC.TargetPath = '%INSTALL_DIR%\\%SAFE_NAME%.html'; $SC.WorkingDirectory = '%INSTALL_DIR%'; $SC.Save()"
powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%START_MENU_DIR%\\%APP_NAME%.lnk'); $SC.TargetPath = '%INSTALL_DIR%\\%SAFE_NAME%.html'; $SC.WorkingDirectory = '%INSTALL_DIR%'; $SC.Save()"

echo %APP_NAME% installed successfully!`;
            this.triggerDownload(safeName + '_install.bat', installerScript, 'application/bat');
        },

        escapeHTML: function (str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
        escapeJS: function (str) { return String(str).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"'); },
        utf8ToBase64: function (str) { const bytes = new TextEncoder().encode(str); let binary = ''; bytes.forEach(function (b) { binary += String.fromCharCode(b); }); return btoa(binary); }
    };

    console.log('[ProbeCompiler] Singleton initialized and ready.');
})();
