ENIGMA — SECTION 02 · ARCHIVE IMAGES
====================================

Drop your archive photographs in this folder, named:

    01.jpg  02.jpg  03.jpg  ...  11.jpg

They are picked up automatically — no code changes needed.

The section is driven by space.js, not archive.js. Everything you would
normally change lives in block 1 at the top of that file:

    SETS.archive   { dir, count, ext }   the folder, how many slots, and
                                         the extension. Raise `count` (up
                                         to 24) to add more screens; use
                                         ext:'.png' or '.webp' to switch
                                         format.
    OPS            per-slot CSS object-position, so no face is lost in
                   the 4/3 panel crop. One entry per slot, in order.
    CATS / TAGS    the four category captions and their tag lines,
                   cycled across the archive.

Any slot with no file falls back to the supplied hero portrait, so the
volume always renders.
