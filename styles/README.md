# Styles Structure

Styles are loaded in this order from [`index.html`](/D:/work/bloknot-mashinista-tg/index.html):

1. [`00-base.css`](/D:/work/bloknot-mashinista-tg/styles/00-base.css)
2. [`10-navigation-and-cards.css`](/D:/work/bloknot-mashinista-tg/styles/10-navigation-and-cards.css)
3. [`15-bottom-nav.css`](/D:/work/bloknot-mashinista-tg/styles/15-bottom-nav.css)
4. [`20-form-and-stats.css`](/D:/work/bloknot-mashinista-tg/styles/20-form-and-stats.css)
5. [`30-shifts-and-overlays.css`](/D:/work/bloknot-mashinista-tg/styles/30-shifts-and-overlays.css)

## Notes

- `00-base.css`: tokens, root variables, base reset, auth shell.
- `10-navigation-and-cards.css`: month navigation and dashboard cards.
- `15-bottom-nav.css`: isolated bottom navigation component styles.
- `20-form-and-stats.css`: form blocks, stats and inputs.
- `30-shifts-and-overlays.css`: shifts list, overlays, dialogs and footer components.

Bottom navigation positioning variables are declared in `00-base.css` and consumed by selectors in `10-navigation-and-cards.css`.
