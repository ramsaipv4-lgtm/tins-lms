# Variant `case-study` (codebase or build → micro-steps)

```
<course>/
├── manifest.json        ← steps in order: id, title, module, est_minutes, prereqs,
│                          checkpoint_after, skills, files
├── README.md            ← generated from manifest (never hand-edited)
├── 00-syllabus.md
├── 01-strategy.md
├── steps/
│   └── ms-03.01-how-authentication-works/
│       ├── lesson.md            ← front matter + sections (templates/lesson.md)
│       ├── instructor_script.md ← Say/Do, from the talking points
│       ├── recall.md            ← 3 closed-book tasks + 8–10 cards
│       ├── activity_key.md
│       └── trainer_prep.md
├── checkpoints/checkpoint-1/{checkpoint.md, rubric.md}
├── final-project/{brief.md, rubric.md}
├── appendix/{A-post-ship-fixes.md, B-decision-log.md}
└── marketing/{non-technical.txt, technical.txt}
```

Step ids are zero-padded `ms-MM.SS`, so sorting by name gives course order.
