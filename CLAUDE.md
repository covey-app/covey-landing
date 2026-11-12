# covey-landing: rules for agents

## Banned word: "flock"

Never use the word "flock" anywhere in this repo: page copy, headings, alt
text, aria labels, code comments, variable names, test names, docs, and file or
folder names. Say "quails" for the category birds (images live in
`public/brand/quails/`), and "group" or "crew" for people. This is an owner rule
(2026-11-11), not a style preference.

Check before finishing any change:

```bash
grep -rni flock --exclude=CLAUDE.md --exclude-dir=node_modules --exclude-dir=.vercel --exclude-dir=.astro --exclude-dir=dist --exclude-dir=.claude --exclude-dir=.git .
```

It should print nothing. (This file is the only place the word may appear.)
