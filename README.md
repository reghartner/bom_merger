`npm install`

Merge All PDFs in folder:

`node merge-boms.js ./pdfs`

Analyze Single PDF:

`node merge-boms.js ./pdfs/filename`

`--debug` flag for additional context

This works best with:
- PedalPCB "Parts List" style BOMs
- Effects Layouts "Shopping List" style BOMs

It can also parse generic (R1 100K) style BOMs found in older PedalPCB and Effects Layouts BOMs and probably others as it is looking for key value pairs anywhere in the document.  Worth running the debug flag on these to see what lines could not be parsed.