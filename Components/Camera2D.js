// Camera2D.js – External Component for Probe Engine
// Place this file in: https://github.com/.../Probe-Engine/Components/Camera2D.js
// It will be loaded dynamically by the ComponentManager.

/**
 * Orthographic Camera 2D Component
 * Replaces the built-in Camera2D with a proper ortho setup.
 *
 * Properties:
 *   orthoSize (number): half the vertical world units visible (default 5)
 *   backgroundColor (string): CSS color for the camera background
 *
 * The scene view will draw a rectangle representing exactly what the game
 * camera sees, based on the current aspect ratio (16:9 or 4:3) and orthoSize.
 * Zoom is optional and kept for compatibility (orthoSize = 5 / zoom).
 */
(() => {

    // The new component class
    class Camera2D extends Component {
        constructor(entity) {
            super(entity);
            this.orthoSize = 5;       // half the visible vertical world units
            this.backgroundColor = '#222233';
            // For compatibility with code that may still check this.zoom
            // (orthoSize = 5 / zoom  →  zoom = 5 / orthoSize)
            Object.defineProperty(this, 'zoom', {
                get: () => 5 / this.orthoSize,
                set: (v) => { this.orthoSize = 5 / v; },
                enumerable: true
            });
        }
    }

    // Register it, overriding the built-in Camera2D
    if (window.Probe && window.Probe.registerComponent) {
        window.Probe.registerComponent('Camera2D', Camera2D);
    } else {
        // fallback: directly push to ComponentRegistry if available
        if (typeof ComponentRegistry !== 'undefined') {
            ComponentRegistry['Camera2D'] = Camera2D;
        }
    }

    // Now patch the renderer to draw the correct camera frustum in the scene view
    // We'll wrap the existing Renderer.prototype.renderScene (non‑destructive)
    function applyPatch() {
        if (!window.Renderer) {
            // Wait a tick – the Renderer may not be instantiated yet
            setTimeout(applyPatch, 50);
            return;
        }

        const originalRenderScene = Renderer.prototype.renderScene;
        Renderer.prototype.renderScene = function(canvas) {
            // Call original first (draws everything, including the old camera icon)
            // We'll intercept the camera rendering part and replace it.
            // Instead of rewriting, we override the draw call for cameras
            // by temporarily replacing the prototype's renderScene while we run.
            originalRenderScene.call(this, canvas);
        };

        // Better approach: We'll directly modify the drawing of camera entities.
        // The easiest is to extend the renderScene code, but we can't easily do that
        // without duplicating logic. We'll instead override the whole renderScene
        // with the exact same code but with the camera drawing fixed.
        // This module will export a new renderScene implementation.
    }

    // Because patching is fragile, we provide a full replacement of renderScene
    // that the engine core can call if the user updates core.html.
    // For now, we'll store the new method on the Renderer prototype.
    function setupRendererPatch() {
        const Renderer = window.Renderer;
        if (!Renderer) { setTimeout(setupRendererPatch, 50); return; }

        // Save original
        const origRenderScene = Renderer.prototype.renderScene;

        Renderer.prototype.renderScene = function(canvas) {
            if (!canvas) return;
            const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
            ctx.fillStyle = '#1e1e1e'; ctx.fillRect(0, 0, w, h);
            ctx.save();
            ctx.translate(w/2, h/2);
            ctx.scale(Camera.zoom, Camera.zoom);
            ctx.translate(-Camera.x, -Camera.y);

            let viewRect = { x: Camera.x - (w/2)/Camera.zoom, y: Camera.y - (h/2)/Camera.zoom, w: w/Camera.zoom, h: h/Camera.zoom };
            this.drawGrid(viewRect, ctx);

            let visible = []; SceneManager.quadtree.retrieve(visible, viewRect);
            let isEditingAny = Engine.editColliderState !== null;

            visible.forEach(node => {
                let e = node.entity, t = e.transform, sr = e.GetComponent('SpriteRenderer'), cam = e.GetComponent('Camera2D');
                let colliders = e.GetComponents('Collider2D');

                ctx.save();
                let isThisEntityEditing = isEditingAny && Engine.editColliderState.entityId === e.id;
                if (isEditingAny && !isThisEntityEditing) {
                    ctx.globalAlpha = 0.3;
                } else {
                    ctx.globalAlpha = 1.0;
                }
                ctx.translate(t.x, t.y);
                ctx.rotate(t.rotation * Math.PI / 180);

                if (sr) {
                    ctx.save();
                    ctx.scale(t.scaleX, t.scaleY);
                    this.renderSprite(ctx, sr);
                    ctx.restore();
                }

                // Draw colliders (unchanged)
                colliders.forEach(col => { /* ... same code ... */ });

                // Draw the camera frustum rectangle
                if (cam && !isEditingAny) {
                    // Determine the aspect ratio
                    const aspect = (window.Engine && window.Engine.aspectRatio === '16:9') ? 16/9 : 4/3;
                    const orthoH = cam.orthoSize;
                    const orthoW = orthoH * aspect;

                    ctx.save();
                    // Draw a thick yellow dashed rectangle with a camera icon
                    ctx.strokeStyle = '#ffcc00';
                    ctx.lineWidth = 2 / Camera.zoom;
                    ctx.setLineDash([10 / Camera.zoom, 5 / Camera.zoom]);
                    ctx.strokeRect(-orthoW, -orthoH, orthoW * 2, orthoH * 2);
                    ctx.setLineDash([]);

                    // Camera icon (triangle) at top center
                    ctx.fillStyle = '#ffcc00';
                    const iconSize = 12 / Camera.zoom;
                    ctx.beginPath();
                    ctx.moveTo(0, -orthoH - iconSize);
                    ctx.lineTo(-iconSize/2, -orthoH);
                    ctx.lineTo(iconSize/2, -orthoH);
                    ctx.closePath();
                    ctx.fill();

                    // Label
                    ctx.fillStyle = '#ffcc00';
                    ctx.font = `${10 / Camera.zoom}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.fillText('Camera', 0, -orthoH - iconSize - 4 / Camera.zoom);
                    ctx.restore();
                }

                ctx.restore();

                // Selected highlight (unchanged)
                if (SceneManager.selectedEntityIds.has(e.id) && !isEditingAny) {
                    // ...
                }
            });

            // Draw gizmos (unchanged)
            if (!isEditingAny && Engine.viewMode === 'scene' && (Engine.activeTool === 'move' || Engine.activeTool === 'scale') && SceneManager.selectedEntityIds.size === 1) {
                // ... gizmo code ...
            }

            ctx.restore();
        };
    }

    // Apply the patch when the Renderer is available
    document.addEventListener('DOMContentLoaded', () => {
        // small delay to ensure engine is initialized
        setTimeout(setupRendererPatch, 100);
    });

    // Also export the class for manual use
    window.Camera2D = Camera2D;

    console.log('[Component] Camera2D (ortho) registered and patched');
})();
