
# 📘 RemiFocus

A note-based learning plugin for Obsidian that supports flashcards, spaced repetition, and structured review workflows.

---

## 🧠 Overview

RemiFocus helps you turn Markdown notes into a structured learning workflow:

* Create flashcards from notes
* Review using spaced repetition scheduling
* Track learning progress per note
* Organize knowledge into optional units (KU)

It is designed to stay lightweight and integrate naturally into the Obsidian experience.

---

## 🧭 System Architecture

```text
Obsidian Notes
     │
     ▼
[ Card Generation Layer ]
     │
     ▼
[ Learning Data Layer ]
     │   ├── Flashcards
     │   ├── Review History
     │   └── Scheduling State
     │
     ▼
[ Review Engine ]
     │
     ├── SM-2 style scheduling
     ├── Optional KU grouping
     └── Due card selection
     │
     ▼
[ UI Layer ]
 ├── Ribbon entry
 ├── Modal deck view
 ├── Session review view
 └── Sidebar quick view
```

---

## 🔁 Core Learning Flow

```text
1. Open a note in Obsidian
        │
        ▼
2. Open RemiFocus (Ribbon / command)
        │
        ▼
3. View note-based deck (DECK_VIEW)
        │
        ├── Create cards (manual / quick / KU)
        │
        ▼
4. Start review session (SESSION_VIEW)
        │
        ├── Answer cards
        ├── Record performance
        └── Update schedule
        │
        ▼
5. Review result summary (RESULT_VIEW)
        │
        └── Updates learning state
```

---

## 🧩 Entry Points

```text
┌──────────────────────────────┐
│ Obsidian UI                  │
├──────────────────────────────┤
│ 🧠 Ribbon icon               │ → Main deck view
│ 📎 Sidebar view              │ → Quick overview
│ ⚙️ Command palette          │ → Actions & settings
└──────────────────────────────┘
```

---

## 📇 Deck View (Note Context)

```text
┌──────────────────────────────────────────────┐
│ Note: physiology/breathing.md               │
├──────────────────────────────────────────────┤
│ Deck summary                                 │
│ - Cards: 12                                  │
│ - Mastery: 82%                               │
│ - Due: 0                                     │
│                                              │
│ Actions:                                     │
│ [Start Review] [Create Cards] [View Stats]   │
│                                              │
│ Sub-decks:                                   │
│ - Breathing physiology                       │
│ - Related topics                             │
└──────────────────────────────────────────────┘
```

---

## 🧪 Review Session Flow

```text
┌──────────────────────────────────────┐
│ Review Session                       │
├──────────────────────────────────────┤
│ Card 3 / 12                         │
│                                      │
│ Question:                            │
│ What is the function of ...?         │
│                                      │
│ [ Answer Input Area ]                │
│                                      │
│ [Check]                              │
│                                      │
│ Feedback:                            │
│ (Shown after response)               │
└──────────────────────────────────────┘
```

---

## 📊 Learning Dashboard (Sidebar)

```text
┌──────────────────────────────┐
│ RemiFocus                    │
├──────────────────────────────┤
│ Due: 12 cards               │
│ New: 5 cards                │
│                              │
│ Progress: ███████░░░        │
│                              │
│ Quick actions:              │
│ [Review] [Deck] [Plan]      │
│                              │
│ Recent notes:              │
│ - physiology               │
│ - biology                 │
└──────────────────────────────┘
```

---

## 📐 Design Principles

* Keep learning flow linear and predictable
* Avoid exposing internal IDs or technical metadata in UI
* Prefer minimal UI during review sessions
* Separate learning execution from analytics views
* Keep entry points consistent across UI surfaces

---

## 🧠 Feature Notes

### Spaced repetition

Scheduling follows a SM-2 compatible approach and may evolve in future versions.

### KU (Knowledge Units)

An optional grouping layer that helps organize related cards into structured learning units.

---

## 📦 Installation

### Manual installation

```text
.obsidian/plugins/remifocus/
```

1. Download release
2. Extract into plugins folder
3. Enable in Obsidian settings

---

## ⚙️ Development

```bash
git clone https://github.com/yourname/RemiFocus.git
cd RemiFocus
npm install
npm run dev
```

Build:

```bash
npm run build
```

---

## 📌 Roadmap

* FSRS scheduling support
* Improved analytics view
* KU refinement rules
* Session UI simplification
* Performance optimization for large vaults

---

## ⚠️ Compatibility Notes

* Works within Obsidian plugin API
* Does not modify files outside vault scope
* No external network dependency required for core features

---

## 📄 License

MIT

---

## 🧠 Acknowledgements

Inspired by spaced repetition systems such as SuperMemo and Anki, adapted for note-centric workflows inside Obsidian.

