// jsdom does not implement scrollTo; the router calls it on every navigation.
window.scrollTo = () => {};
