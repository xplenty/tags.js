(function($, _, Bacon){

    // Note: I'm not using "asEventStream" in order to allow the widget factory cleanup events and assign it's own namespace and sorcery
    $.widget('ui.fried_eggs', {
        /**
         * Use widget's "_on" event binder to create bacon event streams
         * @param {object} [element] - The object to listen on (base element for event delegation). If not specified, this.element is used.
         * @param {*} [eventSelector] - String/Array of events and selectors to be fed into the stream (i.e. ["click li", "mouseenter a"])
         * @returns {EventStream}
         */
        createEventStream: function(){
            var _this = this,
                eventSelectorArray = _([_(arguments).last()]).flatten(),
                element = arguments.length === 2 ? arguments[0] : this.element;

            return Bacon.fromBinder(function(sink){

                var listener = function(){
                    var argsArray = _.toArray(arguments);
                    sink(new Bacon.Next(function(){ return argsArray.length > 1 ? argsArray: argsArray[0]; }));
                }

                var eventHash = _(eventSelectorArray).reduce(function(hash, eventSelector){
                    hash[eventSelector] = listener;
                    return hash;
                }, {});

                _this._on(false, element, eventHash);

                // Unsubscribe handler (removes event binding)
                var unsubscriber = function(){
                    _(eventSelectorArray)
                        .chain()
                        .map(function(eventSelector){ return eventSelector.split(' ')[0]; })
                        .each(function(eventName){
                            _this._off(element, eventName);
                        });
                }

                // Register unsubscriber
                _this._backonUnsubscribers = (_this._backonUnsubscribers || []).concat([unsubscriber]);
                return unsubscriber;
            });
        },

        destroy: function(){
            _(this._backonUnsubscribers).each(function(unsubscriber){ unsubscriber(); });
            this._backonUnsubscribers = undefined;
            this._super();
        }
    });
})(window.jQuery, window._, window.Bacon);
