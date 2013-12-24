(function($, _){

    var KEY_DELETE = 46,
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
                tagMouseEnterStream = this.createEventStream('mouseenter div.tag'),
                tagMouseLeaveStream = this.createEventStream('mouseleave div.tag');

            tagMouseEnterStream
                .merge(tagMouseLeaveStream)
                .flatMapLatest(function(e){
                    return e.type === "mouseenter" ? Bacon.later(500, { type: "enter", tag: e.target }) : Bacon.once({ type: "out", tag: e.target });
                })
                .onValue(function(e){
                    _this._trigger(e.type === "enter" ? "over_tag" : "out_tag", null, e.tag)
                });

            keydownStream
                .filter(function(e){ return _([KEY_LEFT,KEY_RIGHT,KEY_TAB]).include(e.which); })
                .doAction('.preventDefault')
                .map(function(e){
                    return (_([
                        { direction: "left", func: function(e){ return e.shiftKey && e.which === KEY_TAB } },
                        { direction: "right", func: function(e){ return !e.shiftKey && e.which === KEY_TAB } },
                        { direction: "left", func: function(e){ return e.which === KEY_LEFT } },
                        { direction: "right", func: function(e){ return e.which === KEY_RIGHT } }
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
                    _this.element.toggleClass("focus", displayMode === "focus")
                });

            focusProperty.onValue(function(val){
                val === "focus" && (function(){
                    _this.element.focus();
                })();
            });

            removeButtonStream
                .map(function(e){ return $(e.target).parent('div.tag').data('tag'); })
                .merge(keydownStream.map('.which').filter(function(code){ return code === KEY_DELETE; }).map(function(){
                    return _this.element.find('div.tag.active').data('tag');
                }))
                .onValue(function(tag){
                    //var tag = $(target).data('tag');
                    _this._trigger('remove', null, tag);
                });

            inputTagStream.onValue(function(o){
                _this.options["tags"].push({ caption: o.ui });
                _this._render();
            });

            // Hide dragged tag
            tagDragStartStream.merge(tagDragStopStream).onValue(function(e){
                $(e["e"]["target"]).parent().toggleClass('lifted', e["e"]["type"] === "dragstart" ? true : false);
            });

            tagDroppedStream.onValue(function(o){
                _this._onTagDropped(o["e"], o["ui"]);
            });
        },
        removeTag: function(tag){
            var tagElement = _(this.element.find('div.tag').toArray()).detect(function(el){ return $(el).data('tag') === tag; });
            this.options["tags"] = _(this.options["tags"]).without(tag);
            $(tagElement).parent().remove();
            this.element.focus();

            //this._render();
        },
        _render: function(){
            var _this = this;
            this.element
                .prop('tabindex', 0)
                .addClass(this.options["className"])
                .html('<ol></ol>')
                .find('ol')
                .empty()
                .append(_(this.options["tags"])
                    .sortBy(function(tag){ return tag["order"]; })
                    .map(function(tag, index){
                        return $('<li><div class="tag" tabindex="0"><span></span><i class="glyphicon glyphicon-remove"/></div></li>')
                            .find('div')
                            .find('span')
                            .text(tag["caption"])
                            .end()
                            .draggable({
                                helper: "clone",
                                appendTo: _this.element,
                                distance: 5
                            })
                            .prop('title', tag["title"])
                            .data({ tag: tag })
                            .end()
                            .droppable({
                                tolerance: "intersect",
                                accept: ".tag",
                                hoverClass: "append_left"
                            })
                            .data({ tag: tag });
                    }));

            this._appendInputField();
        },
        _appendInputField: function(){
            var _this = this;
            _this.element.find('ol').append($('<li/>').append($('<div/>').input({
                source: _this.options["source"],
                anchorSuggestionsTo: _this.element
            })));
        },
        _pushBefore: function(tag, beforeTag){
            var tags = this.options["tags"];
            this.options["tags"] = _(tags).chain().without(tag).splice(_(tags).indexOf(beforeTag), 0, tag).value();
        },
        _onTagDropped: function(e, ui){
            var _this = this;
            this._pushBefore(ui.draggable.data('tag'), $(e.target).data('tag'));
            _.delay(function(){ _this._render(); });
        }
    });

})(window.jQuery, window._);
