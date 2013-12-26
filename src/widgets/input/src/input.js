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
        KEY_DELETE = 46,
        KEY_BACKSPACE = 8;

    // jQueryUI Dependencies: Fried Eggs
    $.widget('ui.input', $.ui.fried_eggs, {
        widgetEventPrefix: "input_",
        options: {
            className: "input",
            anchorSuggestionsTo: null
        },
        _create: function(){
            this._super();
            this._render();
            this._hookEvents();
            var _this = this;
        },
        _hookEvents: function(){
            var _this = this,
                listButtonStream = this.createEventStream('click button').doAction('.stopPropagation'),
                keydownStream = this.createEventStream('keydown input'),
                keyupStream = this.createEventStream('keyup input'),
                hoverLIStream = this.createEventStream(this.suggestionsBox, 'mouseenter li'),
                clickLIStream = this.createEventStream(this.suggestionsBox, 'click li'),
                windowClickStream = this.createEventStream(this.window, 'click'),
                elementClickStream = this.createEventStream('click'),
                externalSuggestionToggleStream = this.createEventStream('toggle_suggestion_box');

            elementClickStream.doAction('.stopPropagation');

            hoverLIStream.onValue(function(e){
                _this.suggestionsBox
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

            //var suggestions = suggestionsStream.toProperty([];)

            fieldValue.onValue(function(keyword){
                _this._query(keyword, function(results){
                    _this.suggestionsBox
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
                .merge(externalSuggestionToggleStream.map('toggle'))
                .merge(suggestionsStream.map(function(v){ return v.length > 0 ? "open" : "close"; }))
                .merge(keydownStream.filter(function(e){ return e.which === KEY_ESCAPE; }).map('close'))

            var suggestionsVisibilityBus = new Bacon.Bus();
            suggestionsVisibilityBus.plug(suggestionsVisibilityStream);

            var listOpened = suggestionsVisibilityBus.scan(false, function(a,b){ return { "toggle": !a, "close": false, "open": true }[b]; });
            listOpened.onValue(function(){ $(_this.suggestionsBox.find('li').removeClass('active')[0]).addClass('active'); });

            if(_this.suggestionsBox.hasClass('anchored')){
                listOpened.filter(function(o){ return o; }).onValue(function(a){
                    var ref = _this.options["anchorSuggestionsTo"],
                        position = ref.position();
                    _this.suggestionsBox.css({ width: ref.width(), top: position.top + ref.height() + 2, left: position.left });
                });
            }

            listOpened.assign(this.suggestionsBox, "toggle");

            keydownStream
                .filter(fieldValue.or(listOpened))
                .onValue(function(e){ e.stopPropagation(); })

            keydownStream
                .filter(fieldValue.or(listOpened))
                .filter(function(e){ _([KEY_TAB, KEY_DELETE, KEY_BACKSPACE]).contains(e.which); })
                .onValue(function(e){ e.preventDefault(); })

            keydownStream
                .filter(function(e){ return e.which === KEY_DOWN; })
                .map('down')
                .merge(keydownStream
                    .filter(function(e){ return e.which === KEY_UP; })
                    .map('up')
                )
                .filter(listOpened)
                .onValue(function(direction){
                    var length = _this.suggestionsBox.find('li').length - 1,
                        selected =_this.suggestionsBox.find('li.active').index(),
                        next = Math.max(Math.min({ "down": selected + 1, "up": selected - 1 }[direction], length),0);
                    $(_this.suggestionsBox.find('li').removeClass('active')[next]).toggleClass('active', true);
                });

            keydownStream
                .filter(function(e){ return _([KEY_COMMA, KEY_ENTER, KEY_TAB, KEY_SPACE]).include(e.which) && !e.ctrlKey; })
                .merge(clickLIStream.doAction('.preventDefault'))
                .filter(listOpened)
                .doAction(function(e){
                    e.preventDefault();
                    _this.element.find('input').val((_this.suggestionsBox.find('li.active').data('tag')||{ "caption": "" })["caption"]);
                    _this._trigger('set', null, _(_this.suggestionsBox.find('li.active').data('tag')).clone());
                })
                .onValue(function(){
                    suggestionsVisibilityBus.push('close');
                });

            keydownStream
                .filter(function(e){ return e.which === KEY_ENTER && !e.ctrlKey })
                .filter(listOpened.not().and(fieldValue))
                .onValue(function(){
                    _this._trigger('set', null, { caption: _this.element.find('input').val() });
                });

            listButtonStream
                .filter(listOpened.not())
                .onValue(function(e){
                    e.preventDefault();
                    _this.element.find('input').val('');
                    _.delay(function(){
                        suggestionsVisibilityBus.push('open');
                    });
                });

            listButtonStream
                .filter(listOpened)
                .onValue(function(){
                    _.delay(function(){
                        suggestionsVisibilityBus.push('close');
                    });
                });

            windowClickStream.onValue(function(){
                suggestionsVisibilityBus.push('close');
            });
        },
        toggleSuggestionBox: function(){
            this.element.trigger('toggle_suggestion_box');
        },
        setFocus: function(){
            var _this = this;
            _.delay(function(){
                _this.element.find('input').focus();
            });
        },
        _render: function(){
            this.element
                .addClass(this.options["className"])
                .empty()
                .html('<input type="text"/><ul class="suggestions dropdown-menu"></ul>');

            this.suggestionsBox = this.element.find('ul');
            this.options["anchorSuggestionsTo"] && this.suggestionsBox.addClass('anchored').insertAfter(this.options["anchorSuggestionsTo"]);

        },
        _query: function(keyword, callback){
            var _this = this;
            (this.options["query"] || function(){
                callback(
                    _(_this.options["source"])
                        .chain()
                        .filter(function(o){ return ~o["caption"].indexOf(keyword.toLowerCase()); })
                        .value()
                )
            })(keyword, callback);
        },
        _destroy: function(){
            this.suggestionsBox.remove();
            this._super();
        }
    });

})(window.jQuery);


