import $ from 'jquery';
import { computed } from '@ember/object';
import { camelize, classify } from '@ember/string';
import { run } from '@ember/runloop';
import BaseLayer from 'ember-leaflet/components/base-layer';

export default BaseLayer.extend({

  enableDeleting: true, // Default value
  enableEditing: true, // Default value
  showDrawingLayer: true, // Default value

  init() {
    this._super(...arguments);

    this.set('leafletEvents', [
      L.Draw.Event.CREATED,
      L.Draw.Event.EDITED,
      L.Draw.Event.EDITMOVE,
      L.Draw.Event.EDITRESIZE,
      L.Draw.Event.EDITSTART,
      L.Draw.Event.EDITSTOP,
      L.Draw.Event.EDITVERTEX,
      L.Draw.Event.DELETED,
      L.Draw.Event.DELETESTART,
      L.Draw.Event.DELETESTOP,
      L.Draw.Event.DRAWSTART,
      L.Draw.Event.DRAWSTOP,
      L.Draw.Event.DRAWVERTEX
    ]);

    this.set('leafletOptions', [
      'draw',
      'edit',
      'enableEditing',
      'position',
      'showDrawingLayer'
    ]);
  },

  usedLeafletEvents: computed('leafletEvents', function() {
    return this.get('leafletEvents').filter(eventName => {
      eventName = camelize(eventName.replace(':', ' '));
      const methodName = '_' + eventName;
      const actionName = 'on' + classify(eventName);
      return this.get(methodName) !== undefined || this.get(actionName) !== undefined;
    });
  }),

  addToContainer() {
    if (this._layer) {
      const map = this.getMapLayer();
      if (map) {
        map.addLayer(this._layer);
      }
    }
  },

  createLayer() {
    if (this.get('showDrawingLayer')) {
      if (this.get('edit.featureGroup')) {
        return this.get('edit.featureGroup');
      } else {
        let featureGroup = new this.L.FeatureGroup();
        const map = this.getMapLayer();
        featureGroup.addTo(map);
        return featureGroup;
      }
    }

    return null;
  },

  getMapLayer() {
    let current = this;

    while (current.get('parentComponent')) {
      current = current.get('parentComponent');
    }

    return current ? current.get('_layer') : null;
  },

  didCreateLayer() {
    const map = this.getMapLayer();

    if (map && this._layer) {
      let options = this.getProperties('position', 'draw', 'edit');
      if (!options.position) {
        options.position = 'topleft';
      }

      options.edit = $.extend(true, {featureGroup: this._layer}, options.edit);
      if (!this.get('enableEditing') && !options.edit.edit) {
        options.edit.edit = false;
      }

      if (!this.get('enableDeleting') && !options.edit.remove) {
        options.edit.remove = false;
      }

      // Extend the default draw object with options overrides
      options.draw = $.extend({}, this.L.drawLocal.draw, options.draw);

      this._control = new this.L.Control.Draw(options);

      // Add the draw control to the map
      map.addControl(this._control);
    }
  },

  removeFromContainer() {
    this._super(...arguments);

    const map = this.getMapLayer();
    if (map) {
      map.removeControl(this._control);
    }
  },

  handleCreate(e) {
    const layer = e.layer;
    this._layer.addLayer(layer);
  },

  _addEventListeners() {
    this._eventHandlers = {};
    const map = this.getMapLayer();

    this.get('usedLeafletEvents').forEach(eventName => {
      const originalEventName = eventName;
      // Cleanup the Leaflet Draw event names that have colons, ex:'draw:created'
      eventName = camelize(eventName.replace(':', ' '));
      const actionName = 'on' + classify(eventName);
      const methodName = '_' + eventName;
      // Create an event handler that runs the function inside an event loop.
      this._eventHandlers[originalEventName] = function(e) {
        run(() => {
          // Try to invoke/send an action for this event
          this.invokeAction(actionName, e, this._layer, map);
          // Allow classes to add custom logic on events as well
          if(typeof this[methodName] === 'function') {
            run(this, this[methodName], e, this._layer, map);
          }
        });
      };

      // The events for Leaflet Draw are on the map object, not the layer
      map.addEventListener(originalEventName, this._eventHandlers[originalEventName], this);
    });

    // If showDrawingLayer, add new layer to the featureGroup
    if (this.get('showDrawingLayer')) {
      map.on(this.L.Draw.Event.CREATED, this.handleCreate.bind(this));
    }
  },

  _removeEventListeners() {
    if (this._eventHandlers) {
      const map = this.getMapLayer();

      this.get('usedLeafletEvents').forEach(eventName => {
        // The events for Leaflet Draw are on the map object, not the layer
        map.removeEventListener(eventName,
          this._eventHandlers[eventName], this);
        delete this._eventHandlers[eventName];
      });

      if (this.get('showDrawingLayer')) {
        map.off(this.L.Draw.Event.CREATED, this.handleCreate);
      }
    }
  }

});
