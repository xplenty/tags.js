(function($){

    var KEY_DOWN = 40,
        KEY_UP = 38,
        KEY_ENTER = 13,
        KEY_ESCAPE = 27,
        KEY_TAB = 9,
        KEY_SPACE = 32,
        KEY_COMMA = 188,
        KEY_LEFT = 37,
        KEY_RIGHT = 39,
        KEY_DELETE = 46;

    // jQueryUI Dependencies: Fried Eggs
    $.widget('ui.input', $.ui.fried_eggs, {
        widgetEventPrefix: "input_",
        options: {
            className: "input"
        },
        _create: function(){
            this._super();
            this._render();
            this._hookEvents();
            var _this = this;

            _.delay(function(){
                _this.element.focus().find('input').focus();
            }, 10);
        },
        _hookEvents: function(){
            var _this = this,
                listButtonStream = this.createEventStream('click button').doAction('.stopPropagation'),
                keydownStream = this.createEventStream('keydown input'),
                keyupStream = this.createEventStream('keyup input'),
                hoverLIStream = this.createEventStream('mouseenter li'),
                clickLIStream = this.createEventStream('click li'),
                windowClickStream = this.createEventStream(this.window, 'click'),
                elementClickStream = this.createEventStream('click');

            elementClickStream.doAction('.stopPropagation');

            hoverLIStream.onValue(function(e){
                _this.element
                    .find('li')
                    .removeClass('active');
                $(e.target).toggleClass('active');
            });

            var fieldValue =
                keyupStream
                    .merge(keyupStream)
                    .map(function(e){ return _this.element.find('input').val(); })
                    .toProperty("")
                    .skipDuplicates();

            var suggestionsStream = fieldValue
                .changes()
                .flatMapLatest(function(v){
                    return v.length > 0 ? Bacon.fromCallback(function(cb){
                        _this._query(v, cb);
                    }) : Bacon.once([]);
                });

            fieldValue.onValue(function(keyword){
                _this._query(keyword, function(results){
                    _this.element
                        .find('ul')
                        .empty()
                        .append(
                            _(results).map(function(result, i){
                                return $('<li/>')
                                    .data({ tag: result })
                                    .toggleClass('active', i === 0)
                                    .text((result["caption"]))
                            })
                        )
                });
            });

            var suggestionsVisibilityStream = keydownStream
                .filter(function(e){ return e.which === KEY_ENTER && e.ctrlKey; })
                .map('toggle')
                .merge(suggestionsStream.map(function(v){ return v.length > 0 ? "open" : "close"; }))
                .merge(keydownStream.filter(function(e){ return e.which === KEY_ESCAPE; }).map('close'))

            var suggestionsVisibilityBus = new Bacon.Bus();
            suggestionsVisibilityBus.plug(suggestionsVisibilityStream);

            var listOpened = suggestionsVisibilityBus.scan(false, function(a,b){ return { "toggle": !a, "close": false, "open": true }[b]; });
            listOpened.onValue(function(){ $(_this.element.find('li').removeClass('active')[0]).addClass('active'); });
            listOpened.assign(this.element.find('ul'), "toggle");

            keydownStream
                .filter(fieldValue.or(listOpened))
                .onValue(function(e){ e.stopPropagation(); });

            keydownStream
                .filter(function(e){ return e.which === KEY_DOWN; })
                .map('down')
                .merge(keydownStream
                    .filter(function(e){ return e.which === KEY_UP; })
                    .map('up')
                )
                .filter(listOpened)
                .onValue(function(direction){
                    var length = _this.element.find('li').length - 1,
                        selected =_this.element.find('li.active').index(),
                        next = Math.max(Math.min({ "down": selected + 1, "up": selected - 1 }[direction], length),0);
                    $(_this.element.find('li').removeClass('active')[next]).toggleClass('active', true);
                });

            keydownStream
                .filter(function(e){ return _([KEY_COMMA, KEY_ENTER, KEY_TAB, KEY_SPACE]).include(e.which) && !e.ctrlKey; })
                .merge(clickLIStream.doAction('.preventDefault'))
                .filter(listOpened)
                .doAction(function(e){
                    e.preventDefault();
                    _this.element.find('input').val(_this.element.find('ul li.active').data('tag')["caption"]);
                    _this._trigger('set', null, _this.element.find('input').val());
                })
                .throttle(100)
                .onValue(function(){
                    suggestionsVisibilityBus.push('close');
                });

            keydownStream
                .filter(function(e){ return e.which === KEY_ENTER && !e.ctrlKey })
                .filter(listOpened.not().and(fieldValue))
                .onValue(function(){
                    _this._trigger('set', null, _this.element.find('input').val());
                });

            listButtonStream
                .filter(listOpened.not())
                .onValue(function(e){
                    e.preventDefault();
                    _this.element.find('input').val('');
                    _.delay(function(){
                        suggestionsVisibilityBus.push('open');
                    }, 10);
                });

            listButtonStream
                .filter(listOpened)
                .onValue(function(){
                    _.delay(function(){
                        suggestionsVisibilityBus.push('close');
                    });
                });
        },
        _render: function(){
            this.element
                .addClass(this.options["className"])
                .empty()
                .html('<input type="text"/><button class="btn"><i class="glyphicon glyphicon-tag white"></i></button><ul class="dropdown-menu"></ul>');
        },
        _query: function(keyword, callback){
            callback(
                _(this.options["source"])
                    .chain()
                    .filter(function(o){ return ~o["caption"].indexOf(keyword.toLowerCase()); })
                    .value()
            );
        }
    });

})(window.jQuery);


