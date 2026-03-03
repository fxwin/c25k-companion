/* Web Worker that fires a reliable 1-second tick, even when the page is backgrounded */
let interval = null;

self.addEventListener('message', (e) => {
  if (e.data === 'start' && !interval) {
    interval = setInterval(() => self.postMessage('tick'), 1000);
  } else if (e.data === 'stop') {
    clearInterval(interval);
    interval = null;
  }
});
