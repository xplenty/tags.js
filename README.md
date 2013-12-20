tags.js
=======

tags.js is a fully-featured tags input library


Usage:
------

```
$('#demo').tags({
  $('#tags').tags({
    tags: _.clone(tags),
    source: _.clone(tags)
  }).on('tags_remove', function(e, tag){
    $('#tags').tags('removeTag', tag);
  });
});
```
