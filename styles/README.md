# Styles Structure

Styles are loaded in this order from [`index.html`](/D:/work/bloknot-mashinista-tg/index.html):

1. [`00-base.css`](/D:/work/bloknot-mashinista-tg/styles/00-base.css)
2. [`10-navigation-and-cards.css`](/D:/work/bloknot-mashinista-tg/styles/10-navigation-and-cards.css)
3. [`15-bottom-nav.css`](/D:/work/bloknot-mashinista-tg/styles/15-bottom-nav.css)
4. [`16-press-feedback.css`](/D:/work/bloknot-mashinista-tg/styles/16-press-feedback.css)
5. [`20-form-and-stats.css`](/D:/work/bloknot-mashinista-tg/styles/20-form-and-stats.css)
6. [`30-shifts-and-overlays.css`](/D:/work/bloknot-mashinista-tg/styles/30-shifts-and-overlays.css)
7. [`40-premium-refresh.css`](/D:/work/bloknot-mashinista-tg/styles/40-premium-refresh.css)

## Notes

- `00-base.css`: tokens, root variables, base reset, auth shell.
- `10-navigation-and-cards.css`: month navigation, dashboard, home calendar and cards.
- `15-bottom-nav.css`: isolated bottom navigation component styles.
- `16-press-feedback.css`: touch/press interaction feedback.
- `20-form-and-stats.css`: form blocks, stats and inputs.
- `30-shifts-and-overlays.css`: shifts list, document viewer, overlays, dialogs, sheets and footer components.
- `40-premium-refresh.css`: final visual override layer for premium/glow styling and nested blur cleanup.

Bottom navigation positioning variables are declared in `00-base.css` and consumed by selectors in later layers.
