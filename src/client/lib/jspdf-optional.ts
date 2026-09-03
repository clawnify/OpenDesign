// jsPDF dynamically imports canvg / html2canvas / dompurify from `doc.svg()` and
// `doc.html()`. This app only ever calls `addImage`, so those paths never run,
// but the bundler still has to resolve the specifiers. Aliasing them here keeps
// html2canvas (and canvg's native node-canvas build) out of the install.
export default {};
