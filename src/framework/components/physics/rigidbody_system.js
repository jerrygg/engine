pc.extend(pc.fw, function () {
    // Shared math variable to avoid excessive allocation
    var transform = pc.math.mat4.create();
    var newWtm = pc.math.mat4.create();

    var position = pc.math.vec3.create();
    var rotation = pc.math.vec3.create();
    var scale = pc.math.vec3.create();

    var ammoRayStart, ammoRayEnd;

    var collisions = {};
    var frameCollisions = {};

    /**
    * @name pc.fw.RaycastResult
    * @class Object holding the result of a successful raycast hit
    * @constructor Create a new RaycastResul
    * @param {pc.fw.Entity} entity The entity that was hit
    * @param {pc.math.vec3} point The point at which the ray hit the entity in world space
    * @param {pc.math.vec3} normal The normal vector of the surface where the ray hit in world space.
    * @property {pc.fw.Entity} entity The entity that was hit
    * @property {pc.math.vec3} point The point at which the ray hit the entity in world space
    * @property {pc.math.vec3} normal The normal vector of the surface where the ray hit in world space.
    */
    var RaycastResult = function (entity, point, normal) {
        this.entity = entity;
        this.point = point;
        this.normal = normal;
    };

    /**
    * @name pc.fw.SingleContactResult
    * @class Object holding the result of a contact between two rigid bodies
    * @constructor Create a new SingleContactResult
    * @param {pc.fw.Entity} a The first entity involved in the contact
    * @param {pc.fw.Entity} b The second entity involved in the contact
    * @param {pc.fw.ContactPoint} contactPoint The contact point between the two entities
    * @property {pc.fw.Entity} a The first entity involved in the contact
    * @property {pc.fw.Entity} b The second entity involved in the contact
    * @property {pc.math.vec3} localPointA The point on Entity A where the contact occured, relative to A
    * @property {pc.math.vec3} localPointB The point on Entity B where the contact occured, relative to B
    * @property {pc.math.vec3} pointA The point on Entity A where the contact occured, in world space
    * @property {pc.math.vec3} pointB The point on Entity B where the contact occured, in world space
    * @property {pc.math.vec3} normal The normal vector of the contact on Entity B, in world space
    */
    var SingleContactResult = function (a, b, contactPoint) {
        this.a = a;
        this.b = b;
        this.localPointA = contactPoint.localPoint;
        this.localPointB = contactPoint.localPointOther;
        this.pointA = contactPoint.point;
        this.pointB = contactPoint.pointOther;
        this.normal = contactPoint.normal;
    };

    /**
    * @name pc.fw.ContactPoint
    * @class Object holding the result of a contact between a rigid body and a collider
    * @constructor Create a new ContactPoint
    * @param {pc.math.vec3} localPoint The point on the collider where the contact occured, relative to the collider
    * @param {pc.math.vec3} localPointOther The point on the other entity where the contact occured, relative to the other entity
    * @param {pc.math.vec3} point The point on the collider where the contact occured, in world space
    * @param {pc.math.vec3} pointOther The point on the other entity where the contact occured, in world space
    * @param {pc.math.vec3} normal The normal vector of the contact on the other entity, in world space
    * @property {pc.math.vec3} localPoint The point on the collider where the contact occured, relative to the collider
    * @property {pc.math.vec3} localPointOther The point on the other entity where the contact occured, relative to the other entity
    * @property {pc.math.vec3} point The point on the collider where the contact occured, in world space
    * @property {pc.math.vec3} pointOther The point on the other entity where the contact occured, in world space
    * @property {pc.math.vec3} normal The normal vector of the contact on the other entity, in world space
    */
    var ContactPoint = function (localPoint, localPointOther, point, pointOther, normal) {
        this.localPoint = localPoint;
        this.localPointOther = localPointOther;
        this.point = point;
        this.pointOther = pointOther;
        this.normal = normal;
    }

    /**
    * @name pc.fw.ContactResult
    * @class Object holding the result of a contact between a rigid body and a collider
    * @constructor Create a new ContactResult
    * @param {pc.fw.Entity} other The entity that was involved in the contact with this collider    
    * @param {pc.fw.ContactPoint[]} contacts An array of ContactPoints with the other rigid body
    * @property {pc.fw.Entity} other The entity that was involved in the contact with this collider    
    * @property {pc.fw.ContactPoint[]} contacts An array of ContactPoints with the other rigid body
    */
    var ContactResult = function(other, contacts) {
        this.other = other;
        this.contacts = contacts;
    }

    // Events Documentation   
    /**
    * @event
    * @name pc.fw.RigidBodyComponentSystem#contact
    * @description Fired when a contact occurs between two rigid bodies
    * @param {pc.fw.SingleContactResult} result Details of the contact between the two bodies
    */

    /**
     * @name pc.fw.RigidBodyComponentSystem
     * @constructor Create a new RigidBodyComponentSystem
     * @class The RigidBodyComponentSystem maintains the dynamics world for simulating rigid bodies, it also controls global values for the world such as gravity.
     * Note: The RigidBodyComponentSystem is only valid if 3D Physics is enabled in your application. You can enable this in the application settings for your Depot.
     * @param {pc.fw.ApplicationContext} context The ApplicationContext
     * @extends pc.fw.ComponentSystem
     */
    var RigidBodyComponentSystem = function RigidBodyComponentSystem (context) {
        this.id = 'rigidbody';
        this.description = "Adds the entity to the scene's physical simulation.";
        context.systems.add(this.id, this);
        
        this.ComponentType = pc.fw.RigidBodyComponent;
        this.DataType = pc.fw.RigidBodyComponentData;

        this.schema = [{
            name: "mass",
            displayName: "Mass",
            description: "The mass of the body",
            type: "number",
            options: {
                min: 0,
                step: 1
            },
            defaultValue: 1
        }, {
            name: "linearDamping",
            displayName: "Linear Damping",
            description: "The linear damping applied to the body",
            type: "number",
            options: {
                min: 0,
                step: 1
            },
            defaultValue: 0
        }, {
            name: "angularDamping",
            displayName: "Angular Damping",
            description: "The angular damping applied to the body",
            type: "number",
            options: {
                min: 0,
                step: 1
            },
            defaultValue: 0
        }, {
            name: "linearFactor",
            displayName: "Linear Factor",
            description: "The linear factor applied to the linear motion of the body, used to contrain linear movement in each axis",
            type: "vector",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: [1, 1, 1]
        }, {
            name: "angularFactor",
            displayName: "Angular Factor",
            description: "The angular factor applied to the angular motion of the body, used to contrain angular movement in each axis",
            type: "vector",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: [1, 1, 1]
        }, {
            name: "friction",
            displayName: "Friction",
            description: "The friction when the body slides along another body",
            type: "number",
            options: {
                min: 0,
                step: 0.01
            },
            defaultValue: 0.5
        }, {
            name: "restitution",
            displayName: "Restitution",
            description: "The restitution determines the elasticity of collisions. 0 means an object doesn't bounce at all, a value of 1 will be a perfect reflection",
            type: "number",
            options: {
                min: 0,
                step: 0.01
            },
            defaultValue: 0
        }, {
            name: "bodyType",
            displayName: "Body Type",
            description: "The type of body determines how it moves and collides with other bodies. Dynamic is a normal body. Static will never move. Kinematic can be moved in code, but will not respond to collisions.",
            type: "enumeration",
            options: {
                enumerations: [{
                    name: 'Static',
                    value: pc.fw.RIGIDBODY_TYPE_STATIC
                }, {
                    name: 'Dynamic',
                    value: pc.fw.RIGIDBODY_TYPE_DYNAMIC
                }, {
                    name: 'Kinematic',
                    value: pc.fw.RIGIDBODY_TYPE_KINEMATIC
                }]
            },
            defaultValue: pc.fw.RIGIDBODY_TYPE_STATIC
        }, {
            name: "body",
            exposed: false
        }];

        this.exposeProperties();

        this.maxSubSteps = 10;
        this.fixedTimeStep = 1/60;
        
        // Create the Ammo physics world
        if (typeof(Ammo) !== 'undefined') {
            var collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
            var dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
            var overlappingPairCache = new Ammo.btDbvtBroadphase();
            var solver = new Ammo.btSequentialImpulseConstraintSolver();
            this.dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);

            this._ammoGravity = new Ammo.btVector3(0, -9.82, 0);
            this.dynamicsWorld.setGravity(this._ammoGravity);
            
            // Only bind 'update' if Ammo is loaded
            pc.fw.ComponentSystem.on('update', this.onUpdate, this);

            // Lazily create temp vars
            ammoRayStart = new Ammo.btVector3();
            ammoRayEnd = new Ammo.btVector3();
        }

        this.on('remove', this.onRemove, this);
    };
    RigidBodyComponentSystem = pc.inherits(RigidBodyComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(RigidBodyComponentSystem.prototype, {

        initializeComponentData: function (component, data, properties) {
            properties = ['mass', 'linearDamping', 'angularDamping', 'linearFactor', 'angularFactor', 'friction', 'restitution', 'bodyType'];
            RigidBodyComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            component.createBody();
        },

        onRemove: function (entity, data) {
            if (data.body) {
                this.removeBody(data.body);    
                Ammo.destroy(data.body);
            }
            
            data.body = null;
        },

        addBody: function (body) {
            this.dynamicsWorld.addRigidBody(body);
            return body;
        },

        removeBody: function (body) {
            this.dynamicsWorld.removeRigidBody(body);
        },

        addConstraint: function (constraint) {
            this.dynamicsWorld.addConstraint(constraint);
            return constraint;
        },

        removeConstraint: function (constraint) {
            this.dynamicsWorld.removeConstraint(constraint);
        },

        /**
        * @function
        * @name pc.fw.RigidBodyComponentSystem#setGravity
        * @description Set the gravity vector for the 3D physics world
        * @param {Number} x The x-component of the gravity vector
        * @param {Number} y The y-component of the gravity vector
        * @param {Number} z The z-component of the gravity vector
        */
        /**
        * @function
        * @name pc.fw.RigidBodyComponentSystem#setGravity^2
        * @description Set the gravity vector for the 3D physics world
        * @param {pc.math.vec3} gravity The gravity vector to use for the 3D physics world.
        */
        setGravity: function () {
            if (arguments.length === 3) {
                this._ammoGravity.setValue(arguments[0], arguments[1], arguments[2]);
            } else {
                this._ammoGravity.setValue(arguments[0][0], arguments[0][1], arguments[0][2])
            }
            this.dynamicsWorld.setGravity(this._ammoGravity);
        },

        /**
        * @function
        * @name pc.fw.RigidBodyComponentSystem#raycastFirst
        * @description Raycast the world and return the first entity the ray hits. Fire a ray into the world from start to end, 
        * if the ray hits an entity with a rigidbody component, the callback function is called along with a {@link pc.fw.RaycastResult}.
        * @param {pc.math.vec3} start The world space point where the ray starts
        * @param {pc.math.vec3} end The world space point where the ray ends
        * @param {Function} callback Function called if ray hits another body. Passed a single argument: a {@link pc.fw.RaycastResult} object
        */
        raycastFirst: function (start, end, callback) {
            ammoRayStart.setValue(start[0], start[1], start[2]);
            ammoRayEnd.setValue(end[0], end[1], end[2]);
            var rayCallback = new Ammo.ClosestRayResultCallback(ammoRayStart, ammoRayEnd);

            this.dynamicsWorld.rayTest(ammoRayStart, ammoRayEnd, rayCallback);
            if (rayCallback.hasHit()) {
                var collisionObjPtr = rayCallback.get_m_collisionObject();
                var collisionObj = Ammo.wrapPointer(collisionObjPtr, Ammo.btCollisionObject);
                var body = btRigidBody.prototype.upcast(collisionObj);
                var point = rayCallback.get_m_hitPointWorld();
                var normal = rayCallback.get_m_hitNormalWorld();

                if (body) {
                    callback(new RaycastResult(
                                    body.entity, 
                                    pc.math.vec3.create(point.x(), point.y(), point.z()),
                                    pc.math.vec3.create(normal.x(), normal.y(), normal.z())
                                )
                            );
                }
            }

            Ammo.destroy(rayCallback);
        },

        /**
        * @private
        * @function
        * @name pc.fw.RigidBodyComponentSystem#_storeCollision
        * @description Stores a collision between the entity and other in the contacts map and returns true if it is a new collision
        * if the ray hits an entity with a rigidbody component, the callback function is called along with a {@link pc.fw.RaycastResult}.
        * @param {pc.fw.Entity} entity The entity 
        * @param {pc.fw.Entity} other The entity that collides with the first entity
        */
        _storeCollision: function (entity, other) {   
            var isNewCollision = false;
            var guid = entity.getGuid();

            collisions[guid] = collisions[guid] || {others: [], entity: entity};

            if (collisions[guid].others.indexOf(other) < 0) {
                collisions[guid].others.push(other);
                isNewCollision = true;
            }
            
            frameCollisions[guid] = frameCollisions[guid] || {others: [], entity: entity};
            frameCollisions[guid].others.push(other);
            
            return isNewCollision;
        },

        /**
        * @private
        * @function
        * @name pc.fw.RigidBodyComponentSystem#_handleEntityCollision
        * @description Fires a contact event if there is a collison between the two entities and a collisionstart event
        * if it is a new coliision
        * @param {pc.fw.Entity} entity The entity 
        * @param {pc.fw.Entity} other The entity that collides with the first entity
        * @param {pc.fw.ContactPoint[]} contactPoints An array of contacts points between the two entities
        */
        _handleEntityCollision: function (entity, other, contactPoints) {
            var result = new ContactResult(other, contactPoints);
            if (entity.collider.hasEvent(pc.fw.EVENT_CONTACT)) {
                entity.collider.fire(pc.fw.EVENT_CONTACT, result);
            }

            if (entity.collider.hasEvent(pc.fw.EVENT_COLLISIONSTART)) {
                if (this._storeCollision(entity, other)) {
                    entity.collider.fire(pc.fw.EVENT_COLLISIONSTART, result);
                }
            }
        },

        _createContactPointFromAmmo: function (contactPoint) {
            var localPointA = pc.math.vec3.create(contactPoint.get_m_localPointA().x(), contactPoint.get_m_localPointA().y(), contactPoint.get_m_localPointA().z());
            var localPointB = pc.math.vec3.create(contactPoint.get_m_localPointB().x(), contactPoint.get_m_localPointB().y(), contactPoint.get_m_localPointB().z());
            var pointA = pc.math.vec3.create(contactPoint.getPositionWorldOnA().x(), contactPoint.getPositionWorldOnA().y(), contactPoint.getPositionWorldOnA().z());
            var pointB = pc.math.vec3.create(contactPoint.getPositionWorldOnB().x(), contactPoint.getPositionWorldOnB().y(), contactPoint.getPositionWorldOnB().z());
            var normal = pc.math.vec3.create(contactPoint.get_m_normalWorldOnB().x(), contactPoint.get_m_normalWorldOnB().y(), contactPoint.get_m_normalWorldOnB().z());
            return new ContactPoint(localPointA, localPointB, pointA, pointB, normal);
        },

        _createReverseContactPointFromAmmo: function (contactPoint) {
            var localPointA = pc.math.vec3.create(contactPoint.get_m_localPointA().x(), contactPoint.get_m_localPointA().y(), contactPoint.get_m_localPointA().z());
            var localPointB = pc.math.vec3.create(contactPoint.get_m_localPointB().x(), contactPoint.get_m_localPointB().y(), contactPoint.get_m_localPointB().z());
            var pointA = pc.math.vec3.create(contactPoint.getPositionWorldOnA().x(), contactPoint.getPositionWorldOnA().y(), contactPoint.getPositionWorldOnA().z());
            var pointB = pc.math.vec3.create(contactPoint.getPositionWorldOnB().x(), contactPoint.getPositionWorldOnB().y(), contactPoint.getPositionWorldOnB().z());
            var normal = pc.math.vec3.create(-contactPoint.get_m_normalWorldOnB().x(), -contactPoint.get_m_normalWorldOnB().y(), -contactPoint.get_m_normalWorldOnB().z());
            return new ContactPoint(localPointB, localPointA, pointB, pointA, normal);
        },

        /**
        * @private
        * @function
        * @name pc.fw.RigidBodyComponentSystem#_cleanOldCollisions
        * @description Removes collisions that no longer exist from the collisions list and fires collisionend events to the
        * related entities.
        */
        _cleanOldCollisions: function () {
            for (var guid in collisions) {
                if (collisions.hasOwnProperty(guid)) {
                    var entity = collisions[guid].entity;
                    var others = collisions[guid].others;
                    var length = others.length;
                    var i=length;
                    while (i--) {
                        var other = others[i];
                        // if the contact does not exist in the current frame collisions then fire event
                        if (!frameCollisions[guid] || frameCollisions[guid].others.indexOf(other) < 0) {
                            others.splice(i, 1);
                            if (entity.collider.hasEvent(pc.fw.EVENT_COLLISIONEND)) {
                                entity.collider.fire(pc.fw.EVENT_COLLISIONEND, other);
                            }
                        }
                    }  

                    if (others.length === 0) {
                        delete collisions[guid];
                    }          
                }
            } 
        },

        /**
        * @private
        * @name pc.fw.RigidBodyComponentSystem#raycast
        * @description Raycast the world and return all entities the ray hits. Fire a ray into the world from start to end, 
        * if the ray hits an entity with a rigidbody component, the callback function is called along with a {@link pc.fw.RaycastResult}.
        * @param {pc.math.vec3} start The world space point where the ray starts
        * @param {pc.math.vec3} end The world space point where the ray ends
        * @param {Function} callback Function called if ray hits another body. Passed a single argument: a {@link pc.fw.RaycastResult} object
        */
        // raycast: function (start, end, callback) {
        //     var rayFrom = new Ammo.btVector3(start[0], start[1], start[2]);
        //     var rayTo = new Ammo.btVector3(end[0], end[1], end[2]);
        //     var rayCallback = new Ammo.AllHitsRayResultCallback(rayFrom, rayTo);

        //     this.dynamicsWorld.rayTest(rayFrom, rayTo, rayCallback);
        //     if (rayCallback.hasHit()) {
        //         var body = Module.castObject(rayCallback.get_m_collisionObject(), Ammo.btRigidBody);
        //         var point = rayCallback.get_m_hitPointWorld();
        //         var normal = rayCallback.get_m_hitNormalWorld();

        //         if (body) {
        //             callback(new RaycastResult(
        //                             body.entity, 
        //                             pc.math.vec3.create(point.x(), point.y(), point.z()),
        //                             pc.math.vec3.create(normal.x(), normal.y(), normal.z())
        //                         )
        //                     );
        //         }
        //     }

        //     Ammo.destroy(rayFrom);
        //     Ammo.destroy(rayTo);
        //     Ammo.destroy(rayCallback);
        // },

        onUpdate: function (dt) {
            // Update the transforms of all bodies
            this.dynamicsWorld.stepSimulation(dt, this.maxSubSteps, this.fixedTimeStep);

            // Update the transforms of all entities referencing a body
            var components = this.store;
            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    var componentData = components[id].data;
                    if (componentData.body && componentData.body.isActive()) {
                        if (componentData.bodyType === pc.fw.RIGIDBODY_TYPE_DYNAMIC) {
                            entity.rigidbody.syncBodyToEntity();
                        } else if (componentData.bodyType === pc.fw.RIGIDBODY_TYPE_KINEMATIC) {
                            entity.rigidbody.updateKinematic(dt);
                        }
                    }

                }
            }

            // Check for collisions and fire callbacks
            var dispatcher = this.dynamicsWorld.getDispatcher();
            var numManifolds = dispatcher.getNumManifolds();
            var i, j;
            var hasContactEvt = this.hasEvent(pc.fw.EVENT_CONTACT);
            
            frameCollisions = {};

            // loop through the all contacts and fire events
            for (i = 0; i < numManifolds; i++) {
                var manifold = dispatcher.getManifoldByIndexInternal(i);
                var body0 = manifold.getBody0();
                var body1 = manifold.getBody1();
                var wb0 = btRigidBody.prototype['upcast'](body0);
                var wb1 = btRigidBody.prototype['upcast'](body1);
                var e0 = wb0.entity;
                var e1 = wb1.entity;

                // dont fire events between triggers
                if (!e0.rigidbody && !e1.rigidbody) {
                    continue;
                }

                // dont fire events between static rigid bodies
                if (e0.rigidbody && e0.rigidbody.bodyType === pc.fw.RIGIDBODY_TYPE_STATIC &&
                    e1.rigidbody && e1.rigidbody.bodyType === pc.fw.RIGIDBODY_TYPE_STATIC ) {
                    continue;
                }
                
                var e0HasCollisionEvents = e0.collider.hasEvent(pc.fw.EVENT_CONTACT) || e0.collider.hasEvent(pc.fw.EVENT_COLLISIONSTART);
                var e1HasCollisionEvents = e1.collider.hasEvent(pc.fw.EVENT_CONTACT) || e1.collider.hasEvent(pc.fw.EVENT_COLLISIONSTART);

                // do some early checks for optimization
                if (hasContactEvt || e0HasCollisionEvents || e1HasCollisionEvents) {
                    var numContacts = manifold.getNumContacts();
                    if (numContacts > 0) {                   
                        var e0Contacts = e0HasCollisionEvents ? [] : null;
                        var e1Contacts = e1HasCollisionEvents ? [] : null;
                        for (j = 0; j < numContacts; j++) {
                            var contactPoint = manifold.getContactPoint(j);
                            var e0ContactPoint = hasContactEvt || e0Contacts ? this._createContactPointFromAmmo(contactPoint) : null;
                            if (hasContactEvt) {
                                this.fire(pc.fw.EVENT_CONTACT, new SingleContactResult(e0, e1, e0ContactPoint));
                            }

                            if (e0Contacts) {
                                e0Contacts.push(e0ContactPoint);
                            }

                            if (e1Contacts) {
                                e1Contacts.push(this._createReverseContactPointFromAmmo(contactPoint));
                            }
                        }


                        if (e0Contacts)
                            this._handleEntityCollision(e0, e1, e0Contacts);

                        if (e1Contacts)
                            this._handleEntityCollision(e1, e0, e1Contacts);
                    }
                }
            }                

            // check for collisions that no longer exist and fire events
            this._cleanOldCollisions();         
        }
    });

    return {
        /** 
        * @enum pc.fw.RIGIDBODY_TYPE
        * @name pc.fw.RIGIDBODY_TYPE_STATIC
        * @description Static rigid bodies have infinite mass and can never move. You cannot apply forces or impulses to them or set their velocity.
        */
        RIGIDBODY_TYPE_STATIC: 'static',
        /** 
        * @enum pc.fw.RIGIDBODY_TYPE
        * @name pc.fw.RIGIDBODY_TYPE_DYNAMIC
        * @description Dynamic rigid bodies are simulated according to the forces acted on them. They have a positive, non-zero mass.
        */
        RIGIDBODY_TYPE_DYNAMIC: 'dynamic',
        /** 
        * @enum pc.fw.RIGIDBODY_TYPE
        * @name pc.fw.RIGIDBODY_TYPE_KINEMATIC
        * @description Kinematic rigid bodies are objects with infinite mass but can be moved by directly setting their velocity. You cannot apply forces or impulses to them.
        */
        RIGIDBODY_TYPE_KINEMATIC: 'kinematic',

        // Collision flags from AmmoJS
        RIGIDBODY_CF_STATIC_OBJECT: 1,
        RIGIDBODY_CF_KINEMATIC_OBJECT: 2,
        RIGIDBODY_CF_NORESPONSE_OBJECT: 4,

        // Activation states from AmmoJS
        RIGIDBODY_ACTIVE_TAG: 1,
        RIGIDBODY_ISLAND_SLEEPING: 2,
        RIGIDBODY_WANTS_DEACTIVATION: 3,
        RIGIDBODY_DISABLE_DEACTIVATION: 4,
        RIGIDBODY_DISABLE_SIMULATION: 5,


        /**
        * @private
        * @enum pc.fw.EVENT
        * @name pc.fw.EVENT_CONTACT
        * @description Event fired when two Entities are touching each other
        */
        EVENT_CONTACT: 'contact',
        /**
        * @private
        * @enum pc.fw.EVENT
        * @name pc.fw.EVENT_COLLISIONSTART
        * @description Event fired when two Entities start touching each other
        */
        EVENT_COLLISIONSTART: 'collisionstart',
        /**
        * @private
        * @enum pc.fw.EVENT
        * @name pc.fw.EVENT_COLLISIONEND
        * @description Event fired when two Entities stop touching each other
        */
        EVENT_COLLISIONEND: 'collisionend',

        RigidBodyComponentSystem: RigidBodyComponentSystem
    };
}());