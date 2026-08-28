# External UI Reference Audit

## Takeaway

The five sites are useful as a pattern catalog, but importing them wholesale would make TheRSS less
coherent. The accepted update is deliberately narrow: make the real Discover run lifecycle visible
as a three-stage pipeline and retain a compact terminal summary. This combines Beautiful UI/beUI's
agent-task hierarchy, Transitions.dev's restrained state changes, and shadcn/ui's compositional
accessibility model while keeping TheRSS's existing React/CSS ownership.

| Reference       | Borrow                                                      | Do not borrow                                                    |
| --------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| Beautiful UI    | task rows, source/context legibility                        | chat shell, confidence cards, tool-call theater                  |
| beUI            | compact state row and keyboard-aware interaction cues       | Motion/Tailwind/registry dependency, novelty controls            |
| Rare UI         | none in this slice                                          | orb, gravity text, proximity/bounce navigation, reaction effects |
| Transitions.dev | opacity/transform state emphasis, reduced-motion boundary   | animation catalog/skill installation                             |
| shadcn/ui       | progress/item/collapsible semantics and open-code ownership | second design system or wholesale component import               |

## Selected Product Problem

Discover may search 22 sources, but the current active state exposes only a spinner and aggregate
count. A user cannot immediately see that planning is validated before sources run, that sources
complete independently, and that results are assembled only afterward. This is a product-state
legibility problem, not a need for a new theme.

## Accepted Direction

1. `Plan query` — current during planning and complete once searching begins.
2. `Search selected sources` — current with a native progress bar and latest completed-source
   outcome; stopping remains explicit.
3. `Assemble session` — waiting while active, then terminal with the persisted result count.

The terminal Search details summary retains source/result counts and attention/no-result/canceled
language from the actual snapshot. No fabricated intermediate state, elapsed-time claim, or source
success is introduced.

## Rejected Directions

- No new sidebar: the existing accessible resizer/collapse behavior is already verified.
- No dashboard grid or card masonry: the list-detail workspace is the correct high-density research
  scanning pattern.
- No animated chat/streaming answer surface: Discover executes typed sources and displays ranked
  records, not an opaque agent conversation.
- No dependency installation: the accepted behavior is smaller and safer as project-native React and
  semantic CSS.
