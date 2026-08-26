const COLLAPSIBLE_CARD_SELECTOR = 'article.card';
const COLLAPSIBLE_DETAILS_SELECTOR = 'details';
const INTERACTIVE_SELECTOR = 'button,a,input,select,textarea,label,summary,[role="button"]';
const SELECTED_DETACHMENT_HEADING = 'SELECTED DETACHMENT RULES';

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

function ensureWeaponCharacteristics(card: HTMLElement) {
  if (card.dataset.tileWeaponsReady === 'true') return;

  // Most unit tiles already render UnitDetails directly in the tile body. Catalogue
  // cards are the exception: their weapon profiles live inside a nested, collapsed
  // "Datasheet details" element. Mirror only those nested weapon profiles into the
  // main tile body so every expanded unit tile exposes weapon characteristics without
  // requiring a second expansion.
  const nestedWeapons = Array.from(card.querySelectorAll<HTMLElement>('.weapon')).filter(weapon => {
    const enclosingDetails = weapon.closest('details');
    return enclosingDetails instanceof HTMLDetailsElement && enclosingDetails !== card;
  });
  if (!nestedWeapons.length) return;

  const block = document.createElement('div');
  block.className = 'details tileWeaponProfiles';
  block.setAttribute('aria-label', 'Weapon characteristics');
  nestedWeapons.forEach(weapon => block.appendChild(weapon.cloneNode(true)));

  const stats = Array.from(card.children).find(child => child.classList.contains('stats'));
  if (stats) stats.insertAdjacentElement('afterend', block);
  else card.firstElementChild?.insertAdjacentElement('afterend', block);
  card.dataset.tileWeaponsReady = 'true';
}

function prepareWeaponsForElement(element: Element) {
  if (element.matches(COLLAPSIBLE_CARD_SELECTOR)) ensureWeaponCharacteristics(element as HTMLElement);
  const parentCard = element.closest<HTMLElement>(COLLAPSIBLE_CARD_SELECTOR);
  if (parentCard) ensureWeaponCharacteristics(parentCard);
  element.querySelectorAll<HTMLElement>(COLLAPSIBLE_CARD_SELECTOR).forEach(ensureWeaponCharacteristics);
}

function setSelectedDetachmentExpanded(panel: HTMLElement, expanded: boolean) {
  panel.classList.toggle('selectedDetachmentCollapsed', !expanded);
  panel.dataset.selectedDetachmentExpanded = String(expanded);
  const header = panel.querySelector<HTMLElement>(':scope > strong');
  if (header) header.setAttribute('aria-expanded', String(expanded));
}

function prepareSelectedDetachmentPanel(section: HTMLElement) {
  const heading = section.querySelector<HTMLElement>(':scope > .eyebrow');
  if (heading?.textContent?.trim() !== SELECTED_DETACHMENT_HEADING) return;

  section.classList.add('selectedDetachmentRulesPanel');
  section.querySelectorAll<HTMLElement>(':scope > .rulePanel').forEach(panel => {
    if (panel.dataset.selectedDetachmentCollapseReady === 'true') return;
    panel.dataset.selectedDetachmentCollapseReady = 'true';
    panel.classList.add('selectedDetachmentTile');
    const header = panel.querySelector<HTMLElement>(':scope > strong');
    if (header) {
      header.classList.add('selectedDetachmentToggle');
      header.tabIndex = 0;
      header.setAttribute('role', 'button');
    }
    setSelectedDetachmentExpanded(panel, false);
  });
}

function prepareSelectedDetachmentRules(element: Element) {
  if (element.matches('section.panel')) prepareSelectedDetachmentPanel(element as HTMLElement);
  element.querySelectorAll<HTMLElement>('section.panel').forEach(prepareSelectedDetachmentPanel);
}

function prepareElement(element: Element) {
  prepareSelectedDetachmentRules(element);
  prepareWeaponsForElement(element);
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

function toggleSelectedDetachment(panel: HTMLElement) {
  setSelectedDetachmentExpanded(panel, panel.dataset.selectedDetachmentExpanded !== 'true');
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

    const detachmentPanel = target.closest<HTMLElement>('.selectedDetachmentTile');
    if (detachmentPanel) {
      const detachmentHeader = detachmentPanel.querySelector<HTMLElement>(':scope > strong.selectedDetachmentToggle');
      if (detachmentHeader?.contains(target)) {
        toggleSelectedDetachment(detachmentPanel);
        return;
      }
    }

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
    if (!(target instanceof HTMLElement)) return;

    if (target.classList.contains('selectedDetachmentToggle')) {
      const panel = target.closest<HTMLElement>('.selectedDetachmentTile');
      if (!panel) return;
      event.preventDefault();
      toggleSelectedDetachment(panel);
      return;
    }

    if (!target.classList.contains('tileToggle')) return;
    const card = target.closest<HTMLElement>('article.card.collapsibleTile');
    if (!card) return;
    event.preventDefault();
    toggleCard(card);
  });
}
