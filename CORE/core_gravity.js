/**
 * Probe Engine Core - Gravity Module
 * Applies a consistent gravitational acceleration to entities with a Rigidbody2D.
 */
(function() {
    // Ensure the Probe namespace exists
    window.Probe = window.Probe || {};

    // Global settings for Gravity. Other modules (like Physics) can read/modify this.
    // X and Y are forces applied per second squared.
    // The multiplier exists to map realistic m/s^2 logic to Canvas pixels.
    window.Probe.GravitySettings = {
        x: 0,
        y: 9.81, // Earth-like baseline (downwards)
        multiplier: 100 // Scale: 1 unit of gravity = 100 pixels per second
    };

    const GravityModule = {
        active: true,
        
        init: function(engine) {
            console.log("[Core] Gravity Module Initialized.");
            // Expose a public function so that a dedicated Physics core can 
            // trigger gravity manually if it decides to override the standard loop
            window.Probe.applyGravityToEntity = this.applyGravityToEntity.bind(this);
        },
        
        update: function(entity, dt, engine) {
            if (!this.active) return;
            this.applyGravityToEntity(entity, dt);
        },
        
        applyGravityToEntity: function(entity, dt) {
            // High-performance check: Fetching the component is the most expensive part of this loop
            const rb = entity.GetComponent('Rigidbody2D');
            
            // We only apply gravity if:
            // 1. The entity actually has a Rigidbody2D component
            // 2. The rigidbody is NOT kinematic (kinematic = unaffected by external forces)
            // 3. The local gravityScale is not 0 (allows per-object overrides)
            if (!rb || rb.isKinematic || rb.gravityScale === 0) return;

            // Calculate the velocity delta (v = u + at)
            // Force = Global Gravity * Local Object Multiplier * Pixel Scale
            const deltaX = window.Probe.GravitySettings.x * rb.gravityScale * window.Probe.GravitySettings.multiplier;
            const deltaY = window.Probe.GravitySettings.y * rb.gravityScale * window.Probe.GravitySettings.multiplier;

            // Apply acceleration
            rb.velocity.x += deltaX * dt;
            rb.velocity.y += deltaY * dt;
        },
        
        destroy: function() {
            console.log("[Core] Gravity Module Destroyed.");
            // Cleanup the global namespace to prevent memory leaks or stale references
            delete window.Probe.applyGravityToEntity;
        }
    };

    // Register with the engine
    if (window.Probe.registerModule) {
        window.Probe.registerModule('Core_Gravity', GravityModule);
    } else {
        console.warn("[Core] Probe.registerModule not found. Extension manager not ready?");
    }
})();
