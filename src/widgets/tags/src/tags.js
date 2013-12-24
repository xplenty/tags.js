(function($, _){

    var KEY_DELETE = 46,
        KEY_BACKSPACE = 8,
        KEY_RIGHT = 39,
        KEY_LEFT = 37,
        KEY_TAB = 9;

    // jQueryUI Dependencies: Fried Eggs
    $.widget('ui.tags', $.ui.fried_eggs, {
        widgetEventPrefix: "tags_",
        options: {
            className: "tags"
        },
        _create: function(){
            this._super();
            this._render();
            this._hookEvents();
        },
        _hookEvents: function(){
            var _this = this;
            var widgetEvents = function(es){ return { e: es[0], ui:es[1] }; };

            var keydownStream = this.createEventStream('keydown'),
                tagBlurStream = this.createEventStream('blur .tag'),
                tagDragStartStream = this.createEventStream('dragstart .tag').map(widgetEvents),
                tagDragStopStream = this.createEventStream('dragstop .tag').map(widgetEvents),
                spotMouseMoveStream = this.createEventStream('mousemove li.ui-droppable'),
                spotMouseOutStream = this.createEventStream('mouseout li.ui-droppable'),
                whileDragProperty = tagDragStartStream.map(true).merge(tagDragStopStream.map(false)).toProperty(false),
                doubleClickStream = this.createEventStream('dblclick'),
                tagDroppedStream = this.createEventStream('drop li').map(widgetEvents),
                inputTagStream = this.createEventStream('input_set').map(widgetEvents),
                removeButtonStream = this.createEventStream('click li i'),
                clickStream = this.createEventStream('click').doAction('.stopPropagation'),
                clickWindowStream = this.createEventStream(this.window, 'click'),
                clickTagStream = this.createEventStream('click div.tag'),
                clickSuggestionButtonStream = this.createEventStream('click div.utility_tray'),
                tagMouseEnterStream = this.createEventStream('mouseenter div.tag'),
                tagMouseLeaveStream = this.createEventStream('mouseleave div.tag');

            clickSuggestionButtonStream.onValue(function(){
                _this.element.find('.input').input('toggleSuggestionBox');
            });

            tagMouseEnterStream
                .merge(tagMouseLeaveStream)
                .flatMapLatest(function(e){
                    return e.type === "mouseenter" ? Bacon.later(500, { type: "enter", tag: e.target }) : Bacon.once({ type: "out", tag: e.target });
                })
                .onValue(function(e){
                    _this._trigger(e.type === "enter" ? "over_tag" : "out_tag", null, e.tag)
                });

            removeButtonStream
                .map(function(e){ return $(e.target).parent('div.tag').data('tag'); })
                .merge(
                    keydownStream
                        .map('.which')
                        .filter(function(code){ return _([KEY_DELETE, KEY_BACKSPACE]).contains(code); })
                        .map(function(){ return _this.element.find('div.tag.active').data('tag'); })

                )
                .onValue(function(tag){
                    _this._trigger('remove', null, tag);
                });

            keydownStream
                .filter(function(e){ return _([KEY_BACKSPACE, KEY_DELETE, KEY_LEFT, KEY_RIGHT, KEY_TAB]).include(e.which); })
                .doAction('.preventDefault')
                .map(function(e){
                    return (_([
                        { direction: "left", func: function(e){ return e.which === KEY_BACKSPACE; } },
                        { direction: "left", func: function(e){ return e.which === KEY_DELETE; } },
                        { direction: "left", func: function(e){ return e.shiftKey && e.which === KEY_TAB; } },
                        { direction: "right", func: function(e){ return !e.shiftKey && e.which === KEY_TAB; } },
                        { direction: "left", func: function(e){ return e.which === KEY_LEFT; } },
                        { direction: "right", func: function(e){ return e.which === KEY_RIGHT; } }
                    ]).detect(function(o){
                        return o.func(e);
                    })||{ "direction": null })["direction"];
                })
                .filter(function(direction){ return _(["left","right"]).include(direction); })
                .onValue(function(keyCode){
                    var currentlyActiveTag = _this.element.find('div.tag.active').parent();
                    var nextActiveTag = {
                            "left": currentlyActiveTag.prev(),
                            "right": currentlyActiveTag.next()
                        }[keyCode];

                    nextActiveTag = $(nextActiveTag[0] || {
                        "left": _this.element.find('div.tag:last').parent()[0],
                        "right": _this.element.find('div.tag:first').parent()[0]
                    }[keyCode]);

                    _this.element
                        .find('div.tag')
                        .removeClass('active');

                    nextActiveTag
                        .find('input')
                        .focus();

                    nextActiveTag
                        .find('div.tag')
                        .toggleClass('active', true)
                        .focus();
                });

            clickTagStream
                .onValue(function(e){
                    _this.element.find('div.tag').removeClass('active');
                    var tag = (e.currentTarget === e.target ? $(e.target) :  $(e.target).parent()).addClass('active').focus().data('tag');
                    _this._trigger('focus', null, tag);
                });

            tagBlurStream.
                onValue(function(e){
                    $(e.target).removeClass('active');
                });

            var focusProperty =
                clickStream
                    .map('focus')
                    .merge(clickWindowStream.map('blur'))
                    .skipDuplicates()
                    .toProperty('blur');

            focusProperty
                .onValue(function(displayMode){
                    _this.element.toggleClass("focus", displayMode === "focus");
                    displayMode === "focus" && (function(){
                        _this.element.find('.input').input('setFocus');
                    })();
                });

            focusProperty.onValue(function(val){
                val === "focus" && (function(){
                    _this.element.focus();
                })();
            });

            inputTagStream.onValue(function(o){
                _this.element.find('ol').append(_this.renderTag(o["ui"]));
                _this._appendInputField();
            });

            // Hide dragged tag
            tagDragStartStream.merge(tagDragStopStream).onValue(function(e){
                $(e["e"]["target"]).parent().toggleClass('lifted', e["e"]["type"] === "dragstart" ? true : false);
            });

            tagDroppedStream.onValue(function(o){
                _this._onTagDropped(o["e"], o["ui"]);
            });
        },
        renderTag: function(tag){
            var _this = this;
            return $('<li/>')
                .append(
                    $('<div class="tag" tabindex="0"><span></span><i class="glyphicon glyphicon-remove"/></div>')
                        .prop('title', tag["title"])
                        .data({ tag: tag })
                        .find('span')
                        .text(tag["caption"])
                        .end()
                        .draggable({
                            helper: "clone",
                            appendTo: _this.element,
                            distance: 5
                        })
                )
                .droppable({
                    tolerance: "intersect",
                    accept: ".tag",
                    hoverClass: "append_left"
                });
        },
        removeTag: function(tag){
            var tagElement = _(this.element.find('div.tag').toArray()).detect(function(el){ return $(el).data('tag') === tag; });
            $(tagElement).parent().remove();
        },
        _render: function(){
            var _this = this;
            this.element
                .prop('tabindex', 0)
                .addClass(this.options["className"])
                .html('<ol></ol>')
                .append($('<div><i class="glyphicon glyphicon-tag"></i></div>').addClass('utility_tray'))
                .find('ol')
                .empty()
                .append(
                    _(this.options["tags"])
                        .sortBy(function(tag){ return tag["order"]; })
                        .map(_.bind(_this.renderTag, this))
                );

            this._appendInputField();
        },
        _appendInputField: function(){
            var _this = this;
            _this.element.find('div.input').parent().remove();
            _this.element.find('ol').append($('<li/>').append($('<div/>').input({
                source: _this.options["source"],
                anchorSuggestionsTo: _this.element
            })));

            _this.element.find('.input').input('setFocus');
        },
        _onTagDropped: function(e, ui){
            ui.draggable.parent().insertBefore(e.target)
        }
    });

})(window.jQuery, window._);
