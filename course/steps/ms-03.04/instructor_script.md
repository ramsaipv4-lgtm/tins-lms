# Say/Do script — Manifests, tar archives, signed class packages

**Total runtime: 45 minutes**

## Introduction (0:00 to 0:05) [5 min]
**Say:** "An exported class must prove three things: complete, unaltered, from a trusted signer. We build each proof."
**Do:** Ask learners what a packing slip is for.

## Manifest (0:05 to 0:15) [10 min]
**Say:** "Hash every file, sort by path, compare by path."
**Do:** Live-code `verifyManifest` and show the three lists.

## ustar (0:15 to 0:30) [15 min]
**Say:** "512-byte header, octal text, checksum over spaces, two zero blocks at the end."
**Do:** Pack one file, run `tar -tf`, then break the checksum and run it again.

## Signing (0:30 to 0:40) [10 min]
**Say:** "Signature first, then trust. The order gives three different answers."
**Do:** Flip one byte, then swap the trusted key, and show each result.

## Wrap-up (0:40 to 0:45) [5 min]
**Do:** Run the Check yourself questions.
