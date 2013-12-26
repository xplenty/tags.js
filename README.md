tags.js
=======

tags.js is a fully-featured tags input library


Usage:
------

```
$('#demo').tags({
  $('#tags').tags({
    tags: [],
    source: [],
    reduceSuggestions: true,    // Reduce suggestions to available tags only
    allowDuplicates: true,      // Allow duplications of tags
    allowNew: false             // Allow creation of new tags
  }).on('tags_remove', function(e, tag){
    $('#tags').tags('removeTag', tag);
  });
});
```
