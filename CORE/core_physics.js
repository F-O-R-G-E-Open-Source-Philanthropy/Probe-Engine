/**
 * @name Core Physics Engine
 * @version 1.0.0
 * @developer Forge™
 * @description Advanced 2D Physics module. Features Quadtree broadphase optimization, AABB narrowphase intersection testing, Impulse-based collision resolution (position & velocity correction), Trigger events, and a GC-optimized, zero-allocation pipeline.
 */
(function() {
    const MODULE_ID = 'core_physics_engine';

    // ----------------------------------------------------------------------
    // GC-Optimized Shared Memory
    // These are reused every frame to prevent garbage collector stutter.
    // ----------------------------------------------------------------------
    const _manifold = { 
        normal: { x: 0, y: 0 }, 
        penetration: 0 
    };
    const _queryRect = { x: 0, y: 0, w: 0, h: 0 };
    const _results = []; 

    const PhysicsModule = {
        active: true,
        
        init: function(engine) {
            console.log(`[Core] Physics Engine v1.0.0 Initialized.`);
        },
        
        update: function(entity, dt, engine) {
            if (!this.active) return;
            
            const colA = entity.GetComponent('Collider2D');
            if (!colA) return; // Only process entities with colliders
            
            const rbA = entity.GetComponent('Rigidbody2D');
            
            // ----------------------------------------------------------------------
            // 1. BROADPHASE: Quadtree filtering
            // ----------------------------------------------------------------------
            let bA = entity.getBounds();
            
            // Pad the query rectangle slightly to catch high-velocity impending collisions
            _queryRect.x = bA.x - 5;
            _queryRect.y = bA.y - 5;
            _queryRect.w = bA.w + 10;
            _queryRect.h = bA.h + 10;
            
            _results.length = 0; // Clear array without de-allocating memory
            if (window.SceneManager && window.SceneManager.quadtree) {
                window.SceneManager.quadtree.retrieve(_results, _queryRect);
            }
            
            // ----------------------------------------------------------------------
            // 2. NARROWPHASE: Precise Intersection & Resolution
            // ----------------------------------------------------------------------
            for (let i = 0; i < _results.length; i++) {
                let other = _results[i].entity;
                
                // Enforce ID ordering to completely bypass duplicate A-vs-B and B-vs-A checks
                if (entity.id >= other.id) continue;
                
                const colB = other.GetComponent('Collider2D');
                if (!colB) continue;
                
                const rbB = other.GetComponent('Rigidbody2D');
                
                // If neither has a Rigidbody, they are both static. Skip static-vs-static.
                if (!rbA && !rbB) continue; 
                
                let bB = other.getBounds();
                
                // Perform precise Axis-Aligned Bounding Box (AABB) intersection check
                if (this.checkAABB(bA, bB, _manifold)) {
                    
                    // --- TRIGGER HANDLING ---
                    if (colA.isTrigger || colB.isTrigger) {
                        this.fireTriggerEvents(entity, other);
                    } 
                    // --- PHYSICS HANDLING ---
                    else {
                        this.resolveCollision(entity, rbA, other, rbB, _manifold);
                        this.fireCollisionEvents(entity, other);
                    }
                }
            }
        },
        
        /**
         * Calculates intersection depth and collision normal using Minkowski difference.
         */
        checkAABB: function(a, b, manifold) {
            // Calculate centers
            let cxA = a.x + a.w / 2;
            let cyA = a.y + a.h / 2;
            let cxB = b.x + b.w / 2;
            let cyB = b.y + b.h / 2;
            
            // Distance between centers
            let dx = cxB - cxA;
            let dy = cyB - cyA;
            
            // Calculate overlap on x and y axes
            let overlapX = (a.w / 2 + b.w / 2) - Math.abs(dx);
            if (overlapX <= 0) return false;
            
            let overlapY = (a.h / 2 + b.h / 2) - Math.abs(dy);
            if (overlapY <= 0) return false;
            
            // The collision normal is the axis of least penetration
            if (overlapX < overlapY) {
                manifold.penetration = overlapX;
                manifold.normal.x = dx < 0 ? -1 : 1;
                manifold.normal.y = 0;
            } else {
                manifold.penetration = overlapY;
                manifold.normal.x = 0;
                manifold.normal.y = dy < 0 ? -1 : 1;
            }
            
            return true;
        },
        
        /**
         * Corrects positions to prevent object sinking and applies velocity impulses.
         */
        resolveCollision: function(entA, rbA, entB, rbB, manifold) {
            // Determine inverse masses (0 if kinematic or static)
            let invMassA = (rbA && !rbA.isKinematic) ? (1 / (rbA.mass || 1)) : 0;
            let invMassB = (rbB && !rbB.isKinematic) ? (1 / (rbB.mass || 1)) : 0;
            let sumMass = invMassA + invMassB;
            
            if (sumMass === 0) return; // Both objects are immovable
            
            // --- POSITIONAL CORRECTION ---
            // Resolves floating-point sinking over time.
            const percent = 0.8; // Correct 80% of penetration to prevent jitter
            const slop = 0.05;   // Allow 0.05 units of penetration before correcting
            
            let correctionMag = Math.max(manifold.penetration - slop, 0) / sumMass * percent;
            let corrX = manifold.normal.x * correctionMag;
            let corrY = manifold.normal.y * correctionMag;
            
            if (invMassA > 0) {
                entA.transform.x -= corrX * invMassA;
                entA.transform.y -= corrY * invMassA;
            }
            if (invMassB > 0) {
                entB.transform.x += corrX * invMassB;
                entB.transform.y += corrY * invMassB;
            }
            
            // --- VELOCITY IMPULSE ---
            let vxA = rbA ? rbA.velocity.x : 0;
            let vyA = rbA ? rbA.velocity.y : 0;
            let vxB = rbB ? rbB.velocity.x : 0;
            let vyB = rbB ? rbB.velocity.y : 0;
            
            // Relative velocity
            let rvx = vxB - vxA;
            let rvy = vyB - vyA;
            
            // Velocity along the collision normal
            let velAlongNormal = rvx * manifold.normal.x + rvy * manifold.normal.y;
            
            // If objects are already separating, do nothing
            if (velAlongNormal > 0) return;
            
            // Calculate restitution (bounciness). Hardcoded to 0.0 (no bounce) for typical solid ground.
            let restitution = 0.0; 
            
            // Calculate impulse scalar
            let j = -(1 + restitution) * velAlongNormal;
            j /= sumMass;
            
            // Apply impulse vector
            let impulseX = manifold.normal.x * j;
            let impulseY = manifold.normal.y * j;
            
            if (invMassA > 0) {
                rbA.velocity.x -= impulseX * invMassA;
                rbA.velocity.y -= impulseY * invMassA;
            }
            if (invMassB > 0) {
                rbB.velocity.x += impulseX * invMassB;
                rbB.velocity.y += impulseY * invMassB;
            }
        },
        
        fireTriggerEvents: function(entA, entB) {
            this._invokeMethod(entA, 'OnTriggerEnter2D', entB);
            this._invokeMethod(entB, 'OnTriggerEnter2D', entA);
        },
        
        fireCollisionEvents: function(entA, entB) {
            this._invokeMethod(entA, 'OnCollisionEnter2D', entB);
            this._invokeMethod(entB, 'OnCollisionEnter2D', entA);
        },
        
        _invokeMethod: function(entity, methodName, otherEntity) {
            if (!entity.scriptInstances) return;
            
            for (let sId in entity.scriptInstances) {
                let inst = entity.scriptInstances[sId];
                if (inst && typeof inst[methodName] === 'function') {
                    try {
                        inst[methodName](otherEntity);
                    } catch(e) { 
                        console.error(`[Physics] Error in ${methodName} on ${entity.name}:`, e); 
                    }
                }
            }
        },
        
        destroy: function() {
            console.log(`[Core] Physics Engine Destroyed.`);
        }
    };

    // Register with Probe Extension Manager
    if (window.Probe && window.Probe.registerModule) {
        window.Probe.registerModule('Core_Physics', PhysicsModule);
    } else {
        console.warn(`[${MODULE_ID}] Engine Core not ready to accept modules.`);
    }

})();
