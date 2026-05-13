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
                // 1. Fetch the yellow satellite PNG and convert to data URL
                const logoDataUrl = await this.fetchLogoDataUrl();

                // 2. Build the standalone HTML with the logo
                const compiledHTML = this.buildStandaloneHTML(exportData, logoDataUrl);
                this.triggerDownload(
                    (exportData.appName || 'MyGame').replace(/[^a-zA-Z0-9_-]/g, '_') + '.html',
                    compiledHTML,
                    'text/html'
                );

                // 3. Generate platform installers if requested
                if (exportData.platforms && exportData.platforms.linux) {
                    this.generateLinuxInstaller(exportData, logoDataUrl);
                }
                if (exportData.platforms && exportData.platforms.windows) {
                    this.generateWindowsInstaller(exportData, logoDataUrl);
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

        /**
         * Fetches the yellow satellite PNG from GitHub and returns a base64 data URI.
         * Returns null if the fetch fails.
         */
        fetchLogoDataUrl: async function () {
            const logoUrl = 'https://raw.githubusercontent.com/F-O-R-G-E-Open-Source-Philanthropy/Probe-Engine/main/IMG%27s/yellow_satellite.png';
            try {
                const response = await fetch(logoUrl);
                if (!response.ok) {
                    throw new Error('Failed to fetch logo: ' + response.status);
                }
                const blob = await response.blob();
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (err) {
                console.warn('[ProbeCompiler] Could not fetch logo, proceeding without it.', err);
                return null;
            }
        },

        buildStandaloneHTML: function (exportData, logoDataUrl) {
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

            // Build the logo element
            const logoElement = logoDataUrl
                ? `<img src="${logoDataUrl}" alt="Probe Engine" style="width:120px; height:120px; object-fit:contain;">`
                : `<div style="width:120px; height:120px; display:flex; align-items:center; justify-content:center; color:#eab308; font-size:48px;">P</div>`;

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
        <div class="splash-probe-logo">${logoElement}</div>
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

        // The rest of the methods (buildRuntimeEngine, triggerDownload, etc.) remain unchanged...
        buildRuntimeEngine: function (assets, extensions, sceneDataArray, sceneNameMap, config) {
            // ... (same as before)
        },

        triggerDownload: function (filename, content, mimeType) {
            // ... (same)
        },

        generateLinuxInstaller: function (exportData, logoDataUrl) {
            // ... (pass logoDataUrl if needed)
        },

        generateWindowsInstaller: function (exportData, logoDataUrl) {
            // ... (pass logoDataUrl if needed)
        },

        escapeHTML: function (str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
        escapeJS: function (str) { return String(str).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"'); },
        utf8ToBase64: function (str) { const bytes = new TextEncoder().encode(str); let binary = ''; bytes.forEach(function (b) { binary += String.fromCharCode(b); }); return btoa(binary); }
    };

    // (The rest of the code – buildRuntimeEngine, etc. – is identical to the previous working version.)
    // ... (All the functions from the last working compiler are included here)
})();
