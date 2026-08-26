const COLLAPSIBLE_CARD_SELECTOR = 'article.card';
const COLLAPSIBLE_DETAILS_SELECTOR = 'details';
const INTERACTIVE_SELECTOR = 'button,a,input,select,textarea,label,summary,[role="button"]';

function collapseDetails(details: HTMLDetailsElement) {
  if (details.dataset.defaultCollapseReady === 'true') return;
  details.dataset.defaultCollapseReady = 'true';
  details.open = false;
}

function setCardExpanded(card: HTMLElement, expanded: boolean) {
  card.classList.toggle('tileCollapsed', !expanded);
  card.dataset.tileExpanded = String(expanded);
  const header = card.firstElementChild;
  if (header instanceof HTMLElement) header.setAttribute('aria-expanded', String(expanded));
}

function prepareCard(card: HTMLElement) {
  if (card.dataset.tileCollapseReady === 'true') return;
  card.dataset.tileCollapseReady = 'true';
  card.classList.add('collapsibleTile');
  const header = card.firstElementChild;
  if (header instanceof HTMLElement) {
    header.classList.add('tileToggle');
    header.tabIndex = 0;
    header.setAttribute('role', 'button');
  }
  setCardExpanded(card, false);
}

function prepareElement(element: Element) {
  if (element.matches(COLLAPSIBLE_DETAILS_SELECTOR)) {
    const details = element as HTMLDetailsElement;
    window.setTimeout(() => collapseDetails(details), 60);
  }
  if (element.matches(COLLAPSIBLE_CARD_SELECTOR) && !(element instanceof HTMLDetailsElement)) {
    window.setTimeout(() => prepareCard(element as HTMLElement), 60);
  }
  element.querySelectorAll<HTMLDetailsElement>(COLLAPSIBLE_DETAILS_SELECTOR).forEach(details => {
    window.setTimeout(() => collapseDetails(details), 60);
  });
  element.querySelectorAll<HTMLElement>(COLLAPSIBLE_CARD_SELECTOR).forEach(card => {
    if (!(card instanceof HTMLDetailsElement)) window.setTimeout(() => prepareCard(card), 60);
  });
}

function toggleCard(card: HTMLElement) {
  setCardExpanded(card, card.dataset.tileExpanded !== 'true');
}

export function initializeResponsiveTiles() {
  const root = document.documentElement;
  prepareElement(root);

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) prepareElement(node);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const card = target.closest<HTMLElement>('article.card.collapsibleTile');
    if (!card) return;
    const header = card.firstElementChild;
    if (!(header instanceof HTMLElement) || !header.contains(target)) return;

    // The header itself is given role="button" for accessibility. When the user
    // taps a child inside that header, closest(INTERACTIVE_SELECTOR) therefore
    // resolves to the header. That should still toggle the card. Only genuine
    // nested controls such as the remove button should consume the click.
    const interactiveTarget = target.closest<HTMLElement>(INTERACTIVE_SELECTOR);
    if (interactiveTarget && interactiveTarget !== header) return;

    toggleCard(card);
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('tileToggle')) return;
    const card = target.closest<HTMLElement>('article.card.collapsibleTile');
    if (!card) return;
    event.preventDefault();
    toggleCard(card);
  });
}
