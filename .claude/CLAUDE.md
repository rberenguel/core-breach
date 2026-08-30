# Core Breach — project rules

## Before touching CSS or HTML

- There is NO Tailwind. CSS is hand-rolled in `libs/utils.css` (utility classes) and `src/styles.css` (components, resets, variables).
- Before adding any class to HTML or JS-injected markup, verify the class exists in one of those two files.
- Read the relevant files before assuming anything works.
- Do not add inline styles. Do not invent classes. Do not guess.
