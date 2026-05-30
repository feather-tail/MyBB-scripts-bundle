(() => {
  const dayLimit = 7;
  const containerSelector = '.activees, .activees2';
  const linkSelector = 'a';
  const msPerDay = 86400000;

  const toUtcMidnightMs = (date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

  const getTodayUtcMs = () => toUtcMidnightMs(new Date());

  const parseDateDdMmYyyyToUtcMs = (value) => {
    const match = String(value || '')
      .trim()
      .match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date.getTime();
  };

  const setHidden = (element, isHidden) => {
    element.hidden = isHidden;
    element.toggleAttribute('hidden', isHidden);
  };

  const isExpired = (link, todayUtcMs) => {
    const addedAtUtcMs = parseDateDdMmYyyyToUtcMs(link.dataset.addedAt);
    if (addedAtUtcMs === null) return false;

    const daysSinceAdded = Math.floor((todayUtcMs - addedAtUtcMs) / msPerDay);
    return daysSinceAdded > dayLimit;
  };

  const filterContainer = (container) => {
    const todayUtcMs = getTodayUtcMs();
    const links = Array.from(container.querySelectorAll(linkSelector));

    links.forEach((link) => {
      setHidden(link, isExpired(link, todayUtcMs));
    });

    const hasVisibleLinks = links.some((link) => !link.hidden);
    setHidden(container, !hasVisibleLinks);
  };

  const collectContainers = (node, containers) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.matches(containerSelector)) {
      containers.add(node);
    }

    const parentContainer = node.closest(containerSelector);
    if (parentContainer) {
      containers.add(parentContainer);
    }

    node.querySelectorAll(containerSelector).forEach((container) => {
      containers.add(container);
    });
  };

  const filterAll = () => {
    document.querySelectorAll(containerSelector).forEach(filterContainer);
  };

  const observer = new MutationObserver((mutations) => {
    const containers = new Set();

    mutations.forEach((mutation) => {
      collectContainers(mutation.target, containers);

      mutation.addedNodes.forEach((node) => {
        collectContainers(node, containers);
      });
    });

    containers.forEach(filterContainer);
  });

  const init = () => {
    filterAll();

    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
