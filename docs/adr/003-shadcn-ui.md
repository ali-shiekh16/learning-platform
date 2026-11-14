# ADR 003 — shadcn/ui for UI components

**Status:** Accepted

## Context
The brief says to prioritise working functionality over visual complexity, but the app still needs forms, dialogs, tabs, tables, selects, sliders and notifications that are consistent and accessible.

## Decision
Use **shadcn/ui** (Radix UI primitives styled with Tailwind CSS).

## Reasons
- **Owned code.** Components are copied into the repository, not hidden in a dependency, so they can be read and changed freely.
- **Accessibility built in.** Radix handles focus management, keyboard navigation and ARIA for dialogs, tabs, selects and menus.
- **Speed.** A clean, consistent UI without spending time on design.
- **Theming via CSS variables**, which can also be applied to LiveKit's components for a consistent look.

## Components used
Button, Input, Form, Card, Dialog, Tabs, Table, Badge, Select, Slider, Avatar, Tooltip, Sonner (toasts).

## Alternatives considered
- **MUI / Chakra / Mantine.** Complete libraries, but components live in a dependency with their own styling systems; heavier to customise.
- **Plain Tailwind.** Would mean building accessible dialogs, selects and tabs from scratch.

## Consequences
- Tailwind becomes the styling approach across the app.
- LiveKit's prebuilt components bring their own CSS; they are themed with shadcn's CSS variables or replaced by LiveKit's unstyled primitives where needed.
