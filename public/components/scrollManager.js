let lastScrollTop = 0;
let freezeAutoScroll = false;

export function initScrollListener(root) {
  root.addEventListener("scroll", () => {
    const currentScrollTop = root.scrollTop;
    if (currentScrollTop >= lastScrollTop) {
      lastScrollTop = currentScrollTop;
      freezeAutoScroll = false;
    } else {
      freezeAutoScroll = true;
    }
  });
}

export function resetScroll() {
  lastScrollTop = 0;
  freezeAutoScroll = false;
}

export function scrollDown(root) {
  if (!freezeAutoScroll) {
    root.scrollTo({ top: root.scrollHeight });
  }
}
