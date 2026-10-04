# Variant `day` (syllabus → days)

Carries over the owner's v1.2 day format, with the fixes from the evaluation.

```
<course>/
├── manifest.json            ← tracks, days, files, est_minutes, slot_minutes
├── README.md                ← generated
├── COURSE-MAP.md
└── <track>/
    └── day{N}/
        ├── quicklearn.md          ← 10-min read, "## 8-question diagnostic", "## Answer key"
        ├── deepdive.md            ← starts with the Detective block; ends with Glossary,
        │                             Common questions, Connection to the bigger picture
        ├── instructor_script.md   ← Say/Do teleprompter; "### Total runtime: **N hours**";
        │                             timed sections "## Title (h:mm — h:mm)"; "[graded]" marker
        ├── printable_handout.md
        ├── student_guide_dayNN.md
        ├── recall.md              ← "## Exercise N — title (5 min)", "**What to do:**",
        │                             "**The answer (check after):**", then Q/A cards
        ├── activity_key.md        ← trainer-only
        ├── trainer_prep.md        ← principle 2
        ├── whiteboard_dayNN.md, live_coding_dayNN.md (optional)
        ├── lab/                   ← runnable, each with a check
        └── assets/                ← .mmd diagrams
```

Changes from v1.2: `recall.md` replaces `memory_recall_dayNN.md` (the LMS accepts both names);
`activity_key.md` and `trainer_prep.md` are new; README is generated; the gate has one list.
